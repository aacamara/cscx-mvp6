/**
 * Onboarding Funnel Service
 * PRD-154: Onboarding funnel analytics and reporting
 *
 * Provides business logic for:
 * - Funnel stage metrics calculation
 * - Stuck customer detection
 * - Time-to-value analysis
 * - Cohort comparisons
 * - CSM performance tracking
 */

import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { config } from '../config/index.js';

// ============================================
// Types (mirroring frontend types)
// ============================================

export enum OnboardingStage {
  CONTRACT_SIGNED = 'contract_signed',
  KICKOFF_SCHEDULED = 'kickoff_scheduled',
  KICKOFF_COMPLETED = 'kickoff_completed',
  TECHNICAL_SETUP = 'technical_setup',
  DATA_MIGRATION = 'data_migration',
  TRAINING_SCHEDULED = 'training_scheduled',
  TRAINING_COMPLETED = 'training_completed',
  FIRST_USE = 'first_use',
  VALUE_REALIZED = 'value_realized',
  ONBOARDING_COMPLETE = 'onboarding_complete'
}

export const STAGE_ORDER: OnboardingStage[] = [
  OnboardingStage.CONTRACT_SIGNED,
  OnboardingStage.KICKOFF_SCHEDULED,
  OnboardingStage.KICKOFF_COMPLETED,
  OnboardingStage.TECHNICAL_SETUP,
  OnboardingStage.DATA_MIGRATION,
  OnboardingStage.TRAINING_SCHEDULED,
  OnboardingStage.TRAINING_COMPLETED,
  OnboardingStage.FIRST_USE,
  OnboardingStage.VALUE_REALIZED,
  OnboardingStage.ONBOARDING_COMPLETE
];

export const STAGE_LABELS: Record<OnboardingStage, string> = {
  [OnboardingStage.CONTRACT_SIGNED]: 'Contract Signed',
  [OnboardingStage.KICKOFF_SCHEDULED]: 'Kickoff Scheduled',
  [OnboardingStage.KICKOFF_COMPLETED]: 'Kickoff Completed',
  [OnboardingStage.TECHNICAL_SETUP]: 'Technical Setup',
  [OnboardingStage.DATA_MIGRATION]: 'Data Migration',
  [OnboardingStage.TRAINING_SCHEDULED]: 'Training Scheduled',
  [OnboardingStage.TRAINING_COMPLETED]: 'Training Completed',
  [OnboardingStage.FIRST_USE]: 'First Use',
  [OnboardingStage.VALUE_REALIZED]: 'Value Realized',
  [OnboardingStage.ONBOARDING_COMPLETE]: 'Onboarding Complete'
};

export const STAGE_EXPECTED_DAYS: Record<OnboardingStage, number> = {
  [OnboardingStage.CONTRACT_SIGNED]: 0,
  [OnboardingStage.KICKOFF_SCHEDULED]: 2,
  [OnboardingStage.KICKOFF_COMPLETED]: 1,
  [OnboardingStage.TECHNICAL_SETUP]: 5,
  [OnboardingStage.DATA_MIGRATION]: 7,
  [OnboardingStage.TRAINING_SCHEDULED]: 2,
  [OnboardingStage.TRAINING_COMPLETED]: 3,
  [OnboardingStage.FIRST_USE]: 3,
  [OnboardingStage.VALUE_REALIZED]: 5,
  [OnboardingStage.ONBOARDING_COMPLETE]: 0
};

export type StageStatus = 'pending' | 'in_progress' | 'completed' | 'skipped' | 'blocked';

export interface StageProgress {
  stage: OnboardingStage;
  entered_at: string | null;
  completed_at: string | null;
  duration_days: number | null;
  status: StageStatus;
  blockers: string[];
}

export interface OnboardingProgress {
  customer_id: string;
  customer_name: string;
  current_stage: OnboardingStage;
  started_at: string;
  target_completion: string;
  csm_id: string;
  csm_name: string;
  arr: number;
  segment: string;
  health_score: number;
  stages: StageProgress[];
  milestones: { name: string; target_date: string; actual_date: string | null; on_track: boolean }[];
  is_at_risk: boolean;
  days_in_current_stage: number;
  total_days: number;
  completion_percentage: number;
}

