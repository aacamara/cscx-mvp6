/**
 * CSCX.AI Payment Analyzer Service
 * PRD-015: Invoice History Upload -> Payment Pattern Analysis
 *
 * Analyzes payment patterns from invoice data to identify:
 * - Late payment patterns and trends
 * - DSO calculations
 * - Risk signals and early warnings
 * - Payment behavior changes
 */

import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { config } from '../../config/index.js';
import { InvoiceRecord, ParsedInvoiceData } from './invoiceParser.js';

// ============================================
// Types
// ============================================

export interface CustomerPaymentMetrics {
  customerId: string;
  customerName: string;
  arr: number;
  segment?: string;

  // Payment metrics
  onTimeRate: number;
  averageDaysToPay: number;
  dso: number;
  outstandingBalance: number;
  disputeRate: number;

  // Invoice counts
  totalInvoices: number;
  paidInvoices: number;
  lateInvoices: number;
  disputedInvoices: number;
  outstandingInvoices: number;

  // Trend
  trend: 'improving' | 'stable' | 'worsening';
  trendData: QuarterlyPaymentTrend[];

  // Risk assessment
  riskLevel: 'critical' | 'high' | 'medium' | 'low';
  riskScore: number;
  riskSignals: string[];
}

export interface QuarterlyPaymentTrend {
  quarter: string;
  quarterLabel: string;
  onTimeRate: number;
  averageDaysToPay: number;
  outstanding: number;
  invoiceCount: number;
}

export interface PaymentPortfolioOverview {
  totalInvoices: number;
  totalCustomers: number;
  dateRange: {
    start: string;
    end: string;
    months: number;
  };
  totalInvoiced: number;
  totalCollected: number;
  totalOutstanding: number;

  // Aggregate metrics
  averageOnTimeRate: number;
  averageDaysToPay: number;
  portfolioDso: number;
  outstandingPercentage: number;

  // Segment breakdown
  segmentBreakdown: SegmentPaymentSummary[];

  // Distribution
  paymentDistribution: {
    onTime: number;
    late1to30: number;
    late31to60: number;
    late60Plus: number;
    disputed: number;
  };
}

export interface SegmentPaymentSummary {
  segment: string;
  customerCount: number;
  onTimeRate: number;
  averageDaysToPay: number;
  dso: number;
  outstanding: number;
  arrAtRisk: number;
}

export interface PaymentRiskAccount {
  customerId: string;
  customerName: string;
  arr: number;
  segment?: string;

  riskLevel: 'critical' | 'high' | 'medium';
  onTimeRate: number;
  averageDaysToPay: number;
  outstandingBalance: number;
  outstandingPercentage: number;

  patternDescription: string;
  quarterlyTrend: QuarterlyPaymentTrend[];
  recommendedActions: string[];
}

export interface EarlyWarningSignal {
  customerId: string;
  customerName: string;
  arr: number;

  signalType: 'trend_worsening' | 'first_late' | 'payment_delay_increase';
  description: string;
  evidence: string;

  previousBehavior: string;
  currentBehavior: string;
  severity: 'high' | 'medium' | 'low';

  recommendedAction: string;
}

export interface PaymentImprover {
  customerId: string;
  customerName: string;
  arr: number;

  previousOnTimeRate: number;
  currentOnTimeRate: number;
  improvementPercentage: number;
}

export interface PaymentPatternAnalysis {
  fileId: string;
  analysisDate: string;

  portfolioOverview: PaymentPortfolioOverview;
  customerMetrics: CustomerPaymentMetrics[];
  highRiskAccounts: PaymentRiskAccount[];
  earlyWarnings: EarlyWarningSignal[];
  paymentImprovers: PaymentImprover[];

  insights: string[];
  actionItems: ActionItem[];
}

export interface ActionItem {
  customerId: string;
  customerName: string;
  priority: 'critical' | 'high' | 'medium';
  actionType: 'finance_escalation' | 'payment_plan' | 'reminder' | 'review' | 'monitor';
  description: string;
  recommendedBy: string;
}

export interface PaymentContextBriefing {
  customerId: string;
  customerName: string;
  arr: number;
  renewalDate?: string;
  daysToRenewal?: number;

  paymentSummary: {
    onTimeRate: number;
    averageDaysToPay: number;
    trend: 'improving' | 'stable' | 'worsening';
    outstandingBalance: number;
    outstandingPercentage: number;
  };

  quarterlyHistory: QuarterlyPaymentTrend[];
  redFlags: string[];

  financialRisk: 'high' | 'moderate-high' | 'moderate' | 'low';
  renewalProbability?: number;
  churnRisk?: 'high' | 'moderate' | 'low';

  renewalStrategy: string[];
  talkingPoints: string[];
  recommendedNextSteps: string[];
}

class PaymentAnalyzerService {
  private supabase: SupabaseClient | null = null;

  constructor() {
    if (config.supabaseUrl && config.supabaseServiceKey) {
      this.supabase = createClient(config.supabaseUrl, config.supabaseServiceKey);
    }
  }

