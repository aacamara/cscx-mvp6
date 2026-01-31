/**
 * Churn Post-Mortem Service (PRD-124)
 *
 * Handles automated churn post-mortem workflows:
 * - Churn detection and post-mortem initiation
 * - Customer history data compilation
 * - AI-powered analysis generation
 * - Pattern analysis and aggregation
 * - Win-back opportunity assessment
 */

import { supabase } from './supabase.js';
import { logger } from './logger.js';

// ============================================
// Types (matching frontend types)
// ============================================

export type ChurnReason =
  | 'price_value'
  | 'product_gaps'
  | 'poor_onboarding'
  | 'champion_left'
  | 'strategic_ma'
  | 'competitive'
  | 'support_issues'
  | 'relationship'
  | 'budget_cuts'
  | 'other';

export type ChurnPostMortemStatus =
  | 'initiated'
  | 'data_gathered'
  | 'analysis_pending'
  | 'review_scheduled'
  | 'completed'
  | 'closed';

export type WinBackPotential = 'high' | 'medium' | 'low' | 'none';

export type ChurnDetectionSource =
  | 'stage_change'
  | 'non_renewal'
  | 'cancellation'
  | 'deactivation'
  | 'manual';

export interface ChurnPostMortem {
  id: string;
  customer_id: string;
  churn_date: string;
  arr_lost: number;
  status: ChurnPostMortemStatus;
  detection_source?: ChurnDetectionSource;
  detected_at: string;
  detected_by?: string;
  primary_root_cause?: ChurnReason;
  contributing_factors: ChurnReason[];
  custom_notes?: string;
  win_back_potential: WinBackPotential;
  win_back_triggers: string[];
  win_back_reminder_date?: string;
  review_scheduled_at?: string;
  review_attendees: string[];
  review_outcome?: string;
  document_id?: string;
  document_url?: string;
  created_at: string;
  updated_at: string;
  completed_at?: string;
  created_by?: string;
  assigned_to?: string;
  // Joined fields
  customer_name?: string;
  customer_industry?: string;
  customer_segment?: string;
}

export interface DataCompilation {
  id: string;
  post_mortem_id: string;
  health_score_history: unknown[];
  risk_signals: unknown[];
  support_summary: Record<string, unknown>;
  meeting_sentiments: unknown[];
  usage_trend: Record<string, unknown>;
  save_plays: unknown[];
  interaction_timeline: unknown[];
  compiled_at: string;
  compiled_by?: string;
}

export interface ChurnAnalysis {
  id: string;
  post_mortem_id: string;
  early_warning_signals: string[];
  missed_opportunities: string[];
  lessons_learned: string[];
  recommendations: string[];
  executive_summary?: string;
  customer_snapshot: Record<string, unknown>;
  churn_timeline: unknown[];
  generated_at: string;
  generated_by?: string;
  reviewed_by?: string;
  reviewed_at?: string;
}

export interface ChurnPattern {
  id: string;
  pattern_type: string;
  pattern_name: string;
  pattern_description?: string;
  occurrence_count: number;
  affected_arr: number;
  breakdown_data: Record<string, unknown>;
  period_start?: string;
  period_end?: string;
  last_updated: string;
}

// ============================================
// Churn Post-Mortem Service
// ============================================

