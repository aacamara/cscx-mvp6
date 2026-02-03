/**
 * Usage Anomaly Detection Service (PRD-084)
 *
 * Automatically detects unusual patterns in customer usage data including:
 * - Sudden drops (potential churn signals)
 * - Unexpected spikes (potential expansion opportunities)
 * - Seasonal deviations
 * - Feature abandonment patterns
 *
 * Uses statistical methods (z-score, IQR) to identify anomalies.
 */

import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { v4 as uuidv4 } from 'uuid';
import { config } from '../../config/index.js';
import { triggerEngine, CustomerEvent } from '../../triggers/index.js';

// ============================================
// Types
// ============================================

export type AnomalyType = 'drop' | 'spike' | 'pattern_change' | 'feature_abandonment';
export type AnomalySeverity = 'critical' | 'warning' | 'info';
export type MetricType = 'dau' | 'wau' | 'mau' | 'total_events' | 'api_calls' | 'feature_usage' | 'session_duration';

export interface UsageAnomaly {
  id: string;
  customerId: string;
  customerName?: string;
  metricType: MetricType;
  anomalyType: AnomalyType;
  severity: AnomalySeverity;
  baselineValue: number;
  actualValue: number;
  deviationPercent: number;
  zScore?: number;
  detectedAt: Date;
  dismissedAt?: Date;
  dismissedBy?: string;
  affectedFeature?: string;
  possibleCause?: string;
  duration?: number; // days the anomaly has persisted
  metadata?: Record<string, any>;
}

export interface AnomalyDetectionConfig {
  // Statistical thresholds
  zScoreThreshold?: number;        // Default: 2.0 (2 standard deviations)
  dropThresholdPercent?: number;   // Default: 30%
  spikeThresholdPercent?: number;  // Default: 100%
  featureDropThreshold?: number;   // Default: 50%

  // Baseline configuration
  baselineDays?: number;           // Default: 30 days
  minimumDataPoints?: number;      // Default: 7

  // Filtering
  excludeWeekends?: boolean;       // Default: true
  accountForSeasonality?: boolean; // Default: true

  // False positive filtering
  minDurationDays?: number;        // Default: 2 (anomaly must persist)
  cooldownDays?: number;           // Default: 14 (days before re-alerting)
}

export interface CustomerBaseline {
  customerId: string;
  metricType: MetricType;
  mean: number;
  stdDev: number;
  median: number;
  q1: number;
  q3: number;
  iqr: number;
  dataPoints: number;
  calculatedAt: Date;
  seasonalFactors?: Record<string, number>; // day of week adjustments
}

export interface AnomalyScanResult {
  customerId: string;
  customerName: string;
  anomalies: UsageAnomaly[];
  skipped: boolean;
  skipReason?: string;
}

export interface AnomalyScanSummary {
  scannedAt: Date;
  customersScanned: number;
  customersWithAnomalies: number;
  totalAnomalies: number;
  byType: Record<AnomalyType, number>;
  bySeverity: Record<AnomalySeverity, number>;
  results: AnomalyScanResult[];
}

// ============================================
// Default Configuration
// ============================================

const DEFAULT_CONFIG: Required<AnomalyDetectionConfig> = {
  zScoreThreshold: 2.0,
  dropThresholdPercent: 30,
  spikeThresholdPercent: 100,
  featureDropThreshold: 50,
  baselineDays: 30,
  minimumDataPoints: 7,
  excludeWeekends: true,
  accountForSeasonality: true,
  minDurationDays: 2,
  cooldownDays: 14,
};

// ============================================
// Anomaly Detection Service
// ============================================

export class AnomalyDetectionService {
  private supabase: SupabaseClient | null = null;

  constructor() {
    if (config.supabaseUrl && config.supabaseServiceKey) {
      this.supabase = createClient(config.supabaseUrl, config.supabaseServiceKey);
    }
  }

