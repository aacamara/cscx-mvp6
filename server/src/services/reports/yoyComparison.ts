/**
 * CSCX.AI Year-over-Year Comparison Service
 * PRD-177: Year-over-Year Comparison Report
 *
 * Provides YoY calculation engine for comparing key metrics across years.
 * Supports multiple metrics: retention, NRR, health score, ARR, customer count.
 */

import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { config } from '../../config/index.js';

// ============================================
// Types
// ============================================

export type MetricType = 'retention' | 'nrr' | 'grr' | 'health_score' | 'arr' | 'customer_count' | 'expansion' | 'churn';

export interface YoYPeriodData {
  period: string;          // Q1, Q2, Q3, Q4, or month name
  thisYear: number;
  lastYear: number;
  change: number;
  changePercent: number;
  trend: 'up' | 'down' | 'stable';
}

export interface YoYAnnualSummary {
  thisYearValue: number;
  lastYearValue: number;
  change: number;
  changePercent: number;
  trend: 'up' | 'down' | 'stable';
  thisYearLabel: string;
  lastYearLabel: string;
}

export interface YoYKeyDriver {
  driver: string;
  impact: string;
  contribution: number;  // percentage contribution to change
}

export interface YoYMetricComparison {
  metric: MetricType;
  metricLabel: string;
  unit: string;           // '%', '$', '#'
  periods: YoYPeriodData[];
  annualSummary: YoYAnnualSummary;
  keyDrivers: YoYKeyDriver[];
  insights: string[];
  generatedAt: string;
}

export interface YoYSegmentComparison {
  segment: string;
  segmentLabel: string;
  thisYearValue: number;
  lastYearValue: number;
  change: number;
  changePercent: number;
  trend: 'up' | 'down' | 'stable';
  customerCount: number;
}

export interface YoYCohortComparison {
  cohort: string;
  cohortLabel: string;
  thisYearValue: number;
  lastYearValue: number;
  change: number;
  changePercent: number;
  trend: 'up' | 'down' | 'stable';
}

export interface YoYComparisonReport {
  metric: MetricType;
  comparison: YoYMetricComparison;
  bySegment: YoYSegmentComparison[];
  byCohort: YoYCohortComparison[];
  seasonalPatterns: {
    bestQuarter: string;
    worstQuarter: string;
    seasonalVariance: number;
  };
}

// ============================================
// Service Class
// ============================================

class YoYComparisonService {
  private supabase: SupabaseClient | null = null;

  // Mock historical data for demo/development
  private mockRetentionData = {
    thisYear: { Q1: 94, Q2: 92, Q3: 95, Q4: 93 },
    lastYear: { Q1: 89, Q2: 87, Q3: 91, Q4: 88 }
  };

  private mockNRRData = {
    thisYear: { Q1: 112, Q2: 108, Q3: 115, Q4: 110 },
    lastYear: { Q1: 105, Q2: 102, Q3: 106, Q4: 104 }
  };

  private mockGRRData = {
    thisYear: { Q1: 95, Q2: 93, Q3: 96, Q4: 94 },
    lastYear: { Q1: 91, Q2: 89, Q3: 92, Q4: 90 }
  };

  private mockHealthScoreData = {
    thisYear: { Q1: 78, Q2: 76, Q3: 81, Q4: 79 },
    lastYear: { Q1: 72, Q2: 70, Q3: 74, Q4: 73 }
  };

  private mockARRData = {
    thisYear: { Q1: 1250000, Q2: 1320000, Q3: 1410000, Q4: 1520000 },
    lastYear: { Q1: 980000, Q2: 1020000, Q3: 1080000, Q4: 1150000 }
  };

  private mockCustomerCountData = {
    thisYear: { Q1: 48, Q2: 52, Q3: 58, Q4: 65 },
    lastYear: { Q1: 35, Q2: 38, Q3: 42, Q4: 45 }
  };

  constructor() {
    if (config.supabaseUrl && config.supabaseServiceKey) {
      this.supabase = createClient(config.supabaseUrl, config.supabaseServiceKey);
    }
  }

  // ============================================
  // Helper Methods
  // ============================================

