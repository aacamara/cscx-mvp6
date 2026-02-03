/**
 * Customer Journey Service
 * PRD-159: Customer Journey Map Report
 *
 * Service for aggregating customer journey data, calculating stages,
 * tracking milestones, and identifying friction points.
 */

import { createClient } from '@supabase/supabase-js';
import { config } from '../config/index.js';

// Types (mirrored from frontend types for server use)
type JourneyStage =
  | 'prospect'
  | 'onboarding'
  | 'adoption'
  | 'growth'
  | 'maturity'
  | 'renewal'
  | 'at_risk'
  | 'churned';

type JourneyEventType =
  | 'milestone'
  | 'meeting'
  | 'email'
  | 'call'
  | 'support_ticket'
  | 'health_change'
  | 'risk_signal'
  | 'contract_event'
  | 'usage_event'
  | 'nps_response'
  | 'expansion'
  | 'escalation'
  | 'note'
  | 'stage_change';

type EventSentiment = 'positive' | 'neutral' | 'negative';
type EventImportance = 'high' | 'medium' | 'low';

interface JourneyEvent {
  id: string;
  customerId: string;
  type: JourneyEventType;
  title: string;
  description?: string;
  timestamp: string;
  stage: JourneyStage;
  sentiment?: EventSentiment;
  importance: EventImportance;
  metadata?: Record<string, unknown>;
  participants?: string[];
  outcome?: string;
  linkedEventIds?: string[];
  source?: string;
}

interface JourneyMilestone {
  id: string;
  customerId: string;
  name: string;
  description: string;
  targetDate: string;
  achievedDate?: string;
  stage: JourneyStage;
  status: 'pending' | 'achieved' | 'missed' | 'at_risk';
  impact: 'critical' | 'high' | 'medium' | 'low';
  relatedEventIds?: string[];
}

interface JourneyStageRecord {
  id: string;
  customerId: string;
  stage: JourneyStage;
  enteredAt: string;
  exitedAt?: string;
  durationDays?: number;
  healthScoreAtEntry: number;
  healthScoreAtExit?: number;
  exitReason?: string;
  nextStage?: JourneyStage;
}

interface JourneyHealthPoint {
  date: string;
  healthScore: number;
  stage: JourneyStage;
  change?: number;
  changeReason?: string;
}

interface FrictionPoint {
  id: string;
  customerId?: string;
  stage: JourneyStage;
  type: string;
  description: string;
  occurrenceCount: number;
  avgDelayDays: number;
  impact: 'high' | 'medium' | 'low';
  recommendations: string[];
  affectedCustomerIds?: string[];
}

interface CustomerJourneyMap {
  customerId: string;
  customerName: string;
  currentStage: JourneyStage;
  journeyStartDate: string;
  daysSinceStart: number;
  healthScore: number;
  healthTrend: 'improving' | 'stable' | 'declining';
  arr: number;
  stageHistory: JourneyStageRecord[];
  currentStageEntry: string;
  daysInCurrentStage: number;
  events: JourneyEvent[];
  recentEvents: JourneyEvent[];
  milestones: JourneyMilestone[];
  nextMilestone?: JourneyMilestone;
  achievedMilestones: number;
  totalMilestones: number;
  healthHistory: JourneyHealthPoint[];
  frictionPoints: FrictionPoint[];
  stats: {
    totalMeetings: number;
    totalEmails: number;
    totalSupportTickets: number;
    avgResponseTime: number;
    npsScore?: number;
    expansionCount: number;
    escalationCount: number;
  };
}

interface JourneyAnalytics {
  period: string;
  stageDistribution: Record<JourneyStage, number>;
  stageTransitions: Array<{
    from: JourneyStage;
    to: JourneyStage;
    count: number;
    avgDaysToTransition: number;
  }>;
  healthByStage: Record<JourneyStage, {
    avgHealth: number;
    minHealth: number;
    maxHealth: number;
    customerCount: number;
  }>;
  topFrictionPoints: FrictionPoint[];
  milestoneCompletionRates: Record<string, number>;
  timeToValue: {
    avg: number;
    median: number;
    p90: number;
  };
  churnCorrelation: Array<{
    factor: string;
    correlation: number;
    description: string;
  }>;
}

// Initialize Supabase client
const supabase = config.supabaseUrl && config.supabaseKey
  ? createClient(config.supabaseUrl, config.supabaseKey)
  : null;

/**
 * Customer Journey Service
 */
