/**
 * Request Metrics Middleware
 * Collects request statistics for observability
 * Enhanced with agentic-specific metrics for production monitoring
 */

import { Request, Response, NextFunction } from 'express';
import { logger } from '../services/logger.js';

// ============================================================================
// Types
// ============================================================================

// In-memory metrics storage
interface MetricsData {
  totalRequests: number;
  totalErrors: number;
  latencyHistogram: Map<string, number[]>;
  statusCodes: Map<number, number>;
  requestsPerSecond: number[];
  lastResetTime: number;
}

// Agentic-specific metrics
interface AgenticMetricsData {
  // Execution counts by agent type
  executionsByAgentType: Map<string, number>;

  // Approval metrics
  approvalsRequested: number;
  approvalsApproved: number;
  approvalsRejected: number;

  // Execution duration by agent type (for percentile calculations)
  executionDuration: Map<string, number[]>;

  // Error tracking by agent type
  errorsByAgentType: Map<string, number>;

  // Tool execution counts
  toolExecutions: Map<string, number>;

  // Active executions (for concurrency tracking)
  activeExecutions: number;
  peakActiveExecutions: number;

  // Rate limit hits
  rateLimitHits: number;
  rateLimitHitsByUser: Map<string, number>;
}

const metrics: MetricsData = {
  totalRequests: 0,
  totalErrors: 0,
  latencyHistogram: new Map(),
  statusCodes: new Map(),
  requestsPerSecond: [],
  lastResetTime: Date.now()
};

// Agentic metrics storage
const agenticMetrics: AgenticMetricsData = {
  executionsByAgentType: new Map(),
  approvalsRequested: 0,
  approvalsApproved: 0,
  approvalsRejected: 0,
  executionDuration: new Map(),
  errorsByAgentType: new Map(),
  toolExecutions: new Map(),
  activeExecutions: 0,
  peakActiveExecutions: 0,
  rateLimitHits: 0,
  rateLimitHitsByUser: new Map(),
};

// Keep only last 60 seconds of RPS data
const RPS_WINDOW = 60;

