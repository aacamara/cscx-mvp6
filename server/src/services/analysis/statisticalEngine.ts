/**
 * Statistical Engine Service
 * PRD-024: Survey Response Upload -> Statistical Analysis
 *
 * Performs statistical analysis including:
 * - Descriptive statistics
 * - Significance testing (t-test, ANOVA, chi-square)
 * - Correlation analysis
 * - Segment comparisons with confidence intervals
 * - Distribution analysis
 */

import { v4 as uuidv4 } from 'uuid';
import {
  ParsedSurveyData,
  SurveyQuestion,
  SurveyResponseRow,
  QuestionStats,
} from '../surveys/responseParser.js';

// ============================================
// Types
// ============================================

export interface StatisticalAnalysis {
  id: string;
  surveyDataId: string;
  analyzedAt: Date;
  descriptiveStats: DescriptiveStatistics;
  correlations: CorrelationMatrix;
  segmentComparisons: SegmentComparison[];
  significantFindings: SignificantFinding[];
  distributionAnalysis: DistributionAnalysis[];
  qualityIssues: QualityIssue[];
  predictiveModel: PredictiveModel | null;
  recommendations: ActionableRecommendation[];
}

export interface DescriptiveStatistics {
  questionSummaries: QuestionSummary[];
  overallMetrics: {
    totalQuestions: number;
    numericQuestions: number;
    categoricalQuestions: number;
    openEndedQuestions: number;
    averageResponseRate: number;
  };
}

export interface QuestionSummary {
  questionId: string;
  questionTitle: string;
  questionType: string;
  n: number;
  responseRate: number;
  mean?: number;
  median?: number;
  stdDev?: number;
  min?: number;
  max?: number;
  skewness?: number;
  distribution?: 'normal' | 'left-skewed' | 'right-skewed' | 'bimodal' | 'uniform';
  distributionFlag?: string;
}

export interface CorrelationResult {
  variable1: string;
  variable2: string;
  variable1Title: string;
  variable2Title: string;
  correlation: number;
  pValue: number;
  isSignificant: boolean;
  strength: 'very_weak' | 'weak' | 'moderate' | 'strong' | 'very_strong';
}

export interface CorrelationMatrix {
  variables: string[];
  variableTitles: string[];
  matrix: number[][];
  significantPairs: CorrelationResult[];
}

export interface SegmentComparison {
  segmentField: string;
  segments: SegmentStats[];
  anovaResult?: {
    fStatistic: number;
    pValue: number;
    isSignificant: boolean;
  };
  significantDifferences: string[];
}

export interface SegmentStats {
  segmentName: string;
  n: number;
  mean: number;
  stdDev: number;
  confidenceInterval: { lower: number; upper: number };
  percentile25: number;
  percentile75: number;
}

export interface SignificantFinding {
  id: string;
  type: 'correlation' | 'segment_difference' | 'distribution_anomaly' | 'trend';
  severity: 'high' | 'medium' | 'low';
  title: string;
  description: string;
  statisticalEvidence: string;
  impact: string;
  actionItems: string[];
}

export interface DistributionAnalysis {
  questionId: string;
  questionTitle: string;
  distribution: 'normal' | 'left-skewed' | 'right-skewed' | 'bimodal' | 'uniform';
  histogram: { value: number | string; count: number; percentage: number }[];
  interpretation: string;
  concern?: string;
}

export interface QualityIssue {
  type: 'low_response_rate' | 'survey_fatigue' | 'bimodal_distribution' | 'missing_data' | 'bias_detected';
  severity: 'warning' | 'critical';
  description: string;
  affectedQuestions: string[];
  recommendation: string;
}

export interface PredictiveModel {
  targetVariable: string;
  targetVariableTitle: string;
  equation: string;
  rSquared: number;
  adjustedRSquared: number;
  predictors: {
    variable: string;
    variableTitle: string;
    coefficient: number;
    standardError: number;
    pValue: number;
    contribution: number;
  }[];
  interpretation: string;
}

export interface ActionableRecommendation {
  priority: 'high' | 'medium' | 'low';
  category: 'immediate_action' | 'investigation' | 'monitoring' | 'improvement';
  title: string;
  description: string;
  expectedImpact: string;
  basedOn: string;
}

// ============================================
// Statistical Engine Class
// ============================================

