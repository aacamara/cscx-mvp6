/**
 * Benchmark Comparator Service
 * PRD-023: Benchmark Data Upload -> Peer Comparison
 *
 * Compares customer metrics against benchmark data, calculates percentile
 * rankings, identifies best practices, and generates recommendations.
 */

import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { config } from '../../config/index.js';
import { benchmarkDataLoader } from './dataLoader.js';
import { peerGrouper, CustomerForGrouping } from './peerGrouper.js';
import type {
  BenchmarkDataset,
  BenchmarkValue,
  BenchmarkCategory,
  MetricComparison,
  CustomerBenchmarkComparison,
  BenchmarkRecommendation,
  TopPerformer,
  BestPractice,
  PortfolioBenchmarkAnalysis,
  PortfolioMetricSummary,
  PeerGroup,
  PeerGroupComparison,
  PerformanceStatus,
  CustomerBenchmarkReport,
} from '../../../../types/benchmark.js';

// Initialize Supabase client
let supabase: SupabaseClient | null = null;
if (config.supabaseUrl && config.supabaseServiceKey) {
  supabase = createClient(config.supabaseUrl, config.supabaseServiceKey);
}

// Metric metadata for display and calculations
const METRIC_INFO: Record<string, { name: string; category: BenchmarkCategory; unit: string; higherIsBetter: boolean }> = {
  dau_mau_ratio: { name: 'DAU/MAU Ratio', category: 'engagement', unit: 'ratio', higherIsBetter: true },
  session_length: { name: 'Session Length', category: 'engagement', unit: 'minutes', higherIsBetter: true },
  feature_adoption: { name: 'Feature Adoption', category: 'engagement', unit: '%', higherIsBetter: true },
  roi: { name: 'ROI', category: 'value', unit: 'x', higherIsBetter: true },
  time_to_value: { name: 'Time-to-Value', category: 'value', unit: 'days', higherIsBetter: false },
  outcomes_achieved: { name: 'Outcomes Achieved', category: 'value', unit: '%', higherIsBetter: true },
  nps_score: { name: 'NPS Score', category: 'satisfaction', unit: 'pts', higherIsBetter: true },
  csat: { name: 'CSAT', category: 'satisfaction', unit: '%', higherIsBetter: true },
  health_score: { name: 'Health Score', category: 'satisfaction', unit: 'pts', higherIsBetter: true },
  expansion_rate: { name: 'Expansion Rate', category: 'growth', unit: '%', higherIsBetter: true },
  seat_growth: { name: 'Seat Growth', category: 'growth', unit: '%', higherIsBetter: true },
  upsell_rate: { name: 'Upsell Rate', category: 'growth', unit: '%', higherIsBetter: true },
  tickets_per_user: { name: 'Support Tickets/User', category: 'efficiency', unit: 'ratio', higherIsBetter: false },
  self_service_rate: { name: 'Self-Service Rate', category: 'efficiency', unit: '%', higherIsBetter: true },
  resolution_time: { name: 'Resolution Time', category: 'efficiency', unit: 'hours', higherIsBetter: false },
};

// Best practice templates for recommendations
const BEST_PRACTICES: Record<string, string[]> = {
  feature_adoption: [
    'Weekly 30-minute training sessions for new features',
    'Gamification with completion badges',
    'Feature release communication cadence',
    'Admin champion program',
  ],
  nps_score: [
    'Monthly proactive check-in calls',
    'No-agenda relationship touchpoints',
    'Quick issue resolution SLAs',
    'Quarterly executive reviews',
  ],
  time_to_value: [
    'Structured onboarding playbook',
    'Early wins identification in first week',
    'Milestone celebration at key achievements',
    'Success metric tracking from day one',
  ],
  dau_mau_ratio: [
    'Daily engagement challenges',
    'Push notifications for key workflows',
    'Personalized daily digests',
    'Workflow automation recommendations',
  ],
  expansion_rate: [
    'Proactive expansion opportunity identification',
    'Success story documentation',
    'Executive business reviews with ROI focus',
    'Feature maturity assessments',
  ],
};