class CustomerJourneyService {
  /**
   * Get complete journey map for a customer
   */
  async getJourneyMap(
    customerId: string,
    options?: {
      dateRange?: { start: string; end: string };
      includeEvents?: boolean;
      includeMilestones?: boolean;
      includeHealthHistory?: boolean;
      eventTypes?: JourneyEventType[];
    }
  ): Promise<CustomerJourneyMap | null> {
    try {
      // Get customer data
      const customer = await this.getCustomer(customerId);
      if (!customer) {
        return null;
      }

      // Calculate journey dates
      const journeyStartDate = customer.created_at;
      const daysSinceStart = this.daysBetween(new Date(journeyStartDate), new Date());

      // Get stage history
      const stageHistory = await this.getStageHistory(customerId);

      // Get current stage info
      const currentStage = this.determineCurrentStage(customer, stageHistory);
      const currentStageRecord = stageHistory.find(s => !s.exitedAt);
      const currentStageEntry = currentStageRecord?.enteredAt || journeyStartDate;
      const daysInCurrentStage = this.daysBetween(new Date(currentStageEntry), new Date());

      // Get events
      const events = options?.includeEvents !== false
        ? await this.getJourneyEvents(customerId, options?.dateRange, options?.eventTypes)
        : [];

      // Get milestones
      const milestones = options?.includeMilestones !== false
        ? await this.getMilestones(customerId)
        : [];

      // Get health history
      const healthHistory = options?.includeHealthHistory !== false
        ? await this.getHealthHistory(customerId, options?.dateRange)
        : [];

      // Calculate health trend
      const healthTrend = this.calculateHealthTrend(healthHistory);

      // Get friction points
      const frictionPoints = await this.getFrictionPoints(customerId);

      // Calculate stats
      const stats = await this.calculateStats(customerId, events);

      // Find next milestone
      const pendingMilestones = milestones.filter(m => m.status === 'pending' || m.status === 'at_risk');
      const nextMilestone = pendingMilestones.sort((a, b) =>
        new Date(a.targetDate).getTime() - new Date(b.targetDate).getTime()
      )[0];

      // Get recent events (last 10)
      const recentEvents = events
        .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
        .slice(0, 10);

      return {
        customerId,
        customerName: customer.name,
        currentStage,
        journeyStartDate,
        daysSinceStart,
        healthScore: customer.health_score || 0,
        healthTrend,
        arr: customer.arr || 0,
        stageHistory,
        currentStageEntry,
        daysInCurrentStage,
        events,
        recentEvents,
        milestones,
        nextMilestone,
        achievedMilestones: milestones.filter(m => m.status === 'achieved').length,
        totalMilestones: milestones.length,
        healthHistory,
        frictionPoints,
        stats
      };
    } catch (error) {
      console.error('[CustomerJourney] Error getting journey map:', error);
      throw error;
    }
  }

  /**
   * Get journey analytics across all customers
   */
  async getJourneyAnalytics(
    period: 'week' | 'month' | 'quarter' | 'year' = 'month',
    segment?: string,
    csmId?: string
  ): Promise<JourneyAnalytics> {
    try {
      // Get all customers for analysis
      const customers = await this.getAllCustomers(segment, csmId);

      // Calculate stage distribution
      const stageDistribution = this.calculateStageDistribution(customers);

      // Get stage transitions
      const stageTransitions = await this.getStageTransitions(period);

      // Calculate health by stage
      const healthByStage = this.calculateHealthByStage(customers);

      // Get top friction points
      const topFrictionPoints = await this.getTopFrictionPoints();

      // Get milestone completion rates
      const milestoneCompletionRates = await this.getMilestoneCompletionRates();

      // Calculate time to value metrics
      const timeToValue = await this.calculateTimeToValue();

      // Get churn correlation factors
      const churnCorrelation = await this.getChurnCorrelation();

      return {
        period,
        stageDistribution,
        stageTransitions,
        healthByStage,
        topFrictionPoints,
        milestoneCompletionRates,
        timeToValue,
        churnCorrelation
      };
    } catch (error) {
      console.error('[CustomerJourney] Error getting analytics:', error);
      throw error;
    }
  }