// Keep only last 1000 duration samples per agent type
const MAX_DURATION_SAMPLES = 1000;

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
  lines.push('');

  // ============================================================================
  // Agentic Metrics (Prometheus format)
  // ============================================================================

  // Agent executions by type
  lines.push('# HELP agentic_executions_total Total agent executions by type');
  lines.push('# TYPE agentic_executions_total counter');
  for (const [agentType, count] of agenticMetrics.executionsByAgentType) {
    lines.push(`agentic_executions_total{agent_type="${agentType}"} ${count}`);
  }
  lines.push('');

  // Approval metrics
  lines.push('# HELP agentic_approvals_total Total approval requests and decisions');
  lines.push('# TYPE agentic_approvals_total counter');
  lines.push(`agentic_approvals_total{status="requested"} ${agenticMetrics.approvalsRequested}`);
  lines.push(`agentic_approvals_total{status="approved"} ${agenticMetrics.approvalsApproved}`);
  lines.push(`agentic_approvals_total{status="rejected"} ${agenticMetrics.approvalsRejected}`);
  lines.push('');

  // Approval rate
  const totalDecisions = agenticMetrics.approvalsApproved + agenticMetrics.approvalsRejected;
  const approvalRate = totalDecisions > 0
    ? (agenticMetrics.approvalsApproved / totalDecisions)
    : 0;
  lines.push('# HELP agentic_approval_rate Ratio of approvals to total decisions');
  lines.push('# TYPE agentic_approval_rate gauge');
  lines.push(`agentic_approval_rate ${approvalRate.toFixed(4)}`);
  lines.push('');

  // Execution duration by agent type
  lines.push('# HELP agentic_execution_duration_milliseconds Agent execution duration');
  lines.push('# TYPE agentic_execution_duration_milliseconds summary');
  for (const [agentType, durations] of agenticMetrics.executionDuration) {
    if (durations.length > 0) {
      const sorted = [...durations].sort((a, b) => a - b);
      lines.push(`agentic_execution_duration_milliseconds{agent_type="${agentType}",quantile="0.5"} ${percentile(sorted, 50)}`);
      lines.push(`agentic_execution_duration_milliseconds{agent_type="${agentType}",quantile="0.95"} ${percentile(sorted, 95)}`);
      lines.push(`agentic_execution_duration_milliseconds{agent_type="${agentType}",quantile="0.99"} ${percentile(sorted, 99)}`);
      lines.push(`agentic_execution_duration_milliseconds_sum{agent_type="${agentType}"} ${durations.reduce((a, b) => a + b, 0)}`);
      lines.push(`agentic_execution_duration_milliseconds_count{agent_type="${agentType}"} ${durations.length}`);
    }
  }
  lines.push('');

  // Errors by agent type
  lines.push('# HELP agentic_errors_total Total errors by agent type');
  lines.push('# TYPE agentic_errors_total counter');
  for (const [agentType, count] of agenticMetrics.errorsByAgentType) {
    lines.push(`agentic_errors_total{agent_type="${agentType}"} ${count}`);
  }
  lines.push('');

  // Error rate by agent type
  lines.push('# HELP agentic_error_rate Error rate by agent type');
  lines.push('# TYPE agentic_error_rate gauge');
  for (const [agentType, executions] of agenticMetrics.executionsByAgentType) {
    const errors = agenticMetrics.errorsByAgentType.get(agentType) || 0;
    const errorRate = executions > 0 ? (errors / executions) : 0;
    lines.push(`agentic_error_rate{agent_type="${agentType}"} ${errorRate.toFixed(4)}`);
  }
  lines.push('');

  // Tool executions
  lines.push('# HELP agentic_tool_executions_total Total tool executions');
  lines.push('# TYPE agentic_tool_executions_total counter');
  for (const [toolName, count] of agenticMetrics.toolExecutions) {
    lines.push(`agentic_tool_executions_total{tool="${toolName}"} ${count}`);
  }
  lines.push('');

  // Active executions
  lines.push('# HELP agentic_active_executions Current number of active agent executions');
  lines.push('# TYPE agentic_active_executions gauge');
  lines.push(`agentic_active_executions ${agenticMetrics.activeExecutions}`);
  lines.push('');

  // Peak active executions
  lines.push('# HELP agentic_peak_active_executions Peak concurrent agent executions');
  lines.push('# TYPE agentic_peak_active_executions gauge');
  lines.push(`agentic_peak_active_executions ${agenticMetrics.peakActiveExecutions}`);
  lines.push('');

  // Rate limit hits
  lines.push('# HELP agentic_rate_limit_hits_total Total rate limit hits');
  lines.push('# TYPE agentic_rate_limit_hits_total counter');
  lines.push(`agentic_rate_limit_hits_total ${agenticMetrics.rateLimitHits}`);

  return lines.join('\n');
}

// ============================================================================
// Agentic Metrics Functions
// ============================================================================

/**
 * Record an agent execution start
 */
export function recordAgentExecutionStart(agentType: string): void {
  // Increment execution count
  const current = agenticMetrics.executionsByAgentType.get(agentType) || 0;
  agenticMetrics.executionsByAgentType.set(agentType, current + 1);

  // Track active executions
  agenticMetrics.activeExecutions++;
  if (agenticMetrics.activeExecutions > agenticMetrics.peakActiveExecutions) {
    agenticMetrics.peakActiveExecutions = agenticMetrics.activeExecutions;
  }
}

/**
 * Record an agent execution completion
 */
export function recordAgentExecutionComplete(agentType: string, durationMs: number): void {
  // Track duration
  if (!agenticMetrics.executionDuration.has(agentType)) {
    agenticMetrics.executionDuration.set(agentType, []);
  }
  const durations = agenticMetrics.executionDuration.get(agentType)!;
  durations.push(durationMs);

  // Keep only last N samples
  if (durations.length > MAX_DURATION_SAMPLES) {
    durations.shift();
  }

  // Decrement active executions
  agenticMetrics.activeExecutions = Math.max(0, agenticMetrics.activeExecutions - 1);
}

/**
 * Record an agent execution error
 */
export function recordAgentExecutionError(agentType: string, durationMs?: number): void {
  const current = agenticMetrics.errorsByAgentType.get(agentType) || 0;
  agenticMetrics.errorsByAgentType.set(agentType, current + 1);

  // Also record duration if provided
  if (durationMs !== undefined) {
    recordAgentExecutionComplete(agentType, durationMs);
  } else {
    // Just decrement active executions
    agenticMetrics.activeExecutions = Math.max(0, agenticMetrics.activeExecutions - 1);
  }
}