export interface CustomerMetrics {
  customerId: string;
  customerName: string;
  arr: number;
  segment: string;
  industry?: string;
  metrics: Record<string, number>;
}

class BenchmarkComparatorService {
  /**
   * Compare a single customer against benchmark data
   */
  async compareCustomer(
    customerId: string,
    datasetId: string
  ): Promise<CustomerBenchmarkComparison | null> {
    // Get benchmark dataset
    const dataset = await benchmarkDataLoader.getBenchmarkDataset(datasetId);
    if (!dataset) {
      throw new Error(`Benchmark dataset ${datasetId} not found`);
    }

    // Get customer data
    const customerMetrics = await this.getCustomerMetrics(customerId);
    if (!customerMetrics) {
      throw new Error(`Customer ${customerId} not found`);
    }

    // Calculate comparisons for each metric
    const metricComparisons = this.calculateMetricComparisons(
      customerMetrics.metrics,
      dataset.metrics
    );

    // Identify strengths and gaps
    const strengths = metricComparisons
      .filter(m => m.percentile >= 75)
      .sort((a, b) => b.percentile - a.percentile);

    const gaps = metricComparisons
      .filter(m => m.percentile < 50)
      .sort((a, b) => a.percentile - b.percentile);

    // Calculate overall percentile
    const overallPercentile = Math.round(
      metricComparisons.reduce((sum, m) => sum + m.percentile, 0) / metricComparisons.length
    );

    // Generate recommendations
    const recommendations = await this.generateRecommendations(
      gaps,
      customerMetrics,
      datasetId
    );

    return {
      customerId,
      customerName: customerMetrics.customerName,
      arr: customerMetrics.arr,
      segment: customerMetrics.segment,
      peerGroup: this.determinePeerGroup(customerMetrics.arr),
      overallPercentile,
      overallStatus: this.getPerformanceStatus(overallPercentile),
      metrics: metricComparisons,
      strengths,
      gaps,
      recommendations,
    };
  }

