/**
 * Agent Metrics API Routes
 * Dashboard metrics, execution statistics, and approval analytics
 */

import { Router, Request, Response } from 'express';
import { agentTracer } from '../services/agentTracer.js';
import { createClient } from '@supabase/supabase-js';
import { config } from '../config/index.js';
import { authMiddleware } from '../middleware/auth.js';
import { applyOrgFilter, withOrgId } from '../middleware/orgFilter.js';

const router = Router();

// Initialize Supabase client
const supabase = config.supabaseUrl && config.supabaseServiceKey
  ? createClient(config.supabaseUrl, config.supabaseServiceKey)
  : null;

// ============================================
// Types
// ============================================

interface TimeSeriesPoint {
  timestamp: string;
  value: number;
  label?: string;
}

interface MetricsSummary {
  today: number;
  week: number;
  month: number;
  total: number;
  change: {
    today: number;
    week: number;
    month: number;
  };
}

// ============================================
// Helper Functions
// ============================================

function getDateRange(period: string): { start: Date; end: Date } {
  const end = new Date();
  const start = new Date();

  switch (period) {
    case 'day':
      start.setHours(0, 0, 0, 0);
      break;
    case 'week':
      start.setDate(start.getDate() - 7);
      break;
    case 'month':
      start.setDate(start.getDate() - 30);
      break;
    case 'quarter':
      start.setDate(start.getDate() - 90);
      break;
    case 'year':
      start.setDate(start.getDate() - 365);
      break;
    default:
      start.setDate(start.getDate() - 7);
  }

  return { start, end };
}

function calculateChange(current: number, previous: number): number {
  if (previous === 0) return current > 0 ? 100 : 0;
  return Math.round(((current - previous) / previous) * 100);
}

// ============================================
// Routes
// ============================================

/**
 * GET /api/agent-metrics/summary
 * Dashboard summary with key metrics
 */
router.get('/summary', async (req: Request, res: Response) => {
  try {
    const userId = req.headers['x-user-id'] as string;

    // Get stats from tracer
    const stats = await agentTracer.getStats();

    // Calculate time-based metrics
    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const weekStart = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const monthStart = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    const prevWeekStart = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000);

    let executions: MetricsSummary = {
      today: 0,
      week: 0,
      month: 0,
      total: stats.totalRuns,
      change: { today: 0, week: 0, month: 0 }
    };

    let successRate = 0;
    let avgDuration = stats.avgDuration;
    let errorRate = 0;

    if (supabase) {
      // Get execution counts by time period
      const [todayRes, weekRes, monthRes, prevWeekRes] = await Promise.all([
        supabase.from('agent_runs')
          .select('id', { count: 'exact', head: true })
          .gte('started_at', todayStart.toISOString()),
        supabase.from('agent_runs')
          .select('id', { count: 'exact', head: true })
          .gte('started_at', weekStart.toISOString()),
        supabase.from('agent_runs')
          .select('id', { count: 'exact', head: true })
          .gte('started_at', monthStart.toISOString()),
        supabase.from('agent_runs')
          .select('id', { count: 'exact', head: true })
          .gte('started_at', prevWeekStart.toISOString())
          .lt('started_at', weekStart.toISOString()),
      ]);

      executions.today = todayRes.count || 0;
      executions.week = weekRes.count || 0;
      executions.month = monthRes.count || 0;
      executions.change.week = calculateChange(executions.week, prevWeekRes.count || 0);

      // Calculate success rate
      const { count: successCount } = await supabase
        .from('agent_runs')
        .select('id', { count: 'exact', head: true })
        .eq('status', 'completed')
        .gte('started_at', weekStart.toISOString());

      successRate = executions.week > 0
        ? Math.round(((successCount || 0) / executions.week) * 100)
        : 0;

      // Calculate error rate
      const { count: errorCount } = await supabase
        .from('agent_runs')
        .select('id', { count: 'exact', head: true })
        .eq('status', 'failed')
        .gte('started_at', weekStart.toISOString());

      errorRate = executions.week > 0
        ? Math.round(((errorCount || 0) / executions.week) * 100)
        : 0;
    }

    // Top agents by usage
    const topAgents = Object.entries(stats.byAgent)
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);

    // Status breakdown
    const statusBreakdown = Object.entries(stats.byStatus)
      .map(([status, count]) => ({ status, count }));

    return res.json({
      executions,
      successRate,
      errorRate,
      avgDuration: Math.round(avgDuration),
      avgDurationFormatted: `${(avgDuration / 1000).toFixed(1)}s`,
      activeRuns: stats.activeRuns,
      totalTokens: stats.totalTokens,
      topAgents,
      statusBreakdown,
      lastUpdated: new Date().toISOString(),
    });

  } catch (error) {
    console.error('Get summary error:', error);
    return res.status(500).json({ error: 'Failed to fetch summary' });
  }
});

