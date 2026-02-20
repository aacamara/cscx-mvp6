/**
 * Dashboard API Routes
 * Provides portfolio summary and metrics
 */

import { Router, Request, Response } from 'express';
import { createClient } from '@supabase/supabase-js';
import { config } from '../config/index.js';
import { applyOrgFilter } from '../middleware/orgFilter.js';

const router = Router();
const supabase = createClient(config.supabaseUrl!, config.supabaseServiceKey!);

/**
 * GET /api/dashboard/summary
 * Get portfolio summary with health distribution
 */
router.get('/summary', async (req: Request, res: Response) => {
  try {
    // Get customer counts by health (org-filtered)
    let custQuery = supabase
      .from('customers')
      .select('health_color, arr');
    custQuery = applyOrgFilter(custQuery, req);
    const { data: customers, error: custError } = await custQuery;

    if (custError) throw custError;

    const totalCustomers = customers?.length || 0;
    const totalARR = customers?.reduce((sum, c) => sum + (Number(c.arr) || 0), 0) || 0;
    const greenCount = customers?.filter(c => c.health_color === 'green').length || 0;
    const yellowCount = customers?.filter(c => c.health_color === 'yellow').length || 0;
    const redCount = customers?.filter(c => c.health_color === 'red').length || 0;

    // Get open CTAs count (org-filtered)
    let ctaQuery = supabase
      .from('ctas')
      .select('*', { count: 'exact', head: true })
      .in('status', ['open', 'in_progress']);
    ctaQuery = applyOrgFilter(ctaQuery, req);
    const { count: openCTAs, error: ctaError } = await ctaQuery;

    // Get renewals in next 90 days
    const ninetyDaysOut = new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
    const today = new Date().toISOString().split('T')[0];

    let renewalQuery = supabase
      .from('customers')
      .select('id, name, arr, renewal_date, health_color')
      .lte('renewal_date', ninetyDaysOut)
      .gte('renewal_date', today)
      .order('renewal_date');
    renewalQuery = applyOrgFilter(renewalQuery, req);
    const { data: renewals, error: renewalError } = await renewalQuery;

    res.json({
      totalCustomers,
      totalARR,
      healthDistribution: {
        green: greenCount,
        yellow: yellowCount,
        red: redCount,
        greenPercent: totalCustomers ? Math.round((greenCount / totalCustomers) * 100) : 0,
        yellowPercent: totalCustomers ? Math.round((yellowCount / totalCustomers) * 100) : 0,
        redPercent: totalCustomers ? Math.round((redCount / totalCustomers) * 100) : 0
      },
      openCTAs: openCTAs || 0,
      upcomingRenewals: renewals || []
    });
  } catch (error) {
    console.error('Dashboard summary error:', error);
    res.status(500).json({ error: (error as Error).message });
  }
});

/**
 * GET /api/dashboard/portfolio
 * Get full portfolio view
 */
router.get('/portfolio', async (req: Request, res: Response) => {
  try {
    let portfolioQuery = supabase
      .from('customers')
      .select('id, name, segment, arr, health_score, health_color, renewal_date, industry')
      .order('arr', { ascending: false });
    portfolioQuery = applyOrgFilter(portfolioQuery, req);
    const { data, error } = await portfolioQuery;

    if (error) throw error;
    res.json(data);
  } catch (error) {
    console.error('Portfolio error:', error);
    res.status(500).json({ error: (error as Error).message });
  }
});

/**
 * GET /api/dashboard/ctas
 * Get open CTAs summary
 */
router.get('/ctas', async (req: Request, res: Response) => {
  try {
    let ctaListQuery = supabase
      .from('ctas')
      .select(`
        *,
        customers (id, name, health_color)
      `)
      .in('status', ['open', 'in_progress'])
      .order('due_date');
    ctaListQuery = applyOrgFilter(ctaListQuery, req);
    const { data, error } = await ctaListQuery;

    if (error) throw error;
    res.json(data);
  } catch (error) {
    console.error('CTAs error:', error);
    res.status(500).json({ error: (error as Error).message });
  }
});

export { router as dashboardRoutes };
