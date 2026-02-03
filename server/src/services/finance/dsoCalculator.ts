/**
 * CSCX.AI DSO Calculator Service
 * PRD-015: Invoice History Upload -> Payment Pattern Analysis
 *
 * Calculates Days Sales Outstanding (DSO) and related financial metrics
 * for individual customers and portfolio-wide analysis.
 */

import { InvoiceRecord } from './invoiceParser.js';

// ============================================
// Types
// ============================================

export interface DSOMetrics {
  dso: number; // Days Sales Outstanding
  dsoTrend: 'improving' | 'stable' | 'worsening';
  dsoBenchmark: number;
  dsoVariance: number; // vs benchmark

  // Best possible DSO (if everyone paid on time)
  bestPossibleDso: number;
  dsoEfficiencyGap: number;

  // Aging buckets
  agingBuckets: AgingBucket[];

  // Trend over time
  dsoHistory: DSOHistoryPoint[];
}

export interface AgingBucket {
  bucket: 'current' | '1-30' | '31-60' | '61-90' | '90+';
  amount: number;
  percentage: number;
  invoiceCount: number;
}

export interface DSOHistoryPoint {
  period: string;
  periodLabel: string;
  dso: number;
  outstandingAmount: number;
  revenueBase: number;
}

export interface PortfolioDSOAnalysis {
  portfolioDso: number;
  industryBenchmark: number;
  variance: number;
  status: 'excellent' | 'good' | 'average' | 'poor';

  // Breakdown
  segmentDso: SegmentDSO[];
  customerDsoDistribution: DSODistribution;

  // Trend
  dsoTrend: DSOHistoryPoint[];
  trendDirection: 'improving' | 'stable' | 'worsening';

  // Collection efficiency
  collectionEfficiency: number;
  averageDaysBeyondTerms: number;

  // Recommendations
  recommendations: string[];
}

export interface SegmentDSO {
  segment: string;
  dso: number;
  customerCount: number;
  outstanding: number;
  benchmark: number;
  variance: number;
}

export interface DSODistribution {
  excellent: { count: number; percentage: number }; // DSO <= 30
  good: { count: number; percentage: number }; // DSO 31-45
  average: { count: number; percentage: number }; // DSO 46-60
  poor: { count: number; percentage: number }; // DSO > 60
}

// Industry benchmarks for DSO
const INDUSTRY_BENCHMARKS: Record<string, number> = {
  'Enterprise': 35,
  'Mid-Market': 40,
  'SMB': 45,
  'Startup': 50,
  'Default': 40
};

const DSO_THRESHOLDS = {
  excellent: 30,
  good: 45,
  average: 60
};

class DSOCalculatorService {
  // ============================================
  // Main DSO Calculation Methods
  // ============================================

  /**
   * Calculate DSO for a customer
   */
  calculateCustomerDSO(
    invoices: InvoiceRecord[],
    periodDays: number = 365
  ): DSOMetrics {
    // Filter to relevant invoices
    const validInvoices = invoices.filter(i => i.status !== 'voided');

    // Calculate total revenue and outstanding
    const totalRevenue = validInvoices.reduce((sum, i) => sum + i.amount, 0);
    const outstanding = validInvoices
      .filter(i => i.status !== 'paid')
      .reduce((sum, i) => sum + (i.amount - i.amountPaid), 0);

    // Calculate DSO
    const dso = this.calculateBaseDSO(outstanding, totalRevenue, periodDays);

    // Calculate best possible DSO (average payment terms)
    const avgTerms = this.calculateAveragePaymentTerms(validInvoices);
    const bestPossibleDso = avgTerms;

    // Calculate aging buckets
    const agingBuckets = this.calculateAgingBuckets(validInvoices);

    // Calculate DSO history (by quarter)
    const dsoHistory = this.calculateDSOHistory(validInvoices);

    // Determine DSO trend
    const dsoTrend = this.determineDSOTrend(dsoHistory);

    // Get benchmark
    const dsoBenchmark = INDUSTRY_BENCHMARKS['Default'];
    const dsoVariance = dso - dsoBenchmark;

    return {
      dso,
      dsoTrend,
      dsoBenchmark,
      dsoVariance,
      bestPossibleDso,
      dsoEfficiencyGap: dso - bestPossibleDso,
      agingBuckets,
      dsoHistory
    };
  }