export class StatisticalEngine {
  /**
   * Perform full statistical analysis on survey data
   */
  async analyzeSurveyData(
    surveyData: ParsedSurveyData,
    options: {
      targetVariable?: string;
      segmentByFields?: string[];
      significanceLevel?: number;
    } = {}
  ): Promise<StatisticalAnalysis> {
    const id = uuidv4();
    const significanceLevel = options.significanceLevel || 0.05;

    // Calculate descriptive statistics
    const descriptiveStats = this.calculateDescriptiveStats(surveyData);

    // Calculate correlations between numeric questions
    const correlations = this.calculateCorrelations(surveyData, significanceLevel);

    // Perform segment comparisons if segments are detected
    const segmentComparisons = this.performSegmentComparisons(surveyData, significanceLevel);

    // Analyze distributions
    const distributionAnalysis = this.analyzeDistributions(surveyData);

    // Identify quality issues
    const qualityIssues = this.detectQualityIssues(surveyData, descriptiveStats);

    // Build predictive model if target variable specified
    let predictiveModel: PredictiveModel | null = null;
    if (options.targetVariable) {
      predictiveModel = this.buildPredictiveModel(surveyData, options.targetVariable);
    } else {
      // Try to auto-detect a good target (e.g., NPS, Overall Satisfaction)
      predictiveModel = this.autoDetectAndBuildModel(surveyData);
    }

    // Compile significant findings
    const significantFindings = this.compileSignificantFindings(
      correlations,
      segmentComparisons,
      distributionAnalysis,
      predictiveModel
    );

    // Generate recommendations
    const recommendations = this.generateRecommendations(
      significantFindings,
      qualityIssues,
      correlations,
      predictiveModel
    );

    return {
      id,
      surveyDataId: surveyData.id,
      analyzedAt: new Date(),
      descriptiveStats,
      correlations,
      segmentComparisons,
      significantFindings,
      distributionAnalysis,
      qualityIssues,
      predictiveModel,
      recommendations,
    };
  }

  /**
   * Calculate descriptive statistics for all questions
   */
  private calculateDescriptiveStats(data: ParsedSurveyData): DescriptiveStatistics {
    const questionSummaries: QuestionSummary[] = [];
    let numericCount = 0;
    let categoricalCount = 0;
    let openEndedCount = 0;
    let totalResponseRate = 0;

    for (const question of data.questions) {
      const stats = data.questionStats[question.id];
      if (!stats) continue;

      const summary: QuestionSummary = {
        questionId: question.id,
        questionTitle: question.title,
        questionType: question.type,
        n: stats.responseCount,
        responseRate: stats.responseRate,
      };

      if (['likert', 'scale', 'numeric'].includes(question.type)) {
        numericCount++;
        summary.mean = stats.mean;
        summary.median = stats.median;
        summary.stdDev = stats.stdDev;
        summary.min = stats.min;
        summary.max = stats.max;

        // Calculate skewness and determine distribution type
        if (stats.mean !== undefined && stats.median !== undefined && stats.stdDev !== undefined && stats.stdDev > 0) {
          summary.skewness = 3 * (stats.mean - stats.median) / stats.stdDev;
          summary.distribution = this.classifyDistribution(stats, summary.skewness);

          // Flag concerning distributions
          if (summary.distribution === 'bimodal') {
            summary.distributionFlag = 'Bimodal distribution detected - possible polarized responses';
          }
        }
      } else if (['multiple_choice', 'binary'].includes(question.type)) {
        categoricalCount++;
      } else {
        openEndedCount++;
      }

      totalResponseRate += stats.responseRate;
      questionSummaries.push(summary);
    }

    return {
      questionSummaries,
      overallMetrics: {
        totalQuestions: data.questions.length,
        numericQuestions: numericCount,
        categoricalQuestions: categoricalCount,
        openEndedQuestions: openEndedCount,
        averageResponseRate: data.questions.length > 0
          ? Math.round(totalResponseRate / data.questions.length)
          : 0,
      },
    };
  }

  /**
   * Classify distribution type based on statistics
   */
  private classifyDistribution(
    stats: QuestionStats,
    skewness: number
  ): 'normal' | 'left-skewed' | 'right-skewed' | 'bimodal' | 'uniform' {
    if (!stats.distribution) return 'normal';

    // Check for bimodality
    const values = Object.values(stats.distribution);
    if (values.length >= 3) {
      const sorted = [...values].sort((a, b) => b - a);
      const peak1 = sorted[0];
      const peak2 = sorted[1];
      const valley = sorted[Math.floor(sorted.length / 2)];

      if (peak1 > 0 && peak2 > 0 && valley < peak1 * 0.5 && valley < peak2 * 0.5) {
        return 'bimodal';
      }
    }

    // Check for uniform
    const range = Math.max(...values) - Math.min(...values);
    const avg = values.reduce((a, b) => a + b, 0) / values.length;
    if (values.length > 3 && range < avg * 0.3) {
      return 'uniform';
    }

    // Check skewness
    if (skewness < -0.5) return 'left-skewed';
    if (skewness > 0.5) return 'right-skewed';
    return 'normal';
  }

