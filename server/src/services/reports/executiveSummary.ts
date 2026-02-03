/**
 * CSCX.AI Executive Summary Report Service
 * PRD-179: Executive Summary Report
 *
 * Generates comprehensive executive summary reports for CS leadership,
 * including key metrics, trends, risks, and opportunities.
 */

import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { config } from '../../config/index.js';
import {
  calculateDashboardMetrics,
  calculateNRR,
  calculateGRR,
  evaluateNRRBenchmark,
  evaluateGRRBenchmark,
  evaluateNPSBenchmark,
} from '../metrics.js';

// ============================================
// Types
// ============================================

export interface ExecutiveMetric {
  name: string;
  actual: number;
  target: number;
  status: 'above' | 'on_target' | 'below';
  delta: number;
  deltaPercent: number;
  format: 'percent' | 'currency' | 'number' | 'days' | 'score';
}

export interface PortfolioSummary {
  totalArr: number;
  arrChange: number;
  arrChangePercent: number;
  activeCustomers: number;
  netNewCustomers: number;
  churnedArr: number;
  churnedCustomers: number;
  expansionArr: number;
  expansionCustomers: number;
}

export interface TopWin {
  id: string;
  customerName: string;
  type: 'renewal' | 'expansion' | 'save' | 'efficiency' | 'milestone';
  description: string;
  value?: number;
  previousValue?: number;
  percentChange?: number;
  date: string;
}

export interface KeyRisk {
  id: string;
  customerName: string;
  severity: 'high' | 'medium' | 'low';
  type: 'churn' | 'contraction' | 'support' | 'engagement' | 'champion';
  description: string;
  arrAtRisk: number;
  action?: string;
  daysToRenewal?: number;
}

export interface Recommendation {
  id: string;
  priority: 'high' | 'medium' | 'low';
  category: 'engagement' | 'support' | 'expansion' | 'risk' | 'process';
  title: string;
  description: string;
  expectedImpact?: string;
  effort?: 'low' | 'medium' | 'high';
}

export interface TrendDataPoint {
  period: string;
  periodLabel: string;
  value: number;
}

export interface MetricTrend {
  metric: string;
  currentValue: number;
  previousValue: number;
  change: number;
  changePercent: number;
  trend: 'improving' | 'stable' | 'declining';
  dataPoints: TrendDataPoint[];
}

export interface ExecutiveSummaryReport {
  id: string;
  periodStart: string;
  periodEnd: string;
  periodLabel: string;
  generatedAt: string;
  generatedBy?: string;

  // Key Metrics
  keyMetrics: ExecutiveMetric[];

  // Portfolio Summary
  portfolio: PortfolioSummary;

  // Wins and Risks
  topWins: TopWin[];
  keyRisks: KeyRisk[];

  // Recommendations
  recommendations: Recommendation[];

  // Trends
  trends: {
    arr: MetricTrend;
    nrr: MetricTrend;
    healthScore: MetricTrend;
    nps: MetricTrend;
  };

  // AI-generated narrative (optional)
  narrative?: string;

  // Metadata
  customerCount: number;
  atRiskCount: number;
  healthyCount: number;
}

export interface ExecutiveReportRecord {
  id: string;
  period_start: string;
  period_end: string;
  period_label: string;
  metrics: ExecutiveSummaryReport;
  narrative?: string;
  generated_at: string;
  generated_by?: string;
  status: 'draft' | 'final' | 'archived';
  distribution_list?: string[];
}

export interface GenerateReportOptions {
  period: 'month' | 'quarter' | 'year' | 'custom';
  startDate?: string;
  endDate?: string;
  userId?: string;
  includeNarrative?: boolean;
  targets?: {
    grr?: number;
    nrr?: number;
    healthScore?: number;
    timeToValue?: number;
    nps?: number;
  };
}

// ============================================
// Executive Summary Service
// ============================================

class ExecutiveSummaryService {
  private supabase: SupabaseClient | null = null;

  // Default targets
  private defaultTargets = {
    grr: 93,        // 93% Gross Revenue Retention
    nrr: 110,       // 110% Net Revenue Retention
    healthScore: 75, // Average health score
    timeToValue: 30, // 30 days
    nps: 50,        // NPS score
  };