class ChurnPostMortemService {
  /**
   * Initiate a new churn post-mortem
   */
  async initiatePostMortem(params: {
    customerId: string;
    churnDate?: string;
    detectionSource?: ChurnDetectionSource;
    arrLost?: number;
    createdBy?: string;
  }): Promise<ChurnPostMortem> {
    const { customerId, churnDate, detectionSource = 'manual', arrLost, createdBy } = params;

    // Get customer details
    const { data: customer, error: customerError } = await supabase
      .from('customers')
      .select('id, name, arr, industry, segment')
      .eq('id', customerId)
      .single();

    if (customerError || !customer) {
      throw new Error(`Customer not found: ${customerId}`);
    }

    // Calculate ARR lost (use provided value or customer's ARR)
    const actualArrLost = arrLost ?? customer.arr ?? 0;

    // Create post-mortem record
    const { data: postMortem, error } = await supabase
      .from('churn_post_mortems')
      .insert({
        customer_id: customerId,
        churn_date: churnDate || new Date().toISOString(),
        arr_lost: actualArrLost,
        status: 'initiated',
        detection_source: detectionSource,
        detected_at: new Date().toISOString(),
        detected_by: createdBy,
        created_by: createdBy,
        win_back_potential: 'none',
        win_back_triggers: [],
        contributing_factors: [],
        review_attendees: []
      })
      .select()
      .single();

    if (error) {
      logger.error('Failed to create churn post-mortem', { error, customerId });
      throw new Error(`Failed to create churn post-mortem: ${error.message}`);
    }

    // Log event
    await this.logEvent({
      postMortemId: postMortem.id,
      customerId,
      eventType: 'churn_detected',
      eventData: { detectionSource, arrLost: actualArrLost },
      triggeredBy: createdBy || 'system'
    });

    await this.logEvent({
      postMortemId: postMortem.id,
      customerId,
      eventType: 'post_mortem_initiated',
      eventData: {},
      triggeredBy: createdBy || 'system'
    });

    // Update customer status to churned
    await supabase
      .from('customers')
      .update({ status: 'churned' })
      .eq('id', customerId);

    logger.info('Churn post-mortem initiated', { postMortemId: postMortem.id, customerId });

    return {
      ...postMortem,
      customer_name: customer.name,
      customer_industry: customer.industry,
      customer_segment: customer.segment
    };
  }

  /**
   * Get a post-mortem by ID with all related data
   */
  async getPostMortem(postMortemId: string): Promise<{
    postMortem: ChurnPostMortem;
    dataCompilation?: DataCompilation;
    analysis?: ChurnAnalysis;
  } | null> {
    // Get post-mortem with customer info
    const { data: postMortem, error } = await supabase
      .from('churn_post_mortems')
      .select(`
        *,
        customers (
          name,
          industry,
          segment
        )
      `)
      .eq('id', postMortemId)
      .single();

    if (error || !postMortem) {
      return null;
    }

    // Get data compilation
    const { data: dataCompilation } = await supabase
      .from('churn_data_compilations')
      .select('*')
      .eq('post_mortem_id', postMortemId)
      .single();

    // Get analysis
    const { data: analysis } = await supabase
      .from('churn_analyses')
      .select('*')
      .eq('post_mortem_id', postMortemId)
      .single();

    const customer = postMortem.customers as { name: string; industry?: string; segment?: string } | null;

    return {
      postMortem: {
        ...postMortem,
        customer_name: customer?.name,
        customer_industry: customer?.industry,
        customer_segment: customer?.segment,
        customers: undefined
      } as ChurnPostMortem,
      dataCompilation: dataCompilation || undefined,
      analysis: analysis || undefined
    };
  }

  /**
   * List post-mortems with optional filters
   */
  async listPostMortems(params: {
    status?: ChurnPostMortemStatus;
    customerId?: string;
    fromDate?: string;
    toDate?: string;
    limit?: number;
    offset?: number;
  } = {}): Promise<{ postMortems: ChurnPostMortem[]; total: number }> {
    const { status, customerId, fromDate, toDate, limit = 50, offset = 0 } = params;

    let query = supabase
      .from('churn_post_mortems')
      .select(`
        *,
        customers (
          name,
          industry,
          segment
        )
      `, { count: 'exact' });

    if (status) {
      query = query.eq('status', status);
    }

    if (customerId) {
      query = query.eq('customer_id', customerId);
    }

    if (fromDate) {
      query = query.gte('churn_date', fromDate);
    }

    if (toDate) {
      query = query.lte('churn_date', toDate);
    }

    query = query
      .order('churn_date', { ascending: false })
      .range(offset, offset + limit - 1);

    const { data, error, count } = await query;

    if (error) {
      logger.error('Failed to list post-mortems', { error });
      throw new Error(`Failed to list post-mortems: ${error.message}`);
    }

    const postMortems = (data || []).map((pm: Record<string, unknown>) => {
      const customer = pm.customers as { name: string; industry?: string; segment?: string } | null;
      return {
        ...pm,
        customer_name: customer?.name,
        customer_industry: customer?.industry,
        customer_segment: customer?.segment,
        customers: undefined
      } as ChurnPostMortem;
    });

    return {
      postMortems,
      total: count || 0
    };
  }

