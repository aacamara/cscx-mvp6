/**
 * Benchmark Data Loader Service
 * PRD-023: Benchmark Data Upload -> Peer Comparison
 *
 * Handles loading, parsing, and validating benchmark data from uploaded files.
 * Supports CSV and Excel formats with automatic column detection.
 */

import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { config } from '../../config/index.js';
import { csvParser } from '../fileUpload/csvParser.js';
import type {
  BenchmarkDataset,
  BenchmarkValue,
  BenchmarkCategory,
  BenchmarkMetric,
  BENCHMARK_METRICS
} from '../../../../types/benchmark.js';

// Initialize Supabase client
let supabase: SupabaseClient | null = null;
if (config.supabaseUrl && config.supabaseServiceKey) {
  supabase = createClient(config.supabaseUrl, config.supabaseServiceKey);
}

// Metric name patterns for auto-detection
const METRIC_PATTERNS: Record<string, RegExp[]> = {
  dau_mau_ratio: [/^dau[\s_\/]?mau/i, /daily[\s_]?active.*monthly/i],
  session_length: [/session[\s_]?(length|duration)/i, /avg[\s_]?session/i],
  feature_adoption: [/feature[\s_]?adoption/i, /adoption[\s_]?rate/i],
  roi: [/^roi$/i, /return[\s_]?on[\s_]?investment/i],
  time_to_value: [/time[\s_]?to[\s_]?value/i, /ttv/i, /onboarding[\s_]?time/i],
  outcomes_achieved: [/outcomes?[\s_]?(achieved|met)/i, /goal[\s_]?completion/i],
  nps_score: [/^nps[\s_]?(score)?$/i, /net[\s_]?promoter/i],
  csat: [/^csat$/i, /satisfaction[\s_]?score/i],
  health_score: [/health[\s_]?score/i, /customer[\s_]?health/i],
  expansion_rate: [/expansion[\s_]?rate/i, /growth[\s_]?rate/i],
  seat_growth: [/seat[\s_]?growth/i, /user[\s_]?growth/i, /license[\s_]?growth/i],
  upsell_rate: [/upsell[\s_]?rate/i, /cross[\s_]?sell/i],
  tickets_per_user: [/tickets?[\s_]?per[\s_]?user/i, /support[\s_]?tickets/i],
  self_service_rate: [/self[\s_]?service/i, /self[\s_]?serve/i],
  resolution_time: [/resolution[\s_]?time/i, /time[\s_]?to[\s_]?resolve/i, /ticket[\s_]?time/i],
};

// Percentile column patterns
const PERCENTILE_PATTERNS: Record<string, RegExp> = {
  p10: /^p10$|10th[\s_]?percentile|percentile[\s_]?10/i,
  p25: /^p25$|25th[\s_]?percentile|percentile[\s_]?25|q1/i,
  p50: /^p50$|50th[\s_]?percentile|percentile[\s_]?50|median/i,
  p75: /^p75$|75th[\s_]?percentile|percentile[\s_]?75|q3/i,
  p90: /^p90$|90th[\s_]?percentile|percentile[\s_]?90/i,
  mean: /^mean$|^average$|^avg$/i,
  sample_size: /sample[\s_]?size|^n$|count/i,
};

export interface ParsedBenchmarkData {
  metrics: BenchmarkValue[];
  detectedMetrics: string[];
  unmappedColumns: string[];
  warnings: string[];
}

export interface BenchmarkUploadOptions {
  name?: string;
  industry?: string;
  segment?: string;
  source?: string;
  year?: number;
  region?: string;
  notes?: string;
}

class BenchmarkDataLoader {
  /**
   * Parse benchmark data from CSV content
   */
  async parseBenchmarkCSV(
    content: string | Buffer,
    options: { hasHeaders?: boolean } = {}
  ): Promise<ParsedBenchmarkData> {
    const parsed = await csvParser.parseCSV(content, options);
    const metrics: BenchmarkValue[] = [];
    const detectedMetrics: string[] = [];
    const unmappedColumns: string[] = [];
    const warnings: string[] = [];

    // Detect column structure - could be row-based or column-based
    const isRowBased = this.detectRowBasedFormat(parsed.headers, parsed.rows);

    if (isRowBased) {
      // Each row is a metric with percentile columns
      return this.parseRowBasedFormat(parsed.headers, parsed.rows);
    } else {
      // Each column is a metric, rows are percentiles
      return this.parseColumnBasedFormat(parsed.headers, parsed.rows);
    }
  }

