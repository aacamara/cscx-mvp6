/**
 * Event Engagement Scorer Service
 * PRD-018: Calculate engagement scores from event attendance data
 *
 * Scoring Components:
 * - Event Frequency (30%): Number of events attended
 * - Event Recency (25%): Days since last event
 * - Event Diversity (20%): Variety of event types attended
 * - Participation Depth (15%): Q&A participation, feedback submitted
 * - Consistency (10%): Regular attendance pattern
 */

import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { config } from '../../config/index.js';
import {
  EventAttendanceRecord,
  EventType,
  EngagementLevel,
  EngagementTrendDirection,
  CustomerEventEngagement,
  UserEventEngagement,
  EngagementScoreComponents,
  EngagementAnalysisResult,
  EventSummary,
  AdvocacyCandidate,
  DecliningEngagementAlert,
  AdvocacyType,
} from '../../../../types/eventEngagement.js';

// Initialize Supabase client
let supabase: SupabaseClient | null = null;
if (config.supabaseUrl && config.supabaseServiceKey) {
  supabase = createClient(config.supabaseUrl, config.supabaseServiceKey);
}

// Score weights (must sum to 1.0)
const SCORE_WEIGHTS = {
  eventFrequency: 0.30,
  eventRecency: 0.25,
  eventDiversity: 0.20,
  participationDepth: 0.15,
  consistency: 0.10,
};

// Score thresholds for engagement levels
const ENGAGEMENT_THRESHOLDS = {
  high: 80,
  good: 60,
  medium: 40,
  low: 0,
};

// Advocacy score threshold
const ADVOCACY_THRESHOLD = 85;

// Declining engagement threshold (score drop)
const DECLINING_THRESHOLD = -10;

class EngagementScorerService {
  /**
   * Calculate engagement scores for all customers in uploaded data
   */
  async calculateEngagementScores(
    fileId: string,
    period: 'month' | 'quarter' | 'year' | 'all' = 'all'
  ): Promise<EngagementAnalysisResult> {
    // Get attendance records
    const records = await this.getAttendanceRecords(fileId, period);

    if (records.length === 0) {
      return this.getEmptyResult();
    }

    // Group records by customer
    const customerRecords = this.groupByCustomer(records);

    // Calculate total events available
    const totalEvents = new Set(records.map(r => r.event_id)).size;

    // Calculate scores for each customer
    const customerScores: CustomerEventEngagement[] = [];

    for (const [customerId, customerData] of customerRecords.entries()) {
      const score = this.calculateCustomerScore(customerId, customerData, totalEvents);
      customerScores.push(score);
    }

    // Sort by engagement score descending
    customerScores.sort((a, b) => b.engagement_score - a.engagement_score);

    // Generate analysis result
    return this.generateAnalysisResult(records, customerScores, totalEvents);
  }

  /**
   * Calculate engagement score for a single customer
   */
  async getCustomerEngagement(
    customerId: string,
    period: 'month' | 'quarter' | 'year' | 'all' = 'all'
  ): Promise<CustomerEventEngagement | null> {
    const records = await this.getCustomerAttendanceRecords(customerId, period);

    if (records.length === 0) {
      return null;
    }

    // Get total events available in period
    const totalEvents = await this.getTotalEventsInPeriod(period);

    // Calculate and return score
    return this.calculateCustomerScore(
      customerId,
      { name: records[0].customer_name, records },
      totalEvents
    );
  }

