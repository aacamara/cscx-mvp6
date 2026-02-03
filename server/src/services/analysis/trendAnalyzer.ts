/**
 * Trend Analyzer Service
 * PRD-022: Historical Data Upload - Trend Analysis
 *
 * Performs trend detection on historical time-series data:
 * - Overall trend direction (growth, decline, stable)
 * - Compound Annual Growth Rate (CAGR) calculation
 * - Trend velocity and acceleration
 * - Inflection point detection
 * - Customer segmentation by trend type
 */

import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { config } from '../../config/index.js';

// Types
export interface TrendDataPoint {
  date: string;
  value: number;
}

export interface TrendResult {
  direction: 'up' | 'down' | 'stable';
  strength: 'strong' | 'moderate' | 'weak';
  cagr: number;               // Compound Annual Growth Rate (%)
  velocity: number;           // Rate of change per period
  acceleration: number;       // Change in velocity
  rSquared: number;           // Goodness of fit
  startValue: number;
  endValue: number;
  change: number;
  changePercent: number;
}

export interface InflectionPoint {
  date: string;
  metric: string;
  previousValue: number;
  newValue: number;
  changePercent: number;
  direction: 'up' | 'down';
  significance: 'high' | 'medium' | 'low';
  possibleCause?: string;
}

export interface CustomerTrendSegment {
  customerId: string;
  customerName: string;
  segment: 'high_growth' | 'steady_growth' | 'stable' | 'declining' | 'at_risk';
  arrCagr: number;
  healthCagr?: number;
  growthDriver?: string;
  declineDriver?: string;
}

export interface SegmentSummary {
  segment: 'high_growth' | 'steady_growth' | 'stable' | 'declining' | 'at_risk';
  label: string;
  customerCount: number;
  totalArr: number;
  arrPercent: number;
  avgCagr: number;
  characteristics: string[];
}

class TrendAnalyzerService {
  private supabase: SupabaseClient | null = null;

  constructor() {
    if (config.supabaseUrl && config.supabaseServiceKey) {
      this.supabase = createClient(config.supabaseUrl, config.supabaseServiceKey);
    }
  }

  /**
   * Analyze trend from time series data
   */
  analyzeTrend(data: TrendDataPoint[], periodType: 'monthly' | 'quarterly' | 'annual' = 'monthly'): TrendResult {
    if (data.length < 2) {
      return this.getDefaultTrendResult();
    }

    // Sort by date
    const sorted = [...data].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

    const startValue = sorted[0].value;
    const endValue = sorted[sorted.length - 1].value;
    const change = endValue - startValue;
    const changePercent = startValue !== 0 ? ((endValue - startValue) / startValue) * 100 : 0;

    // Calculate CAGR
    const years = this.calculateYears(sorted[0].date, sorted[sorted.length - 1].date);
    const cagr = this.calculateCAGR(startValue, endValue, years);

    // Linear regression for trend analysis
    const regression = this.linearRegression(sorted);

    // Calculate velocity (slope normalized to period)
    const velocity = regression.slope;

    // Calculate acceleration (change in velocity)
    const acceleration = this.calculateAcceleration(sorted);

    // Determine direction and strength
    const direction = this.determineDirection(cagr);
    const strength = this.determineStrength(Math.abs(cagr), regression.rSquared);

    return {
      direction,
      strength,
      cagr,
      velocity,
      acceleration,
      rSquared: regression.rSquared,
      startValue,
      endValue,
      change,
      changePercent
    };
  }

  /**
   * Calculate Compound Annual Growth Rate
   */
  calculateCAGR(startValue: number, endValue: number, years: number): number {
    if (startValue <= 0 || years <= 0) return 0;
    if (endValue <= 0) return -100; // Complete decline

    const cagr = (Math.pow(endValue / startValue, 1 / years) - 1) * 100;
    return Math.round(cagr * 10) / 10; // Round to 1 decimal
  }

