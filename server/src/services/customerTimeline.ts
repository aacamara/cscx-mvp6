/**
 * Customer Journey Timeline Service (PRD-062)
 *
 * Aggregates timeline events from multiple sources to provide
 * a comprehensive chronological view of customer interactions.
 */

import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { config } from '../config/index.js';

// Initialize Supabase client
let supabase: SupabaseClient | null = null;
if (config.supabaseUrl && config.supabaseServiceKey) {
  supabase = createClient(config.supabaseUrl, config.supabaseServiceKey);
}

// ============================================
// TYPES
// ============================================

export type TimelineEventType =
  | 'meeting' | 'email_sent' | 'email_received' | 'call'
  | 'support_ticket' | 'nps_survey' | 'qbr' | 'training'
  | 'contract_signed' | 'contract_renewed' | 'contract_expanded' | 'contract_amendment'
  | 'health_change' | 'risk_signal' | 'risk_resolved'
  | 'usage_milestone' | 'feature_adopted' | 'usage_drop'
  | 'internal_note' | 'csm_change' | 'escalation';

export type TimelineEventCategory =
  | 'customer_facing' | 'contract' | 'health' | 'usage' | 'internal';

export interface TimelineEvent {
  id: string;
  customerId: string;
  eventType: TimelineEventType;
  eventCategory: TimelineEventCategory;
  title: string;
  description?: string;
  occurredAt: string;
  durationMinutes?: number;
  participants?: Array<{ name: string; email?: string; role?: string }>;
  stakeholderIds?: string[];
  sourceType: string;
  sourceId?: string;
  sourceUrl?: string;
  sentiment?: 'positive' | 'neutral' | 'negative';
  importance: 'high' | 'normal' | 'low';
  isMilestone: boolean;
  metadata?: Record<string, unknown>;
  tags?: string[];
  isInternal: boolean;
  createdBy?: string;
  createdAt: string;
  updatedAt: string;
}

export interface TimelineFilters {
  startDate?: string;
  endDate?: string;
  eventTypes?: TimelineEventType[];
  eventCategories?: TimelineEventCategory[];
  includeInternal?: boolean;
  sentiment?: 'positive' | 'neutral' | 'negative';
  stakeholderIds?: string[];
  searchQuery?: string;
  limit?: number;
  offset?: number;
}

export interface TimelineStats {
  totalEvents: number;
  byType: Record<string, number>;
  byCategory: Record<string, number>;
  communicationBalance: {
    outbound: number;
    inbound: number;
    meetings: number;
  };
  dateRange: {
    earliest: string | null;
    latest: string | null;
    totalDays: number;
  };
}

export interface Milestone {
  id: string;
  customerId: string;
  milestoneType: string;
  title: string;
  description?: string;
  achievedAt: string;
  relatedEventId?: string;
  valueImpact?: number;
}

export interface HealthScorePoint {
  id: string;
  score: number;
  previousScore?: number;
  changeAmount?: number;
  engagementComponent?: number;
  adoptionComponent?: number;
  sentimentComponent?: number;
  changeReason?: string;
  recordedAt: string;
}

export interface StakeholderEngagement {
  stakeholder: {
    id: string;
    name: string;
    role?: string;
    email?: string;
    isPrimary: boolean;
  };
  meetingsCount: number;
  emailsSent: number;
  emailsReceived: number;
  callsCount: number;
  totalInteractions: number;
  engagementScore: number;
  lastContact?: string;
  sentiment: 'positive' | 'neutral' | 'negative' | 'unknown';
}

export interface ActivityHeatmapData {
  date: string;
  count: number;
  events: Array<{ type: string; count: number }>;
}

export interface CustomerJourneyView {
  customer: {
    id: string;
    name: string;
    arr: number;
    healthScore: number;
    stage: string;
    customerSince: string;
    renewalDate?: string;
  };
  events: TimelineEvent[];
  milestones: Milestone[];
  stats: TimelineStats;
  healthHistory: HealthScorePoint[];
  stakeholderEngagement: StakeholderEngagement[];
  activityHeatmap: ActivityHeatmapData[];
  highlights: {
    keyMilestones: Milestone[];
    recentActivity: TimelineEvent[];
    contractEvents: TimelineEvent[];
    stakeholderChanges: TimelineEvent[];
  };
  generatedAt: string;
  dataCompleteness: number;
  pagination: {
    total: number;
    page: number;
    pageSize: number;
    hasMore: boolean;
  };
}