  /**
   * Detect if the data is row-based (each row = metric) or column-based (each column = metric)
   */
  private detectRowBasedFormat(headers: string[], rows: Record<string, any>[]): boolean {
    // Check if headers contain percentile-like columns (p50, median, etc.)
    const percentileHeaders = headers.filter(h => {
      return Object.values(PERCENTILE_PATTERNS).some(pattern => pattern.test(h));
    });

    // If we have percentile headers, it's likely row-based
    if (percentileHeaders.length >= 3) {
      return true;
    }

    // Check if first column might be metric names
    const firstColValues = rows.slice(0, 10).map(r => Object.values(r)[0]);
    const metricMatches = firstColValues.filter(v => {
      if (typeof v !== 'string') return false;
      return Object.values(METRIC_PATTERNS).some(patterns =>
        patterns.some(p => p.test(v))
      );
    });

    return metricMatches.length > firstColValues.length * 0.3;
  }

  /**
   * Parse row-based format where each row is a metric
   */
  private parseRowBasedFormat(
    headers: string[],
    rows: Record<string, any>[]
  ): ParsedBenchmarkData {
    const metrics: BenchmarkValue[] = [];
    const detectedMetrics: string[] = [];
    const unmappedColumns: string[] = [];
    const warnings: string[] = [];

    // Map headers to percentile keys
    const percentileColumnMap: Record<string, string> = {};
    let metricNameColumn: string | null = null;

    headers.forEach(header => {
      // Check if it's a percentile column
      for (const [key, pattern] of Object.entries(PERCENTILE_PATTERNS)) {
        if (pattern.test(header)) {
          percentileColumnMap[key] = header;
          return;
        }
      }

      // Check if it might be the metric name column
      if (/^metric|^name|^kpi/i.test(header)) {
        metricNameColumn = header;
        return;
      }

      unmappedColumns.push(header);
    });

    // If no metric name column found, assume first column
    if (!metricNameColumn && headers.length > 0) {
      metricNameColumn = headers[0];
      unmappedColumns.shift();
    }

    // Process each row
    rows.forEach((row, index) => {
      const metricName = row[metricNameColumn!];
      if (!metricName || typeof metricName !== 'string') {
        warnings.push(`Row ${index + 1}: Missing metric name`);
        return;
      }

      // Detect which standard metric this maps to
      const metricId = this.detectMetricId(metricName);
      if (!metricId) {
        warnings.push(`Row ${index + 1}: Could not map metric "${metricName}" to standard metrics`);
        return;
      }

      detectedMetrics.push(metricId);

      // Extract percentile values
      const metric: BenchmarkValue = {
        metricId,
        p10: this.extractNumber(row[percentileColumnMap['p10']]) ?? 0,
        p25: this.extractNumber(row[percentileColumnMap['p25']]) ?? 0,
        p50: this.extractNumber(row[percentileColumnMap['p50']]) ?? 0,
        p75: this.extractNumber(row[percentileColumnMap['p75']]) ?? 0,
        p90: this.extractNumber(row[percentileColumnMap['p90']]) ?? 0,
        mean: this.extractNumber(row[percentileColumnMap['mean']]) ?? 0,
        sampleSize: this.extractNumber(row[percentileColumnMap['sample_size']]) ?? 0,
      };

      // If median is missing, estimate from mean
      if (metric.p50 === 0 && metric.mean !== 0) {
        metric.p50 = metric.mean;
        warnings.push(`Metric "${metricName}": Using mean as median`);
      }

      metrics.push(metric);
    });

    return { metrics, detectedMetrics, unmappedColumns, warnings };
  }

  /**
   * Parse column-based format where each column is a metric
   */
  private parseColumnBasedFormat(
    headers: string[],
    rows: Record<string, any>[]
  ): ParsedBenchmarkData {
    const metrics: BenchmarkValue[] = [];
    const detectedMetrics: string[] = [];
    const unmappedColumns: string[] = [];
    const warnings: string[] = [];

    // First column might be percentile labels
    const percentileColumn = headers[0];
    const metricColumns = headers.slice(1);

    // Build percentile row map
    const percentileRowMap: Record<string, Record<string, any>> = {};
    rows.forEach(row => {
      const label = String(row[percentileColumn] || '').toLowerCase();
      for (const [key, pattern] of Object.entries(PERCENTILE_PATTERNS)) {
        if (pattern.test(label)) {
          percentileRowMap[key] = row;
          return;
        }
      }
    });

    // Process each metric column
    metricColumns.forEach(header => {
      const metricId = this.detectMetricId(header);
      if (!metricId) {
        unmappedColumns.push(header);
        warnings.push(`Column "${header}": Could not map to standard metrics`);
        return;
      }

      detectedMetrics.push(metricId);

      const metric: BenchmarkValue = {
        metricId,
        p10: this.extractNumber(percentileRowMap['p10']?.[header]) ?? 0,
        p25: this.extractNumber(percentileRowMap['p25']?.[header]) ?? 0,
        p50: this.extractNumber(percentileRowMap['p50']?.[header]) ?? 0,
        p75: this.extractNumber(percentileRowMap['p75']?.[header]) ?? 0,
        p90: this.extractNumber(percentileRowMap['p90']?.[header]) ?? 0,
        mean: this.extractNumber(percentileRowMap['mean']?.[header]) ?? 0,
        sampleSize: this.extractNumber(percentileRowMap['sample_size']?.[header]) ?? 0,
      };

      metrics.push(metric);
    });

    return { metrics, detectedMetrics, unmappedColumns, warnings };
  }