  /**
   * Calculate years between two dates
   */
  private calculateYears(startDate: string, endDate: string): number {
    const start = new Date(startDate);
    const end = new Date(endDate);
    const diffMs = end.getTime() - start.getTime();
    const years = diffMs / (1000 * 60 * 60 * 24 * 365.25);
    return Math.max(years, 0.0833); // Minimum 1 month
  }

  /**
   * Perform linear regression on time series
   */
  private linearRegression(data: TrendDataPoint[]): { slope: number; intercept: number; rSquared: number } {
    const n = data.length;
    if (n < 2) return { slope: 0, intercept: 0, rSquared: 0 };

    // Convert dates to numeric x values (days from start)
    const startDate = new Date(data[0].date).getTime();
    const points = data.map(d => ({
      x: (new Date(d.date).getTime() - startDate) / (1000 * 60 * 60 * 24),
      y: d.value
    }));

    // Calculate means
    const sumX = points.reduce((sum, p) => sum + p.x, 0);
    const sumY = points.reduce((sum, p) => sum + p.y, 0);
    const meanX = sumX / n;
    const meanY = sumY / n;

    // Calculate slope and intercept
    let numerator = 0;
    let denominator = 0;
    let ssTotal = 0;
    let ssResidual = 0;

    points.forEach(p => {
      numerator += (p.x - meanX) * (p.y - meanY);
      denominator += (p.x - meanX) * (p.x - meanX);
    });

    const slope = denominator !== 0 ? numerator / denominator : 0;
    const intercept = meanY - slope * meanX;

    // Calculate R-squared
    points.forEach(p => {
      const predicted = slope * p.x + intercept;
      ssResidual += Math.pow(p.y - predicted, 2);
      ssTotal += Math.pow(p.y - meanY, 2);
    });

    const rSquared = ssTotal !== 0 ? 1 - (ssResidual / ssTotal) : 0;

    return {
      slope,
      intercept,
      rSquared: Math.max(0, Math.min(1, rSquared))
    };
  }

  /**
   * Calculate acceleration (change in velocity)
   */
  private calculateAcceleration(data: TrendDataPoint[]): number {
    if (data.length < 4) return 0;

    // Split into first half and second half
    const mid = Math.floor(data.length / 2);
    const firstHalf = data.slice(0, mid);
    const secondHalf = data.slice(mid);

    const firstRegression = this.linearRegression(firstHalf);
    const secondRegression = this.linearRegression(secondHalf);

    return secondRegression.slope - firstRegression.slope;
  }

  /**
   * Determine trend direction based on CAGR
   */
  private determineDirection(cagr: number): 'up' | 'down' | 'stable' {
    if (cagr > 5) return 'up';
    if (cagr < -5) return 'down';
    return 'stable';
  }

  /**
   * Determine trend strength
   */
  private determineStrength(absCagr: number, rSquared: number): 'strong' | 'moderate' | 'weak' {
    // Combine magnitude and consistency
    const magnitudeScore = absCagr > 30 ? 3 : absCagr > 15 ? 2 : 1;
    const consistencyScore = rSquared > 0.8 ? 3 : rSquared > 0.5 ? 2 : 1;
    const combinedScore = (magnitudeScore + consistencyScore) / 2;

    if (combinedScore >= 2.5) return 'strong';
    if (combinedScore >= 1.5) return 'moderate';
    return 'weak';
  }