export interface FunnelStageMetrics {
  total_entered: number;
  currently_in: number;
  completed: number;
  dropped: number;
  skipped: number;
  conversion_rate: number;
  avg_duration_days: number;
  median_duration_days: number;
  stuck_count: number;
  stuck_threshold_days: number;
}

export interface FunnelStage {
  stage: OnboardingStage;
  order: number;
  label: string;
  metrics: FunnelStageMetrics;
}

export interface FunnelMetrics {
  total_onboardings: number;
  completed: number;
  in_progress: number;
  dropped: number;
  completion_rate: number;
  avg_total_duration_days: number;
  median_total_duration_days: number;
  avg_time_to_value_days: number;
  top_bottleneck: OnboardingStage | null;
  top_drop_off_stage: OnboardingStage | null;
  on_track_count: number;
  at_risk_count: number;
  stuck_count: number;
}

export interface StuckCustomer {
  customer_id: string;
  customer_name: string;
  current_stage: OnboardingStage;
  days_in_stage: number;
  expected_days: number;
  overdue_by: number;
  blockers: string[];
  csm_id: string;
  csm_name: string;
  last_activity: string | null;
  arr: number;
  segment: string;
}

export interface TimeToValueMetrics {
  avg_ttv_days: number;
  median_ttv_days: number;
  best_ttv_days: number;
  best_ttv_customer: string;
  target_ttv_days: number;
  variance_from_target: number;
  by_segment: { segment: string; avg_ttv_days: number; customer_count: number }[];
  trend: { date: string; avg_ttv_days: number }[];
}

export interface CohortComparison {
  cohort_name: string;
  cohort_type: 'date' | 'segment' | 'csm' | 'product';
  total_customers: number;
  completed: number;
  completion_rate: number;
  avg_duration_days: number;
  avg_time_to_value_days: number;
  stuck_count: number;
}

export interface CSMOnboardingPerformance {
  csm_id: string;
  csm_name: string;
  total_onboardings: number;
  completed: number;
  in_progress: number;
  completion_rate: number;
  avg_duration_days: number;
  avg_time_to_value_days: number;
  stuck_customers: number;
  on_track_pct: number;
}

export interface OnboardingFunnelFilters {
  period_start?: string;
  period_end?: string;
  segment?: string;
  csm_id?: string;
  stage_filter?: OnboardingStage;
  status_filter?: 'all' | 'on_track' | 'at_risk' | 'stuck' | 'completed';
  search?: string;
  sort_by?: 'name' | 'stage' | 'days' | 'arr' | 'health';
  sort_order?: 'asc' | 'desc';
}

// ============================================
// Service Class
// ============================================

class OnboardingFunnelService {
  private supabase: SupabaseClient | null = null;

  constructor() {
    if (config.supabaseUrl && config.supabaseServiceKey) {
      this.supabase = createClient(config.supabaseUrl, config.supabaseServiceKey);
    }
  }

  /**
   * Get the full onboarding funnel report
   */
  async getFunnelReport(
    userId: string,
    filters: OnboardingFunnelFilters = {}
  ): Promise<{
    funnel: FunnelStage[];
    active_onboardings: OnboardingProgress[];
    metrics: FunnelMetrics;
    time_to_value: TimeToValueMetrics;
    cohort_comparison?: CohortComparison[];
    csm_performance?: CSMOnboardingPerformance[];
  }> {
    // Get customers in onboarding
    const customers = await this.getOnboardingCustomers(userId, filters);

    // Calculate funnel stages
    const funnel = this.calculateFunnelStages(customers);

    // Calculate overall metrics
    const metrics = this.calculateFunnelMetrics(customers, funnel);

    // Calculate time-to-value
    const time_to_value = this.calculateTimeToValue(customers);

    // Get cohort comparison if segment filter not applied
    const cohort_comparison = !filters.segment
      ? this.calculateCohortComparison(customers)
      : undefined;

    // Get CSM performance
    const csm_performance = this.calculateCSMPerformance(customers);

    return {
      funnel,
      active_onboardings: customers.filter(c => c.current_stage !== OnboardingStage.ONBOARDING_COMPLETE),
      metrics,
      time_to_value,
      cohort_comparison,
      csm_performance
    };
  }

  /**
   * Get individual customer onboarding progress
   */
  async getCustomerProgress(
    userId: string,
    customerId: string
  ): Promise<OnboardingProgress | null> {
    const customers = await this.getOnboardingCustomers(userId, {});
    return customers.find(c => c.customer_id === customerId) || null;
  }

