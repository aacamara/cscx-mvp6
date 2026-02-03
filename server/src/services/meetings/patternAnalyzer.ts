/**
 * Meeting Pattern Analyzer Service
 * PRD-036: Meeting Request Optimizer
 *
 * Analyzes historical meeting data to identify patterns and preferences
 * for optimal meeting scheduling.
 */

import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { config } from '../../config/index.js';

// Types
export interface MeetingPatternAnalysis {
  customerId: string;
  stakeholderId?: string;
  stakeholderName?: string;
  stakeholderTimezone?: string;
  totalMeetings: number;
  acceptanceRate: number;
  avgResponseTimeHours: number;
  bestDays: DayPreference[];
  bestTimes: TimePreference[];
  preferredDuration: number;
  preferredFormat: 'video' | 'phone' | 'in_person';
  lastMeetingAt?: Date;
  daysSinceLastMeeting?: number;
  successfulSubjects: string[];
  confidence: number;
}

export interface DayPreference {
  day: string;
  dayIndex: number; // 0=Sunday
  acceptanceRate: number;
  meetingCount: number;
}

export interface TimePreference {
  hour: number;
  displayTime: string;
  acceptanceRate: number;
  meetingCount: number;
}

export interface StakeholderPreferences {
  stakeholderId: string;
  customerId: string;
  timezone: string;
  preferredDays: string[];
  preferredTimeStart: string;
  preferredTimeEnd: string;
  preferredDurationMinutes: number;
  preferredFormat: 'video' | 'phone' | 'in_person';
  avoidDays: string[];
  avoidTimes: Array<{ day: string; start: string; end: string; reason?: string }>;
  notes?: string;
  confidenceScore: number;
  lastUpdatedFrom: 'manual' | 'auto_learned' | 'stated';
}

export interface MeetingHistoryEntry {
  id: string;
  customerId: string;
  stakeholderId?: string;
  scheduledAt: Date;
  dayOfWeek: number;
  hourOfDay: number;
  duration: number;
  format: 'video' | 'phone' | 'in_person';
  status: 'accepted' | 'declined' | 'rescheduled' | 'cancelled' | 'no_response';
  responseTimeHours?: number;
  subject?: string;
}

const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

export class MeetingPatternAnalyzer {
  private supabase: SupabaseClient | null = null;

  constructor() {
    if (config.supabaseUrl && config.supabaseServiceKey) {
      this.supabase = createClient(config.supabaseUrl, config.supabaseServiceKey);
    }
  }

  /**
   * Analyze meeting patterns for a customer/stakeholder
   */
  async analyzeMeetingPatterns(
    customerId: string,
    stakeholderId?: string
  ): Promise<MeetingPatternAnalysis> {
    // Get cached patterns from database
    const cachedPatterns = await this.getCachedPatterns(customerId, stakeholderId);

    // Get stakeholder info
    const stakeholderInfo = stakeholderId
      ? await this.getStakeholderInfo(stakeholderId)
      : null;

    // If we have recent cached patterns (less than 24 hours old), use them
    if (cachedPatterns && this.isCacheValid(cachedPatterns.lastCalculatedAt)) {
      return this.transformCachedToAnalysis(cachedPatterns, stakeholderInfo);
    }

    // Otherwise, recalculate from meeting history
    const meetingHistory = await this.getMeetingHistory(customerId, stakeholderId);
    const analysis = this.calculatePatterns(meetingHistory, customerId, stakeholderId);

    // Add stakeholder info
    if (stakeholderInfo) {
      analysis.stakeholderName = stakeholderInfo.name;
      analysis.stakeholderTimezone = stakeholderInfo.timezone;
    }

    // Cache the results
    await this.cachePatterns(analysis);

    return analysis;
  }