// ============================================
// SERVICE
// ============================================

class CustomerTimelineService {
  /**
   * Get comprehensive customer journey timeline
   */
  async getCustomerJourney(
    customerId: string,
    filters: TimelineFilters = {}
  ): Promise<CustomerJourneyView | null> {
    if (!supabase) {
      return this.getMockJourney(customerId);
    }

    // Fetch all data in parallel for performance
    const [
      customerData,
      timelineEvents,
      milestones,
      healthHistory,
      stakeholders,
      meetings,
      activities
    ] = await Promise.all([
      this.fetchCustomerData(customerId),
      this.fetchTimelineEvents(customerId, filters),
      this.fetchMilestones(customerId),
      this.fetchHealthHistory(customerId),
      this.fetchStakeholders(customerId),
      this.fetchMeetings(customerId, filters),
      this.fetchActivities(customerId, filters)
    ]);

    if (!customerData) {
      return null;
    }

    // Aggregate events from all sources
    const allEvents = this.aggregateEvents(
      timelineEvents,
      meetings,
      activities,
      filters
    );

    // Calculate stats
    const stats = this.calculateStats(allEvents);

    // Calculate stakeholder engagement
    const stakeholderEngagement = this.calculateStakeholderEngagement(
      stakeholders,
      allEvents
    );

    // Build activity heatmap
    const activityHeatmap = this.buildActivityHeatmap(allEvents);

    // Calculate data completeness
    const dataCompleteness = this.calculateDataCompleteness({
      customerData,
      events: allEvents,
      milestones,
      healthHistory,
      stakeholders
    });

    // Apply pagination
    const page = Math.floor((filters.offset || 0) / (filters.limit || 50)) + 1;
    const pageSize = filters.limit || 50;
    const paginatedEvents = allEvents.slice(
      filters.offset || 0,
      (filters.offset || 0) + pageSize
    );

    return {
      customer: {
        id: customerData.id,
        name: customerData.name,
        arr: customerData.arr || 0,
        healthScore: customerData.health_score || 0,
        stage: customerData.stage || 'active',
        customerSince: customerData.created_at,
        renewalDate: customerData.contract_end || undefined
      },
      events: paginatedEvents,
      milestones,
      stats,
      healthHistory,
      stakeholderEngagement,
      activityHeatmap,
      highlights: {
        keyMilestones: milestones.slice(0, 5),
        recentActivity: allEvents.slice(0, 10),
        contractEvents: allEvents.filter(e => e.eventCategory === 'contract').slice(0, 5),
        stakeholderChanges: allEvents.filter(e => e.eventType === 'csm_change').slice(0, 3)
      },
      generatedAt: new Date().toISOString(),
      dataCompleteness,
      pagination: {
        total: allEvents.length,
        page,
        pageSize,
        hasMore: allEvents.length > (filters.offset || 0) + pageSize
      }
    };
  }

  /**
   * Get timeline events only (for incremental loading)
   */
  async getTimelineEvents(
    customerId: string,
    filters: TimelineFilters = {}
  ): Promise<{ events: TimelineEvent[]; total: number; hasMore: boolean }> {
    if (!supabase) {
      const mock = this.getMockJourney(customerId);
      return {
        events: mock?.events || [],
        total: mock?.events.length || 0,
        hasMore: false
      };
    }

    const [timelineEvents, meetings, activities] = await Promise.all([
      this.fetchTimelineEvents(customerId, filters),
      this.fetchMeetings(customerId, filters),
      this.fetchActivities(customerId, filters)
    ]);

    const allEvents = this.aggregateEvents(timelineEvents, meetings, activities, filters);
    const pageSize = filters.limit || 50;
    const offset = filters.offset || 0;

    return {
      events: allEvents.slice(offset, offset + pageSize),
      total: allEvents.length,
      hasMore: allEvents.length > offset + pageSize
    };
  }

