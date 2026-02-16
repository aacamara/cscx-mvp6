/**
 * Admin Routes
 * PRD-5 US-010: Admin metrics overview endpoint
 */

import { Router, Request, Response, NextFunction } from 'express';
import { createClient } from '@supabase/supabase-js';
import { config } from '../config/index.js';
import { applyOrgFilter } from '../middleware/orgFilter.js';

const router = Router();

// Supabase client
const supabase = config.supabaseUrl && config.supabaseServiceKey
  ? createClient(config.supabaseUrl, config.supabaseServiceKey)
  : null;

/**
 * Admin role check middleware
 */
const requireAdmin = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const authHeader = req.headers.authorization;

    // For MVP, check for admin token or allow in development
    if (config.nodeEnv === 'development') {
      return next();
    }

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({
        error: {
          code: 'UNAUTHORIZED',
          message: 'Admin authentication required'
        }
      });
    }

    const token = authHeader.substring(7);

    if (!supabase) {
      // Allow access in demo mode
      return next();
    }

    // Verify token and check admin role
    const { data: { user }, error } = await supabase.auth.getUser(token);

    if (error || !user) {
      return res.status(401).json({
        error: {
          code: 'INVALID_TOKEN',
          message: 'Invalid or expired token'
        }
      });
    }

    // Check for admin role in user metadata
    const userRole = user.user_metadata?.role || 'member';
    if (userRole !== 'admin' && userRole !== 'super_admin') {
      return res.status(403).json({
        error: {
          code: 'FORBIDDEN',
          message: 'Admin role required'
        }
      });
    }

    (req as any).userId = user.id;
    (req as any).userRole = userRole;
    next();
  } catch (error) {
    console.error('Admin auth error:', error);
    res.status(500).json({
      error: { code: 'AUTH_ERROR', message: 'Authentication failed' }
    });
  }
};

/**
 * GET /api/admin/overview
 * Returns platform KPIs: DAU, actions count, error rate
 */
router.get('/overview', requireAdmin, async (req: Request, res: Response) => {
  try {
    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const yesterdayStart = new Date(todayStart.getTime() - 24 * 60 * 60 * 1000);
    const weekAgoStart = new Date(todayStart.getTime() - 7 * 24 * 60 * 60 * 1000);

    let metrics = {
      dailyActiveUsers: 0,
      weeklyActiveUsers: 0,
      actionsToday: 0,
      actionsThisWeek: 0,
      errorRate: 0,
      totalCustomers: 0,
      atRiskCustomers: 0,
      healthyCustomers: 0,
      pendingApprovals: 0,
      agentRunsToday: 0,
      avgResponseTimeMs: 0
    };

    if (supabase) {
      // Get daily active users (users with activity today)
      const { count: dauCount } = await supabase
        .from('agent_activity_log')
        .select('user_id', { count: 'exact', head: true })
        .gte('started_at', todayStart.toISOString());

      metrics.dailyActiveUsers = dauCount || 0;

      // Get weekly active users
      const { count: wauCount } = await supabase
        .from('agent_activity_log')
        .select('user_id', { count: 'exact', head: true })
        .gte('started_at', weekAgoStart.toISOString());

      metrics.weeklyActiveUsers = wauCount || 0;

      // Get actions count today
      const { count: actionsToday } = await supabase
        .from('agent_activity_log')
        .select('*', { count: 'exact', head: true })
        .gte('started_at', todayStart.toISOString());

      metrics.actionsToday = actionsToday || 0;

      // Get actions count this week
      const { count: actionsWeek } = await supabase
        .from('agent_activity_log')
        .select('*', { count: 'exact', head: true })
        .gte('started_at', weekAgoStart.toISOString());

      metrics.actionsThisWeek = actionsWeek || 0;

      // Get error rate (failed actions / total actions today)
      const { count: failedCount } = await supabase
        .from('agent_activity_log')
        .select('*', { count: 'exact', head: true })
        .gte('started_at', todayStart.toISOString())
        .eq('status', 'failed');

      if (metrics.actionsToday > 0) {
        metrics.errorRate = Math.round(((failedCount || 0) / metrics.actionsToday) * 100 * 100) / 100;
      }

      // Get customer counts (org-filtered)
      let totalCustomersQuery = supabase.from('customers').select('*', { count: 'exact', head: true });
      totalCustomersQuery = applyOrgFilter(totalCustomersQuery, req);
      const { count: totalCustomers } = await totalCustomersQuery;

      metrics.totalCustomers = totalCustomers || 0;

      // At-risk customers (health score < 60)
      let atRiskQuery = supabase.from('customers').select('*', { count: 'exact', head: true });
      atRiskQuery = applyOrgFilter(atRiskQuery, req);
      const { count: atRiskCount } = await atRiskQuery.lt('health_score', 60);

      metrics.atRiskCustomers = atRiskCount || 0;

      // Healthy customers (health score >= 80)
      let healthyQuery = supabase.from('customers').select('*', { count: 'exact', head: true });
      healthyQuery = applyOrgFilter(healthyQuery, req);
      const { count: healthyCount } = await healthyQuery.gte('health_score', 80);

      metrics.healthyCustomers = healthyCount || 0;

      // Pending approvals
      const { count: pendingCount } = await supabase
        .from('approval_requests')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'pending');

      metrics.pendingApprovals = pendingCount || 0;

      // Agent runs today
      const { count: agentRuns } = await supabase
        .from('agent_activity_log')
        .select('*', { count: 'exact', head: true })
        .gte('started_at', todayStart.toISOString())
        .in('action_type', ['agent_run', 'agentic_execution']);

      metrics.agentRunsToday = agentRuns || 0;

      // Average response time (from completed activities today)
      const { data: durations } = await supabase
        .from('agent_activity_log')
        .select('duration_ms')
        .gte('started_at', todayStart.toISOString())
        .not('duration_ms', 'is', null)
        .limit(100);

      if (durations && durations.length > 0) {
        const avgDuration = durations.reduce((sum, d) => sum + (d.duration_ms || 0), 0) / durations.length;
        metrics.avgResponseTimeMs = Math.round(avgDuration);
      }
    } else {
      // Mock data for demo when database not available
      metrics = {
        dailyActiveUsers: 42,
        weeklyActiveUsers: 156,
        actionsToday: 287,
        actionsThisWeek: 1843,
        errorRate: 0.5,
        totalCustomers: 24,
        atRiskCustomers: 5,
        healthyCustomers: 15,
        pendingApprovals: 3,
        agentRunsToday: 47,
        avgResponseTimeMs: 234
      };
    }

    res.json({
      timestamp: now.toISOString(),
      period: {
        today: todayStart.toISOString(),
        weekStart: weekAgoStart.toISOString()
      },
      metrics,
      summary: {
        healthDistribution: {
          healthy: metrics.healthyCustomers,
          atRisk: metrics.atRiskCustomers,
          other: metrics.totalCustomers - metrics.healthyCustomers - metrics.atRiskCustomers
        },
        systemHealth: metrics.errorRate < 1 ? 'good' : metrics.errorRate < 5 ? 'degraded' : 'critical'
      }
    });
  } catch (error) {
    console.error('Admin overview error:', error);
    res.status(500).json({
      error: { code: 'INTERNAL_ERROR', message: 'Failed to get admin overview' }
    });
  }
});

