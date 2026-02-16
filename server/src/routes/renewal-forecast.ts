/**
 * PRD-163: Renewal Forecast Report
 * API routes for renewal tracking and forecasting
 */

import { Router, Request, Response } from 'express';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { config } from '../config/index.js';
import { applyOrgFilter } from '../middleware/orgFilter.js';

const router = Router();

// Initialize Supabase client
let supabase: SupabaseClient | null = null;
if (config.supabaseUrl && config.supabaseServiceKey) {
  supabase = createClient(config.supabaseUrl, config.supabaseServiceKey);
}

// Types
type RenewalStage = 'not_started' | 'prep' | 'value_review' | 'proposal_sent' | 'negotiation' | 'verbal_commit' | 'closed';
type RiskLevel = 'low' | 'medium' | 'high' | 'critical';

interface Renewal {
  id: string;
  customer_id: string;
  customer_name?: string;
  renewal_date: string;
  days_to_renewal?: number;
  current_arr: number;
  proposed_arr?: number;
  stage: RenewalStage;
  probability: number;
  risk_level: RiskLevel;
  health_score?: number;
  engagement_score?: number;
  nps_score?: number;
  readiness_score: number;
  checklist?: any[];
  outcome?: string;
  outcome_arr?: number;
  csm_id?: string;
  owner_name?: string;
  notes?: string;
  created_at: string;
  updated_at: string;
}

// Helper: Calculate days to renewal
function calculateDaysToRenewal(renewalDate: string): number {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const renewal = new Date(renewalDate);
  renewal.setHours(0, 0, 0, 0);
  const diffTime = renewal.getTime() - today.getTime();
  return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
}

// Helper: Calculate risk level based on various factors
function calculateRiskLevel(
  healthScore: number | null,
  engagementScore: number | null,
  npsScore: number | null,
  daysToRenewal: number,
  stage: RenewalStage
): RiskLevel {
  let riskScore = 0;

  // Health score factor (0-40 points)
  if (healthScore !== null) {
    if (healthScore < 40) riskScore += 40;
    else if (healthScore < 60) riskScore += 25;
    else if (healthScore < 70) riskScore += 10;
  }

  // Engagement factor (0-25 points)
  if (engagementScore !== null) {
    if (engagementScore < 40) riskScore += 25;
    else if (engagementScore < 60) riskScore += 15;
    else if (engagementScore < 70) riskScore += 5;
  }

  // Time factor (0-20 points)
  if (daysToRenewal < 30 && stage === 'not_started') {
    riskScore += 20;
  } else if (daysToRenewal < 60 && stage === 'not_started') {
    riskScore += 10;
  }

  // NPS factor (0-15 points)
  if (npsScore !== null) {
    if (npsScore < 7) riskScore += 15;
    else if (npsScore < 8) riskScore += 5;
  }

  // Categorize
  if (riskScore >= 60) return 'critical';
  if (riskScore >= 40) return 'high';
  if (riskScore >= 20) return 'medium';
  return 'low';
}

// Helper: Calculate readiness score from checklist
function calculateReadinessScore(checklist: any[]): number {
  if (!checklist || checklist.length === 0) return 0;
  const completed = checklist.filter(item => item.is_completed).length;
  return Math.round((completed / checklist.length) * 100);
}

// Helper: Generate recommendations based on renewal status
function generateRecommendations(renewal: Renewal): string[] {
  const recommendations: string[] = [];
  const daysToRenewal = renewal.days_to_renewal || calculateDaysToRenewal(renewal.renewal_date);

  // Stage-based recommendations
  if (renewal.stage === 'not_started' && daysToRenewal < 60) {
    recommendations.push('URGENT: Initiate renewal conversation immediately');
  }

  if (renewal.stage === 'not_started' && daysToRenewal < 30) {
    recommendations.push('CRITICAL: Renewal is less than 30 days out with no progress');
  }

  // Health-based recommendations
  if (renewal.health_score && renewal.health_score < 50) {
    recommendations.push('Schedule health review meeting to address concerns');
  }

  // Engagement-based recommendations
  if (renewal.engagement_score && renewal.engagement_score < 50) {
    recommendations.push('Re-engage key stakeholders before renewal discussion');
  }

  // NPS-based recommendations
  if (renewal.nps_score && renewal.nps_score < 7) {
    recommendations.push('Address detractor feedback before renewal conversation');
  }

  // Readiness-based recommendations
  if (renewal.readiness_score < 50 && daysToRenewal < 45) {
    recommendations.push('Complete renewal readiness checklist items');
  }

  // Risk-based recommendations
  if (renewal.risk_level === 'critical') {
    recommendations.push('Escalate to leadership and consider executive engagement');
  } else if (renewal.risk_level === 'high') {
    recommendations.push('Develop risk mitigation plan and increase touchpoints');
  }

  // Default if no specific recommendations
  if (recommendations.length === 0) {
    recommendations.push('Continue standard renewal process');
  }

  return recommendations;
}