  // ============================================
  // Main Analysis Methods
  // ============================================

  /**
   * Analyze payment patterns from parsed invoice data
   */
  async analyzePaymentPatterns(parsedData: ParsedInvoiceData): Promise<PaymentPatternAnalysis> {
    const { invoices, fileId, dateRange, totalInvoiced, totalCollected } = parsedData;

    // Get customer ARR data from database
    const customerArrMap = await this.getCustomerArrData(invoices);

    // Calculate portfolio overview
    const portfolioOverview = this.calculatePortfolioOverview(
      invoices,
      dateRange,
      totalInvoiced,
      totalCollected,
      customerArrMap
    );

    // Calculate per-customer metrics
    const customerMetrics = this.calculateCustomerMetrics(invoices, customerArrMap);

    // Identify high-risk accounts
    const highRiskAccounts = this.identifyHighRiskAccounts(customerMetrics);

    // Detect early warning signals
    const earlyWarnings = this.detectEarlyWarnings(invoices, customerMetrics);

    // Identify payment improvers
    const paymentImprovers = this.identifyPaymentImprovers(customerMetrics);

    // Generate insights
    const insights = this.generateInsights(portfolioOverview, customerMetrics, highRiskAccounts);

    // Generate action items
    const actionItems = this.generateActionItems(highRiskAccounts, earlyWarnings);

    return {
      fileId,
      analysisDate: new Date().toISOString(),
      portfolioOverview,
      customerMetrics,
      highRiskAccounts,
      earlyWarnings,
      paymentImprovers,
      insights,
      actionItems
    };
  }

  /**
   * Calculate portfolio-wide payment overview
   */
  private calculatePortfolioOverview(
    invoices: InvoiceRecord[],
    dateRange: { start: string; end: string; months: number },
    totalInvoiced: number,
    totalCollected: number,
    customerArrMap: Map<string, { arr: number; segment?: string }>
  ): PaymentPortfolioOverview {
    const uniqueCustomers = new Set(invoices.map(i => i.customerId));
    const totalOutstanding = totalInvoiced - totalCollected;

    // Calculate payment timing distribution
    let onTime = 0;
    let late1to30 = 0;
    let late31to60 = 0;
    let late60Plus = 0;
    let disputed = 0;
    let totalDaysToPay = 0;
    let paidCount = 0;

    for (const invoice of invoices) {
      if (invoice.status === 'disputed') {
        disputed++;
        continue;
      }

      if (invoice.status === 'paid' && invoice.daysToPay !== undefined) {
        paidCount++;
        totalDaysToPay += invoice.daysToPay;

        const dueDate = new Date(invoice.dueDate);
        const paidDate = new Date(invoice.paidDate!);
        const daysLate = Math.floor((paidDate.getTime() - dueDate.getTime()) / (1000 * 60 * 60 * 24));

        if (daysLate <= 0) {
          onTime++;
        } else if (daysLate <= 30) {
          late1to30++;
        } else if (daysLate <= 60) {
          late31to60++;
        } else {
          late60Plus++;
        }
      }
    }

    const averageOnTimeRate = paidCount > 0 ? (onTime / paidCount) * 100 : 0;
    const averageDaysToPay = paidCount > 0 ? Math.round(totalDaysToPay / paidCount) : 0;
    const portfolioDso = this.calculateDSO(totalOutstanding, totalInvoiced, dateRange.months * 30);
    const outstandingPercentage = totalInvoiced > 0 ? (totalOutstanding / totalInvoiced) * 100 : 0;

    // Calculate segment breakdown
    const segmentBreakdown = this.calculateSegmentBreakdown(invoices, customerArrMap);

    return {
      totalInvoices: invoices.length,
      totalCustomers: uniqueCustomers.size,
      dateRange,
      totalInvoiced,
      totalCollected,
      totalOutstanding,
      averageOnTimeRate: Math.round(averageOnTimeRate),
      averageDaysToPay,
      portfolioDso,
      outstandingPercentage: Math.round(outstandingPercentage * 10) / 10,
      segmentBreakdown,
      paymentDistribution: {
        onTime,
        late1to30,
        late31to60,
        late60Plus,
        disputed
      }
    };
  }