  /**
   * Get stuck customers
   */
  async getStuckCustomers(
    userId: string,
    daysThreshold?: number
  ): Promise<{
    customers: StuckCustomer[];
    by_stage: { stage: OnboardingStage; count: number }[];
    total_stuck: number;
    total_arr_at_risk: number;
  }> {
    const allCustomers = await this.getOnboardingCustomers(userId, {});

    const stuckCustomers: StuckCustomer[] = allCustomers
      .filter(c => {
        const expectedDays = STAGE_EXPECTED_DAYS[c.current_stage];
        const threshold = daysThreshold || expectedDays * 1.5;
        return c.days_in_current_stage > threshold &&
          c.current_stage !== OnboardingStage.ONBOARDING_COMPLETE;
      })
      .map(c => ({
        customer_id: c.customer_id,
        customer_name: c.customer_name,
        current_stage: c.current_stage,
        days_in_stage: c.days_in_current_stage,
        expected_days: STAGE_EXPECTED_DAYS[c.current_stage],
        overdue_by: c.days_in_current_stage - STAGE_EXPECTED_DAYS[c.current_stage],
        blockers: c.stages.find(s => s.stage === c.current_stage)?.blockers || [],
        csm_id: c.csm_id,
        csm_name: c.csm_name,
        last_activity: null, // Would come from activity logs
        arr: c.arr,
        segment: c.segment
      }));

    // Group by stage
    const byStage = STAGE_ORDER
      .map(stage => ({
        stage,
        count: stuckCustomers.filter(c => c.current_stage === stage).length
      }))
      .filter(s => s.count > 0);

    return {
      customers: stuckCustomers,
      by_stage: byStage,
      total_stuck: stuckCustomers.length,
      total_arr_at_risk: stuckCustomers.reduce((sum, c) => sum + c.arr, 0)
    };
  }

  /**
   * Record a stage transition
   */
  async recordStageTransition(
    userId: string,
    customerId: string,
    toStage: OnboardingStage,
    notes?: string
  ): Promise<void> {
    if (!this.supabase) return;

    const now = new Date().toISOString();

    // Get current stage
    const { data: customer } = await this.supabase
      .from('customers')
      .select('onboarding_stage')
      .eq('id', customerId)
      .single();

    const fromStage = customer?.onboarding_stage;

    // Update customer's current stage
    await this.supabase
      .from('customers')
      .update({
        onboarding_stage: toStage,
        onboarding_stage_entered_at: now,
        updated_at: now
      })
      .eq('id', customerId);

    // Record the transition
    await this.supabase
      .from('onboarding_stage_transitions')
      .insert({
        customer_id: customerId,
        from_stage: fromStage,
        to_stage: toStage,
        transitioned_at: now,
        triggered_by: 'manual',
        user_id: userId,
        notes
      });
  }

  // ============================================
  // Private Helper Methods
  // ============================================

  private async getOnboardingCustomers(
    userId: string,
    filters: OnboardingFunnelFilters
  ): Promise<OnboardingProgress[]> {
    // If database is available, fetch real data
    if (this.supabase) {
      return this.fetchFromDatabase(userId, filters);
    }

    // Otherwise, return demo data
    return this.generateDemoData(filters);
  }

  private async fetchFromDatabase(
    userId: string,
    filters: OnboardingFunnelFilters
  ): Promise<OnboardingProgress[]> {
    if (!this.supabase) return [];

    let query = this.supabase
      .from('customers')
      .select(`
        id,
        name,
        arr,
        industry,
        segment,
        health_score,
        stage,
        onboarding_stage,
        onboarding_started_at,
        onboarding_target_date,
        onboarding_stage_entered_at,
        csm_id,
        csm_name,
        created_at
      `)
      .eq('user_id', userId)
      .or('stage.eq.onboarding,onboarding_stage.neq.null');

    // Apply filters
    if (filters.segment) {
      query = query.eq('segment', filters.segment);
    }
    if (filters.csm_id) {
      query = query.eq('csm_id', filters.csm_id);
    }
    if (filters.period_start) {
      query = query.gte('onboarding_started_at', filters.period_start);
    }
    if (filters.period_end) {
      query = query.lte('onboarding_started_at', filters.period_end);
    }
    if (filters.search) {
      query = query.ilike('name', `%${filters.search}%`);
    }

    const { data: customers, error } = await query;

    if (error || !customers) {
      console.error('Error fetching onboarding customers:', error);
      return this.generateDemoData(filters);
    }

    return customers.map(c => this.mapCustomerToProgress(c));
  }