  /**
   * Get user-level engagement for a customer
   */
  async getUserEngagement(customerId: string): Promise<UserEventEngagement[]> {
    const records = await this.getCustomerAttendanceRecords(customerId, 'all');

    // Group by user
    const userMap = new Map<string, EventAttendanceRecord[]>();

    for (const record of records) {
      const key = record.user_email || record.user_name;
      if (!userMap.has(key)) {
        userMap.set(key, []);
      }
      userMap.get(key)!.push(record);
    }

    // Calculate user engagement
    const userEngagements: UserEventEngagement[] = [];

    for (const [userKey, userRecords] of userMap.entries()) {
      const attendedRecords = userRecords.filter(r => r.attendance_status === 'attended');
      const eventTypes = new Set(attendedRecords.map(r => r.event_type));
      const lastEvent = attendedRecords.sort((a, b) =>
        new Date(b.event_date).getTime() - new Date(a.event_date).getTime()
      )[0];

      // Calculate participation score
      const participationScore = this.calculateParticipationScore(attendedRecords);

      userEngagements.push({
        user_id: userKey,
        user_email: userRecords[0].user_email,
        user_name: userRecords[0].user_name,
        customer_id: customerId,
        customer_name: userRecords[0].customer_name,
        events_attended: attendedRecords.length,
        event_types: Array.from(eventTypes) as EventType[],
        last_event_date: lastEvent?.event_date || null,
        participation_score: participationScore,
        is_active_participant: participationScore >= 70,
      });
    }

    // Sort by events attended
    userEngagements.sort((a, b) => b.events_attended - a.events_attended);

    return userEngagements;
  }

  /**
   * Identify advocacy candidates (high engagement customers)
   */
  async identifyAdvocacyCandidates(
    customerScores: CustomerEventEngagement[]
  ): Promise<AdvocacyCandidate[]> {
    const candidates: AdvocacyCandidate[] = [];

    for (const score of customerScores) {
      if (score.engagement_score >= ADVOCACY_THRESHOLD) {
        // Determine recommended advocacy types based on participation
        const advocacyTypes = this.determineAdvocacyTypes(score);

        // Get customer details for champion contact
        const customerDetails = await this.getCustomerDetails(score.customer_id);

        candidates.push({
          customer_id: score.customer_id,
          customer_name: score.customer_name,
          engagement_score: score.engagement_score,
          events_attended: score.events_attended,
          total_events: score.total_events_available,
          notable_participation: score.notable_participation || [],
          recommended_advocacy_types: advocacyTypes,
          champion_contact: customerDetails?.champion,
          arr: customerDetails?.arr,
          health_score: customerDetails?.health_score,
          reason: this.generateAdvocacyReason(score),
        });
      }
    }

    return candidates;
  }

  /**
   * Detect declining engagement patterns
   */
  async detectDecliningEngagement(
    customerScores: CustomerEventEngagement[],
    previousScores?: Map<string, number>
  ): Promise<DecliningEngagementAlert[]> {
    const alerts: DecliningEngagementAlert[] = [];

    for (const score of customerScores) {
      const previousScore = previousScores?.get(score.customer_id) || score.engagement_score;
      const scoreChange = score.engagement_score - previousScore;

      // Check for declining engagement
      const isDeclining =
        score.trend === 'declining' ||
        scoreChange <= DECLINING_THRESHOLD ||
        score.days_since_last_event > 90;

      if (isDeclining && score.engagement_score < 60) {
        const customerDetails = await this.getCustomerDetails(score.customer_id);

        alerts.push({
          customer_id: score.customer_id,
          customer_name: score.customer_name,
          current_score: score.engagement_score,
          previous_score: previousScore,
          score_change: scoreChange,
          current_period_events: score.events_attended,
          previous_period_events: Math.round(score.events_attended * 1.5), // Estimated
          events_missed: score.total_events_available - score.events_attended,
          last_event_date: score.last_event_date,
          days_since_last_event: score.days_since_last_event,
          risk_level: score.engagement_score < 40 ? 'critical' : 'warning',
          suggested_action: this.generateDecliningAction(score),
          champion_contact: customerDetails?.champion,
        });
      }
    }

    // Sort by risk level and score
    alerts.sort((a, b) => {
      if (a.risk_level === 'critical' && b.risk_level !== 'critical') return -1;
      if (b.risk_level === 'critical' && a.risk_level !== 'critical') return 1;
      return a.current_score - b.current_score;
    });

    return alerts;
  }

  // ============================================
  // Score Calculation Methods
  // ============================================

