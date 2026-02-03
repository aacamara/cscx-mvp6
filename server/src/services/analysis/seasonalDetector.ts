/**
 * Seasonal Pattern Detector Service
 * PRD-022: Historical Data Upload - Seasonal Analysis
 *
 * Detects seasonal patterns in historical time-series data:
 * - Quarterly patterns (Q1-Q4)
 * - Monthly patterns
 * - Annual cycles
 * - Seasonality index calculation
 * - Confidence scoring
 */

import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { config } from '../../config/index.js';

// Types
export interface TimeSeriesPoint {
  date: string;
  value: number;
}

export interface QuarterlyPattern {
  quarter: 'Q1' | 'Q2' | 'Q3' | 'Q4';
  avgValue: number;
  indexValue: number;    // 100 = average, >100 = above avg
  variance: number;
  observations: number;
}

export interface MonthlyPattern {
  month: number;         // 1-12
  monthName: string;
  avgValue: number;
  indexValue: number;
  variance: number;
  observations: number;
}

export interface SeasonalPattern {
  metric: string;
  periodicity: 'quarterly' | 'monthly' | 'annual';
  strength: 'strong' | 'moderate' | 'weak' | 'none';
  peakPeriod: string;
  troughPeriod: string;
  amplitude: number;           // 0-100, measures swing
  seasonalityIndex: number[];  // Index for each period
  confidence: number;          // 0-100
  quarterlyPatterns?: QuarterlyPattern[];
  monthlyPatterns?: MonthlyPattern[];
  insights: string[];
}

export interface SeasonalAnalysisResult {
  hasSignificantSeasonality: boolean;
  primaryPattern: SeasonalPattern | null;
  allPatterns: SeasonalPattern[];
  recommendations: string[];
}

class SeasonalDetectorService {
  private supabase: SupabaseClient | null = null;
  private monthNames = [
    'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
    'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'
  ];

  constructor() {
    if (config.supabaseUrl && config.supabaseServiceKey) {
      this.supabase = createClient(config.supabaseUrl, config.supabaseServiceKey);
    }
  }

  /**
   * Detect seasonal patterns in time series data
   */
  detectSeasonality(
    data: TimeSeriesPoint[],
    metric: string
  ): SeasonalAnalysisResult {
    if (data.length < 12) {
      return {
        hasSignificantSeasonality: false,
        primaryPattern: null,
        allPatterns: [],
        recommendations: ['Insufficient data for seasonal analysis. Need at least 12 months of data.']
      };
    }

    const patterns: SeasonalPattern[] = [];

    // Analyze quarterly patterns
    const quarterlyPattern = this.analyzeQuarterlySeasonality(data, metric);
    if (quarterlyPattern) {
      patterns.push(quarterlyPattern);
    }

    // Analyze monthly patterns (requires more data)
    if (data.length >= 24) {
      const monthlyPattern = this.analyzeMonthlySeasonality(data, metric);
      if (monthlyPattern) {
        patterns.push(monthlyPattern);
      }
    }

    // Determine primary pattern
    const primaryPattern = this.determinePrimaryPattern(patterns);
    const hasSignificantSeasonality = patterns.some(
      p => p.strength !== 'none' && p.confidence >= 60
    );

    // Generate recommendations
    const recommendations = this.generateSeasonalRecommendations(patterns);

    return {
      hasSignificantSeasonality,
      primaryPattern,
      allPatterns: patterns,
      recommendations
    };
  }