  private mapCustomerToProgress(customer: any): OnboardingProgress {
    const currentStage = (customer.onboarding_stage as OnboardingStage) ||
      OnboardingStage.CONTRACT_SIGNED;
    const startedAt = customer.onboarding_started_at || customer.created_at;
    const stageEnteredAt = customer.onboarding_stage_entered_at || startedAt;

    const now = new Date();
    const startDate = new Date(startedAt);
    const stageEntryDate = new Date(stageEnteredAt);

    const totalDays = Math.floor((now.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24));
    const daysInCurrentStage = Math.floor((now.getTime() - stageEntryDate.getTime()) / (1000 * 60 * 60 * 24));

    const currentStageIndex = STAGE_ORDER.indexOf(currentStage);
    const completionPercentage = Math.round((currentStageIndex / (STAGE_ORDER.length - 1)) * 100);

    const expectedDays = STAGE_EXPECTED_DAYS[currentStage];
    const isAtRisk = daysInCurrentStage > expectedDays * 1.5;

    // Build stages array
    const stages: StageProgress[] = STAGE_ORDER.map((stage, index) => {
      const isCompleted = index < currentStageIndex;
      const isCurrent = index === currentStageIndex;
      const isPending = index > currentStageIndex;

      return {
        stage,
        entered_at: isCompleted || isCurrent ? startedAt : null,
        completed_at: isCompleted ? startedAt : null, // Would need actual data
        duration_days: isCompleted ? STAGE_EXPECTED_DAYS[stage] : null,
        status: isCompleted ? 'completed' : isCurrent ? 'in_progress' : 'pending',
        blockers: []
      };
    });

    return {
      customer_id: customer.id,
      customer_name: customer.name,
      current_stage: currentStage,
      started_at: startedAt,
      target_completion: customer.onboarding_target_date ||
        new Date(startDate.getTime() + 90 * 24 * 60 * 60 * 1000).toISOString(),
      csm_id: customer.csm_id || 'unassigned',
      csm_name: customer.csm_name || 'Unassigned',
      arr: customer.arr || 0,
      segment: customer.segment || 'Unknown',
      health_score: customer.health_score || 100,
      stages,
      milestones: this.generateMilestones(startedAt),
      is_at_risk: isAtRisk,
      days_in_current_stage: daysInCurrentStage,
      total_days: totalDays,
      completion_percentage: completionPercentage
    };
  }

  private generateMilestones(startedAt: string): OnboardingProgress['milestones'] {
    const startDate = new Date(startedAt);

    return [
      {
        name: 'Kickoff Meeting',
        target_date: new Date(startDate.getTime() + 5 * 24 * 60 * 60 * 1000).toISOString(),
        actual_date: null,
        on_track: true
      },
      {
        name: 'Technical Setup Complete',
        target_date: new Date(startDate.getTime() + 14 * 24 * 60 * 60 * 1000).toISOString(),
        actual_date: null,
        on_track: true
      },
      {
        name: 'First Value Delivered',
        target_date: new Date(startDate.getTime() + 30 * 24 * 60 * 60 * 1000).toISOString(),
        actual_date: null,
        on_track: true
      },
      {
        name: 'Full Onboarding Complete',
        target_date: new Date(startDate.getTime() + 60 * 24 * 60 * 60 * 1000).toISOString(),
        actual_date: null,
        on_track: true
      }
    ];
  }