  /**
   * Detect standard metric ID from column/row name
   */
  private detectMetricId(name: string): string | null {
    const normalized = name.toLowerCase().trim();

    for (const [metricId, patterns] of Object.entries(METRIC_PATTERNS)) {
      if (patterns.some(p => p.test(normalized))) {
        return metricId;
      }
    }

    return null;
  }

  /**
   * Extract numeric value from cell
   */
  private extractNumber(value: any): number | null {
    if (value === null || value === undefined) return null;
    if (typeof value === 'number') return value;

    const str = String(value).replace(/[%$,]/g, '').trim();
    const num = parseFloat(str);
    return isNaN(num) ? null : num;
  }

  /**
   * Save benchmark dataset to database
   */
  async saveBenchmarkDataset(
    userId: string,
    fileName: string,
    content: string | Buffer,
    options: BenchmarkUploadOptions = {}
  ): Promise<BenchmarkDataset> {
    // Parse the benchmark data
    const parsed = await this.parseBenchmarkCSV(content);

    if (parsed.metrics.length === 0) {
      throw new Error('No valid benchmark metrics found in uploaded file');
    }

    // Detect categories from metrics
    const categories = this.getUniqueCategories(parsed.detectedMetrics);

    const dataset: BenchmarkDataset = {
      id: `benchmark-${Date.now()}`,
      name: options.name || this.extractDatasetName(fileName),
      source: options.source || 'User Upload',
      industry: options.industry || null,
      segment: options.segment || null,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      uploadedBy: userId,
      fileName,
      sampleSize: parsed.metrics[0]?.sampleSize || 0,
      metrics: parsed.metrics,
      metadata: {
        year: options.year || new Date().getFullYear(),
        region: options.region,
        notes: options.notes,
      },
    };

    if (supabase) {
      const { data, error } = await supabase
        .from('benchmark_datasets')
        .insert({
          id: dataset.id,
          name: dataset.name,
          source: dataset.source,
          industry: dataset.industry,
          segment: dataset.segment,
          uploaded_by: dataset.uploadedBy,
          file_name: dataset.fileName,
          sample_size: dataset.sampleSize,
          metrics: dataset.metrics,
          metadata: dataset.metadata,
          created_at: dataset.createdAt,
          updated_at: dataset.updatedAt,
        })
        .select()
        .single();

      if (error) {
        throw new Error(`Failed to save benchmark dataset: ${error.message}`);
      }

      return this.mapDbToBenchmarkDataset(data);
    }

    // In-memory storage for development
    return dataset;
  }

  /**
   * Get benchmark dataset by ID
   */
  async getBenchmarkDataset(datasetId: string): Promise<BenchmarkDataset | null> {
    if (!supabase) {
      // Return mock data for development
      return this.getMockBenchmarkDataset(datasetId);
    }

    const { data, error } = await supabase
      .from('benchmark_datasets')
      .select('*')
      .eq('id', datasetId)
      .single();

    if (error || !data) return null;
    return this.mapDbToBenchmarkDataset(data);
  }

  /**
   * List all benchmark datasets
   */
  async listBenchmarkDatasets(filters?: {
    industry?: string;
    segment?: string;
  }): Promise<BenchmarkDataset[]> {
    if (!supabase) {
      return [this.getMockBenchmarkDataset()];
    }

    let query = supabase
      .from('benchmark_datasets')
      .select('*')
      .order('created_at', { ascending: false });

    if (filters?.industry) {
      query = query.eq('industry', filters.industry);
    }
    if (filters?.segment) {
      query = query.eq('segment', filters.segment);
    }

    const { data, error } = await query;
    if (error || !data) return [];

    return data.map(this.mapDbToBenchmarkDataset);
  }

  /**
   * Delete benchmark dataset
   */
  async deleteBenchmarkDataset(datasetId: string): Promise<boolean> {
    if (!supabase) return true;

    const { error } = await supabase
      .from('benchmark_datasets')
      .delete()
      .eq('id', datasetId);

    return !error;
  }