  /**
   * Detect inflection points in time series
   */
  detectInflectionPoints(
    data: TrendDataPoint[],
    metric: string,
    threshold: number = 15
  ): InflectionPoint[] {
    if (data.length < 3) return [];

    const sorted = [...data].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
    const inflectionPoints: InflectionPoint[] = [];

    // Use a sliding window to detect significant changes
    const windowSize = Math.min(3, Math.floor(data.length / 4));

    for (let i = windowSize; i < sorted.length - windowSize; i++) {
      // Calculate average before and after this point
      let sumBefore = 0;
      let sumAfter = 0;

      for (let j = 0; j < windowSize; j++) {
        sumBefore += sorted[i - 1 - j].value;
        sumAfter += sorted[i + 1 + j].value;
      }

      const avgBefore = sumBefore / windowSize;
      const avgAfter = sumAfter / windowSize;
      const changePercent = avgBefore !== 0 ? ((avgAfter - avgBefore) / avgBefore) * 100 : 0;

      if (Math.abs(changePercent) >= threshold) {
        const significance = this.determineInflectionSignificance(Math.abs(changePercent));

        inflectionPoints.push({
          date: sorted[i].date,
          metric,
          previousValue: avgBefore,
          newValue: avgAfter,
          changePercent: Math.round(changePercent * 10) / 10,
          direction: changePercent > 0 ? 'up' : 'down',
          significance
        });
      }
    }

    // Deduplicate close inflection points (keep the most significant)
    return this.deduplicateInflectionPoints(inflectionPoints);
  }

  /**
   * Determine significance of inflection point
   */
  private determineInflectionSignificance(absChangePercent: number): 'high' | 'medium' | 'low' {
    if (absChangePercent >= 30) return 'high';
    if (absChangePercent >= 20) return 'medium';
    return 'low';
  }

  /**
   * Remove duplicate inflection points that are too close
   */
  private deduplicateInflectionPoints(points: InflectionPoint[]): InflectionPoint[] {
    if (points.length <= 1) return points;

    const sorted = [...points].sort((a, b) =>
      new Date(a.date).getTime() - new Date(b.date).getTime()
    );

    const result: InflectionPoint[] = [sorted[0]];
    const minGapDays = 30; // Minimum 30 days between inflection points

    for (let i = 1; i < sorted.length; i++) {
      const current = sorted[i];
      const last = result[result.length - 1];
      const gapDays = (new Date(current.date).getTime() - new Date(last.date).getTime()) / (1000 * 60 * 60 * 24);

      if (gapDays >= minGapDays) {
        result.push(current);
      } else {
        // Keep the more significant one
        if (Math.abs(current.changePercent) > Math.abs(last.changePercent)) {
          result[result.length - 1] = current;
        }
      }
    }

    return result;
  }

  /**
   * Segment customers by their growth trajectory
   */
  segmentCustomersByTrend(
    customers: Array<{
      customerId: string;
      customerName: string;
      arrData: TrendDataPoint[];
      healthData?: TrendDataPoint[];
    }>
  ): { segments: CustomerTrendSegment[]; summary: SegmentSummary[] } {
    const segments: CustomerTrendSegment[] = [];

    for (const customer of customers) {
      const arrTrend = this.analyzeTrend(customer.arrData);
      const healthTrend = customer.healthData ? this.analyzeTrend(customer.healthData) : null;

      const segment = this.determineSegment(arrTrend.cagr, arrTrend.acceleration);
      const drivers = this.identifyDrivers(arrTrend, healthTrend);

      segments.push({
        customerId: customer.customerId,
        customerName: customer.customerName,
        segment,
        arrCagr: arrTrend.cagr,
        healthCagr: healthTrend?.cagr,
        growthDriver: drivers.growth,
        declineDriver: drivers.decline
      });
    }

    // Calculate summary statistics per segment
    const summary = this.calculateSegmentSummary(segments, customers);

    return { segments, summary };
  }

  /**
   * Determine customer segment based on CAGR and acceleration
   */
  private determineSegment(
    cagr: number,
    acceleration: number
  ): 'high_growth' | 'steady_growth' | 'stable' | 'declining' | 'at_risk' {
    // At-risk: steep decline or accelerating decline
    if (cagr < -30 || (cagr < -10 && acceleration < -0.1)) {
      return 'at_risk';
    }

    // Declining: negative growth
    if (cagr < -10) return 'declining';

    // High growth: > 30% CAGR
    if (cagr > 30) return 'high_growth';

    // Steady growth: 10-30% CAGR
    if (cagr > 10) return 'steady_growth';

    // Stable: -10% to +10%
    return 'stable';
  }