  /**
   * Get stakeholder scheduling preferences
   */
  async getStakeholderPreferences(stakeholderId: string): Promise<StakeholderPreferences | null> {
    if (!this.supabase) {
      return this.getDefaultPreferences(stakeholderId, 'unknown');
    }

    const { data, error } = await this.supabase
      .from('stakeholder_preferences')
      .select('*')
      .eq('stakeholder_id', stakeholderId)
      .single();

    if (error || !data) {
      // Try to infer from meeting patterns
      const patterns = await this.getCachedPatterns(data?.customer_id, stakeholderId);
      if (patterns) {
        return this.inferPreferencesFromPatterns(patterns, stakeholderId);
      }
      return null;
    }

    return {
      stakeholderId: data.stakeholder_id,
      customerId: data.customer_id,
      timezone: data.timezone || 'America/New_York',
      preferredDays: data.preferred_days || ['tuesday', 'wednesday', 'thursday'],
      preferredTimeStart: data.preferred_time_start || '09:00',
      preferredTimeEnd: data.preferred_time_end || '17:00',
      preferredDurationMinutes: data.preferred_duration_minutes || 30,
      preferredFormat: data.preferred_format || 'video',
      avoidDays: data.avoid_days || [],
      avoidTimes: data.avoid_times || [],
      notes: data.notes,
      confidenceScore: data.confidence_score || 0.5,
      lastUpdatedFrom: data.last_updated_from || 'auto_learned',
    };
  }

  /**
   * Update stakeholder preferences (manual or learned)
   */
  async updateStakeholderPreferences(
    stakeholderId: string,
    customerId: string,
    updates: Partial<StakeholderPreferences>,
    source: 'manual' | 'auto_learned' | 'stated' = 'manual'
  ): Promise<void> {
    if (!this.supabase) return;

    const { error } = await this.supabase
      .from('stakeholder_preferences')
      .upsert({
        stakeholder_id: stakeholderId,
        customer_id: customerId,
        timezone: updates.timezone,
        preferred_days: updates.preferredDays,
        preferred_time_start: updates.preferredTimeStart,
        preferred_time_end: updates.preferredTimeEnd,
        preferred_duration_minutes: updates.preferredDurationMinutes,
        preferred_format: updates.preferredFormat,
        avoid_days: updates.avoidDays,
        avoid_times: updates.avoidTimes,
        notes: updates.notes,
        confidence_score: updates.confidenceScore,
        last_updated_from: source,
        updated_at: new Date().toISOString(),
      }, {
        onConflict: 'stakeholder_id',
      });

    if (error) {
      console.error('Failed to update stakeholder preferences:', error);
    }
  }

  /**
   * Record a meeting request outcome for learning
   */
  async recordMeetingOutcome(
    requestId: string,
    outcome: 'accepted' | 'declined' | 'rescheduled' | 'cancelled' | 'no_response',
    responseTimeHours?: number,
    acceptedTime?: { date: string; time: string }
  ): Promise<void> {
    if (!this.supabase) return;

    // Update the meeting request
    const { error } = await this.supabase
      .from('meeting_requests')
      .update({
        status: outcome,
        response_at: new Date().toISOString(),
        response_time_hours: responseTimeHours,
        accepted_time: acceptedTime,
        updated_at: new Date().toISOString(),
      })
      .eq('id', requestId);

    if (error) {
      console.error('Failed to record meeting outcome:', error);
      return;
    }

    // Get request details to update patterns
    const { data: request } = await this.supabase
      .from('meeting_requests')
      .select('customer_id, stakeholder_id, proposed_times, optimization_data')
      .eq('id', requestId)
      .single();

    if (request) {
      await this.updatePatternsFromOutcome(
        request.customer_id,
        request.stakeholder_id,
        outcome,
        responseTimeHours,
        acceptedTime
      );
    }
  }

  /**
   * Learn preferences from a meeting response
   */
  async learnFromResponse(
    customerId: string,
    stakeholderId: string | undefined,
    acceptedDay: number,
    acceptedHour: number,
    acceptedDuration: number,
    format: 'video' | 'phone' | 'in_person'
  ): Promise<void> {
    // Update meeting patterns with this new data point
    await this.incrementPatternData(
      customerId,
      stakeholderId,
      acceptedDay,
      acceptedHour,
      acceptedDuration,
      format,
      true // accepted
    );

    // Update stakeholder preferences if confidence is high enough
    if (stakeholderId) {
      const patterns = await this.getCachedPatterns(customerId, stakeholderId);
      if (patterns && patterns.total_meetings >= 5) {
        const inferred = this.inferPreferencesFromPatterns(patterns, stakeholderId);
        if (inferred && inferred.confidenceScore >= 0.7) {
          await this.updateStakeholderPreferences(
            stakeholderId,
            customerId,
            inferred,
            'auto_learned'
          );
        }
      }
    }
  }