  private calculateCustomerScore(
    customerId: string,
    data: { name: string; records: EventAttendanceRecord[] },
    totalEvents: number
  ): CustomerEventEngagement {
    const attendedRecords = data.records.filter(r => r.attendance_status === 'attended');

    // Calculate component scores
    const components = this.calculateScoreComponents(attendedRecords, totalEvents);

    // Calculate weighted total score
    const totalScore = Math.round(
      components.event_frequency * SCORE_WEIGHTS.eventFrequency +
      components.event_recency * SCORE_WEIGHTS.eventRecency +
      components.event_diversity * SCORE_WEIGHTS.eventDiversity +
      components.participation_depth * SCORE_WEIGHTS.participationDepth +
      components.consistency * SCORE_WEIGHTS.consistency
    );

    // Determine engagement level
    const engagementLevel = this.getEngagementLevel(totalScore);

    // Determine trend (simplified - would compare to historical in production)
    const trend = this.calculateTrend(attendedRecords);

    // Get unique users
    const uniqueUsers = new Set(attendedRecords.map(r => r.user_email || r.user_name));

    // Get event type breakdown
    const eventTypeBreakdown: Record<EventType, number> = {
      webinar: 0,
      user_group: 0,
      training: 0,
      conference: 0,
      workshop: 0,
      meetup: 0,
      other: 0,
    };
    attendedRecords.forEach(r => {
      eventTypeBreakdown[r.event_type]++;
    });

    // Find last event date
    const sortedRecords = [...attendedRecords].sort((a, b) =>
      new Date(b.event_date).getTime() - new Date(a.event_date).getTime()
    );
    const lastEventDate = sortedRecords[0]?.event_date || null;
    const daysSinceLastEvent = lastEventDate
      ? Math.floor((Date.now() - new Date(lastEventDate).getTime()) / (1000 * 60 * 60 * 24))
      : 999;

    // Notable participation
    const notableParticipation: string[] = [];
    if (attendedRecords.some(r => r.asked_questions)) {
      notableParticipation.push('Active Q&A participant');
    }
    if (attendedRecords.some(r => r.submitted_feedback)) {
      notableParticipation.push('Provides regular feedback');
    }
    if (eventTypeBreakdown.user_group >= 3) {
      notableParticipation.push('User group regular');
    }
    if (components.consistency >= 80) {
      notableParticipation.push('Consistent attendance');
    }

    return {
      customer_id: customerId,
      customer_name: data.name,
      engagement_score: totalScore,
      engagement_level: engagementLevel,
      trend,
      score_components: components,
      total_events_available: totalEvents,
      events_attended: attendedRecords.length,
      attendance_rate: Math.round((attendedRecords.length / totalEvents) * 100),
      unique_users_attending: uniqueUsers.size,
      last_event_date: lastEventDate,
      days_since_last_event: daysSinceLastEvent,
      event_type_breakdown: eventTypeBreakdown,
      notable_participation: notableParticipation,
      calculated_at: new Date().toISOString(),
    };
  }

  private calculateScoreComponents(
    records: EventAttendanceRecord[],
    totalEvents: number
  ): EngagementScoreComponents {
    // Event Frequency Score (30%)
    // Based on attendance rate relative to available events
    const attendanceRate = records.length / Math.max(totalEvents, 1);
    const eventFrequency = Math.min(100, Math.round(attendanceRate * 120)); // 83%+ = 100

    // Event Recency Score (25%)
    // Based on days since last event
    const sortedRecords = [...records].sort((a, b) =>
      new Date(b.event_date).getTime() - new Date(a.event_date).getTime()
    );
    const lastEventDate = sortedRecords[0]?.event_date;
    const daysSinceLastEvent = lastEventDate
      ? Math.floor((Date.now() - new Date(lastEventDate).getTime()) / (1000 * 60 * 60 * 24))
      : 365;

    let eventRecency = 100;
    if (daysSinceLastEvent > 180) eventRecency = 0;
    else if (daysSinceLastEvent > 90) eventRecency = 30;
    else if (daysSinceLastEvent > 60) eventRecency = 50;
    else if (daysSinceLastEvent > 30) eventRecency = 70;
    else if (daysSinceLastEvent > 14) eventRecency = 85;

    // Event Diversity Score (20%)
    // Based on variety of event types attended
    const eventTypes = new Set(records.map(r => r.event_type));
    const eventDiversity = Math.min(100, Math.round((eventTypes.size / 5) * 100)); // 5 types = 100

    // Participation Depth Score (15%)
    const participationDepth = this.calculateParticipationScore(records);

    // Consistency Score (10%)
    // Based on attendance pattern over time
    const consistency = this.calculateConsistencyScore(records);

    return {
      event_frequency: eventFrequency,
      event_recency: eventRecency,
      event_diversity: eventDiversity,
      participation_depth: participationDepth,
      consistency,
    };
  }

