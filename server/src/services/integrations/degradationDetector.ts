/**
 * Degradation Detector Service
 * PRD-020: Detect integration degradation patterns before critical failure
 *
 * Features:
 * - Trend analysis for error rates
 * - Latency degradation detection
 * - Pattern recognition for common issues
 * - Early warning alerts
 */

import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { config } from '../../config/index.js';
import {
  ParsedIntegrationData,
  IntegrationUsageRecord,
  WebhookDeliveryRecord,
  IntegrationIssue,
  IntegrationIssueType,
} from './types.js';

let supabase: SupabaseClient | null = null;
if (config.supabaseUrl && config.supabaseServiceKey) {
  supabase = createClient(config.supabaseUrl, config.supabaseServiceKey);
}

// ============================================
// DEGRADATION THRESHOLDS
// ============================================

const DEGRADATION_THRESHOLDS = {
  // Error rate increase thresholds
  errorRate: {
    warning: 1.5, // 50% increase from baseline
    critical: 2.0, // 100% increase from baseline
    absolute: {
      warning: 5, // 5% absolute error rate
      critical: 10, // 10% absolute error rate
    },
  },
  // Latency increase thresholds
  latency: {
    warning: 1.5, // 50% increase from baseline
    critical: 2.0, // 100% increase from baseline
    absolute: {
      warning: 1000, // 1 second P95
      critical: 2000, // 2 seconds P95
    },
  },
  // Minimum samples for trend analysis
  minSamples: 100,
  // Time windows for trend analysis
  windowSize: 0.25, // 25% of data for each window
};

// ============================================
// DEGRADATION PATTERN TYPES
// ============================================

export interface DegradationPattern {
  id: string;
  type: 'error_rate' | 'latency' | 'availability' | 'rate_limit' | 'auth' | 'webhook';
  severity: 'warning' | 'critical';
  integrationName: string;
  description: string;
  trend: {
    baseline: number;
    current: number;
    change: number;
    changePercent: number;
  };
  timeline: TrendPoint[];
  predictedImpact: string;
  detectedAt: string;
  firstSignalAt: string;
  confidence: number; // 0-100
}

export interface TrendPoint {
  timestamp: string;
  value: number;
  label: string;
}

export interface DegradationAlert {
  id: string;
  customerId: string;
  customerName: string;
  patterns: DegradationPattern[];
  overallSeverity: 'warning' | 'critical';
  summary: string;
  recommendedActions: string[];
  createdAt: string;
}

// ============================================
// DEGRADATION DETECTOR SERVICE
// ============================================

class DegradationDetectorService {
  /**
   * Detect degradation patterns in integration data
   */
  async detectDegradation(data: ParsedIntegrationData): Promise<{
    patterns: DegradationPattern[];
    alerts: DegradationAlert[];
  }> {
    const patterns: DegradationPattern[] = [];
    let patternId = 0;

    // Group data by integration
    const byIntegration = this.groupByIntegration(data.apiCalls);

    // Detect patterns for each integration
    for (const [integrationName, calls] of byIntegration) {
      // Error rate degradation
      const errorPattern = this.detectErrorRateDegradation(calls, integrationName, ++patternId);
      if (errorPattern) patterns.push(errorPattern);

      // Latency degradation
      const latencyPattern = this.detectLatencyDegradation(calls, integrationName, ++patternId);
      if (latencyPattern) patterns.push(latencyPattern);

      // Rate limiting escalation
      const rateLimitPattern = this.detectRateLimitEscalation(calls, integrationName, ++patternId);
      if (rateLimitPattern) patterns.push(rateLimitPattern);

      // Authentication degradation
      const authPattern = this.detectAuthDegradation(calls, integrationName, ++patternId);
      if (authPattern) patterns.push(authPattern);

      // Timeout spike detection
      const timeoutPattern = this.detectTimeoutSpike(calls, integrationName, ++patternId);
      if (timeoutPattern) patterns.push(timeoutPattern);
    }

    // Webhook degradation
    if (data.webhooks.length > 0) {
      const webhookPattern = this.detectWebhookDegradation(data.webhooks, ++patternId);
      if (webhookPattern) patterns.push(webhookPattern);
    }

    // Generate alerts from patterns
    const alerts = this.generateAlerts(data, patterns);

    return { patterns, alerts };
  }

