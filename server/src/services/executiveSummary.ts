/**
 * CSCX.AI Executive Summary Service
 * PRD-179: Executive Summary Report
 *
 * Business logic for generating executive-level CS performance summaries,
 * including metrics aggregation, narrative generation, and scheduled reports.
 */

import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { config } from '../config/index.js';

// ============================================
// Types (mirroring frontend types)
// ============================================

interface KeyMetric {
  name: string;
  value: number;
  target: number;
  status: 'on_track' | 'at_risk' | 'behind';
  change: number;
  change_period: string;
  unit: 'percent' | 'currency' | 'days' | 'count' | 'score';
}

interface PortfolioSummary {
  total_arr: number;
  arr_change: number;
  arr_change_percent: number;
  customer_count: number;
  net_new_customers: number;
  churned_customers: number;
  churned_arr: number;
  expansion_arr: number;
}

interface RetentionMetrics {
  gross_retention: number;
  gross_retention_target: number;
  net_retention: number;
  net_retention_target: number;
  logo_retention: number;
  logo_retention_target: number;
}

interface HealthMetrics {
  avg_health_score: number;
  health_score_target: number;
  healthy_count: number;
  warning_count: number;
  critical_count: number;
  health_trend: 'improving' | 'stable' | 'declining';
}

interface EngagementMetrics {
  time_to_value_days: number;
  time_to_value_target: number;
  nps_score: number;
  nps_target: number;
  csat_score: number;
  csat_target: number;
}

interface ExecutiveWin {
  id: string;
  customer_name: string;
  description: string;
  impact_arr: number;
  category: 'renewal' | 'expansion' | 'onboarding' | 'save' | 'advocacy';
  date: string;
}

interface ExecutiveRisk {
  id: string;
  customer_name: string;
  arr_at_risk: number;
  risk_type: 'churn' | 'contraction' | 'support' | 'engagement' | 'champion';
  description: string;
  severity: 'high' | 'medium' | 'low';
  days_to_renewal: number | null;
}

interface ExecutiveRecommendation {
  id: string;
  priority: 'high' | 'medium' | 'low';
  category: 'retention' | 'expansion' | 'engagement' | 'support' | 'team';
  title: string;
  description: string;
  expected_impact: string;
}

interface MetricTrend {
  period: string;
  period_label: string;
  value: number;
}

interface CSMPerformance {
  csm_id: string;
  csm_name: string;
  arr_managed: number;
  customer_count: number;
  nrr: number;
  health_avg: number;
  at_risk_count: number;
  expansion_this_period: number;
}

interface ExecutiveSummaryData {
  report_id: string;
  period: string;
  period_label: string;
  period_start: string;
  period_end: string;
  generated_at: string;
  key_metrics: KeyMetric[];
  portfolio: PortfolioSummary;
  retention: RetentionMetrics;
  health: HealthMetrics;
  engagement: EngagementMetrics;
  top_wins: ExecutiveWin[];
  key_risks: ExecutiveRisk[];
  recommendations: ExecutiveRecommendation[];
  trends: {
    arr: MetricTrend[];
    nrr: MetricTrend[];
    health_score: MetricTrend[];
    nps: MetricTrend[];
  };
  team: {
    total_csms: number;
    avg_arr_per_csm: number;
    avg_customers_per_csm: number;
    top_performers: CSMPerformance[];
    needs_attention: CSMPerformance[];
  };
  narrative: {
    overview: string;
    wins_summary: string;
    risks_summary: string;
    outlook: string;
  };
}

interface ScheduledReport {
  id: string;
  name: string;
  frequency: 'weekly' | 'monthly' | 'quarterly';
  format: 'dashboard' | 'pdf' | 'email';
  recipients: string[];
  next_run: string;
  last_run: string | null;
  enabled: boolean;
  created_at: string;
  created_by: string;
}

interface Customer {
  id: string;
  name: string;
  arr: number;
  health_score: number;
  segment?: string;
  csm_id?: string;
  csm_name?: string;
  stage?: string;
  renewal_date?: string;
  created_at: string;
}