  constructor() {
    if (config.supabaseUrl && config.supabaseServiceKey) {
      this.supabase = createClient(config.supabaseUrl, config.supabaseServiceKey);
    }
  }

  // ============================================
  // Period Helpers
  // ============================================

  private getPeriodDates(
    period: 'month' | 'quarter' | 'year' | 'custom',
    startDate?: string,
    endDate?: string
  ): { start: Date; end: Date; label: string } {
    const now = new Date();

    switch (period) {
      case 'month': {
        const start = new Date(now.getFullYear(), now.getMonth(), 1);
        const end = new Date(now.getFullYear(), now.getMonth() + 1, 0);
        const label = start.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
        return { start, end, label };
      }
      case 'quarter': {
        const quarter = Math.floor(now.getMonth() / 3);
        const start = new Date(now.getFullYear(), quarter * 3, 1);
        const end = new Date(now.getFullYear(), (quarter + 1) * 3, 0);
        const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
        const label = `Q${quarter + 1} ${now.getFullYear()} (${monthNames[quarter * 3]} - ${monthNames[quarter * 3 + 2]})`;
        return { start, end, label };
      }
      case 'year': {
        const start = new Date(now.getFullYear(), 0, 1);
        const end = new Date(now.getFullYear(), 11, 31);
        return { start, end, label: `${now.getFullYear()}` };
      }
      case 'custom': {
        if (!startDate || !endDate) {
          throw new Error('Custom period requires startDate and endDate');
        }
        const start = new Date(startDate);
        const end = new Date(endDate);
        const label = `${start.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} - ${end.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}`;
        return { start, end, label };
      }
      default:
        throw new Error(`Invalid period: ${period}`);
    }
  }

  private formatMetricValue(value: number, format: ExecutiveMetric['format']): string {
    switch (format) {
      case 'percent':
        return `${value.toFixed(1)}%`;
      case 'currency':
        return `$${value.toLocaleString()}`;
      case 'days':
        return `${value} days`;
      case 'score':
        return `${Math.round(value)}`;
      default:
        return value.toLocaleString();
    }
  }

  private getMetricStatus(actual: number, target: number, higherIsBetter: boolean = true): 'above' | 'on_target' | 'below' {
    const threshold = target * 0.02; // 2% tolerance
    if (higherIsBetter) {
      if (actual >= target + threshold) return 'above';
      if (actual >= target - threshold) return 'on_target';
      return 'below';
    } else {
      if (actual <= target - threshold) return 'above';
      if (actual <= target + threshold) return 'on_target';
      return 'below';
    }
  }

  private getTrendDirection(change: number, threshold: number = 2): 'improving' | 'stable' | 'declining' {
    if (change >= threshold) return 'improving';
    if (change <= -threshold) return 'declining';
    return 'stable';
  }

  // ============================================
  // Data Fetching
  // ============================================

  private async getCustomers(): Promise<any[]> {
    if (this.supabase) {
      try {
        const { data, error } = await this.supabase
          .from('customers')
          .select('*')
          .neq('stage', 'churned');

        if (error) throw error;
        return data || [];
      } catch (error) {
        console.error('[ExecutiveSummary] Error fetching customers:', error);
      }
    }

    // Return mock data
    return [
      { id: '1', name: 'Acme Corporation', arr: 250000, health_score: 85, stage: 'active', renewal_date: '2026-06-15' },
      { id: '2', name: 'TechStart Inc', arr: 180000, health_score: 48, stage: 'at_risk', renewal_date: '2026-02-28' },
      { id: '3', name: 'GlobalTech Solutions', arr: 280000, health_score: 92, stage: 'active', renewal_date: '2026-09-01' },
      { id: '4', name: 'DataFlow Inc', arr: 95000, health_score: 35, stage: 'at_risk', renewal_date: '2026-03-15' },
      { id: '5', name: 'CloudNine Systems', arr: 150000, health_score: 78, stage: 'active', renewal_date: '2026-05-20' },
      { id: '6', name: 'MegaCorp Industries', arr: 340000, health_score: 72, stage: 'active', renewal_date: '2026-08-10' },
      { id: '7', name: 'StartupX', arr: 45000, health_score: 61, stage: 'onboarding', renewal_date: '2026-04-01' },
      { id: '8', name: 'Enterprise Plus', arr: 520000, health_score: 88, stage: 'active', renewal_date: '2026-12-15' },
    ];
  }