  /**
   * Record a stage change for a customer
   */
  async recordStageChange(
    customerId: string,
    newStage: JourneyStage,
    reason?: string
  ): Promise<void> {
    if (!supabase) {
      console.warn('[CustomerJourney] Supabase not configured, skipping stage change recording');
      return;
    }

    try {
      // Close current stage record
      const { data: currentStage } = await supabase
        .from('journey_stages')
        .select('*')
        .eq('customer_id', customerId)
        .is('exited_at', null)
        .single();

      if (currentStage) {
        const exitDate = new Date().toISOString();
        const durationDays = this.daysBetween(new Date(currentStage.entered_at), new Date());

        await supabase
          .from('journey_stages')
          .update({
            exited_at: exitDate,
            duration_days: durationDays,
            exit_reason: reason,
            next_stage: newStage
          })
          .eq('id', currentStage.id);
      }

      // Get current health score
      const { data: customer } = await supabase
        .from('customers')
        .select('health_score')
        .eq('id', customerId)
        .single();

      // Create new stage record
      await supabase
        .from('journey_stages')
        .insert({
          customer_id: customerId,
          stage: newStage,
          entered_at: new Date().toISOString(),
          health_score_at_entry: customer?.health_score || 0
        });

      // Update customer stage
      await supabase
        .from('customers')
        .update({ stage: newStage })
        .eq('id', customerId);

      // Record stage change event
      await this.recordEvent(customerId, {
        type: 'stage_change',
        title: `Stage changed to ${newStage}`,
        description: reason,
        stage: newStage,
        importance: 'high',
        metadata: {
          previousStage: currentStage?.stage,
          reason
        }
      });
    } catch (error) {
      console.error('[CustomerJourney] Error recording stage change:', error);
      throw error;
    }
  }

  /**
   * Record a journey event
   */
  async recordEvent(
    customerId: string,
    event: Omit<JourneyEvent, 'id' | 'customerId' | 'timestamp'>
  ): Promise<string> {
    if (!supabase) {
      const mockId = `event_${Date.now()}`;
      console.log('[CustomerJourney] Mock event recorded:', mockId);
      return mockId;
    }

    try {
      const { data, error } = await supabase
        .from('journey_events')
        .insert({
          customer_id: customerId,
          type: event.type,
          title: event.title,
          description: event.description,
          stage: event.stage,
          sentiment: event.sentiment,
          importance: event.importance,
          metadata: event.metadata,
          participants: event.participants,
          outcome: event.outcome,
          source: event.source
        })
        .select('id')
        .single();

      if (error) throw error;
      return data.id;
    } catch (error) {
      console.error('[CustomerJourney] Error recording event:', error);
      throw error;
    }
  }

  /**
   * Record a milestone
   */
  async recordMilestone(
    customerId: string,
    milestone: Omit<JourneyMilestone, 'id' | 'customerId'>
  ): Promise<string> {
    if (!supabase) {
      const mockId = `milestone_${Date.now()}`;
      console.log('[CustomerJourney] Mock milestone recorded:', mockId);
      return mockId;
    }

    try {
      const { data, error } = await supabase
        .from('journey_milestones')
        .insert({
          customer_id: customerId,
          name: milestone.name,
          description: milestone.description,
          target_date: milestone.targetDate,
          achieved_date: milestone.achievedDate,
          stage: milestone.stage,
          status: milestone.status,
          impact: milestone.impact,
          related_event_ids: milestone.relatedEventIds
        })
        .select('id')
        .single();

      if (error) throw error;
      return data.id;
    } catch (error) {
      console.error('[CustomerJourney] Error recording milestone:', error);
      throw error;
    }
  }

  /**
   * Update milestone status
   */
  async updateMilestoneStatus(
    milestoneId: string,
    status: 'pending' | 'achieved' | 'missed' | 'at_risk',
    achievedDate?: string
  ): Promise<void> {
    if (!supabase) {
      console.log('[CustomerJourney] Mock milestone status updated:', milestoneId, status);
      return;
    }

    try {
      const updateData: Record<string, unknown> = { status };
      if (status === 'achieved' && achievedDate) {
        updateData.achieved_date = achievedDate;
      }

      const { error } = await supabase
        .from('journey_milestones')
        .update(updateData)
        .eq('id', milestoneId);

      if (error) throw error;
    } catch (error) {
      console.error('[CustomerJourney] Error updating milestone:', error);
      throw error;
    }
  }

  // ============================================
  // PRIVATE HELPER METHODS
  // ============================================

  private async getCustomer(customerId: string): Promise<Record<string, unknown> | null> {
    if (!supabase) {
      // Return mock data for development
      return this.getMockCustomer(customerId);
    }

    const { data, error } = await supabase
      .from('customers')
      .select('*')
      .eq('id', customerId)
      .single();

    if (error) {
      console.error('[CustomerJourney] Error fetching customer:', error);
      return null;
    }

    return data;
  }

