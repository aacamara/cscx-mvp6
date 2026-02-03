/**
 * Meeting Request Optimizer Service
 * PRD-036: Meeting Request Optimizer
 *
 * Generates optimized meeting requests with best timing, duration,
 * and content based on historical patterns and stakeholder preferences.
 */

import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { config } from '../../config/index.js';
import {
  MeetingPatternAnalyzer,
  MeetingPatternAnalysis,
  StakeholderPreferences,
  meetingPatternAnalyzer,
} from './patternAnalyzer.js';
import { calendarService } from '../google/calendar.js';

// Types
export interface MeetingRequestInput {
  customerId: string;
  stakeholderId?: string;
  stakeholderEmail?: string;
  meetingType?: 'qbr' | 'check_in' | 'kickoff' | 'training' | 'escalation' | 'renewal' | 'general';
  purpose?: string;
  agenda?: string[];
  requestedDuration?: number; // minutes
  requestedFormat?: 'video' | 'phone' | 'in_person';
  csmUserId?: string;
  csmName?: string;
  csmEmail?: string;
  numTimeOptions?: number;
  customMessage?: string;
}

export interface OptimizedMeetingRequest {
  id: string;
  customerId: string;
  stakeholderId?: string;
  subject: string;
  bodyHtml: string;
  bodyText: string;
  proposedTimes: ProposedTime[];
  suggestedDuration: number;
  suggestedFormat: 'video' | 'phone' | 'in_person';
  calendarLink?: string;
  patternAnalysis: MeetingPatternSummary;
  recommendations: MeetingRecommendation[];
  optimizationScore: number;
}

export interface ProposedTime {
  date: string; // ISO date string
  time: string; // HH:mm format
  displayDate: string; // "Tuesday, Jan 21"
  displayTime: string; // "9:00 AM PT"
  timezone: string;
  durationMinutes: number;
  isOptimal: boolean;
  availabilityConfirmed: boolean;
}

export interface MeetingPatternSummary {
  stakeholderTimezone?: string;
  historicalAcceptanceRate: number;
  bestDays: string[];
  bestTimeRange: string;
  avgResponseTimeHours: number;
  daysSinceLastMeeting?: number;
  preferredFormat: string;
  confidence: number;
}

export interface MeetingRecommendation {
  type: 'timing' | 'duration' | 'format' | 'content' | 'urgency';
  recommendation: string;
  reasoning: string;
  impact: 'high' | 'medium' | 'low';
}

export interface CSMAvailability {
  slots: Array<{ start: Date; end: Date }>;
  timezone: string;
}

const TIMEZONE_DISPLAY: Record<string, string> = {
  'America/New_York': 'ET',
  'America/Chicago': 'CT',
  'America/Denver': 'MT',
  'America/Los_Angeles': 'PT',
  'America/Toronto': 'ET',
  'Europe/London': 'GMT',
  'Europe/Paris': 'CET',
  'Asia/Tokyo': 'JST',
  'Australia/Sydney': 'AEST',
};

const MEETING_TYPE_DEFAULTS: Record<string, { duration: number; subject: string }> = {
  qbr: { duration: 60, subject: 'Quarterly Business Review' },
  check_in: { duration: 30, subject: 'Quick Sync' },
  kickoff: { duration: 60, subject: 'Kickoff Meeting' },
  training: { duration: 45, subject: 'Training Session' },
  escalation: { duration: 30, subject: 'Priority Discussion' },
  renewal: { duration: 45, subject: 'Renewal Discussion' },
  general: { duration: 30, subject: 'Meeting Request' },
};

export class MeetingOptimizer {
  private supabase: SupabaseClient | null = null;
  private patternAnalyzer: MeetingPatternAnalyzer;

  constructor() {
    if (config.supabaseUrl && config.supabaseServiceKey) {
      this.supabase = createClient(config.supabaseUrl, config.supabaseServiceKey);
    }
    this.patternAnalyzer = meetingPatternAnalyzer;
  }