/**
 * Record an approval request
 */
export function recordApprovalRequested(): void {
  agenticMetrics.approvalsRequested++;
}

/**
 * Record an approval decision
 */
export function recordApprovalDecision(approved: boolean): void {
  if (approved) {
    agenticMetrics.approvalsApproved++;
  } else {
    agenticMetrics.approvalsRejected++;
  }
}

/**
 * Record a tool execution
 */
export function recordToolExecution(toolName: string): void {
  const current = agenticMetrics.toolExecutions.get(toolName) || 0;
  agenticMetrics.toolExecutions.set(toolName, current + 1);
}

/**
 * Record a rate limit hit
 */
export function recordRateLimitHit(userId?: string): void {
  agenticMetrics.rateLimitHits++;

  if (userId) {
    const current = agenticMetrics.rateLimitHitsByUser.get(userId) || 0;
    agenticMetrics.rateLimitHitsByUser.set(userId, current + 1);
  }
}

/**
 * Get agentic-specific metrics
 */
export function getAgenticMetrics(): {
  executionsByAgentType: Record<string, number>;
  approvals: {
    requested: number;
    approved: number;
    rejected: number;
    approvalRate: string;
  };
  executionDuration: Record<string, { p50: number; p95: number; p99: number; avg: number; count: number }>;
  errorsByAgentType: Record<string, number>;
  errorRates: Record<string, string>;
  toolExecutions: Record<string, number>;
  activeExecutions: number;
  peakActiveExecutions: number;
  rateLimitHits: number;
} {
  // Calculate approval rate
  const totalDecisions = agenticMetrics.approvalsApproved + agenticMetrics.approvalsRejected;
  const approvalRate = totalDecisions > 0
    ? `${((agenticMetrics.approvalsApproved / totalDecisions) * 100).toFixed(2)}%`
    : '0%';

  // Calculate duration stats
  const durationStats: Record<string, { p50: number; p95: number; p99: number; avg: number; count: number }> = {};
  for (const [agentType, durations] of agenticMetrics.executionDuration) {
    if (durations.length > 0) {
      const sorted = [...durations].sort((a, b) => a - b);
      durationStats[agentType] = {
        p50: Math.round(percentile(sorted, 50)),
        p95: Math.round(percentile(sorted, 95)),
        p99: Math.round(percentile(sorted, 99)),
        avg: Math.round(durations.reduce((a, b) => a + b, 0) / durations.length),
        count: durations.length,
      };
    }
  }

  // Calculate error rates
  const errorRates: Record<string, string> = {};
  for (const [agentType, executions] of agenticMetrics.executionsByAgentType) {
    const errors = agenticMetrics.errorsByAgentType.get(agentType) || 0;
    errorRates[agentType] = executions > 0
      ? `${((errors / executions) * 100).toFixed(2)}%`
      : '0%';
  }

  return {
    executionsByAgentType: Object.fromEntries(agenticMetrics.executionsByAgentType),
    approvals: {
      requested: agenticMetrics.approvalsRequested,
      approved: agenticMetrics.approvalsApproved,
      rejected: agenticMetrics.approvalsRejected,
      approvalRate,
    },
    executionDuration: durationStats,
    errorsByAgentType: Object.fromEntries(agenticMetrics.errorsByAgentType),
    errorRates,
    toolExecutions: Object.fromEntries(agenticMetrics.toolExecutions),
    activeExecutions: agenticMetrics.activeExecutions,
    peakActiveExecutions: agenticMetrics.peakActiveExecutions,
    rateLimitHits: agenticMetrics.rateLimitHits,
  };
}

/**
 * Reset agentic metrics
 */
export function resetAgenticMetrics(): void {
  agenticMetrics.executionsByAgentType.clear();
  agenticMetrics.approvalsRequested = 0;
  agenticMetrics.approvalsApproved = 0;
  agenticMetrics.approvalsRejected = 0;
  agenticMetrics.executionDuration.clear();
  agenticMetrics.errorsByAgentType.clear();
  agenticMetrics.toolExecutions.clear();
  agenticMetrics.activeExecutions = 0;
  agenticMetrics.peakActiveExecutions = 0;
  agenticMetrics.rateLimitHits = 0;
  agenticMetrics.rateLimitHitsByUser.clear();
}