  private async getAllCustomers(
    segment?: string,
    csmId?: string
  ): Promise<Array<Record<string, unknown>>> {
    if (!supabase) {
      return this.getMockCustomers();
    }

    let query = supabase.from('customers').select('*');

    if (segment) {
      query = query.eq('segment', segment);
    }

    if (csmId) {
      query = query.eq('csm_id', csmId);
    }

    const { data, error } = await query;

    if (error) {
      console.error('[CustomerJourney] Error fetching customers:', error);
      return [];
    }

    return data || [];
  }

  private async getStageHistory(customerId: string): Promise<JourneyStageRecord[]> {
    if (!supabase) {
      return this.getMockStageHistory(customerId);
    }

    const { data, error } = await supabase
      .from('journey_stages')
      .select('*')
      .eq('customer_id', customerId)
      .order('entered_at', { ascending: true });

    if (error) {
      console.error('[CustomerJourney] Error fetching stage history:', error);
      return [];
    }

    return (data || []).map(row => ({
      id: row.id,
      customerId: row.customer_id,
      stage: row.stage as JourneyStage,
      enteredAt: row.entered_at,
      exitedAt: row.exited_at,
      durationDays: row.duration_days,
      healthScoreAtEntry: row.health_score_at_entry,
      healthScoreAtExit: row.health_score_at_exit,
      exitReason: row.exit_reason,
      nextStage: row.next_stage as JourneyStage | undefined
    }));
  }

  private async getJourneyEvents(
    customerId: string,
    dateRange?: { start: string; end: string },
    eventTypes?: JourneyEventType[]
  ): Promise<JourneyEvent[]> {
    if (!supabase) {
      return this.getMockEvents(customerId);
    }

    let query = supabase
      .from('journey_events')
      .select('*')
      .eq('customer_id', customerId)
      .order('timestamp', { ascending: false });

    if (dateRange) {
      query = query
        .gte('timestamp', dateRange.start)
        .lte('timestamp', dateRange.end);
    }

    if (eventTypes && eventTypes.length > 0) {
      query = query.in('type', eventTypes);
    }

    const { data, error } = await query;

    if (error) {
      console.error('[CustomerJourney] Error fetching events:', error);
      return [];
    }

    return (data || []).map(row => ({
      id: row.id,
      customerId: row.customer_id,
      type: row.type as JourneyEventType,
      title: row.title,
      description: row.description,
      timestamp: row.timestamp || row.created_at,
      stage: row.stage as JourneyStage,
      sentiment: row.sentiment as EventSentiment | undefined,
      importance: row.importance as EventImportance,
      metadata: row.metadata,
      participants: row.participants,
      outcome: row.outcome,
      source: row.source
    }));
  }

  private async getMilestones(customerId: string): Promise<JourneyMilestone[]> {
    if (!supabase) {
      return this.getMockMilestones(customerId);
    }

    const { data, error } = await supabase
      .from('journey_milestones')
      .select('*')
      .eq('customer_id', customerId)
      .order('target_date', { ascending: true });

    if (error) {
      console.error('[CustomerJourney] Error fetching milestones:', error);
      return [];
    }

    return (data || []).map(row => ({
      id: row.id,
      customerId: row.customer_id,
      name: row.name,
      description: row.description,
      targetDate: row.target_date,
      achievedDate: row.achieved_date,
      stage: row.stage as JourneyStage,
      status: row.status as 'pending' | 'achieved' | 'missed' | 'at_risk',
      impact: row.impact as 'critical' | 'high' | 'medium' | 'low',
      relatedEventIds: row.related_event_ids
    }));
  }

  private async getHealthHistory(
    customerId: string,
    dateRange?: { start: string; end: string }
  ): Promise<JourneyHealthPoint[]> {
    if (!supabase) {
      return this.getMockHealthHistory(customerId);
    }

    let query = supabase
      .from('health_score_history')
      .select('*')
      .eq('customer_id', customerId)
      .order('recorded_at', { ascending: true });

    if (dateRange) {
      query = query
        .gte('recorded_at', dateRange.start)
        .lte('recorded_at', dateRange.end);
    }

    const { data, error } = await query;

    if (error) {
      console.error('[CustomerJourney] Error fetching health history:', error);
      return [];
    }

    return (data || []).map((row, index, arr) => ({
      date: row.recorded_at,
      healthScore: row.health_score,
      stage: row.stage as JourneyStage || 'adoption',
      change: index > 0 ? row.health_score - arr[index - 1].health_score : undefined,
      changeReason: row.change_reason
    }));
  }