  /**
   * Generate an optimized meeting request
   */
  async generateOptimizedRequest(input: MeetingRequestInput): Promise<OptimizedMeetingRequest> {
    // Get pattern analysis
    const patterns = await this.patternAnalyzer.analyzeMeetingPatterns(
      input.customerId,
      input.stakeholderId
    );

    // Get stakeholder preferences if available
    const preferences = input.stakeholderId
      ? await this.patternAnalyzer.getStakeholderPreferences(input.stakeholderId)
      : null;

    // Get customer and stakeholder info
    const customerInfo = await this.getCustomerInfo(input.customerId);
    const stakeholderInfo = input.stakeholderId
      ? await this.getStakeholderInfo(input.stakeholderId)
      : input.stakeholderEmail
        ? { name: input.stakeholderEmail.split('@')[0], email: input.stakeholderEmail, timezone: 'America/New_York' }
        : null;

    // Calculate optimal settings
    const meetingType = input.meetingType || 'general';
    const defaults = MEETING_TYPE_DEFAULTS[meetingType];

    const suggestedDuration = input.requestedDuration ||
      preferences?.preferredDurationMinutes ||
      patterns.preferredDuration ||
      defaults.duration;

    const suggestedFormat = input.requestedFormat ||
      preferences?.preferredFormat ||
      patterns.preferredFormat ||
      'video';

    const stakeholderTimezone = stakeholderInfo?.timezone ||
      preferences?.timezone ||
      patterns.stakeholderTimezone ||
      'America/New_York';

    // Get CSM availability
    const csmAvailability = input.csmUserId
      ? await this.getCSMAvailability(input.csmUserId, suggestedDuration)
      : null;

    // Generate proposed times
    const proposedTimes = await this.generateProposedTimes(
      patterns,
      preferences,
      stakeholderTimezone,
      suggestedDuration,
      csmAvailability,
      input.numTimeOptions || 3
    );

    // Generate recommendations
    const recommendations = this.generateRecommendations(
      patterns,
      preferences,
      input.meetingType,
      suggestedDuration,
      suggestedFormat
    );

    // Calculate optimization score
    const optimizationScore = this.calculateOptimizationScore(
      patterns,
      preferences,
      proposedTimes,
      csmAvailability !== null
    );

    // Generate email content
    const subject = this.generateSubject(
      meetingType,
      customerInfo?.name,
      input.purpose,
      patterns.successfulSubjects
    );

    const { bodyHtml, bodyText } = this.generateEmailBody({
      stakeholderName: stakeholderInfo?.name || 'there',
      customerName: customerInfo?.name || 'your team',
      meetingType,
      purpose: input.purpose,
      agenda: input.agenda,
      proposedTimes,
      suggestedDuration,
      suggestedFormat,
      csmName: input.csmName || 'Your Customer Success Manager',
      csmEmail: input.csmEmail,
      customMessage: input.customMessage,
      timezone: stakeholderTimezone,
    });

    // Create pattern summary
    const patternSummary: MeetingPatternSummary = {
      stakeholderTimezone,
      historicalAcceptanceRate: Math.round(patterns.acceptanceRate * 100),
      bestDays: patterns.bestDays.slice(0, 3).map(d => d.day),
      bestTimeRange: this.formatTimeRange(patterns.bestTimes),
      avgResponseTimeHours: Math.round(patterns.avgResponseTimeHours),
      daysSinceLastMeeting: patterns.daysSinceLastMeeting,
      preferredFormat: patterns.preferredFormat,
      confidence: Math.round(patterns.confidence * 100),
    };

    // Create meeting request record
    const requestId = await this.saveMeetingRequest({
      customerId: input.customerId,
      stakeholderId: input.stakeholderId,
      requestedBy: input.csmUserId,
      meetingType,
      subject,
      bodyHtml,
      bodyText,
      proposedTimes,
      suggestedDuration,
      suggestedFormat,
      optimizationData: {
        patternAnalysis: patternSummary,
        recommendations,
        optimizationScore,
      },
    });

    return {
      id: requestId,
      customerId: input.customerId,
      stakeholderId: input.stakeholderId,
      subject,
      bodyHtml,
      bodyText,
      proposedTimes,
      suggestedDuration,
      suggestedFormat,
      patternAnalysis: patternSummary,
      recommendations,
      optimizationScore,
    };
  }