  /**
   * Identify growth and decline drivers
   */
  private identifyDrivers(
    arrTrend: TrendResult,
    healthTrend: TrendResult | null
  ): { growth?: string; decline?: string } {
    const result: { growth?: string; decline?: string } = {};

    if (arrTrend.direction === 'up') {
      if (arrTrend.cagr > 50) {
        result.growth = 'Product expansion';
      } else if (arrTrend.cagr > 30) {
        result.growth = 'Seat growth';
      } else if (healthTrend && healthTrend.direction === 'up') {
        result.growth = 'Strong engagement';
      } else {
        result.growth = 'Feature upsells';
      }
    }

    if (arrTrend.direction === 'down') {
      if (healthTrend && healthTrend.cagr < -20) {
        result.decline = 'Usage declining';
      } else if (arrTrend.cagr < -20) {
        result.decline = 'Champion left';
      } else {
        result.decline = 'No executive engagement';
      }
    }

    return result;
  }

  /**
   * Calculate summary statistics for each segment
   */
  private calculateSegmentSummary(
    segments: CustomerTrendSegment[],
    customers: Array<{
      customerId: string;
      arrData: TrendDataPoint[];
    }>
  ): SegmentSummary[] {
    const segmentNames: Array<'high_growth' | 'steady_growth' | 'stable' | 'declining' | 'at_risk'> = [
      'high_growth', 'steady_growth', 'stable', 'declining', 'at_risk'
    ];

    const segmentLabels: Record<string, string> = {
      high_growth: 'High Growth',
      steady_growth: 'Steady Growth',
      stable: 'Stable',
      declining: 'Declining',
      at_risk: 'At Risk'
    };

    const segmentCharacteristics: Record<string, string[]> = {
      high_growth: ['CAGR > 30%', 'Product expansion', 'Executive engagement'],
      steady_growth: ['CAGR 10-30%', 'Consistent growth', 'Multi-product adoption'],
      stable: ['CAGR -10% to +10%', 'Steady usage', 'Renewal expected'],
      declining: ['CAGR -10% to -30%', 'Usage trending down', 'Intervention needed'],
      at_risk: ['CAGR < -30%', 'Accelerating decline', 'Immediate action required']
    };

    // Calculate total ARR
    let totalArr = 0;
    const customerArrMap = new Map<string, number>();

    for (const customer of customers) {
      const lastArr = customer.arrData[customer.arrData.length - 1]?.value || 0;
      customerArrMap.set(customer.customerId, lastArr);
      totalArr += lastArr;
    }

    return segmentNames.map(segmentName => {
      const segmentCustomers = segments.filter(s => s.segment === segmentName);
      const segmentArr = segmentCustomers.reduce(
        (sum, c) => sum + (customerArrMap.get(c.customerId) || 0),
        0
      );
      const avgCagr = segmentCustomers.length > 0
        ? segmentCustomers.reduce((sum, c) => sum + c.arrCagr, 0) / segmentCustomers.length
        : 0;

      return {
        segment: segmentName,
        label: segmentLabels[segmentName],
        customerCount: segmentCustomers.length,
        totalArr: segmentArr,
        arrPercent: totalArr > 0 ? Math.round((segmentArr / totalArr) * 100) : 0,
        avgCagr: Math.round(avgCagr * 10) / 10,
        characteristics: segmentCharacteristics[segmentName]
      };
    });
  }

  /**
   * Get default trend result for insufficient data
   */
  private getDefaultTrendResult(): TrendResult {
    return {
      direction: 'stable',
      strength: 'weak',
      cagr: 0,
      velocity: 0,
      acceleration: 0,
      rSquared: 0,
      startValue: 0,
      endValue: 0,
      change: 0,
      changePercent: 0
    };
  }