  /**
   * Run portfolio-wide benchmark analysis
   */
  async analyzePortfolio(datasetId: string): Promise<PortfolioBenchmarkAnalysis> {
    // Get benchmark dataset
    const dataset = await benchmarkDataLoader.getBenchmarkDataset(datasetId);
    if (!dataset) {
      throw new Error(`Benchmark dataset ${datasetId} not found`);
    }

    // Get all customer metrics
    const allCustomerMetrics = await this.getAllCustomerMetrics();

    // Analyze each metric across portfolio
    const portfolioMetrics: PortfolioMetricSummary[] = [];
    const topPerformers: TopPerformer[] = [];
    const customerComparisons: CustomerBenchmarkComparison[] = [];

    for (const benchmarkMetric of dataset.metrics) {
      const info = METRIC_INFO[benchmarkMetric.metricId];
      if (!info) continue;

      // Calculate portfolio average for this metric
      const customerValues = allCustomerMetrics
        .filter(c => c.metrics[benchmarkMetric.metricId] !== undefined)
        .map(c => ({
          customer: c,
          value: c.metrics[benchmarkMetric.metricId],
        }));

      if (customerValues.length === 0) continue;

      const portfolioAvg =
        customerValues.reduce((sum, cv) => sum + cv.value, 0) / customerValues.length;

      // Calculate percentile for portfolio average
      const portfolioPercentile = this.calculatePercentile(
        portfolioAvg,
        benchmarkMetric,
        info.higherIsBetter
      );

      // Count customers above/at/below benchmark
      const counts = { above: 0, at: 0, below: 0 };
      customerValues.forEach(cv => {
        const pct = this.calculatePercentile(cv.value, benchmarkMetric, info.higherIsBetter);
        if (pct >= 60) counts.above++;
        else if (pct >= 40) counts.at++;
        else counts.below++;
      });

      portfolioMetrics.push({
        metricId: benchmarkMetric.metricId,
        metricName: info.name,
        category: info.category,
        portfolioAvg,
        benchmarkMedian: benchmarkMetric.p50,
        portfolioPercentile,
        status: this.getPerformanceStatus(portfolioPercentile),
        aboveCount: counts.above,
        atCount: counts.at,
        belowCount: counts.below,
      });

      // Find top performer for this metric
      const sorted = [...customerValues].sort((a, b) => {
        return info.higherIsBetter ? b.value - a.value : a.value - b.value;
      });

      if (sorted.length > 0) {
        const top = sorted[0];
        const topPercentile = this.calculatePercentile(
          top.value,
          benchmarkMetric,
          info.higherIsBetter
        );

        if (topPercentile >= 90) {
          topPerformers.push({
            customerId: top.customer.customerId,
            customerName: top.customer.customerName,
            metricId: benchmarkMetric.metricId,
            metricName: info.name,
            value: top.value,
            percentile: topPercentile,
            bestPractice: BEST_PRACTICES[benchmarkMetric.metricId]?.[0] || null,
          });
        }
      }
    }

    // Get individual customer comparisons
    for (const customer of allCustomerMetrics) {
      const comparison = await this.compareCustomer(customer.customerId, datasetId);
      if (comparison) {
        customerComparisons.push(comparison);
      }
    }

    // Identify underperformers (bottom quartile overall)
    const underperformers = customerComparisons
      .filter(c => c.overallPercentile < 25)
      .sort((a, b) => a.overallPercentile - b.overallPercentile)
      .slice(0, 5);

    // Generate best practices from top performers
    const bestPractices = this.extractBestPractices(topPerformers);

    // Calculate summary
    const totalCustomers = customerComparisons.length;
    const aboveBenchmark = customerComparisons.filter(c => c.overallPercentile >= 60).length;
    const belowBenchmark = customerComparisons.filter(c => c.overallPercentile < 40).length;
    const atBenchmark = totalCustomers - aboveBenchmark - belowBenchmark;

    return {
      datasetId,
      datasetName: dataset.name,
      analyzedAt: new Date().toISOString(),
      totalCustomers,
      totalArr: allCustomerMetrics.reduce((sum, c) => sum + c.arr, 0),
      metrics: portfolioMetrics,
      summary: {
        aboveBenchmark,
        atBenchmark,
        belowBenchmark,
      },
      topPerformers: topPerformers.slice(0, 10),
      underperformers,
      bestPractices,
    };
  }

  /**
   * Compare peer group against benchmarks
   */
  async comparePeerGroup(
    peerGroupId: string,
    datasetId: string
  ): Promise<PeerGroupComparison> {
    // Get peer group
    const peerGroup = await peerGrouper.getPeerGroup(peerGroupId);
    if (!peerGroup) {
      // Create default peer groups if ID matches pattern
      const customers = await peerGrouper.fetchCustomersForGrouping();
      const groups = await peerGrouper.createPeerGroups(customers, { dimension: 'segment' });
      const matchedGroup = groups.find(g => g.id === peerGroupId);
      if (!matchedGroup) {
        throw new Error(`Peer group ${peerGroupId} not found`);
      }
      return this.comparePeerGroupInternal(matchedGroup, datasetId);
    }

    return this.comparePeerGroupInternal(peerGroup, datasetId);
  }