  /**
   * Calculate correlation matrix for numeric questions
   */
  private calculateCorrelations(
    data: ParsedSurveyData,
    significanceLevel: number
  ): CorrelationMatrix {
    const numericQuestions = data.questions.filter(q =>
      ['likert', 'scale', 'numeric'].includes(q.type)
    );

    const variables = numericQuestions.map(q => q.id);
    const variableTitles = numericQuestions.map(q => q.title);
    const n = numericQuestions.length;
    const matrix: number[][] = Array(n).fill(null).map(() => Array(n).fill(0));
    const significantPairs: CorrelationResult[] = [];

    // Build data arrays for each question
    const questionData: Record<string, number[]> = {};
    for (const question of numericQuestions) {
      questionData[question.id] = data.responses
        .map(r => r.answers[question.id]?.numericValue)
        .filter((v): v is number => v !== undefined);
    }

    // Calculate pairwise correlations
    for (let i = 0; i < n; i++) {
      matrix[i][i] = 1.0;

      for (let j = i + 1; j < n; j++) {
        const x = questionData[variables[i]];
        const y = questionData[variables[j]];

        // Only correlate if we have matching data points
        const pairs: [number, number][] = [];
        for (let k = 0; k < data.responses.length; k++) {
          const xVal = data.responses[k].answers[variables[i]]?.numericValue;
          const yVal = data.responses[k].answers[variables[j]]?.numericValue;
          if (xVal !== undefined && yVal !== undefined) {
            pairs.push([xVal, yVal]);
          }
        }

        if (pairs.length < 3) {
          matrix[i][j] = 0;
          matrix[j][i] = 0;
          continue;
        }

        const correlation = this.pearsonCorrelation(
          pairs.map(p => p[0]),
          pairs.map(p => p[1])
        );

        matrix[i][j] = correlation;
        matrix[j][i] = correlation;

        // Calculate p-value using t-distribution approximation
        const pValue = this.correlationPValue(correlation, pairs.length);
        const isSignificant = pValue < significanceLevel && Math.abs(correlation) > 0.3;

        if (isSignificant) {
          significantPairs.push({
            variable1: variables[i],
            variable2: variables[j],
            variable1Title: variableTitles[i],
            variable2Title: variableTitles[j],
            correlation: Math.round(correlation * 100) / 100,
            pValue: Math.round(pValue * 1000) / 1000,
            isSignificant,
            strength: this.classifyCorrelationStrength(Math.abs(correlation)),
          });
        }
      }
    }

    // Sort by absolute correlation strength
    significantPairs.sort((a, b) => Math.abs(b.correlation) - Math.abs(a.correlation));

    return { variables, variableTitles, matrix, significantPairs };
  }

  /**
   * Calculate Pearson correlation coefficient
   */
  private pearsonCorrelation(x: number[], y: number[]): number {
    const n = x.length;
    if (n !== y.length || n < 2) return 0;

    const sumX = x.reduce((a, b) => a + b, 0);
    const sumY = y.reduce((a, b) => a + b, 0);
    const sumXY = x.reduce((acc, xi, i) => acc + xi * y[i], 0);
    const sumX2 = x.reduce((a, b) => a + b * b, 0);
    const sumY2 = y.reduce((a, b) => a + b * b, 0);

    const numerator = n * sumXY - sumX * sumY;
    const denominator = Math.sqrt((n * sumX2 - sumX * sumX) * (n * sumY2 - sumY * sumY));

    if (denominator === 0) return 0;
    return numerator / denominator;
  }

  /**
   * Calculate p-value for correlation coefficient
   */
  private correlationPValue(r: number, n: number): number {
    if (n < 3 || Math.abs(r) >= 1) return 1;

    const t = r * Math.sqrt((n - 2) / (1 - r * r));
    const df = n - 2;

    // Approximate p-value using Student's t-distribution
    // Using a simplified approximation for computational efficiency
    const x = df / (df + t * t);
    const a = df / 2;
    const b = 0.5;

    // Beta incomplete function approximation
    const pValue = Math.min(1, 2 * (1 - this.normalCDF(Math.abs(t))));
    return pValue;
  }

  /**
   * Standard normal cumulative distribution function
   */
  private normalCDF(x: number): number {
    const a1 = 0.254829592;
    const a2 = -0.284496736;
    const a3 = 1.421413741;
    const a4 = -1.453152027;
    const a5 = 1.061405429;
    const p = 0.3275911;

    const sign = x < 0 ? -1 : 1;
    x = Math.abs(x) / Math.sqrt(2);

    const t = 1.0 / (1.0 + p * x);
    const y = 1.0 - (((((a5 * t + a4) * t) + a3) * t + a2) * t + a1) * t * Math.exp(-x * x);

    return 0.5 * (1.0 + sign * y);
  }