  /**
   * Detect error rate degradation over time
   */
  private detectErrorRateDegradation(
    calls: IntegrationUsageRecord[],
    integrationName: string,
    patternId: number
  ): DegradationPattern | null {
    if (calls.length < DEGRADATION_THRESHOLDS.minSamples) return null;

    const sorted = this.sortByTimestamp(calls);
    const windows = this.splitIntoWindows(sorted, 4);

    if (windows.length < 2) return null;

    // Calculate error rate for each window
    const errorRates = windows.map(window => {
      const errors = window.filter(c => c.statusCode >= 400).length;
      return (errors / window.length) * 100;
    });

    // Detect trend
    const baseline = this.calculateBaseline(errorRates.slice(0, 2));
    const current = errorRates[errorRates.length - 1];
    const change = current - baseline;
    const changePercent = baseline > 0 ? (change / baseline) * 100 : current > 0 ? 100 : 0;

    // Check if degradation is significant
    const isWarning = changePercent >= (DEGRADATION_THRESHOLDS.errorRate.warning - 1) * 100 ||
                     current >= DEGRADATION_THRESHOLDS.errorRate.absolute.warning;
    const isCritical = changePercent >= (DEGRADATION_THRESHOLDS.errorRate.critical - 1) * 100 ||
                      current >= DEGRADATION_THRESHOLDS.errorRate.absolute.critical;

    if (!isWarning && !isCritical) return null;

    // Build timeline
    const timeline = this.buildTimeline(windows, w => {
      const errors = w.filter(c => c.statusCode >= 400).length;
      return (errors / w.length) * 100;
    });

    return {
      id: `deg-${patternId}`,
      type: 'error_rate',
      severity: isCritical ? 'critical' : 'warning',
      integrationName,
      description: `Error rate ${change > 0 ? 'increased' : 'changed'} from ${baseline.toFixed(1)}% to ${current.toFixed(1)}%`,
      trend: {
        baseline: parseFloat(baseline.toFixed(2)),
        current: parseFloat(current.toFixed(2)),
        change: parseFloat(change.toFixed(2)),
        changePercent: parseFloat(changePercent.toFixed(1)),
      },
      timeline,
      predictedImpact: current > 10
        ? 'High user impact - degraded functionality'
        : 'Moderate user impact - some errors occurring',
      detectedAt: new Date().toISOString(),
      firstSignalAt: windows[this.findFirstSignalWindow(errorRates, baseline)]?.[0]?.timestamp || new Date().toISOString(),
      confidence: this.calculateConfidence(calls.length, changePercent),
    };
  }

  /**
   * Detect latency degradation over time
   */
  private detectLatencyDegradation(
    calls: IntegrationUsageRecord[],
    integrationName: string,
    patternId: number
  ): DegradationPattern | null {
    if (calls.length < DEGRADATION_THRESHOLDS.minSamples) return null;

    const sorted = this.sortByTimestamp(calls);
    const windows = this.splitIntoWindows(sorted, 4);

    if (windows.length < 2) return null;

    // Calculate P95 latency for each window
    const p95Latencies = windows.map(window => {
      const latencies = window.map(c => c.latencyMs).sort((a, b) => a - b);
      return this.percentile(latencies, 95);
    });

    // Detect trend
    const baseline = this.calculateBaseline(p95Latencies.slice(0, 2));
    const current = p95Latencies[p95Latencies.length - 1];
    const change = current - baseline;
    const changePercent = baseline > 0 ? (change / baseline) * 100 : 0;

    // Check if degradation is significant
    const isWarning = changePercent >= (DEGRADATION_THRESHOLDS.latency.warning - 1) * 100 ||
                     current >= DEGRADATION_THRESHOLDS.latency.absolute.warning;
    const isCritical = changePercent >= (DEGRADATION_THRESHOLDS.latency.critical - 1) * 100 ||
                      current >= DEGRADATION_THRESHOLDS.latency.absolute.critical;

    if (!isWarning && !isCritical) return null;

    // Build timeline
    const timeline = this.buildTimeline(windows, w => {
      const latencies = w.map(c => c.latencyMs).sort((a, b) => a - b);
      return this.percentile(latencies, 95);
    });

    return {
      id: `deg-${patternId}`,
      type: 'latency',
      severity: isCritical ? 'critical' : 'warning',
      integrationName,
      description: `P95 latency increased from ${baseline.toFixed(0)}ms to ${current.toFixed(0)}ms`,
      trend: {
        baseline: Math.round(baseline),
        current: Math.round(current),
        change: Math.round(change),
        changePercent: parseFloat(changePercent.toFixed(1)),
      },
      timeline,
      predictedImpact: current > 2000
        ? 'High user impact - significant delays'
        : 'Moderate user impact - slower responses',
      detectedAt: new Date().toISOString(),
      firstSignalAt: windows[this.findFirstSignalWindow(p95Latencies, baseline)]?.[0]?.timestamp || new Date().toISOString(),
      confidence: this.calculateConfidence(calls.length, changePercent),
    };
  }