// ============================================
// Service Class
// ============================================

class ExecutiveSummaryService {
  private supabase: SupabaseClient | null = null;

  // Mock data for demo/development
  private mockCustomers: Customer[] = [
    { id: '1', name: 'Acme Corp', arr: 250000, health_score: 85, segment: 'enterprise', csm_id: 'csm1', csm_name: 'Sarah Johnson', stage: 'active', renewal_date: '2026-06-15', created_at: '2024-01-15' },
    { id: '2', name: 'TechStart Inc', arr: 180000, health_score: 78, segment: 'enterprise', csm_id: 'csm1', csm_name: 'Sarah Johnson', stage: 'active', renewal_date: '2026-04-01', created_at: '2024-03-01' },
    { id: '3', name: 'GlobalRetail', arr: 150000, health_score: 92, segment: 'enterprise', csm_id: 'csm2', csm_name: 'Mike Chen', stage: 'active', renewal_date: '2026-08-30', created_at: '2024-02-15' },
    { id: '4', name: 'DataFlow Systems', arr: 95000, health_score: 45, segment: 'mid-market', csm_id: 'csm2', csm_name: 'Mike Chen', stage: 'active', renewal_date: '2026-02-28', created_at: '2024-04-01' },
    { id: '5', name: 'CloudNine Solutions', arr: 75000, health_score: 62, segment: 'mid-market', csm_id: 'csm3', csm_name: 'Lisa Wang', stage: 'active', renewal_date: '2026-05-15', created_at: '2024-05-15' },
    { id: '6', name: 'MegaInc', arr: 65000, health_score: 88, segment: 'mid-market', csm_id: 'csm3', csm_name: 'Lisa Wang', stage: 'active', renewal_date: '2026-09-01', created_at: '2024-06-01' },
    { id: '7', name: 'StartupXYZ', arr: 45000, health_score: 90, segment: 'mid-market', csm_id: 'csm1', csm_name: 'Sarah Johnson', stage: 'active', renewal_date: '2026-07-20', created_at: '2024-07-01' },
    { id: '8', name: 'SmallBiz Pro', arr: 18000, health_score: 75, segment: 'smb', csm_id: 'csm4', csm_name: 'Tom Roberts', stage: 'active', renewal_date: '2026-03-15', created_at: '2024-08-01' },
    { id: '9', name: 'LocalShop', arr: 12000, health_score: 82, segment: 'smb', csm_id: 'csm4', csm_name: 'Tom Roberts', stage: 'active', renewal_date: '2026-04-30', created_at: '2024-09-01' },
    { id: '10', name: 'QuickServe', arr: 9500, health_score: 38, segment: 'smb', csm_id: 'csm4', csm_name: 'Tom Roberts', stage: 'active', renewal_date: '2026-02-15', created_at: '2024-10-01' },
    { id: '11', name: 'Innovate Labs', arr: 120000, health_score: 95, segment: 'enterprise', csm_id: 'csm2', csm_name: 'Mike Chen', stage: 'active', renewal_date: '2026-11-01', created_at: '2024-11-01' },
    { id: '12', name: 'Enterprise Plus', arr: 220000, health_score: 88, segment: 'enterprise', csm_id: 'csm1', csm_name: 'Sarah Johnson', stage: 'active', renewal_date: '2026-12-15', created_at: '2025-01-01' },
  ];

  private mockWins: ExecutiveWin[] = [
    { id: 'w1', customer_name: 'Acme Corp', description: 'Renewed with 40% expansion to Premium tier', impact_arr: 50000, category: 'expansion', date: '2026-01-15' },
    { id: 'w2', customer_name: 'GlobalRetail', description: 'Added Analytics module after successful QBR', impact_arr: 30000, category: 'expansion', date: '2026-01-10' },
    { id: 'w3', customer_name: 'TechStart Inc', description: 'Saved at-risk account through executive engagement', impact_arr: 180000, category: 'save', date: '2026-01-08' },
    { id: 'w4', customer_name: 'Innovate Labs', description: 'Completed onboarding 15 days ahead of schedule', impact_arr: 120000, category: 'onboarding', date: '2025-12-20' },
    { id: 'w5', customer_name: 'Enterprise Plus', description: 'Agreed to be a reference customer and case study', impact_arr: 220000, category: 'advocacy', date: '2025-12-15' },
  ];