  /**
   * Internal peer group comparison
   */
  private async comparePeerGroupInternal(
    peerGroup: PeerGroup,
    datasetId: string
  ): Promise<PeerGroupComparison> {
    const dataset = await benchmarkDataLoader.getBenchmarkDataset(datasetId);
    if (!dataset) {
      throw new Error(`Benchmark dataset ${datasetId} not found`);
    }

    // Get comparisons for each customer in the group
    const customerComparisons: CustomerBenchmarkComparison[] = [];
    for (const customerId of peerGroup.customerIds) {
      const comparison = await this.compareCustomer(customerId, datasetId);
      if (comparison) {
        customerComparisons.push(comparison);
      }
    }

    // Calculate group metrics
    const metrics = dataset.metrics.map(bm => {
      const info = METRIC_INFO[bm.metricId];
      if (!info) return null;

      const customerValues = customerComparisons
        .flatMap(c => c.metrics)
        .filter(m => m.metricId === bm.metricId);

      const groupAvg = customerValues.length > 0
        ? customerValues.reduce((sum, m) => sum + m.customerValue, 0) / customerValues.length
        : 0;

      return {
        metricId: bm.metricId,
        metricName: info.name,
        groupAvg,
        portfolioAvg: groupAvg, // Same in this context
        benchmarkMedian: bm.p50,
      };
    }).filter((m): m is NonNullable<typeof m> => m !== null);

    // Calculate summary stats
    const sortedByPercentile = [...customerComparisons].sort(
      (a, b) => a.overallPercentile - b.overallPercentile
    );

    return {
      peerGroup,
      customers: customerComparisons,
      metrics,
      summary: {
        aboveMedian: customerComparisons.filter(c => c.overallPercentile >= 50).length,
        belowMedian: customerComparisons.filter(c => c.overallPercentile < 50).length,
        lowestPerformer: sortedByPercentile.length > 0
          ? {
              customerId: sortedByPercentile[0].customerId,
              customerName: sortedByPercentile[0].customerName,
              percentile: sortedByPercentile[0].overallPercentile,
            }
          : null,
        highestPerformer: sortedByPercentile.length > 0
          ? {
              customerId: sortedByPercentile[sortedByPercentile.length - 1].customerId,
              customerName: sortedByPercentile[sortedByPercentile.length - 1].customerName,
              percentile: sortedByPercentile[sortedByPercentile.length - 1].overallPercentile,
            }
          : null,
      },
    };
  }

  /**
   * Get top performers across all metrics or for specific metric
   */
  async getTopPerformers(
    datasetId: string,
    metricId?: string,
    limit: number = 10
  ): Promise<TopPerformer[]> {
    const dataset = await benchmarkDataLoader.getBenchmarkDataset(datasetId);
    if (!dataset) {
      throw new Error(`Benchmark dataset ${datasetId} not found`);
    }

    const allCustomerMetrics = await this.getAllCustomerMetrics();
    const topPerformers: TopPerformer[] = [];

    const metricsToCheck = metricId
      ? dataset.metrics.filter(m => m.metricId === metricId)
      : dataset.metrics;

    for (const benchmarkMetric of metricsToCheck) {
      const info = METRIC_INFO[benchmarkMetric.metricId];
      if (!info) continue;

      const customerValues = allCustomerMetrics
        .filter(c => c.metrics[benchmarkMetric.metricId] !== undefined)
        .map(c => ({
          customer: c,
          value: c.metrics[benchmarkMetric.metricId],
          percentile: this.calculatePercentile(
            c.metrics[benchmarkMetric.metricId],
            benchmarkMetric,
            info.higherIsBetter
          ),
        }))
        .filter(cv => cv.percentile >= 90)
        .sort((a, b) => b.percentile - a.percentile);

      customerValues.slice(0, 3).forEach(cv => {
        topPerformers.push({
          customerId: cv.customer.customerId,
          customerName: cv.customer.customerName,
          metricId: benchmarkMetric.metricId,
          metricName: info.name,
          value: cv.value,
          percentile: cv.percentile,
          bestPractice: BEST_PRACTICES[benchmarkMetric.metricId]?.[0] || null,
        });
      });
    }

    return topPerformers
      .sort((a, b) => b.percentile - a.percentile)
      .slice(0, limit);
  }