  // ==================== Private Methods ====================

  private async getCachedPatterns(
    customerId: string,
    stakeholderId?: string
  ): Promise<any | null> {
    if (!this.supabase) return null;

    let query = this.supabase
      .from('meeting_patterns')
      .select('*')
      .eq('customer_id', customerId);

    if (stakeholderId) {
      query = query.eq('stakeholder_id', stakeholderId);
    } else {
      query = query.is('stakeholder_id', null);
    }

    const { data, error } = await query.single();

    if (error || !data) return null;

    return {
      ...data,
      lastCalculatedAt: new Date(data.last_calculated_at),
    };
  }

  private isCacheValid(lastCalculated: Date): boolean {
    const cacheMaxAge = 24 * 60 * 60 * 1000; // 24 hours
    return Date.now() - lastCalculated.getTime() < cacheMaxAge;
  }

  private async getMeetingHistory(
    customerId: string,
    stakeholderId?: string
  ): Promise<MeetingHistoryEntry[]> {
    if (!this.supabase) {
      return this.getMockMeetingHistory(customerId);
    }

    // Get from meeting_requests table
    let query = this.supabase
      .from('meeting_requests')
      .select('*')
      .eq('customer_id', customerId)
      .in('status', ['accepted', 'declined', 'rescheduled']);

    if (stakeholderId) {
      query = query.eq('stakeholder_id', stakeholderId);
    }

    const { data: requests, error } = await query
      .order('sent_at', { ascending: false })
      .limit(100);

    if (error || !requests) return [];

    // Also get from calendar events if available
    const { data: calendarEvents } = await this.supabase
      .from('calendar_events')
      .select('*')
      .eq('customer_id', customerId)
      .order('start_time', { ascending: false })
      .limit(100);

    const history: MeetingHistoryEntry[] = [];

    // Transform meeting requests
    for (const req of requests || []) {
      if (req.accepted_time) {
        const acceptedDate = new Date(`${req.accepted_time.date}T${req.accepted_time.time}`);
        history.push({
          id: req.id,
          customerId: req.customer_id,
          stakeholderId: req.stakeholder_id,
          scheduledAt: acceptedDate,
          dayOfWeek: acceptedDate.getDay(),
          hourOfDay: acceptedDate.getHours(),
          duration: req.suggested_duration || 30,
          format: req.suggested_format || 'video',
          status: req.status,
          responseTimeHours: req.response_time_hours,
          subject: req.subject,
        });
      }
    }

    // Transform calendar events
    for (const event of calendarEvents || []) {
      const startTime = new Date(event.start_time);
      const endTime = new Date(event.end_time);
      const duration = Math.round((endTime.getTime() - startTime.getTime()) / (1000 * 60));

      history.push({
        id: event.id,
        customerId: event.customer_id,
        stakeholderId: undefined,
        scheduledAt: startTime,
        dayOfWeek: startTime.getDay(),
        hourOfDay: startTime.getHours(),
        duration,
        format: event.meet_link ? 'video' : 'phone',
        status: event.response_status === 'accepted' ? 'accepted' :
                event.response_status === 'declined' ? 'declined' : 'accepted',
        subject: event.title,
      });
    }

    // Sort by date and deduplicate
    return history
      .sort((a, b) => b.scheduledAt.getTime() - a.scheduledAt.getTime())
      .slice(0, 100);
  }

  private getMockMeetingHistory(customerId: string): MeetingHistoryEntry[] {
    // Generate realistic mock history for demo
    const history: MeetingHistoryEntry[] = [];
    const now = Date.now();

    for (let i = 0; i < 15; i++) {
      // Bias toward Tuesday/Wednesday/Thursday mornings
      const daysAgo = Math.floor(Math.random() * 180); // Last 6 months
      const dayOfWeek = Math.random() > 0.3
        ? [2, 3, 4][Math.floor(Math.random() * 3)] // Tue/Wed/Thu
        : Math.floor(Math.random() * 7);
      const hourOfDay = Math.random() > 0.3
        ? [9, 10, 11, 14, 15][Math.floor(Math.random() * 5)] // Morning/early afternoon
        : Math.floor(Math.random() * 9) + 8; // 8am-5pm

      const scheduledAt = new Date(now - daysAgo * 24 * 60 * 60 * 1000);
      scheduledAt.setHours(hourOfDay, 0, 0, 0);

      history.push({
        id: `mock_${i}`,
        customerId,
        scheduledAt,
        dayOfWeek,
        hourOfDay,
        duration: [30, 30, 30, 45, 60][Math.floor(Math.random() * 5)],
        format: 'video',
        status: Math.random() > 0.15 ? 'accepted' : 'declined',
        responseTimeHours: Math.random() * 48 + 2,
        subject: ['Quick Sync', 'Check-in Call', 'Product Review', 'QBR Prep'][Math.floor(Math.random() * 4)],
      });
    }

    return history;
  }

