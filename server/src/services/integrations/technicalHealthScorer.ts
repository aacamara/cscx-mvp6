/**
 * Technical Health Scorer Service
 * PRD-020: Calculate technical health scores from integration usage data
 *
 * Calculates health scores based on:
 * - API Success Rate (30% weight)
 * - Latency Score (20% weight)
 * - Error Trend (20% weight)
 * - Webhook Reliability (15% weight)
 * - Authentication Health (15% weight)
 */

import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { config } from '../../config/index.js';
import {
  ParsedIntegrationData,
  IntegrationUsageRecord,
  WebhookDeliveryRecord,
  TechnicalHealthScore,
  TechnicalHealthComponents,
  ComponentScore,
  IntegrationHealthBreakdown,
  IntegrationIssue,
  ErrorAnalysis,
  ErrorTrend,
  LatencyAnalysis,
  WebhookAnalysis,
  TechnicalRiskAssessment,
  TechnicalRiskFactor,
  TechnicalRecommendation,
  TechnicalHealthResponse,
  TECHNICAL_HEALTH_WEIGHTS,
} from './types.js';

let supabase: SupabaseClient | null = null;
if (config.supabaseUrl && config.supabaseServiceKey) {
  supabase = createClient(config.supabaseUrl, config.supabaseServiceKey);
}

// ============================================
// THRESHOLDS AND CONSTANTS
// ============================================

const THRESHOLDS = {
  // Success rate thresholds
  successRate: {
    healthy: 99,
    warning: 95,
    critical: 90,
  },
  // Latency thresholds (ms)
  latency: {
    healthy: 200,
    warning: 500,
    critical: 1000,
    p95SlaMultiplier: 2,
  },
  // Error rate thresholds (%)
  errorRate: {
    healthy: 1,
    warning: 5,
    critical: 10,
  },
  // Webhook delivery thresholds (%)
  webhookDelivery: {
    healthy: 99,
    warning: 95,
    critical: 90,
  },
  // Authentication error thresholds (%)
  authError: {
    healthy: 0.5,
    warning: 2,
    critical: 5,
  },
};

// SLA targets by integration type
const SLA_TARGETS: Record<string, number> = {
  salesforce: 500,
  slack: 200,
  hubspot: 500,
  google: 300,
  zoom: 400,
  custom_api: 1000,
  api: 500,
  webhook: 1000,
};

// ============================================
// TECHNICAL HEALTH SCORER SERVICE
// ============================================

class TechnicalHealthScorerService {
  /**
   * Calculate complete technical health analysis from parsed data
   */
  async calculateTechnicalHealth(
    data: ParsedIntegrationData,
    options: { previousScore?: number } = {}
  ): Promise<TechnicalHealthResponse> {
    const startTime = Date.now();

    // Calculate component scores
    const components = this.calculateComponents(data);

    // Calculate overall score
    const overallScore = Math.round(
      components.apiSuccessRate.weightedScore +
      components.latencyScore.weightedScore +
      components.errorTrend.weightedScore +
      components.webhookReliability.weightedScore +
      components.authenticationHealth.weightedScore
    );

    // Determine trend
    let trend: TechnicalHealthScore['trend'] = 'stable';
    if (options.previousScore !== undefined) {
      const diff = overallScore - options.previousScore;
      if (diff > 5) trend = 'improving';
      else if (diff < -5) trend = 'declining';
    }

    // Determine risk level
    const riskLevel = this.determineRiskLevel(overallScore, components);

    // Create health score
    const score: TechnicalHealthScore = {
      customerId: data.customerId,
      customerName: data.customerName,
      overallScore,
      targetScore: 90,
      trend,
      previousScore: options.previousScore,
      scoreChange: options.previousScore !== undefined ? overallScore - options.previousScore : undefined,
      calculatedAt: new Date().toISOString(),
      components,
      riskLevel,
    };

    // Calculate per-integration breakdown
    const integrations = this.calculateIntegrationBreakdowns(data);

    // Identify issues
    const { criticalIssues, warningIssues } = this.identifyIssues(data, integrations);

    // Perform error analysis
    const errorAnalysis = this.analyzeErrors(data);

    // Perform latency analysis
    const latencyAnalysis = this.analyzeLatency(data);

    // Perform webhook analysis
    const webhookAnalysis = this.analyzeWebhooks(data);

    // Assess risk
    const riskAssessment = this.assessRisk(score, criticalIssues, warningIssues, errorAnalysis);

    // Generate recommendations
    const recommendations = this.generateRecommendations(
      score,
      integrations,
      criticalIssues,
      warningIssues,
      errorAnalysis,
      latencyAnalysis,
      webhookAnalysis
    );

    const processingTimeMs = Date.now() - startTime;

    return {
      success: true,
      data: {
        score,
        integrations,
        criticalIssues,
        warningIssues,
        riskAssessment,
        recommendations,
        errorAnalysis: {
          topErrors: errorAnalysis.topErrors,
          errorTrends: errorAnalysis.trends,
        },
        latencyAnalysis,
        webhookAnalysis,
      },
      metadata: {
        dataRange: data.dateRange,
        totalRecordsAnalyzed: data.apiCalls.length + data.webhooks.length,
        processingTimeMs,
      },
    };
  }