  private getMetricLabel(metric: MetricType): string {
    const labels: Record<MetricType, string> = {
      retention: 'Retention Rate',
      nrr: 'Net Revenue Retention',
      grr: 'Gross Revenue Retention',
      health_score: 'Average Health Score',
      arr: 'Annual Recurring Revenue',
      customer_count: 'Customer Count',
      expansion: 'Expansion Revenue',
      churn: 'Churn Rate'
    };
    return labels[metric] || metric;
  }

  private getMetricUnit(metric: MetricType): string {
    const units: Record<MetricType, string> = {
      retention: '%',
      nrr: '%',
      grr: '%',
      health_score: 'pts',
      arr: '$',
      customer_count: '#',
      expansion: '$',
      churn: '%'
    };
    return units[metric] || '';
  }

  private calculateTrend(change: number): 'up' | 'down' | 'stable' {
    if (change > 0.5) return 'up';
    if (change < -0.5) return 'down';
    return 'stable';
  }

  private getMockDataForMetric(metric: MetricType): { thisYear: Record<string, number>; lastYear: Record<string, number> } {
    switch (metric) {
      case 'retention':
        return this.mockRetentionData;
      case 'nrr':
        return this.mockNRRData;
      case 'grr':
        return this.mockGRRData;
      case 'health_score':
        return this.mockHealthScoreData;
      case 'arr':
        return this.mockARRData;
      case 'customer_count':
        return this.mockCustomerCountData;
      case 'expansion':
        return {
          thisYear: { Q1: 85000, Q2: 92000, Q3: 105000, Q4: 118000 },
          lastYear: { Q1: 62000, Q2: 68000, Q3: 75000, Q4: 82000 }
        };
      case 'churn':
        return {
          thisYear: { Q1: 2.1, Q2: 2.4, Q3: 1.8, Q4: 2.0 },
          lastYear: { Q1: 3.5, Q2: 3.8, Q3: 3.2, Q4: 3.4 }
        };
      default:
        return this.mockRetentionData;
    }
  }