  /**
   * Generate customer-facing benchmark report
   */
  async generateCustomerReport(
    customerId: string,
    datasetId: string,
    preparedBy: string
  ): Promise<CustomerBenchmarkReport> {
    const comparison = await this.compareCustomer(customerId, datasetId);
    if (!comparison) {
      throw new Error('Failed to generate comparison');
    }

    const customerMetrics = await this.getCustomerMetrics(customerId);
    if (!customerMetrics) {
      throw new Error('Customer not found');
    }

    // Get peer group info
    const customers = await peerGrouper.fetchCustomersForGrouping();
    const peerGroups = await peerGrouper.createPeerGroups(customers, { dimension: 'segment' });
    const customerPeerGroup = peerGroups.find(pg =>
      pg.customerIds.includes(customerId)
    );

    const peersInGroup = customerPeerGroup?.customerIds || [];
    const peerRankings: { customerId: string; percentile: number }[] = [];

    for (const peerId of peersInGroup) {
      const peerComparison = await this.compareCustomer(peerId, datasetId);
      if (peerComparison) {
        peerRankings.push({
          customerId: peerId,
          percentile: peerComparison.overallPercentile,
        });
      }
    }

    peerRankings.sort((a, b) => b.percentile - a.percentile);
    const rank = peerRankings.findIndex(p => p.customerId === customerId) + 1;

    return {
      customer: {
        id: customerId,
        name: comparison.customerName,
        arr: comparison.arr,
        segment: comparison.segment,
        industry: customerMetrics.industry || null,
      },
      peerGroup: comparison.peerGroup,
      preparedBy,
      preparedDate: new Date().toISOString(),
      overallPercentile: comparison.overallPercentile,
      metrics: comparison.metrics,
      strengths: comparison.strengths.slice(0, 3).map(s => ({
        metric: s.metricName,
        value: s.customerValue,
        percentile: s.percentile,
        description: `Your ${s.metricName} is in the ${this.ordinal(s.percentile)} percentile among peers.`,
      })),
      opportunities: comparison.gaps.slice(0, 3).map(g => ({
        metric: g.metricName,
        currentValue: g.customerValue,
        targetValue: g.benchmarkValue,
        gap: g.gap,
        recommendation: comparison.recommendations.find(r => r.metricId === g.metricId)?.action ||
          `Improve ${g.metricName} to reach benchmark levels.`,
      })),
      peerComparison: {
        rank,
        total: peersInGroup.length,
        position: `${this.ordinal(comparison.overallPercentile)} percentile`,
      },
      nextSteps: [
        'Schedule a feature deep dive session',
        'Review underutilized features for quick wins',
        'Set quarterly benchmark review cadence',
      ],
    };
  }

  /**
   * Calculate metric comparisons between customer and benchmark
   */
  private calculateMetricComparisons(
    customerMetrics: Record<string, number>,
    benchmarkMetrics: BenchmarkValue[]
  ): MetricComparison[] {
    const comparisons: MetricComparison[] = [];

    for (const bm of benchmarkMetrics) {
      const info = METRIC_INFO[bm.metricId];
      if (!info) continue;

      const customerValue = customerMetrics[bm.metricId];
      if (customerValue === undefined) continue;

      const percentile = this.calculatePercentile(customerValue, bm, info.higherIsBetter);
      const gap = info.higherIsBetter
        ? bm.p50 - customerValue
        : customerValue - bm.p50;

      comparisons.push({
        metricId: bm.metricId,
        metricName: info.name,
        category: info.category,
        customerValue,
        benchmarkValue: bm.p50,
        percentile,
        status: this.getPerformanceStatus(percentile),
        gap: Math.round(gap * 100) / 100,
        unit: info.unit,
      });
    }

    return comparisons;
  }

  /**
   * Calculate percentile for a value against benchmark distribution
   */
  private calculatePercentile(
    value: number,
    benchmark: BenchmarkValue,
    higherIsBetter: boolean
  ): number {
    const { p10, p25, p50, p75, p90 } = benchmark;

    // Create percentile points
    const points = higherIsBetter
      ? [
          { percentile: 10, value: p10 },
          { percentile: 25, value: p25 },
          { percentile: 50, value: p50 },
          { percentile: 75, value: p75 },
          { percentile: 90, value: p90 },
        ]
      : [
          { percentile: 90, value: p10 },
          { percentile: 75, value: p25 },
          { percentile: 50, value: p50 },
          { percentile: 25, value: p75 },
          { percentile: 10, value: p90 },
        ];

    // Sort by value for interpolation
    points.sort((a, b) => a.value - b.value);

    // Find where value falls
    if (value <= points[0].value) {
      return Math.max(5, points[0].percentile - 5);
    }
    if (value >= points[points.length - 1].value) {
      return Math.min(95, points[points.length - 1].percentile + 5);
    }

    // Linear interpolation between points
    for (let i = 0; i < points.length - 1; i++) {
      if (value >= points[i].value && value <= points[i + 1].value) {
        const ratio = (value - points[i].value) / (points[i + 1].value - points[i].value);
        return Math.round(points[i].percentile + ratio * (points[i + 1].percentile - points[i].percentile));
      }
    }

    return 50; // Fallback
  }

