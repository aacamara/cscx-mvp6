/**
 * Forecaster Service
 * PRD-022: Historical Data Upload - Predictive Modeling
 *
 * Generates forecasts based on historical trends:
 * - Time-series projection using trend analysis
 * - Confidence scoring based on historical accuracy
 * - Portfolio-level and customer-level forecasts
 * - Risk-based action recommendations
 */

import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { config } from '../../config/index.js';
import { trendAnalyzerService, TrendDataPoint, TrendResult } from './trendAnalyzer.js';
import { seasonalDetectorService, SeasonalPattern } from './seasonalDetector.js';

// Types
export type ForecastConfidence = 'high' | 'medium' | 'low';

export interface ForecastPeriod {
  period: string;
  date: string;
  predictedValue: number;
  lowerBound: number;
  upperBound: number;
  confidence: ForecastConfidence;
}

export interface CustomerForecast {
  customerId: string;
  customerName: string;
  currentArr: number;
  forecastArr: number;
  arrChange: number;
  arrChangePercent: number;
  currentHealth: number | null;
  forecastHealth: number | null;
  confidence: ForecastConfidence;
  trajectory: 'up' | 'down' | 'stable';
  recommendedAction: 'expansion_play' | 'upsell_ready' | 'maintain' | 'save_play' | 'at_risk_intervention';
  riskFactors: string[];
  opportunities: string[];
}

export interface PortfolioForecast {
  metric: string;
  currentValue: number;
  periods: ForecastPeriod[];
  totalChange: number;
  totalChangePercent: number;
  methodology: string;
  assumptions: string[];
}

export interface ForecastSummary {
  portfolioForecasts: PortfolioForecast[];
  customerForecasts: CustomerForecast[];
  highConfidenceCount: number;
  mediumConfidenceCount: number;
  lowConfidenceCount: number;
  atRiskArr: number;
  expansionOpportunityArr: number;
}

class ForecasterService {
  private supabase: SupabaseClient | null = null;

  constructor() {
    if (config.supabaseUrl && config.supabaseServiceKey) {
      this.supabase = createClient(config.supabaseUrl, config.supabaseServiceKey);
    }
  }