// In-memory fallback data
const mockRenewals: Renewal[] = [
  {
    id: '1',
    customer_id: 'c1',
    customer_name: 'Acme Corporation',
    renewal_date: new Date(Date.now() + 28 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    current_arr: 120000,
    proposed_arr: 135000,
    stage: 'proposal_sent',
    probability: 90,
    risk_level: 'low',
    health_score: 78,
    engagement_score: 72,
    nps_score: 8,
    readiness_score: 85,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
  {
    id: '2',
    customer_id: 'c2',
    customer_name: 'TechStart Inc',
    renewal_date: new Date(Date.now() + 35 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    current_arr: 65000,
    stage: 'value_review',
    probability: 75,
    risk_level: 'medium',
    health_score: 62,
    engagement_score: 58,
    nps_score: 7,
    readiness_score: 50,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
  {
    id: '3',
    customer_id: 'c3',
    customer_name: 'DataFlow Systems',
    renewal_date: new Date(Date.now() + 18 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    current_arr: 45000,
    stage: 'not_started',
    probability: 50,
    risk_level: 'high',
    health_score: 42,
    engagement_score: 38,
    nps_score: 5,
    readiness_score: 0,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
  {
    id: '4',
    customer_id: 'c4',
    customer_name: 'CloudNine Solutions',
    renewal_date: new Date(Date.now() + 52 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    current_arr: 90000,
    stage: 'prep',
    probability: 85,
    risk_level: 'low',
    health_score: 81,
    engagement_score: 75,
    nps_score: 9,
    readiness_score: 33,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
  {
    id: '5',
    customer_id: 'c5',
    customer_name: 'MegaCorp Industries',
    renewal_date: new Date(Date.now() + 45 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    current_arr: 180000,
    proposed_arr: 200000,
    stage: 'negotiation',
    probability: 80,
    risk_level: 'medium',
    health_score: 68,
    engagement_score: 65,
    nps_score: 7,
    readiness_score: 67,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
];

/**
 * GET /api/reports/renewal-forecast
 * Get renewal forecast with all renewals
 */
router.get('/', async (req: Request, res: Response) => {
  try {
    const {
      period,
      csm_id,
      risk_level,
      stage,
      days_min,
      days_max,
    } = req.query;

    let renewals: Renewal[] = [];
    const today = new Date();
    const todayStr = today.toISOString().split('T')[0];

    // Calculate period dates
    let periodStart = todayStr;
    let periodEnd: string;

    switch (period) {
      case 'Q1':
        periodStart = `${today.getFullYear()}-01-01`;
        periodEnd = `${today.getFullYear()}-03-31`;
        break;
      case 'Q2':
        periodStart = `${today.getFullYear()}-04-01`;
        periodEnd = `${today.getFullYear()}-06-30`;
        break;
      case 'Q3':
        periodStart = `${today.getFullYear()}-07-01`;
        periodEnd = `${today.getFullYear()}-09-30`;
        break;
      case 'Q4':
        periodStart = `${today.getFullYear()}-10-01`;
        periodEnd = `${today.getFullYear()}-12-31`;
        break;
      case 'year':
        periodStart = `${today.getFullYear()}-01-01`;
        periodEnd = `${today.getFullYear()}-12-31`;
        break;
      default:
        // Default to next 90 days
        const ninetyDaysOut = new Date(today.getTime() + 90 * 24 * 60 * 60 * 1000);
        periodEnd = ninetyDaysOut.toISOString().split('T')[0];
    }

    if (supabase) {
      try {
        // Build query
        let query = supabase
          .from('renewals')
          .select(`
            *,
            customers:customer_id (
              id,
              name,
              industry,
              segment,
              health_score,
              arr
            )
          `)
          .gte('renewal_date', periodStart)
          .lte('renewal_date', periodEnd)
          .is('outcome', null) // Only open renewals
          .order('renewal_date', { ascending: true });

        // Apply filters
        if (csm_id) {
          query = query.eq('csm_id', csm_id);
        }
        if (risk_level) {
          query = query.eq('risk_level', risk_level);
        }
        if (stage) {
          query = query.eq('stage', stage);
        }

        const { data, error } = await query;

        if (error) throw error;

        // Transform data
        renewals = (data || []).map((r: any) => {
          const daysToRenewal = calculateDaysToRenewal(r.renewal_date);

          // Get health score from customer if not on renewal
          const healthScore = r.health_score ?? r.customers?.health_score ?? null;

          // Calculate risk level
          const riskLevel = calculateRiskLevel(
            healthScore,
            r.engagement_score,
            r.nps_score,
            daysToRenewal,
            r.stage
          );

          return {
            ...r,
            customer_name: r.customers?.name || 'Unknown',
            days_to_renewal: daysToRenewal,
            health_score: healthScore,
            risk_level: riskLevel,
            current_arr: r.current_arr || r.customers?.arr || 0,
          };
        });

        // Apply days filter if provided
        if (days_min) {
          renewals = renewals.filter(r => (r.days_to_renewal || 0) >= parseInt(days_min as string));
        }
        if (days_max) {
          renewals = renewals.filter(r => (r.days_to_renewal || 0) <= parseInt(days_max as string));
        }

        // Get checklist items for each renewal
        const renewalIds = renewals.map(r => r.id);
        if (renewalIds.length > 0) {
          const { data: checklistData } = await supabase
            .from('renewal_checklist_items')
            .select('*')
            .in('renewal_id', renewalIds)
            .order('sort_order');

          // Attach checklists to renewals
          renewals = renewals.map(r => {
            const checklist = (checklistData || []).filter((c: any) => c.renewal_id === r.id);
            return {
              ...r,
              checklist,
              readiness_score: calculateReadinessScore(checklist),
            };
          });
        }
      } catch (supabaseError) {
        console.error('Supabase error, using fallback:', supabaseError);
        renewals = mockRenewals;
      }
    } else {
      // Use mock data
      renewals = mockRenewals.map(r => ({
        ...r,
        days_to_renewal: calculateDaysToRenewal(r.renewal_date),
      }));
    }

    // Calculate forecast metrics
    const totalRenewals = renewals.length;
    const totalArr = renewals.reduce((sum, r) => sum + (r.current_arr || 0), 0);
    const weightedArr = renewals.reduce((sum, r) => sum + ((r.current_arr || 0) * (r.probability / 100)), 0);

    // Forecast breakdown by probability
    const commitRenewals = renewals.filter(r => r.probability >= 90);
    const likelyRenewals = renewals.filter(r => r.probability >= 70 && r.probability < 90);
    const atRiskRenewals = renewals.filter(r => r.probability < 70);

    const commitArr = commitRenewals.reduce((sum, r) => sum + (r.current_arr || 0), 0);
    const likelyArr = likelyRenewals.reduce((sum, r) => sum + (r.current_arr || 0), 0);
    const atRiskArr = atRiskRenewals.reduce((sum, r) => sum + (r.current_arr || 0), 0);

    // By stage breakdown
    const stages: RenewalStage[] = ['not_started', 'prep', 'value_review', 'proposal_sent', 'negotiation', 'verbal_commit', 'closed'];
    const byStage = stages.map(s => {
      const stageRenewals = renewals.filter(r => r.stage === s);
      return {
        stage: s,
        count: stageRenewals.length,
        arr: stageRenewals.reduce((sum, r) => sum + (r.current_arr || 0), 0),
      };
    }).filter(s => s.count > 0);

    // By risk breakdown
    const risks: RiskLevel[] = ['low', 'medium', 'high', 'critical'];
    const byRisk = risks.map(r => {
      const riskRenewals = renewals.filter(ren => ren.risk_level === r);
      return {
        risk_level: r,
        count: riskRenewals.length,
        arr: riskRenewals.reduce((sum, ren) => sum + (ren.current_arr || 0), 0),
      };
    }).filter(r => r.count > 0);

    // By month breakdown
    const byMonth: { month: string; count: number; arr: number; weighted_arr: number }[] = [];
    const monthMap = new Map<string, { count: number; arr: number; weighted_arr: number }>();

    renewals.forEach(r => {
      const monthKey = r.renewal_date.substring(0, 7); // YYYY-MM
      const existing = monthMap.get(monthKey) || { count: 0, arr: 0, weighted_arr: 0 };
      monthMap.set(monthKey, {
        count: existing.count + 1,
        arr: existing.arr + (r.current_arr || 0),
        weighted_arr: existing.weighted_arr + ((r.current_arr || 0) * (r.probability / 100)),
      });
    });

    monthMap.forEach((value, key) => {
      byMonth.push({ month: key, ...value });
    });
    byMonth.sort((a, b) => a.month.localeCompare(b.month));

    // Generate calendar view
    const calendar: any[] = [];
    const dateMap = new Map<string, any[]>();

    renewals.forEach(r => {
      const date = r.renewal_date;
      const existing = dateMap.get(date) || [];
      existing.push({
        id: r.id,
        customer_name: r.customer_name,
        arr: r.current_arr,
        risk_level: r.risk_level,
      });
      dateMap.set(date, existing);
    });

    dateMap.forEach((renewalList, date) => {
      calendar.push({
        date,
        count: renewalList.length,
        total_arr: renewalList.reduce((sum, r) => sum + r.arr, 0),
        renewals: renewalList,
      });
    });
    calendar.sort((a, b) => a.date.localeCompare(b.date));

    // Build response
    const response = {
      forecast: {
        period: period || '90d',
        period_start: periodStart,
        period_end: periodEnd,
        pipeline: {
          total_renewals: totalRenewals,
          total_arr: totalArr,
          weighted_arr: Math.round(weightedArr),
        },
        forecast: {
          commit: commitArr,
          likely: likelyArr,
          at_risk: atRiskArr,
        },
        by_stage: byStage,
        by_risk: byRisk,
        by_month: byMonth,
      },
      renewals: renewals.map(r => ({
        ...r,
        customer: {
          id: r.customer_id,
          name: r.customer_name,
        },
      })),
      calendar,
      trends: [], // Would need historical data
      generated_at: new Date().toISOString(),
    };

    res.json(response);
  } catch (error) {
    console.error('Renewal forecast error:', error);
    res.status(500).json({ error: 'Failed to generate renewal forecast' });
  }
});

/**
 * GET /api/reports/renewal-forecast/:customerId
 * Get detailed renewal information for a specific customer
 */
router.get('/:customerId', async (req: Request, res: Response) => {
  try {
    const { customerId } = req.params;
    let renewal: Renewal | null = null;
    let history: any[] = [];
    let checklist: any[] = [];

    if (supabase) {
      // Get renewal with customer data
      const { data: renewalData, error: renewalError } = await supabase
        .from('renewals')
        .select(`
          *,
          customers:customer_id (
            id,
            name,
            industry,
            segment,
            health_score
          )
        `)
        .eq('customer_id', customerId)
        .is('outcome', null)
        .order('renewal_date', { ascending: true })
        .limit(1)
        .single();

      if (renewalError && renewalError.code !== 'PGRST116') {
        throw renewalError;
      }

      if (renewalData) {
        const daysToRenewal = calculateDaysToRenewal(renewalData.renewal_date);
        const healthScore = renewalData.health_score ?? renewalData.customers?.health_score ?? null;

        renewal = {
          ...renewalData,
          customer_name: renewalData.customers?.name || 'Unknown',
          days_to_renewal: daysToRenewal,
          health_score: healthScore,
          risk_level: calculateRiskLevel(
            healthScore,
            renewalData.engagement_score,
            renewalData.nps_score,
            daysToRenewal,
            renewalData.stage
          ),
        };

        // Get checklist
        const { data: checklistData } = await supabase
          .from('renewal_checklist_items')
          .select('*')
          .eq('renewal_id', renewal.id)
          .order('sort_order');

        checklist = checklistData || [];
        renewal.readiness_score = calculateReadinessScore(checklist);

        // Get history
        const { data: historyData } = await supabase
          .from('renewal_history')
          .select('*')
          .eq('renewal_id', renewal.id)
          .order('created_at', { ascending: false });

        history = historyData || [];
      }
    } else {
      // Use mock data
      renewal = mockRenewals.find(r => r.customer_id === customerId) || null;
      if (renewal) {
        renewal.days_to_renewal = calculateDaysToRenewal(renewal.renewal_date);
      }
    }

    if (!renewal) {
      return res.status(404).json({ error: 'No active renewal found for this customer' });
    }

    // Generate recommendations
    const recommendations = generateRecommendations(renewal);

    // Generate risk factors analysis
    const riskFactors = [
      {
        factor: 'Health Score',
        status: (renewal.health_score || 0) >= 70 ? 'good' : (renewal.health_score || 0) >= 50 ? 'warning' : 'critical',
        value: renewal.health_score || 'N/A',
        description: `Customer health is ${(renewal.health_score || 0) >= 70 ? 'healthy' : (renewal.health_score || 0) >= 50 ? 'needs attention' : 'at risk'}`,
      },
      {
        factor: 'Engagement',
        status: (renewal.engagement_score || 0) >= 70 ? 'good' : (renewal.engagement_score || 0) >= 50 ? 'warning' : 'critical',
        value: renewal.engagement_score || 'N/A',
        description: `Stakeholder engagement is ${(renewal.engagement_score || 0) >= 70 ? 'strong' : (renewal.engagement_score || 0) >= 50 ? 'moderate' : 'low'}`,
      },
      {
        factor: 'NPS Score',
        status: (renewal.nps_score || 0) >= 8 ? 'good' : (renewal.nps_score || 0) >= 7 ? 'warning' : 'critical',
        value: renewal.nps_score || 'N/A',
        description: renewal.nps_score ? `Customer is a ${renewal.nps_score >= 9 ? 'Promoter' : renewal.nps_score >= 7 ? 'Passive' : 'Detractor'}` : 'No NPS data',
      },
      {
        factor: 'Timeline',
        status: (renewal.days_to_renewal || 0) > 60 ? 'good' : (renewal.days_to_renewal || 0) > 30 ? 'warning' : 'critical',
        value: `${renewal.days_to_renewal} days`,
        description: `${renewal.days_to_renewal} days until renewal date`,
      },
    ];

    const response = {
      renewal: {
        ...renewal,
        customer: {
          id: renewal.customer_id,
          name: renewal.customer_name,
        },
      },
      history,
      checklist,
      recommendations,
      risk_factors: riskFactors,
    };

    res.json(response);
  } catch (error) {
    console.error('Renewal detail error:', error);
    res.status(500).json({ error: 'Failed to get renewal details' });
  }
});

/**
 * PUT /api/reports/renewal-forecast/:renewalId
 * Update a renewal's status, stage, or other fields
 */
router.put('/:renewalId', async (req: Request, res: Response) => {
  try {
    const { renewalId } = req.params;
    const { stage, probability, proposed_arr, notes, outcome, outcome_arr } = req.body;

    if (!supabase) {
      return res.status(501).json({ error: 'Database not configured' });
    }

    // Build update object
    const updates: any = { updated_at: new Date().toISOString() };
    if (stage !== undefined) updates.stage = stage;
    if (probability !== undefined) updates.probability = probability;
    if (proposed_arr !== undefined) updates.proposed_arr = proposed_arr;
    if (notes !== undefined) updates.notes = notes;
    if (outcome !== undefined) {
      updates.outcome = outcome;
      updates.outcome_date = new Date().toISOString().split('T')[0];
    }
    if (outcome_arr !== undefined) updates.outcome_arr = outcome_arr;

    // Update renewal
    const { data, error } = await supabase
      .from('renewals')
      .update(updates)
      .eq('id', renewalId)
      .select()
      .single();

    if (error) throw error;

    // Record history
    await supabase.from('renewal_history').insert({
      renewal_id: renewalId,
      stage: data.stage,
      probability: data.probability,
      risk_level: data.risk_level,
      proposed_arr: data.proposed_arr,
      change_reason: `Updated: ${Object.keys(updates).filter(k => k !== 'updated_at').join(', ')}`,
    });

    res.json(data);
  } catch (error) {
    console.error('Renewal update error:', error);
    res.status(500).json({ error: 'Failed to update renewal' });
  }
});

/**
 * PUT /api/reports/renewal-forecast/:renewalId/checklist/:itemId
 * Update a checklist item
 */
router.put('/:renewalId/checklist/:itemId', async (req: Request, res: Response) => {
  try {
    const { renewalId, itemId } = req.params;
    const { is_completed } = req.body;

    if (!supabase) {
      return res.status(501).json({ error: 'Database not configured' });
    }

    const updates: any = {
      is_completed,
    };

    if (is_completed) {
      updates.completed_at = new Date().toISOString();
    } else {
      updates.completed_at = null;
      updates.completed_by = null;
    }

    const { data, error } = await supabase
      .from('renewal_checklist_items')
      .update(updates)
      .eq('id', itemId)
      .eq('renewal_id', renewalId)
      .select()
      .single();

    if (error) throw error;

    // Get updated checklist and recalculate readiness
    const { data: checklist } = await supabase
      .from('renewal_checklist_items')
      .select('*')
      .eq('renewal_id', renewalId)
      .order('sort_order');

    const readinessScore = calculateReadinessScore(checklist || []);

    // Update renewal readiness score
    await supabase
      .from('renewals')
      .update({ readiness_score: readinessScore })
      .eq('id', renewalId);

    res.json({
      item: data,
      readiness_score: readinessScore,
    });
  } catch (error) {
    console.error('Checklist update error:', error);
    res.status(500).json({ error: 'Failed to update checklist item' });
  }
});

/**
 * POST /api/reports/renewal-forecast/sync
 * Sync renewals from customers table
 */
router.post('/sync', async (req: Request, res: Response) => {
  try {
    if (!supabase) {
      return res.status(501).json({ error: 'Database not configured' });
    }

    // Get customers with renewal dates that don't have renewal records
    let customersQuery = supabase
      .from('customers')
      .select('id, name, arr, health_score, csm_id, renewal_date');
    customersQuery = applyOrgFilter(customersQuery, req);
    const { data: customers, error: customersError } = await customersQuery
      .not('renewal_date', 'is', null);

    if (customersError) throw customersError;

    let synced = 0;

    for (const customer of customers || []) {
      // Check if renewal already exists
      const { data: existing } = await supabase
        .from('renewals')
        .select('id')
        .eq('customer_id', customer.id)
        .eq('renewal_date', customer.renewal_date)
        .single();

      if (!existing) {
        // Create renewal record
        const { error: insertError } = await supabase
          .from('renewals')
          .insert({
            customer_id: customer.id,
            renewal_date: customer.renewal_date,
            current_arr: customer.arr || 0,
            health_score: customer.health_score,
            csm_id: customer.csm_id,
            stage: 'not_started',
            probability: 50,
          });

        if (!insertError) {
          synced++;

          // Insert default checklist items
          const checklistItems = [
            { item_key: 'value_summary', item_label: 'Value summary created', timing_days: 90, sort_order: 1 },
            { item_key: 'qbr_completed', item_label: 'QBR completed', timing_days: 60, sort_order: 2 },
            { item_key: 'exec_sponsor_engaged', item_label: 'Executive sponsor engaged', timing_days: 60, sort_order: 3 },
            { item_key: 'proposal_drafted', item_label: 'Renewal proposal drafted', timing_days: 45, sort_order: 4 },
            { item_key: 'proposal_sent', item_label: 'Proposal sent to customer', timing_days: 30, sort_order: 5 },
            { item_key: 'verbal_commit', item_label: 'Verbal commitment received', timing_days: 14, sort_order: 6 },
            { item_key: 'contract_signed', item_label: 'Contract signed', timing_days: 0, sort_order: 7 },
          ];

          const { data: newRenewal } = await supabase
            .from('renewals')
            .select('id')
            .eq('customer_id', customer.id)
            .eq('renewal_date', customer.renewal_date)
            .single();

          if (newRenewal) {
            await supabase.from('renewal_checklist_items').insert(
              checklistItems.map(item => ({
                ...item,
                renewal_id: newRenewal.id,
              }))
            );
          }
        }
      }
    }

    res.json({
      message: `Synced ${synced} new renewals`,
      synced,
    });
  } catch (error) {
    console.error('Sync error:', error);
    res.status(500).json({ error: 'Failed to sync renewals' });
  }
});

export default router;