  private async getFrictionPoints(customerId: string): Promise<FrictionPoint[]> {
    if (!supabase) {
      return this.getMockFrictionPoints(customerId);
    }

    const { data, error } = await supabase
      .from('journey_friction_points')
      .select('*')
      .eq('customer_id', customerId);

    if (error) {
      console.error('[CustomerJourney] Error fetching friction points:', error);
      return [];
    }

    return (data || []).map(row => ({
      id: row.id,
      customerId: row.customer_id,
      stage: row.stage as JourneyStage,
      type: row.friction_type,
      description: row.description,
      occurrenceCount: row.occurrence_count,
      avgDelayDays: row.avg_delay_days,
      impact: row.impact as 'high' | 'medium' | 'low',
      recommendations: row.recommendations || []
    }));
  }

  private async calculateStats(
    customerId: string,
    events: JourneyEvent[]
  ): Promise<CustomerJourneyMap['stats']> {
    // Count events by type
    const meetingCount = events.filter(e => e.type === 'meeting').length;
    const emailCount = events.filter(e => e.type === 'email').length;
    const supportCount = events.filter(e => e.type === 'support_ticket').length;
    const expansionCount = events.filter(e => e.type === 'expansion').length;
    const escalationCount = events.filter(e => e.type === 'escalation').length;

    // Get NPS score if available
    let npsScore: number | undefined;
    if (supabase) {
      const { data } = await supabase
        .from('nps_responses')
        .select('score')
        .eq('customer_id', customerId)
        .order('created_at', { ascending: false })
        .limit(1)
        .single();

      if (data) {
        npsScore = data.score;
      }
    }

    return {
      totalMeetings: meetingCount,
      totalEmails: emailCount,
      totalSupportTickets: supportCount,
      avgResponseTime: 4.2, // Mock average response time in hours
      npsScore,
      expansionCount,
      escalationCount
    };
  }

  private determineCurrentStage(
    customer: Record<string, unknown>,
    stageHistory: JourneyStageRecord[]
  ): JourneyStage {
    // First check if customer has explicit stage
    if (customer.stage) {
      return customer.stage as JourneyStage;
    }

    // Check stage history for current stage
    const currentStageRecord = stageHistory.find(s => !s.exitedAt);
    if (currentStageRecord) {
      return currentStageRecord.stage;
    }

    // Infer from health score and other factors
    const healthScore = (customer.health_score as number) || 0;

    if (healthScore < 40) {
      return 'at_risk';
    }

    // Default to adoption if no other info
    return 'adoption';
  }

  private calculateHealthTrend(
    healthHistory: JourneyHealthPoint[]
  ): 'improving' | 'stable' | 'declining' {
    if (healthHistory.length < 2) {
      return 'stable';
    }

    // Look at last 5 data points
    const recentHistory = healthHistory.slice(-5);
    const oldAvg = recentHistory.slice(0, Math.floor(recentHistory.length / 2))
      .reduce((sum, h) => sum + h.healthScore, 0) / Math.floor(recentHistory.length / 2);
    const newAvg = recentHistory.slice(Math.floor(recentHistory.length / 2))
      .reduce((sum, h) => sum + h.healthScore, 0) / (recentHistory.length - Math.floor(recentHistory.length / 2));

    const change = newAvg - oldAvg;

    if (change > 5) return 'improving';
    if (change < -5) return 'declining';
    return 'stable';
  }

  private calculateStageDistribution(
    customers: Array<Record<string, unknown>>
  ): Record<JourneyStage, number> {
    const distribution: Record<JourneyStage, number> = {
      prospect: 0,
      onboarding: 0,
      adoption: 0,
      growth: 0,
      maturity: 0,
      renewal: 0,
      at_risk: 0,
      churned: 0
    };

    for (const customer of customers) {
      const stage = (customer.stage as JourneyStage) || 'adoption';
      distribution[stage]++;
    }

    return distribution;
  }