  private mockRisks: ExecutiveRisk[] = [
    { id: 'r1', customer_name: 'DataFlow Systems', arr_at_risk: 95000, risk_type: 'churn', description: 'Low engagement, missed last 2 QBRs, budget cuts announced', severity: 'high', days_to_renewal: 28 },
    { id: 'r2', customer_name: 'QuickServe', arr_at_risk: 9500, risk_type: 'engagement', description: 'Usage dropped 45% over last month, champion on leave', severity: 'high', days_to_renewal: 15 },
    { id: 'r3', customer_name: 'CloudNine Solutions', arr_at_risk: 75000, risk_type: 'champion', description: 'Primary champion departed, need to rebuild relationship', severity: 'medium', days_to_renewal: 105 },
  ];

  private mockScheduledReports: ScheduledReport[] = [
    { id: 'sr1', name: 'Monthly Executive Summary', frequency: 'monthly', format: 'email', recipients: ['vp-cs@company.com', 'ceo@company.com'], next_run: '2026-02-01T09:00:00Z', last_run: '2026-01-01T09:00:00Z', enabled: true, created_at: '2025-06-01', created_by: 'user1' },
    { id: 'sr2', name: 'Quarterly Board Report', frequency: 'quarterly', format: 'pdf', recipients: ['board@company.com'], next_run: '2026-04-01T09:00:00Z', last_run: '2026-01-01T09:00:00Z', enabled: true, created_at: '2025-01-01', created_by: 'user1' },
  ];

  constructor() {
    if (config.supabaseUrl && config.supabaseServiceKey) {
      this.supabase = createClient(config.supabaseUrl, config.supabaseServiceKey);
    }
  }

  // ============================================
  // Calculation Helpers
  // ============================================

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
      case 'ytd':
        start = new Date(now.getFullYear(), 0, 1);
        end = new Date(now.getFullYear(), now.getMonth() + 1, 0);
        label = `YTD ${now.getFullYear()}`;
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

  private getMetricStatus(value: number, target: number, higher_is_better: boolean = true): 'on_track' | 'at_risk' | 'behind' {
    const ratio = value / target;
    if (higher_is_better) {
      if (ratio >= 1) return 'on_track';
      if (ratio >= 0.95) return 'at_risk';
      return 'behind';
    } else {
      if (ratio <= 1) return 'on_track';
      if (ratio <= 1.05) return 'at_risk';
      return 'behind';
    }
  }

  private calculateNRR(startingARR: number, expansion: number, contraction: number, churn: number): number {
    if (startingARR === 0) return 100;
    return Math.round(((startingARR + expansion - contraction - churn) / startingARR) * 100);
  }

  private calculateGRR(startingARR: number, contraction: number, churn: number): number {
    if (startingARR === 0) return 100;
    return Math.round(((startingARR - contraction - churn) / startingARR) * 100);
  }