  private generateDemoData(filters: OnboardingFunnelFilters): OnboardingProgress[] {
    const demoCustomers = [
      { name: 'Acme Corp', arr: 125000, segment: 'Enterprise', csm: 'Sarah Chen', stage: OnboardingStage.TECHNICAL_SETUP, daysInStage: 12, atRisk: true },
      { name: 'TechStart Inc', arr: 45000, segment: 'Mid-Market', csm: 'Mike Johnson', stage: OnboardingStage.TRAINING_COMPLETED, daysInStage: 5, atRisk: false },
      { name: 'DataFlow Systems', arr: 85000, segment: 'Enterprise', csm: 'Sarah Chen', stage: OnboardingStage.FIRST_USE, daysInStage: 3, atRisk: false },
      { name: 'CloudNine Solutions', arr: 32000, segment: 'SMB', csm: 'John Smith', stage: OnboardingStage.KICKOFF_SCHEDULED, daysInStage: 1, atRisk: false },
      { name: 'MegaInc', arr: 200000, segment: 'Enterprise', csm: 'Mike Johnson', stage: OnboardingStage.DATA_MIGRATION, daysInStage: 18, atRisk: true },
      { name: 'StartupXYZ', arr: 15000, segment: 'SMB', csm: 'John Smith', stage: OnboardingStage.KICKOFF_COMPLETED, daysInStage: 2, atRisk: false },
      { name: 'Global Industries', arr: 180000, segment: 'Enterprise', csm: 'Sarah Chen', stage: OnboardingStage.VALUE_REALIZED, daysInStage: 4, atRisk: false },
      { name: 'InnovateTech', arr: 55000, segment: 'Mid-Market', csm: 'Mike Johnson', stage: OnboardingStage.TRAINING_SCHEDULED, daysInStage: 3, atRisk: false },
      { name: 'QuickServ Ltd', arr: 28000, segment: 'SMB', csm: 'John Smith', stage: OnboardingStage.TECHNICAL_SETUP, daysInStage: 6, atRisk: false },
      { name: 'Enterprise Plus', arr: 250000, segment: 'Enterprise', csm: 'Sarah Chen', stage: OnboardingStage.ONBOARDING_COMPLETE, daysInStage: 0, atRisk: false },
      { name: 'GrowthCo', arr: 42000, segment: 'Mid-Market', csm: 'Mike Johnson', stage: OnboardingStage.CONTRACT_SIGNED, daysInStage: 1, atRisk: false },
      { name: 'SmallBiz Pro', arr: 12000, segment: 'SMB', csm: 'John Smith', stage: OnboardingStage.ONBOARDING_COMPLETE, daysInStage: 0, atRisk: false },
      { name: 'Nexus Corp', arr: 95000, segment: 'Enterprise', csm: 'Sarah Chen', stage: OnboardingStage.DATA_MIGRATION, daysInStage: 8, atRisk: false }
    ];

    let result = demoCustomers.map((c, index) => {
      const baseDate = new Date();
      const startDate = new Date(baseDate.getTime() - (30 + index * 5) * 24 * 60 * 60 * 1000);
      const currentStageIndex = STAGE_ORDER.indexOf(c.stage);

      const stages: StageProgress[] = STAGE_ORDER.map((stage, stageIndex) => ({
        stage,
        entered_at: stageIndex <= currentStageIndex ? startDate.toISOString() : null,
        completed_at: stageIndex < currentStageIndex ? startDate.toISOString() : null,
        duration_days: stageIndex < currentStageIndex ? STAGE_EXPECTED_DAYS[stage] : null,
        status: stageIndex < currentStageIndex ? 'completed' :
          stageIndex === currentStageIndex ? 'in_progress' : 'pending',
        blockers: c.atRisk && stageIndex === currentStageIndex ?
          ['Waiting on customer IT team', 'Data format issues'] : []
      }));

      return {
        customer_id: `cust_${index + 1}`,
        customer_name: c.name,
        current_stage: c.stage,
        started_at: startDate.toISOString(),
        target_completion: new Date(startDate.getTime() + 90 * 24 * 60 * 60 * 1000).toISOString(),
        csm_id: c.csm.toLowerCase().replace(' ', '_'),
        csm_name: c.csm,
        arr: c.arr,
        segment: c.segment,
        health_score: c.atRisk ? 65 : 85,
        stages,
        milestones: this.generateMilestones(startDate.toISOString()),
        is_at_risk: c.atRisk,
        days_in_current_stage: c.daysInStage,
        total_days: Math.floor((baseDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24)),
        completion_percentage: Math.round((currentStageIndex / (STAGE_ORDER.length - 1)) * 100)
      };
    });

    // Apply filters
    if (filters.segment) {
      result = result.filter(c => c.segment === filters.segment);
    }
    if (filters.csm_id) {
      result = result.filter(c => c.csm_id === filters.csm_id);
    }
    if (filters.search) {
      const searchLower = filters.search.toLowerCase();
      result = result.filter(c => c.customer_name.toLowerCase().includes(searchLower));
    }
    if (filters.stage_filter) {
      result = result.filter(c => c.current_stage === filters.stage_filter);
    }
    if (filters.status_filter && filters.status_filter !== 'all') {
      switch (filters.status_filter) {
        case 'stuck':
          result = result.filter(c => c.is_at_risk);
          break;
        case 'on_track':
          result = result.filter(c => !c.is_at_risk && c.current_stage !== OnboardingStage.ONBOARDING_COMPLETE);
          break;
        case 'completed':
          result = result.filter(c => c.current_stage === OnboardingStage.ONBOARDING_COMPLETE);
          break;
        case 'at_risk':
          result = result.filter(c => c.is_at_risk);
          break;
      }
    }

    // Apply sorting
    if (filters.sort_by) {
      result.sort((a, b) => {
        let comparison = 0;
        switch (filters.sort_by) {
          case 'name':
            comparison = a.customer_name.localeCompare(b.customer_name);
            break;
          case 'stage':
            comparison = STAGE_ORDER.indexOf(a.current_stage) - STAGE_ORDER.indexOf(b.current_stage);
            break;
          case 'days':
            comparison = a.days_in_current_stage - b.days_in_current_stage;
            break;
          case 'arr':
            comparison = a.arr - b.arr;
            break;
          case 'health':
            comparison = a.health_score - b.health_score;
            break;
        }
        return filters.sort_order === 'asc' ? comparison : -comparison;
      });
    }

    return result;
  }