  /**
   * Get performance status from percentile
   */
  private getPerformanceStatus(percentile: number): PerformanceStatus {
    if (percentile >= 60) return 'above';
    if (percentile >= 40) return 'at';
    return 'below';
  }

  /**
   * Determine peer group name from ARR
   */
  private determinePeerGroup(arr: number): string {
    if (arr >= 100000) return 'Enterprise (>$100K ARR)';
    if (arr >= 25000) return 'Mid-Market ($25K-$100K ARR)';
    return 'SMB (<$25K ARR)';
  }

  /**
   * Generate recommendations for gaps
   */
  private async generateRecommendations(
    gaps: MetricComparison[],
    customerMetrics: CustomerMetrics,
    datasetId: string
  ): Promise<BenchmarkRecommendation[]> {
    const recommendations: BenchmarkRecommendation[] = [];
    const topPerformers = await this.getTopPerformers(datasetId);

    for (const gap of gaps.slice(0, 5)) {
      const bestPractices = BEST_PRACTICES[gap.metricId] || [];
      const exemplar = topPerformers.find(tp => tp.metricId === gap.metricId);

      // Determine timeline based on gap size
      let timeline = '60 days';
      if (Math.abs(gap.gap) > 0.3) timeline = '90 days';
      if (Math.abs(gap.gap) > 0.5) timeline = '120 days';

      // Determine priority
      let priority: 'high' | 'medium' | 'low' = 'medium';
      if (gap.percentile < 25) priority = 'high';
      else if (gap.percentile < 40) priority = 'medium';
      else priority = 'low';

      recommendations.push({
        metricId: gap.metricId,
        metricName: gap.metricName,
        currentValue: gap.customerValue,
        targetValue: gap.benchmarkValue,
        gap: gap.gap,
        priority,
        action: this.generateActionText(gap),
        timeline,
        bestPractice: bestPractices[0],
        exemplarCustomer: exemplar
          ? {
              id: exemplar.customerId,
              name: exemplar.customerName,
              value: exemplar.value,
              percentile: exemplar.percentile,
            }
          : undefined,
      });
    }

    return recommendations.sort((a, b) => {
      const priorityOrder = { high: 0, medium: 1, low: 2 };
      return priorityOrder[a.priority] - priorityOrder[b.priority];
    });
  }

  /**
   * Generate action text for recommendation
   */
  private generateActionText(gap: MetricComparison): string {
    const actions: Record<string, string> = {
      feature_adoption: 'Implement training program and feature discovery workflows',
      nps_score: 'Increase proactive engagement and address satisfaction drivers',
      time_to_value: 'Accelerate onboarding with guided quick wins',
      dau_mau_ratio: 'Boost daily engagement with personalized triggers',
      expansion_rate: 'Identify and pursue expansion opportunities',
      tickets_per_user: 'Reduce support burden through self-service improvements',
      health_score: 'Address health score components with targeted interventions',
      csat: 'Improve customer satisfaction through proactive support',
      session_length: 'Increase feature depth and workflow integration',
      self_service_rate: 'Enhance documentation and in-app guidance',
    };

    return actions[gap.metricId] || `Improve ${gap.metricName} to reach benchmark levels`;
  }