  /**
   * Create a new timeline event
   */
  async createEvent(event: Omit<TimelineEvent, 'id' | 'createdAt' | 'updatedAt'>): Promise<TimelineEvent | null> {
    if (!supabase) {
      return null;
    }

    const { data, error } = await supabase
      .from('timeline_events')
      .insert({
        customer_id: event.customerId,
        event_type: event.eventType,
        event_category: event.eventCategory,
        title: event.title,
        description: event.description,
        occurred_at: event.occurredAt,
        duration_minutes: event.durationMinutes,
        participants: event.participants,
        stakeholder_ids: event.stakeholderIds,
        source_type: event.sourceType,
        source_id: event.sourceId,
        source_url: event.sourceUrl,
        sentiment: event.sentiment,
        importance: event.importance,
        is_milestone: event.isMilestone,
        metadata: event.metadata,
        tags: event.tags,
        is_internal: event.isInternal,
        created_by: event.createdBy
      })
      .select()
      .single();

    if (error) {
      console.error('[Timeline] Error creating event:', error);
      return null;
    }

    return this.mapEventFromDb(data);
  }

  // ============================================
  // PRIVATE FETCH METHODS
  // ============================================

  private async fetchCustomerData(customerId: string) {
    if (!supabase) return null;

    const { data, error } = await supabase
      .from('customers')
      .select('*')
      .eq('id', customerId)
      .single();

    if (error) {
      console.error('[Timeline] Error fetching customer:', error);
      return null;
    }

    return data;
  }

  private async fetchTimelineEvents(
    customerId: string,
    filters: TimelineFilters
  ): Promise<TimelineEvent[]> {
    if (!supabase) return [];

    let query = supabase
      .from('timeline_events')
      .select('*')
      .eq('customer_id', customerId)
      .order('occurred_at', { ascending: false });

    // Apply filters
    if (filters.startDate) {
      query = query.gte('occurred_at', filters.startDate);
    }
    if (filters.endDate) {
      query = query.lte('occurred_at', filters.endDate);
    }
    if (filters.eventTypes && filters.eventTypes.length > 0) {
      query = query.in('event_type', filters.eventTypes);
    }
    if (filters.eventCategories && filters.eventCategories.length > 0) {
      query = query.in('event_category', filters.eventCategories);
    }
    if (filters.includeInternal === false) {
      query = query.eq('is_internal', false);
    }
    if (filters.sentiment) {
      query = query.eq('sentiment', filters.sentiment);
    }

    const { data, error } = await query.limit(500);

    if (error) {
      console.error('[Timeline] Error fetching timeline events:', error);
      return [];
    }

    return (data || []).map(this.mapEventFromDb);
  }

  private async fetchMeetings(
    customerId: string,
    filters: TimelineFilters
  ): Promise<TimelineEvent[]> {
    if (!supabase) return [];

    let query = supabase
      .from('meetings')
      .select('*')
      .eq('customer_id', customerId)
      .order('scheduled_at', { ascending: false });

    if (filters.startDate) {
      query = query.gte('scheduled_at', filters.startDate);
    }
    if (filters.endDate) {
      query = query.lte('scheduled_at', filters.endDate);
    }

    const { data, error } = await query.limit(200);

    if (error) {
      console.error('[Timeline] Error fetching meetings:', error);
      return [];
    }

    // Convert meetings to timeline events
    return (data || []).map(m => ({
      id: m.id,
      customerId: m.customer_id,
      eventType: m.meeting_type === 'qbr' ? 'qbr' : 'meeting' as TimelineEventType,
      eventCategory: 'customer_facing' as TimelineEventCategory,
      title: m.title || 'Customer Meeting',
      description: m.notes || m.description,
      occurredAt: m.scheduled_at,
      durationMinutes: m.duration || 60,
      participants: m.attendees || [],
      sourceType: 'calendar',
      sourceId: m.calendar_event_id,
      sourceUrl: m.meeting_url,
      sentiment: m.sentiment || 'neutral',
      importance: m.meeting_type === 'qbr' ? 'high' : 'normal' as 'high' | 'normal' | 'low',
      isMilestone: m.meeting_type === 'qbr',
      metadata: { meetingType: m.meeting_type },
      isInternal: false,
      createdAt: m.created_at,
      updatedAt: m.updated_at
    }));
  }