  /**
   * Detect rate limiting escalation
   */
  private detectRateLimitEscalation(
    calls: IntegrationUsageRecord[],
    integrationName: string,
    patternId: number
  ): DegradationPattern | null {
    const rateLimitCalls = calls.filter(c => c.statusCode === 429);
    if (rateLimitCalls.length < 10) return null;

    const sorted = this.sortByTimestamp(calls);
    const windows = this.splitIntoWindows(sorted, 4);

    // Calculate rate limit percentage for each window
    const rateLimitRates = windows.map(window => {
      const limited = window.filter(c => c.statusCode === 429).length;
      return (limited / window.length) * 100;
    });

    // Check for escalation
    const baseline = this.calculateBaseline(rateLimitRates.slice(0, 2));
    const current = rateLimitRates[rateLimitRates.length - 1];

    // Rate limiting is concerning even at low absolute levels if increasing
    if (current < 1 && current <= baseline * 1.2) return null;

    const change = current - baseline;
    const changePercent = baseline > 0 ? (change / baseline) * 100 : current > 0 ? 100 : 0;

    const timeline = this.buildTimeline(windows, w => {
      const limited = w.filter(c => c.statusCode === 429).length;
      return (limited / w.length) * 100;
    });

    return {
      id: `deg-${patternId}`,
      type: 'rate_limit',
      severity: current > 5 ? 'critical' : 'warning',
      integrationName,
      description: `Rate limiting ${change > 0 ? 'escalating' : 'detected'}: ${current.toFixed(1)}% of requests throttled`,
      trend: {
        baseline: parseFloat(baseline.toFixed(2)),
        current: parseFloat(current.toFixed(2)),
        change: parseFloat(change.toFixed(2)),
        changePercent: parseFloat(changePercent.toFixed(1)),
      },
      timeline,
      predictedImpact: 'Feature adoption blocked, user frustration increasing',
      detectedAt: new Date().toISOString(),
      firstSignalAt: rateLimitCalls[0]?.timestamp || new Date().toISOString(),
      confidence: this.calculateConfidence(calls.length, Math.abs(changePercent)),
    };
  }

  /**
   * Detect authentication degradation
   */
  private detectAuthDegradation(
    calls: IntegrationUsageRecord[],
    integrationName: string,
    patternId: number
  ): DegradationPattern | null {
    const authCalls = calls.filter(c => c.statusCode === 401 || c.statusCode === 403);
    if (authCalls.length < 5) return null;

    const sorted = this.sortByTimestamp(calls);
    const windows = this.splitIntoWindows(sorted, 4);

    const authErrorRates = windows.map(window => {
      const authErrors = window.filter(c => c.statusCode === 401 || c.statusCode === 403).length;
      return (authErrors / window.length) * 100;
    });

    const baseline = this.calculateBaseline(authErrorRates.slice(0, 2));
    const current = authErrorRates[authErrorRates.length - 1];

    // Auth errors are concerning even at very low levels
    if (current < 0.5 && current <= baseline) return null;

    const change = current - baseline;

    const timeline = this.buildTimeline(windows, w => {
      const authErrors = w.filter(c => c.statusCode === 401 || c.statusCode === 403).length;
      return (authErrors / w.length) * 100;
    });

    // Check for time-based patterns
    const dayOfWeekCounts = new Map<number, number>();
    for (const call of authCalls) {
      const day = new Date(call.timestamp).getDay();
      dayOfWeekCounts.set(day, (dayOfWeekCounts.get(day) || 0) + 1);
    }

    let timePattern = '';
    const maxDay = Array.from(dayOfWeekCounts.entries()).sort((a, b) => b[1] - a[1])[0];
    if (maxDay && maxDay[1] > authCalls.length * 0.3) {
      const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
      timePattern = ` (concentrated on ${days[maxDay[0]]}s - possible token refresh issue)`;
    }

    return {
      id: `deg-${patternId}`,
      type: 'auth',
      severity: current > 2 ? 'critical' : 'warning',
      integrationName,
      description: `Authentication failures detected: ${current.toFixed(2)}%${timePattern}`,
      trend: {
        baseline: parseFloat(baseline.toFixed(2)),
        current: parseFloat(current.toFixed(2)),
        change: parseFloat(change.toFixed(2)),
        changePercent: baseline > 0 ? parseFloat(((change / baseline) * 100).toFixed(1)) : 100,
      },
      timeline,
      predictedImpact: 'Users experiencing intermittent access issues',
      detectedAt: new Date().toISOString(),
      firstSignalAt: authCalls[0]?.timestamp || new Date().toISOString(),
      confidence: this.calculateConfidence(calls.length, current * 10),
    };
  }