  /**
   * Calculate segment breakdown
   */
  private calculateSegmentBreakdown(
    invoices: InvoiceRecord[],
    customerArrMap: Map<string, { arr: number; segment?: string }>
  ): SegmentPaymentSummary[] {
    const segmentMap = new Map<string, {
      customers: Set<string>;
      onTime: number;
      total: number;
      daysToPay: number[];
      outstanding: number;
      arrAtRisk: number;
    }>();

    for (const invoice of invoices) {
      const customerData = customerArrMap.get(invoice.customerId) || { arr: 0, segment: 'Unknown' };
      const segment = customerData.segment || 'Unknown';

      if (!segmentMap.has(segment)) {
        segmentMap.set(segment, {
          customers: new Set(),
          onTime: 0,
          total: 0,
          daysToPay: [],
          outstanding: 0,
          arrAtRisk: 0
        });
      }

      const segmentData = segmentMap.get(segment)!;
      segmentData.customers.add(invoice.customerId);

      if (invoice.status === 'paid') {
        segmentData.total++;
        if (invoice.daysToPay !== undefined) {
          segmentData.daysToPay.push(invoice.daysToPay);

          const dueDate = new Date(invoice.dueDate);
          const paidDate = new Date(invoice.paidDate!);
          if (paidDate <= dueDate) {
            segmentData.onTime++;
          }
        }
      } else if (invoice.status !== 'voided') {
        segmentData.outstanding += invoice.amount - invoice.amountPaid;
      }
    }

    // Calculate at-risk ARR for each segment
    for (const [segment, data] of segmentMap) {
      for (const customerId of data.customers) {
        const customerInvoices = invoices.filter(i => i.customerId === customerId);
        const paidInvoices = customerInvoices.filter(i => i.status === 'paid');
        const onTimeCount = paidInvoices.filter(i => {
          if (!i.paidDate) return false;
          return new Date(i.paidDate) <= new Date(i.dueDate);
        }).length;

        const onTimeRate = paidInvoices.length > 0 ? (onTimeCount / paidInvoices.length) * 100 : 100;

        if (onTimeRate < 70) {
          const customerData = customerArrMap.get(customerId);
          if (customerData) {
            data.arrAtRisk += customerData.arr;
          }
        }
      }
    }

    return Array.from(segmentMap.entries()).map(([segment, data]) => {
      const avgDaysToPay = data.daysToPay.length > 0
        ? Math.round(data.daysToPay.reduce((a, b) => a + b, 0) / data.daysToPay.length)
        : 0;

      return {
        segment,
        customerCount: data.customers.size,
        onTimeRate: data.total > 0 ? Math.round((data.onTime / data.total) * 100) : 0,
        averageDaysToPay: avgDaysToPay,
        dso: this.calculateDSO(data.outstanding, data.total * avgDaysToPay, 365),
        outstanding: data.outstanding,
        arrAtRisk: data.arrAtRisk
      };
    }).sort((a, b) => b.arrAtRisk - a.arrAtRisk);
  }

  /**
   * Calculate per-customer payment metrics
   */
  private calculateCustomerMetrics(
    invoices: InvoiceRecord[],
    customerArrMap: Map<string, { arr: number; segment?: string }>
  ): CustomerPaymentMetrics[] {
    const customerInvoiceMap = new Map<string, InvoiceRecord[]>();

    for (const invoice of invoices) {
      const customerId = invoice.customerId;
      if (!customerInvoiceMap.has(customerId)) {
        customerInvoiceMap.set(customerId, []);
      }
      customerInvoiceMap.get(customerId)!.push(invoice);
    }

    const metrics: CustomerPaymentMetrics[] = [];

    for (const [customerId, customerInvoices] of customerInvoiceMap) {
      const customerData = customerArrMap.get(customerId) || { arr: 0, segment: undefined };
      const customerName = customerInvoices[0]?.customerName || customerId;

      // Calculate basic metrics
      const paidInvoices = customerInvoices.filter(i => i.status === 'paid');
      const disputedInvoices = customerInvoices.filter(i => i.status === 'disputed');
      const outstandingInvoices = customerInvoices.filter(
        i => i.status === 'pending' || i.status === 'overdue' || i.status === 'partial'
      );

      // Calculate on-time rate
      let onTimeCount = 0;
      let totalDaysToPay = 0;
      let paidWithDays = 0;
      let lateCount = 0;

      for (const invoice of paidInvoices) {
        if (invoice.paidDate && invoice.daysToPay !== undefined) {
          paidWithDays++;
          totalDaysToPay += invoice.daysToPay;

          const dueDate = new Date(invoice.dueDate);
          const paidDate = new Date(invoice.paidDate);
          if (paidDate <= dueDate) {
            onTimeCount++;
          } else {
            lateCount++;
          }
        }
      }

      const onTimeRate = paidWithDays > 0 ? (onTimeCount / paidWithDays) * 100 : 100;
      const averageDaysToPay = paidWithDays > 0 ? Math.round(totalDaysToPay / paidWithDays) : 0;

      // Calculate outstanding balance
      const outstandingBalance = outstandingInvoices.reduce(
        (sum, i) => sum + (i.amount - i.amountPaid),
        0
      );

      // Calculate dispute rate
      const disputeRate = customerInvoices.length > 0
        ? (disputedInvoices.length / customerInvoices.length) * 100
        : 0;

      // Calculate DSO
      const totalCustomerRevenue = customerInvoices.reduce((sum, i) => sum + i.amount, 0);
      const dso = this.calculateDSO(outstandingBalance, totalCustomerRevenue, 365);

      // Calculate quarterly trends
      const trendData = this.calculateQuarterlyTrends(customerInvoices);

      // Determine trend
      const trend = this.determineTrend(trendData);

      // Calculate risk
      const { riskLevel, riskScore, riskSignals } = this.calculateRisk(
        onTimeRate,
        averageDaysToPay,
        outstandingBalance,
        customerData.arr,
        trend,
        disputeRate
      );

      metrics.push({
        customerId,
        customerName,
        arr: customerData.arr,
        segment: customerData.segment,
        onTimeRate: Math.round(onTimeRate),
        averageDaysToPay,
        dso,
        outstandingBalance,
        disputeRate: Math.round(disputeRate),
        totalInvoices: customerInvoices.length,
        paidInvoices: paidInvoices.length,
        lateInvoices: lateCount,
        disputedInvoices: disputedInvoices.length,
        outstandingInvoices: outstandingInvoices.length,
        trend,
        trendData,
        riskLevel,
        riskScore,
        riskSignals
      });
    }

    // Sort by risk score descending
    return metrics.sort((a, b) => b.riskScore - a.riskScore);
  }