  private async fetchActivities(
    customerId: string,
    filters: TimelineFilters
  ): Promise<TimelineEvent[]> {
    if (!supabase) return [];

    let query = supabase
      .from('agent_activity_log')
      .select('*')
      .eq('customer_id', customerId)
      .order('started_at', { ascending: false });

    if (filters.startDate) {
      query = query.gte('started_at', filters.startDate);
    }
    if (filters.endDate) {
      query = query.lte('started_at', filters.endDate);
    }

    const { data, error } = await query.limit(200);

    if (error) {
      console.error('[Timeline] Error fetching activities:', error);
      return [];
    }

    // Convert activities to timeline events
    return (data || []).map(a => ({
      id: a.id,
      customerId: a.customer_id,
      eventType: this.mapActivityTypeToEventType(a.action_type),
      eventCategory: this.mapActivityToCategory(a.action_type),
      title: a.result_data?.summary || a.action_type?.replace(/_/g, ' ') || 'Activity',
      description: a.result_data?.details || a.action_data?.description,
      occurredAt: a.started_at,
      sourceType: 'agent',
      sourceId: a.id,
      sentiment: a.result_data?.sentiment || 'neutral',
      importance: 'normal' as 'high' | 'normal' | 'low',
      isMilestone: false,
      metadata: { agentType: a.agent_type, actionData: a.action_data },
      isInternal: a.action_type?.includes('internal') || false,
      createdAt: a.created_at || a.started_at,
      updatedAt: a.started_at
    }));
  }

  private async fetchMilestones(customerId: string): Promise<Milestone[]> {
    if (!supabase) return [];

    const { data, error } = await supabase
      .from('customer_milestones')
      .select('*')
      .eq('customer_id', customerId)
      .order('achieved_at', { ascending: false });

    if (error) {
      console.error('[Timeline] Error fetching milestones:', error);
      return [];
    }

    return (data || []).map(m => ({
      id: m.id,
      customerId: m.customer_id,
      milestoneType: m.milestone_type,
      title: m.title,
      description: m.description,
      achievedAt: m.achieved_at,
      relatedEventId: m.related_event_id,
      valueImpact: m.value_impact
    }));
  }

  private async fetchHealthHistory(customerId: string): Promise<HealthScorePoint[]> {
    if (!supabase) return [];

    const { data, error } = await supabase
      .from('health_score_history')
      .select('*')
      .eq('customer_id', customerId)
      .order('recorded_at', { ascending: true })
      .limit(100);

    if (error) {
      console.error('[Timeline] Error fetching health history:', error);
      return [];
    }

    return (data || []).map(h => ({
      id: h.id,
      score: h.score,
      previousScore: h.previous_score,
      changeAmount: h.change_amount,
      engagementComponent: h.engagement_component,
      adoptionComponent: h.adoption_component,
      sentimentComponent: h.sentiment_component,
      changeReason: h.change_reason,
      recordedAt: h.recorded_at
    }));
  }

  private async fetchStakeholders(customerId: string) {
    if (!supabase) return [];

    const { data, error } = await supabase
      .from('stakeholders')
      .select('*')
      .eq('customer_id', customerId);

    if (error) {
      console.error('[Timeline] Error fetching stakeholders:', error);
      return [];
    }

    return data || [];
  }

  // ============================================
  // AGGREGATION & CALCULATION METHODS
  // ============================================