  /**
   * Calculate all component scores
   */
  private calculateComponents(data: ParsedIntegrationData): TechnicalHealthComponents {
    return {
      apiSuccessRate: this.calculateApiSuccessRate(data.apiCalls),
      latencyScore: this.calculateLatencyScore(data.apiCalls),
      errorTrend: this.calculateErrorTrend(data.apiCalls),
      webhookReliability: this.calculateWebhookReliability(data.webhooks),
      authenticationHealth: this.calculateAuthenticationHealth(data.apiCalls),
    };
  }

  /**
   * Calculate API Success Rate component (30% weight)
   */
  private calculateApiSuccessRate(apiCalls: IntegrationUsageRecord[]): ComponentScore {
    const weight = TECHNICAL_HEALTH_WEIGHTS.apiSuccessRate;

    if (apiCalls.length === 0) {
      return {
        score: 100,
        weight,
        weightedScore: 100 * weight,
        status: 'healthy',
        details: 'No API calls to analyze',
        metrics: { successRate: 100, totalCalls: 0, successfulCalls: 0, failedCalls: 0 },
      };
    }

    const successfulCalls = apiCalls.filter(c => c.statusCode >= 200 && c.statusCode < 400).length;
    const successRate = (successfulCalls / apiCalls.length) * 100;

    // Convert success rate to score (99%+ = 100, linear decrease below)
    let score: number;
    if (successRate >= 99.5) score = 100;
    else if (successRate >= 99) score = 95;
    else if (successRate >= 98) score = 85;
    else if (successRate >= 95) score = 70;
    else if (successRate >= 90) score = 50;
    else score = Math.max(0, successRate / 2);

    const status = this.getStatus(successRate, THRESHOLDS.successRate);

    return {
      score,
      weight,
      weightedScore: score * weight,
      status,
      details: `${successRate.toFixed(1)}% success rate across ${apiCalls.length.toLocaleString()} calls`,
      metrics: {
        successRate: parseFloat(successRate.toFixed(2)),
        totalCalls: apiCalls.length,
        successfulCalls,
        failedCalls: apiCalls.length - successfulCalls,
      },
    };
  }

  /**
   * Calculate Latency Score component (20% weight)
   */
  private calculateLatencyScore(apiCalls: IntegrationUsageRecord[]): ComponentScore {
    const weight = TECHNICAL_HEALTH_WEIGHTS.latencyScore;

    if (apiCalls.length === 0) {
      return {
        score: 100,
        weight,
        weightedScore: 100 * weight,
        status: 'healthy',
        details: 'No API calls to analyze',
        metrics: { p50: 0, p95: 0, p99: 0, avg: 0 },
      };
    }

    const latencies = apiCalls.map(c => c.latencyMs).sort((a, b) => a - b);
    const p50 = this.percentile(latencies, 50);
    const p95 = this.percentile(latencies, 95);
    const p99 = this.percentile(latencies, 99);
    const avg = latencies.reduce((a, b) => a + b, 0) / latencies.length;

    // Score based on P95 latency
    let score: number;
    if (p95 <= 200) score = 100;
    else if (p95 <= 300) score = 90;
    else if (p95 <= 500) score = 75;
    else if (p95 <= 1000) score = 50;
    else if (p95 <= 2000) score = 30;
    else score = Math.max(0, 20 - (p95 - 2000) / 100);

    const status = this.getStatus(
      THRESHOLDS.latency.critical + 1 - p95, // Invert for latency
      { healthy: 1, warning: -THRESHOLDS.latency.warning, critical: -THRESHOLDS.latency.critical }
    );

    return {
      score,
      weight,
      weightedScore: score * weight,
      status,
      details: `P95 latency: ${p95.toFixed(0)}ms, P99: ${p99.toFixed(0)}ms`,
      metrics: {
        p50: Math.round(p50),
        p95: Math.round(p95),
        p99: Math.round(p99),
        avg: Math.round(avg),
      },
    };
  }

  /**
   * Calculate Error Trend component (20% weight)
   */
  private calculateErrorTrend(apiCalls: IntegrationUsageRecord[]): ComponentScore {
    const weight = TECHNICAL_HEALTH_WEIGHTS.errorTrend;

    if (apiCalls.length === 0) {
      return {
        score: 100,
        weight,
        weightedScore: 100 * weight,
        status: 'healthy',
        details: 'No API calls to analyze',
        metrics: { trend: 'stable', recentErrorRate: 0, previousErrorRate: 0 },
      };
    }

    // Split calls into recent (last 25%) and previous
    const sorted = [...apiCalls].sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
    const splitPoint = Math.floor(sorted.length * 0.75);
    const previousCalls = sorted.slice(0, splitPoint);
    const recentCalls = sorted.slice(splitPoint);

    const previousErrorRate = previousCalls.length > 0
      ? (previousCalls.filter(c => c.statusCode >= 400).length / previousCalls.length) * 100
      : 0;
    const recentErrorRate = recentCalls.length > 0
      ? (recentCalls.filter(c => c.statusCode >= 400).length / recentCalls.length) * 100
      : 0;

    // Determine trend direction
    let trend: 'improving' | 'stable' | 'worsening' = 'stable';
    const diff = recentErrorRate - previousErrorRate;
    if (diff < -1) trend = 'improving';
    else if (diff > 1) trend = 'worsening';

    // Score based on trend and current error rate
    let score: number;
    if (trend === 'improving') {
      score = Math.min(100, 80 + (previousErrorRate - recentErrorRate) * 2);
    } else if (trend === 'worsening') {
      score = Math.max(0, 70 - diff * 5 - recentErrorRate * 2);
    } else {
      // Stable - base score on current error rate
      if (recentErrorRate <= 1) score = 95;
      else if (recentErrorRate <= 3) score = 80;
      else if (recentErrorRate <= 5) score = 65;
      else if (recentErrorRate <= 10) score = 40;
      else score = Math.max(0, 30 - recentErrorRate);
    }

    const status = trend === 'worsening' ? 'critical' : trend === 'improving' ? 'healthy' : 'warning';

    return {
      score,
      weight,
      weightedScore: score * weight,
      status: recentErrorRate > 10 ? 'critical' : status,
      details: `Error rate ${trend}: ${recentErrorRate.toFixed(1)}% (was ${previousErrorRate.toFixed(1)}%)`,
      metrics: {
        trend,
        recentErrorRate: parseFloat(recentErrorRate.toFixed(2)),
        previousErrorRate: parseFloat(previousErrorRate.toFixed(2)),
        change: parseFloat(diff.toFixed(2)),
      },
    };
  }