  /**
   * Calculate portfolio-wide DSO analysis
   */
  calculatePortfolioDSO(
    invoices: InvoiceRecord[],
    customerSegments: Map<string, string> = new Map()
  ): PortfolioDSOAnalysis {
    const validInvoices = invoices.filter(i => i.status !== 'voided');

    // Calculate total revenue and outstanding
    const totalRevenue = validInvoices.reduce((sum, i) => sum + i.amount, 0);
    const totalOutstanding = validInvoices
      .filter(i => i.status !== 'paid')
      .reduce((sum, i) => sum + (i.amount - i.amountPaid), 0);

    // Calculate portfolio DSO
    const portfolioDso = this.calculateBaseDSO(totalOutstanding, totalRevenue, 365);

    // Get industry benchmark
    const industryBenchmark = INDUSTRY_BENCHMARKS['Default'];
    const variance = portfolioDso - industryBenchmark;

    // Determine status
    let status: 'excellent' | 'good' | 'average' | 'poor';
    if (portfolioDso <= DSO_THRESHOLDS.excellent) status = 'excellent';
    else if (portfolioDso <= DSO_THRESHOLDS.good) status = 'good';
    else if (portfolioDso <= DSO_THRESHOLDS.average) status = 'average';
    else status = 'poor';

    // Calculate segment DSO
    const segmentDso = this.calculateSegmentDSO(validInvoices, customerSegments);

    // Calculate customer DSO distribution
    const customerDsoDistribution = this.calculateDSODistribution(validInvoices);

    // Calculate DSO trend
    const dsoTrend = this.calculateDSOHistory(validInvoices);
    const trendDirection = this.determineDSOTrend(dsoTrend);

    // Calculate collection efficiency
    const paidInvoices = validInvoices.filter(i => i.status === 'paid' && i.daysToPay !== undefined);
    const avgDaysToPay = paidInvoices.length > 0
      ? paidInvoices.reduce((sum, i) => sum + (i.daysToPay || 0), 0) / paidInvoices.length
      : 0;
    const avgTerms = this.calculateAveragePaymentTerms(validInvoices);
    const averageDaysBeyondTerms = Math.max(0, avgDaysToPay - avgTerms);

    // Collection efficiency (100% = perfect, lower = less efficient)
    const collectionEfficiency = avgTerms > 0 ? Math.min(100, Math.round((avgTerms / avgDaysToPay) * 100)) : 100;

    // Generate recommendations
    const recommendations = this.generateDSORecommendations(
      portfolioDso,
      variance,
      trendDirection,
      segmentDso,
      collectionEfficiency
    );

    return {
      portfolioDso,
      industryBenchmark,
      variance,
      status,
      segmentDso,
      customerDsoDistribution,
      dsoTrend,
      trendDirection,
      collectionEfficiency,
      averageDaysBeyondTerms: Math.round(averageDaysBeyondTerms),
      recommendations
    };
  }

  // ============================================
  // Helper Calculation Methods
  // ============================================

  /**
   * Calculate base DSO formula
   */
  private calculateBaseDSO(
    outstandingReceivables: number,
    totalRevenue: number,
    periodDays: number
  ): number {
    if (totalRevenue === 0) return 0;
    return Math.round((outstandingReceivables / totalRevenue) * periodDays);
  }

  /**
   * Calculate average payment terms from invoices
   */
  private calculateAveragePaymentTerms(invoices: InvoiceRecord[]): number {
    const termsArray: number[] = [];

    for (const invoice of invoices) {
      const invoiceDate = new Date(invoice.invoiceDate);
      const dueDate = new Date(invoice.dueDate);
      const terms = Math.round((dueDate.getTime() - invoiceDate.getTime()) / (1000 * 60 * 60 * 24));
      if (terms > 0) {
        termsArray.push(terms);
      }
    }

    if (termsArray.length === 0) return 30; // Default to net 30

    return Math.round(termsArray.reduce((a, b) => a + b, 0) / termsArray.length);
  }

  /**
   * Calculate aging buckets for outstanding invoices
   */
  private calculateAgingBuckets(invoices: InvoiceRecord[]): AgingBucket[] {
    const buckets = {
      current: { amount: 0, count: 0 },
      '1-30': { amount: 0, count: 0 },
      '31-60': { amount: 0, count: 0 },
      '61-90': { amount: 0, count: 0 },
      '90+': { amount: 0, count: 0 }
    };

    const today = new Date();
    let totalOutstanding = 0;

    for (const invoice of invoices) {
      if (invoice.status === 'paid' || invoice.status === 'voided') continue;

      const outstanding = invoice.amount - invoice.amountPaid;
      if (outstanding <= 0) continue;

      totalOutstanding += outstanding;

      const dueDate = new Date(invoice.dueDate);
      const daysOverdue = Math.floor((today.getTime() - dueDate.getTime()) / (1000 * 60 * 60 * 24));

      if (daysOverdue <= 0) {
        buckets.current.amount += outstanding;
        buckets.current.count++;
      } else if (daysOverdue <= 30) {
        buckets['1-30'].amount += outstanding;
        buckets['1-30'].count++;
      } else if (daysOverdue <= 60) {
        buckets['31-60'].amount += outstanding;
        buckets['31-60'].count++;
      } else if (daysOverdue <= 90) {
        buckets['61-90'].amount += outstanding;
        buckets['61-90'].count++;
      } else {
        buckets['90+'].amount += outstanding;
        buckets['90+'].count++;
      }
    }

    return (['current', '1-30', '31-60', '61-90', '90+'] as const).map(bucket => ({
      bucket,
      amount: buckets[bucket].amount,
      percentage: totalOutstanding > 0
        ? Math.round((buckets[bucket].amount / totalOutstanding) * 100)
        : 0,
      invoiceCount: buckets[bucket].count
    }));
  }