/**
 * GET /api/agent-metrics/executions
 * Time series of execution data
 */
router.get('/executions', async (req: Request, res: Response) => {
  try {
    const period = (req.query.period as string) || 'week';
    const granularity = (req.query.granularity as string) || 'day';
    const { start, end } = getDateRange(period);

    const timeSeries: TimeSeriesPoint[] = [];

    if (supabase) {
      // Get execution data grouped by time
      const { data, error } = await supabase
        .from('agent_runs')
        .select('started_at, status')
        .gte('started_at', start.toISOString())
        .lte('started_at', end.toISOString())
        .order('started_at', { ascending: true });

      if (error) {
        console.error('Supabase query error:', error);
        return res.status(500).json({ error: 'Failed to fetch executions' });
      }

      // Group by granularity
      const grouped = new Map<string, { total: number; success: number; failed: number }>();

      (data || []).forEach((row: any) => {
        const date = new Date(row.started_at);
        let key: string;

        if (granularity === 'hour') {
          key = `${date.toISOString().substring(0, 13)}:00:00`;
        } else if (granularity === 'day') {
          key = date.toISOString().substring(0, 10);
        } else {
          // week
          const weekStart = new Date(date);
          weekStart.setDate(weekStart.getDate() - weekStart.getDay());
          key = weekStart.toISOString().substring(0, 10);
        }

        if (!grouped.has(key)) {
          grouped.set(key, { total: 0, success: 0, failed: 0 });
        }

        const entry = grouped.get(key)!;
        entry.total++;
        if (row.status === 'completed') entry.success++;
        if (row.status === 'failed') entry.failed++;
      });

      // Fill in missing dates
      const current = new Date(start);
      while (current <= end) {
        let key: string;

        if (granularity === 'hour') {
          key = `${current.toISOString().substring(0, 13)}:00:00`;
        } else if (granularity === 'day') {
          key = current.toISOString().substring(0, 10);
        } else {
          const weekStart = new Date(current);
          weekStart.setDate(weekStart.getDate() - weekStart.getDay());
          key = weekStart.toISOString().substring(0, 10);
        }

        if (!grouped.has(key)) {
          grouped.set(key, { total: 0, success: 0, failed: 0 });
        }

        if (granularity === 'hour') {
          current.setHours(current.getHours() + 1);
        } else if (granularity === 'day') {
          current.setDate(current.getDate() + 1);
        } else {
          current.setDate(current.getDate() + 7);
        }
      }

      // Sort and convert to array
      Array.from(grouped.entries())
        .sort((a, b) => a[0].localeCompare(b[0]))
        .forEach(([timestamp, data]) => {
          timeSeries.push({
            timestamp,
            value: data.total,
            label: `Total: ${data.total}, Success: ${data.success}, Failed: ${data.failed}`
          });
        });
    }

    // Calculate averages
    const totalExecutions = timeSeries.reduce((sum, p) => sum + p.value, 0);
    const avgPerPeriod = timeSeries.length > 0
      ? Math.round(totalExecutions / timeSeries.length)
      : 0;

    return res.json({
      timeSeries,
      period,
      granularity,
      summary: {
        total: totalExecutions,
        average: avgPerPeriod,
        peak: Math.max(...timeSeries.map(p => p.value), 0),
        low: Math.min(...timeSeries.map(p => p.value), 0),
      }
    });

  } catch (error) {
    console.error('Get executions error:', error);
    return res.status(500).json({ error: 'Failed to fetch executions' });
  }
});