  private calculateFunnelStages(customers: OnboardingProgress[]): FunnelStage[] {
    return STAGE_ORDER.map((stage, index) => {
      const atOrPastStage = customers.filter(c => {
        const customerStageIndex = STAGE_ORDER.indexOf(c.current_stage);
        return customerStageIndex >= index;
      });

      const currentlyIn = customers.filter(c => c.current_stage === stage);
      const completed = customers.filter(c => {
        const customerStageIndex = STAGE_ORDER.indexOf(c.current_stage);
        return customerStageIndex > index;
      });

      const previousStageCustomers = index === 0 ? customers :
        customers.filter(c => STAGE_ORDER.indexOf(c.current_stage) >= index - 1);

      const conversionRate = previousStageCustomers.length > 0
        ? Math.round((atOrPastStage.length / previousStageCustomers.length) * 100)
        : 100;

      const stuckCount = currentlyIn.filter(c => {
        return c.days_in_current_stage > STAGE_EXPECTED_DAYS[stage] * 1.5;
      }).length;

      // Calculate durations for completed stages
      const completedDurations = completed.map(c => {
        const stageData = c.stages.find(s => s.stage === stage);
        return stageData?.duration_days || STAGE_EXPECTED_DAYS[stage];
      });

      const avgDuration = completedDurations.length > 0
        ? completedDurations.reduce((a, b) => a + b, 0) / completedDurations.length
        : STAGE_EXPECTED_DAYS[stage];

      const sortedDurations = [...completedDurations].sort((a, b) => a - b);
      const medianDuration = sortedDurations.length > 0
        ? sortedDurations[Math.floor(sortedDurations.length / 2)]
        : STAGE_EXPECTED_DAYS[stage];

      return {
        stage,
        order: index,
        label: STAGE_LABELS[stage],
        metrics: {
          total_entered: atOrPastStage.length,
          currently_in: currentlyIn.length,
          completed: completed.length,
          dropped: 0, // Would need drop tracking
          skipped: 0,
          conversion_rate: conversionRate,
          avg_duration_days: Math.round(avgDuration * 10) / 10,
          median_duration_days: Math.round(medianDuration * 10) / 10,
          stuck_count: stuckCount,
          stuck_threshold_days: Math.round(STAGE_EXPECTED_DAYS[stage] * 1.5)
        }
      };
    });
  }