  /**
   * Detect timeout spike
   */
  private detectTimeoutSpike(
    calls: IntegrationUsageRecord[],
    integrationName: string,
    patternId: number
  ): DegradationPattern | null {
    const timeoutCalls = calls.filter(c => c.statusCode === 408 || c.statusCode === 504);
    if (timeoutCalls.length < 10) return null;

    const sorted = this.sortByTimestamp(calls);
    const windows = this.splitIntoWindows(sorted, 4);

    const timeoutRates = windows.map(window => {
      const timeouts = window.filter(c => c.statusCode === 408 || c.statusCode === 504).length;
      return (timeouts / window.length) * 100;
    });

    const baseline = this.calculateBaseline(timeoutRates.slice(0, 2));
    const current = timeoutRates[timeoutRates.length - 1];

    if (current < 1 && current <= baseline) return null;

    const change = current - baseline;

    const timeline = this.buildTimeline(windows, w => {
      const timeouts = w.filter(c => c.statusCode === 408 || c.statusCode === 504).length;
      return (timeouts / w.length) * 100;
    });

    return {
      id: `deg-${patternId}`,
      type: 'availability',
      severity: current > 5 ? 'critical' : 'warning',
      integrationName,
      description: `Timeout rate spike: ${current.toFixed(1)}% of requests timing out`,
      trend: {
        baseline: parseFloat(baseline.toFixed(2)),
        current: parseFloat(current.toFixed(2)),
        change: parseFloat(change.toFixed(2)),
        changePercent: baseline > 0 ? parseFloat(((change / baseline) * 100).toFixed(1)) : 100,
      },
      timeline,
      predictedImpact: 'Users experiencing failed operations',
      detectedAt: new Date().toISOString(),
      firstSignalAt: timeoutCalls[0]?.timestamp || new Date().toISOString(),
      confidence: this.calculateConfidence(calls.length, Math.abs(change) * 5),
    };
  }

  /**
   * Detect webhook delivery degradation
   */
  private detectWebhookDegradation(
    webhooks: WebhookDeliveryRecord[],
    patternId: number
  ): DegradationPattern | null {
    if (webhooks.length < 50) return null;

    const sorted = [...webhooks].sort((a, b) =>
      new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
    );

    const windows = this.splitIntoWindows(sorted, 4);

    const deliveryRates = windows.map(window => {
      const delivered = window.filter(w => w.status === 'delivered').length;
      return (delivered / window.length) * 100;
    });

    const baseline = this.calculateBaseline(deliveryRates.slice(0, 2));
    const current = deliveryRates[deliveryRates.length - 1];

    // Webhook delivery should be very high - any degradation is concerning
    if (current >= 98 && current >= baseline - 1) return null;

    const change = current - baseline;

    const timeline: TrendPoint[] = windows.map((w, i) => ({
      timestamp: w[0]?.timestamp || new Date().toISOString(),
      value: deliveryRates[i],
      label: `Period ${i + 1}`,
    }));

    return {
      id: `deg-${patternId}`,
      type: 'webhook',
      severity: current < 95 ? 'critical' : 'warning',
      integrationName: 'Webhooks',
      description: `Webhook delivery rate dropped from ${baseline.toFixed(1)}% to ${current.toFixed(1)}%`,
      trend: {
        baseline: parseFloat(baseline.toFixed(2)),
        current: parseFloat(current.toFixed(2)),
        change: parseFloat(change.toFixed(2)),
        changePercent: parseFloat(((change / baseline) * 100).toFixed(1)),
      },
      timeline,
      predictedImpact: 'Delayed notifications, data sync issues',
      detectedAt: new Date().toISOString(),
      firstSignalAt: webhooks.find(w => w.status === 'failed')?.timestamp || new Date().toISOString(),
      confidence: this.calculateConfidence(webhooks.length, Math.abs(change)),
    };
  }