  /**
   * Calculate Webhook Reliability component (15% weight)
   */
  private calculateWebhookReliability(webhooks: WebhookDeliveryRecord[]): ComponentScore {
    const weight = TECHNICAL_HEALTH_WEIGHTS.webhookReliability;

    if (webhooks.length === 0) {
      return {
        score: 100,
        weight,
        weightedScore: 100 * weight,
        status: 'healthy',
        details: 'No webhooks to analyze',
        metrics: { deliveryRate: 100, totalDeliveries: 0, failed: 0 },
      };
    }

    const delivered = webhooks.filter(w => w.status === 'delivered').length;
    const failed = webhooks.filter(w => w.status === 'failed').length;
    const deliveryRate = (delivered / webhooks.length) * 100;

    // Score based on delivery rate
    let score: number;
    if (deliveryRate >= 99) score = 100;
    else if (deliveryRate >= 98) score = 90;
    else if (deliveryRate >= 95) score = 75;
    else if (deliveryRate >= 90) score = 50;
    else score = Math.max(0, deliveryRate / 2);

    const status = this.getStatus(deliveryRate, THRESHOLDS.webhookDelivery);

    return {
      score,
      weight,
      weightedScore: score * weight,
      status,
      details: `${deliveryRate.toFixed(1)}% delivery success (${failed} failures)`,
      metrics: {
        deliveryRate: parseFloat(deliveryRate.toFixed(2)),
        totalDeliveries: webhooks.length,
        delivered,
        failed,
        retrying: webhooks.filter(w => w.status === 'retrying').length,
      },
    };
  }

  /**
   * Calculate Authentication Health component (15% weight)
   */
  private calculateAuthenticationHealth(apiCalls: IntegrationUsageRecord[]): ComponentScore {
    const weight = TECHNICAL_HEALTH_WEIGHTS.authenticationHealth;

    if (apiCalls.length === 0) {
      return {
        score: 100,
        weight,
        weightedScore: 100 * weight,
        status: 'healthy',
        details: 'No API calls to analyze',
        metrics: { authErrorRate: 0, authErrors: 0 },
      };
    }

    // Auth errors are 401 (Unauthorized) and 403 (Forbidden)
    const authErrors = apiCalls.filter(c => c.statusCode === 401 || c.statusCode === 403).length;
    const authErrorRate = (authErrors / apiCalls.length) * 100;

    // Score based on auth error rate
    let score: number;
    if (authErrorRate <= 0.1) score = 100;
    else if (authErrorRate <= 0.5) score = 90;
    else if (authErrorRate <= 1) score = 75;
    else if (authErrorRate <= 2) score = 50;
    else if (authErrorRate <= 5) score = 25;
    else score = 0;

    const status = this.getStatus(THRESHOLDS.authError.critical - authErrorRate, {
      healthy: THRESHOLDS.authError.critical - THRESHOLDS.authError.healthy,
      warning: THRESHOLDS.authError.critical - THRESHOLDS.authError.warning,
      critical: 0,
    });

    return {
      score,
      weight,
      weightedScore: score * weight,
      status,
      details: authErrors === 0 ? 'No authentication errors' : `${authErrors} auth errors (${authErrorRate.toFixed(2)}%)`,
      metrics: {
        authErrorRate: parseFloat(authErrorRate.toFixed(2)),
        authErrors,
        error401: apiCalls.filter(c => c.statusCode === 401).length,
        error403: apiCalls.filter(c => c.statusCode === 403).length,
      },
    };
  }