  private calculateFunnelMetrics(
    customers: OnboardingProgress[],
    funnel: FunnelStage[]
  ): FunnelMetrics {
    const completed = customers.filter(c => c.current_stage === OnboardingStage.ONBOARDING_COMPLETE);
    const inProgress = customers.filter(c => c.current_stage !== OnboardingStage.ONBOARDING_COMPLETE);
    const atRisk = customers.filter(c => c.is_at_risk);
    const stuck = inProgress.filter(c => {
      const expectedDays = STAGE_EXPECTED_DAYS[c.current_stage];
      return c.days_in_current_stage > expectedDays * 1.5;
    });

    // Find bottleneck (stage with most stuck customers)
    const bottleneck = funnel.reduce((max, stage) =>
      stage.metrics.stuck_count > (max?.metrics.stuck_count || 0) ? stage : max
      , funnel[0]);

    // Find top drop-off (lowest conversion rate, excluding first stage)
    const dropOffStage = funnel.slice(1).reduce((min, stage) =>
      stage.metrics.conversion_rate < (min?.metrics.conversion_rate || 100) ? stage : min
      , funnel[1]);

    // Calculate total duration for completed onboardings
    const completedDurations = completed.map(c => c.total_days);
    const avgDuration = completedDurations.length > 0
      ? completedDurations.reduce((a, b) => a + b, 0) / completedDurations.length
      : 0;

    const sortedDurations = [...completedDurations].sort((a, b) => a - b);
    const medianDuration = sortedDurations.length > 0
      ? sortedDurations[Math.floor(sortedDurations.length / 2)]
      : 0;

    // Calculate time to value (days to reach VALUE_REALIZED stage)
    const valueRealizedCustomers = customers.filter(c =>
      STAGE_ORDER.indexOf(c.current_stage) >= STAGE_ORDER.indexOf(OnboardingStage.VALUE_REALIZED)
    );
    const ttvDurations = valueRealizedCustomers.map(c => {
      // Estimate based on stage order and expected days
      return STAGE_ORDER.slice(0, STAGE_ORDER.indexOf(OnboardingStage.VALUE_REALIZED) + 1)
        .reduce((sum, stage) => sum + STAGE_EXPECTED_DAYS[stage], 0);
    });
    const avgTTV = ttvDurations.length > 0
      ? ttvDurations.reduce((a, b) => a + b, 0) / ttvDurations.length
      : 28; // Default target

    return {
      total_onboardings: customers.length,
      completed: completed.length,
      in_progress: inProgress.length,
      dropped: 0, // Would need drop tracking
      completion_rate: customers.length > 0
        ? Math.round((completed.length / customers.length) * 100)
        : 0,
      avg_total_duration_days: Math.round(avgDuration * 10) / 10,
      median_total_duration_days: Math.round(medianDuration * 10) / 10,
      avg_time_to_value_days: Math.round(avgTTV * 10) / 10,
      top_bottleneck: bottleneck?.metrics.stuck_count > 0 ? bottleneck.stage : null,
      top_drop_off_stage: dropOffStage?.metrics.conversion_rate < 95 ? dropOffStage.stage : null,
      on_track_count: inProgress.length - atRisk.length,
      at_risk_count: atRisk.length,
      stuck_count: stuck.length
    };
  }

  private calculateTimeToValue(customers: OnboardingProgress[]): TimeToValueMetrics {
    const valueRealized = customers.filter(c =>
      STAGE_ORDER.indexOf(c.current_stage) >= STAGE_ORDER.indexOf(OnboardingStage.VALUE_REALIZED)
    );

    // Calculate TTV for each customer (simplified: total days when value stage reached)
    const ttvValues = valueRealized.map(c => {
      // In production, would calculate actual days to reach VALUE_REALIZED
      return Math.floor(c.total_days * 0.7); // Estimate: 70% of total days to value
    });

    const avgTTV = ttvValues.length > 0
      ? ttvValues.reduce((a, b) => a + b, 0) / ttvValues.length
      : 28;

    const sortedTTV = [...ttvValues].sort((a, b) => a - b);
    const medianTTV = sortedTTV.length > 0
      ? sortedTTV[Math.floor(sortedTTV.length / 2)]
      : 24;

    const bestTTV = sortedTTV.length > 0 ? sortedTTV[0] : 14;
    const bestTTVCustomer = valueRealized.find(c =>
      Math.floor(c.total_days * 0.7) === bestTTV
    )?.customer_name || '';

    // Group by segment
    const segments = [...new Set(customers.map(c => c.segment))];
    const bySegment = segments.map(segment => {
      const segmentCustomers = valueRealized.filter(c => c.segment === segment);
      const segmentTTV = segmentCustomers.map(c => Math.floor(c.total_days * 0.7));
      const avgSegmentTTV = segmentTTV.length > 0
        ? segmentTTV.reduce((a, b) => a + b, 0) / segmentTTV.length
        : 0;

      return {
        segment,
        avg_ttv_days: Math.round(avgSegmentTTV * 10) / 10,
        customer_count: segmentCustomers.length
      };
    }).sort((a, b) => b.avg_ttv_days - a.avg_ttv_days);

    // Generate trend data (last 6 months)
    const trend = [];
    const now = new Date();
    for (let i = 5; i >= 0; i--) {
      const date = new Date(now.getFullYear(), now.getMonth() - i, 1);
      trend.push({
        date: date.toISOString().split('T')[0].slice(0, 7),
        avg_ttv_days: Math.round((avgTTV + (Math.random() - 0.5) * 10) * 10) / 10
      });
    }

    const targetTTV = 25;

    return {
      avg_ttv_days: Math.round(avgTTV * 10) / 10,
      median_ttv_days: Math.round(medianTTV * 10) / 10,
      best_ttv_days: bestTTV,
      best_ttv_customer: bestTTVCustomer,
      target_ttv_days: targetTTV,
      variance_from_target: Math.round((avgTTV - targetTTV) * 10) / 10,
      by_segment: bySegment,
      trend
    };
  }