/**
 * GET /api/agent-metrics/approvals
 * Approval statistics and breakdown
 */
router.get('/approvals', async (req: Request, res: Response) => {
  try {
    const period = (req.query.period as string) || 'week';
    const { start, end } = getDateRange(period);

    let approvalStats = {
      total: 0,
      approved: 0,
      rejected: 0,
      pending: 0,
      approvalRate: 0,
      avgResponseTime: 0,
      byType: [] as { type: string; count: number; approvalRate: number }[],
      byAgent: [] as { agent: string; total: number; approved: number; rejected: number }[],
    };

    if (supabase) {
      // Get approval counts
      const { data: approvals, error } = await supabase
        .from('approvals')
        .select('*')
        .gte('created_at', start.toISOString())
        .lte('created_at', end.toISOString());

      if (error) {
        console.error('Supabase query error:', error);
      } else if (approvals) {
        approvalStats.total = approvals.length;
        approvalStats.approved = approvals.filter((a: any) => a.status === 'approved').length;
        approvalStats.rejected = approvals.filter((a: any) => a.status === 'rejected').length;
        approvalStats.pending = approvals.filter((a: any) => a.status === 'pending').length;
        approvalStats.approvalRate = approvalStats.total > 0
          ? Math.round((approvalStats.approved / (approvalStats.approved + approvalStats.rejected || 1)) * 100)
          : 0;

        // Calculate avg response time
        const resolvedApprovals = approvals.filter((a: any) => a.resolved_at && a.created_at);
        if (resolvedApprovals.length > 0) {
          const totalTime = resolvedApprovals.reduce((sum: number, a: any) => {
            return sum + (new Date(a.resolved_at).getTime() - new Date(a.created_at).getTime());
          }, 0);
          approvalStats.avgResponseTime = Math.round(totalTime / resolvedApprovals.length / 1000); // seconds
        }

        // Group by type
        const byType = new Map<string, { total: number; approved: number }>();
        approvals.forEach((a: any) => {
          const type = a.action_type || 'unknown';
          if (!byType.has(type)) {
            byType.set(type, { total: 0, approved: 0 });
          }
          const entry = byType.get(type)!;
          entry.total++;
          if (a.status === 'approved') entry.approved++;
        });

        approvalStats.byType = Array.from(byType.entries())
          .map(([type, data]) => ({
            type,
            count: data.total,
            approvalRate: data.total > 0 ? Math.round((data.approved / data.total) * 100) : 0,
          }))
          .sort((a, b) => b.count - a.count);

        // Group by agent
        const byAgent = new Map<string, { total: number; approved: number; rejected: number }>();
        approvals.forEach((a: any) => {
          const agent = a.agent_name || a.metadata?.agentName || 'unknown';
          if (!byAgent.has(agent)) {
            byAgent.set(agent, { total: 0, approved: 0, rejected: 0 });
          }
          const entry = byAgent.get(agent)!;
          entry.total++;
          if (a.status === 'approved') entry.approved++;
          if (a.status === 'rejected') entry.rejected++;
        });

        approvalStats.byAgent = Array.from(byAgent.entries())
          .map(([agent, data]) => ({
            agent,
            total: data.total,
            approved: data.approved,
            rejected: data.rejected,
          }))
          .sort((a, b) => b.total - a.total);
      }
    }

    return res.json({
      ...approvalStats,
      period,
      avgResponseTimeFormatted: `${approvalStats.avgResponseTime}s`,
    });

  } catch (error) {
    console.error('Get approvals error:', error);
    return res.status(500).json({ error: 'Failed to fetch approvals' });
  }
});

/**
 * GET /api/agent-metrics/errors
 * Error statistics and patterns
 */