  private generateKeyDrivers(metric: MetricType, changePercent: number): YoYKeyDriver[] {
    // Generate contextual key drivers based on metric type and direction of change
    const isPositive = changePercent > 0;

    const driversByMetric: Record<MetricType, YoYKeyDriver[]> = {
      retention: isPositive ? [
        { driver: 'Improved onboarding process', impact: '+2%', contribution: 40 },
        { driver: 'Proactive risk intervention', impact: '+1.5%', contribution: 30 },
        { driver: 'Enhanced support response time', impact: '+1.2%', contribution: 25 },
        { driver: 'CSM engagement initiatives', impact: '+0.3%', contribution: 5 }
      ] : [
        { driver: 'Increased market competition', impact: '-1.5%', contribution: 45 },
        { driver: 'Product gaps vs competitors', impact: '-1%', contribution: 30 },
        { driver: 'Support response delays', impact: '-0.5%', contribution: 25 }
      ],
      nrr: isPositive ? [
        { driver: 'Upsell campaign effectiveness', impact: '+4%', contribution: 35 },
        { driver: 'New premium features adoption', impact: '+3%', contribution: 25 },
        { driver: 'Reduced contraction rate', impact: '+2%', contribution: 20 },
        { driver: 'Improved customer success coverage', impact: '+2%', contribution: 20 }
      ] : [
        { driver: 'Economic headwinds', impact: '-3%', contribution: 40 },
        { driver: 'Increased downgrades', impact: '-2%', contribution: 35 },
        { driver: 'Slower expansion cycles', impact: '-1.5%', contribution: 25 }
      ],
      grr: isPositive ? [
        { driver: 'Reduced churn rate', impact: '+2.5%', contribution: 50 },
        { driver: 'Lower contraction volume', impact: '+1.5%', contribution: 30 },
        { driver: 'Better at-risk identification', impact: '+1%', contribution: 20 }
      ] : [
        { driver: 'Increased churn', impact: '-2%', contribution: 50 },
        { driver: 'Higher downgrades', impact: '-1.5%', contribution: 35 },
        { driver: 'Competitive losses', impact: '-1%', contribution: 15 }
      ],
      health_score: isPositive ? [
        { driver: 'Increased product adoption', impact: '+3 pts', contribution: 40 },
        { driver: 'Higher engagement scores', impact: '+2 pts', contribution: 30 },
        { driver: 'Faster support resolution', impact: '+1.5 pts', contribution: 20 },
        { driver: 'Improved NPS scores', impact: '+0.5 pts', contribution: 10 }
      ] : [
        { driver: 'Declining usage patterns', impact: '-2 pts', contribution: 40 },
        { driver: 'Lower stakeholder engagement', impact: '-1.5 pts', contribution: 35 },
        { driver: 'Support ticket increases', impact: '-1 pt', contribution: 25 }
      ],
      arr: isPositive ? [
        { driver: 'New logo acquisition', impact: '+$180K', contribution: 45 },
        { driver: 'Expansion revenue', impact: '+$120K', contribution: 30 },
        { driver: 'Reduced churn', impact: '+$60K', contribution: 15 },
        { driver: 'Price increases', impact: '+$40K', contribution: 10 }
      ] : [
        { driver: 'Customer churn', impact: '-$150K', contribution: 50 },
        { driver: 'Contraction', impact: '-$80K', contribution: 30 },
        { driver: 'Slower new sales', impact: '-$50K', contribution: 20 }
      ],
      customer_count: isPositive ? [
        { driver: 'Effective marketing campaigns', impact: '+12', contribution: 45 },
        { driver: 'Improved conversion rates', impact: '+8', contribution: 30 },
        { driver: 'Reduced churn', impact: '+5', contribution: 25 }
      ] : [
        { driver: 'Higher churn rate', impact: '-8', contribution: 50 },
        { driver: 'Slower acquisition', impact: '-5', contribution: 35 },
        { driver: 'Market conditions', impact: '-3', contribution: 15 }
      ],
      expansion: isPositive ? [
        { driver: 'Premium tier upgrades', impact: '+$45K', contribution: 40 },
        { driver: 'Seat expansions', impact: '+$35K', contribution: 30 },
        { driver: 'Add-on purchases', impact: '+$25K', contribution: 20 },
        { driver: 'Cross-sell initiatives', impact: '+$15K', contribution: 10 }
      ] : [
        { driver: 'Budget constraints', impact: '-$30K', contribution: 50 },
        { driver: 'Slower decision cycles', impact: '-$20K', contribution: 35 },
        { driver: 'Reduced seat count', impact: '-$10K', contribution: 15 }
      ],
      churn: isPositive ? [
        { driver: 'Competitive losses', impact: '+0.5%', contribution: 40 },
        { driver: 'Budget cuts', impact: '+0.3%', contribution: 35 },
        { driver: 'Product fit issues', impact: '+0.2%', contribution: 25 }
      ] : [
        { driver: 'Improved product-market fit', impact: '-0.8%', contribution: 50 },
        { driver: 'Better customer success', impact: '-0.5%', contribution: 35 },
        { driver: 'Enhanced support', impact: '-0.3%', contribution: 15 }
      ]
    };

    return driversByMetric[metric] || driversByMetric.retention;
  }

  private generateInsights(metric: MetricType, data: YoYMetricComparison): string[] {
    const insights: string[] = [];
    const { annualSummary, periods } = data;

    // Overall trend insight
    if (annualSummary.trend === 'up') {
      insights.push(`${data.metricLabel} improved by ${Math.abs(annualSummary.changePercent).toFixed(1)}% year-over-year`);
    } else if (annualSummary.trend === 'down') {
      insights.push(`${data.metricLabel} declined by ${Math.abs(annualSummary.changePercent).toFixed(1)}% year-over-year`);
    } else {
      insights.push(`${data.metricLabel} remained stable year-over-year`);
    }

    // Best performing quarter
    const bestQ = periods.reduce((best, p) => p.change > best.change ? p : best, periods[0]);
    insights.push(`${bestQ.period} showed the strongest improvement with ${bestQ.change > 0 ? '+' : ''}${bestQ.change.toFixed(1)}${data.unit}`);

    // Consistency insight
    const allPositive = periods.every(p => p.change >= 0);
    const allNegative = periods.every(p => p.change <= 0);
    if (allPositive && annualSummary.trend === 'up') {
      insights.push('Consistent improvement across all quarters indicates sustainable progress');
    } else if (allNegative && annualSummary.trend === 'down') {
      insights.push('Consistent decline across quarters suggests systemic issues requiring attention');
    }

    // Metric-specific insights
    if (metric === 'retention' && annualSummary.thisYearValue >= 90) {
      insights.push('Retention rate exceeds industry benchmark of 90%');
    } else if (metric === 'nrr' && annualSummary.thisYearValue >= 110) {
      insights.push('Net Revenue Retention above 110% indicates strong expansion motion');
    } else if (metric === 'health_score' && annualSummary.changePercent > 5) {
      insights.push('Health score improvement correlates with lower churn risk');
    }

    return insights;
  }