  /**
   * Analyze quarterly seasonality
   */
  private analyzeQuarterlySeasonality(
    data: TimeSeriesPoint[],
    metric: string
  ): SeasonalPattern | null {
    // Group data by quarter
    const quarterlyData = new Map<string, number[]>();

    for (const point of data) {
      const date = new Date(point.date);
      const quarter = this.getQuarter(date.getMonth() + 1);

      if (!quarterlyData.has(quarter)) {
        quarterlyData.set(quarter, []);
      }
      quarterlyData.get(quarter)!.push(point.value);
    }

    // Need data for all 4 quarters
    if (quarterlyData.size < 4) {
      return null;
    }

    // Calculate quarterly statistics
    const quarterlyPatterns: QuarterlyPattern[] = [];
    let totalSum = 0;
    let totalCount = 0;

    ['Q1', 'Q2', 'Q3', 'Q4'].forEach(q => {
      const values = quarterlyData.get(q) || [];
      const sum = values.reduce((a, b) => a + b, 0);
      totalSum += sum;
      totalCount += values.length;
    });

    const overallAvg = totalCount > 0 ? totalSum / totalCount : 0;

    ['Q1', 'Q2', 'Q3', 'Q4'].forEach(q => {
      const values = quarterlyData.get(q) || [];
      const avg = values.length > 0 ? values.reduce((a, b) => a + b, 0) / values.length : 0;
      const indexValue = overallAvg > 0 ? Math.round((avg / overallAvg) * 100) : 100;
      const variance = this.calculateVariance(values, avg);

      quarterlyPatterns.push({
        quarter: q as 'Q1' | 'Q2' | 'Q3' | 'Q4',
        avgValue: Math.round(avg * 100) / 100,
        indexValue,
        variance: Math.round(variance * 100) / 100,
        observations: values.length
      });
    });

    // Determine peak and trough
    const sortedByIndex = [...quarterlyPatterns].sort((a, b) => b.indexValue - a.indexValue);
    const peakQuarter = sortedByIndex[0];
    const troughQuarter = sortedByIndex[sortedByIndex.length - 1];

    // Calculate amplitude (difference between peak and trough)
    const amplitude = peakQuarter.indexValue - troughQuarter.indexValue;

    // Calculate seasonality strength and confidence
    const strength = this.calculateStrength(amplitude);
    const confidence = this.calculateQuarterlyConfidence(quarterlyPatterns);
    const seasonalityIndex = quarterlyPatterns.map(q => q.indexValue);

    // Generate insights
    const insights = this.generateQuarterlyInsights(quarterlyPatterns, metric);

    return {
      metric,
      periodicity: 'quarterly',
      strength,
      peakPeriod: peakQuarter.quarter,
      troughPeriod: troughQuarter.quarter,
      amplitude,
      seasonalityIndex,
      confidence,
      quarterlyPatterns,
      insights
    };
  }

  /**
   * Analyze monthly seasonality
   */
  private analyzeMonthlySeasonality(
    data: TimeSeriesPoint[],
    metric: string
  ): SeasonalPattern | null {
    // Group data by month
    const monthlyData = new Map<number, number[]>();

    for (const point of data) {
      const date = new Date(point.date);
      const month = date.getMonth() + 1;

      if (!monthlyData.has(month)) {
        monthlyData.set(month, []);
      }
      monthlyData.get(month)!.push(point.value);
    }

    // Need data for at least 10 months
    if (monthlyData.size < 10) {
      return null;
    }

    // Calculate monthly statistics
    const monthlyPatterns: MonthlyPattern[] = [];
    let totalSum = 0;
    let totalCount = 0;

    for (let m = 1; m <= 12; m++) {
      const values = monthlyData.get(m) || [];
      const sum = values.reduce((a, b) => a + b, 0);
      totalSum += sum;
      totalCount += values.length;
    }

    const overallAvg = totalCount > 0 ? totalSum / totalCount : 0;

    for (let m = 1; m <= 12; m++) {
      const values = monthlyData.get(m) || [];
      const avg = values.length > 0 ? values.reduce((a, b) => a + b, 0) / values.length : 0;
      const indexValue = overallAvg > 0 ? Math.round((avg / overallAvg) * 100) : 100;
      const variance = this.calculateVariance(values, avg);

      monthlyPatterns.push({
        month: m,
        monthName: this.monthNames[m - 1],
        avgValue: Math.round(avg * 100) / 100,
        indexValue,
        variance: Math.round(variance * 100) / 100,
        observations: values.length
      });
    }

    // Determine peak and trough periods
    const sortedByIndex = [...monthlyPatterns].sort((a, b) => b.indexValue - a.indexValue);
    const peakMonths = sortedByIndex.slice(0, 2).map(m => m.monthName);
    const troughMonths = sortedByIndex.slice(-2).map(m => m.monthName);

    // Calculate amplitude
    const maxIndex = Math.max(...monthlyPatterns.map(m => m.indexValue));
    const minIndex = Math.min(...monthlyPatterns.map(m => m.indexValue));
    const amplitude = maxIndex - minIndex;

    // Calculate strength and confidence
    const strength = this.calculateStrength(amplitude);
    const confidence = this.calculateMonthlyConfidence(monthlyPatterns);
    const seasonalityIndex = monthlyPatterns.map(m => m.indexValue);

    // Generate insights
    const insights = this.generateMonthlyInsights(monthlyPatterns, metric);

    return {
      metric,
      periodicity: 'monthly',
      strength,
      peakPeriod: peakMonths.join('-'),
      troughPeriod: troughMonths.join('-'),
      amplitude,
      seasonalityIndex,
      confidence,
      monthlyPatterns,
      insights
    };
  }