  /**
   * Generate forecast for a single time series
   */
  forecastTimeSeries(
    data: TrendDataPoint[],
    periods: number = 4,
    periodType: 'monthly' | 'quarterly' | 'annual' = 'quarterly',
    seasonalPattern?: SeasonalPattern
  ): ForecastPeriod[] {
    if (data.length < 3) {
      return [];
    }

    const sorted = [...data].sort(
      (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()
    );

    // Analyze trend
    const trend = trendAnalyzerService.analyzeTrend(sorted);

    // Get last value and date
    const lastPoint = sorted[sorted.length - 1];
    const lastDate = new Date(lastPoint.date);
    const lastValue = lastPoint.value;

    // Calculate period increment in months
    const monthsPerPeriod = periodType === 'monthly' ? 1 :
                           periodType === 'quarterly' ? 3 : 12;

    // Calculate growth rate per period
    const yearsOfData = this.calculateYears(sorted[0].date, lastPoint.date);
    const periodsOfData = yearsOfData * (12 / monthsPerPeriod);
    const growthPerPeriod = periodsOfData > 0 ?
      Math.pow(1 + (trend.cagr / 100), monthsPerPeriod / 12) - 1 : 0;

    const forecasts: ForecastPeriod[] = [];
    let currentValue = lastValue;

    for (let i = 1; i <= periods; i++) {
      // Calculate forecast date
      const forecastDate = new Date(lastDate);
      forecastDate.setMonth(forecastDate.getMonth() + (i * monthsPerPeriod));

      // Apply growth rate
      let predictedValue = currentValue * (1 + growthPerPeriod);

      // Apply seasonal adjustment if available
      if (seasonalPattern && seasonalPattern.periodicity === 'quarterly') {
        const quarterIndex = Math.floor(forecastDate.getMonth() / 3);
        const seasonalIndex = seasonalPattern.seasonalityIndex[quarterIndex] || 100;
        predictedValue *= (seasonalIndex / 100);
      }

      // Calculate confidence bounds
      const { confidence, lowerBound, upperBound } = this.calculateConfidenceBounds(
        predictedValue,
        trend,
        i
      );

      forecasts.push({
        period: this.formatPeriod(forecastDate, periodType),
        date: forecastDate.toISOString().split('T')[0],
        predictedValue: Math.round(predictedValue * 100) / 100,
        lowerBound: Math.round(lowerBound * 100) / 100,
        upperBound: Math.round(upperBound * 100) / 100,
        confidence
      });

      currentValue = predictedValue;
    }

    return forecasts;
  }

  /**
   * Generate customer-level forecasts
   */
  forecastCustomers(
    customers: Array<{
      customerId: string;
      customerName: string;
      arrData: TrendDataPoint[];
      healthData?: TrendDataPoint[];
    }>,
    forecastPeriods: number = 4
  ): CustomerForecast[] {
    const forecasts: CustomerForecast[] = [];

    for (const customer of customers) {
      const forecast = this.forecastSingleCustomer(
        customer.customerId,
        customer.customerName,
        customer.arrData,
        customer.healthData,
        forecastPeriods
      );

      forecasts.push(forecast);
    }

    // Sort by recommended action priority
    const actionPriority: Record<string, number> = {
      'at_risk_intervention': 1,
      'save_play': 2,
      'expansion_play': 3,
      'upsell_ready': 4,
      'maintain': 5
    };

    return forecasts.sort(
      (a, b) => actionPriority[a.recommendedAction] - actionPriority[b.recommendedAction]
    );
  }

  /**
   * Forecast a single customer
   */
  private forecastSingleCustomer(
    customerId: string,
    customerName: string,
    arrData: TrendDataPoint[],
    healthData: TrendDataPoint[] | undefined,
    periods: number
  ): CustomerForecast {
    // Get current values
    const sortedArr = [...arrData].sort(
      (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()
    );
    const currentArr = sortedArr[sortedArr.length - 1]?.value || 0;

    let currentHealth: number | null = null;
    let forecastHealth: number | null = null;

    if (healthData && healthData.length > 0) {
      const sortedHealth = [...healthData].sort(
        (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()
      );
      currentHealth = sortedHealth[sortedHealth.length - 1]?.value || null;

      // Forecast health
      const healthForecasts = this.forecastTimeSeries(healthData, periods);
      if (healthForecasts.length > 0) {
        forecastHealth = healthForecasts[healthForecasts.length - 1].predictedValue;
      }
    }

    // Forecast ARR
    const arrForecasts = this.forecastTimeSeries(arrData, periods);
    const forecastArr = arrForecasts.length > 0 ?
      arrForecasts[arrForecasts.length - 1].predictedValue : currentArr;

    const arrChange = forecastArr - currentArr;
    const arrChangePercent = currentArr > 0 ?
      Math.round((arrChange / currentArr) * 1000) / 10 : 0;

    // Analyze trend
    const arrTrend = trendAnalyzerService.analyzeTrend(arrData);
    const healthTrend = healthData ?
      trendAnalyzerService.analyzeTrend(healthData) : null;

    // Determine trajectory
    const trajectory = arrTrend.direction;

    // Calculate confidence
    const confidence = this.determineCustomerConfidence(arrTrend, healthTrend, arrData.length);

    // Identify risks and opportunities
    const { riskFactors, opportunities } = this.identifyRisksAndOpportunities(
      arrTrend,
      healthTrend,
      currentHealth,
      arrChangePercent
    );

    // Determine recommended action
    const recommendedAction = this.determineRecommendedAction(
      trajectory,
      arrChangePercent,
      currentHealth,
      riskFactors.length
    );

    return {
      customerId,
      customerName,
      currentArr,
      forecastArr: Math.round(forecastArr * 100) / 100,
      arrChange: Math.round(arrChange * 100) / 100,
      arrChangePercent,
      currentHealth,
      forecastHealth: forecastHealth ? Math.round(forecastHealth) : null,
      confidence,
      trajectory,
      recommendedAction,
      riskFactors,
      opportunities
    };
  }

  /**
   * Generate portfolio-level forecasts
   */
  forecastPortfolio(
    customers: Array<{
      customerId: string;
      customerName: string;
      arrData: TrendDataPoint[];
      healthData?: TrendDataPoint[];
      npsData?: TrendDataPoint[];
    }>,
    forecastPeriods: number = 4
  ): PortfolioForecast[] {
    const portfolioForecasts: PortfolioForecast[] = [];

    // Aggregate metrics
    const metrics = [
      { name: 'Total ARR', getData: (c: typeof customers[0]) => c.arrData },
      { name: 'Avg Health Score', getData: (c: typeof customers[0]) => c.healthData },
      { name: 'Avg NPS', getData: (c: typeof customers[0]) => c.npsData }
    ];

    for (const metric of metrics) {
      const allPoints: TrendDataPoint[] = [];

      for (const customer of customers) {
        const data = metric.getData(customer);
        if (data) allPoints.push(...data);
      }

      if (allPoints.length < 6) continue;

      // Aggregate by month
      const aggregated = this.aggregateByMonth(
        allPoints,
        metric.name === 'Total ARR' ? 'sum' : 'avg'
      );

      // Get current value
      const sorted = aggregated.sort(
        (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()
      );
      const currentValue = sorted[sorted.length - 1]?.value || 0;

      // Generate forecasts
      const forecasts = this.forecastTimeSeries(aggregated, forecastPeriods);

      if (forecasts.length > 0) {
        const lastForecast = forecasts[forecasts.length - 1];
        const totalChange = lastForecast.predictedValue - currentValue;
        const totalChangePercent = currentValue > 0 ?
          Math.round((totalChange / currentValue) * 1000) / 10 : 0;

        portfolioForecasts.push({
          metric: metric.name,
          currentValue: Math.round(currentValue * 100) / 100,
          periods: forecasts,
          totalChange: Math.round(totalChange * 100) / 100,
          totalChangePercent,
          methodology: 'Linear trend extrapolation with CAGR adjustment',
          assumptions: [
            'Assumes current trend continues',
            'No major market disruptions',
            'Stable customer base growth rate'
          ]
        });
      }
    }

    return portfolioForecasts;
  }

  /**
   * Generate comprehensive forecast summary
   */
  generateForecastSummary(
    customers: Array<{
      customerId: string;
      customerName: string;
      arrData: TrendDataPoint[];
      healthData?: TrendDataPoint[];
      npsData?: TrendDataPoint[];
    }>,
    forecastPeriods: number = 4
  ): ForecastSummary {
    const customerForecasts = this.forecastCustomers(customers, forecastPeriods);
    const portfolioForecasts = this.forecastPortfolio(customers, forecastPeriods);

    // Calculate summary statistics
    const highConfidenceCount = customerForecasts.filter(f => f.confidence === 'high').length;
    const mediumConfidenceCount = customerForecasts.filter(f => f.confidence === 'medium').length;
    const lowConfidenceCount = customerForecasts.filter(f => f.confidence === 'low').length;

    // Calculate at-risk ARR
    const atRiskArr = customerForecasts
      .filter(f => f.recommendedAction === 'at_risk_intervention' || f.recommendedAction === 'save_play')
      .reduce((sum, f) => sum + f.currentArr, 0);

    // Calculate expansion opportunity ARR
    const expansionOpportunityArr = customerForecasts
      .filter(f => f.recommendedAction === 'expansion_play' || f.recommendedAction === 'upsell_ready')
      .reduce((sum, f) => sum + f.currentArr, 0);

    return {
      portfolioForecasts,
      customerForecasts,
      highConfidenceCount,
      mediumConfidenceCount,
      lowConfidenceCount,
      atRiskArr,
      expansionOpportunityArr
    };
  }

  /**
   * Calculate years between dates
   */
  private calculateYears(startDate: string, endDate: string): number {
    const start = new Date(startDate);
    const end = new Date(endDate);
    const diffMs = end.getTime() - start.getTime();
    return Math.max(diffMs / (1000 * 60 * 60 * 24 * 365.25), 0.0833);
  }

  /**
   * Format period label
   */
  private formatPeriod(date: Date, periodType: string): string {
    const year = date.getFullYear();
    const month = date.getMonth() + 1;

    if (periodType === 'quarterly') {
      const quarter = Math.ceil(month / 3);
      return `Q${quarter} ${year}`;
    } else if (periodType === 'annual') {
      return `${year}`;
    }
    return `${date.toLocaleString('default', { month: 'short' })} ${year}`;
  }

  /**
   * Calculate confidence bounds for forecast
   */
  private calculateConfidenceBounds(
    predicted: number,
    trend: TrendResult,
    periodsAhead: number
  ): { confidence: ForecastConfidence; lowerBound: number; upperBound: number } {
    // Base uncertainty increases with time
    const baseUncertainty = 0.05 * periodsAhead;

    // Adjust for trend consistency
    const consistencyAdjustment = trend.rSquared > 0.7 ? 0.9 :
                                   trend.rSquared > 0.4 ? 1.0 : 1.3;

    // Calculate bounds
    const uncertainty = baseUncertainty * consistencyAdjustment;
    const lowerBound = predicted * (1 - uncertainty);
    const upperBound = predicted * (1 + uncertainty);

    // Determine confidence level
    let confidence: ForecastConfidence;
    if (trend.rSquared >= 0.7 && periodsAhead <= 2) {
      confidence = 'high';
    } else if (trend.rSquared >= 0.4 || periodsAhead <= 4) {
      confidence = 'medium';
    } else {
      confidence = 'low';
    }

    return { confidence, lowerBound, upperBound };
  }

  /**
   * Determine customer forecast confidence
   */
  private determineCustomerConfidence(
    arrTrend: TrendResult,
    healthTrend: TrendResult | null,
    dataPointCount: number
  ): ForecastConfidence {
    let score = 0;

    // Data quality (0-40 points)
    if (dataPointCount >= 24) score += 40;
    else if (dataPointCount >= 12) score += 25;
    else if (dataPointCount >= 6) score += 10;

    // Trend consistency (0-40 points)
    if (arrTrend.rSquared >= 0.7) score += 40;
    else if (arrTrend.rSquared >= 0.4) score += 25;
    else score += 10;

    // Health data availability (0-20 points)
    if (healthTrend) {
      if (healthTrend.rSquared >= 0.5) score += 20;
      else score += 10;
    }

    if (score >= 70) return 'high';
    if (score >= 40) return 'medium';
    return 'low';
  }

  /**
   * Identify risks and opportunities
   */
  private identifyRisksAndOpportunities(
    arrTrend: TrendResult,
    healthTrend: TrendResult | null,
    currentHealth: number | null,
    arrChangePercent: number
  ): { riskFactors: string[]; opportunities: string[] } {
    const riskFactors: string[] = [];
    const opportunities: string[] = [];

    // ARR-based risks
    if (arrTrend.direction === 'down') {
      if (arrTrend.cagr < -20) {
        riskFactors.push('Significant ARR decline trajectory');
      } else {
        riskFactors.push('Declining ARR trend');
      }
    }

    if (arrTrend.acceleration < -0.1) {
      riskFactors.push('Accelerating decline');
    }

    // Health-based risks
    if (healthTrend && healthTrend.direction === 'down') {
      riskFactors.push('Declining engagement');
    }

    if (currentHealth !== null && currentHealth < 50) {
      riskFactors.push('Low health score');
    }

    // Opportunities
    if (arrTrend.direction === 'up' && arrTrend.cagr > 20) {
      opportunities.push('Strong growth trajectory');
    }

    if (arrTrend.acceleration > 0.1) {
      opportunities.push('Accelerating growth');
    }

    if (healthTrend && healthTrend.direction === 'up') {
      opportunities.push('Improving engagement');
    }

    if (currentHealth !== null && currentHealth > 80) {
      opportunities.push('High health score');
    }

    if (arrChangePercent > 15) {
      opportunities.push('Significant expansion potential');
    }

    return { riskFactors, opportunities };
  }

  /**
   * Determine recommended action
   */
  private determineRecommendedAction(
    trajectory: 'up' | 'down' | 'stable',
    arrChangePercent: number,
    currentHealth: number | null,
    riskCount: number
  ): 'expansion_play' | 'upsell_ready' | 'maintain' | 'save_play' | 'at_risk_intervention' {
    // At-risk intervention
    if (trajectory === 'down' && arrChangePercent < -15) {
      return 'at_risk_intervention';
    }

    // Save play
    if (trajectory === 'down' || (currentHealth !== null && currentHealth < 50)) {
      return 'save_play';
    }

    // Expansion play
    if (trajectory === 'up' && arrChangePercent > 25 && riskCount === 0) {
      return 'expansion_play';
    }

    // Upsell ready
    if (trajectory === 'up' && arrChangePercent > 10) {
      return 'upsell_ready';
    }

    // Maintain
    return 'maintain';
  }

  /**
   * Aggregate data points by month
   */
  private aggregateByMonth(
    points: TrendDataPoint[],
    method: 'sum' | 'avg'
  ): TrendDataPoint[] {
    const grouped = new Map<string, number[]>();

    for (const point of points) {
      const monthKey = point.date.slice(0, 7);
      if (!grouped.has(monthKey)) {
        grouped.set(monthKey, []);
      }
      grouped.get(monthKey)!.push(point.value);
    }

    const result: TrendDataPoint[] = [];

    grouped.forEach((values, date) => {
      const value = method === 'sum' ?
        values.reduce((a, b) => a + b, 0) :
        values.reduce((a, b) => a + b, 0) / values.length;

      result.push({ date: `${date}-01`, value });
    });

    return result.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
  }

  /**
   * Generate intervention plan for at-risk customer
   */
  generateInterventionPlan(
    forecast: CustomerForecast
  ): {
    rootCause: string;
    interventionTasks: Array<{ week: string; title: string; tasks: string[] }>;
    successMetrics: Array<{ metric: string; target: string; deadline: string }>;
  } {
    const rootCause = forecast.riskFactors[0] || 'Unknown - needs investigation';

    const interventionTasks = [
      {
        week: 'Week 1',
        title: 'Assessment',
        tasks: [
          'Map current stakeholders',
          'Identify potential new champion',
          'Assess remaining value perception'
        ]
      },
      {
        week: 'Week 2-3',
        title: 'Re-engagement',
        tasks: [
          'Schedule executive alignment call',
          'Present value recap and ROI',
          'Introduce new features since last engagement'
        ]
      },
      {
        week: 'Week 4-6',
        title: 'Rebuilding',
        tasks: [
          'Onboard new champion',
          'Create success plan',
          'Establish regular cadence'
        ]
      }
    ];

    const now = new Date();
    const twoWeeks = new Date(now.getTime() + 14 * 24 * 60 * 60 * 1000);
    const sixWeeks = new Date(now.getTime() + 42 * 24 * 60 * 60 * 1000);

    const successMetrics = [
      {
        metric: 'New champion identified',
        target: 'Yes',
        deadline: twoWeeks.toISOString().split('T')[0]
      },
      {
        metric: 'Health score',
        target: '>60',
        deadline: sixWeeks.toISOString().split('T')[0]
      },
      {
        metric: 'ARR retention',
        target: `>${Math.round(forecast.currentArr * 0.9)}`,
        deadline: sixWeeks.toISOString().split('T')[0]
      }
    ];

    return { rootCause, interventionTasks, successMetrics };
  }
}

// Singleton export
export const forecasterService = new ForecasterService();
export default forecasterService;