  // ============================================
  // Data Fetching
  // ============================================

  private async fetchHistoricalMetricData(
    metric: MetricType,
    years: number[]
  ): Promise<Record<number, Record<string, number>>> {
    // Try to fetch from Supabase if available
    if (this.supabase) {
      try {
        // This would query historical tables based on metric type
        // For now, we'll use mock data as the historical tables structure may vary
        console.log(`[YoY] Fetching ${metric} data for years:`, years);
      } catch (error) {
        console.error(`[YoY] Error fetching ${metric} data:`, error);
      }
    }

    // Return mock data
    const mockData = this.getMockDataForMetric(metric);
    const result: Record<number, Record<string, number>> = {};

    const currentYear = new Date().getFullYear();
    result[currentYear] = mockData.thisYear;
    result[currentYear - 1] = mockData.lastYear;

    return result;
  }

  // ============================================
  // Main Methods
  // ============================================

  async getYoYComparison(metric: MetricType): Promise<YoYComparisonReport> {
    const currentYear = new Date().getFullYear();
    const lastYear = currentYear - 1;

    // Fetch historical data
    const historicalData = await this.fetchHistoricalMetricData(metric, [currentYear, lastYear]);

    const thisYearData = historicalData[currentYear];
    const lastYearData = historicalData[lastYear];

    // Build period comparisons
    const quarters = ['Q1', 'Q2', 'Q3', 'Q4'];
    const periods: YoYPeriodData[] = quarters.map(q => {
      const thisVal = thisYearData[q] || 0;
      const lastVal = lastYearData[q] || 0;
      const change = thisVal - lastVal;
      const changePercent = lastVal !== 0 ? ((thisVal - lastVal) / lastVal) * 100 : 0;

      return {
        period: q,
        thisYear: thisVal,
        lastYear: lastVal,
        change,
        changePercent,
        trend: this.calculateTrend(change)
      };
    });

    // Calculate annual summary
    const thisYearValues = Object.values(thisYearData);
    const lastYearValues = Object.values(lastYearData);

    const thisYearAvg = thisYearValues.reduce((a, b) => a + b, 0) / thisYearValues.length;
    const lastYearAvg = lastYearValues.reduce((a, b) => a + b, 0) / lastYearValues.length;

    // For ARR and customer count, use end-of-year values instead of average
    const useEndValue = ['arr', 'customer_count', 'expansion'].includes(metric);
    const thisYearValue = useEndValue ? thisYearData['Q4'] || thisYearAvg : thisYearAvg;
    const lastYearValue = useEndValue ? lastYearData['Q4'] || lastYearAvg : lastYearAvg;

    const annualChange = thisYearValue - lastYearValue;
    const annualChangePercent = lastYearValue !== 0 ? ((thisYearValue - lastYearValue) / lastYearValue) * 100 : 0;

    const annualSummary: YoYAnnualSummary = {
      thisYearValue: Math.round(thisYearValue * 10) / 10,
      lastYearValue: Math.round(lastYearValue * 10) / 10,
      change: Math.round(annualChange * 10) / 10,
      changePercent: Math.round(annualChangePercent * 10) / 10,
      trend: this.calculateTrend(annualChange),
      thisYearLabel: `FY${currentYear}`,
      lastYearLabel: `FY${lastYear}`
    };

    // Build the comparison object
    const comparison: YoYMetricComparison = {
      metric,
      metricLabel: this.getMetricLabel(metric),
      unit: this.getMetricUnit(metric),
      periods,
      annualSummary,
      keyDrivers: this.generateKeyDrivers(metric, annualChangePercent),
      insights: [],
      generatedAt: new Date().toISOString()
    };

    // Generate insights
    comparison.insights = this.generateInsights(metric, comparison);

    // Mock segment breakdown
    const bySegment: YoYSegmentComparison[] = [
      {
        segment: 'enterprise',
        segmentLabel: 'Enterprise',
        thisYearValue: thisYearValue * 1.1,
        lastYearValue: lastYearValue * 1.05,
        change: (thisYearValue * 1.1) - (lastYearValue * 1.05),
        changePercent: ((thisYearValue * 1.1 - lastYearValue * 1.05) / (lastYearValue * 1.05)) * 100,
        trend: 'up',
        customerCount: 12
      },
      {
        segment: 'mid-market',
        segmentLabel: 'Mid-Market',
        thisYearValue: thisYearValue * 0.95,
        lastYearValue: lastYearValue * 0.92,
        change: (thisYearValue * 0.95) - (lastYearValue * 0.92),
        changePercent: ((thisYearValue * 0.95 - lastYearValue * 0.92) / (lastYearValue * 0.92)) * 100,
        trend: 'up',
        customerCount: 28
      },
      {
        segment: 'smb',
        segmentLabel: 'SMB',
        thisYearValue: thisYearValue * 0.85,
        lastYearValue: lastYearValue * 0.88,
        change: (thisYearValue * 0.85) - (lastYearValue * 0.88),
        changePercent: ((thisYearValue * 0.85 - lastYearValue * 0.88) / (lastYearValue * 0.88)) * 100,
        trend: 'down',
        customerCount: 45
      }
    ];

    // Mock cohort breakdown
    const byCohort: YoYCohortComparison[] = [
      {
        cohort: '2024',
        cohortLabel: 'Cohort 2024',
        thisYearValue: thisYearValue * 1.05,
        lastYearValue: lastYearValue * 1.02,
        change: (thisYearValue * 1.05) - (lastYearValue * 1.02),
        changePercent: ((thisYearValue * 1.05 - lastYearValue * 1.02) / (lastYearValue * 1.02)) * 100,
        trend: 'up'
      },
      {
        cohort: '2023',
        cohortLabel: 'Cohort 2023',
        thisYearValue: thisYearValue * 0.98,
        lastYearValue: lastYearValue * 0.95,
        change: (thisYearValue * 0.98) - (lastYearValue * 0.95),
        changePercent: ((thisYearValue * 0.98 - lastYearValue * 0.95) / (lastYearValue * 0.95)) * 100,
        trend: 'up'
      },
      {
        cohort: '2022',
        cohortLabel: 'Cohort 2022',
        thisYearValue: thisYearValue * 0.92,
        lastYearValue: lastYearValue * 0.94,
        change: (thisYearValue * 0.92) - (lastYearValue * 0.94),
        changePercent: ((thisYearValue * 0.92 - lastYearValue * 0.94) / (lastYearValue * 0.94)) * 100,
        trend: 'down'
      }
    ];

    // Calculate seasonal patterns
    const quarterChanges = periods.map(p => ({ quarter: p.period, change: p.change }));
    const bestQ = quarterChanges.reduce((best, q) => q.change > best.change ? q : best, quarterChanges[0]);
    const worstQ = quarterChanges.reduce((worst, q) => q.change < worst.change ? q : worst, quarterChanges[0]);
    const changes = quarterChanges.map(q => q.change);
    const meanChange = changes.reduce((a, b) => a + b, 0) / changes.length;
    const variance = changes.reduce((sum, c) => sum + Math.pow(c - meanChange, 2), 0) / changes.length;

    return {
      metric,
      comparison,
      bySegment,
      byCohort,
      seasonalPatterns: {
        bestQuarter: bestQ.quarter,
        worstQuarter: worstQ.quarter,
        seasonalVariance: Math.round(Math.sqrt(variance) * 10) / 10
      }
    };
  }

  async getAvailableMetrics(): Promise<Array<{ value: MetricType; label: string }>> {
    return [
      { value: 'retention', label: 'Retention Rate' },
      { value: 'nrr', label: 'Net Revenue Retention' },
      { value: 'grr', label: 'Gross Revenue Retention' },
      { value: 'health_score', label: 'Health Score' },
      { value: 'arr', label: 'Annual Recurring Revenue' },
      { value: 'customer_count', label: 'Customer Count' },
      { value: 'expansion', label: 'Expansion Revenue' },
      { value: 'churn', label: 'Churn Rate' }
    ];
  }

  async getMultiMetricComparison(metrics: MetricType[]): Promise<YoYComparisonReport[]> {
    const reports: YoYComparisonReport[] = [];

    for (const metric of metrics) {
      const report = await this.getYoYComparison(metric);
      reports.push(report);
    }

    return reports;
  }
}

// Export singleton instance
export const yoyComparisonService = new YoYComparisonService();
export default yoyComparisonService;