  /**
   * Compile customer history data for post-mortem analysis
   */
  async compileData(postMortemId: string, compiledBy?: string): Promise<DataCompilation> {
    // Get post-mortem
    const { data: postMortem, error: pmError } = await supabase
      .from('churn_post_mortems')
      .select('customer_id')
      .eq('id', postMortemId)
      .single();

    if (pmError || !postMortem) {
      throw new Error('Post-mortem not found');
    }

    const customerId = postMortem.customer_id;

    // Compile health score history
    const { data: healthScores } = await supabase
      .from('health_scores')
      .select('overall, overall_color, calculated_at, notes')
      .eq('customer_id', customerId)
      .order('calculated_at', { ascending: true })
      .limit(100);

    const healthScoreHistory = (healthScores || []).map(hs => ({
      date: hs.calculated_at,
      score: hs.overall,
      color: hs.overall_color,
      notes: hs.notes
    }));

    // Compile risk signals (from CTAs with type 'risk')
    const { data: riskCTAs } = await supabase
      .from('ctas')
      .select('id, reason, priority, created_at, closed_at, status')
      .eq('customer_id', customerId)
      .eq('type', 'risk')
      .order('created_at', { ascending: true });

    const riskSignals = (riskCTAs || []).map(cta => ({
      id: cta.id,
      type: 'risk_cta',
      severity: cta.priority,
      description: cta.reason,
      detectedAt: cta.created_at,
      resolvedAt: cta.closed_at
    }));

    // Compile support summary (mock - would integrate with support system)
    const supportSummary = {
      totalTickets: 0,
      openTickets: 0,
      avgResolutionTime: 0,
      escalations: 0,
      csat: null,
      recentIssues: []
    };

    // Compile meeting sentiments from timeline activities
    const { data: meetings } = await supabase
      .from('timeline_activities')
      .select('id, created_at, subject, content, metadata')
      .eq('customer_id', customerId)
      .in('type', ['call', 'in_person'])
      .order('created_at', { ascending: false })
      .limit(20);

    const meetingSentiments = (meetings || []).map(m => ({
      meetingId: m.id,
      date: m.created_at,
      sentiment: (m.metadata as { sentiment?: string })?.sentiment || 'neutral',
      keyTopics: [],
      concerns: [],
      attendees: []
    }));

    // Compile usage trend (mock - would integrate with usage tracking)
    const usageTrend = {
      period: '90d',
      activeUsers: { current: 0, previous: 0, trend: 'stable', percentChange: 0 },
      loginFrequency: { current: 0, previous: 0, trend: 'stable', percentChange: 0 },
      featureAdoption: { current: 0, previous: 0, trend: 'stable', percentChange: 0 },
      dataPoints: []
    };

    // Compile save plays from playbook executions
    const { data: playbooks } = await supabase
      .from('playbook_executions')
      .select(`
        id,
        status,
        started_at,
        completed_at,
        progress,
        playbooks (
          name,
          type
        )
      `)
      .eq('customer_id', customerId)
      .order('started_at', { ascending: false });

    const savePlays = (playbooks || [])
      .filter(p => (p.playbooks as { type?: string })?.type === 'save' || (p.playbooks as { type?: string })?.type === 'risk')
      .map(p => ({
        id: p.id,
        name: (p.playbooks as { name: string })?.name || 'Unknown',
        type: (p.playbooks as { type?: string })?.type || 'save',
        startedAt: p.started_at,
        completedAt: p.completed_at,
        status: p.status,
        actions: []
      }));

    // Compile interaction timeline
    const { data: activities } = await supabase
      .from('timeline_activities')
      .select('id, created_at, type, subject, content, metadata')
      .eq('customer_id', customerId)
      .order('created_at', { ascending: false })
      .limit(100);

    const interactionTimeline = (activities || []).map(a => ({
      id: a.id,
      date: a.created_at,
      type: a.type,
      title: a.subject,
      description: a.content,
      importance: 'medium',
      metadata: a.metadata
    }));

    // Insert or update data compilation
    const compilationData = {
      post_mortem_id: postMortemId,
      health_score_history: healthScoreHistory,
      risk_signals: riskSignals,
      support_summary: supportSummary,
      meeting_sentiments: meetingSentiments,
      usage_trend: usageTrend,
      save_plays: savePlays,
      interaction_timeline: interactionTimeline,
      compiled_at: new Date().toISOString(),
      compiled_by: compiledBy || 'system'
    };

    const { data: compilation, error } = await supabase
      .from('churn_data_compilations')
      .upsert(compilationData, { onConflict: 'post_mortem_id' })
      .select()
      .single();

    if (error) {
      logger.error('Failed to save data compilation', { error, postMortemId });
      throw new Error(`Failed to compile data: ${error.message}`);
    }

    // Update post-mortem status
    await supabase
      .from('churn_post_mortems')
      .update({ status: 'data_gathered' })
      .eq('id', postMortemId);

    // Log event
    await this.logEvent({
      postMortemId,
      customerId,
      eventType: 'data_compiled',
      eventData: {
        healthScorePoints: healthScoreHistory.length,
        riskSignals: riskSignals.length,
        meetings: meetingSentiments.length,
        timeline: interactionTimeline.length
      },
      triggeredBy: compiledBy || 'system'
    });

    logger.info('Data compilation complete', { postMortemId, customerId });

    return compilation;
  }