router.get('/errors', async (req: Request, res: Response) => {
  try {
    const period = (req.query.period as string) || 'week';
    const limit = parseInt(req.query.limit as string) || 50;
    const { start, end } = getDateRange(period);

    let errorStats = {
      total: 0,
      byType: [] as { type: string; count: number; lastOccurrence: string }[],
      byAgent: [] as { agent: string; count: number }[],
      recent: [] as any[],
      trend: [] as TimeSeriesPoint[],
    };

    if (supabase) {
      // Get failed runs
      const { data: failedRuns, error } = await supabase
        .from('agent_runs')
        .select('id, agent_name, error, started_at, metadata')
        .eq('status', 'failed')
        .gte('started_at', start.toISOString())
        .lte('started_at', end.toISOString())
        .order('started_at', { ascending: false })
        .limit(limit);

      if (error) {
        console.error('Supabase query error:', error);
      } else if (failedRuns) {
        errorStats.total = failedRuns.length;

        // Group by error type/pattern
        const byType = new Map<string, { count: number; lastOccurrence: string }>();
        const byAgent = new Map<string, number>();

        failedRuns.forEach((run: any) => {
          // Extract error type from message
          const errorType = extractErrorType(run.error);
          if (!byType.has(errorType)) {
            byType.set(errorType, { count: 0, lastOccurrence: run.started_at });
          }
          byType.get(errorType)!.count++;

          // Count by agent
          const agent = run.agent_name || 'unknown';
          byAgent.set(agent, (byAgent.get(agent) || 0) + 1);
        });

        errorStats.byType = Array.from(byType.entries())
          .map(([type, data]) => ({
            type,
            count: data.count,
            lastOccurrence: data.lastOccurrence,
          }))
          .sort((a, b) => b.count - a.count);

        errorStats.byAgent = Array.from(byAgent.entries())
          .map(([agent, count]) => ({ agent, count }))
          .sort((a, b) => b.count - a.count);

        // Recent errors
        errorStats.recent = failedRuns.slice(0, 10).map((run: any) => ({
          id: run.id,
          agent: run.agent_name,
          error: run.error,
          timestamp: run.started_at,
          errorType: extractErrorType(run.error),
        }));

        // Error trend by day
        const trendMap = new Map<string, number>();
        failedRuns.forEach((run: any) => {
          const day = new Date(run.started_at).toISOString().substring(0, 10);
          trendMap.set(day, (trendMap.get(day) || 0) + 1);
        });

        errorStats.trend = Array.from(trendMap.entries())
          .map(([timestamp, value]) => ({ timestamp, value }))
          .sort((a, b) => a.timestamp.localeCompare(b.timestamp));
      }
    }

    return res.json({
      ...errorStats,
      period,
    });

  } catch (error) {
    console.error('Get errors error:', error);
    return res.status(500).json({ error: 'Failed to fetch errors' });
  }
});

/**
 * GET /api/agent-metrics/performance
 * Performance metrics (duration, tokens, throughput)
 */