  private generateId(): string {
    return `exec_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  // ============================================
  // Data Fetching
  // ============================================

  private async getCustomers(): Promise<Customer[]> {
    if (this.supabase) {
      try {
        const { data, error } = await this.supabase
          .from('customers')
          .select('*')
          .neq('stage', 'churned')
          .order('arr', { ascending: false });

        if (error) throw error;

        return (data || []).map(c => ({
          id: c.id,
          name: c.name,
          arr: c.arr || 0,
          health_score: c.health_score || 70,
          segment: c.segment,
          csm_id: c.csm_id,
          csm_name: c.csm_name,
          stage: c.stage || 'active',
          renewal_date: c.renewal_date,
          created_at: c.created_at
        }));
      } catch (error) {
        console.error('Error fetching customers from Supabase:', error);
      }
    }

    return [...this.mockCustomers];
  }

  // ============================================
  // Main Service Methods
  // ============================================

  async getExecutiveSummary(query: {
    period?: string;
    segment?: string;
  } = {}): Promise<ExecutiveSummaryData> {
    const { start, end, label } = this.getPeriodDates(query.period || 'current_quarter');
    const customers = await this.getCustomers();

    // Filter by segment if specified
    const filteredCustomers = query.segment && query.segment !== 'all'
      ? customers.filter(c => c.segment === query.segment)
      : customers;

    // ============================================
    // Portfolio Calculations
    // ============================================
    const totalARR = filteredCustomers.reduce((sum, c) => sum + (c.arr || 0), 0);
    const customerCount = filteredCustomers.length;

    // Simulated previous period values for change calculations
    const previousARR = totalARR * 0.92; // Simulating 8% growth
    const arrChange = totalARR - previousARR;
    const arrChangePercent = Math.round((arrChange / previousARR) * 100);

    // Movement simulations (in real app, pull from revenue_movements table)
    const expansionARR = 110000; // From mock wins
    const churnedARR = 45000;    // Simulated churn
    const netNewCustomers = 3;
    const churnedCustomers = 1;

    const portfolio: PortfolioSummary = {
      total_arr: totalARR,
      arr_change: arrChange,
      arr_change_percent: arrChangePercent,
      customer_count: customerCount,
      net_new_customers: netNewCustomers,
      churned_customers: churnedCustomers,
      churned_arr: churnedARR,
      expansion_arr: expansionARR
    };

    // ============================================
    // Retention Metrics
    // ============================================
    const grr = this.calculateGRR(previousARR, 15000, churnedARR);
    const nrr = this.calculateNRR(previousARR, expansionARR, 15000, churnedARR);
    const logoRetention = Math.round(((customerCount - churnedCustomers + netNewCustomers) / (customerCount + netNewCustomers)) * 100);

    const retention: RetentionMetrics = {
      gross_retention: grr,
      gross_retention_target: 93,
      net_retention: nrr,
      net_retention_target: 110,
      logo_retention: logoRetention,
      logo_retention_target: 95
    };

    // ============================================
    // Health Metrics
    // ============================================
    const avgHealthScore = Math.round(filteredCustomers.reduce((sum, c) => sum + (c.health_score || 70), 0) / customerCount);
    const healthyCount = filteredCustomers.filter(c => (c.health_score || 70) >= 70).length;
    const warningCount = filteredCustomers.filter(c => (c.health_score || 70) >= 40 && (c.health_score || 70) < 70).length;
    const criticalCount = filteredCustomers.filter(c => (c.health_score || 70) < 40).length;

    const health: HealthMetrics = {
      avg_health_score: avgHealthScore,
      health_score_target: 75,
      healthy_count: healthyCount,
      warning_count: warningCount,
      critical_count: criticalCount,
      health_trend: avgHealthScore >= 75 ? 'improving' : avgHealthScore >= 70 ? 'stable' : 'declining'
    };

    // ============================================
    // Engagement Metrics
    // ============================================
    const engagement: EngagementMetrics = {
      time_to_value_days: 28,
      time_to_value_target: 30,
      nps_score: 52,
      nps_target: 50,
      csat_score: 4.3,
      csat_target: 4.0
    };

    // ============================================
    // Key Metrics (At-a-Glance)
    // ============================================
    const keyMetrics: KeyMetric[] = [
      {
        name: 'Gross Retention',
        value: grr,
        target: 93,
        status: this.getMetricStatus(grr, 93),
        change: grr - 92,
        change_period: 'vs last quarter',
        unit: 'percent'
      },
      {
        name: 'Net Revenue Retention',
        value: nrr,
        target: 110,
        status: this.getMetricStatus(nrr, 110),
        change: nrr - 108,
        change_period: 'vs last quarter',
        unit: 'percent'
      },
      {
        name: 'Avg Health Score',
        value: avgHealthScore,
        target: 75,
        status: this.getMetricStatus(avgHealthScore, 75),
        change: avgHealthScore - 74,
        change_period: 'vs last quarter',
        unit: 'score'
      },
      {
        name: 'Time to Value',
        value: 28,
        target: 30,
        status: this.getMetricStatus(28, 30, false),
        change: -2,
        change_period: 'vs last quarter',
        unit: 'days'
      },
      {
        name: 'NPS Score',
        value: 52,
        target: 50,
        status: this.getMetricStatus(52, 50),
        change: 2,
        change_period: 'vs last quarter',
        unit: 'score'
      }
    ];

    // ============================================
    // Trends (12-month history)
    // ============================================
    const generateTrend = (baseValue: number, variance: number, growth: number): MetricTrend[] => {
      const trends: MetricTrend[] = [];
      const now = new Date();
      for (let i = 11; i >= 0; i--) {
        const date = new Date(now.getFullYear(), now.getMonth() - i, 1);
        const monthLabel = date.toLocaleDateString('en-US', { month: 'short' });
        const growthFactor = 1 + (11 - i) * growth;
        const randomVariance = 1 + (Math.random() - 0.5) * variance;
        trends.push({
          period: date.toISOString().split('T')[0],
          period_label: monthLabel,
          value: Math.round(baseValue * growthFactor * randomVariance)
        });
      }
      return trends;
    };

    const trends = {
      arr: generateTrend(previousARR * 0.85, 0.04, 0.012),
      nrr: generateTrend(105, 0.05, 0.004),
      health_score: generateTrend(72, 0.06, 0.003),
      nps: generateTrend(48, 0.08, 0.006)
    };

    // ============================================
    // Team Performance
    // ============================================
    const csmGroups = new Map<string, { id: string; name: string; customers: Customer[] }>();
    filteredCustomers.forEach(c => {
      const csmId = c.csm_id || 'unassigned';
      const csmName = c.csm_name || 'Unassigned';
      if (!csmGroups.has(csmId)) {
        csmGroups.set(csmId, { id: csmId, name: csmName, customers: [] });
      }
      csmGroups.get(csmId)!.customers.push(c);
    });

    const csmPerformance: CSMPerformance[] = [];
    for (const [csmId, csmData] of csmGroups) {
      const csmCustomers = csmData.customers;
      const csmARR = csmCustomers.reduce((sum, c) => sum + (c.arr || 0), 0);
      const avgHealth = Math.round(csmCustomers.reduce((sum, c) => sum + (c.health_score || 70), 0) / csmCustomers.length);
      const atRiskCount = csmCustomers.filter(c => (c.health_score || 70) < 60).length;

      csmPerformance.push({
        csm_id: csmId,
        csm_name: csmData.name,
        arr_managed: csmARR,
        customer_count: csmCustomers.length,
        nrr: 100 + Math.floor(Math.random() * 20), // Simulated
        health_avg: avgHealth,
        at_risk_count: atRiskCount,
        expansion_this_period: Math.floor(Math.random() * 50000) // Simulated
      });
    }

    // Sort by NRR for top/bottom performers
    csmPerformance.sort((a, b) => b.nrr - a.nrr);

    const team = {
      total_csms: csmPerformance.length,
      avg_arr_per_csm: Math.round(totalARR / csmPerformance.length),
      avg_customers_per_csm: Math.round(customerCount / csmPerformance.length),
      top_performers: csmPerformance.slice(0, 2),
      needs_attention: csmPerformance.filter(c => c.at_risk_count > 1 || c.nrr < 100).slice(0, 2)
    };

    // ============================================
    // Recommendations
    // ============================================
    const recommendations: ExecutiveRecommendation[] = [
      {
        id: 'rec1',
        priority: 'high',
        category: 'retention',
        title: 'Increase executive engagement program',
        description: 'At-risk accounts with pending renewals need C-level outreach. Schedule executive sponsor calls for top 3 at-risk accounts.',
        expected_impact: 'Could save $179.5K ARR at risk'
      },
      {
        id: 'rec2',
        priority: 'high',
        category: 'support',
        title: 'Invest in support capacity for Q1',
        description: 'Support ticket volume increased 25% in December. Consider adding 1-2 support engineers to maintain SLA targets.',
        expected_impact: 'Prevent CSAT decline and churn'
      },
      {
        id: 'rec3',
        priority: 'medium',
        category: 'engagement',
        title: 'Launch proactive champion development',
        description: '8 strategic accounts have had champion turnover. Implement multi-threading strategy to reduce single-point-of-failure risk.',
        expected_impact: 'Reduce champion departure risk by 40%'
      }
    ];

    // ============================================
    // Narrative Generation
    // ============================================
    const narrative = {
      overview: `Customer Success performance for ${label} shows strong momentum with ${nrr}% NRR (${nrr >= 110 ? 'exceeding' : 'approaching'} the ${retention.net_retention_target}% target). Total ARR reached ${this.formatCurrency(totalARR)} across ${customerCount} customers, representing ${arrChangePercent}% growth. Gross retention of ${grr}% ${grr >= 93 ? 'meets' : 'is slightly below'} target, with room for improvement in the mid-market segment.`,

      wins_summary: `Key wins this period include a major expansion at Acme Corp (+$50K ARR), successful save of the TechStart account ($180K preserved), and excellent onboarding velocity at Innovate Labs. The team also secured Enterprise Plus as a reference customer, strengthening our proof points for enterprise sales.`,

      risks_summary: `Three accounts require immediate attention: DataFlow Systems ($95K ARR at risk with renewal in 28 days), QuickServe (45% usage drop), and CloudNine Solutions (champion departure). Combined ARR at risk is $179.5K. Executive engagement and save plays have been initiated.`,

      outlook: `Q2 outlook is positive with ${healthyCount} healthy accounts representing the majority of ARR. Key focus areas: (1) Close save plays on 3 at-risk accounts, (2) Expand support capacity for growing ticket volume, (3) Multi-thread relationships in accounts with champion turnover. If save plays succeed, expect NRR to reach 115% by end of Q2.`
    };

    // ============================================
    // Assemble Response
    // ============================================
    return {
      report_id: this.generateId(),
      period: query.period || 'current_quarter',
      period_label: label,
      period_start: start.toISOString().split('T')[0],
      period_end: end.toISOString().split('T')[0],
      generated_at: new Date().toISOString(),
      key_metrics: keyMetrics,
      portfolio,
      retention,
      health,
      engagement,
      top_wins: this.mockWins,
      key_risks: this.mockRisks,
      recommendations,
      trends,
      team,
      narrative
    };
  }

  // ============================================
  // Scheduled Reports
  // ============================================

  async getScheduledReports(userId?: string): Promise<ScheduledReport[]> {
    if (this.supabase) {
      try {
        let query = this.supabase
          .from('executive_report_schedules')
          .select('*')
          .order('next_run', { ascending: true });

        if (userId) {
          query = query.eq('created_by', userId);
        }

        const { data, error } = await query;

        if (error) throw error;

        return (data || []).map(s => ({
          id: s.id,
          name: s.name,
          frequency: s.frequency,
          format: s.format,
          recipients: s.recipients || [],
          next_run: s.next_run,
          last_run: s.last_run,
          enabled: s.enabled,
          created_at: s.created_at,
          created_by: s.created_by
        }));
      } catch (error) {
        console.error('Error fetching scheduled reports:', error);
      }
    }

    return [...this.mockScheduledReports];
  }

  async createScheduledReport(request: {
    name: string;
    frequency: 'weekly' | 'monthly' | 'quarterly';
    format: 'dashboard' | 'pdf' | 'email';
    recipients: string[];
    day_of_week?: number;
    day_of_month?: number;
    created_by: string;
  }): Promise<ScheduledReport> {
    const now = new Date();
    let nextRun: Date;

    // Calculate next run based on frequency
    switch (request.frequency) {
      case 'weekly':
        nextRun = new Date(now);
        nextRun.setDate(now.getDate() + (7 - now.getDay() + (request.day_of_week || 1)) % 7);
        nextRun.setHours(9, 0, 0, 0);
        break;
      case 'monthly':
        nextRun = new Date(now.getFullYear(), now.getMonth() + 1, request.day_of_month || 1, 9, 0, 0);
        break;
      case 'quarterly':
        const currentQ = Math.floor(now.getMonth() / 3);
        nextRun = new Date(now.getFullYear(), (currentQ + 1) * 3, 1, 9, 0, 0);
        break;
    }

    const schedule: ScheduledReport = {
      id: this.generateId(),
      name: request.name,
      frequency: request.frequency,
      format: request.format,
      recipients: request.recipients,
      next_run: nextRun.toISOString(),
      last_run: null,
      enabled: true,
      created_at: now.toISOString(),
      created_by: request.created_by
    };

    if (this.supabase) {
      try {
        const { data, error } = await this.supabase
          .from('executive_report_schedules')
          .insert(schedule)
          .select()
          .single();

        if (error) throw error;
        return data;
      } catch (error) {
        console.error('Error creating scheduled report:', error);
      }
    }

    // Add to mock data
    this.mockScheduledReports.push(schedule);
    return schedule;
  }

  async updateScheduledReport(id: string, updates: Partial<ScheduledReport>): Promise<ScheduledReport | null> {
    if (this.supabase) {
      try {
        const { data, error } = await this.supabase
          .from('executive_report_schedules')
          .update(updates)
          .eq('id', id)
          .select()
          .single();

        if (error) throw error;
        return data;
      } catch (error) {
        console.error('Error updating scheduled report:', error);
      }
    }

    // Update mock data
    const index = this.mockScheduledReports.findIndex(s => s.id === id);
    if (index >= 0) {
      this.mockScheduledReports[index] = { ...this.mockScheduledReports[index], ...updates };
      return this.mockScheduledReports[index];
    }
    return null;
  }

  async deleteScheduledReport(id: string): Promise<boolean> {
    if (this.supabase) {
      try {
        const { error } = await this.supabase
          .from('executive_report_schedules')
          .delete()
          .eq('id', id);

        if (error) throw error;
        return true;
      } catch (error) {
        console.error('Error deleting scheduled report:', error);
      }
    }

    // Remove from mock data
    const index = this.mockScheduledReports.findIndex(s => s.id === id);
    if (index >= 0) {
      this.mockScheduledReports.splice(index, 1);
      return true;
    }
    return false;
  }

  // ============================================
  // Report History
  // ============================================

  async saveReportSnapshot(data: ExecutiveSummaryData, userId: string): Promise<string> {
    const snapshot = {
      id: data.report_id,
      period_start: data.period_start,
      period_end: data.period_end,
      metrics: data,
      narrative: JSON.stringify(data.narrative),
      generated_at: data.generated_at,
      generated_by: userId
    };

    if (this.supabase) {
      try {
        const { data: saved, error } = await this.supabase
          .from('executive_reports')
          .insert(snapshot)
          .select()
          .single();

        if (error) throw error;
        return saved.id;
      } catch (error) {
        console.error('Error saving report snapshot:', error);
      }
    }

    return data.report_id;
  }

  async getReportHistory(limit: number = 10): Promise<Array<{ id: string; period_label: string; generated_at: string }>> {
    if (this.supabase) {
      try {
        const { data, error } = await this.supabase
          .from('executive_reports')
          .select('id, period_start, period_end, generated_at')
          .order('generated_at', { ascending: false })
          .limit(limit);

        if (error) throw error;

        return (data || []).map(r => ({
          id: r.id,
          period_label: `${r.period_start} - ${r.period_end}`,
          generated_at: r.generated_at
        }));
      } catch (error) {
        console.error('Error fetching report history:', error);
      }
    }

    return [];
  }

  // ============================================
  // Utility Methods
  // ============================================

  private formatCurrency(amount: number): string {
    if (amount >= 1000000) {
      return `$${(amount / 1000000).toFixed(1)}M`;
    }
    if (amount >= 1000) {
      return `$${(amount / 1000).toFixed(0)}K`;
    }
    return `$${amount.toFixed(0)}`;
  }
}

// Export singleton instance
export const executiveSummaryService = new ExecutiveSummaryService();
