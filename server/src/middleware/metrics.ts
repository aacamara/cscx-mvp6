/**
 * Request Metrics Middleware
 * Collects request statistics for observability
 */

import { Request, Response, NextFunction } from 'express';
import { logger } from '../services/logger.js';

// In-memory metrics storage
interface MetricsData {
  totalRequests: number;
  totalErrors: number;
  latencyHistogram: Map<string, number[]>;
  statusCodes: Map<number, number>;
  requestsPerSecond: number[];
  lastResetTime: number;
}

const metrics: MetricsData = {
  totalRequests: 0,
  totalErrors: 0,
  latencyHistogram: new Map(),
  statusCodes: new Map(),
  requestsPerSecond: [],
  lastResetTime: Date.now()
};

// Keep only last 60 seconds of RPS data
const RPS_WINDOW = 60;

/**
 * Express middleware to collect request metrics
 */
export function metricsMiddleware(req: Request, res: Response, next: NextFunction): void {
  const start = process.hrtime.bigint();

  res.on('finish', () => {
    const duration = Number(process.hrtime.bigint() - start) / 1e6; // Convert to ms
    const path = req.route?.path || req.path;
    const key = `${req.method}:${path}`;

    // Update metrics
    metrics.totalRequests++;

    if (res.statusCode >= 400) {
      metrics.totalErrors++;
    }

    // Track latency by endpoint
    if (!metrics.latencyHistogram.has(key)) {
      metrics.latencyHistogram.set(key, []);
    }
    const latencies = metrics.latencyHistogram.get(key)!;
    latencies.push(duration);

    // Keep only last 1000 latency samples per endpoint
    if (latencies.length > 1000) {
      latencies.shift();
    }

    // Track status codes
    const currentCount = metrics.statusCodes.get(res.statusCode) || 0;
    metrics.statusCodes.set(res.statusCode, currentCount + 1);

    // Track requests per second
    const now = Math.floor(Date.now() / 1000);
    const lastSecond = metrics.requestsPerSecond.length > 0
      ? metrics.requestsPerSecond.length - 1
      : 0;

    if (metrics.requestsPerSecond[lastSecond] === undefined || now > lastSecond + metrics.lastResetTime / 1000) {
      metrics.requestsPerSecond.push(1);
    } else {
      metrics.requestsPerSecond[lastSecond]++;
    }

    // Keep only last 60 seconds
    if (metrics.requestsPerSecond.length > RPS_WINDOW) {
      metrics.requestsPerSecond.shift();
    }

    // Log request
    logger.httpRequest(req.method, req.path, res.statusCode, Math.round(duration), {
      userAgent: req.headers['user-agent'],
      contentLength: res.get('Content-Length')
    });
  });

  next();
}

/**
 * Calculate percentile from sorted array
 */
function percentile(sorted: number[], p: number): number {
  if (sorted.length === 0) return 0;
  const index = Math.ceil((p / 100) * sorted.length) - 1;
  return sorted[Math.max(0, Math.min(index, sorted.length - 1))];
}

/**
 * Get current metrics summary
 */
export function getMetrics(): {
  totalRequests: number;
  totalErrors: number;
  errorRate: string;
  requestsPerSecond: number;
  uptime: number;
  statusCodes: Record<number, number>;
  latency: Record<string, { p50: number; p95: number; p99: number; avg: number; count: number }>;
} {
  const latencyStats: Record<string, { p50: number; p95: number; p99: number; avg: number; count: number }> = {};

  for (const [key, values] of metrics.latencyHistogram) {
    if (values.length > 0) {
      const sorted = [...values].sort((a, b) => a - b);
      latencyStats[key] = {
        p50: Math.round(percentile(sorted, 50)),
        p95: Math.round(percentile(sorted, 95)),
        p99: Math.round(percentile(sorted, 99)),
        avg: Math.round(values.reduce((a, b) => a + b, 0) / values.length),
        count: values.length
      };
    }
  }

  // Calculate average RPS over the window
  const rpsSum = metrics.requestsPerSecond.reduce((a, b) => a + b, 0);
  const rpsAvg = metrics.requestsPerSecond.length > 0
    ? rpsSum / metrics.requestsPerSecond.length
    : 0;

  return {
    totalRequests: metrics.totalRequests,
    totalErrors: metrics.totalErrors,
    errorRate: metrics.totalRequests > 0
      ? `${((metrics.totalErrors / metrics.totalRequests) * 100).toFixed(2)}%`
      : '0%',
    requestsPerSecond: Math.round(rpsAvg * 100) / 100,
    uptime: Math.floor((Date.now() - metrics.lastResetTime) / 1000),
    statusCodes: Object.fromEntries(metrics.statusCodes),
    latency: latencyStats
  };
}

/**
 * Reset all metrics
 */
export function resetMetrics(): void {
  metrics.totalRequests = 0;
  metrics.totalErrors = 0;
  metrics.latencyHistogram.clear();
  metrics.statusCodes.clear();
  metrics.requestsPerSecond = [];
  metrics.lastResetTime = Date.now();
}

/**
 * Get metrics for a specific endpoint
 */
export function getEndpointMetrics(method: string, path: string): {
  count: number;
  p50: number;
  p95: number;
  p99: number;
  avg: number;
} | null {
  const key = `${method}:${path}`;
  const values = metrics.latencyHistogram.get(key);

  if (!values || values.length === 0) {
    return null;
  }

  const sorted = [...values].sort((a, b) => a - b);
  return {
    count: values.length,
    p50: Math.round(percentile(sorted, 50)),
    p95: Math.round(percentile(sorted, 95)),
    p99: Math.round(percentile(sorted, 99)),
    avg: Math.round(values.reduce((a, b) => a + b, 0) / values.length)
  };
}

/**
 * Prometheus-compatible metrics format (optional)
 */
export function getPrometheusMetrics(): string {
  const lines: string[] = [
    '# HELP http_requests_total Total number of HTTP requests',
    '# TYPE http_requests_total counter',
    `http_requests_total ${metrics.totalRequests}`,
    '',
    '# HELP http_errors_total Total number of HTTP errors (4xx and 5xx)',
    '# TYPE http_errors_total counter',
    `http_errors_total ${metrics.totalErrors}`,
    ''
  ];

  // Add status code counters
  lines.push('# HELP http_requests_by_status HTTP requests by status code');
  lines.push('# TYPE http_requests_by_status counter');
  for (const [code, count] of metrics.statusCodes) {
    lines.push(`http_requests_by_status{status="${code}"} ${count}`);
  }
  lines.push('');

  // Add latency histograms
  lines.push('# HELP http_request_duration_milliseconds HTTP request latency');
  lines.push('# TYPE http_request_duration_milliseconds summary');
  for (const [key, values] of metrics.latencyHistogram) {
    if (values.length > 0) {
      const [method, path] = key.split(':');
      const sorted = [...values].sort((a, b) => a - b);
      lines.push(`http_request_duration_milliseconds{method="${method}",path="${path}",quantile="0.5"} ${percentile(sorted, 50)}`);
      lines.push(`http_request_duration_milliseconds{method="${method}",path="${path}",quantile="0.95"} ${percentile(sorted, 95)}`);
      lines.push(`http_request_duration_milliseconds{method="${method}",path="${path}",quantile="0.99"} ${percentile(sorted, 99)}`);
      lines.push(`http_request_duration_milliseconds_sum{method="${method}",path="${path}"} ${values.reduce((a, b) => a + b, 0)}`);
      lines.push(`http_request_duration_milliseconds_count{method="${method}",path="${path}"} ${values.length}`);
    }
  }

  return lines.join('\n');
}