  private calculateParticipationScore(records: EventAttendanceRecord[]): number {
    if (records.length === 0) return 0;

    let score = 50; // Base score for attendance

    // Q&A participation
    const askedQuestions = records.filter(r => r.asked_questions).length;
    score += Math.min(25, (askedQuestions / records.length) * 50);

    // Feedback submission
    const submittedFeedback = records.filter(r => r.submitted_feedback).length;
    score += Math.min(25, (submittedFeedback / records.length) * 50);

    return Math.round(Math.min(100, score));
  }

  private calculateConsistencyScore(records: EventAttendanceRecord[]): number {
    if (records.length < 2) return 50;

    // Group by month
    const monthlyAttendance = new Map<string, number>();

    records.forEach(r => {
      const month = r.event_date.substring(0, 7); // YYYY-MM
      monthlyAttendance.set(month, (monthlyAttendance.get(month) || 0) + 1);
    });

    // Calculate variance
    const values = Array.from(monthlyAttendance.values());
    const avg = values.reduce((a, b) => a + b, 0) / values.length;
    const variance = values.reduce((sum, v) => sum + Math.pow(v - avg, 2), 0) / values.length;
    const stdDev = Math.sqrt(variance);

    // Lower variance = higher consistency
    const consistencyScore = Math.max(0, 100 - stdDev * 20);

    return Math.round(consistencyScore);
  }

  private calculateTrend(records: EventAttendanceRecord[]): EngagementTrendDirection {
    if (records.length < 4) return 'stable';

    // Split records into two halves by date
    const sorted = [...records].sort((a, b) =>
      new Date(a.event_date).getTime() - new Date(b.event_date).getTime()
    );

    const midpoint = Math.floor(sorted.length / 2);
    const firstHalf = sorted.slice(0, midpoint);
    const secondHalf = sorted.slice(midpoint);

    const firstHalfRate = firstHalf.length / midpoint;
    const secondHalfRate = secondHalf.length / (sorted.length - midpoint);

    const difference = secondHalfRate - firstHalfRate;

    if (difference > 0.15) return 'rising';
    if (difference < -0.15) return 'declining';
    return 'stable';
  }

  private getEngagementLevel(score: number): EngagementLevel {
    if (score >= ENGAGEMENT_THRESHOLDS.high) return 'high';
    if (score >= ENGAGEMENT_THRESHOLDS.good) return 'good';
    if (score >= ENGAGEMENT_THRESHOLDS.medium) return 'medium';
    return 'low';
  }

  // ============================================
  // Analysis Result Generation
  // ============================================