  /**
   * Set root cause classification
   */
  async setRootCause(
    postMortemId: string,
    rootCause: {
      primary: ChurnReason;
      contributing?: ChurnReason[];
      customNotes?: string;
    },
    updatedBy?: string
  ): Promise<ChurnPostMortem> {
    const { primary, contributing = [], customNotes } = rootCause;

    const { data, error } = await supabase
      .from('churn_post_mortems')
      .update({
        primary_root_cause: primary,
        contributing_factors: contributing,
        custom_notes: customNotes,
        status: 'analysis_pending'
      })
      .eq('id', postMortemId)
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to set root cause: ${error.message}`);
    }

    // Log event
    const pm = data as ChurnPostMortem;
    await this.logEvent({
      postMortemId,
      customerId: pm.customer_id,
      eventType: 'root_cause_set',
      eventData: { primary, contributing, customNotes },
      triggeredBy: updatedBy || 'system'
    });

    return pm;
  }

  /**
   * Generate AI-powered analysis
   */
  async generateAnalysis(postMortemId: string, generatedBy?: string): Promise<ChurnAnalysis> {
    // Get post-mortem and data compilation
    const result = await this.getPostMortem(postMortemId);
    if (!result) {
      throw new Error('Post-mortem not found');
    }

    const { postMortem, dataCompilation } = result;

    if (!dataCompilation) {
      throw new Error('Data compilation not found. Please compile data first.');
    }

    // Get customer details for snapshot
    const { data: customer } = await supabase
      .from('customers')
      .select('*')
      .eq('id', postMortem.customer_id)
      .single();

    // Get latest health score
    const { data: latestHealth } = await supabase
      .from('health_scores')
      .select('overall')
      .eq('customer_id', postMortem.customer_id)
      .order('calculated_at', { ascending: false })
      .limit(1)
      .single();

    // Calculate tenure
    const contractStart = customer?.contract_start_date
      ? new Date(customer.contract_start_date)
      : new Date(customer?.created_at || Date.now());
    const churnDate = new Date(postMortem.churn_date);
    const tenureMonths = Math.round((churnDate.getTime() - contractStart.getTime()) / (1000 * 60 * 60 * 24 * 30));

    // Build customer snapshot
    const customerSnapshot = {
      name: customer?.name || 'Unknown',
      industry: customer?.industry,
      arr: postMortem.arr_lost,
      segment: customer?.segment,
      tier: customer?.tier,
      tenure: tenureMonths,
      healthScoreAtChurn: latestHealth?.overall || 0,
      csmName: undefined, // Would join with users table
      products: [],
      contractStartDate: customer?.contract_start_date,
      renewalDate: customer?.renewal_date
    };

    // Generate AI analysis (mock - would call AI service)
    // In production, this would use Claude or GPT to analyze the compiled data
    const earlyWarningSignals = this.identifyEarlyWarnings(dataCompilation);
    const missedOpportunities = this.identifyMissedOpportunities(dataCompilation, postMortem);
    const lessonsLearned = this.generateLessonsLearned(postMortem, dataCompilation);
    const recommendations = this.generateRecommendations(postMortem, dataCompilation);

    // Build churn timeline
    const churnTimeline = this.buildChurnTimeline(dataCompilation, postMortem);

    // Generate executive summary
    const executiveSummary = this.generateExecutiveSummary(
      postMortem,
      customerSnapshot,
      earlyWarningSignals,
      missedOpportunities
    );

    // Insert analysis
    const analysisData = {
      post_mortem_id: postMortemId,
      early_warning_signals: earlyWarningSignals,
      missed_opportunities: missedOpportunities,
      lessons_learned: lessonsLearned,
      recommendations,
      executive_summary: executiveSummary,
      customer_snapshot: customerSnapshot,
      churn_timeline: churnTimeline,
      generated_at: new Date().toISOString(),
      generated_by: generatedBy || 'ai_agent'
    };

    const { data: analysis, error } = await supabase
      .from('churn_analyses')
      .upsert(analysisData, { onConflict: 'post_mortem_id' })
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to save analysis: ${error.message}`);
    }

    // Log event
    await this.logEvent({
      postMortemId,
      customerId: postMortem.customer_id,
      eventType: 'analysis_generated',
      eventData: {
        warningSignals: earlyWarningSignals.length,
        opportunities: missedOpportunities.length,
        recommendations: recommendations.length
      },
      triggeredBy: generatedBy || 'ai_agent'
    });

    logger.info('Analysis generated', { postMortemId });

    return analysis;
  }

  /**
   * Schedule post-mortem review meeting
   */
  async scheduleReview(
    postMortemId: string,
    scheduledAt: string,
    attendees: string[],
    scheduledBy?: string
  ): Promise<ChurnPostMortem> {
    const { data, error } = await supabase
      .from('churn_post_mortems')
      .update({
        review_scheduled_at: scheduledAt,
        review_attendees: attendees,
        status: 'review_scheduled'
      })
      .eq('id', postMortemId)
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to schedule review: ${error.message}`);
    }

    const pm = data as ChurnPostMortem;

    // Log event
    await this.logEvent({
      postMortemId,
      customerId: pm.customer_id,
      eventType: 'review_scheduled',
      eventData: { scheduledAt, attendees },
      triggeredBy: scheduledBy || 'system'
    });

    return pm;
  }

  /**
   * Complete the post-mortem
   */
  async completePostMortem(
    postMortemId: string,
    completion: {
      reviewOutcome?: string;
      lessonsLearned?: string[];
      recommendations?: string[];
      winBackAssessment?: {
        potential: WinBackPotential;
        triggers: string[];
        reminderDate?: string;
      };
    },
    completedBy?: string
  ): Promise<ChurnPostMortem> {
    const { reviewOutcome, lessonsLearned, recommendations, winBackAssessment } = completion;

    // Update analysis if lessons/recommendations provided
    if (lessonsLearned || recommendations) {
      const updates: Record<string, unknown> = {};
      if (lessonsLearned) updates.lessons_learned = lessonsLearned;
      if (recommendations) updates.recommendations = recommendations;
      updates.reviewed_by = completedBy;
      updates.reviewed_at = new Date().toISOString();

      await supabase
        .from('churn_analyses')
        .update(updates)
        .eq('post_mortem_id', postMortemId);
    }

    // Update post-mortem
    const pmUpdates: Record<string, unknown> = {
      status: 'completed',
      review_outcome: reviewOutcome
    };

    if (winBackAssessment) {
      pmUpdates.win_back_potential = winBackAssessment.potential;
      pmUpdates.win_back_triggers = winBackAssessment.triggers;
      pmUpdates.win_back_reminder_date = winBackAssessment.reminderDate;
    }

    const { data, error } = await supabase
      .from('churn_post_mortems')
      .update(pmUpdates)
      .eq('id', postMortemId)
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to complete post-mortem: ${error.message}`);
    }

    const pm = data as ChurnPostMortem;

    // Log event
    await this.logEvent({
      postMortemId,
      customerId: pm.customer_id,
      eventType: 'post_mortem_completed',
      eventData: { reviewOutcome, winBackPotential: winBackAssessment?.potential },
      triggeredBy: completedBy || 'system'
    });

    // Update churn patterns
    await this.updatePatterns();

    logger.info('Post-mortem completed', { postMortemId });

    return pm;
  }

  /**
   * Get churn pattern analysis
   */
  async getPatterns(params: {
    periodStart?: string;
    periodEnd?: string;
  } = {}): Promise<{
    rootCauseDistribution: Array<{ reason: ChurnReason; count: number; arr: number; percentage: number }>;
    segmentTrends: Array<{ segment: string; churns: number; arr: number }>;
    monthlyTrends: Array<{ month: string; churns: number; arr: number }>;
    winBackPipeline: Array<{ potential: WinBackPotential; count: number; arr: number }>;
    summary: {
      totalChurns: number;
      totalArrLost: number;
      avgArrPerChurn: number;
      completionRate: number;
    };
  }> {
    const { periodStart, periodEnd } = params;

    let query = supabase
      .from('churn_post_mortems')
      .select('*');

    if (periodStart) {
      query = query.gte('churn_date', periodStart);
    }
    if (periodEnd) {
      query = query.lte('churn_date', periodEnd);
    }

    const { data: postMortems, error } = await query;

    if (error) {
      throw new Error(`Failed to get patterns: ${error.message}`);
    }

    const pms = (postMortems || []) as ChurnPostMortem[];

    // Calculate root cause distribution
    const rootCauseCounts: Record<string, { count: number; arr: number }> = {};
    pms.forEach(pm => {
      if (pm.primary_root_cause) {
        if (!rootCauseCounts[pm.primary_root_cause]) {
          rootCauseCounts[pm.primary_root_cause] = { count: 0, arr: 0 };
        }
        rootCauseCounts[pm.primary_root_cause].count++;
        rootCauseCounts[pm.primary_root_cause].arr += pm.arr_lost;
      }
    });

    const totalChurns = pms.length;
    const rootCauseDistribution = Object.entries(rootCauseCounts).map(([reason, data]) => ({
      reason: reason as ChurnReason,
      count: data.count,
      arr: data.arr,
      percentage: totalChurns > 0 ? Math.round((data.count / totalChurns) * 100) : 0
    })).sort((a, b) => b.count - a.count);

    // Calculate segment trends (mock - would join with customers)
    const segmentTrends: Array<{ segment: string; churns: number; arr: number }> = [];

    // Calculate monthly trends
    const monthlyData: Record<string, { churns: number; arr: number }> = {};
    pms.forEach(pm => {
      const month = pm.churn_date.substring(0, 7); // YYYY-MM
      if (!monthlyData[month]) {
        monthlyData[month] = { churns: 0, arr: 0 };
      }
      monthlyData[month].churns++;
      monthlyData[month].arr += pm.arr_lost;
    });

    const monthlyTrends = Object.entries(monthlyData)
      .map(([month, data]) => ({ month, ...data }))
      .sort((a, b) => a.month.localeCompare(b.month));

    // Calculate win-back pipeline
    const winBackData: Record<WinBackPotential, { count: number; arr: number }> = {
      high: { count: 0, arr: 0 },
      medium: { count: 0, arr: 0 },
      low: { count: 0, arr: 0 },
      none: { count: 0, arr: 0 }
    };

    pms.forEach(pm => {
      const potential = pm.win_back_potential || 'none';
      winBackData[potential].count++;
      winBackData[potential].arr += pm.arr_lost;
    });

    const winBackPipeline = Object.entries(winBackData)
      .filter(([potential]) => potential !== 'none')
      .map(([potential, data]) => ({
        potential: potential as WinBackPotential,
        ...data
      }));

    // Calculate summary
    const totalArrLost = pms.reduce((sum, pm) => sum + pm.arr_lost, 0);
    const completedCount = pms.filter(pm => pm.status === 'completed' || pm.status === 'closed').length;

    return {
      rootCauseDistribution,
      segmentTrends,
      monthlyTrends,
      winBackPipeline,
      summary: {
        totalChurns,
        totalArrLost,
        avgArrPerChurn: totalChurns > 0 ? Math.round(totalArrLost / totalChurns) : 0,
        completionRate: totalChurns > 0 ? Math.round((completedCount / totalChurns) * 100) : 0
      }
    };
  }

  /**
   * Update aggregated pattern data
   */
  private async updatePatterns(): Promise<void> {
    try {
      const now = new Date();
      const periodStart = new Date(now.getFullYear(), now.getMonth() - 11, 1).toISOString();
      const periodEnd = now.toISOString();

      const patterns = await this.getPatterns({ periodStart, periodEnd });

      // Store root cause pattern
      for (const rc of patterns.rootCauseDistribution) {
        await supabase
          .from('churn_patterns')
          .upsert({
            pattern_type: 'root_cause',
            pattern_name: rc.reason,
            occurrence_count: rc.count,
            affected_arr: rc.arr,
            breakdown_data: { percentage: rc.percentage },
            period_start: periodStart.substring(0, 10),
            period_end: periodEnd.substring(0, 10),
            last_updated: now.toISOString()
          }, { onConflict: 'pattern_type,pattern_name,period_start,period_end' });
      }

      logger.info('Churn patterns updated');
    } catch (error) {
      logger.error('Failed to update patterns', { error });
    }
  }

  /**
   * Log a churn event
   */
  private async logEvent(event: {
    postMortemId?: string;
    customerId: string;
    eventType: string;
    eventData: Record<string, unknown>;
    triggeredBy: string;
  }): Promise<void> {
    try {
      await supabase
        .from('churn_events')
        .insert({
          post_mortem_id: event.postMortemId,
          customer_id: event.customerId,
          event_type: event.eventType,
          event_data: event.eventData,
          triggered_by: event.triggeredBy
        });
    } catch (error) {
      logger.error('Failed to log churn event', { error, event });
    }
  }

  // ============================================
  // AI Analysis Helper Methods
  // ============================================

  private identifyEarlyWarnings(data: DataCompilation): string[] {
    const warnings: string[] = [];

    // Check health score decline
    const healthHistory = data.health_score_history as Array<{ score: number; date: string }>;
    if (healthHistory.length >= 2) {
      const recent = healthHistory.slice(-3);
      const avgRecent = recent.reduce((s, h) => s + h.score, 0) / recent.length;
      const earlier = healthHistory.slice(0, Math.min(3, healthHistory.length));
      const avgEarlier = earlier.reduce((s, h) => s + h.score, 0) / earlier.length;

      if (avgRecent < avgEarlier - 15) {
        warnings.push('Health score declined significantly in the months before churn');
      }
    }

    // Check risk signals
    const riskSignals = data.risk_signals as Array<{ severity: string }>;
    const highRisks = riskSignals.filter(r => r.severity === 'high' || r.severity === 'critical');
    if (highRisks.length > 0) {
      warnings.push(`${highRisks.length} high/critical risk signals were raised`);
    }

    // Check meeting sentiment
    const sentiments = data.meeting_sentiments as Array<{ sentiment: string }>;
    const negatives = sentiments.filter(s => s.sentiment === 'negative');
    if (negatives.length > sentiments.length / 2) {
      warnings.push('Majority of recent meetings had negative sentiment');
    }

    // Add default if none found
    if (warnings.length === 0) {
      warnings.push('No obvious early warning signals identified - requires deeper analysis');
    }

    return warnings;
  }

  private identifyMissedOpportunities(data: DataCompilation, postMortem: ChurnPostMortem): string[] {
    const opportunities: string[] = [];

    // Check if save plays were attempted
    const savePlays = data.save_plays as Array<{ status: string }>;
    if (savePlays.length === 0) {
      opportunities.push('No save play was initiated despite churn indicators');
    }

    // Check timeline gaps
    const timeline = data.interaction_timeline as Array<{ date: string }>;
    if (timeline.length < 5) {
      opportunities.push('Low engagement - few recorded interactions with customer');
    }

    // Check based on root cause
    if (postMortem.primary_root_cause === 'product_gaps') {
      opportunities.push('Product feedback may not have been escalated to product team');
    }

    if (postMortem.primary_root_cause === 'champion_left') {
      opportunities.push('Champion departure risk was not mitigated with multi-threading');
    }

    if (postMortem.primary_root_cause === 'poor_onboarding') {
      opportunities.push('Onboarding gaps were not addressed early enough');
    }

    return opportunities;
  }

  private generateLessonsLearned(postMortem: ChurnPostMortem, data: DataCompilation): string[] {
    const lessons: string[] = [];

    // Generic lessons based on root cause
    const causeLessons: Record<ChurnReason, string> = {
      price_value: 'Ensure value delivery is documented and communicated regularly',
      product_gaps: 'Establish clear feedback loops between CS and Product teams',
      poor_onboarding: 'Review and strengthen onboarding success criteria',
      champion_left: 'Build relationships with multiple stakeholders from day one',
      strategic_ma: 'Monitor industry news for M&A signals in customer base',
      competitive: 'Track competitive mentions and proactively address concerns',
      support_issues: 'Escalate repeated support issues to engineering and leadership',
      relationship: 'Regular relationship health checks with key stakeholders',
      budget_cuts: 'Demonstrate and document ROI throughout customer lifecycle',
      other: 'Document unique circumstances for future reference'
    };

    if (postMortem.primary_root_cause) {
      lessons.push(causeLessons[postMortem.primary_root_cause]);
    }

    // Add data-driven lessons
    const healthHistory = data.health_score_history as Array<{ score: number }>;
    if (healthHistory.some(h => h.score < 50)) {
      lessons.push('Act decisively when health score drops below 50');
    }

    return lessons;
  }

  private generateRecommendations(postMortem: ChurnPostMortem, data: DataCompilation): string[] {
    const recommendations: string[] = [];

    // Based on root cause
    if (postMortem.primary_root_cause === 'price_value') {
      recommendations.push('Implement quarterly value review sessions');
      recommendations.push('Create ROI dashboard for customers');
    }

    if (postMortem.primary_root_cause === 'product_gaps') {
      recommendations.push('Share post-mortem with Product team');
      recommendations.push('Add product requirement to roadmap discussion');
    }

    if (postMortem.primary_root_cause === 'champion_left') {
      recommendations.push('Add multi-threading health indicator to customer scoring');
      recommendations.push('Create executive sponsor program');
    }

    // General recommendations
    recommendations.push('Review similar customers for same risk patterns');
    recommendations.push('Update playbooks based on lessons learned');

    return recommendations;
  }

  private buildChurnTimeline(data: DataCompilation, postMortem: ChurnPostMortem): Array<{
    date: string;
    event: string;
    significance: string;
    category: string;
  }> {
    const timeline: Array<{
      date: string;
      event: string;
      significance: string;
      category: string;
    }> = [];

    // Add key events from interaction timeline
    const interactions = data.interaction_timeline as Array<{
      date: string;
      title: string;
      type: string;
    }>;

    interactions.slice(0, 10).forEach(i => {
      timeline.push({
        date: i.date,
        event: i.title,
        significance: 'minor',
        category: i.type
      });
    });

    // Add risk signals
    const risks = data.risk_signals as Array<{
      detectedAt: string;
      description: string;
      severity: string;
    }>;

    risks.forEach(r => {
      timeline.push({
        date: r.detectedAt,
        event: `Risk Signal: ${r.description}`,
        significance: r.severity === 'high' || r.severity === 'critical' ? 'critical' : 'major',
        category: 'engagement'
      });
    });

    // Add churn date
    timeline.push({
      date: postMortem.churn_date,
      event: 'Customer Churned',
      significance: 'critical',
      category: 'contract'
    });

    // Sort by date
    timeline.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

    return timeline;
  }

  private generateExecutiveSummary(
    postMortem: ChurnPostMortem,
    snapshot: Record<string, unknown>,
    warnings: string[],
    opportunities: string[]
  ): string {
    const customerName = snapshot.name || 'Customer';
    const arr = postMortem.arr_lost;
    const tenure = snapshot.tenure || 0;
    const rootCause = postMortem.primary_root_cause
      ? this.formatRootCause(postMortem.primary_root_cause)
      : 'undetermined';

    return `${customerName} churned after ${tenure} months as a customer, resulting in $${arr.toLocaleString()} ARR loss. ` +
      `The primary root cause was identified as ${rootCause}. ` +
      `${warnings.length} early warning signal(s) were identified, and ${opportunities.length} potential intervention opportunity(-ies) were missed. ` +
      `This post-mortem provides actionable insights to prevent similar churns in the future.`;
  }

  private formatRootCause(cause: ChurnReason): string {
    const labels: Record<ChurnReason, string> = {
      price_value: 'price/value concerns',
      product_gaps: 'product/feature gaps',
      poor_onboarding: 'poor onboarding experience',
      champion_left: 'champion departure',
      strategic_ma: 'strategic/M&A changes',
      competitive: 'competitive displacement',
      support_issues: 'support issues',
      relationship: 'relationship breakdown',
      budget_cuts: 'budget cuts',
      other: 'other factors'
    };
    return labels[cause] || cause;
  }
}

// Export singleton instance
export const churnPostMortemService = new ChurnPostMortemService();