  // ============================================
  // Baseline Calculations
  // ============================================

  /**
   * Calculate statistical baseline for a customer's usage metric
   */
  async calculateBaseline(
    customerId: string,
    metricType: MetricType,
    days: number = 30
  ): Promise<CustomerBaseline | null> {
    if (!this.supabase) {
      return this.getMockBaseline(customerId, metricType);
    }

    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - days);

    // Fetch historical usage data
    const { data: metrics, error } = await this.supabase
      .from('usage_metrics')
      .select('dau, wau, mau, total_events, calculated_at, feature_breakdown')
      .eq('customer_id', customerId)
      .gte('calculated_at', cutoff.toISOString())
      .order('calculated_at', { ascending: true });

    if (error || !metrics || metrics.length < 7) {
      console.log(`[AnomalyDetection] Insufficient data for baseline: ${customerId}`);
      return null;
    }

    // Extract values for the specified metric
    const values = metrics.map(m => this.extractMetricValue(m, metricType)).filter(v => v !== null) as number[];

    if (values.length < 7) return null;

    // Calculate statistics
    const mean = values.reduce((a, b) => a + b, 0) / values.length;
    const variance = values.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / values.length;
    const stdDev = Math.sqrt(variance);

    // Calculate quartiles for IQR
    const sorted = [...values].sort((a, b) => a - b);
    const median = this.calculateMedian(sorted);
    const q1 = this.calculateMedian(sorted.slice(0, Math.floor(sorted.length / 2)));
    const q3 = this.calculateMedian(sorted.slice(Math.ceil(sorted.length / 2)));
    const iqr = q3 - q1;

    // Calculate seasonal factors (day of week)
    const seasonalFactors = this.calculateSeasonalFactors(metrics, metricType);

    const baseline: CustomerBaseline = {
      customerId,
      metricType,
      mean,
      stdDev,
      median,
      q1,
      q3,
      iqr,
      dataPoints: values.length,
      calculatedAt: new Date(),
      seasonalFactors,
    };

    // Store baseline
    await this.storeBaseline(baseline);