  private async generateAnalysisResult(
    records: EventAttendanceRecord[],
    customerScores: CustomerEventEngagement[],
    totalEvents: number
  ): Promise<EngagementAnalysisResult> {
    // Calculate summary stats
    const uniqueUsers = new Set(records.map(r => r.user_email || r.user_name));
    const uniqueCustomers = new Set(records.map(r => r.customer_id || r.customer_name));

    // Date range
    const dates = records
      .map(r => new Date(r.event_date))
      .filter(d => !isNaN(d.getTime()))
      .sort((a, b) => a.getTime() - b.getTime());

    // Event type summary
    const eventSummaryMap = new Map<EventType, EventSummary>();
    records.forEach(r => {
      if (!eventSummaryMap.has(r.event_type)) {
        eventSummaryMap.set(r.event_type, {
          event_type: r.event_type,
          event_count: 0,
          total_attendees: 0,
          avg_attendance: 0,
          unique_customers: 0,
        });
      }
      const summary = eventSummaryMap.get(r.event_type)!;
      if (r.attendance_status === 'attended') {
        summary.total_attendees++;
      }
    });

    // Count events per type
    const eventsByType = new Map<EventType, Set<string>>();
    records.forEach(r => {
      if (!eventsByType.has(r.event_type)) {
        eventsByType.set(r.event_type, new Set());
      }
      eventsByType.get(r.event_type)!.add(r.event_id);
    });

    // Update event counts
    eventsByType.forEach((events, type) => {
      const summary = eventSummaryMap.get(type)!;
      summary.event_count = events.size;
      summary.avg_attendance = Math.round(summary.total_attendees / events.size);
    });

    // Calculate engagement distribution
    const distribution = {
      high: { count: 0, percent: 0 },
      good: { count: 0, percent: 0 },
      medium: { count: 0, percent: 0 },
      low: { count: 0, percent: 0 },
    };

    customerScores.forEach(s => {
      distribution[s.engagement_level].count++;
    });

    const totalCustomers = customerScores.length;
    Object.keys(distribution).forEach(key => {
      const k = key as EngagementLevel;
      distribution[k].percent = Math.round((distribution[k].count / totalCustomers) * 100);
    });

    // Identify advocacy candidates
    const advocacyCandidates = await this.identifyAdvocacyCandidates(customerScores);

    // Detect declining engagement
    const decliningEngagement = await this.detectDecliningEngagement(customerScores);

    // Generate recommendations (placeholder - would integrate with event recommender)
    const recommendations: EngagementAnalysisResult['recommendations'] = [];

    return {
      summary: {
        total_records: records.length,
        unique_users: uniqueUsers.size,
        unique_customers: uniqueCustomers.size,
        total_events: totalEvents,
        date_range: {
          start: dates[0]?.toISOString().split('T')[0] || '',
          end: dates[dates.length - 1]?.toISOString().split('T')[0] || '',
        },
      },
      event_summary: Array.from(eventSummaryMap.values()),
      engagement_distribution: distribution,
      leaderboard: customerScores.slice(0, 20), // Top 20
      advocacy_candidates: advocacyCandidates,
      declining_engagement: decliningEngagement,
      recommendations,
    };
  }

  private getEmptyResult(): EngagementAnalysisResult {
    return {
      summary: {
        total_records: 0,
        unique_users: 0,
        unique_customers: 0,
        total_events: 0,
        date_range: { start: '', end: '' },
      },
      event_summary: [],
      engagement_distribution: {
        high: { count: 0, percent: 0 },
        good: { count: 0, percent: 0 },
        medium: { count: 0, percent: 0 },
        low: { count: 0, percent: 0 },
      },
      leaderboard: [],
      advocacy_candidates: [],
      declining_engagement: [],
      recommendations: [],
    };
  }

  // ============================================
  // Helper Methods
  // ============================================

  private async getAttendanceRecords(
    fileId: string,
    period: string
  ): Promise<EventAttendanceRecord[]> {
    if (!supabase) {
      // Return mock data for testing
      return this.getMockAttendanceRecords();
    }

    let query = supabase
      .from('event_attendance')
      .select('*')
      .eq('file_id', fileId);

    // Apply period filter
    if (period !== 'all') {
      const periodStart = this.getPeriodStartDate(period);
      query = query.gte('event_date', periodStart.toISOString());
    }

    const { data, error } = await query;

    if (error) {
      console.error('Error fetching attendance records:', error);
      return [];
    }

    return data || [];
  }