  /**
   * Extract best practices from top performers
   */
  private extractBestPractices(topPerformers: TopPerformer[]): BestPractice[] {
    const bestPractices: BestPractice[] = [];
    const seenMetrics = new Set<string>();

    for (const performer of topPerformers) {
      if (seenMetrics.has(performer.metricId)) continue;
      seenMetrics.add(performer.metricId);

      const practices = BEST_PRACTICES[performer.metricId];
      if (!practices || practices.length === 0) continue;

      bestPractices.push({
        metricId: performer.metricId,
        metricName: performer.metricName,
        customerId: performer.customerId,
        customerName: performer.customerName,
        value: performer.value,
        percentile: performer.percentile,
        description: performer.bestPractice || practices[0],
        keySuccessFactors: practices.slice(0, 4),
      });
    }

    return bestPractices;
  }

  /**
   * Convert number to ordinal string
   */
  private ordinal(n: number): string {
    const s = ['th', 'st', 'nd', 'rd'];
    const v = n % 100;
    return n + (s[(v - 20) % 10] || s[v] || s[0]);
  }

  /**
   * Get customer metrics from database or mock
   */
  async getCustomerMetrics(customerId: string): Promise<CustomerMetrics | null> {
    if (supabase) {
      const { data: customer, error } = await supabase
        .from('customers')
        .select('*')
        .eq('id', customerId)
        .single();

      if (error || !customer) return null;

      // Get usage metrics if available
      const { data: usageMetrics } = await supabase
        .from('usage_metrics')
        .select('*')
        .eq('customer_id', customerId)
        .order('calculated_at', { ascending: false })
        .limit(1);

      const usage = usageMetrics?.[0];

      return {
        customerId: customer.id,
        customerName: customer.name,
        arr: customer.arr || 0,
        segment: customer.segment || 'Unknown',
        industry: customer.industry,
        metrics: {
          health_score: customer.health_score || 70,
          dau_mau_ratio: usage?.dau && usage?.mau ? usage.dau / usage.mau : 0.35,
          feature_adoption: (usage?.unique_features_used || 5) / 10,
          nps_score: customer.nps_score || 35,
          time_to_value: 35,
          expansion_rate: 0.15,
          tickets_per_user: 0.6,
          csat: 0.78,
          session_length: 12,
          self_service_rate: 0.48,
        },
      };
    }

    // Return mock data
    return this.getMockCustomerMetrics(customerId);
  }

  /**
   * Get all customer metrics
   */
  async getAllCustomerMetrics(): Promise<CustomerMetrics[]> {
    if (supabase) {
      const { data: customers, error } = await supabase
        .from('customers')
        .select('*');

      if (error || !customers) return [];

      const metrics: CustomerMetrics[] = [];
      for (const customer of customers) {
        const m = await this.getCustomerMetrics(customer.id);
        if (m) metrics.push(m);
      }
      return metrics;
    }

    return this.getAllMockCustomerMetrics();
  }

  /**
   * Get mock customer metrics for development
   */
  getMockCustomerMetrics(customerId: string): CustomerMetrics | null {
    const mockCustomers = this.getAllMockCustomerMetrics();
    return mockCustomers.find(c => c.customerId === customerId) || null;
  }