  /**
   * Calculate DSO history over time
   */
  private calculateDSOHistory(invoices: InvoiceRecord[]): DSOHistoryPoint[] {
    const periodMap = new Map<string, {
      revenue: number;
      outstanding: number;
      endDate: Date;
    }>();

    // Group invoices by quarter
    for (const invoice of invoices) {
      const date = new Date(invoice.invoiceDate);
      const quarter = `${date.getFullYear()}-Q${Math.ceil((date.getMonth() + 1) / 3)}`;

      if (!periodMap.has(quarter)) {
        periodMap.set(quarter, {
          revenue: 0,
          outstanding: 0,
          endDate: new Date(date.getFullYear(), Math.ceil((date.getMonth() + 1) / 3) * 3, 0)
        });
      }

      const periodData = periodMap.get(quarter)!;
      periodData.revenue += invoice.amount;

      // Calculate outstanding at end of quarter
      if (invoice.status !== 'paid' && invoice.status !== 'voided') {
        periodData.outstanding += invoice.amount - invoice.amountPaid;
      } else if (invoice.paidDate) {
        const paidDate = new Date(invoice.paidDate);
        if (paidDate > periodData.endDate) {
          periodData.outstanding += invoice.amount - invoice.amountPaid;
        }
      }
    }

    // Convert to array and calculate DSO for each period
    return Array.from(periodMap.entries())
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([period, data]) => ({
        period,
        periodLabel: period.replace('-Q', ' Q'),
        dso: this.calculateBaseDSO(data.outstanding, data.revenue, 90), // Quarterly DSO
        outstandingAmount: data.outstanding,
        revenueBase: data.revenue
      }));
  }

  /**
   * Determine DSO trend from history
   */
  private determineDSOTrend(history: DSOHistoryPoint[]): 'improving' | 'stable' | 'worsening' {
    if (history.length < 2) return 'stable';

    const recent = history.slice(-3);
    if (recent.length < 2) return 'stable';

    const firstDso = recent[0].dso;
    const lastDso = recent[recent.length - 1].dso;
    const change = lastDso - firstDso;

    if (change < -5) return 'improving';
    if (change > 5) return 'worsening';
    return 'stable';
  }

  /**
   * Calculate DSO by segment
   */
  private calculateSegmentDSO(
    invoices: InvoiceRecord[],
    customerSegments: Map<string, string>
  ): SegmentDSO[] {
    const segmentData = new Map<string, {
      revenue: number;
      outstanding: number;
      customers: Set<string>;
    }>();

    for (const invoice of invoices) {
      const segment = customerSegments.get(invoice.customerId) || 'Unknown';

      if (!segmentData.has(segment)) {
        segmentData.set(segment, {
          revenue: 0,
          outstanding: 0,
          customers: new Set()
        });
      }

      const data = segmentData.get(segment)!;
      data.revenue += invoice.amount;
      data.customers.add(invoice.customerId);

      if (invoice.status !== 'paid' && invoice.status !== 'voided') {
        data.outstanding += invoice.amount - invoice.amountPaid;
      }
    }

    return Array.from(segmentData.entries()).map(([segment, data]) => {
      const dso = this.calculateBaseDSO(data.outstanding, data.revenue, 365);
      const benchmark = INDUSTRY_BENCHMARKS[segment] || INDUSTRY_BENCHMARKS['Default'];

      return {
        segment,
        dso,
        customerCount: data.customers.size,
        outstanding: data.outstanding,
        benchmark,
        variance: dso - benchmark
      };
    }).sort((a, b) => b.variance - a.variance);
  }

  /**
   * Calculate DSO distribution across customers
   */
  private calculateDSODistribution(invoices: InvoiceRecord[]): DSODistribution {
    // Group invoices by customer and calculate DSO for each
    const customerInvoices = new Map<string, InvoiceRecord[]>();

    for (const invoice of invoices) {
      if (!customerInvoices.has(invoice.customerId)) {
        customerInvoices.set(invoice.customerId, []);
      }
      customerInvoices.get(invoice.customerId)!.push(invoice);
    }

    const distribution = {
      excellent: 0,
      good: 0,
      average: 0,
      poor: 0
    };

    for (const [, custInvoices] of customerInvoices) {
      const totalRevenue = custInvoices.reduce((sum, i) => sum + i.amount, 0);
      const outstanding = custInvoices
        .filter(i => i.status !== 'paid' && i.status !== 'voided')
        .reduce((sum, i) => sum + (i.amount - i.amountPaid), 0);

      const dso = this.calculateBaseDSO(outstanding, totalRevenue, 365);

      if (dso <= DSO_THRESHOLDS.excellent) distribution.excellent++;
      else if (dso <= DSO_THRESHOLDS.good) distribution.good++;
      else if (dso <= DSO_THRESHOLDS.average) distribution.average++;
      else distribution.poor++;
    }

    const total = customerInvoices.size;

    return {
      excellent: {
        count: distribution.excellent,
        percentage: total > 0 ? Math.round((distribution.excellent / total) * 100) : 0
      },
      good: {
        count: distribution.good,
        percentage: total > 0 ? Math.round((distribution.good / total) * 100) : 0
      },
      average: {
        count: distribution.average,
        percentage: total > 0 ? Math.round((distribution.average / total) * 100) : 0
      },
      poor: {
        count: distribution.poor,
        percentage: total > 0 ? Math.round((distribution.poor / total) * 100) : 0
      }
    };
  }

  /**
   * Generate DSO improvement recommendations
   */
  private generateDSORecommendations(
    portfolioDso: number,
    variance: number,
    trend: 'improving' | 'stable' | 'worsening',
    segmentDso: SegmentDSO[],
    collectionEfficiency: number
  ): string[] {
    const recommendations: string[] = [];

    // Overall DSO recommendations
    if (variance > 15) {
      recommendations.push(
        `DSO is ${variance} days above industry benchmark. Consider implementing stricter credit policies.`
      );
    }

    if (trend === 'worsening') {
      recommendations.push(
        'DSO trend is worsening. Review collection processes and customer payment terms.'
      );
    }

    // Segment-specific recommendations
    const worstSegment = segmentDso[0];
    if (worstSegment && worstSegment.variance > 10) {
      recommendations.push(
        `${worstSegment.segment} segment has highest DSO variance (+${worstSegment.variance} days). ` +
        `Focus collection efforts on this segment.`
      );
    }

    // Collection efficiency recommendations
    if (collectionEfficiency < 80) {
      recommendations.push(
        `Collection efficiency is ${collectionEfficiency}%. ` +
        'Implement automated payment reminders and follow-up processes.'
      );
    }

    // Best practice recommendations
    if (portfolioDso > 45) {
      recommendations.push('Consider offering early payment discounts (e.g., 2% net 10)');
      recommendations.push('Review and shorten payment terms for new customers');
    }

    if (recommendations.length === 0) {
      recommendations.push('DSO is within acceptable range. Continue current collection practices.');
    }

    return recommendations;
  }

  // ============================================
  // Utility Methods
  // ============================================

  /**
   * Calculate true DSO (weighted by invoice size)
   */
  calculateWeightedDSO(invoices: InvoiceRecord[]): number {
    let weightedSum = 0;
    let totalWeight = 0;

    for (const invoice of invoices) {
      if (invoice.status === 'paid' && invoice.daysToPay !== undefined) {
        weightedSum += invoice.daysToPay * invoice.amount;
        totalWeight += invoice.amount;
      }
    }

    return totalWeight > 0 ? Math.round(weightedSum / totalWeight) : 0;
  }

  /**
   * Calculate Collection Effectiveness Index (CEI)
   * CEI = (Beginning A/R + Credit Sales - Ending A/R) / (Beginning A/R + Credit Sales - Ending Current A/R)
   */
  calculateCEI(
    beginningAR: number,
    creditSales: number,
    endingAR: number,
    endingCurrentAR: number
  ): number {
    const numerator = beginningAR + creditSales - endingAR;
    const denominator = beginningAR + creditSales - endingCurrentAR;

    if (denominator === 0) return 100;
    return Math.round((numerator / denominator) * 100);
  }

  /**
   * Get DSO benchmark for segment
   */
  getBenchmark(segment?: string): number {
    return INDUSTRY_BENCHMARKS[segment || 'Default'] || INDUSTRY_BENCHMARKS['Default'];
  }
}

// Export singleton instance
export const dsoCalculator = new DSOCalculatorService();
export default dsoCalculator;