  private calculateHealthByStage(
    customers: Array<Record<string, unknown>>
  ): Record<JourneyStage, { avgHealth: number; minHealth: number; maxHealth: number; customerCount: number }> {
    const byStage: Record<JourneyStage, number[]> = {
      prospect: [],
      onboarding: [],
      adoption: [],
      growth: [],
      maturity: [],
      renewal: [],
      at_risk: [],
      churned: []
    };

    for (const customer of customers) {
      const stage = (customer.stage as JourneyStage) || 'adoption';
      const health = (customer.health_score as number) || 0;
      byStage[stage].push(health);
    }

    const result: Record<JourneyStage, { avgHealth: number; minHealth: number; maxHealth: number; customerCount: number }> = {} as Record<JourneyStage, { avgHealth: number; minHealth: number; maxHealth: number; customerCount: number }>;

    for (const [stage, scores] of Object.entries(byStage)) {
      if (scores.length === 0) {
        result[stage as JourneyStage] = {
          avgHealth: 0,
          minHealth: 0,
          maxHealth: 0,
          customerCount: 0
        };
      } else {
        result[stage as JourneyStage] = {
          avgHealth: Math.round(scores.reduce((a, b) => a + b, 0) / scores.length),
          minHealth: Math.min(...scores),
          maxHealth: Math.max(...scores),
          customerCount: scores.length
        };
      }
    }

    return result;
  }

  private async getStageTransitions(
    period: string
  ): Promise<Array<{ from: JourneyStage; to: JourneyStage; count: number; avgDaysToTransition: number }>> {
    // Return mock transitions for now
    return [
      { from: 'onboarding', to: 'adoption', count: 15, avgDaysToTransition: 32 },
      { from: 'adoption', to: 'growth', count: 8, avgDaysToTransition: 75 },
      { from: 'growth', to: 'maturity', count: 5, avgDaysToTransition: 120 },
      { from: 'adoption', to: 'at_risk', count: 3, avgDaysToTransition: 45 },
      { from: 'at_risk', to: 'adoption', count: 2, avgDaysToTransition: 28 }
    ];
  }

  private async getTopFrictionPoints(): Promise<FrictionPoint[]> {
    if (!supabase) {
      return [
        {
          id: 'fp1',
          stage: 'onboarding',
          type: 'technical_setup',
          description: 'API integration complexity',
          occurrenceCount: 23,
          avgDelayDays: 5,
          impact: 'high',
          recommendations: ['Provide integration wizard', 'Schedule technical office hours']
        },
        {
          id: 'fp2',
          stage: 'adoption',
          type: 'training_completion',
          description: 'Low training completion rate',
          occurrenceCount: 18,
          avgDelayDays: 3,
          impact: 'medium',
          recommendations: ['Shorter training modules', 'In-app guidance']
        }
      ];
    }

    const { data } = await supabase
      .from('journey_friction_points')
      .select('*')
      .order('occurrence_count', { ascending: false })
      .limit(10);

    return (data || []).map(row => ({
      id: row.id,
      stage: row.stage as JourneyStage,
      type: row.friction_type,
      description: row.description,
      occurrenceCount: row.occurrence_count,
      avgDelayDays: row.avg_delay_days,
      impact: row.impact as 'high' | 'medium' | 'low',
      recommendations: row.recommendations || [],
      affectedCustomerIds: row.affected_customer_ids
    }));
  }

  private async getMilestoneCompletionRates(): Promise<Record<string, number>> {
    return {
      'Technical Setup': 0.87,
      'First Value Milestone': 0.72,
      'Training Complete': 0.65,
      'Full Adoption': 0.58,
      'First QBR': 0.91,
      'Case Study Approved': 0.23
    };
  }

  private async calculateTimeToValue(): Promise<{ avg: number; median: number; p90: number }> {
    return {
      avg: 32,
      median: 28,
      p90: 52
    };
  }

  private async getChurnCorrelation(): Promise<Array<{ factor: string; correlation: number; description: string }>> {
    return [
      { factor: 'low_adoption', correlation: 0.78, description: 'Customers with <40% feature adoption are 3x more likely to churn' },
      { factor: 'no_champion', correlation: 0.65, description: 'Accounts without an identified champion have higher churn risk' },
      { factor: 'support_volume', correlation: 0.52, description: 'High support ticket volume correlates with churn' },
      { factor: 'meeting_frequency', correlation: -0.45, description: 'Regular meetings reduce churn probability' }
    ];
  }

  private daysBetween(date1: Date, date2: Date): number {
    const oneDay = 24 * 60 * 60 * 1000;
    return Math.round(Math.abs((date2.getTime() - date1.getTime()) / oneDay));
  }

  // ============================================
  // MOCK DATA FOR DEVELOPMENT
  // ============================================