  private async getCustomerAttendanceRecords(
    customerId: string,
    period: string
  ): Promise<EventAttendanceRecord[]> {
    if (!supabase) {
      return this.getMockAttendanceRecords().filter(r => r.customer_id === customerId);
    }

    let query = supabase
      .from('event_attendance')
      .select('*')
      .eq('customer_id', customerId);

    if (period !== 'all') {
      const periodStart = this.getPeriodStartDate(period);
      query = query.gte('event_date', periodStart.toISOString());
    }

    const { data, error } = await query;

    if (error) {
      console.error('Error fetching customer attendance records:', error);
      return [];
    }

    return data || [];
  }

  private async getTotalEventsInPeriod(period: string): Promise<number> {
    if (!supabase) return 18; // Mock value

    const periodStart = this.getPeriodStartDate(period);

    const { count, error } = await supabase
      .from('event_attendance')
      .select('event_id', { count: 'exact', head: true })
      .gte('event_date', periodStart.toISOString());

    return count || 0;
  }

  private getPeriodStartDate(period: string): Date {
    const now = new Date();
    switch (period) {
      case 'month':
        return new Date(now.getFullYear(), now.getMonth() - 1, now.getDate());
      case 'quarter':
        return new Date(now.getFullYear(), now.getMonth() - 3, now.getDate());
      case 'year':
        return new Date(now.getFullYear() - 1, now.getMonth(), now.getDate());
      default:
        return new Date(0);
    }
  }

  private groupByCustomer(
    records: EventAttendanceRecord[]
  ): Map<string, { name: string; records: EventAttendanceRecord[] }> {
    const customerMap = new Map<string, { name: string; records: EventAttendanceRecord[] }>();

    for (const record of records) {
      const key = record.customer_id || record.customer_name;
      if (!customerMap.has(key)) {
        customerMap.set(key, { name: record.customer_name, records: [] });
      }
      customerMap.get(key)!.records.push(record);
    }

    return customerMap;
  }

  private async getCustomerDetails(
    customerId: string
  ): Promise<{ champion?: { name: string; email: string; role?: string }; arr?: number; health_score?: number } | null> {
    if (!supabase) {
      // Return mock data
      return {
        champion: { name: 'John Smith', email: 'john@company.com', role: 'VP Engineering' },
        arr: 150000,
        health_score: 85,
      };
    }

    const { data: customer } = await supabase
      .from('customers')
      .select('name, arr, health_score')
      .eq('id', customerId)
      .single();

    const { data: stakeholder } = await supabase
      .from('stakeholders')
      .select('name, email, role')
      .eq('customer_id', customerId)
      .eq('is_champion', true)
      .single();

    return {
      champion: stakeholder ? {
        name: stakeholder.name,
        email: stakeholder.email,
        role: stakeholder.role,
      } : undefined,
      arr: customer?.arr,
      health_score: customer?.health_score,
    };
  }

  private determineAdvocacyTypes(score: CustomerEventEngagement): AdvocacyType[] {
    const types: AdvocacyType[] = [];

    // High overall engagement = reference candidate
    if (score.engagement_score >= 90) {
      types.push('reference');
      types.push('case_study');
    }

    // Active Q&A participant = speaking opportunity
    if (score.notable_participation?.includes('Active Q&A participant')) {
      types.push('speaking');
    }

    // User group regular = advisory board
    if (score.notable_participation?.includes('User group regular')) {
      types.push('advisory_board');
    }

    // Consistent attendance = beta tester
    if (score.notable_participation?.includes('Consistent attendance')) {
      types.push('beta_tester');
    }

    // Default to reference if no specific type
    if (types.length === 0) {
      types.push('reference');
    }

    return types;
  }

  private generateAdvocacyReason(score: CustomerEventEngagement): string {
    const reasons: string[] = [];

    reasons.push(`Engagement score: ${score.engagement_score}/100`);
    reasons.push(`Attended ${score.events_attended}/${score.total_events_available} events`);

    if (score.notable_participation && score.notable_participation.length > 0) {
      reasons.push(score.notable_participation.join(', '));
    }

    return reasons.join('. ');
  }