  /**
   * Calculate per-integration health breakdowns
   */
  private calculateIntegrationBreakdowns(data: ParsedIntegrationData): IntegrationHealthBreakdown[] {
    // Group API calls by integration
    const byIntegration = new Map<string, IntegrationUsageRecord[]>();
    for (const call of data.apiCalls) {
      const key = call.integrationName;
      if (!byIntegration.has(key)) byIntegration.set(key, []);
      byIntegration.get(key)!.push(call);
    }

    const breakdowns: IntegrationHealthBreakdown[] = [];

    for (const [name, calls] of byIntegration) {
      const successfulCalls = calls.filter(c => c.statusCode >= 200 && c.statusCode < 400).length;
      const successRate = (successfulCalls / calls.length) * 100;
      const errorCount = calls.length - successfulCalls;

      const latencies = calls.map(c => c.latencyMs).sort((a, b) => a - b);
      const avgLatency = latencies.reduce((a, b) => a + b, 0) / latencies.length;
      const p95Latency = this.percentile(latencies, 95);
      const p99Latency = this.percentile(latencies, 99);

      // Determine integration type
      const integrationType = calls[0]?.integrationType || 'api';
      const slaTarget = SLA_TARGETS[integrationType] || 500;

      // Calculate health score for this integration
      const successScore = successRate >= 99 ? 100 : successRate >= 95 ? 75 : 50;
      const latencyScore = p95Latency <= slaTarget ? 100 : p95Latency <= slaTarget * 1.5 ? 70 : 40;
      const healthScore = Math.round((successScore * 0.6) + (latencyScore * 0.4));

      // Determine status
      let status: 'healthy' | 'warning' | 'critical' = 'healthy';
      if (healthScore < 50 || errorCount > calls.length * 0.1) status = 'critical';
      else if (healthScore < 75 || errorCount > calls.length * 0.05) status = 'warning';

      // Determine SLA status
      let slaStatus: 'ok' | 'warning' | 'breach' = 'ok';
      const breachRate = calls.filter(c => c.latencyMs > slaTarget).length / calls.length;
      if (breachRate > 0.05) slaStatus = 'breach';
      else if (breachRate > 0.01) slaStatus = 'warning';

      breakdowns.push({
        integrationName: name,
        integrationType,
        healthScore,
        successRate: parseFloat(successRate.toFixed(1)),
        avgLatencyMs: Math.round(avgLatency),
        p95LatencyMs: Math.round(p95Latency),
        p99LatencyMs: Math.round(p99Latency),
        totalCalls: calls.length,
        errorCount,
        issues: [], // Will be populated by identifyIssues
        status,
        slaStatus,
        slaTarget,
      });
    }

    // Sort by health score (worst first)
    return breakdowns.sort((a, b) => a.healthScore - b.healthScore);
  }

  /**
   * Identify issues from the data
   */
  private identifyIssues(
    data: ParsedIntegrationData,
    integrations: IntegrationHealthBreakdown[]
  ): { criticalIssues: IntegrationIssue[]; warningIssues: IntegrationIssue[] } {
    const criticalIssues: IntegrationIssue[] = [];
    const warningIssues: IntegrationIssue[] = [];
    let issueId = 0;

    // Check each integration for issues
    for (const integration of integrations) {
      const calls = data.apiCalls.filter(c => c.integrationName === integration.integrationName);

      // High error rate issue
      if (integration.successRate < 95) {
        const issue: IntegrationIssue = {
          id: `issue-${++issueId}`,
          severity: integration.successRate < 90 ? 'critical' : 'high',
          type: 'high_error_rate',
          title: `${integration.integrationName} - High Error Rate`,
          description: `${(100 - integration.successRate).toFixed(1)}% of API calls are failing`,
          impact: 'Users experiencing degraded functionality',
          detectedAt: new Date().toISOString(),
          firstOccurrence: calls.find(c => c.statusCode >= 400)?.timestamp || new Date().toISOString(),
          count: integration.errorCount,
          trend: this.detectErrorTrend(calls),
        };
        integration.issues.push(issue);
        if (issue.severity === 'critical') criticalIssues.push(issue);
        else warningIssues.push(issue);
      }

      // Latency degradation issue
      if (integration.p95LatencyMs > (integration.slaTarget || 500)) {
        const issue: IntegrationIssue = {
          id: `issue-${++issueId}`,
          severity: integration.p95LatencyMs > (integration.slaTarget || 500) * 2 ? 'high' : 'medium',
          type: 'latency_degradation',
          title: `${integration.integrationName} - High Latency`,
          description: `P95 latency (${integration.p95LatencyMs}ms) exceeds SLA target (${integration.slaTarget}ms)`,
          impact: 'Slow response times affecting user experience',
          detectedAt: new Date().toISOString(),
          firstOccurrence: data.dateRange.start,
          count: calls.filter(c => c.latencyMs > (integration.slaTarget || 500)).length,
          trend: 'stable',
        };
        integration.issues.push(issue);
        warningIssues.push(issue);
      }

      // Rate limiting issue (429 errors)
      const rateLimitErrors = calls.filter(c => c.statusCode === 429).length;
      if (rateLimitErrors > 10 || rateLimitErrors / calls.length > 0.01) {
        const issue: IntegrationIssue = {
          id: `issue-${++issueId}`,
          severity: rateLimitErrors / calls.length > 0.05 ? 'critical' : 'high',
          type: 'rate_limiting',
          title: `${integration.integrationName} - Rate Limiting`,
          description: `${rateLimitErrors} requests were rate limited (429)`,
          impact: 'Feature adoption blocked, user frustration',
          detectedAt: new Date().toISOString(),
          firstOccurrence: calls.find(c => c.statusCode === 429)?.timestamp || new Date().toISOString(),
          count: rateLimitErrors,
          trend: this.detectErrorTrendByCode(calls, 429),
        };
        integration.issues.push(issue);
        if (issue.severity === 'critical') criticalIssues.push(issue);
        else warningIssues.push(issue);
      }

      // Auth failure issue (401 errors)
      const authErrors = calls.filter(c => c.statusCode === 401).length;
      if (authErrors > 5 || authErrors / calls.length > 0.005) {
        const issue: IntegrationIssue = {
          id: `issue-${++issueId}`,
          severity: 'high',
          type: 'authentication_failure',
          title: `${integration.integrationName} - Authentication Failures`,
          description: `${authErrors} authentication failures detected`,
          impact: 'Users may lose access intermittently',
          detectedAt: new Date().toISOString(),
          firstOccurrence: calls.find(c => c.statusCode === 401)?.timestamp || new Date().toISOString(),
          count: authErrors,
          trend: this.detectErrorTrendByCode(calls, 401),
        };
        integration.issues.push(issue);
        warningIssues.push(issue);
      }
    }

    // Webhook delivery issues
    const failedWebhooks = data.webhooks.filter(w => w.status === 'failed');
    if (failedWebhooks.length > 10 || failedWebhooks.length / data.webhooks.length > 0.05) {
      const issue: IntegrationIssue = {
        id: `issue-${++issueId}`,
        severity: failedWebhooks.length / data.webhooks.length > 0.1 ? 'critical' : 'high',
        type: 'webhook_delivery_failure',
        title: 'Webhook Delivery Issues',
        description: `${failedWebhooks.length} webhook deliveries failed`,
        impact: 'Delayed notifications, data sync issues',
        detectedAt: new Date().toISOString(),
        firstOccurrence: failedWebhooks[0]?.timestamp || new Date().toISOString(),
        count: failedWebhooks.length,
        trend: 'stable',
      };
      if (issue.severity === 'critical') criticalIssues.push(issue);
      else warningIssues.push(issue);
    }

    return { criticalIssues, warningIssues };
  }