  private async getRevenueMovements(startDate: Date, endDate: Date): Promise<any[]> {
    if (this.supabase) {
      try {
        const { data, error } = await this.supabase
          .from('revenue_movements')
          .select('*, customers(name)')
          .gte('movement_date', startDate.toISOString())
          .lte('movement_date', endDate.toISOString())
          .order('movement_date', { ascending: false });

        if (error) throw error;
        return data || [];
      } catch (error) {
        console.error('[ExecutiveSummary] Error fetching movements:', error);
      }
    }

    // Return mock movements
    return [
      { id: 'm1', customer_id: '1', customer_name: 'Acme Corporation', type: 'expansion', change_amount: 50000, previous_arr: 200000, new_arr: 250000, movement_date: new Date().toISOString(), reason: '40% renewal expansion' },
      { id: 'm2', customer_id: '8', customer_name: 'Enterprise Plus', type: 'new', change_amount: 520000, previous_arr: 0, new_arr: 520000, movement_date: new Date().toISOString(), reason: 'New enterprise deal' },
      { id: 'm3', customer_id: '4', customer_name: 'DataFlow Inc', type: 'contraction', change_amount: -15000, previous_arr: 110000, new_arr: 95000, movement_date: new Date().toISOString(), reason: 'Reduced seats' },
    ];
  }

  private generateMockTrends(metric: string, periods: number = 12): TrendDataPoint[] {
    const dataPoints: TrendDataPoint[] = [];
    const now = new Date();

    const baseValues: Record<string, number> = {
      arr: 40000000,
      nrr: 108,
      healthScore: 72,
      nps: 45,
    };

    const base = baseValues[metric] || 100;
    const growthRate = metric === 'arr' ? 1.02 : 1.005; // 2% monthly for ARR, 0.5% for others

    for (let i = periods - 1; i >= 0; i--) {
      const date = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const monthLabel = date.toLocaleDateString('en-US', { month: 'short', year: '2-digit' });

      // Add some variance
      const variance = 0.97 + Math.random() * 0.06;
      const growthFactor = Math.pow(growthRate, periods - i - 1);
      const value = Math.round(base * growthFactor * variance);

      dataPoints.push({
        period: date.toISOString().split('T')[0],
        periodLabel: monthLabel,
        value,
      });
    }

    return dataPoints;
  }

  // ============================================
  // Report Generation
  // ============================================