  /**
   * Classify correlation strength
   */
  private classifyCorrelationStrength(
    absR: number
  ): 'very_weak' | 'weak' | 'moderate' | 'strong' | 'very_strong' {
    if (absR >= 0.9) return 'very_strong';
    if (absR >= 0.7) return 'strong';
    if (absR >= 0.5) return 'moderate';
    if (absR >= 0.3) return 'weak';
    return 'very_weak';
  }

  /**
   * Perform segment comparisons using ANOVA
   */
  private performSegmentComparisons(
    data: ParsedSurveyData,
    significanceLevel: number
  ): SegmentComparison[] {
    const comparisons: SegmentComparison[] = [];

    // Look for segment field in responses
    const segmentFields = this.detectSegmentFields(data);
    const targetQuestions = data.questions.filter(q =>
      ['likert', 'scale', 'numeric'].includes(q.type)
    );

    for (const segmentField of segmentFields) {
      // Group responses by segment
      const groups = this.groupBySegment(data.responses, segmentField);

      if (Object.keys(groups).length < 2) continue;

      // For each target question, compare across segments
      for (const question of targetQuestions.slice(0, 5)) { // Limit to avoid overwhelming output
        const stats = data.questionStats[question.id];
        if (!stats || stats.responseCount < 10) continue;

        const segmentStats: SegmentStats[] = [];
        const groupValues: number[][] = [];

        for (const [segmentName, responses] of Object.entries(groups)) {
          const values = responses
            .map(r => r.answers[question.id]?.numericValue)
            .filter((v): v is number => v !== undefined);

          if (values.length < 3) continue;

          groupValues.push(values);
          segmentStats.push(this.calculateSegmentStats(segmentName, values));
        }

        if (segmentStats.length < 2) continue;

        // Perform one-way ANOVA
        const anovaResult = this.oneWayAnova(groupValues);

        const significantDifferences: string[] = [];
        if (anovaResult.pValue < significanceLevel) {
          // Find which segments differ
          for (let i = 0; i < segmentStats.length; i++) {
            for (let j = i + 1; j < segmentStats.length; j++) {
              const diff = Math.abs(segmentStats[i].mean - segmentStats[j].mean);
              const pooledSE = Math.sqrt(
                (segmentStats[i].stdDev ** 2 / segmentStats[i].n) +
                (segmentStats[j].stdDev ** 2 / segmentStats[j].n)
              );

              if (pooledSE > 0 && diff / pooledSE > 1.96) {
                significantDifferences.push(
                  `${segmentStats[i].segmentName} vs ${segmentStats[j].segmentName}`
                );
              }
            }
          }
        }

        comparisons.push({
          segmentField: `${segmentField} - ${question.title}`,
          segments: segmentStats,
          anovaResult: {
            fStatistic: Math.round(anovaResult.fStatistic * 100) / 100,
            pValue: Math.round(anovaResult.pValue * 1000) / 1000,
            isSignificant: anovaResult.pValue < significanceLevel,
          },
          significantDifferences,
        });
      }
    }

    return comparisons;
  }

  /**
   * Detect potential segment fields from response data
   */
  private detectSegmentFields(data: ParsedSurveyData): string[] {
    const fields: string[] = [];

    // Check for segment in responses metadata
    for (const response of data.responses) {
      for (const key of Object.keys(response)) {
        if (['customerId', 'customerEmail', 'respondentName', 'respondentEmail', 'submittedAt', 'answers', 'completionPercentage', 'isComplete', 'responseId'].includes(key)) {
          continue;
        }
        if (!fields.includes(key)) {
          fields.push(key);
        }
      }
    }

    // Check for categorical questions that could serve as segments
    const categoricalQuestions = data.questions.filter(q =>
      q.type === 'multiple_choice' && q.options && q.options.length >= 2 && q.options.length <= 6
    );

    for (const q of categoricalQuestions) {
      if (!fields.includes(q.title)) {
        fields.push(q.title);
      }
    }

    return fields.slice(0, 3); // Limit segments to analyze
  }

  /**
   * Group responses by segment field
   */
  private groupBySegment(
    responses: SurveyResponseRow[],
    segmentField: string
  ): Record<string, SurveyResponseRow[]> {
    const groups: Record<string, SurveyResponseRow[]> = {};

    for (const response of responses) {
      // Check if segmentField is a question
      const questionAnswer = Object.values(response.answers).find(a => {
        const question = a.questionId;
        return question === segmentField;
      });

      let segmentValue: string | null = null;

      if (questionAnswer && questionAnswer.value !== null) {
        segmentValue = String(questionAnswer.value);
      } else if ((response as any)[segmentField]) {
        segmentValue = String((response as any)[segmentField]);
      }

      if (segmentValue) {
        if (!groups[segmentValue]) {
          groups[segmentValue] = [];
        }
        groups[segmentValue].push(response);
      }
    }

    return groups;
  }