    return baseline;
  }

  /**
   * Get stored baseline or calculate new one
   */
  async getOrCalculateBaseline(
    customerId: string,
    metricType: MetricType
  ): Promise<CustomerBaseline | null> {
    if (!this.supabase) {
      return this.getMockBaseline(customerId, metricType);
    }

    // Check for recent baseline (within 7 days)
    const { data: existing } = await this.supabase
      .from('usage_baselines')
      .select('*')
      .eq('customer_id', customerId)
      .eq('metric_type', metricType)
      .gte('calculated_at', new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString())
      .single();

    if (existing) {
      return this.mapDbBaseline(existing);
    }

    // Calculate new baseline
    return this.calculateBaseline(customerId, metricType);
  }

  // ============================================
  // Anomaly Detection
  // ============================================

  /**
   * Detect anomalies for a specific customer
   */
  async detectAnomaliesForCustomer(
    customerId: string,
    cfg: AnomalyDetectionConfig = {}
  ): Promise<AnomalyScanResult> {
    const config = { ...DEFAULT_CONFIG, ...cfg };
    const anomalies: UsageAnomaly[] = [];

    // Get customer info
    const customer = await this.getCustomerInfo(customerId);
    if (!customer) {
      return {
        customerId,
        customerName: '',
        anomalies: [],
        skipped: true,
        skipReason: 'Customer not found',
      };
    }

    // Check cooldown
    const inCooldown = await this.isInCooldown(customerId, config.cooldownDays);
    if (inCooldown) {
      return {
        customerId,
        customerName: customer.name,
        anomalies: [],
        skipped: true,
        skipReason: 'Within cooldown period',
      };
    }

    // Get current metrics
    const currentMetrics = await this.getCurrentMetrics(customerId);
    if (!currentMetrics) {
      return {
        customerId,
        customerName: customer.name,
        anomalies: [],
        skipped: true,
        skipReason: 'No current usage data',
      };
    }

    // Check each metric type
    const metricsToCheck: MetricType[] = ['dau', 'wau', 'mau', 'total_events'];

    for (const metricType of metricsToCheck) {
      const baseline = await this.getOrCalculateBaseline(customerId, metricType);
      if (!baseline) continue;

      const currentValue = this.extractMetricValue(currentMetrics, metricType);
      if (currentValue === null) continue;

      // Detect anomaly using z-score and percentage change
      const anomaly = this.analyzeMetric(
        customerId,
        customer.name,
        metricType,
        currentValue,
        baseline,
        config
      );

      if (anomaly) {
        anomalies.push(anomaly);
      }
    }

    // Check for feature abandonment
    const featureAnomalies = await this.detectFeatureAbandonment(
      customerId,
      customer.name,
      currentMetrics,
      config
    );
    anomalies.push(...featureAnomalies);

    // Save anomalies to database
    if (anomalies.length > 0) {
      await this.saveAnomalies(anomalies);
      await this.processAnomaliesThroughTriggers(anomalies, customer);
    }

    return {
      customerId,
      customerName: customer.name,
      anomalies,
      skipped: false,
    };
  }

  /**
   * Analyze a metric for anomalies
   */
  private analyzeMetric(
    customerId: string,
    customerName: string,
    metricType: MetricType,
    currentValue: number,
    baseline: CustomerBaseline,
    config: Required<AnomalyDetectionConfig>
  ): UsageAnomaly | null {
    // Calculate z-score
    const zScore = baseline.stdDev > 0
      ? (currentValue - baseline.mean) / baseline.stdDev
      : 0;

    // Calculate percentage deviation
    const deviationPercent = baseline.mean > 0
      ? ((currentValue - baseline.mean) / baseline.mean) * 100
      : 0;

    // Determine anomaly type and severity
    let anomalyType: AnomalyType | null = null;
    let severity: AnomalySeverity = 'info';
    let possibleCause: string | undefined;

    // Check for drop
    if (deviationPercent <= -config.dropThresholdPercent && zScore <= -config.zScoreThreshold) {
      anomalyType = 'drop';

      if (deviationPercent <= -70) {
        severity = 'critical';
        possibleCause = 'Integration issue, migration in progress, or major platform problem';
      } else if (deviationPercent <= -50) {
        severity = 'warning';
        possibleCause = 'Training gap, competing tool, or organizational change';
      } else {
        severity = 'info';
        possibleCause = 'Seasonal variation or temporary reduction';
      }
    }
    // Check for spike (positive anomaly)
    else if (deviationPercent >= config.spikeThresholdPercent && zScore >= config.zScoreThreshold) {
      anomalyType = 'spike';

      if (deviationPercent >= 200) {
        severity = 'info'; // Spikes are usually positive
        possibleCause = 'Major team expansion or new department adoption';
      } else {
        severity = 'info';
        possibleCause = 'Team growth or increased engagement';
      }
    }
    // Check for pattern change using IQR
    else if (currentValue < baseline.q1 - 1.5 * baseline.iqr || currentValue > baseline.q3 + 1.5 * baseline.iqr) {
      anomalyType = 'pattern_change';
      severity = 'warning';
      possibleCause = 'Usage pattern has shifted from historical norms';
    }

    if (!anomalyType) return null;

    return {
      id: uuidv4(),
      customerId,
      customerName,
      metricType,
      anomalyType,
      severity,
      baselineValue: Math.round(baseline.mean * 100) / 100,
      actualValue: currentValue,
      deviationPercent: Math.round(deviationPercent * 100) / 100,
      zScore: Math.round(zScore * 100) / 100,
      detectedAt: new Date(),
      possibleCause,
      metadata: {
        baseline_stddev: baseline.stdDev,
        baseline_median: baseline.median,
        data_points: baseline.dataPoints,
      },
    };
  }

  /**
   * Detect feature abandonment patterns
   */
  private async detectFeatureAbandonment(
    customerId: string,
    customerName: string,
    currentMetrics: any,
    config: Required<AnomalyDetectionConfig>
  ): Promise<UsageAnomaly[]> {
    const anomalies: UsageAnomaly[] = [];

    if (!currentMetrics.feature_breakdown || !currentMetrics.previous_feature_breakdown) {
      return anomalies;
    }

    const current = currentMetrics.feature_breakdown as Record<string, number>;
    const previous = currentMetrics.previous_feature_breakdown as Record<string, number>;

    for (const [feature, prevCount] of Object.entries(previous)) {
      if (prevCount < 10) continue; // Skip low-usage features

      const currCount = current[feature] || 0;
      const dropPercent = ((prevCount - currCount) / prevCount) * 100;

      if (dropPercent >= config.featureDropThreshold) {
        const severity: AnomalySeverity = dropPercent >= 80 ? 'warning' : 'info';

        anomalies.push({
          id: uuidv4(),
          customerId,
          customerName,
          metricType: 'feature_usage',
          anomalyType: 'feature_abandonment',
          severity,
          baselineValue: prevCount,
          actualValue: currCount,
          deviationPercent: Math.round(-dropPercent * 100) / 100,
          detectedAt: new Date(),
          affectedFeature: feature,
          possibleCause: 'Feature may no longer meet needs, training gap, or competing solution',
          metadata: {
            feature_name: feature,
          },
        });
      }
    }

    return anomalies;
  }

  /**
   * Run anomaly detection for all active customers
   */
  async scanAllCustomers(
    cfg: AnomalyDetectionConfig = {}
  ): Promise<AnomalyScanSummary> {
    const config = { ...DEFAULT_CONFIG, ...cfg };

    if (!this.supabase) {
      return this.getMockScanSummary();
    }

    // Get all active customers
    const { data: customers, error } = await this.supabase
      .from('customers')
      .select('id, name')
      .in('status', ['active', 'onboarding'])
      .order('arr', { ascending: false });

    if (error || !customers) {
      console.error('[AnomalyDetection] Failed to fetch customers:', error);
      return {
        scannedAt: new Date(),
        customersScanned: 0,
        customersWithAnomalies: 0,
        totalAnomalies: 0,
        byType: { drop: 0, spike: 0, pattern_change: 0, feature_abandonment: 0 },
        bySeverity: { critical: 0, warning: 0, info: 0 },
        results: [],
      };
    }

    const results: AnomalyScanResult[] = [];
    const byType: Record<AnomalyType, number> = { drop: 0, spike: 0, pattern_change: 0, feature_abandonment: 0 };
    const bySeverity: Record<AnomalySeverity, number> = { critical: 0, warning: 0, info: 0 };
    let customersWithAnomalies = 0;
    let totalAnomalies = 0;

    for (const customer of customers) {
      try {
        const result = await this.detectAnomaliesForCustomer(customer.id, config);
        results.push(result);

        if (result.anomalies.length > 0) {
          customersWithAnomalies++;
          totalAnomalies += result.anomalies.length;

          for (const anomaly of result.anomalies) {
            byType[anomaly.anomalyType]++;
            bySeverity[anomaly.severity]++;
          }
        }
      } catch (err) {
        console.error(`[AnomalyDetection] Error scanning ${customer.id}:`, err);
        results.push({
          customerId: customer.id,
          customerName: customer.name,
          anomalies: [],
          skipped: true,
          skipReason: `Error: ${(err as Error).message}`,
        });
      }
    }

    return {
      scannedAt: new Date(),
      customersScanned: customers.length,
      customersWithAnomalies,
      totalAnomalies,
      byType,
      bySeverity,
      results,
    };
  }

  // ============================================
  // Anomaly Management
  // ============================================

  /**
   * Get anomalies for a customer
   */
  async getAnomaliesForCustomer(
    customerId: string,
    options: {
      includesDismissed?: boolean;
      anomalyType?: AnomalyType;
      severity?: AnomalySeverity;
      limit?: number;
    } = {}
  ): Promise<UsageAnomaly[]> {
    if (!this.supabase) {
      return this.getMockAnomalies(customerId);
    }

    let query = this.supabase
      .from('usage_anomalies')
      .select('*')
      .eq('customer_id', customerId)
      .order('detected_at', { ascending: false });

    if (!options.includesDismissed) {
      query = query.is('dismissed_at', null);
    }

    if (options.anomalyType) {
      query = query.eq('anomaly_type', options.anomalyType);
    }

    if (options.severity) {
      query = query.eq('severity', options.severity);
    }

    if (options.limit) {
      query = query.limit(options.limit);
    }

    const { data, error } = await query;

    if (error) {
      console.error('[AnomalyDetection] Error fetching anomalies:', error);
      return [];
    }

    return (data || []).map(this.mapDbAnomaly);
  }

  /**
   * Dismiss an anomaly (false positive)
   */
  async dismissAnomaly(anomalyId: string, userId: string): Promise<UsageAnomaly | null> {
    if (!this.supabase) return null;

    const { data, error } = await this.supabase
      .from('usage_anomalies')
      .update({
        dismissed_at: new Date().toISOString(),
        dismissed_by: userId,
      })
      .eq('id', anomalyId)
      .select()
      .single();

    if (error) {
      console.error('[AnomalyDetection] Error dismissing anomaly:', error);
      return null;
    }

    return this.mapDbAnomaly(data);
  }

  /**
   * Get anomaly summary for portfolio view
   */
  async getPortfolioAnomalySummary(): Promise<{
    accounts: Array<{
      customerId: string;
      customerName: string;
      criticalCount: number;
      warningCount: number;
      infoCount: number;
      primaryAnomaly?: UsageAnomaly;
    }>;
    totals: {
      critical: number;
      warning: number;
      info: number;
    };
  }> {
    if (!this.supabase) {
      return this.getMockPortfolioSummary();
    }

    // Get all active anomalies with customer info
    const { data, error } = await this.supabase
      .from('usage_anomalies')
      .select(`
        *,
        customers!inner(id, name, arr, health_score)
      `)
      .is('dismissed_at', null)
      .order('severity', { ascending: true }) // critical first
      .order('detected_at', { ascending: false });

    if (error) {
      console.error('[AnomalyDetection] Error fetching portfolio summary:', error);
      return { accounts: [], totals: { critical: 0, warning: 0, info: 0 } };
    }

    // Group by customer
    const customerMap = new Map<string, {
      customerId: string;
      customerName: string;
      criticalCount: number;
      warningCount: number;
      infoCount: number;
      primaryAnomaly?: UsageAnomaly;
    }>();

    const totals = { critical: 0, warning: 0, info: 0 };

    for (const row of data || []) {
      const customerId = row.customer_id;
      const customerName = row.customers?.name || '';

      if (!customerMap.has(customerId)) {
        customerMap.set(customerId, {
          customerId,
          customerName,
          criticalCount: 0,
          warningCount: 0,
          infoCount: 0,
        });
      }

      const entry = customerMap.get(customerId)!;
      const anomaly = this.mapDbAnomaly(row);

      if (row.severity === 'critical') {
        entry.criticalCount++;
        totals.critical++;
      } else if (row.severity === 'warning') {
        entry.warningCount++;
        totals.warning++;
      } else {
        entry.infoCount++;
        totals.info++;
      }

      // Set primary anomaly (most severe, most recent)
      if (!entry.primaryAnomaly ||
          this.severityRank(anomaly.severity) < this.severityRank(entry.primaryAnomaly.severity)) {
        entry.primaryAnomaly = anomaly;
      }
    }

    // Sort by severity (most critical first)
    const accounts = Array.from(customerMap.values()).sort((a, b) => {
      if (a.criticalCount !== b.criticalCount) return b.criticalCount - a.criticalCount;
      if (a.warningCount !== b.warningCount) return b.warningCount - a.warningCount;
      return b.infoCount - a.infoCount;
    });

    return { accounts, totals };
  }

  // ============================================
  // Helper Methods
  // ============================================

  private severityRank(severity: AnomalySeverity): number {
    return { critical: 0, warning: 1, info: 2 }[severity];
  }

  private extractMetricValue(metrics: any, metricType: MetricType): number | null {
    switch (metricType) {
      case 'dau': return metrics.dau ?? null;
      case 'wau': return metrics.wau ?? null;
      case 'mau': return metrics.mau ?? null;
      case 'total_events': return metrics.total_events ?? null;
      case 'api_calls': return metrics.api_calls ?? null;
      case 'session_duration': return metrics.avg_session_duration ?? null;
      default: return null;
    }
  }

  private calculateMedian(sortedArray: number[]): number {
    if (sortedArray.length === 0) return 0;
    const mid = Math.floor(sortedArray.length / 2);
    return sortedArray.length % 2 === 0
      ? (sortedArray[mid - 1] + sortedArray[mid]) / 2
      : sortedArray[mid];
  }

  private calculateSeasonalFactors(metrics: any[], metricType: MetricType): Record<string, number> {
    const dayTotals: Record<number, { sum: number; count: number }> = {};

    for (const m of metrics) {
      const date = new Date(m.calculated_at);
      const dayOfWeek = date.getDay();
      const value = this.extractMetricValue(m, metricType);

      if (value !== null) {
        if (!dayTotals[dayOfWeek]) {
          dayTotals[dayOfWeek] = { sum: 0, count: 0 };
        }
        dayTotals[dayOfWeek].sum += value;
        dayTotals[dayOfWeek].count++;
      }
    }

    const factors: Record<string, number> = {};
    const overallMean = Object.values(dayTotals).reduce((s, d) => s + d.sum, 0) /
      Object.values(dayTotals).reduce((s, d) => s + d.count, 0);

    const dayNames = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
    for (const [day, data] of Object.entries(dayTotals)) {
      const dayMean = data.sum / data.count;
      factors[dayNames[parseInt(day)]] = overallMean > 0 ? dayMean / overallMean : 1;
    }

    return factors;
  }

  private async storeBaseline(baseline: CustomerBaseline): Promise<void> {
    if (!this.supabase) return;

    await this.supabase.from('usage_baselines').upsert({
      customer_id: baseline.customerId,
      metric_type: baseline.metricType,
      mean: baseline.mean,
      std_dev: baseline.stdDev,
      median: baseline.median,
      q1: baseline.q1,
      q3: baseline.q3,
      iqr: baseline.iqr,
      data_points: baseline.dataPoints,
      seasonal_factors: baseline.seasonalFactors,
      calculated_at: baseline.calculatedAt.toISOString(),
    }, {
      onConflict: 'customer_id,metric_type',
    });
  }

  private async saveAnomalies(anomalies: UsageAnomaly[]): Promise<void> {
    if (!this.supabase || anomalies.length === 0) return;

    const rows = anomalies.map(a => ({
      id: a.id,
      customer_id: a.customerId,
      metric_type: a.metricType,
      anomaly_type: a.anomalyType,
      severity: a.severity,
      baseline_value: a.baselineValue,
      actual_value: a.actualValue,
      deviation_percent: a.deviationPercent,
      z_score: a.zScore,
      detected_at: a.detectedAt.toISOString(),
      affected_feature: a.affectedFeature,
      possible_cause: a.possibleCause,
      metadata: a.metadata,
    }));

    const { error } = await this.supabase.from('usage_anomalies').insert(rows);
    if (error) {
      console.error('[AnomalyDetection] Error saving anomalies:', error);
    }
  }

  private async processAnomaliesThroughTriggers(
    anomalies: UsageAnomaly[],
    customer: { name: string; arr?: number }
  ): Promise<void> {
    for (const anomaly of anomalies) {
      if (anomaly.severity === 'info') continue; // Only trigger for warning/critical

      const event: CustomerEvent = {
        id: uuidv4(),
        type: 'usage_metric_updated',
        customerId: anomaly.customerId,
        customerName: customer.name,
        data: {
          anomalyId: anomaly.id,
          anomalyType: anomaly.anomalyType,
          metricType: anomaly.metricType,
          severity: anomaly.severity,
          baselineValue: anomaly.baselineValue,
          actualValue: anomaly.actualValue,
          deviationPercent: anomaly.deviationPercent,
          possibleCause: anomaly.possibleCause,
          affectedFeature: anomaly.affectedFeature,
        },
        timestamp: anomaly.detectedAt,
        source: 'anomaly_detection',
      };

      try {
        await triggerEngine.processEvent(event);
      } catch (err) {
        console.error(`[AnomalyDetection] Trigger error for ${anomaly.customerId}:`, err);
      }
    }
  }

  private async isInCooldown(customerId: string, cooldownDays: number): Promise<boolean> {
    if (!this.supabase) return false;

    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - cooldownDays);

    const { data } = await this.supabase
      .from('usage_anomalies')
      .select('id')
      .eq('customer_id', customerId)
      .in('severity', ['critical', 'warning'])
      .gte('detected_at', cutoff.toISOString())
      .is('dismissed_at', null)
      .limit(1);

    return data !== null && data.length > 0;
  }

  private async getCustomerInfo(customerId: string): Promise<{ id: string; name: string; arr?: number } | null> {
    if (!this.supabase) {
      return { id: customerId, name: 'Mock Customer' };
    }

    const { data } = await this.supabase
      .from('customers')
      .select('id, name, arr')
      .eq('id', customerId)
      .single();

    return data;
  }

  private async getCurrentMetrics(customerId: string): Promise<any | null> {
    if (!this.supabase) {
      return {
        dau: 45,
        wau: 120,
        mau: 300,
        total_events: 5000,
        feature_breakdown: { reports: 100, api: 500, dashboard: 300 },
        previous_feature_breakdown: { reports: 150, api: 480, dashboard: 290 },
      };
    }

    // Get latest metrics
    const { data: current, error: currentError } = await this.supabase
      .from('usage_metrics')
      .select('*')
      .eq('customer_id', customerId)
      .order('calculated_at', { ascending: false })
      .limit(1)
      .single();

    if (currentError || !current) return null;

    // Get previous metrics for comparison
    const { data: previous } = await this.supabase
      .from('usage_metrics')
      .select('feature_breakdown')
      .eq('customer_id', customerId)
      .order('calculated_at', { ascending: false })
      .limit(1)
      .range(1, 1)
      .single();

    return {
      ...current,
      previous_feature_breakdown: previous?.feature_breakdown,
    };
  }

  private mapDbAnomaly(row: any): UsageAnomaly {
    return {
      id: row.id,
      customerId: row.customer_id,
      customerName: row.customers?.name,
      metricType: row.metric_type,
      anomalyType: row.anomaly_type,
      severity: row.severity,
      baselineValue: parseFloat(row.baseline_value),
      actualValue: parseFloat(row.actual_value),
      deviationPercent: parseFloat(row.deviation_percent),
      zScore: row.z_score ? parseFloat(row.z_score) : undefined,
      detectedAt: new Date(row.detected_at),
      dismissedAt: row.dismissed_at ? new Date(row.dismissed_at) : undefined,
      dismissedBy: row.dismissed_by,
      affectedFeature: row.affected_feature,
      possibleCause: row.possible_cause,
      duration: row.duration,
      metadata: row.metadata,
    };
  }

  private mapDbBaseline(row: any): CustomerBaseline {
    return {
      customerId: row.customer_id,
      metricType: row.metric_type,
      mean: parseFloat(row.mean),
      stdDev: parseFloat(row.std_dev),
      median: parseFloat(row.median),
      q1: parseFloat(row.q1),
      q3: parseFloat(row.q3),
      iqr: parseFloat(row.iqr),
      dataPoints: row.data_points,
      calculatedAt: new Date(row.calculated_at),
      seasonalFactors: row.seasonal_factors,
    };
  }

  // ============================================
  // Mock Data (for testing without DB)
  // ============================================

  private getMockBaseline(customerId: string, metricType: MetricType): CustomerBaseline {
    return {
      customerId,
      metricType,
      mean: 100,
      stdDev: 20,
      median: 98,
      q1: 85,
      q3: 115,
      iqr: 30,
      dataPoints: 30,
      calculatedAt: new Date(),
    };
  }

  private getMockAnomalies(customerId: string): UsageAnomaly[] {
    return [
      {
        id: uuidv4(),
        customerId,
        customerName: 'DataFlow Systems',
        metricType: 'dau',
        anomalyType: 'drop',
        severity: 'critical',
        baselineValue: 45000,
        actualValue: 15000,
        deviationPercent: -67,
        zScore: -3.5,
        detectedAt: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000),
        duration: 5,
        possibleCause: 'Integration issue or migration',
      },
      {
        id: uuidv4(),
        customerId,
        customerName: 'CloudFirst Inc',
        metricType: 'feature_usage',
        anomalyType: 'feature_abandonment',
        severity: 'warning',
        baselineValue: 500,
        actualValue: 100,
        deviationPercent: -80,
        detectedAt: new Date(Date.now() - 14 * 24 * 60 * 60 * 1000),
        affectedFeature: 'Reports',
        possibleCause: 'Training gap or competing tool',
      },
    ];
  }

  private getMockScanSummary(): AnomalyScanSummary {
    return {
      scannedAt: new Date(),
      customersScanned: 50,
      customersWithAnomalies: 3,
      totalAnomalies: 5,
      byType: { drop: 2, spike: 1, pattern_change: 1, feature_abandonment: 1 },
      bySeverity: { critical: 1, warning: 2, info: 2 },
      results: [],
    };
  }

  private getMockPortfolioSummary() {
    return {
      accounts: [
        {
          customerId: 'mock-1',
          customerName: 'DataFlow Systems',
          criticalCount: 1,
          warningCount: 0,
          infoCount: 1,
          primaryAnomaly: {
            id: 'mock-anomaly-1',
            customerId: 'mock-1',
            customerName: 'DataFlow Systems',
            metricType: 'dau' as MetricType,
            anomalyType: 'drop' as AnomalyType,
            severity: 'critical' as AnomalySeverity,
            baselineValue: 45000,
            actualValue: 15000,
            deviationPercent: -67,
            detectedAt: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000),
            possibleCause: 'Integration issue or migration',
          },
        },
        {
          customerId: 'mock-2',
          customerName: 'Nexus Corp',
          criticalCount: 0,
          warningCount: 0,
          infoCount: 1,
          primaryAnomaly: {
            id: 'mock-anomaly-2',
            customerId: 'mock-2',
            customerName: 'Nexus Corp',
            metricType: 'mau' as MetricType,
            anomalyType: 'spike' as AnomalyType,
            severity: 'info' as AnomalySeverity,
            baselineValue: 200,
            actualValue: 500,
            deviationPercent: 150,
            detectedAt: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000),
            possibleCause: 'Team expansion or new use case',
          },
        },
      ],
      totals: { critical: 1, warning: 0, info: 2 },
    };
  }
}

// Singleton instance
export const anomalyDetectionService = new AnomalyDetectionService();

export default {
  anomalyDetectionService,
  AnomalyDetectionService,
};