  private generateDecliningAction(score: CustomerEventEngagement): string {
    if (score.days_since_last_event > 90) {
      return 'Schedule check-in call - customer has not attended events in 90+ days';
    }

    if (score.engagement_level === 'low') {
      return 'Personal outreach required - engagement significantly declined';
    }

    return 'Send personalized event invitation with relevant content';
  }

  private getMockAttendanceRecords(): EventAttendanceRecord[] {
    // Generate mock data for testing
    const customers = [
      { id: 'cust-1', name: 'TechCorp' },
      { id: 'cust-2', name: 'DataPro' },
      { id: 'cust-3', name: 'CloudMax' },
      { id: 'cust-4', name: 'Acme Corp' },
      { id: 'cust-5', name: 'BetaInc' },
      { id: 'cust-6', name: 'OldCorp' },
      { id: 'cust-7', name: 'SmallBiz' },
      { id: 'cust-8', name: 'LegacyCo' },
    ];

    const events = [
      { id: 'evt-1', name: 'Product Webinar Q1', type: 'webinar' as EventType },
      { id: 'evt-2', name: 'User Group Meeting', type: 'user_group' as EventType },
      { id: 'evt-3', name: 'Advanced Training', type: 'training' as EventType },
      { id: 'evt-4', name: 'Annual Conference', type: 'conference' as EventType },
    ];

    const records: EventAttendanceRecord[] = [];
    const now = new Date();

    // High engagement customers (TechCorp, DataPro, CloudMax)
    [0, 1, 2].forEach(custIdx => {
      events.forEach((event, evtIdx) => {
        records.push({
          id: `rec-${custIdx}-${evtIdx}`,
          event_id: event.id,
          event_name: event.name,
          event_type: event.type,
          event_date: new Date(now.getTime() - (30 + evtIdx * 30) * 24 * 60 * 60 * 1000).toISOString(),
          customer_id: customers[custIdx].id,
          customer_name: customers[custIdx].name,
          user_email: `user@${customers[custIdx].name.toLowerCase()}.com`,
          user_name: 'Test User',
          attendance_status: 'attended',
          asked_questions: custIdx === 0,
          submitted_feedback: custIdx <= 1,
          created_at: new Date().toISOString(),
        });
      });
    });

    // Medium engagement customers
    [3, 4].forEach(custIdx => {
      [0, 2].forEach(evtIdx => {
        records.push({
          id: `rec-${custIdx}-${evtIdx}`,
          event_id: events[evtIdx].id,
          event_name: events[evtIdx].name,
          event_type: events[evtIdx].type,
          event_date: new Date(now.getTime() - (45 + evtIdx * 30) * 24 * 60 * 60 * 1000).toISOString(),
          customer_id: customers[custIdx].id,
          customer_name: customers[custIdx].name,
          user_email: `user@${customers[custIdx].name.toLowerCase()}.com`,
          user_name: 'Test User',
          attendance_status: 'attended',
          asked_questions: false,
          submitted_feedback: false,
          created_at: new Date().toISOString(),
        });
      });
    });

    // Low engagement (declining) customers
    [5, 6, 7].forEach(custIdx => {
      records.push({
        id: `rec-${custIdx}-0`,
        event_id: events[0].id,
        event_name: events[0].name,
        event_type: events[0].type,
        event_date: new Date(now.getTime() - 180 * 24 * 60 * 60 * 1000).toISOString(),
        customer_id: customers[custIdx].id,
        customer_name: customers[custIdx].name,
        user_email: `user@${customers[custIdx].name.toLowerCase()}.com`,
        user_name: 'Test User',
        attendance_status: 'attended',
        asked_questions: false,
        submitted_feedback: false,
        created_at: new Date().toISOString(),
      });
    });

    return records;
  }
}

// Export singleton instance
export const engagementScorer = new EngagementScorerService();
export default engagementScorer;