/**
 * GET /api/admin/users
 * List users with basic info (admin only)
 */
router.get('/users', requireAdmin, async (req: Request, res: Response) => {
  try {
    const { limit = '50', offset = '0' } = req.query;

    if (!supabase) {
      return res.json({
        users: [
          { id: 'demo-1', email: 'admin@example.com', role: 'admin', lastActive: new Date().toISOString() },
          { id: 'demo-2', email: 'csm@example.com', role: 'member', lastActive: new Date().toISOString() }
        ],
        total: 2
      });
    }

    // Get users with basic info
    const { data, error, count } = await supabase
      .from('profiles')
      .select('id, email, full_name, role, last_login', { count: 'exact' })
      .range(parseInt(offset as string), parseInt(offset as string) + parseInt(limit as string) - 1)
      .order('last_login', { ascending: false });

    if (error) {
      console.warn('Could not fetch users:', error.message);
      return res.json({ users: [], total: 0 });
    }

    res.json({
      users: data || [],
      total: count || 0,
      limit: parseInt(limit as string),
      offset: parseInt(offset as string)
    });
  } catch (error) {
    console.error('List users error:', error);
    res.status(500).json({
      error: { code: 'INTERNAL_ERROR', message: 'Failed to list users' }
    });
  }
});

/**
 * GET /api/admin/activity
 * Get recent platform activity (admin only)
 */
router.get('/activity', requireAdmin, async (req: Request, res: Response) => {
  try {
    const { limit = '50', type } = req.query;

    if (!supabase) {
      return res.json({
        activities: [
          {
            id: 'act-1',
            type: 'agent_run',
            description: 'Renewal agent analyzed 5 at-risk accounts',
            timestamp: new Date().toISOString()
          },
          {
            id: 'act-2',
            type: 'user_action',
            description: 'User approved email draft',
            timestamp: new Date(Date.now() - 3600000).toISOString()
          }
        ],
        total: 2
      });
    }

    let query = supabase
      .from('agent_activity_log')
      .select('id, action_type, agent_type, customer_id, status, started_at, completed_at')
      .order('started_at', { ascending: false })
      .limit(parseInt(limit as string));

    if (type) {
      query = query.eq('action_type', type);
    }

    const { data, error } = await query;

    if (error) {
      console.warn('Could not fetch activity:', error.message);
      return res.json({ activities: [], total: 0 });
    }

    res.json({
      activities: (data || []).map(a => ({
        id: a.id,
        type: a.action_type,
        agentType: a.agent_type,
        customerId: a.customer_id,
        status: a.status,
        timestamp: a.started_at,
        completedAt: a.completed_at
      })),
      total: data?.length || 0
    });
  } catch (error) {
    console.error('Get activity error:', error);
    res.status(500).json({
      error: { code: 'INTERNAL_ERROR', message: 'Failed to get activity' }
    });
  }
});

export { router as adminRoutes };