  /**
   * Analyze errors in detail
   */
  private analyzeErrors(data: ParsedIntegrationData): { topErrors: ErrorAnalysis[]; trends: ErrorTrend[] } {
    const errorCalls = data.apiCalls.filter(c => c.statusCode >= 400);

    // Group errors by status code
    const byCode = new Map<number, IntegrationUsageRecord[]>();
    for (const call of errorCalls) {
      if (!byCode.has(call.statusCode)) byCode.set(call.statusCode, []);
      byCode.get(call.statusCode)!.push(call);
    }

    const topErrors: ErrorAnalysis[] = [];
    for (const [code, calls] of byCode) {
      const sorted = [...calls].sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
      const endpoints = [...new Set(calls.map(c => c.endpoint))];

      topErrors.push({
        errorCode: code.toString(),
        count: calls.length,
        percentage: (calls.length / errorCalls.length) * 100,
        description: this.getErrorDescription(code),
        trend: this.detectErrorTrendForGroup(sorted),
        firstSeen: sorted[0]?.timestamp || '',
        lastSeen: sorted[sorted.length - 1]?.timestamp || '',
        affectedEndpoints: endpoints.slice(0, 5),
        rootCauseHypothesis: this.generateRootCauseHypothesis(code, calls),
      });
    }

    // Sort by count
    topErrors.sort((a, b) => b.count - a.count);

    // Calculate weekly trends
    const trends = this.calculateWeeklyErrorTrends(data.apiCalls);

    return { topErrors: topErrors.slice(0, 10), trends };
  }

  /**
   * Analyze latency patterns
   */
  private analyzeLatency(data: ParsedIntegrationData): LatencyAnalysis[] {
    const byIntegration = new Map<string, IntegrationUsageRecord[]>();
    for (const call of data.apiCalls) {
      if (!byIntegration.has(call.integrationName)) byIntegration.set(call.integrationName, []);
      byIntegration.get(call.integrationName)!.push(call);
    }

    const analyses: LatencyAnalysis[] = [];
    for (const [name, calls] of byIntegration) {
      const latencies = calls.map(c => c.latencyMs).sort((a, b) => a - b);
      const slaTarget = SLA_TARGETS[calls[0]?.integrationType || 'api'] || 500;

      const breaches = calls.filter(c => c.latencyMs > slaTarget).length;
      const breachPercentage = (breaches / calls.length) * 100;

      let status: 'ok' | 'warning' | 'breach' = 'ok';
      if (breachPercentage > 5) status = 'breach';
      else if (breachPercentage > 1) status = 'warning';

      analyses.push({
        integrationName: name,
        p50Ms: Math.round(this.percentile(latencies, 50)),
        p95Ms: Math.round(this.percentile(latencies, 95)),
        p99Ms: Math.round(this.percentile(latencies, 99)),
        avgMs: Math.round(latencies.reduce((a, b) => a + b, 0) / latencies.length),
        maxMs: Math.round(latencies[latencies.length - 1] || 0),
        slaTargetMs: slaTarget,
        status,
        breachPercentage: parseFloat(breachPercentage.toFixed(1)),
      });
    }

    return analyses.sort((a, b) => b.p95Ms - a.p95Ms);
  }