  private calculatePatterns(
    history: MeetingHistoryEntry[],
    customerId: string,
    stakeholderId?: string
  ): MeetingPatternAnalysis {
    if (history.length === 0) {
      return this.getDefaultAnalysis(customerId, stakeholderId);
    }

    // Calculate day of week acceptance rates
    const dayStats: Record<number, { accepted: number; total: number }> = {};
    const hourStats: Record<number, { accepted: number; total: number }> = {};
    const durationStats: Record<number, number> = {};
    const formatStats: Record<string, number> = {};
    const subjectSuccess: Record<string, { accepted: number; total: number }> = {};

    let totalResponseTime = 0;
    let responseCount = 0;
    let lastMeetingAt: Date | undefined;

    for (const meeting of history) {
      // Day stats
      if (!dayStats[meeting.dayOfWeek]) {
        dayStats[meeting.dayOfWeek] = { accepted: 0, total: 0 };
      }
      dayStats[meeting.dayOfWeek].total++;
      if (meeting.status === 'accepted') {
        dayStats[meeting.dayOfWeek].accepted++;
      }

      // Hour stats
      if (!hourStats[meeting.hourOfDay]) {
        hourStats[meeting.hourOfDay] = { accepted: 0, total: 0 };
      }
      hourStats[meeting.hourOfDay].total++;
      if (meeting.status === 'accepted') {
        hourStats[meeting.hourOfDay].accepted++;
      }

      // Duration stats
      if (meeting.status === 'accepted') {
        durationStats[meeting.duration] = (durationStats[meeting.duration] || 0) + 1;
      }

      // Format stats
      if (meeting.status === 'accepted') {
        formatStats[meeting.format] = (formatStats[meeting.format] || 0) + 1;
      }

      // Response time
      if (meeting.responseTimeHours !== undefined) {
        totalResponseTime += meeting.responseTimeHours;
        responseCount++;
      }

      // Subject success
      if (meeting.subject) {
        if (!subjectSuccess[meeting.subject]) {
          subjectSuccess[meeting.subject] = { accepted: 0, total: 0 };
        }
        subjectSuccess[meeting.subject].total++;
        if (meeting.status === 'accepted') {
          subjectSuccess[meeting.subject].accepted++;
        }
      }

      // Track last meeting
      if (!lastMeetingAt || meeting.scheduledAt > lastMeetingAt) {
        lastMeetingAt = meeting.scheduledAt;
      }
    }

    // Calculate best days
    const bestDays: DayPreference[] = Object.entries(dayStats)
      .map(([day, stats]) => ({
        day: DAY_NAMES[parseInt(day)],
        dayIndex: parseInt(day),
        acceptanceRate: stats.total > 0 ? stats.accepted / stats.total : 0,
        meetingCount: stats.total,
      }))
      .sort((a, b) => b.acceptanceRate - a.acceptanceRate);

    // Calculate best times
    const bestTimes: TimePreference[] = Object.entries(hourStats)
      .map(([hour, stats]) => ({
        hour: parseInt(hour),
        displayTime: `${parseInt(hour).toString().padStart(2, '0')}:00`,
        acceptanceRate: stats.total > 0 ? stats.accepted / stats.total : 0,
        meetingCount: stats.total,
      }))
      .sort((a, b) => b.acceptanceRate - a.acceptanceRate);

    // Find preferred duration
    const preferredDuration = Object.entries(durationStats)
      .sort((a, b) => b[1] - a[1])[0]?.[0] || '30';

    // Find preferred format
    const preferredFormat = Object.entries(formatStats)
      .sort((a, b) => b[1] - a[1])[0]?.[0] as 'video' | 'phone' | 'in_person' || 'video';

    // Find successful subjects
    const successfulSubjects = Object.entries(subjectSuccess)
      .filter(([_, stats]) => stats.total >= 2 && (stats.accepted / stats.total) >= 0.7)
      .sort((a, b) => (b[1].accepted / b[1].total) - (a[1].accepted / a[1].total))
      .slice(0, 5)
      .map(([subject]) => subject);

    // Calculate totals
    const totalMeetings = history.length;
    const acceptedMeetings = history.filter(m => m.status === 'accepted').length;
    const acceptanceRate = totalMeetings > 0 ? acceptedMeetings / totalMeetings : 0;
    const avgResponseTimeHours = responseCount > 0 ? totalResponseTime / responseCount : 24;

    // Calculate confidence based on data quantity
    const confidence = Math.min(1, totalMeetings / 20); // Max confidence at 20+ meetings

    return {
      customerId,
      stakeholderId,
      totalMeetings,
      acceptanceRate,
      avgResponseTimeHours,
      bestDays,
      bestTimes,
      preferredDuration: parseInt(preferredDuration),
      preferredFormat,
      lastMeetingAt,
      daysSinceLastMeeting: lastMeetingAt
        ? Math.floor((Date.now() - lastMeetingAt.getTime()) / (1000 * 60 * 60 * 24))
        : undefined,
      successfulSubjects,
      confidence,
    };
  }