  private aggregateEvents(
    timelineEvents: TimelineEvent[],
    meetings: TimelineEvent[],
    activities: TimelineEvent[],
    filters: TimelineFilters
  ): TimelineEvent[] {
    // Combine all events
    const allEvents = [...timelineEvents, ...meetings, ...activities];

    // Remove duplicates (by source_id or by close timestamp + title)
    const seen = new Set<string>();
    const deduped = allEvents.filter(e => {
      const key = e.sourceId || `${e.occurredAt}-${e.title}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });

    // Apply search filter
    let filtered = deduped;
    if (filters.searchQuery) {
      const query = filters.searchQuery.toLowerCase();
      filtered = deduped.filter(e =>
        e.title.toLowerCase().includes(query) ||
        e.description?.toLowerCase().includes(query) ||
        e.eventType.toLowerCase().includes(query)
      );
    }

    // Sort by date (newest first)
    return filtered.sort((a, b) =>
      new Date(b.occurredAt).getTime() - new Date(a.occurredAt).getTime()
    );
  }

  private calculateStats(events: TimelineEvent[]): TimelineStats {
    const byType: Record<string, number> = {};
    const byCategory: Record<string, number> = {};

    let outbound = 0;
    let inbound = 0;
    let meetings = 0;

    events.forEach(e => {
      byType[e.eventType] = (byType[e.eventType] || 0) + 1;
      byCategory[e.eventCategory] = (byCategory[e.eventCategory] || 0) + 1;

      if (e.eventType === 'email_sent') outbound++;
      if (e.eventType === 'email_received') inbound++;
      if (e.eventType === 'meeting' || e.eventType === 'qbr') meetings++;
    });

    const dates = events.map(e => new Date(e.occurredAt).getTime());
    const earliest = dates.length > 0 ? new Date(Math.min(...dates)) : null;
    const latest = dates.length > 0 ? new Date(Math.max(...dates)) : null;
    const totalDays = earliest && latest
      ? Math.ceil((latest.getTime() - earliest.getTime()) / (1000 * 60 * 60 * 24))
      : 0;

    return {
      totalEvents: events.length,
      byType,
      byCategory,
      communicationBalance: { outbound, inbound, meetings },
      dateRange: {
        earliest: earliest?.toISOString() || null,
        latest: latest?.toISOString() || null,
        totalDays
      }
    };
  }

  private calculateStakeholderEngagement(
    stakeholders: any[],
    events: TimelineEvent[]
  ): StakeholderEngagement[] {
    return stakeholders.map(s => {
      // Find events involving this stakeholder
      const stakeholderEvents = events.filter(e =>
        e.participants?.some(p =>
          p.email === s.email || p.name === s.name
        ) ||
        e.stakeholderIds?.includes(s.id)
      );

      const meetingsCount = stakeholderEvents.filter(e =>
        e.eventType === 'meeting' || e.eventType === 'qbr'
      ).length;

      const emailsSent = stakeholderEvents.filter(e =>
        e.eventType === 'email_sent'
      ).length;

      const emailsReceived = stakeholderEvents.filter(e =>
        e.eventType === 'email_received'
      ).length;

      const callsCount = stakeholderEvents.filter(e =>
        e.eventType === 'call'
      ).length;

      const totalInteractions = meetingsCount + emailsSent + emailsReceived + callsCount;

      // Calculate engagement score (weighted)
      const engagementScore = Math.min(100,
        (meetingsCount * 15) + (callsCount * 10) +
        (emailsSent * 3) + (emailsReceived * 5)
      );

      // Determine sentiment from recent events
      const recentEvents = stakeholderEvents.slice(0, 10);
      const sentiments = recentEvents.map(e => e.sentiment).filter(Boolean);
      const sentiment = this.calculateAverageSentiment(sentiments);

      // Find last contact
      const lastContact = stakeholderEvents[0]?.occurredAt;

      return {
        stakeholder: {
          id: s.id,
          name: s.name,
          role: s.title || s.role,
          email: s.email,
          isPrimary: s.is_primary || false
        },
        meetingsCount,
        emailsSent,
        emailsReceived,
        callsCount,
        totalInteractions,
        engagementScore,
        lastContact,
        sentiment
      };
    });
  }

  private buildActivityHeatmap(events: TimelineEvent[]): ActivityHeatmapData[] {
    const heatmap = new Map<string, { count: number; events: Map<string, number> }>();

    // Go back 365 days
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - 365);

    events.forEach(e => {
      const date = new Date(e.occurredAt).toISOString().split('T')[0];
      if (new Date(date) >= startDate) {
        if (!heatmap.has(date)) {
          heatmap.set(date, { count: 0, events: new Map() });
        }
        const entry = heatmap.get(date)!;
        entry.count++;
        entry.events.set(e.eventType, (entry.events.get(e.eventType) || 0) + 1);
      }
    });

    return Array.from(heatmap.entries())
      .map(([date, data]) => ({
        date,
        count: data.count,
        events: Array.from(data.events.entries()).map(([type, count]) => ({ type, count }))
      }))
      .sort((a, b) => a.date.localeCompare(b.date));
  }

  private calculateDataCompleteness(data: {
    customerData: any;
    events: TimelineEvent[];
    milestones: Milestone[];
    healthHistory: HealthScorePoint[];
    stakeholders: any[];
  }): number {
    let score = 0;
    let total = 0;

    // Customer data
    total += 2;
    if (data.customerData) score += 2;

    // Events
    total += 2;
    if (data.events.length > 0) score += 1;
    if (data.events.length > 10) score += 1;

    // Milestones
    total += 1;
    if (data.milestones.length > 0) score += 1;

    // Health history
    total += 1;
    if (data.healthHistory.length > 0) score += 1;

    // Stakeholders
    total += 2;
    if (data.stakeholders.length > 0) score += 1;
    if (data.stakeholders.length >= 3) score += 1;

    return Math.round((score / total) * 100);
  }

  // ============================================
  // HELPER METHODS
  // ============================================

  private mapEventFromDb(row: any): TimelineEvent {
    return {
      id: row.id,
      customerId: row.customer_id,
      eventType: row.event_type as TimelineEventType,
      eventCategory: row.event_category as TimelineEventCategory,
      title: row.title,
      description: row.description,
      occurredAt: row.occurred_at,
      durationMinutes: row.duration_minutes,
      participants: row.participants,
      stakeholderIds: row.stakeholder_ids,
      sourceType: row.source_type,
      sourceId: row.source_id,
      sourceUrl: row.source_url,
      sentiment: row.sentiment,
      importance: row.importance || 'normal',
      isMilestone: row.is_milestone || false,
      metadata: row.metadata,
      tags: row.tags,
      isInternal: row.is_internal || false,
      createdBy: row.created_by,
      createdAt: row.created_at,
      updatedAt: row.updated_at
    };
  }

  private mapActivityTypeToEventType(actionType: string): TimelineEventType {
    const mapping: Record<string, TimelineEventType> = {
      'send_email': 'email_sent',
      'draft_email': 'email_sent',
      'schedule_meeting': 'meeting',
      'book_meeting': 'meeting',
      'health_check': 'health_change',
      'risk_assessment': 'risk_signal',
      'qbr_prep': 'qbr',
      'escalation': 'escalation',
      'internal_note': 'internal_note'
    };

    return mapping[actionType] || 'internal_note';
  }

  private mapActivityToCategory(actionType: string): TimelineEventCategory {
    if (actionType?.includes('email') || actionType?.includes('meeting')) {
      return 'customer_facing';
    }
    if (actionType?.includes('health') || actionType?.includes('risk')) {
      return 'health';
    }
    if (actionType?.includes('usage')) {
      return 'usage';
    }
    return 'internal';
  }

  private calculateAverageSentiment(
    sentiments: (string | undefined)[]
  ): 'positive' | 'neutral' | 'negative' | 'unknown' {
    if (sentiments.length === 0) return 'unknown';

    let positive = 0;
    let negative = 0;

    sentiments.forEach(s => {
      if (s === 'positive') positive++;
      if (s === 'negative') negative++;
    });

    if (positive > negative) return 'positive';
    if (negative > positive) return 'negative';
    return 'neutral';
  }

  // ============================================
  // MOCK DATA
  // ============================================

  private getMockJourney(customerId: string): CustomerJourneyView {
    const now = new Date();
    const oneYearAgo = new Date(now.getTime() - 365 * 24 * 60 * 60 * 1000);

    const mockEvents: TimelineEvent[] = [
      {
        id: '1',
        customerId,
        eventType: 'contract_signed',
        eventCategory: 'contract',
        title: 'Initial Contract Signed',
        description: 'Customer signed initial contract worth $150,000 ARR',
        occurredAt: oneYearAgo.toISOString(),
        sourceType: 'internal',
        sentiment: 'positive',
        importance: 'high',
        isMilestone: true,
        isInternal: false,
        createdAt: oneYearAgo.toISOString(),
        updatedAt: oneYearAgo.toISOString()
      },
      {
        id: '2',
        customerId,
        eventType: 'meeting',
        eventCategory: 'customer_facing',
        title: 'Kickoff Meeting',
        description: 'Initial kickoff meeting with implementation team',
        occurredAt: new Date(oneYearAgo.getTime() + 5 * 24 * 60 * 60 * 1000).toISOString(),
        durationMinutes: 60,
        participants: [{ name: 'Sarah Chen', email: 'sarah@customer.com', role: 'VP Operations' }],
        sourceType: 'calendar',
        sentiment: 'positive',
        importance: 'high',
        isMilestone: true,
        isInternal: false,
        createdAt: now.toISOString(),
        updatedAt: now.toISOString()
      },
      {
        id: '3',
        customerId,
        eventType: 'training',
        eventCategory: 'customer_facing',
        title: 'Admin Training Session',
        description: 'Completed admin training for Sarah Chen',
        occurredAt: new Date(oneYearAgo.getTime() + 15 * 24 * 60 * 60 * 1000).toISOString(),
        durationMinutes: 90,
        sourceType: 'calendar',
        sentiment: 'positive',
        importance: 'normal',
        isMilestone: false,
        isInternal: false,
        createdAt: now.toISOString(),
        updatedAt: now.toISOString()
      },
      {
        id: '4',
        customerId,
        eventType: 'usage_milestone',
        eventCategory: 'usage',
        title: '100 Active Users',
        description: 'Customer reached 100 active users milestone',
        occurredAt: new Date(oneYearAgo.getTime() + 65 * 24 * 60 * 60 * 1000).toISOString(),
        sourceType: 'internal',
        sentiment: 'positive',
        importance: 'high',
        isMilestone: true,
        isInternal: false,
        createdAt: now.toISOString(),
        updatedAt: now.toISOString()
      },
      {
        id: '5',
        customerId,
        eventType: 'qbr',
        eventCategory: 'customer_facing',
        title: 'Q2 Quarterly Business Review',
        description: 'Quarterly business review covering adoption metrics',
        occurredAt: new Date(oneYearAgo.getTime() + 185 * 24 * 60 * 60 * 1000).toISOString(),
        durationMinutes: 90,
        sourceType: 'calendar',
        sentiment: 'positive',
        importance: 'high',
        isMilestone: true,
        isInternal: false,
        createdAt: now.toISOString(),
        updatedAt: now.toISOString()
      },
      {
        id: '6',
        customerId,
        eventType: 'health_change',
        eventCategory: 'health',
        title: 'Health Score Improved',
        description: 'Health score increased from 75 to 85',
        occurredAt: new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000).toISOString(),
        sourceType: 'internal',
        sentiment: 'positive',
        importance: 'normal',
        isMilestone: false,
        isInternal: false,
        createdAt: now.toISOString(),
        updatedAt: now.toISOString()
      },
      {
        id: '7',
        customerId,
        eventType: 'meeting',
        eventCategory: 'customer_facing',
        title: 'Monthly Check-In',
        description: 'Regular monthly check-in call',
        occurredAt: new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString(),
        durationMinutes: 30,
        sourceType: 'calendar',
        sentiment: 'positive',
        importance: 'normal',
        isMilestone: false,
        isInternal: false,
        createdAt: now.toISOString(),
        updatedAt: now.toISOString()
      },
      {
        id: '8',
        customerId,
        eventType: 'email_received',
        eventCategory: 'customer_facing',
        title: 'Feature Request',
        description: 'Customer submitted feature request for reporting',
        occurredAt: new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000).toISOString(),
        sourceType: 'gmail',
        sentiment: 'neutral',
        importance: 'normal',
        isMilestone: false,
        isInternal: false,
        createdAt: now.toISOString(),
        updatedAt: now.toISOString()
      },
      {
        id: '9',
        customerId,
        eventType: 'support_ticket',
        eventCategory: 'customer_facing',
        title: 'API Integration Issue',
        description: 'Support ticket for API integration question - resolved',
        occurredAt: new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString(),
        sourceType: 'zendesk',
        sentiment: 'neutral',
        importance: 'normal',
        isMilestone: false,
        isInternal: false,
        createdAt: now.toISOString(),
        updatedAt: now.toISOString()
      }
    ];

    const mockMilestones: Milestone[] = [
      {
        id: 'm1',
        customerId,
        milestoneType: 'onboarding_complete',
        title: 'Onboarding Completed',
        description: 'Customer successfully completed onboarding program',
        achievedAt: new Date(oneYearAgo.getTime() + 25 * 24 * 60 * 60 * 1000).toISOString()
      },
      {
        id: 'm2',
        customerId,
        milestoneType: 'first_value',
        title: 'First Value Milestone',
        description: 'Customer reported measurable ROI from platform',
        achievedAt: new Date(oneYearAgo.getTime() + 95 * 24 * 60 * 60 * 1000).toISOString()
      },
      {
        id: 'm3',
        customerId,
        milestoneType: 'champion_identified',
        title: 'Champion Identified',
        description: 'Sarah Chen identified as product champion',
        achievedAt: new Date(oneYearAgo.getTime() + 65 * 24 * 60 * 60 * 1000).toISOString()
      }
    ];

    const mockHealthHistory: HealthScorePoint[] = [
      { id: 'h1', score: 70, recordedAt: oneYearAgo.toISOString() },
      { id: 'h2', score: 75, previousScore: 70, changeAmount: 5, recordedAt: new Date(oneYearAgo.getTime() + 95 * 24 * 60 * 60 * 1000).toISOString() },
      { id: 'h3', score: 78, previousScore: 75, changeAmount: 3, recordedAt: new Date(oneYearAgo.getTime() + 185 * 24 * 60 * 60 * 1000).toISOString() },
      { id: 'h4', score: 85, previousScore: 78, changeAmount: 7, recordedAt: new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000).toISOString() },
      { id: 'h5', score: 87, previousScore: 85, changeAmount: 2, recordedAt: new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString() }
    ];

    const mockStakeholderEngagement: StakeholderEngagement[] = [
      {
        stakeholder: { id: 's1', name: 'Sarah Chen', role: 'VP Operations', email: 'sarah@customer.com', isPrimary: true },
        meetingsCount: 12,
        emailsSent: 28,
        emailsReceived: 22,
        callsCount: 4,
        totalInteractions: 66,
        engagementScore: 85,
        lastContact: new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString(),
        sentiment: 'positive'
      },
      {
        stakeholder: { id: 's2', name: 'Mike Johnson', role: 'IT Director', email: 'mike@customer.com', isPrimary: false },
        meetingsCount: 5,
        emailsSent: 12,
        emailsReceived: 8,
        callsCount: 2,
        totalInteractions: 27,
        engagementScore: 55,
        lastContact: new Date(now.getTime() - 45 * 24 * 60 * 60 * 1000).toISOString(),
        sentiment: 'neutral'
      }
    ];

    return {
      customer: {
        id: customerId,
        name: 'Demo Company',
        arr: 150000,
        healthScore: 87,
        stage: 'active',
        customerSince: oneYearAgo.toISOString(),
        renewalDate: new Date(now.getTime() + 137 * 24 * 60 * 60 * 1000).toISOString()
      },
      events: mockEvents,
      milestones: mockMilestones,
      stats: this.calculateStats(mockEvents),
      healthHistory: mockHealthHistory,
      stakeholderEngagement: mockStakeholderEngagement,
      activityHeatmap: this.buildActivityHeatmap(mockEvents),
      highlights: {
        keyMilestones: mockMilestones.slice(0, 3),
        recentActivity: mockEvents.slice(0, 5),
        contractEvents: mockEvents.filter(e => e.eventCategory === 'contract'),
        stakeholderChanges: []
      },
      generatedAt: now.toISOString(),
      dataCompleteness: 100,
      pagination: {
        total: mockEvents.length,
        page: 1,
        pageSize: 50,
        hasMore: false
      }
    };
  }
}

export const customerTimelineService = new CustomerTimelineService();