  /**
   * Analyze webhook patterns
   */
  private analyzeWebhooks(data: ParsedIntegrationData): WebhookAnalysis[] {
    if (data.webhooks.length === 0) return [];

    const byName = new Map<string, WebhookDeliveryRecord[]>();
    for (const wh of data.webhooks) {
      const key = wh.webhookName;
      if (!byName.has(key)) byName.set(key, []);
      byName.get(key)!.push(wh);
    }

    const analyses: WebhookAnalysis[] = [];
    for (const [name, webhooks] of byName) {
      const delivered = webhooks.filter(w => w.status === 'delivered').length;
      const failed = webhooks.filter(w => w.status === 'failed');

      // Group failures by reason
      const byReason = new Map<string, number>();
      for (const f of failed) {
        const reason = f.failureReason || 'Unknown';
        byReason.set(reason, (byReason.get(reason) || 0) + 1);
      }

      const failuresByReason = Array.from(byReason.entries())
        .map(([reason, count]) => ({
          reason,
          count,
          percentage: (count / failed.length) * 100,
        }))
        .sort((a, b) => b.count - a.count);

      // Detect failure pattern
      let failurePattern: string | undefined;
      if (failed.length > 10) {
        // Check for time-based patterns
        const hourCounts = new Map<number, number>();
        for (const f of failed) {
          const hour = new Date(f.timestamp).getHours();
          hourCounts.set(hour, (hourCounts.get(hour) || 0) + 1);
        }
        const maxHourCount = Math.max(...hourCounts.values());
        const peakHours = Array.from(hourCounts.entries())
          .filter(([, count]) => count >= maxHourCount * 0.8)
          .map(([hour]) => hour);
        if (peakHours.length <= 3) {
          failurePattern = `Failures cluster between ${peakHours.map(h => `${h}:00`).join('-')} (high traffic period?)`;
        }
      }

      analyses.push({
        webhookName: name,
        deliverySuccessRate: parseFloat(((delivered / webhooks.length) * 100).toFixed(1)),
        targetSuccessRate: 99,
        totalDeliveries: webhooks.length,
        failedDeliveries: failed.length,
        avgRetries: webhooks.reduce((sum, w) => sum + w.retryCount, 0) / webhooks.length,
        failuresByReason,
        failurePattern,
      });
    }

    return analyses.sort((a, b) => a.deliverySuccessRate - b.deliverySuccessRate);
  }

  /**
   * Assess overall technical risk
   */
  private assessRisk(
    score: TechnicalHealthScore,
    criticalIssues: IntegrationIssue[],
    warningIssues: IntegrationIssue[],
    errorAnalysis: { topErrors: ErrorAnalysis[]; trends: ErrorTrend[] }
  ): TechnicalRiskAssessment {
    const riskFactors: TechnicalRiskFactor[] = [];

    // Check for escalating error trends
    const lastTrend = errorAnalysis.trends[errorAnalysis.trends.length - 1];
    const previousTrend = errorAnalysis.trends[errorAnalysis.trends.length - 2];
    if (lastTrend && previousTrend && lastTrend.errorRate > previousTrend.errorRate * 1.5) {
      riskFactors.push({
        factor: 'Error Rate Escalation',
        level: lastTrend.errorRate > 10 ? 'critical' : 'high',
        impact: 'Increasing errors will impact user experience',
        trend: 'escalating',
      });
    }

    // Check for rate limiting
    const rateLimitIssues = criticalIssues.filter(i => i.type === 'rate_limiting');
    if (rateLimitIssues.length > 0) {
      riskFactors.push({
        factor: 'Rate Limiting',
        level: rateLimitIssues[0].severity === 'critical' ? 'high' : 'medium',
        impact: 'Feature adoption blocked',
        trend: rateLimitIssues[0].trend,
      });
    }

    // Check for webhook reliability
    const webhookIssues = [...criticalIssues, ...warningIssues].filter(i => i.type === 'webhook_delivery_failure');
    if (webhookIssues.length > 0) {
      riskFactors.push({
        factor: 'Webhook Reliability',
        level: 'medium',
        impact: 'Delayed notifications',
        trend: 'stable',
      });
    }

    // Check for auth issues
    const authIssues = [...criticalIssues, ...warningIssues].filter(i => i.type === 'authentication_failure');
    if (authIssues.length > 0) {
      riskFactors.push({
        factor: 'Auth Token Issues',
        level: 'low',
        impact: 'Intermittent access',
        trend: authIssues[0].trend,
      });
    }

    // Determine overall risk and urgency
    let overallRisk: TechnicalRiskAssessment['overallRisk'] = 'low';
    let urgency: TechnicalRiskAssessment['urgency'] = 'monitor';

    if (criticalIssues.length > 0 || score.overallScore < 50) {
      overallRisk = 'critical';
      urgency = 'immediate';
    } else if (warningIssues.length > 2 || score.overallScore < 70) {
      overallRisk = 'high';
      urgency = 'this_week';
    } else if (warningIssues.length > 0 || score.overallScore < 85) {
      overallRisk = 'medium';
      urgency = 'short_term';
    }

    const projectedImpact: string[] = [];
    if (overallRisk === 'critical' || overallRisk === 'high') {
      projectedImpact.push('Users will lose trust in reporting feature');
      projectedImpact.push('Support tickets will increase');
      projectedImpact.push('May impact renewal conversation');
    }

    return { overallRisk, riskFactors, projectedImpact, urgency };
  }