  private getMockCustomer(customerId: string): Record<string, unknown> {
    return {
      id: customerId,
      name: 'Acme Corporation',
      arr: 150000,
      industry: 'Technology',
      stage: 'adoption',
      health_score: 78,
      created_at: new Date(Date.now() - 180 * 24 * 60 * 60 * 1000).toISOString()
    };
  }

  private getMockCustomers(): Array<Record<string, unknown>> {
    return [
      { id: '1', name: 'Acme Corp', stage: 'adoption', health_score: 78, arr: 150000 },
      { id: '2', name: 'TechFlow', stage: 'growth', health_score: 85, arr: 250000 },
      { id: '3', name: 'DataPro', stage: 'onboarding', health_score: 72, arr: 80000 },
      { id: '4', name: 'CloudNine', stage: 'at_risk', health_score: 45, arr: 120000 },
      { id: '5', name: 'MegaCorp', stage: 'maturity', health_score: 92, arr: 500000 }
    ];
  }

  private getMockStageHistory(customerId: string): JourneyStageRecord[] {
    const now = new Date();
    return [
      {
        id: 'sh1',
        customerId,
        stage: 'prospect',
        enteredAt: new Date(now.getTime() - 200 * 24 * 60 * 60 * 1000).toISOString(),
        exitedAt: new Date(now.getTime() - 180 * 24 * 60 * 60 * 1000).toISOString(),
        durationDays: 20,
        healthScoreAtEntry: 0,
        healthScoreAtExit: 0,
        nextStage: 'onboarding'
      },
      {
        id: 'sh2',
        customerId,
        stage: 'onboarding',
        enteredAt: new Date(now.getTime() - 180 * 24 * 60 * 60 * 1000).toISOString(),
        exitedAt: new Date(now.getTime() - 135 * 24 * 60 * 60 * 1000).toISOString(),
        durationDays: 45,
        healthScoreAtEntry: 65,
        healthScoreAtExit: 72,
        nextStage: 'adoption'
      },
      {
        id: 'sh3',
        customerId,
        stage: 'adoption',
        enteredAt: new Date(now.getTime() - 135 * 24 * 60 * 60 * 1000).toISOString(),
        healthScoreAtEntry: 72
      }
    ];
  }