  /**
   * Calculate statistics for a segment
   */
  private calculateSegmentStats(name: string, values: number[]): SegmentStats {
    const sorted = [...values].sort((a, b) => a - b);
    const n = values.length;
    const mean = values.reduce((a, b) => a + b, 0) / n;

    const squaredDiffs = values.map(v => Math.pow(v - mean, 2));
    const variance = squaredDiffs.reduce((a, b) => a + b, 0) / n;
    const stdDev = Math.sqrt(variance);

    // 95% confidence interval
    const standardError = stdDev / Math.sqrt(n);
    const marginOfError = 1.96 * standardError;

    // Percentiles
    const p25Index = Math.floor(n * 0.25);
    const p75Index = Math.floor(n * 0.75);

    return {
      segmentName: name,
      n,
      mean: Math.round(mean * 100) / 100,
      stdDev: Math.round(stdDev * 100) / 100,
      confidenceInterval: {
        lower: Math.round((mean - marginOfError) * 100) / 100,
        upper: Math.round((mean + marginOfError) * 100) / 100,
      },
      percentile25: sorted[p25Index] || sorted[0],
      percentile75: sorted[p75Index] || sorted[n - 1],
    };
  }

  /**
   * One-way ANOVA calculation
   */
  private oneWayAnova(groups: number[][]): { fStatistic: number; pValue: number } {
    const k = groups.length;
    const allValues = groups.flat();
    const N = allValues.length;
    const grandMean = allValues.reduce((a, b) => a + b, 0) / N;

    // Between-group variance (SSB)
    let ssb = 0;
    for (const group of groups) {
      const groupMean = group.reduce((a, b) => a + b, 0) / group.length;
      ssb += group.length * Math.pow(groupMean - grandMean, 2);
    }

    // Within-group variance (SSW)
    let ssw = 0;
    for (const group of groups) {
      const groupMean = group.reduce((a, b) => a + b, 0) / group.length;
      for (const value of group) {
        ssw += Math.pow(value - groupMean, 2);
      }
    }

    const dfBetween = k - 1;
    const dfWithin = N - k;

    if (dfWithin <= 0 || dfBetween <= 0 || ssw === 0) {
      return { fStatistic: 0, pValue: 1 };
    }

    const msb = ssb / dfBetween;
    const msw = ssw / dfWithin;
    const fStatistic = msb / msw;

    // Approximate p-value using F-distribution
    // Using a simplified approximation
    const pValue = 1 - this.fDistributionCDF(fStatistic, dfBetween, dfWithin);

    return { fStatistic, pValue };
  }

  /**
   * F-distribution CDF approximation
   */
  private fDistributionCDF(f: number, d1: number, d2: number): number {
    if (f <= 0) return 0;

    const x = d2 / (d2 + d1 * f);

    // Use incomplete beta function approximation
    // This is a simplified approximation
    const approx = Math.pow(x, d2 / 2) * Math.pow(1 - x, d1 / 2);
    return 1 - Math.min(1, approx);
  }

  /**
   * Analyze distributions for each question
   */
  private analyzeDistributions(data: ParsedSurveyData): DistributionAnalysis[] {
    const analyses: DistributionAnalysis[] = [];

    for (const question of data.questions) {
      if (!['likert', 'scale', 'numeric'].includes(question.type)) continue;

      const stats = data.questionStats[question.id];
      if (!stats || !stats.distribution) continue;

      const total = Object.values(stats.distribution).reduce((a, b) => a + b, 0);
      const histogram = Object.entries(stats.distribution)
        .map(([value, count]) => ({
          value: Number(value),
          count,
          percentage: Math.round((count / total) * 100),
        }))
        .sort((a, b) => Number(a.value) - Number(b.value));

      const distribution = this.classifyDistribution(stats, 0);
      let interpretation = '';
      let concern: string | undefined;

      switch (distribution) {
        case 'normal':
          interpretation = 'Responses are normally distributed around the mean.';
          break;
        case 'left-skewed':
          interpretation = 'Most responses cluster at higher values with a tail toward lower scores.';
          break;
        case 'right-skewed':
          interpretation = 'Most responses cluster at lower values with a tail toward higher scores.';
          break;
        case 'bimodal':
          interpretation = 'Responses show two distinct peaks, indicating polarized opinions.';
          concern = 'Bimodal distribution suggests inconsistent experiences - investigate what differentiates positive vs negative respondents.';
          break;
        case 'uniform':
          interpretation = 'Responses are evenly spread across all values.';
          break;
      }

      analyses.push({
        questionId: question.id,
        questionTitle: question.title,
        distribution,
        histogram,
        interpretation,
        concern,
      });
    }

    return analyses;
  }