  /**
   * Generate recommendations based on analysis
   */
  private generateRecommendations(
    score: TechnicalHealthScore,
    integrations: IntegrationHealthBreakdown[],
    criticalIssues: IntegrationIssue[],
    warningIssues: IntegrationIssue[],
    errorAnalysis: { topErrors: ErrorAnalysis[]; trends: ErrorTrend[] },
    latencyAnalysis: LatencyAnalysis[],
    webhookAnalysis: WebhookAnalysis[]
  ): TechnicalRecommendation[] {
    const recommendations: TechnicalRecommendation[] = [];
    let recId = 0;

    // Rate limit recommendation
    const rateLimitIssues = criticalIssues.filter(i => i.type === 'rate_limiting');
    if (rateLimitIssues.length > 0) {
      recommendations.push({
        id: `rec-${++recId}`,
        priority: 'immediate',
        category: 'rate_limit',
        title: 'Increase API rate limits',
        description: 'Customer is hitting rate limits frequently. Increasing limits will resolve 429 errors.',
        expectedImpact: `Will resolve ${((rateLimitIssues.reduce((sum, i) => sum + i.count, 0) / errorAnalysis.topErrors.reduce((sum, e) => sum + e.count, 1)) * 100).toFixed(0)}% of errors`,
        actionItems: [
          'Review current rate limit configuration',
          'Increase rate limit from current to recommended level',
          'Monitor error rates after change',
        ],
        estimatedEffort: 'low',
      });
    }

    // Error investigation recommendation
    const serverErrors = errorAnalysis.topErrors.filter(e => e.errorCode.startsWith('5'));
    if (serverErrors.length > 0) {
      recommendations.push({
        id: `rec-${++recId}`,
        priority: 'immediate',
        category: 'error_investigation',
        title: 'Investigate 500 errors',
        description: `Server errors are occurring on ${serverErrors[0]?.affectedEndpoints.length || 0} endpoints. Root cause investigation needed.`,
        expectedImpact: 'Resolving will improve reliability significantly',
        actionItems: [
          'Schedule technical call with customer dev team',
          'Review server logs for affected endpoints',
          'Check for patterns in large data requests',
        ],
        estimatedEffort: 'medium',
      });
    }

    // Webhook optimization
    const lowReliabilityWebhooks = webhookAnalysis.filter(w => w.deliverySuccessRate < 95);
    if (lowReliabilityWebhooks.length > 0) {
      recommendations.push({
        id: `rec-${++recId}`,
        priority: 'short_term',
        category: 'webhook',
        title: 'Webhook endpoint optimization',
        description: 'Customer webhook endpoints may need load balancing or optimization.',
        expectedImpact: 'Improve webhook delivery rate to 99%+',
        actionItems: [
          'Share best practices documentation',
          'Review endpoint configuration',
          'Consider implementing retry backoff',
        ],
        estimatedEffort: 'medium',
      });
    }

    // Auth token audit
    const authIssues = [...criticalIssues, ...warningIssues].filter(i => i.type === 'authentication_failure');
    if (authIssues.length > 0) {
      recommendations.push({
        id: `rec-${++recId}`,
        priority: 'short_term',
        category: 'authentication',
        title: 'Token refresh audit',
        description: 'Authentication failures detected. Review token refresh cycle for issues.',
        expectedImpact: 'Eliminate intermittent auth errors',
        actionItems: [
          'Review token refresh schedule',
          'Check for timezone-related issues',
          'Validate OAuth scope configuration',
        ],
        estimatedEffort: 'low',
      });
    }

    // Performance optimization
    const slowIntegrations = latencyAnalysis.filter(l => l.status === 'breach');
    if (slowIntegrations.length > 0) {
      recommendations.push({
        id: `rec-${++recId}`,
        priority: 'medium_term',
        category: 'performance',
        title: 'API performance optimization',
        description: `${slowIntegrations.length} integration(s) are breaching SLA latency targets.`,
        expectedImpact: 'Improve response times by 40-60%',
        actionItems: [
          'Implement request caching where appropriate',
          'Review query optimization opportunities',
          'Consider pagination for large data sets',
        ],
        estimatedEffort: 'high',
      });
    }

    return recommendations;
  }

  // ============================================
  // HELPER METHODS
  // ============================================

  private percentile(arr: number[], p: number): number {
    if (arr.length === 0) return 0;
    const index = Math.ceil((p / 100) * arr.length) - 1;
    return arr[Math.max(0, Math.min(arr.length - 1, index))];
  }

  private getStatus(
    value: number,
    thresholds: { healthy: number; warning: number; critical: number }
  ): 'healthy' | 'warning' | 'critical' {
    if (value >= thresholds.healthy) return 'healthy';
    if (value >= thresholds.warning) return 'warning';
    return 'critical';
  }

  private determineRiskLevel(
    score: number,
    components: TechnicalHealthComponents
  ): TechnicalHealthScore['riskLevel'] {
    if (score < 50 || components.apiSuccessRate.status === 'critical') return 'critical';
    if (score < 70 || components.errorTrend.status === 'critical') return 'high';
    if (score < 85) return 'medium';
    return 'low';
  }