  private getDefaultAnalysis(customerId: string, stakeholderId?: string): MeetingPatternAnalysis {
    return {
      customerId,
      stakeholderId,
      totalMeetings: 0,
      acceptanceRate: 0.7, // Default assumption
      avgResponseTimeHours: 24,
      bestDays: [
        { day: 'Tuesday', dayIndex: 2, acceptanceRate: 0.85, meetingCount: 0 },
        { day: 'Wednesday', dayIndex: 3, acceptanceRate: 0.83, meetingCount: 0 },
        { day: 'Thursday', dayIndex: 4, acceptanceRate: 0.80, meetingCount: 0 },
      ],
      bestTimes: [
        { hour: 10, displayTime: '10:00', acceptanceRate: 0.85, meetingCount: 0 },
        { hour: 14, displayTime: '14:00', acceptanceRate: 0.82, meetingCount: 0 },
        { hour: 11, displayTime: '11:00', acceptanceRate: 0.80, meetingCount: 0 },
      ],
      preferredDuration: 30,
      preferredFormat: 'video',
      successfulSubjects: ['Quick Sync', '30-min Check-in'],
      confidence: 0,
    };
  }

  private transformCachedToAnalysis(
    cached: any,
    stakeholderInfo?: { name: string; timezone: string } | null
  ): MeetingPatternAnalysis {
    const dayRates = cached.day_acceptance_rates || {};
    const hourRates = cached.hour_acceptance_rates || {};

    const bestDays: DayPreference[] = Object.entries(dayRates)
      .map(([day, rate]) => ({
        day: DAY_NAMES[parseInt(day)],
        dayIndex: parseInt(day),
        acceptanceRate: rate as number,
        meetingCount: cached.total_meetings || 0,
      }))
      .sort((a, b) => b.acceptanceRate - a.acceptanceRate);

    const bestTimes: TimePreference[] = Object.entries(hourRates)
      .map(([hour, rate]) => ({
        hour: parseInt(hour),
        displayTime: `${parseInt(hour).toString().padStart(2, '0')}:00`,
        acceptanceRate: rate as number,
        meetingCount: cached.total_meetings || 0,
      }))
      .sort((a, b) => b.acceptanceRate - a.acceptanceRate);

    const formatPrefs = cached.format_preferences || {};
    const preferredFormat = Object.entries(formatPrefs)
      .sort((a, b) => (b[1] as number) - (a[1] as number))[0]?.[0] as 'video' | 'phone' | 'in_person' || 'video';

    const durationPrefs = cached.duration_preferences || {};
    const preferredDuration = parseInt(
      Object.entries(durationPrefs)
        .sort((a, b) => (b[1] as number) - (a[1] as number))[0]?.[0] || '30'
    );

    return {
      customerId: cached.customer_id,
      stakeholderId: cached.stakeholder_id,
      stakeholderName: stakeholderInfo?.name,
      stakeholderTimezone: stakeholderInfo?.timezone,
      totalMeetings: cached.total_meetings || 0,
      acceptanceRate: cached.accepted_meetings && cached.total_meetings
        ? cached.accepted_meetings / cached.total_meetings
        : 0.7,
      avgResponseTimeHours: cached.avg_response_time_hours || 24,
      bestDays: bestDays.length > 0 ? bestDays : this.getDefaultAnalysis('', '').bestDays,
      bestTimes: bestTimes.length > 0 ? bestTimes : this.getDefaultAnalysis('', '').bestTimes,
      preferredDuration,
      preferredFormat,
      lastMeetingAt: cached.last_meeting_at ? new Date(cached.last_meeting_at) : undefined,
      daysSinceLastMeeting: cached.last_meeting_at
        ? Math.floor((Date.now() - new Date(cached.last_meeting_at).getTime()) / (1000 * 60 * 60 * 24))
        : undefined,
      successfulSubjects: cached.successful_subjects || [],
      confidence: Math.min(1, (cached.total_meetings || 0) / 20),
    };
  }