  /**
   * Generate alerts from detected patterns
   */
  private generateAlerts(
    data: ParsedIntegrationData,
    patterns: DegradationPattern[]
  ): DegradationAlert[] {
    if (patterns.length === 0) return [];

    const criticalPatterns = patterns.filter(p => p.severity === 'critical');
    const warningPatterns = patterns.filter(p => p.severity === 'warning');

    const overallSeverity: 'critical' | 'warning' = criticalPatterns.length > 0 ? 'critical' : 'warning';

    // Generate summary
    const summaryParts: string[] = [];
    if (criticalPatterns.length > 0) {
      summaryParts.push(`${criticalPatterns.length} critical degradation(s)`);
    }
    if (warningPatterns.length > 0) {
      summaryParts.push(`${warningPatterns.length} warning(s)`);
    }

    // Generate recommended actions
    const recommendedActions: string[] = [];
    if (patterns.some(p => p.type === 'rate_limit')) {
      recommendedActions.push('Review and increase API rate limits');
    }
    if (patterns.some(p => p.type === 'error_rate')) {
      recommendedActions.push('Investigate error root causes');
    }
    if (patterns.some(p => p.type === 'latency')) {
      recommendedActions.push('Check infrastructure and optimize performance');
    }
    if (patterns.some(p => p.type === 'auth')) {
      recommendedActions.push('Audit token refresh and authentication flow');
    }
    if (patterns.some(p => p.type === 'webhook')) {
      recommendedActions.push('Verify webhook endpoint configuration');
    }

    return [{
      id: `alert-${Date.now()}`,
      customerId: data.customerId,
      customerName: data.customerName,
      patterns,
      overallSeverity,
      summary: `${data.customerName}: ${summaryParts.join(', ')} detected`,
      recommendedActions,
      createdAt: new Date().toISOString(),
    }];
  }

  // ============================================
  // HELPER METHODS
  // ============================================

  private groupByIntegration(calls: IntegrationUsageRecord[]): Map<string, IntegrationUsageRecord[]> {
    const map = new Map<string, IntegrationUsageRecord[]>();
    for (const call of calls) {
      if (!map.has(call.integrationName)) map.set(call.integrationName, []);
      map.get(call.integrationName)!.push(call);
    }
    return map;
  }

  private sortByTimestamp<T extends { timestamp: string }>(items: T[]): T[] {
    return [...items].sort((a, b) =>
      new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
    );
  }

  private splitIntoWindows<T>(items: T[], numWindows: number): T[][] {
    const windowSize = Math.ceil(items.length / numWindows);
    const windows: T[][] = [];
    for (let i = 0; i < items.length; i += windowSize) {
      windows.push(items.slice(i, i + windowSize));
    }
    return windows;
  }

  private calculateBaseline(values: number[]): number {
    if (values.length === 0) return 0;
    return values.reduce((a, b) => a + b, 0) / values.length;
  }

  private percentile(arr: number[], p: number): number {
    if (arr.length === 0) return 0;
    const index = Math.ceil((p / 100) * arr.length) - 1;
    return arr[Math.max(0, Math.min(arr.length - 1, index))];
  }

  private buildTimeline<T extends { timestamp: string }>(
    windows: T[][],
    valueExtractor: (window: T[]) => number
  ): TrendPoint[] {
    return windows.map((window, i) => ({
      timestamp: window[0]?.timestamp || new Date().toISOString(),
      value: parseFloat(valueExtractor(window).toFixed(2)),
      label: `Week ${i + 1}`,
    }));
  }

  private findFirstSignalWindow(values: number[], baseline: number): number {
    const threshold = baseline * DEGRADATION_THRESHOLDS.errorRate.warning;
    for (let i = 0; i < values.length; i++) {
      if (values[i] > threshold) return i;
    }
    return values.length - 1;
  }

  private calculateConfidence(sampleSize: number, changePercent: number): number {
    // Higher sample size = higher confidence
    const sampleConfidence = Math.min(50, sampleSize / 20);
    // Larger changes = higher confidence (up to a point)
    const changeConfidence = Math.min(50, Math.abs(changePercent) / 2);
    return Math.round(sampleConfidence + changeConfidence);
  }
}

// Export singleton instance
export const degradationDetector = new DegradationDetectorService();
export default degradationDetector;