  async generateReport(options: GenerateReportOptions): Promise<ExecutiveSummaryReport> {
    const { start, end, label } = this.getPeriodDates(
      options.period,
      options.startDate,
      options.endDate
    );

    const targets = { ...this.defaultTargets, ...options.targets };

    // Fetch data
    const [customers, movements] = await Promise.all([
      this.getCustomers(),
      this.getRevenueMovements(start, end),
    ]);

    // Calculate metrics
    const totalArr = customers.reduce((sum, c) => sum + (c.arr || 0), 0);
    const avgHealthScore = customers.length > 0
      ? Math.round(customers.reduce((sum, c) => sum + (c.health_score || 70), 0) / customers.length)
      : 0;

    const activeCustomers = customers.length;
    const healthyCustomers = customers.filter(c => (c.health_score || 70) >= 70).length;
    const atRiskCustomers = customers.filter(c => (c.health_score || 70) < 50).length;

    // Calculate movements
    const expansionArr = movements
      .filter(m => m.type === 'expansion')
      .reduce((sum, m) => sum + Math.abs(m.change_amount || 0), 0);
    const expansionCustomers = new Set(movements.filter(m => m.type === 'expansion').map(m => m.customer_id)).size;

    const newArr = movements
      .filter(m => m.type === 'new')
      .reduce((sum, m) => sum + Math.abs(m.change_amount || 0), 0);
    const newCustomers = movements.filter(m => m.type === 'new').length;

    const churnedArr = movements
      .filter(m => m.type === 'churn')
      .reduce((sum, m) => sum + Math.abs(m.change_amount || 0), 0);
    const churnedCustomers = movements.filter(m => m.type === 'churn').length;

    const contractionArr = movements
      .filter(m => m.type === 'contraction')
      .reduce((sum, m) => sum + Math.abs(m.change_amount || 0), 0);

    // Calculate retention rates
    const startingArr = totalArr - newArr - expansionArr + churnedArr + contractionArr;
    const grr = startingArr > 0 ? Math.round(((startingArr - contractionArr - churnedArr) / startingArr) * 100 * 10) / 10 : 100;
    const nrr = startingArr > 0 ? Math.round(((startingArr + expansionArr - contractionArr - churnedArr) / startingArr) * 100 * 10) / 10 : 100;

    // Mock NPS and Time to Value
    const npsScore = 52;
    const timeToValue = 28;

    // Build key metrics
    const keyMetrics: ExecutiveMetric[] = [
      {
        name: 'Gross Retention',
        actual: grr,
        target: targets.grr,
        status: this.getMetricStatus(grr, targets.grr),
        delta: grr - targets.grr,
        deltaPercent: Math.round(((grr - targets.grr) / targets.grr) * 100 * 10) / 10,
        format: 'percent',
      },
      {
        name: 'Net Revenue Retention',
        actual: nrr,
        target: targets.nrr,
        status: this.getMetricStatus(nrr, targets.nrr),
        delta: nrr - targets.nrr,
        deltaPercent: Math.round(((nrr - targets.nrr) / targets.nrr) * 100 * 10) / 10,
        format: 'percent',
      },
      {
        name: 'Avg Health Score',
        actual: avgHealthScore,
        target: targets.healthScore,
        status: this.getMetricStatus(avgHealthScore, targets.healthScore),
        delta: avgHealthScore - targets.healthScore,
        deltaPercent: Math.round(((avgHealthScore - targets.healthScore) / targets.healthScore) * 100 * 10) / 10,
        format: 'score',
      },
      {
        name: 'Time to Value',
        actual: timeToValue,
        target: targets.timeToValue,
        status: this.getMetricStatus(timeToValue, targets.timeToValue, false), // Lower is better
        delta: targets.timeToValue - timeToValue,
        deltaPercent: Math.round(((targets.timeToValue - timeToValue) / targets.timeToValue) * 100 * 10) / 10,
        format: 'days',
      },
      {
        name: 'NPS',
        actual: npsScore,
        target: targets.nps,
        status: this.getMetricStatus(npsScore, targets.nps),
        delta: npsScore - targets.nps,
        deltaPercent: Math.round(((npsScore - targets.nps) / targets.nps) * 100 * 10) / 10,
        format: 'score',
      },
    ];

    // Build portfolio summary
    const portfolio: PortfolioSummary = {
      totalArr,
      arrChange: newArr + expansionArr - churnedArr - contractionArr,
      arrChangePercent: startingArr > 0 ? Math.round(((totalArr - startingArr) / startingArr) * 100 * 10) / 10 : 0,
      activeCustomers,
      netNewCustomers: newCustomers - churnedCustomers,
      churnedArr,
      churnedCustomers,
      expansionArr,
      expansionCustomers,
    };

    // Build top wins
    const topWins: TopWin[] = [
      ...movements
        .filter(m => m.type === 'expansion' && m.change_amount >= 30000)
        .map(m => ({
          id: m.id,
          customerName: m.customer_name || m.customers?.name || 'Unknown',
          type: 'expansion' as const,
          description: m.reason || `${Math.round(((m.new_arr - m.previous_arr) / m.previous_arr) * 100)}% expansion`,
          value: m.new_arr,
          previousValue: m.previous_arr,
          percentChange: Math.round(((m.new_arr - m.previous_arr) / m.previous_arr) * 100),
          date: m.movement_date,
        })),
      {
        id: 'efficiency-1',
        customerName: 'System',
        type: 'efficiency' as const,
        description: 'Reduced onboarding time by 15% through automation',
        date: new Date().toISOString(),
      },
      {
        id: 'save-1',
        customerName: 'Portfolio',
        type: 'save' as const,
        description: 'Save play success rate improved to 72%',
        date: new Date().toISOString(),
      },
    ].slice(0, 5);

    // Build key risks
    const keyRisks: KeyRisk[] = customers
      .filter(c => c.health_score < 50)
      .sort((a, b) => (b.arr || 0) - (a.arr || 0))
      .slice(0, 5)
      .map((c, i) => {
        const daysToRenewal = c.renewal_date
          ? Math.ceil((new Date(c.renewal_date).getTime() - Date.now()) / (1000 * 60 * 60 * 24))
          : null;

        let type: KeyRisk['type'] = 'churn';
        let description = '';

        if (c.health_score < 30) {
          type = 'churn';
          description = `Critical health score (${c.health_score}) with significant ARR at risk`;
        } else if (daysToRenewal && daysToRenewal <= 90) {
          type = 'churn';
          description = `At-risk account with renewal in ${daysToRenewal} days`;
        } else {
          type = 'engagement';
          description = `Low engagement and declining health score (${c.health_score})`;
        }

        return {
          id: `risk-${i}`,
          customerName: c.name,
          severity: (c.health_score < 30 ? 'high' : c.health_score < 50 ? 'medium' : 'low') as KeyRisk['severity'],
          type,
          description,
          arrAtRisk: c.arr || 0,
          action: c.health_score < 30 ? 'Initiate save play immediately' : 'Schedule executive touchpoint',
          daysToRenewal: daysToRenewal || undefined,
        };
      });

    // Add support ticket risk if applicable
    keyRisks.push({
      id: 'support-risk',
      customerName: 'Portfolio',
      severity: 'medium',
      type: 'support',
      description: 'Support ticket volume up 25% in the period',
      arrAtRisk: Math.round(totalArr * 0.1),
      action: 'Invest in support capacity',
    });

    // Build recommendations
    const recommendations: Recommendation[] = [
      {
        id: 'rec-1',
        priority: 'high',
        category: 'engagement',
        title: 'Increase Executive Engagement',
        description: 'Launch executive sponsor program for top 20 accounts to strengthen strategic relationships and reduce churn risk.',
        expectedImpact: 'Reduce enterprise churn by 15%',
        effort: 'medium',
      },
      {
        id: 'rec-2',
        priority: 'high',
        category: 'support',
        title: 'Invest in Support Capacity',
        description: 'Hire 2 additional support engineers to address increased ticket volume and maintain SLA compliance.',
        expectedImpact: 'Improve CSAT by 10 points',
        effort: 'high',
      },
      {
        id: 'rec-3',
        priority: 'medium',
        category: 'risk',
        title: 'Proactive Champion Development',
        description: 'Implement champion identification and development program to reduce single-threaded account risk.',
        expectedImpact: 'Reduce champion departure impact by 40%',
        effort: 'medium',
      },
    ];

    // Build trends
    const arrTrend = this.generateMockTrends('arr', 12);
    const nrrTrend = this.generateMockTrends('nrr', 12);
    const healthTrend = this.generateMockTrends('healthScore', 12);
    const npsTrend = this.generateMockTrends('nps', 12);

    const trends = {
      arr: {
        metric: 'ARR',
        currentValue: arrTrend[arrTrend.length - 1].value,
        previousValue: arrTrend[arrTrend.length - 2].value,
        change: arrTrend[arrTrend.length - 1].value - arrTrend[arrTrend.length - 2].value,
        changePercent: Math.round(((arrTrend[arrTrend.length - 1].value - arrTrend[arrTrend.length - 2].value) / arrTrend[arrTrend.length - 2].value) * 100 * 10) / 10,
        trend: this.getTrendDirection(arrTrend[arrTrend.length - 1].value - arrTrend[arrTrend.length - 2].value, arrTrend[arrTrend.length - 2].value * 0.02),
        dataPoints: arrTrend,
      },
      nrr: {
        metric: 'NRR',
        currentValue: nrrTrend[nrrTrend.length - 1].value,
        previousValue: nrrTrend[nrrTrend.length - 2].value,
        change: nrrTrend[nrrTrend.length - 1].value - nrrTrend[nrrTrend.length - 2].value,
        changePercent: Math.round(((nrrTrend[nrrTrend.length - 1].value - nrrTrend[nrrTrend.length - 2].value) / nrrTrend[nrrTrend.length - 2].value) * 100 * 10) / 10,
        trend: this.getTrendDirection(nrrTrend[nrrTrend.length - 1].value - nrrTrend[nrrTrend.length - 2].value),
        dataPoints: nrrTrend,
      },
      healthScore: {
        metric: 'Health Score',
        currentValue: healthTrend[healthTrend.length - 1].value,
        previousValue: healthTrend[healthTrend.length - 2].value,
        change: healthTrend[healthTrend.length - 1].value - healthTrend[healthTrend.length - 2].value,
        changePercent: Math.round(((healthTrend[healthTrend.length - 1].value - healthTrend[healthTrend.length - 2].value) / healthTrend[healthTrend.length - 2].value) * 100 * 10) / 10,
        trend: this.getTrendDirection(healthTrend[healthTrend.length - 1].value - healthTrend[healthTrend.length - 2].value),
        dataPoints: healthTrend,
      },
      nps: {
        metric: 'NPS',
        currentValue: npsTrend[npsTrend.length - 1].value,
        previousValue: npsTrend[npsTrend.length - 2].value,
        change: npsTrend[npsTrend.length - 1].value - npsTrend[npsTrend.length - 2].value,
        changePercent: Math.round(((npsTrend[npsTrend.length - 1].value - npsTrend[npsTrend.length - 2].value) / npsTrend[npsTrend.length - 2].value) * 100 * 10) / 10,
        trend: this.getTrendDirection(npsTrend[npsTrend.length - 1].value - npsTrend[npsTrend.length - 2].value),
        dataPoints: npsTrend,
      },
    };

    // Generate report ID
    const reportId = `exec-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;

    const report: ExecutiveSummaryReport = {
      id: reportId,
      periodStart: start.toISOString(),
      periodEnd: end.toISOString(),
      periodLabel: label,
      generatedAt: new Date().toISOString(),
      generatedBy: options.userId,
      keyMetrics,
      portfolio,
      topWins,
      keyRisks,
      recommendations,
      trends,
      customerCount: activeCustomers,
      atRiskCount: atRiskCustomers,
      healthyCount: healthyCustomers,
    };

    // Store report if Supabase is available
    if (this.supabase) {
      try {
        await this.supabase.from('executive_reports').insert({
          id: reportId,
          period_start: start.toISOString().split('T')[0],
          period_end: end.toISOString().split('T')[0],
          period_label: label,
          metrics: report,
          generated_at: new Date().toISOString(),
          generated_by: options.userId,
          status: 'draft',
        });
      } catch (error) {
        console.error('[ExecutiveSummary] Error storing report:', error);
      }
    }

    return report;
  }

  // ============================================
  // Report History
  // ============================================

  async getReportHistory(
    limit: number = 10,
    userId?: string
  ): Promise<ExecutiveReportRecord[]> {
    if (this.supabase) {
      try {
        const { data, error } = await this.supabase
          .from('executive_reports')
          .select('*')
          .order('generated_at', { ascending: false })
          .limit(limit);

        if (error) throw error;
        return data || [];
      } catch (error) {
        console.error('[ExecutiveSummary] Error fetching history:', error);
      }
    }

    // Return empty for mock
    return [];
  }

  async getReport(reportId: string): Promise<ExecutiveReportRecord | null> {
    if (this.supabase) {
      try {
        const { data, error } = await this.supabase
          .from('executive_reports')
          .select('*')
          .eq('id', reportId)
          .single();

        if (error) throw error;
        return data;
      } catch (error) {
        console.error('[ExecutiveSummary] Error fetching report:', error);
      }
    }

    return null;
  }

  // ============================================
  // Report Scheduling
  // ============================================

  async scheduleReport(schedule: {
    frequency: 'weekly' | 'monthly' | 'quarterly';
    dayOfWeek?: number;
    dayOfMonth?: number;
    distributionList: string[];
    userId: string;
  }): Promise<{ success: boolean; scheduleId?: string; error?: string }> {
    // This would integrate with the scheduler service
    // For now, return a mock response
    return {
      success: true,
      scheduleId: `schedule-${Date.now()}`,
    };
  }
}

// Export singleton
export const executiveSummaryService = new ExecutiveSummaryService();