  private async getStakeholderInfo(stakeholderId: string): Promise<{ name: string; timezone: string } | null> {
    if (!this.supabase) return null;

    const { data, error } = await this.supabase
      .from('stakeholders')
      .select('name, timezone')
      .eq('id', stakeholderId)
      .single();

    if (error || !data) return null;

    return {
      name: data.name,
      timezone: data.timezone || 'America/New_York',
    };
  }

  private getDefaultPreferences(stakeholderId: string, customerId: string): StakeholderPreferences {
    return {
      stakeholderId,
      customerId,
      timezone: 'America/New_York',
      preferredDays: ['tuesday', 'wednesday', 'thursday'],
      preferredTimeStart: '09:00',
      preferredTimeEnd: '17:00',
      preferredDurationMinutes: 30,
      preferredFormat: 'video',
      avoidDays: [],
      avoidTimes: [],
      confidenceScore: 0.3,
      lastUpdatedFrom: 'auto_learned',
    };
  }

  private inferPreferencesFromPatterns(patterns: any, stakeholderId: string): StakeholderPreferences {
    const dayRates = patterns.day_acceptance_rates || {};
    const hourRates = patterns.hour_acceptance_rates || {};
    const durationPrefs = patterns.duration_preferences || {};
    const formatPrefs = patterns.format_preferences || {};

    // Get top 3 days
    const preferredDays = Object.entries(dayRates)
      .sort((a, b) => (b[1] as number) - (a[1] as number))
      .slice(0, 3)
      .map(([day]) => DAY_NAMES[parseInt(day)].toLowerCase());

    // Get time range from best hours
    const topHours = Object.entries(hourRates)
      .sort((a, b) => (b[1] as number) - (a[1] as number))
      .slice(0, 5)
      .map(([hour]) => parseInt(hour));

    const preferredTimeStart = topHours.length > 0
      ? `${Math.min(...topHours).toString().padStart(2, '0')}:00`
      : '09:00';
    const preferredTimeEnd = topHours.length > 0
      ? `${(Math.max(...topHours) + 1).toString().padStart(2, '0')}:00`
      : '17:00';

    // Get preferred duration
    const preferredDurationMinutes = parseInt(
      Object.entries(durationPrefs)
        .sort((a, b) => (b[1] as number) - (a[1] as number))[0]?.[0] || '30'
    );

    // Get preferred format
    const preferredFormat = Object.entries(formatPrefs)
      .sort((a, b) => (b[1] as number) - (a[1] as number))[0]?.[0] as 'video' | 'phone' | 'in_person' || 'video';

    // Calculate confidence based on total meetings
    const confidenceScore = Math.min(1, (patterns.total_meetings || 0) / 20);

    return {
      stakeholderId,
      customerId: patterns.customer_id,
      timezone: 'America/New_York', // Would need to be set separately
      preferredDays: preferredDays.length > 0 ? preferredDays : ['tuesday', 'wednesday', 'thursday'],
      preferredTimeStart,
      preferredTimeEnd,
      preferredDurationMinutes,
      preferredFormat,
      avoidDays: [],
      avoidTimes: [],
      confidenceScore,
      lastUpdatedFrom: 'auto_learned',
    };
  }