  /**
   * Get all mock customer metrics
   */
  getAllMockCustomerMetrics(): CustomerMetrics[] {
    return [
      {
        customerId: '1',
        customerName: 'TechCorp',
        arr: 180000,
        segment: 'Enterprise',
        industry: 'Technology',
        metrics: {
          dau_mau_ratio: 0.68,
          feature_adoption: 0.92,
          nps_score: 72,
          time_to_value: 18,
          expansion_rate: 0.38,
          tickets_per_user: 0.2,
          health_score: 92,
          csat: 0.94,
          session_length: 32,
          self_service_rate: 0.78,
        },
      },
      {
        customerId: '2',
        customerName: 'DataPro',
        arr: 145000,
        segment: 'Enterprise',
        industry: 'Data',
        metrics: {
          dau_mau_ratio: 0.55,
          feature_adoption: 0.78,
          nps_score: 58,
          time_to_value: 25,
          expansion_rate: 0.28,
          tickets_per_user: 0.35,
          health_score: 85,
          csat: 0.88,
          session_length: 28,
          self_service_rate: 0.65,
        },
      },
      {
        customerId: '3',
        customerName: 'CloudMax',
        arr: 210000,
        segment: 'Enterprise',
        industry: 'Cloud',
        metrics: {
          dau_mau_ratio: 0.48,
          feature_adoption: 0.72,
          nps_score: 65,
          time_to_value: 28,
          expansion_rate: 0.22,
          tickets_per_user: 0.28,
          health_score: 82,
          csat: 0.92,
          session_length: 25,
          self_service_rate: 0.72,
        },
      },
      {
        customerId: '4',
        customerName: 'OldCorp',
        arr: 125000,
        segment: 'Enterprise',
        industry: 'Manufacturing',
        metrics: {
          dau_mau_ratio: 0.22,
          feature_adoption: 0.28,
          nps_score: 8,
          time_to_value: 85,
          expansion_rate: 0.05,
          tickets_per_user: 1.2,
          health_score: 35,
          csat: 0.58,
          session_length: 8,
          self_service_rate: 0.25,
        },
      },
      {
        customerId: '5',
        customerName: 'Acme Corp',
        arr: 65000,
        segment: 'Mid-Market',
        industry: 'SaaS',
        metrics: {
          dau_mau_ratio: 0.42,
          feature_adoption: 0.65,
          nps_score: 38,
          time_to_value: 42,
          expansion_rate: 0.15,
          tickets_per_user: 0.7,
          health_score: 72,
          csat: 0.80,
          session_length: 18,
          self_service_rate: 0.55,
        },
      },
      {
        customerId: '6',
        customerName: 'BetaInc',
        arr: 55000,
        segment: 'Mid-Market',
        industry: 'FinTech',
        metrics: {
          dau_mau_ratio: 0.38,
          feature_adoption: 0.58,
          nps_score: 45,
          time_to_value: 35,
          expansion_rate: 0.18,
          tickets_per_user: 0.55,
          health_score: 78,
          csat: 0.82,
          session_length: 20,
          self_service_rate: 0.60,
        },
      },
      {
        customerId: '7',
        customerName: 'GrowthCo',
        arr: 48000,
        segment: 'Mid-Market',
        industry: 'E-commerce',
        metrics: {
          dau_mau_ratio: 0.45,
          feature_adoption: 0.62,
          nps_score: 52,
          time_to_value: 28,
          expansion_rate: 0.32,
          tickets_per_user: 0.65,
          health_score: 81,
          csat: 0.85,
          session_length: 22,
          self_service_rate: 0.58,
        },
      },
      {
        customerId: '8',
        customerName: 'LegacyCo',
        arr: 72000,
        segment: 'Mid-Market',
        industry: 'Retail',
        metrics: {
          dau_mau_ratio: 0.18,
          feature_adoption: 0.35,
          nps_score: -12,
          time_to_value: 90,
          expansion_rate: 0.02,
          tickets_per_user: 1.5,
          health_score: 32,
          csat: 0.52,
          session_length: 6,
          self_service_rate: 0.20,
        },
      },
      {
        customerId: '9',
        customerName: 'SmallBiz',
        arr: 18000,
        segment: 'SMB',
        industry: 'Services',
        metrics: {
          dau_mau_ratio: 0.25,
          feature_adoption: 0.42,
          nps_score: 15,
          time_to_value: 55,
          expansion_rate: 0.08,
          tickets_per_user: 0.9,
          health_score: 45,
          csat: 0.68,
          session_length: 12,
          self_service_rate: 0.40,
        },
      },
      {
        customerId: '10',
        customerName: 'StartupXYZ',
        arr: 22000,
        segment: 'SMB',
        industry: 'Tech',
        metrics: {
          dau_mau_ratio: 0.15,
          feature_adoption: 0.48,
          nps_score: 28,
          time_to_value: 40,
          expansion_rate: 0.12,
          tickets_per_user: 0.75,
          health_score: 68,
          csat: 0.75,
          session_length: 15,
          self_service_rate: 0.48,
        },
      },
    ];
  }
}

// Singleton instance
export const benchmarkComparator = new BenchmarkComparatorService();
export default benchmarkComparator;