  /**
   * Get unique categories from detected metrics
   */
  private getUniqueCategories(metricIds: string[]): BenchmarkCategory[] {
    const categoryMap: Record<string, BenchmarkCategory> = {
      dau_mau_ratio: 'engagement',
      session_length: 'engagement',
      feature_adoption: 'engagement',
      roi: 'value',
      time_to_value: 'value',
      outcomes_achieved: 'value',
      nps_score: 'satisfaction',
      csat: 'satisfaction',
      health_score: 'satisfaction',
      expansion_rate: 'growth',
      seat_growth: 'growth',
      upsell_rate: 'growth',
      tickets_per_user: 'efficiency',
      self_service_rate: 'efficiency',
      resolution_time: 'efficiency',
    };

    const categories = new Set<BenchmarkCategory>();
    metricIds.forEach(id => {
      if (categoryMap[id]) {
        categories.add(categoryMap[id]);
      }
    });

    return Array.from(categories);
  }

  /**
   * Extract dataset name from filename
   */
  private extractDatasetName(fileName: string): string {
    // Remove extension
    let name = fileName.replace(/\.(csv|xlsx|xls)$/i, '');

    // Replace underscores and dashes with spaces
    name = name.replace(/[_-]/g, ' ');

    // Title case
    name = name.replace(/\b\w/g, c => c.toUpperCase());

    return name;
  }

  /**
   * Map database row to BenchmarkDataset type
   */
  private mapDbToBenchmarkDataset(data: any): BenchmarkDataset {
    return {
      id: data.id,
      name: data.name,
      source: data.source,
      industry: data.industry,
      segment: data.segment,
      createdAt: data.created_at,
      updatedAt: data.updated_at,
      uploadedBy: data.uploaded_by,
      fileName: data.file_name,
      sampleSize: data.sample_size,
      metrics: data.metrics || [],
      metadata: data.metadata || { year: new Date().getFullYear() },
    };
  }

  /**
   * Get mock benchmark dataset for development
   */
  getMockBenchmarkDataset(id?: string): BenchmarkDataset {
    return {
      id: id || 'mock-saas-2026',
      name: 'SaaS Industry Report 2026',
      source: 'SaaS Metrics Consortium',
      industry: 'SaaS',
      segment: null,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      uploadedBy: 'system',
      fileName: 'saas_industry_benchmarks_2026.csv',
      sampleSize: 500,
      metrics: [
        { metricId: 'dau_mau_ratio', p10: 0.15, p25: 0.25, p50: 0.38, p75: 0.48, p90: 0.60, mean: 0.38, sampleSize: 500 },
        { metricId: 'feature_adoption', p10: 0.30, p25: 0.42, p50: 0.58, p75: 0.72, p90: 0.85, mean: 0.56, sampleSize: 500 },
        { metricId: 'nps_score', p10: -10, p25: 20, p50: 42, p75: 58, p90: 72, mean: 40, sampleSize: 500 },
        { metricId: 'time_to_value', p10: 90, p25: 60, p50: 30, p75: 21, p90: 14, mean: 38, sampleSize: 500 },
        { metricId: 'expansion_rate', p10: 0.05, p25: 0.12, p50: 0.22, p75: 0.32, p90: 0.45, mean: 0.22, sampleSize: 500 },
        { metricId: 'tickets_per_user', p10: 1.2, p25: 0.8, p50: 0.5, p75: 0.3, p90: 0.15, mean: 0.55, sampleSize: 500 },
        { metricId: 'health_score', p10: 35, p25: 50, p50: 68, p75: 80, p90: 90, mean: 66, sampleSize: 500 },
        { metricId: 'csat', p10: 0.60, p25: 0.72, p50: 0.82, p75: 0.90, p90: 0.95, mean: 0.81, sampleSize: 500 },
        { metricId: 'session_length', p10: 3, p25: 8, p50: 15, p75: 25, p90: 40, mean: 17, sampleSize: 500 },
        { metricId: 'self_service_rate', p10: 0.20, p25: 0.35, p50: 0.52, p75: 0.68, p90: 0.82, mean: 0.51, sampleSize: 500 },
        { metricId: 'roi', p10: 0.5, p25: 1.2, p50: 2.5, p75: 4.0, p90: 6.5, mean: 2.8, sampleSize: 500 },
        { metricId: 'seat_growth', p10: -0.05, p25: 0.05, p50: 0.15, p75: 0.28, p90: 0.45, mean: 0.17, sampleSize: 500 },
      ],
      metadata: {
        year: 2026,
        region: 'Global',
        notes: 'Industry-wide SaaS benchmark data from 500 companies',
      },
    };
  }
}

// Singleton instance
export const benchmarkDataLoader = new BenchmarkDataLoader();
export default benchmarkDataLoader;