  private async cachePatterns(analysis: MeetingPatternAnalysis): Promise<void> {
    if (!this.supabase) return;

    const dayRates: Record<number, number> = {};
    for (const day of analysis.bestDays) {
      dayRates[day.dayIndex] = day.acceptanceRate;
    }

    const hourRates: Record<number, number> = {};
    for (const time of analysis.bestTimes) {
      hourRates[time.hour] = time.acceptanceRate;
    }

    const { error } = await this.supabase
      .from('meeting_patterns')
      .upsert({
        customer_id: analysis.customerId,
        stakeholder_id: analysis.stakeholderId || null,
        total_meetings: analysis.totalMeetings,
        accepted_meetings: Math.round(analysis.totalMeetings * analysis.acceptanceRate),
        avg_response_time_hours: analysis.avgResponseTimeHours,
        day_acceptance_rates: dayRates,
        hour_acceptance_rates: hourRates,
        duration_preferences: { [analysis.preferredDuration]: 1 },
        format_preferences: { [analysis.preferredFormat]: 1 },
        successful_subjects: analysis.successfulSubjects,
        last_meeting_at: analysis.lastMeetingAt?.toISOString(),
        last_calculated_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      }, {
        onConflict: 'customer_id,stakeholder_id',
      });

    if (error) {
      console.error('Failed to cache meeting patterns:', error);
    }
  }

  private async updatePatternsFromOutcome(
    customerId: string,
    stakeholderId: string | undefined,
    outcome: string,
    responseTimeHours?: number,
    acceptedTime?: { date: string; time: string }
  ): Promise<void> {
    if (!this.supabase || !acceptedTime) return;

    // Parse accepted time to get day and hour
    const acceptedDate = new Date(`${acceptedTime.date}T${acceptedTime.time}`);
    const dayOfWeek = acceptedDate.getDay();
    const hourOfDay = acceptedDate.getHours();

    await this.incrementPatternData(
      customerId,
      stakeholderId,
      dayOfWeek,
      hourOfDay,
      30, // Default duration
      'video',
      outcome === 'accepted'
    );
  }

  private async incrementPatternData(
    customerId: string,
    stakeholderId: string | undefined,
    dayOfWeek: number,
    hourOfDay: number,
    duration: number,
    format: string,
    accepted: boolean
  ): Promise<void> {
    if (!this.supabase) return;

    // Get current patterns
    const current = await this.getCachedPatterns(customerId, stakeholderId);

    const dayRates = current?.day_acceptance_rates || {};
    const hourRates = current?.hour_acceptance_rates || {};
    const durationPrefs = current?.duration_preferences || {};
    const formatPrefs = current?.format_preferences || {};

    // Update rates with exponential moving average
    const alpha = 0.2; // Weight of new data
    if (accepted) {
      dayRates[dayOfWeek] = (dayRates[dayOfWeek] || 0.5) * (1 - alpha) + 1 * alpha;
      hourRates[hourOfDay] = (hourRates[hourOfDay] || 0.5) * (1 - alpha) + 1 * alpha;
      durationPrefs[duration] = (durationPrefs[duration] || 0) + 1;
      formatPrefs[format] = (formatPrefs[format] || 0) + 1;
    } else {
      dayRates[dayOfWeek] = (dayRates[dayOfWeek] || 0.5) * (1 - alpha) + 0 * alpha;
      hourRates[hourOfDay] = (hourRates[hourOfDay] || 0.5) * (1 - alpha) + 0 * alpha;
    }

    const { error } = await this.supabase
      .from('meeting_patterns')
      .upsert({
        customer_id: customerId,
        stakeholder_id: stakeholderId || null,
        total_meetings: (current?.total_meetings || 0) + 1,
        accepted_meetings: (current?.accepted_meetings || 0) + (accepted ? 1 : 0),
        day_acceptance_rates: dayRates,
        hour_acceptance_rates: hourRates,
        duration_preferences: durationPrefs,
        format_preferences: formatPrefs,
        last_meeting_at: accepted ? new Date().toISOString() : current?.last_meeting_at,
        last_calculated_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      }, {
        onConflict: 'customer_id,stakeholder_id',
      });

    if (error) {
      console.error('Failed to increment pattern data:', error);
    }
  }
}

// Singleton instance
export const meetingPatternAnalyzer = new MeetingPatternAnalyzer();