  /**
   * Get quarter from month
   */
  private getQuarter(month: number): string {
    if (month <= 3) return 'Q1';
    if (month <= 6) return 'Q2';
    if (month <= 9) return 'Q3';
    return 'Q4';
  }

  /**
   * Calculate variance
   */
  private calculateVariance(values: number[], mean: number): number {
    if (values.length < 2) return 0;
    const squaredDiffs = values.map(v => Math.pow(v - mean, 2));
    return squaredDiffs.reduce((a, b) => a + b, 0) / values.length;
  }

  /**
   * Calculate seasonality strength based on amplitude
   */
  private calculateStrength(amplitude: number): 'strong' | 'moderate' | 'weak' | 'none' {
    if (amplitude >= 30) return 'strong';
    if (amplitude >= 15) return 'moderate';
    if (amplitude >= 5) return 'weak';
    return 'none';
  }

  /**
   * Calculate quarterly confidence score
   */
  private calculateQuarterlyConfidence(patterns: QuarterlyPattern[]): number {
    // Base on number of observations and consistency
    const minObs = Math.min(...patterns.map(p => p.observations));
    const avgObs = patterns.reduce((sum, p) => sum + p.observations, 0) / 4;

    // Observation confidence (0-50 points)
    let obsConfidence = Math.min(50, minObs * 10);

    // Consistency confidence (0-50 points) - lower variance = higher confidence
    const avgVariance = patterns.reduce((sum, p) => sum + p.variance, 0) / 4;
    const avgValue = patterns.reduce((sum, p) => sum + p.avgValue, 0) / 4;
    const coefficientOfVariation = avgValue > 0 ? Math.sqrt(avgVariance) / avgValue : 1;
    const consistencyConfidence = Math.max(0, Math.min(50, (1 - coefficientOfVariation) * 50));

    return Math.round(obsConfidence + consistencyConfidence);
  }

  /**
   * Calculate monthly confidence score
   */
  private calculateMonthlyConfidence(patterns: MonthlyPattern[]): number {
    const validPatterns = patterns.filter(p => p.observations > 0);
    if (validPatterns.length < 10) return 30; // Low confidence if missing months

    const minObs = Math.min(...validPatterns.map(p => p.observations));
    let obsConfidence = Math.min(40, minObs * 10);

    // Check for consistent seasonality across years
    const indexVariation = this.calculateVariance(
      patterns.map(p => p.indexValue),
      patterns.reduce((s, p) => s + p.indexValue, 0) / patterns.length
    );
    const consistencyConfidence = Math.max(0, Math.min(60, 60 - indexVariation / 10));

    return Math.round(obsConfidence + consistencyConfidence);
  }

  /**
   * Determine primary seasonal pattern
   */
  private determinePrimaryPattern(patterns: SeasonalPattern[]): SeasonalPattern | null {
    const significant = patterns.filter(p => p.strength !== 'none' && p.confidence >= 50);

    if (significant.length === 0) return null;

    // Prefer quarterly patterns as they're more actionable
    const quarterly = significant.find(p => p.periodicity === 'quarterly');
    if (quarterly && quarterly.confidence >= 60) {
      return quarterly;
    }

    // Otherwise return highest confidence
    return significant.sort((a, b) => b.confidence - a.confidence)[0];
  }

  /**
   * Generate quarterly insights
   */
  private generateQuarterlyInsights(patterns: QuarterlyPattern[], metric: string): string[] {
    const insights: string[] = [];
    const sorted = [...patterns].sort((a, b) => b.indexValue - a.indexValue);
    const peak = sorted[0];
    const trough = sorted[sorted.length - 1];

    // Peak period insight
    if (peak.indexValue > 110) {
      insights.push(`${metric} peaks in ${peak.quarter} at ${peak.indexValue - 100}% above average`);
    }

    // Trough period insight
    if (trough.indexValue < 90) {
      insights.push(`${metric} dips in ${trough.quarter} at ${100 - trough.indexValue}% below average`);
    }

    // Pattern-specific insights
    if (sorted[0].quarter === 'Q2' || sorted[0].quarter === 'Q3') {
      if (sorted[1].quarter === 'Q2' || sorted[1].quarter === 'Q3') {
        insights.push('Q2-Q3 shows strongest performance (mid-year activity)');
      }
    }

    if (trough.quarter === 'Q4') {
      insights.push('Q4 dip likely due to EOY and holidays');
    }

    if (trough.quarter === 'Q1') {
      insights.push('Q1 slowdown typical of post-holiday ramp-up period');
    }

    return insights;
  }