  /**
   * Calculate quarterly payment trends for a customer
   */
  private calculateQuarterlyTrends(invoices: InvoiceRecord[]): QuarterlyPaymentTrend[] {
    const quarterMap = new Map<string, {
      onTime: number;
      total: number;
      daysToPay: number[];
      outstanding: number;
    }>();

    for (const invoice of invoices) {
      const date = new Date(invoice.invoiceDate);
      const quarter = `${date.getFullYear()}-Q${Math.ceil((date.getMonth() + 1) / 3)}`;

      if (!quarterMap.has(quarter)) {
        quarterMap.set(quarter, { onTime: 0, total: 0, daysToPay: [], outstanding: 0 });
      }

      const qData = quarterMap.get(quarter)!;

      if (invoice.status === 'paid' && invoice.paidDate) {
        qData.total++;
        if (invoice.daysToPay !== undefined) {
          qData.daysToPay.push(invoice.daysToPay);
        }
        const dueDate = new Date(invoice.dueDate);
        const paidDate = new Date(invoice.paidDate);
        if (paidDate <= dueDate) {
          qData.onTime++;
        }
      } else if (invoice.status !== 'voided') {
        qData.outstanding += invoice.amount - invoice.amountPaid;
      }
    }

    // Convert to array and sort by quarter
    return Array.from(quarterMap.entries())
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([quarter, data]) => ({
        quarter,
        quarterLabel: quarter.replace('-Q', ' Q'),
        onTimeRate: data.total > 0 ? Math.round((data.onTime / data.total) * 100) : 0,
        averageDaysToPay: data.daysToPay.length > 0
          ? Math.round(data.daysToPay.reduce((a, b) => a + b, 0) / data.daysToPay.length)
          : 0,
        outstanding: data.outstanding,
        invoiceCount: data.total
      }));
  }

  /**
   * Determine payment trend from quarterly data
   */
  private determineTrend(trendData: QuarterlyPaymentTrend[]): 'improving' | 'stable' | 'worsening' {
    if (trendData.length < 2) return 'stable';

    const recent = trendData.slice(-2);
    const onTimeChange = recent[1].onTimeRate - recent[0].onTimeRate;
    const daysChange = recent[1].averageDaysToPay - recent[0].averageDaysToPay;

    if (onTimeChange > 10 || daysChange < -5) return 'improving';
    if (onTimeChange < -10 || daysChange > 5) return 'worsening';

    return 'stable';
  }

  /**
   * Calculate risk level and signals
   */
  private calculateRisk(
    onTimeRate: number,
    averageDaysToPay: number,
    outstandingBalance: number,
    arr: number,
    trend: string,
    disputeRate: number
  ): { riskLevel: 'critical' | 'high' | 'medium' | 'low'; riskScore: number; riskSignals: string[] } {
    const riskSignals: string[] = [];
    let riskScore = 0;

    // On-time rate risk
    if (onTimeRate < 50) {
      riskScore += 40;
      riskSignals.push(`Very low on-time payment rate (${onTimeRate}%)`);
    } else if (onTimeRate < 65) {
      riskScore += 25;
      riskSignals.push(`Low on-time payment rate (${onTimeRate}%)`);
    } else if (onTimeRate < 80) {
      riskScore += 10;
      riskSignals.push(`Below average on-time rate (${onTimeRate}%)`);
    }

    // Days to pay risk
    if (averageDaysToPay > 60) {
      riskScore += 30;
      riskSignals.push(`Very long payment cycle (${averageDaysToPay} days)`);
    } else if (averageDaysToPay > 45) {
      riskScore += 15;
      riskSignals.push(`Long payment cycle (${averageDaysToPay} days)`);
    }

    // Outstanding balance risk
    const outstandingPercentage = arr > 0 ? (outstandingBalance / arr) * 100 : 0;
    if (outstandingPercentage > 30) {
      riskScore += 25;
      riskSignals.push(`High outstanding balance (${Math.round(outstandingPercentage)}% of ARR)`);
    } else if (outstandingPercentage > 20) {
      riskScore += 15;
      riskSignals.push(`Elevated outstanding balance (${Math.round(outstandingPercentage)}% of ARR)`);
    }

    // Trend risk
    if (trend === 'worsening') {
      riskScore += 20;
      riskSignals.push('Payment pattern deteriorating');
    }

    // Dispute risk
    if (disputeRate > 10) {
      riskScore += 15;
      riskSignals.push(`High dispute rate (${Math.round(disputeRate)}%)`);
    }

    // Determine risk level
    let riskLevel: 'critical' | 'high' | 'medium' | 'low';
    if (riskScore >= 60) {
      riskLevel = 'critical';
    } else if (riskScore >= 40) {
      riskLevel = 'high';
    } else if (riskScore >= 20) {
      riskLevel = 'medium';
    } else {
      riskLevel = 'low';
    }

    return { riskLevel, riskScore, riskSignals };
  }

  /**
   * Identify high-risk accounts
   */
  private identifyHighRiskAccounts(customerMetrics: CustomerPaymentMetrics[]): PaymentRiskAccount[] {
    return customerMetrics
      .filter(m => m.riskLevel === 'critical' || m.riskLevel === 'high')
      .map(m => {
        const outstandingPercentage = m.arr > 0 ? (m.outstandingBalance / m.arr) * 100 : 0;

        // Generate pattern description
        let patternDescription = '';
        if (m.trend === 'worsening') {
          patternDescription = 'Payment pattern deteriorating';
        } else if (m.onTimeRate < 50) {
          patternDescription = 'Consistently late payments';
        } else if (m.averageDaysToPay > 60) {
          patternDescription = 'Chronically slow payer';
        } else {
          patternDescription = 'Intermittent payment issues';
        }

        // Generate recommended actions
        const recommendedActions: string[] = [];
        if (m.riskLevel === 'critical') {
          recommendedActions.push('Finance escalation - arrange payment plan');
          recommendedActions.push('Review upcoming renewal terms');
          recommendedActions.push('Consider executive conversation about partnership value');
        } else {
          recommendedActions.push('Offer alternative payment schedule');
          recommendedActions.push('Set up automatic payment reminders');
          recommendedActions.push('Discuss cash flow friendly options');
        }

        return {
          customerId: m.customerId,
          customerName: m.customerName,
          arr: m.arr,
          segment: m.segment,
          riskLevel: m.riskLevel as 'critical' | 'high' | 'medium',
          onTimeRate: m.onTimeRate,
          averageDaysToPay: m.averageDaysToPay,
          outstandingBalance: m.outstandingBalance,
          outstandingPercentage: Math.round(outstandingPercentage),
          patternDescription,
          quarterlyTrend: m.trendData,
          recommendedActions
        };
      });
  }

  /**
   * Detect early warning signals
   */
  private detectEarlyWarnings(
    invoices: InvoiceRecord[],
    customerMetrics: CustomerPaymentMetrics[]
  ): EarlyWarningSignal[] {
    const warnings: EarlyWarningSignal[] = [];

    for (const metrics of customerMetrics) {
      // Skip if already high risk (handled separately)
      if (metrics.riskLevel === 'critical' || metrics.riskLevel === 'high') continue;

      // Check for worsening trend in good payers
      if (metrics.trend === 'worsening' && metrics.trendData.length >= 2) {
        const current = metrics.trendData[metrics.trendData.length - 1];
        const previous = metrics.trendData[metrics.trendData.length - 2];

        if (previous.onTimeRate >= 80 && current.onTimeRate < 70) {
          warnings.push({
            customerId: metrics.customerId,
            customerName: metrics.customerName,
            arr: metrics.arr,
            signalType: 'trend_worsening',
            description: 'Good payer showing decline in payment behavior',
            evidence: `On-time rate dropped from ${previous.onTimeRate}% to ${current.onTimeRate}%`,
            previousBehavior: `${previous.onTimeRate}% on-time, ${previous.averageDaysToPay} days avg`,
            currentBehavior: `${current.onTimeRate}% on-time, ${current.averageDaysToPay} days avg`,
            severity: 'medium',
            recommendedAction: 'Check in with champion about business status'
          });
        }
      }

      // Check for first late payment in historically good payers
      const customerInvoices = invoices.filter(i => i.customerId === metrics.customerId);
      const sortedInvoices = customerInvoices.sort(
        (a, b) => new Date(a.invoiceDate).getTime() - new Date(b.invoiceDate).getTime()
      );

      if (sortedInvoices.length >= 6) {
        const recentInvoices = sortedInvoices.slice(-3);
        const historicalInvoices = sortedInvoices.slice(0, -3);

        const historicalLateCount = historicalInvoices.filter(
          i => i.status === 'paid' && i.paidDate && new Date(i.paidDate) > new Date(i.dueDate)
        ).length;

        const recentLateCount = recentInvoices.filter(
          i => i.status === 'paid' && i.paidDate && new Date(i.paidDate) > new Date(i.dueDate)
        ).length;

        // If historical was always on time but recent has late
        if (historicalLateCount === 0 && recentLateCount > 0) {
          const latestLate = recentInvoices.find(
            i => i.status === 'paid' && i.paidDate && new Date(i.paidDate) > new Date(i.dueDate)
          );

          if (latestLate) {
            warnings.push({
              customerId: metrics.customerId,
              customerName: metrics.customerName,
              arr: metrics.arr,
              signalType: 'first_late',
              description: 'First late payment after consistent on-time history',
              evidence: `${historicalInvoices.length} invoices on-time, then ${latestLate.daysToPay || 'N/A'} days on latest`,
              previousBehavior: 'Consistently on-time payments',
              currentBehavior: `${recentLateCount} of ${recentInvoices.length} recent invoices late`,
              severity: 'low',
              recommendedAction: 'Investigate - could be one-off or emerging issue'
            });
          }
        }
      }

      // Check for increasing days to pay
      if (metrics.trendData.length >= 3) {
        const recent3 = metrics.trendData.slice(-3);
        const daysIncreasing = recent3[0].averageDaysToPay < recent3[1].averageDaysToPay &&
          recent3[1].averageDaysToPay < recent3[2].averageDaysToPay;

        const totalIncrease = recent3[2].averageDaysToPay - recent3[0].averageDaysToPay;

        if (daysIncreasing && totalIncrease > 10) {
          warnings.push({
            customerId: metrics.customerId,
            customerName: metrics.customerName,
            arr: metrics.arr,
            signalType: 'payment_delay_increase',
            description: 'Payment timing steadily increasing',
            evidence: `Days to pay increased from ${recent3[0].averageDaysToPay} to ${recent3[2].averageDaysToPay} over 3 quarters`,
            previousBehavior: `Average ${recent3[0].averageDaysToPay} days to pay`,
            currentBehavior: `Average ${recent3[2].averageDaysToPay} days to pay`,
            severity: totalIncrease > 20 ? 'high' : 'medium',
            recommendedAction: 'Early renewal discussion with incentives; monitor next invoice closely'
          });
        }
      }
    }

    return warnings.sort((a, b) => {
      const severityOrder = { high: 0, medium: 1, low: 2 };
      return severityOrder[a.severity] - severityOrder[b.severity];
    });
  }

  /**
   * Identify customers with improving payment patterns
   */
  private identifyPaymentImprovers(customerMetrics: CustomerPaymentMetrics[]): PaymentImprover[] {
    return customerMetrics
      .filter(m => m.trend === 'improving' && m.trendData.length >= 2)
      .map(m => {
        const current = m.trendData[m.trendData.length - 1];
        const previous = m.trendData[m.trendData.length - 2];
        const improvement = current.onTimeRate - previous.onTimeRate;

        return {
          customerId: m.customerId,
          customerName: m.customerName,
          arr: m.arr,
          previousOnTimeRate: previous.onTimeRate,
          currentOnTimeRate: current.onTimeRate,
          improvementPercentage: Math.round(improvement)
        };
      })
      .filter(m => m.improvementPercentage >= 10)
      .sort((a, b) => b.improvementPercentage - a.improvementPercentage);
  }

  /**
   * Generate analysis insights
   */
  private generateInsights(
    overview: PaymentPortfolioOverview,
    customerMetrics: CustomerPaymentMetrics[],
    highRiskAccounts: PaymentRiskAccount[]
  ): string[] {
    const insights: string[] = [];

    // Portfolio health insight
    if (overview.averageOnTimeRate >= 85) {
      insights.push(`Strong portfolio payment health with ${overview.averageOnTimeRate}% average on-time rate`);
    } else if (overview.averageOnTimeRate < 75) {
      insights.push(`Below target portfolio payment health (${overview.averageOnTimeRate}% on-time vs 85% target)`);
    }

    // DSO insight
    if (overview.portfolioDso > 45) {
      insights.push(`High DSO of ${overview.portfolioDso} days indicates collection efficiency opportunity`);
    }

    // Outstanding balance insight
    if (overview.outstandingPercentage > 5) {
      insights.push(`${overview.outstandingPercentage}% of invoiced revenue outstanding - higher than typical 3-4%`);
    }

    // Segment insight
    const worstSegment = overview.segmentBreakdown[0];
    if (worstSegment && worstSegment.onTimeRate < 75) {
      insights.push(`${worstSegment.segment} segment has lowest on-time rate (${worstSegment.onTimeRate}%) - $${Math.round(worstSegment.arrAtRisk / 1000)}K ARR at risk`);
    }

    // High risk insight
    const totalRiskArr = highRiskAccounts.reduce((sum, a) => sum + a.arr, 0);
    if (highRiskAccounts.length > 0) {
      insights.push(`${highRiskAccounts.length} accounts with payment risk representing $${Math.round(totalRiskArr / 1000)}K ARR`);
    }

    // Worsening trend insight
    const worseningCount = customerMetrics.filter(m => m.trend === 'worsening').length;
    if (worseningCount > 0) {
      insights.push(`${worseningCount} customers showing worsening payment patterns - proactive outreach recommended`);
    }

    return insights;
  }

  /**
   * Generate action items
   */
  private generateActionItems(
    highRiskAccounts: PaymentRiskAccount[],
    earlyWarnings: EarlyWarningSignal[]
  ): ActionItem[] {
    const actionItems: ActionItem[] = [];

    // Add actions for high-risk accounts
    for (const account of highRiskAccounts.slice(0, 5)) {
      actionItems.push({
        customerId: account.customerId,
        customerName: account.customerName,
        priority: account.riskLevel,
        actionType: account.riskLevel === 'critical' ? 'finance_escalation' : 'payment_plan',
        description: account.recommendedActions[0],
        recommendedBy: 'Payment Pattern Analysis'
      });
    }

    // Add actions for early warnings
    for (const warning of earlyWarnings.slice(0, 5)) {
      actionItems.push({
        customerId: warning.customerId,
        customerName: warning.customerName,
        priority: warning.severity === 'high' ? 'high' : 'medium',
        actionType: warning.severity === 'high' ? 'review' : 'monitor',
        description: warning.recommendedAction,
        recommendedBy: 'Early Warning Detection'
      });
    }

    return actionItems;
  }

  /**
   * Calculate DSO (Days Sales Outstanding)
   */
  private calculateDSO(outstanding: number, revenue: number, periodDays: number): number {
    if (revenue === 0) return 0;
    return Math.round((outstanding / revenue) * periodDays);
  }

  /**
   * Get customer ARR data from database
   */
  private async getCustomerArrData(
    invoices: InvoiceRecord[]
  ): Promise<Map<string, { arr: number; segment?: string }>> {
    const customerMap = new Map<string, { arr: number; segment?: string }>();

    if (!this.supabase) {
      // Return estimated ARR based on invoice data
      const customerTotals = new Map<string, number>();
      for (const invoice of invoices) {
        const current = customerTotals.get(invoice.customerId) || 0;
        customerTotals.set(invoice.customerId, current + invoice.amount);
      }

      // Annualize based on data period
      const dates = invoices.map(i => new Date(i.invoiceDate)).sort((a, b) => a.getTime() - b.getTime());
      const months = dates.length > 1
        ? Math.max(1, Math.ceil((dates[dates.length - 1].getTime() - dates[0].getTime()) / (1000 * 60 * 60 * 24 * 30)))
        : 12;

      for (const [customerId, total] of customerTotals) {
        customerMap.set(customerId, {
          arr: Math.round((total / months) * 12),
          segment: undefined
        });
      }

      return customerMap;
    }

    try {
      const customerIds = [...new Set(invoices.map(i => i.customerId))];

      const { data } = await (this.supabase as any)
        .from('customers')
        .select('id, arr, segment')
        .in('id', customerIds);

      if (data) {
        for (const customer of data) {
          customerMap.set(customer.id, {
            arr: customer.arr || 0,
            segment: customer.segment
          });
        }
      }

      // Fill in missing customers with estimated ARR
      for (const invoice of invoices) {
        if (!customerMap.has(invoice.customerId)) {
          const customerInvoices = invoices.filter(i => i.customerId === invoice.customerId);
          const totalAmount = customerInvoices.reduce((sum, i) => sum + i.amount, 0);
          const dates = customerInvoices.map(i => new Date(i.invoiceDate)).sort((a, b) => a.getTime() - b.getTime());
          const months = dates.length > 1
            ? Math.max(1, Math.ceil((dates[dates.length - 1].getTime() - dates[0].getTime()) / (1000 * 60 * 60 * 24 * 30)))
            : 12;

          customerMap.set(invoice.customerId, {
            arr: Math.round((totalAmount / months) * 12),
            segment: undefined
          });
        }
      }

      return customerMap;
    } catch (error) {
      console.error('Error fetching customer ARR data:', error);
      return customerMap;
    }
  }

  // ============================================
  // Renewal Briefing Methods
  // ============================================

  /**
   * Generate payment context briefing for renewal
   */
  async generateRenewalBriefing(
    customerId: string,
    customerMetrics: CustomerPaymentMetrics
  ): Promise<PaymentContextBriefing> {
    // Get customer details from database
    let customerDetails: {
      arr: number;
      renewalDate?: string;
      healthScore?: number;
    } = { arr: customerMetrics.arr };

    if (this.supabase) {
      try {
        const { data } = await (this.supabase as any)
          .from('customers')
          .select('arr, renewal_date, health_score')
          .eq('id', customerId)
          .single();

        if (data) {
          customerDetails = {
            arr: data.arr || customerMetrics.arr,
            renewalDate: data.renewal_date,
            healthScore: data.health_score
          };
        }
      } catch (error) {
        console.error('Error fetching customer details:', error);
      }
    }

    // Calculate days to renewal
    let daysToRenewal: number | undefined;
    if (customerDetails.renewalDate) {
      const renewalDate = new Date(customerDetails.renewalDate);
      const today = new Date();
      daysToRenewal = Math.ceil((renewalDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
    }

    // Calculate outstanding percentage
    const outstandingPercentage = customerDetails.arr > 0
      ? (customerMetrics.outstandingBalance / customerDetails.arr) * 100
      : 0;

    // Generate red flags
    const redFlags: string[] = [];
    if (customerMetrics.onTimeRate < 70) {
      redFlags.push(`On-time payment rate below 70% (${customerMetrics.onTimeRate}%)`);
    }
    if (customerMetrics.trend === 'worsening') {
      redFlags.push('Payment pattern deteriorating over recent quarters');
    }
    if (outstandingPercentage > 20) {
      redFlags.push(`High outstanding balance (${Math.round(outstandingPercentage)}% of ARR)`);
    }
    if (customerMetrics.disputeRate > 5) {
      redFlags.push(`Invoice disputes (${customerMetrics.disputeRate}% dispute rate)`);
    }
    if (customerMetrics.averageDaysToPay > 45) {
      redFlags.push(`Slow payment cycle (${customerMetrics.averageDaysToPay} days average)`);
    }

    // Determine financial risk
    let financialRisk: 'high' | 'moderate-high' | 'moderate' | 'low';
    if (customerMetrics.riskLevel === 'critical') {
      financialRisk = 'high';
    } else if (customerMetrics.riskLevel === 'high') {
      financialRisk = 'moderate-high';
    } else if (customerMetrics.riskLevel === 'medium') {
      financialRisk = 'moderate';
    } else {
      financialRisk = 'low';
    }

    // Calculate renewal probability adjustment
    let renewalProbability = 85; // baseline
    if (financialRisk === 'high') renewalProbability -= 25;
    else if (financialRisk === 'moderate-high') renewalProbability -= 15;
    else if (financialRisk === 'moderate') renewalProbability -= 5;

    // Generate renewal strategy
    const renewalStrategy: string[] = [];
    if (financialRisk === 'high' || financialRisk === 'moderate-high') {
      renewalStrategy.push('Address outstanding balance before discussing renewal');
      renewalStrategy.push('Offer finance team involvement for payment plan');
      renewalStrategy.push('Consider restructured terms (monthly billing vs annual)');
      renewalStrategy.push('Document ROI to justify continued investment');
    } else {
      renewalStrategy.push('Standard renewal conversation - highlight value delivered');
      if (customerMetrics.trend === 'improving') {
        renewalStrategy.push('Acknowledge improved payment pattern in conversation');
      }
    }

    // Generate talking points
    const talkingPoints: string[] = [];
    if (financialRisk === 'high' || financialRisk === 'moderate-high') {
      talkingPoints.push(
        '"Before we discuss the renewal, I wanted to check in on how things are going overall. ' +
        'I noticed some recent invoice delays and want to make sure everything is okay on your end."'
      );
      talkingPoints.push(
        '"We value our partnership and want to find a structure that works for both sides. ' +
        'Would a different billing cadence help with cash flow planning?"'
      );
    } else {
      talkingPoints.push(
        '"I wanted to share some highlights from our partnership this year before we discuss the renewal."'
      );
    }

    // Generate next steps
    const recommendedNextSteps: string[] = [];
    if (financialRisk === 'high') {
      recommendedNextSteps.push('Schedule call with Finance to discuss payment plan');
      recommendedNextSteps.push('Prepare value documentation before renewal conversation');
      recommendedNextSteps.push('If no progress in 2 weeks, involve your manager');
    } else if (financialRisk === 'moderate-high') {
      recommendedNextSteps.push('Send gentle reminder about outstanding balance');
      recommendedNextSteps.push('Prepare renewal proposal with flexible payment options');
    } else {
      recommendedNextSteps.push('Proceed with standard renewal process');
      recommendedNextSteps.push('Prepare value summary for renewal conversation');
    }

    return {
      customerId,
      customerName: customerMetrics.customerName,
      arr: customerDetails.arr,
      renewalDate: customerDetails.renewalDate,
      daysToRenewal,
      paymentSummary: {
        onTimeRate: customerMetrics.onTimeRate,
        averageDaysToPay: customerMetrics.averageDaysToPay,
        trend: customerMetrics.trend,
        outstandingBalance: customerMetrics.outstandingBalance,
        outstandingPercentage: Math.round(outstandingPercentage)
      },
      quarterlyHistory: customerMetrics.trendData,
      redFlags,
      financialRisk,
      renewalProbability,
      churnRisk: financialRisk === 'high' ? 'high' : financialRisk === 'moderate-high' ? 'moderate' : 'low',
      renewalStrategy,
      talkingPoints,
      recommendedNextSteps
    };
  }
}

// Export singleton instance
export const paymentAnalyzer = new PaymentAnalyzerService();
export default paymentAnalyzer;