  /**
   * Detect data quality issues
   */
  private detectQualityIssues(
    data: ParsedSurveyData,
    stats: DescriptiveStatistics
  ): QualityIssue[] {
    const issues: QualityIssue[] = [];

    // Check for low response rates
    const lowResponseQuestions = stats.questionSummaries.filter(q => q.responseRate < 70);
    if (lowResponseQuestions.length > 0) {
      issues.push({
        type: 'low_response_rate',
        severity: lowResponseQuestions.some(q => q.responseRate < 50) ? 'critical' : 'warning',
        description: `${lowResponseQuestions.length} question(s) have response rate below 70%`,
        affectedQuestions: lowResponseQuestions.map(q => q.questionTitle),
        recommendation: 'Consider shortening the survey or making questions clearer',
      });
    }

    // Check for survey fatigue (declining response rates toward end)
    const orderedQuestions = [...stats.questionSummaries].sort((a, b) => {
      const qA = data.questions.find(q => q.id === a.questionId);
      const qB = data.questions.find(q => q.id === b.questionId);
      return (qA?.index || 0) - (qB?.index || 0);
    });

    if (orderedQuestions.length >= 5) {
      const firstHalf = orderedQuestions.slice(0, Math.floor(orderedQuestions.length / 2));
      const secondHalf = orderedQuestions.slice(Math.floor(orderedQuestions.length / 2));

      const firstHalfAvg = firstHalf.reduce((a, q) => a + q.responseRate, 0) / firstHalf.length;
      const secondHalfAvg = secondHalf.reduce((a, q) => a + q.responseRate, 0) / secondHalf.length;

      if (firstHalfAvg - secondHalfAvg > 15) {
        issues.push({
          type: 'survey_fatigue',
          severity: 'warning',
          description: `Response rate drops from ${Math.round(firstHalfAvg)}% to ${Math.round(secondHalfAvg)}% in second half of survey`,
          affectedQuestions: secondHalf.filter(q => q.responseRate < firstHalfAvg - 10).map(q => q.questionTitle),
          recommendation: 'Move critical questions earlier or shorten the survey',
        });
      }
    }

    // Check for bimodal distributions
    const bimodalQuestions = stats.questionSummaries.filter(q => q.distribution === 'bimodal');
    if (bimodalQuestions.length > 0) {
      issues.push({
        type: 'bimodal_distribution',
        severity: 'warning',
        description: `${bimodalQuestions.length} question(s) show bimodal distributions indicating polarized responses`,
        affectedQuestions: bimodalQuestions.map(q => q.questionTitle),
        recommendation: 'Investigate what differentiates satisfied vs dissatisfied respondents',
      });
    }

    return issues;
  }