  private getMockEvents(customerId: string): JourneyEvent[] {
    const now = new Date();
    return [
      {
        id: 'e1',
        customerId,
        type: 'contract_event',
        title: 'Contract Signed',
        description: 'Initial contract signed for $150K ARR',
        timestamp: new Date(now.getTime() - 180 * 24 * 60 * 60 * 1000).toISOString(),
        stage: 'prospect',
        sentiment: 'positive',
        importance: 'high'
      },
      {
        id: 'e2',
        customerId,
        type: 'meeting',
        title: 'Kickoff Meeting',
        description: 'Onboarding kickoff with stakeholders',
        timestamp: new Date(now.getTime() - 175 * 24 * 60 * 60 * 1000).toISOString(),
        stage: 'onboarding',
        sentiment: 'positive',
        importance: 'high',
        participants: ['Sarah Chen', 'John Smith']
      },
      {
        id: 'e3',
        customerId,
        type: 'milestone',
        title: 'Technical Setup Complete',
        timestamp: new Date(now.getTime() - 160 * 24 * 60 * 60 * 1000).toISOString(),
        stage: 'onboarding',
        sentiment: 'positive',
        importance: 'high'
      },
      {
        id: 'e4',
        customerId,
        type: 'stage_change',
        title: 'Moved to Adoption Stage',
        timestamp: new Date(now.getTime() - 135 * 24 * 60 * 60 * 1000).toISOString(),
        stage: 'adoption',
        importance: 'high'
      },
      {
        id: 'e5',
        customerId,
        type: 'nps_response',
        title: 'NPS Response: 8',
        description: 'Customer provided positive feedback',
        timestamp: new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000).toISOString(),
        stage: 'adoption',
        sentiment: 'positive',
        importance: 'medium'
      },
      {
        id: 'e6',
        customerId,
        type: 'support_ticket',
        title: 'API Integration Issue',
        description: 'Resolved within 24 hours',
        timestamp: new Date(now.getTime() - 60 * 24 * 60 * 60 * 1000).toISOString(),
        stage: 'adoption',
        sentiment: 'neutral',
        importance: 'medium'
      },
      {
        id: 'e7',
        customerId,
        type: 'meeting',
        title: 'QBR Meeting',
        description: 'Q4 business review - positive outcomes',
        timestamp: new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString(),
        stage: 'adoption',
        sentiment: 'positive',
        importance: 'high',
        participants: ['Sarah Chen', 'Executive Sponsor']
      },
      {
        id: 'e8',
        customerId,
        type: 'health_change',
        title: 'Health Score Improved',
        description: 'Health increased from 72 to 78',
        timestamp: new Date(now.getTime() - 15 * 24 * 60 * 60 * 1000).toISOString(),
        stage: 'adoption',
        sentiment: 'positive',
        importance: 'medium'
      }
    ];
  }

  private getMockMilestones(customerId: string): JourneyMilestone[] {
    const now = new Date();
    return [
      {
        id: 'm1',
        customerId,
        name: 'Contract Signed',
        description: 'Initial contract execution',
        targetDate: new Date(now.getTime() - 180 * 24 * 60 * 60 * 1000).toISOString(),
        achievedDate: new Date(now.getTime() - 180 * 24 * 60 * 60 * 1000).toISOString(),
        stage: 'prospect',
        status: 'achieved',
        impact: 'critical'
      },
      {
        id: 'm2',
        customerId,
        name: 'Technical Setup Complete',
        description: 'All technical integrations configured',
        targetDate: new Date(now.getTime() - 165 * 24 * 60 * 60 * 1000).toISOString(),
        achievedDate: new Date(now.getTime() - 160 * 24 * 60 * 60 * 1000).toISOString(),
        stage: 'onboarding',
        status: 'achieved',
        impact: 'high'
      },
      {
        id: 'm3',
        customerId,
        name: 'First Value Milestone',
        description: 'Customer achieves initial ROI',
        targetDate: new Date(now.getTime() - 150 * 24 * 60 * 60 * 1000).toISOString(),
        achievedDate: new Date(now.getTime() - 145 * 24 * 60 * 60 * 1000).toISOString(),
        stage: 'onboarding',
        status: 'achieved',
        impact: 'critical'
      },
      {
        id: 'm4',
        customerId,
        name: 'Full Team Onboarded',
        description: 'All users trained and active',
        targetDate: new Date(now.getTime() - 120 * 24 * 60 * 60 * 1000).toISOString(),
        achievedDate: new Date(now.getTime() - 110 * 24 * 60 * 60 * 1000).toISOString(),
        stage: 'adoption',
        status: 'achieved',
        impact: 'high'
      },
      {
        id: 'm5',
        customerId,
        name: 'Case Study Approval',
        description: 'Customer agrees to case study',
        targetDate: new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000).toISOString(),
        stage: 'growth',
        status: 'pending',
        impact: 'medium'
      },
      {
        id: 'm6',
        customerId,
        name: 'Renewal',
        description: 'Annual contract renewal',
        targetDate: new Date(now.getTime() + 180 * 24 * 60 * 60 * 1000).toISOString(),
        stage: 'renewal',
        status: 'pending',
        impact: 'critical'
      }
    ];
  }

  private getMockHealthHistory(customerId: string): JourneyHealthPoint[] {
    const now = new Date();
    const points: JourneyHealthPoint[] = [];

    // Generate weekly health points over 6 months
    for (let i = 26; i >= 0; i--) {
      const date = new Date(now.getTime() - i * 7 * 24 * 60 * 60 * 1000);
      const baseScore = 65 + Math.sin(i / 5) * 10 + (26 - i) * 0.5;
      const score = Math.min(100, Math.max(0, Math.round(baseScore + Math.random() * 5 - 2.5)));

      let stage: JourneyStage = 'adoption';
      if (i > 20) stage = 'onboarding';
      else if (i > 18) stage = 'adoption';

      points.push({
        date: date.toISOString(),
        healthScore: score,
        stage,
        change: points.length > 0 ? score - points[points.length - 1].healthScore : undefined
      });
    }

    return points;
  }

  private getMockFrictionPoints(customerId: string): FrictionPoint[] {
    return [
      {
        id: 'fp1',
        customerId,
        stage: 'onboarding',
        type: 'technical_setup',
        description: 'Delayed API integration due to documentation gaps',
        occurrenceCount: 1,
        avgDelayDays: 5,
        impact: 'medium',
        recommendations: ['Review API documentation', 'Schedule technical deep-dive']
      }
    ];
  }
}

// Export singleton instance
export const customerJourneyService = new CustomerJourneyService();