  private detectErrorTrend(calls: IntegrationUsageRecord[]): IntegrationIssue['trend'] {
    if (calls.length < 100) return 'stable';
    const sorted = [...calls].sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
    const firstHalf = sorted.slice(0, sorted.length / 2);
    const secondHalf = sorted.slice(sorted.length / 2);
    const firstRate = firstHalf.filter(c => c.statusCode >= 400).length / firstHalf.length;
    const secondRate = secondHalf.filter(c => c.statusCode >= 400).length / secondHalf.length;
    if (secondRate > firstRate * 1.3) return 'escalating';
    if (secondRate < firstRate * 0.7) return 'improving';
    return 'stable';
  }

  private detectErrorTrendByCode(calls: IntegrationUsageRecord[], code: number): IntegrationIssue['trend'] {
    const errorCalls = calls.filter(c => c.statusCode === code);
    if (errorCalls.length < 10) return 'stable';
    return this.detectErrorTrend(errorCalls);
  }

  private detectErrorTrendForGroup(sorted: IntegrationUsageRecord[]): ErrorAnalysis['trend'] {
    if (sorted.length < 10) return 'stable';
    const firstHalf = sorted.slice(0, sorted.length / 2).length;
    const secondHalf = sorted.slice(sorted.length / 2).length;
    if (secondHalf > firstHalf * 1.3) return 'increasing';
    if (secondHalf < firstHalf * 0.7) return 'decreasing';
    return 'stable';
  }

  private calculateWeeklyErrorTrends(calls: IntegrationUsageRecord[]): ErrorTrend[] {
    if (calls.length === 0) return [];

    const sorted = [...calls].sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
    const startDate = new Date(sorted[0].timestamp);
    const endDate = new Date(sorted[sorted.length - 1].timestamp);

    const weeks: ErrorTrend[] = [];
    let weekStart = new Date(startDate);
    let weekNum = 1;

    while (weekStart < endDate) {
      const weekEnd = new Date(weekStart);
      weekEnd.setDate(weekEnd.getDate() + 7);

      const weekCalls = sorted.filter(c => {
        const ts = new Date(c.timestamp);
        return ts >= weekStart && ts < weekEnd;
      });

      if (weekCalls.length > 0) {
        const errors = weekCalls.filter(c => c.statusCode >= 400).length;
        weeks.push({
          week: weekNum,
          weekLabel: `Week ${weekNum}`,
          errorRate: parseFloat(((errors / weekCalls.length) * 100).toFixed(1)),
          errorCount: errors,
          totalCalls: weekCalls.length,
        });
      }

      weekStart = weekEnd;
      weekNum++;
    }

    return weeks;
  }

  private getErrorDescription(code: number): string {
    const descriptions: Record<number, string> = {
      400: 'Bad Request - Invalid request format',
      401: 'Authentication failed',
      403: 'Forbidden - Insufficient permissions',
      404: 'Not Found - Resource does not exist',
      408: 'Request timeout',
      429: 'Rate limit exceeded',
      500: 'Internal server error',
      502: 'Bad Gateway',
      503: 'Service unavailable',
      504: 'Gateway timeout',
    };
    return descriptions[code] || `HTTP ${code} error`;
  }

  private generateRootCauseHypothesis(code: number, calls: IntegrationUsageRecord[]): string | undefined {
    if (code === 429) {
      // Check if rate limits started after a certain date
      const sorted = [...calls].sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
      if (sorted.length > 10) {
        const firstDate = new Date(sorted[0].timestamp).toLocaleDateString();
        return `429 errors started ${firstDate} (new feature launched?)`;
      }
    }
    if (code === 500) {
      // Check for correlation with large requests
      const hasLargeRequests = calls.some(c => (c.requestSize || 0) > 1000000);
      if (hasLargeRequests) {
        return '500 errors correlate with large data requests';
      }
    }
    if (code === 401) {
      // Check for time patterns
      const bySunday = calls.filter(c => new Date(c.timestamp).getDay() === 0);
      if (bySunday.length / calls.length > 0.3) {
        return 'Authentication errors occur every Sunday (token refresh issue?)';
      }
    }
    return undefined;
  }

  /**
   * Save technical health score to database
   */
  async saveScore(score: TechnicalHealthScore): Promise<void> {
    if (!supabase) return;

    await supabase.from('technical_health_scores').insert({
      customer_id: score.customerId,
      overall_score: score.overallScore,
      target_score: score.targetScore,
      trend: score.trend,
      previous_score: score.previousScore,
      score_change: score.scoreChange,
      components: score.components,
      risk_level: score.riskLevel,
      calculated_at: score.calculatedAt,
    });
  }

  /**
   * Get previous score for customer
   */
  async getPreviousScore(customerId: string): Promise<number | undefined> {
    if (!supabase) return undefined;

    const { data } = await supabase
      .from('technical_health_scores')
      .select('overall_score')
      .eq('customer_id', customerId)
      .order('calculated_at', { ascending: false })
      .limit(1)
      .single();

    return data?.overall_score;
  }
}

// Export singleton instance
export const technicalHealthScorer = new TechnicalHealthScorerService();
export default technicalHealthScorer;