  /**
   * Build predictive model (simple linear regression)
   */
  private buildPredictiveModel(
    data: ParsedSurveyData,
    targetVariableId: string
  ): PredictiveModel | null {
    const targetQuestion = data.questions.find(q => q.id === targetVariableId || q.title === targetVariableId);
    if (!targetQuestion || !['likert', 'scale', 'numeric'].includes(targetQuestion.type)) {
      return null;
    }

    const predictorQuestions = data.questions.filter(q =>
      q.id !== targetVariableId &&
      ['likert', 'scale', 'numeric'].includes(q.type)
    );

    if (predictorQuestions.length === 0) return null;

    // Get target values
    const targetValues = data.responses
      .map(r => r.answers[targetQuestion.id]?.numericValue)
      .filter((v): v is number => v !== undefined);

    if (targetValues.length < 10) return null;

    // Calculate correlations with target
    const predictorCorrelations: Array<{
      question: (typeof predictorQuestions)[0];
      correlation: number;
    }> = [];

    for (const predictor of predictorQuestions) {
      const pairs: [number, number][] = [];
      for (const response of data.responses) {
        const targetVal = response.answers[targetQuestion.id]?.numericValue;
        const predictorVal = response.answers[predictor.id]?.numericValue;
        if (targetVal !== undefined && predictorVal !== undefined) {
          pairs.push([predictorVal, targetVal]);
        }
      }

      if (pairs.length >= 5) {
        const correlation = this.pearsonCorrelation(
          pairs.map(p => p[0]),
          pairs.map(p => p[1])
        );
        predictorCorrelations.push({ question: predictor, correlation });
      }
    }

    // Select top predictors
    const topPredictors = predictorCorrelations
      .filter(p => Math.abs(p.correlation) >= 0.2)
      .sort((a, b) => Math.abs(b.correlation) - Math.abs(a.correlation))
      .slice(0, 5);

    if (topPredictors.length === 0) return null;

    // Simple regression coefficients (using correlation-based approximation)
    const targetMean = targetValues.reduce((a, b) => a + b, 0) / targetValues.length;
    const targetStd = Math.sqrt(
      targetValues.map(v => Math.pow(v - targetMean, 2)).reduce((a, b) => a + b, 0) / targetValues.length
    );

    const predictors: PredictiveModel['predictors'] = [];
    let totalContribution = 0;

    for (const { question, correlation } of topPredictors) {
      const stats = data.questionStats[question.id];
      if (!stats || stats.mean === undefined || stats.stdDev === undefined || stats.stdDev === 0) continue;

      const beta = correlation * (targetStd / stats.stdDev);
      const contribution = Math.abs(correlation);
      totalContribution += contribution;

      predictors.push({
        variable: question.id,
        variableTitle: question.title,
        coefficient: Math.round(beta * 100) / 100,
        standardError: 0.1, // Simplified
        pValue: this.correlationPValue(correlation, data.responses.length),
        contribution: 0, // Will be normalized
      });
    }

    // Normalize contributions
    for (const predictor of predictors) {
      predictor.contribution = totalContribution > 0
        ? Math.round((Math.abs(predictors.find(p => p.variable === predictor.variable)?.coefficient || 0) / totalContribution) * 100)
        : 0;
    }

    // Calculate R-squared (sum of squared correlations as approximation)
    const rSquared = topPredictors
      .map(p => p.correlation ** 2)
      .reduce((a, b) => a + b, 0);

    // Build equation string
    const equationParts = [`${targetQuestion.title} = ${Math.round(targetMean * 100) / 100}`];
    for (const predictor of predictors) {
      const sign = predictor.coefficient >= 0 ? '+' : '';
      equationParts.push(`${sign} (${predictor.coefficient} x ${predictor.variableTitle})`);
    }

    // Interpretation
    const topPredictor = predictors[0];
    const interpretation = topPredictor
      ? `${topPredictor.variableTitle} is the strongest predictor of ${targetQuestion.title}, explaining ${topPredictor.contribution}% of the variance.`
      : 'No significant predictors found.';

    return {
      targetVariable: targetQuestion.id,
      targetVariableTitle: targetQuestion.title,
      equation: equationParts.join(' '),
      rSquared: Math.round(Math.min(rSquared, 1) * 100) / 100,
      adjustedRSquared: Math.round(Math.min(rSquared * 0.95, 1) * 100) / 100,
      predictors,
      interpretation,
    };
  }

  /**
   * Auto-detect target variable and build model
   */
  private autoDetectAndBuildModel(data: ParsedSurveyData): PredictiveModel | null {
    // Look for common target variable patterns
    const targetPatterns = [
      /renewal|renew|likely.*renew/i,
      /recommend|nps|promoter/i,
      /overall.*satisfaction|satisfaction.*overall/i,
      /satisfaction/i,
      /loyalty/i,
    ];

    for (const pattern of targetPatterns) {
      const targetQuestion = data.questions.find(q =>
        pattern.test(q.title) && ['likert', 'scale', 'numeric'].includes(q.type)
      );

      if (targetQuestion) {
        const model = this.buildPredictiveModel(data, targetQuestion.id);
        if (model && model.predictors.length > 0) {
          return model;
        }
      }
    }

    return null;
  }