  /**
   * Generate monthly insights
   */
  private generateMonthlyInsights(patterns: MonthlyPattern[], metric: string): string[] {
    const insights: string[] = [];
    const sorted = [...patterns].sort((a, b) => b.indexValue - a.indexValue);
    const peaks = sorted.slice(0, 2);
    const troughs = sorted.slice(-2);

    insights.push(
      `${metric} highest in ${peaks.map(p => p.monthName).join(' and ')}`
    );

    insights.push(
      `${metric} lowest in ${troughs.map(p => p.monthName).join(' and ')}`
    );

    // December/January patterns
    const decPattern = patterns.find(p => p.month === 12);
    const janPattern = patterns.find(p => p.month === 1);
    if (decPattern && janPattern &&
        decPattern.indexValue < 95 && janPattern.indexValue < 95) {
      insights.push('Holiday season (Dec-Jan) shows reduced activity');
    }

    // Summer patterns
    const summerMonths = patterns.filter(p => p.month >= 6 && p.month <= 8);
    const avgSummerIndex = summerMonths.reduce((s, p) => s + p.indexValue, 0) / 3;
    if (avgSummerIndex < 95) {
      insights.push('Summer months (Jun-Aug) show reduced engagement');
    } else if (avgSummerIndex > 105) {
      insights.push('Summer months (Jun-Aug) show increased activity');
    }

    return insights;
  }

  /**
   * Generate seasonal recommendations
   */
  private generateSeasonalRecommendations(patterns: SeasonalPattern[]): string[] {
    const recommendations: string[] = [];

    const quarterlyPattern = patterns.find(p => p.periodicity === 'quarterly');

    if (quarterlyPattern && quarterlyPattern.strength !== 'none') {
      // Timing recommendations
      recommendations.push(
        `Schedule strategic conversations during ${quarterlyPattern.peakPeriod} when engagement is highest`
      );

      recommendations.push(
        `Plan re-engagement campaigns before ${quarterlyPattern.troughPeriod} seasonal dip`
      );

      // QBR timing
      if (quarterlyPattern.peakPeriod === 'Q2' || quarterlyPattern.peakPeriod === 'Q3') {
        recommendations.push(
          'Consider QBRs in Q2-Q3 to capitalize on higher engagement'
        );
      }

      // Renewal timing
      if (quarterlyPattern.troughPeriod === 'Q4') {
        recommendations.push(
          'Be proactive with Q4 renewals - expect slower response times due to EOY'
        );
      }
    }

    if (recommendations.length === 0) {
      recommendations.push(
        'No strong seasonal patterns detected. Focus on individual customer cycles.'
      );
    }

    return recommendations;
  }

  /**
   * Analyze seasonality for multiple metrics
   */
  analyzeMultipleMetrics(
    data: {
      metric: string;
      points: TimeSeriesPoint[];
    }[]
  ): SeasonalPattern[] {
    const patterns: SeasonalPattern[] = [];

    for (const { metric, points } of data) {
      const result = this.detectSeasonality(points, metric);
      if (result.primaryPattern) {
        patterns.push(result.primaryPattern);
      }
    }

    return patterns;
  }

  /**
   * Generate visual representation of seasonal pattern
   */
  generateSeasonalChart(pattern: SeasonalPattern): string {
    if (pattern.periodicity !== 'quarterly' || !pattern.quarterlyPatterns) {
      return '';
    }

    const bars: string[] = [];
    const maxIndex = Math.max(...pattern.quarterlyPatterns.map(q => q.indexValue));

    for (const q of pattern.quarterlyPatterns) {
      const barLength = Math.round((q.indexValue / maxIndex) * 8);
      const bar = '\u2582\u2585\u2587\u2588'.charAt(Math.min(3, Math.floor(barLength / 2)));
      bars.push(bar.repeat(barLength));
    }

    return `
       Q1    Q2    Q3    Q4
       ${bars.join('    ')}
    `;
  }
}

// Singleton export
export const seasonalDetectorService = new SeasonalDetectorService();
export default seasonalDetectorService;