  private calculateCohortComparison(customers: OnboardingProgress[]): CohortComparison[] {
    const segments = [...new Set(customers.map(c => c.segment))];

    return segments.map(segment => {
      const cohortCustomers = customers.filter(c => c.segment === segment);
      const completed = cohortCustomers.filter(c =>
        c.current_stage === OnboardingStage.ONBOARDING_COMPLETE
      );
      const stuck = cohortCustomers.filter(c => c.is_at_risk);

      const avgDuration = cohortCustomers.length > 0
        ? cohortCustomers.reduce((sum, c) => sum + c.total_days, 0) / cohortCustomers.length
        : 0;

      const avgTTV = completed.length > 0
        ? completed.reduce((sum, c) => sum + Math.floor(c.total_days * 0.7), 0) / completed.length
        : 0;

      return {
        cohort_name: segment,
        cohort_type: 'segment' as const,
        total_customers: cohortCustomers.length,
        completed: completed.length,
        completion_rate: cohortCustomers.length > 0
          ? Math.round((completed.length / cohortCustomers.length) * 100)
          : 0,
        avg_duration_days: Math.round(avgDuration * 10) / 10,
        avg_time_to_value_days: Math.round(avgTTV * 10) / 10,
        stuck_count: stuck.length
      };
    });
  }

  private calculateCSMPerformance(customers: OnboardingProgress[]): CSMOnboardingPerformance[] {
    const csms = [...new Set(customers.map(c => c.csm_id))];

    return csms.map(csmId => {
      const csmCustomers = customers.filter(c => c.csm_id === csmId);
      const csmName = csmCustomers[0]?.csm_name || 'Unknown';
      const completed = csmCustomers.filter(c =>
        c.current_stage === OnboardingStage.ONBOARDING_COMPLETE
      );
      const inProgress = csmCustomers.filter(c =>
        c.current_stage !== OnboardingStage.ONBOARDING_COMPLETE
      );
      const stuck = csmCustomers.filter(c => c.is_at_risk);
      const onTrack = inProgress.filter(c => !c.is_at_risk);

      const avgDuration = completed.length > 0
        ? completed.reduce((sum, c) => sum + c.total_days, 0) / completed.length
        : 0;

      const avgTTV = completed.length > 0
        ? completed.reduce((sum, c) => sum + Math.floor(c.total_days * 0.7), 0) / completed.length
        : 0;

      return {
        csm_id: csmId,
        csm_name: csmName,
        total_onboardings: csmCustomers.length,
        completed: completed.length,
        in_progress: inProgress.length,
        completion_rate: csmCustomers.length > 0
          ? Math.round((completed.length / csmCustomers.length) * 100)
          : 0,
        avg_duration_days: Math.round(avgDuration * 10) / 10,
        avg_time_to_value_days: Math.round(avgTTV * 10) / 10,
        stuck_customers: stuck.length,
        on_track_pct: inProgress.length > 0
          ? Math.round((onTrack.length / inProgress.length) * 100)
          : 100
      };
    });
  }
}

// Export singleton instance
export const onboardingFunnelService = new OnboardingFunnelService();
export default onboardingFunnelService;