  /**
   * Calculate portfolio-level trends
   */
  calculatePortfolioTrends(
    customers: Array<{
      customerId: string;
      arrData: TrendDataPoint[];
      healthData?: TrendDataPoint[];
      npsData?: TrendDataPoint[];
    }>
  ): Array<{
    metric: string;
    startDate: string;
    startValue: number;
    endDate: string;
    endValue: number;
    cagr: number;
    direction: 'up' | 'down' | 'stable';
    strength: string;
  }> {
    const metrics: Array<{
      name: string;
      getData: (c: typeof customers[0]) => TrendDataPoint[] | undefined;
      aggregate: (points: TrendDataPoint[]) => TrendDataPoint[];
    }> = [
      {
        name: 'Total ARR',
        getData: (c) => c.arrData,
        aggregate: (points) => this.aggregateByDate(points, 'sum')
      },
      {
        name: 'Avg Health Score',
        getData: (c) => c.healthData,
        aggregate: (points) => this.aggregateByDate(points, 'avg')
      },
      {
        name: 'Avg NPS',
        getData: (c) => c.npsData,
        aggregate: (points) => this.aggregateByDate(points, 'avg')
      },
      {
        name: 'Customer Count',
        getData: (c) => c.arrData,
        aggregate: (points) => this.aggregateByDate(points, 'count')
      }
    ];

    const results: Array<{
      metric: string;
      startDate: string;
      startValue: number;
      endDate: string;
      endValue: number;
      cagr: number;
      direction: 'up' | 'down' | 'stable';
      strength: string;
    }> = [];

    for (const metric of metrics) {
      const allPoints: TrendDataPoint[] = [];

      for (const customer of customers) {
        const data = metric.getData(customer);
        if (data) {
          allPoints.push(...data);
        }
      }

      if (allPoints.length === 0) continue;

      const aggregated = metric.aggregate(allPoints);
      const trend = this.analyzeTrend(aggregated);

      if (aggregated.length >= 2) {
        const sorted = aggregated.sort(
          (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()
        );

        results.push({
          metric: metric.name,
          startDate: sorted[0].date,
          startValue: Math.round(sorted[0].value * 100) / 100,
          endDate: sorted[sorted.length - 1].date,
          endValue: Math.round(sorted[sorted.length - 1].value * 100) / 100,
          cagr: trend.cagr,
          direction: trend.direction,
          strength: trend.strength === 'strong' ? 'Strong' :
                    trend.strength === 'moderate' ? 'Moderate' : 'Weak'
        });
      }
    }

    return results;
  }

  /**
   * Aggregate data points by date
   */
  private aggregateByDate(
    points: TrendDataPoint[],
    method: 'sum' | 'avg' | 'count'
  ): TrendDataPoint[] {
    const grouped = new Map<string, number[]>();

    for (const point of points) {
      // Normalize to month
      const monthKey = point.date.slice(0, 7); // YYYY-MM
      if (!grouped.has(monthKey)) {
        grouped.set(monthKey, []);
      }
      grouped.get(monthKey)!.push(point.value);
    }

    const result: TrendDataPoint[] = [];

    grouped.forEach((values, date) => {
      let value: number;
      switch (method) {
        case 'sum':
          value = values.reduce((a, b) => a + b, 0);
          break;
        case 'avg':
          value = values.reduce((a, b) => a + b, 0) / values.length;
          break;
        case 'count':
          value = values.length;
          break;
      }

      result.push({ date: `${date}-01`, value });
    });

    return result.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
  }

  /**
   * Save analysis to database
   */
  async saveAnalysis(uploadId: string, analysis: any): Promise<void> {
    if (!this.supabase) return;

    const { error } = await this.supabase
      .from('historical_trend_analyses')
      .upsert({
        upload_id: uploadId,
        analysis_data: analysis,
        analyzed_at: new Date().toISOString()
      });

    if (error) {
      console.error('[TrendAnalyzer] Failed to save analysis:', error);
    }
  }
}

// Singleton export
export const trendAnalyzerService = new TrendAnalyzerService();
export default trendAnalyzerService;