  /**
   * Send an optimized meeting request
   */
  async sendMeetingRequest(
    requestId: string,
    recipientEmail: string,
    csmUserId?: string
  ): Promise<{ success: boolean; messageId?: string; error?: string }> {
    if (!this.supabase) {
      return { success: false, error: 'Database not configured' };
    }

    // Get the request
    const { data: request, error: fetchError } = await this.supabase
      .from('meeting_requests')
      .select('*')
      .eq('id', requestId)
      .single();

    if (fetchError || !request) {
      return { success: false, error: 'Meeting request not found' };
    }

    // TODO: Integrate with Gmail service to send email
    // For now, mark as sent
    const { error: updateError } = await this.supabase
      .from('meeting_requests')
      .update({
        status: 'sent',
        sent_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('id', requestId);

    if (updateError) {
      return { success: false, error: 'Failed to update request status' };
    }

    return { success: true, messageId: `msg_${requestId}` };
  }

  /**
   * Get meeting patterns summary for a customer
   */
  async getMeetingPatterns(
    customerId: string,
    stakeholderId?: string
  ): Promise<MeetingPatternSummary> {
    const patterns = await this.patternAnalyzer.analyzeMeetingPatterns(
      customerId,
      stakeholderId
    );

    return {
      stakeholderTimezone: patterns.stakeholderTimezone,
      historicalAcceptanceRate: Math.round(patterns.acceptanceRate * 100),
      bestDays: patterns.bestDays.slice(0, 3).map(d => d.day),
      bestTimeRange: this.formatTimeRange(patterns.bestTimes),
      avgResponseTimeHours: Math.round(patterns.avgResponseTimeHours),
      daysSinceLastMeeting: patterns.daysSinceLastMeeting,
      preferredFormat: patterns.preferredFormat,
      confidence: Math.round(patterns.confidence * 100),
    };
  }

  // ==================== Private Methods ====================

  private async getCustomerInfo(customerId: string): Promise<{ name: string; industry?: string } | null> {
    if (!this.supabase) return null;

    const { data, error } = await this.supabase
      .from('customers')
      .select('name, industry')
      .eq('id', customerId)
      .single();

    if (error || !data) return null;
    return data;
  }

  private async getStakeholderInfo(
    stakeholderId: string
  ): Promise<{ name: string; email: string; title?: string; timezone: string } | null> {
    if (!this.supabase) return null;

    const { data, error } = await this.supabase
      .from('stakeholders')
      .select('name, email, title, timezone')
      .eq('id', stakeholderId)
      .single();

    if (error || !data) return null;
    return {
      ...data,
      timezone: data.timezone || 'America/New_York',
    };
  }

  private async getCSMAvailability(
    userId: string,
    duration: number
  ): Promise<CSMAvailability | null> {
    try {
      const timeMin = new Date();
      const timeMax = new Date();
      timeMax.setDate(timeMax.getDate() + 14); // Next 2 weeks

      const slots = await calendarService.findAvailableSlots(userId, {
        timeMin,
        timeMax,
        duration,
      });

      return {
        slots,
        timezone: 'America/New_York', // TODO: Get from user settings
      };
    } catch (error) {
      console.error('Failed to get CSM availability:', error);
      return null;
    }
  }

  private async generateProposedTimes(
    patterns: MeetingPatternAnalysis,
    preferences: StakeholderPreferences | null,
    stakeholderTimezone: string,
    duration: number,
    csmAvailability: CSMAvailability | null,
    numOptions: number
  ): Promise<ProposedTime[]> {
    const proposedTimes: ProposedTime[] = [];
    const now = new Date();
    const tzDisplay = TIMEZONE_DISPLAY[stakeholderTimezone] || stakeholderTimezone;

    // Get best days and times from patterns
    const bestDays = patterns.bestDays.slice(0, 4);
    const bestTimes = patterns.bestTimes.slice(0, 4);

    // Get preferred days from preferences
    const preferredDays = preferences?.preferredDays || [];

    // Generate time slots for the next 2 weeks
    for (let dayOffset = 1; dayOffset <= 14 && proposedTimes.length < numOptions; dayOffset++) {
      const date = new Date(now);
      date.setDate(date.getDate() + dayOffset);
      const dayOfWeek = date.getDay();
      const dayName = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'][dayOfWeek];

      // Check if this day is in best days or preferred days
      const dayPattern = bestDays.find(d => d.dayIndex === dayOfWeek);
      const isPreferredDay = preferredDays.includes(dayName);
      const isAvoidDay = preferences?.avoidDays?.includes(dayName);

      if (isAvoidDay) continue;

      // Skip weekends unless they have good acceptance rate
      if ((dayOfWeek === 0 || dayOfWeek === 6) && (!dayPattern || dayPattern.acceptanceRate < 0.5)) {
        continue;
      }

      // For each good day, find best time
      for (const timeSlot of bestTimes) {
        if (proposedTimes.length >= numOptions) break;

        // Check if time is within preferred range
        if (preferences) {
          const preferredStart = parseInt(preferences.preferredTimeStart.split(':')[0]);
          const preferredEnd = parseInt(preferences.preferredTimeEnd.split(':')[0]);
          if (timeSlot.hour < preferredStart || timeSlot.hour >= preferredEnd) {
            continue;
          }
        }

        // Check against avoid times
        if (preferences?.avoidTimes) {
          const avoidSlot = preferences.avoidTimes.find(
            at => at.day === dayName &&
            timeSlot.hour >= parseInt(at.start.split(':')[0]) &&
            timeSlot.hour < parseInt(at.end.split(':')[0])
          );
          if (avoidSlot) continue;
        }

        // Check CSM availability
        let availabilityConfirmed = false;
        if (csmAvailability?.slots) {
          const slotStart = new Date(date);
          slotStart.setHours(timeSlot.hour, 0, 0, 0);
          const slotEnd = new Date(slotStart.getTime() + duration * 60 * 1000);

          availabilityConfirmed = csmAvailability.slots.some(slot =>
            slot.start <= slotStart && slot.end >= slotEnd
          );
        }

        // Calculate if this is an optimal slot
        const isOptimal = (dayPattern?.acceptanceRate || 0) >= 0.7 &&
          timeSlot.acceptanceRate >= 0.7 &&
          (isPreferredDay || !preferences);

        // Format the date
        const dateStr = date.toISOString().split('T')[0];
        const timeStr = `${timeSlot.hour.toString().padStart(2, '0')}:00`;
        const displayDate = date.toLocaleDateString('en-US', {
          weekday: 'long',
          month: 'short',
          day: 'numeric',
        });
        const displayTime = date.toLocaleTimeString('en-US', {
          hour: 'numeric',
          minute: '2-digit',
          hour12: true,
        }).replace(':00', '');

        proposedTimes.push({
          date: dateStr,
          time: timeStr,
          displayDate,
          displayTime: `${displayTime} ${tzDisplay}`,
          timezone: stakeholderTimezone,
          durationMinutes: duration,
          isOptimal,
          availabilityConfirmed,
        });
      }
    }

    // Sort by optimality and availability
    proposedTimes.sort((a, b) => {
      if (a.isOptimal !== b.isOptimal) return b.isOptimal ? 1 : -1;
      if (a.availabilityConfirmed !== b.availabilityConfirmed) return b.availabilityConfirmed ? 1 : -1;
      return new Date(a.date).getTime() - new Date(b.date).getTime();
    });

    return proposedTimes.slice(0, numOptions);
  }

  private generateRecommendations(
    patterns: MeetingPatternAnalysis,
    preferences: StakeholderPreferences | null,
    meetingType?: string,
    suggestedDuration?: number,
    suggestedFormat?: string
  ): MeetingRecommendation[] {
    const recommendations: MeetingRecommendation[] = [];

    // Timing recommendations
    if (patterns.bestDays.length > 0) {
      const topDays = patterns.bestDays.slice(0, 2).map(d => d.day);
      recommendations.push({
        type: 'timing',
        recommendation: `Schedule on ${topDays.join(' or ')}`,
        reasoning: `${Math.round(patterns.bestDays[0].acceptanceRate * 100)}% acceptance rate on ${patterns.bestDays[0].day}`,
        impact: patterns.bestDays[0].acceptanceRate >= 0.8 ? 'high' : 'medium',
      });
    }

    // Time of day recommendation
    if (patterns.bestTimes.length > 0) {
      const bestTime = patterns.bestTimes[0];
      recommendations.push({
        type: 'timing',
        recommendation: `Best time: ${bestTime.displayTime}`,
        reasoning: `${Math.round(bestTime.acceptanceRate * 100)}% acceptance rate for this time slot`,
        impact: bestTime.acceptanceRate >= 0.8 ? 'high' : 'medium',
      });
    }

    // Duration recommendation
    if (patterns.preferredDuration && suggestedDuration !== patterns.preferredDuration) {
      recommendations.push({
        type: 'duration',
        recommendation: `Consider ${patterns.preferredDuration}-minute meetings`,
        reasoning: 'Historical preference based on accepted meetings',
        impact: 'medium',
      });
    }

    // Format recommendation
    if (patterns.preferredFormat !== suggestedFormat) {
      recommendations.push({
        type: 'format',
        recommendation: `Stakeholder prefers ${patterns.preferredFormat} calls`,
        reasoning: 'Based on past meeting format preferences',
        impact: 'low',
      });
    }

    // Urgency recommendation
    if (patterns.daysSinceLastMeeting !== undefined && patterns.daysSinceLastMeeting > 30) {
      recommendations.push({
        type: 'urgency',
        recommendation: 'Consider urgent outreach',
        reasoning: `${patterns.daysSinceLastMeeting} days since last meeting`,
        impact: patterns.daysSinceLastMeeting > 60 ? 'high' : 'medium',
      });
    }

    // Subject line recommendation
    if (patterns.successfulSubjects.length > 0) {
      recommendations.push({
        type: 'content',
        recommendation: `Try subject like: "${patterns.successfulSubjects[0]}"`,
        reasoning: 'High response rate with similar subject lines',
        impact: 'medium',
      });
    }

    return recommendations;
  }

  private calculateOptimizationScore(
    patterns: MeetingPatternAnalysis,
    preferences: StakeholderPreferences | null,
    proposedTimes: ProposedTime[],
    csmAvailabilityChecked: boolean
  ): number {
    let score = 50; // Base score

    // Pattern confidence (up to 20 points)
    score += patterns.confidence * 20;

    // Optimal times proposed (up to 15 points)
    const optimalCount = proposedTimes.filter(t => t.isOptimal).length;
    score += (optimalCount / proposedTimes.length) * 15;

    // CSM availability confirmed (up to 10 points)
    if (csmAvailabilityChecked) {
      const confirmedCount = proposedTimes.filter(t => t.availabilityConfirmed).length;
      score += (confirmedCount / proposedTimes.length) * 10;
    }

    // Stakeholder preferences available (up to 5 points)
    if (preferences && preferences.confidenceScore > 0.5) {
      score += 5;
    }

    return Math.min(100, Math.round(score));
  }

  private generateSubject(
    meetingType: string,
    customerName?: string,
    purpose?: string,
    successfulSubjects?: string[]
  ): string {
    const defaults = MEETING_TYPE_DEFAULTS[meetingType] || MEETING_TYPE_DEFAULTS.general;

    // If we have successful subjects and no specific purpose, use a proven subject
    if (successfulSubjects && successfulSubjects.length > 0 && !purpose) {
      return successfulSubjects[0];
    }

    // Build custom subject
    if (purpose) {
      return purpose;
    }

    // Use meeting type default with customer name
    if (meetingType === 'check_in') {
      return customerName ? `Quick Sync - ${customerName}` : 'Quick Sync This Week?';
    }

    if (meetingType === 'qbr') {
      return customerName ? `${customerName} - Quarterly Business Review` : 'Quarterly Business Review';
    }

    return `${defaults.subject}${customerName ? ` - ${customerName}` : ''}`;
  }

  private generateEmailBody(params: {
    stakeholderName: string;
    customerName: string;
    meetingType: string;
    purpose?: string;
    agenda?: string[];
    proposedTimes: ProposedTime[];
    suggestedDuration: number;
    suggestedFormat: string;
    csmName: string;
    csmEmail?: string;
    customMessage?: string;
    timezone: string;
  }): { bodyHtml: string; bodyText: string } {
    const {
      stakeholderName,
      customerName,
      meetingType,
      purpose,
      agenda,
      proposedTimes,
      suggestedDuration,
      suggestedFormat,
      csmName,
      csmEmail,
      customMessage,
      timezone,
    } = params;

    const firstName = stakeholderName.split(' ')[0];
    const formatDisplay = suggestedFormat === 'video' ? 'video call' :
                          suggestedFormat === 'phone' ? 'phone call' : 'meeting';

    // Build times list
    const timesHtml = proposedTimes.map(t =>
      `<li>${t.displayDate} at ${t.displayTime}</li>`
    ).join('\n');
    const timesText = proposedTimes.map(t =>
      `- ${t.displayDate} at ${t.displayTime}`
    ).join('\n');

    // Build opening based on meeting type
    let opening = '';
    switch (meetingType) {
      case 'qbr':
        opening = `I hope this message finds you well! I'd like to schedule our Quarterly Business Review to discuss ${customerName}'s progress and align on strategic priorities.`;
        break;
      case 'check_in':
        opening = `I hope you're having a great week! I'd love to catch up on how things are going and see if there's anything I can help with.`;
        break;
      case 'kickoff':
        opening = `I'm excited to get started with ${customerName}! I'd like to schedule our kickoff meeting to align on goals and next steps.`;
        break;
      case 'training':
        opening = `I'd like to schedule a training session to help your team get the most out of our platform.`;
        break;
      case 'escalation':
        opening = `I wanted to reach out regarding the issue we discussed. I'd like to schedule a call to work through this together.`;
        break;
      case 'renewal':
        opening = `As we approach your renewal date, I'd like to schedule some time to discuss your experience and explore how we can continue to support your success.`;
        break;
      default:
        opening = `I hope you're doing well! I'd like to schedule some time to connect.`;
    }

    // Build agenda section if provided
    let agendaHtml = '';
    let agendaText = '';
    if (agenda && agenda.length > 0) {
      agendaHtml = `
<p><strong>Proposed Agenda:</strong></p>
<ul>
${agenda.map(item => `  <li>${item}</li>`).join('\n')}
</ul>`;
      agendaText = `
Proposed Agenda:
${agenda.map(item => `- ${item}`).join('\n')}`;
    }

    const bodyHtml = `
<!DOCTYPE html>
<html>
<head>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, sans-serif; line-height: 1.6; color: #333; }
    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
    .times { background: #f8f9fa; padding: 15px 20px; border-radius: 8px; margin: 20px 0; }
    .times ul { margin: 10px 0; padding-left: 20px; }
    .times li { margin: 8px 0; }
    .calendar-link { display: inline-block; background: #e63946; color: white; padding: 10px 20px; text-decoration: none; border-radius: 6px; margin: 15px 0; }
    .calendar-link:hover { background: #d62839; }
    .footer { margin-top: 30px; padding-top: 20px; border-top: 1px solid #eee; color: #666; font-size: 14px; }
  </style>
</head>
<body>
  <div class="container">
    <p>Hi ${firstName},</p>

    <p>${opening}</p>

    ${customMessage ? `<p>${customMessage}</p>` : ''}
    ${agendaHtml}

    <div class="times">
      <p><strong>Would any of these times work for a ${suggestedDuration}-minute ${formatDisplay}?</strong></p>
      <ul>
        ${timesHtml}
      </ul>
    </div>

    <p>If none of these work, feel free to suggest alternatives!</p>

    <div class="footer">
      <p>Best regards,</p>
      <p><strong>${csmName}</strong>${csmEmail ? `<br/>${csmEmail}` : ''}</p>
    </div>
  </div>
</body>
</html>`;

    const bodyText = `Hi ${firstName},

${opening}

${customMessage || ''}
${agendaText}

Would any of these times work for a ${suggestedDuration}-minute ${formatDisplay}?

${timesText}

If none of these work, feel free to suggest alternatives!

Best regards,
${csmName}${csmEmail ? `\n${csmEmail}` : ''}`;

    return { bodyHtml, bodyText };
  }

  private formatTimeRange(bestTimes: { hour: number; displayTime: string }[]): string {
    if (bestTimes.length === 0) return '9:00 AM - 5:00 PM';

    const hours = bestTimes.slice(0, 4).map(t => t.hour).sort((a, b) => a - b);
    const minHour = hours[0];
    const maxHour = hours[hours.length - 1];

    const formatHour = (h: number) => {
      const ampm = h >= 12 ? 'PM' : 'AM';
      const hour12 = h > 12 ? h - 12 : h === 0 ? 12 : h;
      return `${hour12}:00 ${ampm}`;
    };

    return `${formatHour(minHour)} - ${formatHour(maxHour + 1)}`;
  }

  private async saveMeetingRequest(data: {
    customerId: string;
    stakeholderId?: string;
    requestedBy?: string;
    meetingType: string;
    subject: string;
    bodyHtml: string;
    bodyText: string;
    proposedTimes: ProposedTime[];
    suggestedDuration: number;
    suggestedFormat: string;
    optimizationData: any;
  }): Promise<string> {
    if (!this.supabase) {
      return `request_${Date.now()}`;
    }

    const { data: result, error } = await this.supabase
      .from('meeting_requests')
      .insert({
        customer_id: data.customerId,
        stakeholder_id: data.stakeholderId,
        requested_by: data.requestedBy,
        meeting_type: data.meetingType,
        subject: data.subject,
        body_html: data.bodyHtml,
        body_text: data.bodyText,
        proposed_times: data.proposedTimes,
        suggested_duration: data.suggestedDuration,
        suggested_format: data.suggestedFormat,
        optimization_data: data.optimizationData,
        status: 'draft',
      })
      .select('id')
      .single();

    if (error || !result) {
      console.error('Failed to save meeting request:', error);
      return `request_${Date.now()}`;
    }

    return result.id;
  }
}

// Singleton instance
export const meetingOptimizer = new MeetingOptimizer();