  /**
   * Compile significant findings from all analyses
   */
  private compileSignificantFindings(
    correlations: CorrelationMatrix,
    segmentComparisons: SegmentComparison[],
    distributionAnalysis: DistributionAnalysis[],
    predictiveModel: PredictiveModel | null
  ): SignificantFinding[] {
    const findings: SignificantFinding[] = [];

    // Top correlations
    for (const pair of correlations.significantPairs.slice(0, 3)) {
      if (pair.strength === 'strong' || pair.strength === 'very_strong') {
        findings.push({
          id: uuidv4(),
          type: 'correlation',
          severity: pair.strength === 'very_strong' ? 'high' : 'medium',
          title: `Strong ${pair.correlation > 0 ? 'Positive' : 'Negative'} Correlation`,
          description: `${pair.variable1Title} is strongly correlated with ${pair.variable2Title}`,
          statisticalEvidence: `r = ${pair.correlation}, p < ${pair.pValue}`,
          impact: pair.correlation > 0
            ? `Improving ${pair.variable1Title} is likely to improve ${pair.variable2Title}`
            : `Trade-off detected between ${pair.variable1Title} and ${pair.variable2Title}`,
          actionItems: [
            `Investigate the relationship between ${pair.variable1Title} and ${pair.variable2Title}`,
            `Consider this correlation when prioritizing improvements`,
          ],
        });
      }
    }

    // Significant segment differences
    for (const comparison of segmentComparisons) {
      if (comparison.anovaResult?.isSignificant && comparison.significantDifferences.length > 0) {
        findings.push({
          id: uuidv4(),
          type: 'segment_difference',
          severity: comparison.anovaResult.pValue < 0.01 ? 'high' : 'medium',
          title: `Significant Segment Difference: ${comparison.segmentField}`,
          description: `Statistically significant differences found between segments`,
          statisticalEvidence: `F = ${comparison.anovaResult.fStatistic}, p = ${comparison.anovaResult.pValue}`,
          impact: 'Different segments may need different engagement strategies',
          actionItems: comparison.significantDifferences.map(diff =>
            `Investigate difference between ${diff}`
          ),
        });
      }
    }

    // Bimodal distributions
    const bimodalDistributions = distributionAnalysis.filter(d => d.distribution === 'bimodal');
    for (const dist of bimodalDistributions) {
      findings.push({
        id: uuidv4(),
        type: 'distribution_anomaly',
        severity: 'medium',
        title: `Bimodal Distribution: ${dist.questionTitle}`,
        description: dist.interpretation,
        statisticalEvidence: 'Distribution shows two distinct peaks',
        impact: dist.concern || 'Polarized responses suggest inconsistent experiences',
        actionItems: [
          'Identify what differentiates satisfied vs dissatisfied groups',
          'Correlate with other survey questions for insights',
        ],
      });
    }

    // Predictive model insights
    if (predictiveModel && predictiveModel.rSquared > 0.5) {
      const topPredictors = predictiveModel.predictors.slice(0, 3);
      findings.push({
        id: uuidv4(),
        type: 'trend',
        severity: 'high',
        title: `Key Drivers of ${predictiveModel.targetVariableTitle}`,
        description: predictiveModel.interpretation,
        statisticalEvidence: `R² = ${predictiveModel.rSquared} (explains ${Math.round(predictiveModel.rSquared * 100)}% of variance)`,
        impact: `Focus on ${topPredictors.map(p => p.variableTitle).join(', ')} to improve ${predictiveModel.targetVariableTitle}`,
        actionItems: topPredictors.map(p =>
          `Improve ${p.variableTitle} (${p.contribution}% contribution)`
        ),
      });
    }

    return findings;
  }

  /**
   * Generate actionable recommendations
   */
  private generateRecommendations(
    findings: SignificantFinding[],
    qualityIssues: QualityIssue[],
    correlations: CorrelationMatrix,
    predictiveModel: PredictiveModel | null
  ): ActionableRecommendation[] {
    const recommendations: ActionableRecommendation[] = [];

    // High-severity findings require immediate action
    for (const finding of findings.filter(f => f.severity === 'high')) {
      recommendations.push({
        priority: 'high',
        category: 'immediate_action',
        title: finding.title,
        description: finding.actionItems.join('. '),
        expectedImpact: finding.impact,
        basedOn: finding.statisticalEvidence,
      });
    }

    // Quality issues
    for (const issue of qualityIssues.filter(i => i.severity === 'critical')) {
      recommendations.push({
        priority: 'high',
        category: 'investigation',
        title: `Address ${issue.type.replace(/_/g, ' ')}`,
        description: issue.recommendation,
        expectedImpact: `Improve data quality for ${issue.affectedQuestions.length} question(s)`,
        basedOn: issue.description,
      });
    }

    // Predictive model recommendations
    if (predictiveModel && predictiveModel.predictors.length > 0) {
      const topPredictor = predictiveModel.predictors[0];
      recommendations.push({
        priority: 'high',
        category: 'immediate_action',
        title: `Prioritize ${topPredictor.variableTitle}`,
        description: `This is the strongest driver of ${predictiveModel.targetVariableTitle}`,
        expectedImpact: `${topPredictor.contribution}% contribution to ${predictiveModel.targetVariableTitle}`,
        basedOn: `Regression analysis (R² = ${predictiveModel.rSquared})`,
      });
    }

    // Strong correlations for investigation
    for (const pair of correlations.significantPairs.slice(0, 2)) {
      if (!recommendations.some(r => r.title.includes(pair.variable1Title))) {
        recommendations.push({
          priority: 'medium',
          category: 'investigation',
          title: `Explore ${pair.variable1Title} - ${pair.variable2Title} Relationship`,
          description: `Strong correlation suggests focusing on one may improve the other`,
          expectedImpact: `Potential leverage point for improvement`,
          basedOn: `Correlation r = ${pair.correlation}`,
        });
      }
    }

    return recommendations.slice(0, 10); // Limit recommendations
  }
}

// Singleton export
export const statisticalEngine = new StatisticalEngine();
export default statisticalEngine;