router.get('/performance', async (req: Request, res: Response) => {
  try {
    const period = (req.query.period as string) || 'week';
    const { start, end } = getDateRange(period);

    let performanceStats = {
      avgDuration: 0,
      medianDuration: 0,
      p95Duration: 0,
      avgTokens: { input: 0, output: 0 },
      throughput: 0, // runs per hour
      durationByAgent: [] as { agent: string; avgDuration: number }[],
      durationTrend: [] as TimeSeriesPoint[],
    };

    if (supabase) {
      // Get completed runs with duration
      const { data: runs, error } = await supabase
        .from('agent_runs')
        .select('agent_name, started_at, ended_at, total_tokens_input, total_tokens_output')
        .eq('status', 'completed')
        .not('ended_at', 'is', null)
        .gte('started_at', start.toISOString())
        .lte('started_at', end.toISOString())
        .order('started_at', { ascending: true });

      if (error) {
        console.error('Supabase query error:', error);
      } else if (runs && runs.length > 0) {
        // Calculate durations
        const durations = runs.map((r: any) =>
          new Date(r.ended_at).getTime() - new Date(r.started_at).getTime()
        ).sort((a, b) => a - b);

        performanceStats.avgDuration = Math.round(
          durations.reduce((a, b) => a + b, 0) / durations.length
        );
        performanceStats.medianDuration = durations[Math.floor(durations.length / 2)];
        performanceStats.p95Duration = durations[Math.floor(durations.length * 0.95)];

        // Calculate avg tokens
        const totalInput = runs.reduce((sum: number, r: any) => sum + (r.total_tokens_input || 0), 0);
        const totalOutput = runs.reduce((sum: number, r: any) => sum + (r.total_tokens_output || 0), 0);
        performanceStats.avgTokens = {
          input: Math.round(totalInput / runs.length),
          output: Math.round(totalOutput / runs.length),
        };

        // Calculate throughput (runs per hour)
        const periodHours = (end.getTime() - start.getTime()) / (1000 * 60 * 60);
        performanceStats.throughput = Math.round((runs.length / periodHours) * 100) / 100;

        // Duration by agent
        const byAgent = new Map<string, number[]>();
        runs.forEach((r: any) => {
          const agent = r.agent_name || 'unknown';
          if (!byAgent.has(agent)) byAgent.set(agent, []);
          byAgent.get(agent)!.push(
            new Date(r.ended_at).getTime() - new Date(r.started_at).getTime()
          );
        });

        performanceStats.durationByAgent = Array.from(byAgent.entries())
          .map(([agent, durations]) => ({
            agent,
            avgDuration: Math.round(durations.reduce((a, b) => a + b, 0) / durations.length),
          }))
          .sort((a, b) => a.avgDuration - b.avgDuration);

        // Duration trend by day
        const trendMap = new Map<string, number[]>();
        runs.forEach((r: any) => {
          const day = new Date(r.started_at).toISOString().substring(0, 10);
          if (!trendMap.has(day)) trendMap.set(day, []);
          trendMap.get(day)!.push(
            new Date(r.ended_at).getTime() - new Date(r.started_at).getTime()
          );
        });

        performanceStats.durationTrend = Array.from(trendMap.entries())
          .map(([timestamp, durations]) => ({
            timestamp,
            value: Math.round(durations.reduce((a, b) => a + b, 0) / durations.length),
          }))
          .sort((a, b) => a.timestamp.localeCompare(b.timestamp));
      }
    }

    return res.json({
      ...performanceStats,
      period,
      avgDurationFormatted: `${(performanceStats.avgDuration / 1000).toFixed(2)}s`,
      medianDurationFormatted: `${(performanceStats.medianDuration / 1000).toFixed(2)}s`,
      p95DurationFormatted: `${(performanceStats.p95Duration / 1000).toFixed(2)}s`,
    });

  } catch (error) {
    console.error('Get performance error:', error);
    return res.status(500).json({ error: 'Failed to fetch performance metrics' });
  }
});

// Helper to extract error type from error message
function extractErrorType(errorMessage: string | null): string {
  if (!errorMessage) return 'Unknown';

  // Common error patterns
  if (errorMessage.includes('timeout')) return 'Timeout';
  if (errorMessage.includes('rate limit')) return 'Rate Limit';
  if (errorMessage.includes('authentication') || errorMessage.includes('unauthorized')) return 'Authentication';
  if (errorMessage.includes('validation')) return 'Validation';
  if (errorMessage.includes('not found')) return 'Not Found';
  if (errorMessage.includes('network') || errorMessage.includes('ECONNREFUSED')) return 'Network';
  if (errorMessage.includes('tool')) return 'Tool Error';
  if (errorMessage.includes('llm') || errorMessage.includes('Claude') || errorMessage.includes('Anthropic')) return 'LLM Error';

  // Extract first word or phrase
  const match = errorMessage.match(/^([A-Z][a-z]+(?:\s[A-Z][a-z]+)?)/);
  return match ? match[1] : 'Other';
}

export { router as agentMetricsRoutes };
