/**
 * Meeting Prep Service (PRD-127)
 *
 * Automated pre-meeting research and briefing service that:
 * - Detects customer meetings from calendar
 * - Generates comprehensive prep briefs 24 hours before
 * - Delivers via email, Slack, and in-app notifications
 * - Tracks viewing and completion status
 */

import { createClient, SupabaseClient } from '@supabase/supabase-js';
import Anthropic from '@anthropic-ai/sdk';
import { config } from '../config/index.js';
import { calendarService, CalendarEvent } from './google/calendar.js';

// Initialize clients
let supabase: SupabaseClient | null = null;
if (config.supabaseUrl && config.supabaseServiceKey) {
  supabase = createClient(config.supabaseUrl, config.supabaseServiceKey);
}

// ==================== Types ====================

export interface CustomerSnapshot {
  name: string;
  healthScore: number;
  healthTrend: 'up' | 'down' | 'stable';
  arr: number;
  renewalDate: string | null;
  stage: string;
  daysSinceLastMeeting: number;
  industry?: string;
  csmName?: string;
}

export interface ActivitySummary {
  type: string;
  description: string;
  date: string;
  sentiment?: 'positive' | 'neutral' | 'negative';
}

export interface OpenItem {
  type: 'task' | 'action_item' | 'follow_up' | 'risk' | 'support_ticket';
  description: string;
  dueDate?: string;
  priority: 'high' | 'medium' | 'low';
  owner?: string;
}

export interface TalkingPoint {
  point: string;
  priority: 'must_discuss' | 'should_discuss' | 'nice_to_have';
  context?: string;
  dataSource?: string;
}

export interface AttendeeProfile {
  name: string;
  email?: string;
  role?: string;
  influence?: 'decision_maker' | 'influencer' | 'user' | 'unknown';
  sentiment?: 'positive' | 'neutral' | 'negative' | 'unknown';
  lastContact?: string;
  interactionCount?: number;
  notes?: string;
}

export interface PreviousMeetingSummary {
  date: string;
  title: string;
  summary?: string;
  decisions?: string[];
  followUps?: string[];
  attendees?: string[];
}

export interface MeetingContext {
  agenda?: string[];
  objectives?: string[];
  meetingType: 'qbr' | 'check_in' | 'escalation' | 'renewal' | 'kickoff' | 'training' | 'other';
}

export interface MeetingPrepContent {
  customerSnapshot: CustomerSnapshot;
  recentActivity: ActivitySummary[];
  openItems: OpenItem[];
  talkingPoints: TalkingPoint[];
  questions: string[];
  attendeeProfiles: AttendeeProfile[];
  recommendations: string[];
  previousMeetings: PreviousMeetingSummary[];
  meetingContext: MeetingContext;
}

export interface MeetingPrepBrief {
  id: string;
  meetingId?: string;
  calendarEventId?: string;
  customerId: string;
  csmId: string;
  scheduledAt: Date;
  prepDeliveredAt?: Date;
  reminderDeliveredAt?: Date;
  content: MeetingPrepContent;
  status: 'scheduled' | 'delivered' | 'viewed' | 'completed';
  viewedAt?: Date;
  dataCompleteness: number;
}

export interface MeetingPrepPreferences {
  userId: string;
  initialLeadHours: number;
  reminderLeadMinutes: number;
  morningDigestEnabled: boolean;
  morningDigestTime: string;
  appNotifications: boolean;
  emailNotifications: boolean;
  slackNotifications: boolean;
  includeStakeholderProfiles: boolean;
  includePreviousMeetings: boolean;
  includeRiskSignals: boolean;
  maxTalkingPoints: number;
  autoGenerateEnabled: boolean;
  minimumMeetingDurationMinutes: number;
}

// ==================== Service ====================

class MeetingPrepService {
  private anthropic: Anthropic | null = null;

  constructor() {
    if (config.anthropicApiKey) {
      this.anthropic = new Anthropic({ apiKey: config.anthropicApiKey });
    }
  }

  // ==================== Main Brief Generation ====================

  /**
   * Generate a comprehensive meeting prep brief
   */
  async generateBrief(
    calendarEvent: CalendarEvent,
    customerId: string,
    csmId: string
  ): Promise<MeetingPrepBrief | null> {
    const startTime = Date.now();

    try {
      // Gather all required data in parallel
      const [
        customerData,
        recentActivity,
        openItems,
        stakeholders,
        previousMeetings,
        healthHistory
      ] = await Promise.all([
        this.fetchCustomerData(customerId),
        this.fetchRecentActivity(customerId, 30),
        this.fetchOpenItems(customerId),
        this.fetchStakeholders(customerId),
        this.fetchPreviousMeetings(customerId, 5),
        this.fetchHealthHistory(customerId, 90)
      ]);

      if (!customerData) {
        console.error('[MeetingPrep] Customer not found:', customerId);
        return null;
      }

      // Build customer snapshot
      const customerSnapshot = this.buildCustomerSnapshot(
        customerData,
        healthHistory,
        previousMeetings
      );

      // Determine meeting type from title/description
      const meetingType = this.inferMeetingType(calendarEvent);

      // Build attendee profiles from calendar + CRM data
      const attendeeProfiles = this.buildAttendeeProfiles(
        calendarEvent.attendees,
        stakeholders,
        recentActivity
      );

      // Generate AI-powered content
      const aiContent = await this.generateAIContent(
        customerSnapshot,
        recentActivity,
        openItems,
        attendeeProfiles,
        previousMeetings,
        meetingType,
        calendarEvent
      );

      // Build meeting context
      const meetingContext: MeetingContext = {
        agenda: this.parseAgendaFromDescription(calendarEvent.description),
        objectives: aiContent.objectives,
        meetingType
      };

      // Build the full content object
      const content: MeetingPrepContent = {
        customerSnapshot,
        recentActivity: recentActivity.slice(0, 10),
        openItems: openItems.slice(0, 10),
        talkingPoints: aiContent.talkingPoints,
        questions: aiContent.questions,
        attendeeProfiles,
        recommendations: aiContent.recommendations,
        previousMeetings,
        meetingContext
      };

      // Calculate data completeness
      const dataCompleteness = this.calculateDataCompleteness(content);

      // Create the brief in the database
      const brief = await this.saveBrief({
        calendarEventId: calendarEvent.id,
        customerId,
        csmId,
        scheduledAt: calendarEvent.startTime,
        content,
        dataCompleteness
      });

      const duration = Date.now() - startTime;
      console.log(`[MeetingPrep] Brief generated for ${customerData.name} in ${duration}ms`);

      if (brief && supabase) {
        // Update generation duration
        await supabase
          .from('meeting_prep_briefs')
          .update({ generation_duration_ms: duration })
          .eq('id', brief.id);
      }

      return brief;
    } catch (error) {
      console.error('[MeetingPrep] Error generating brief:', error);
      return null;
    }
  }

  /**
   * Generate briefs for all upcoming meetings in the next time window
   */
  async generateUpcomingBriefs(csmId: string, hoursAhead: number = 48): Promise<number> {
    let generated = 0;

    try {
      // Get upcoming calendar events
      const events = await calendarService.getUpcomingEvents(csmId, Math.ceil(hoursAhead / 24));

      for (const event of events) {
        // Skip if already has a brief
        const existingBrief = await this.getBriefByCalendarEventId(event.id);
        if (existingBrief) continue;

        // Try to match attendees to a customer
        const customerId = await this.matchEventToCustomer(event);
        if (!customerId) continue;

        // Check if meeting is within the lead time window
        const hoursUntilMeeting = (event.startTime.getTime() - Date.now()) / (1000 * 60 * 60);
        if (hoursUntilMeeting > hoursAhead || hoursUntilMeeting < 1) continue;

        // Generate the brief
        const brief = await this.generateBrief(event, customerId, csmId);
        if (brief) {
          generated++;
        }
      }
    } catch (error) {
      console.error('[MeetingPrep] Error generating upcoming briefs:', error);
    }

    return generated;
  }

  // ==================== Data Fetching ====================

  private async fetchCustomerData(customerId: string): Promise<any | null> {
    if (!supabase) {
      return this.getMockCustomerData();
    }

    const { data, error } = await supabase
      .from('customers')
      .select('*')
      .eq('id', customerId)
      .single();

    if (error) {
      console.error('[MeetingPrep] Error fetching customer:', error);
      return null;
    }

    return data;
  }

  private async fetchRecentActivity(
    customerId: string,
    days: number
  ): Promise<ActivitySummary[]> {
    if (!supabase) {
      return this.getMockActivity();
    }

    const cutoff = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

    const { data, error } = await supabase
      .from('agent_activity_log')
      .select('*')
      .eq('customer_id', customerId)
      .gte('started_at', cutoff.toISOString())
      .order('started_at', { ascending: false })
      .limit(20);

    if (error) {
      console.error('[MeetingPrep] Error fetching activity:', error);
      return [];
    }

    return (data || []).map(a => ({
      type: this.formatActivityType(a.action_type),
      description: a.result_data?.summary || a.action_data?.description || a.action_type,
      date: a.started_at,
      sentiment: a.result_data?.sentiment
    }));
  }

  private async fetchOpenItems(customerId: string): Promise<OpenItem[]> {
    if (!supabase) {
      return this.getMockOpenItems();
    }

    const items: OpenItem[] = [];

    // Fetch open tasks/action items
    try {
      const { data: tasks } = await supabase
        .from('plan_tasks')
        .select('*')
        .eq('customer_id', customerId)
        .in('status', ['pending', 'in_progress'])
        .order('due_date', { ascending: true })
        .limit(10);

      if (tasks) {
        items.push(
          ...tasks.map(t => ({
            type: 'task' as const,
            description: t.title || t.description,
            dueDate: t.due_date,
            priority: t.priority?.toLowerCase() || 'medium',
            owner: t.owner
          }))
        );
      }
    } catch (e) {
      console.error('[MeetingPrep] Error fetching tasks:', e);
    }

    // Fetch active risk signals
    try {
      const { data: risks } = await supabase
        .from('insights')
        .select('*')
        .eq('customer_id', customerId)
        .eq('acknowledged', false)
        .eq('type', 'risk')
        .limit(5);

      if (risks) {
        items.push(
          ...risks.map(r => ({
            type: 'risk' as const,
            description: r.title || r.description,
            priority: r.severity?.toLowerCase() || 'medium',
            dueDate: undefined,
            owner: undefined
          }))
        );
      }
    } catch (e) {
      console.error('[MeetingPrep] Error fetching risks:', e);
    }

    return items;
  }

  private async fetchStakeholders(customerId: string): Promise<any[]> {
    if (!supabase) {
      return this.getMockStakeholders();
    }

    const { data, error } = await supabase
      .from('stakeholders')
      .select('*')
      .eq('customer_id', customerId)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('[MeetingPrep] Error fetching stakeholders:', error);
      return [];
    }

    return data || [];
  }

  private async fetchPreviousMeetings(
    customerId: string,
    limit: number
  ): Promise<PreviousMeetingSummary[]> {
    if (!supabase) {
      return this.getMockPreviousMeetings();
    }

    const { data, error } = await supabase
      .from('meetings')
      .select('*')
      .eq('customer_id', customerId)
      .lt('scheduled_at', new Date().toISOString())
      .order('scheduled_at', { ascending: false })
      .limit(limit);

    if (error) {
      console.error('[MeetingPrep] Error fetching previous meetings:', error);
      return [];
    }

    return (data || []).map(m => ({
      date: m.scheduled_at,
      title: m.title,
      summary: m.summary,
      decisions: m.decisions || [],
      followUps: m.follow_ups || [],
      attendees: m.attendees || []
    }));
  }

  private async fetchHealthHistory(
    customerId: string,
    days: number
  ): Promise<Array<{ date: string; score: number }>> {
    if (!supabase) {
      return this.getMockHealthHistory();
    }

    const cutoff = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

    try {
      const { data } = await supabase
        .from('health_score_history')
        .select('calculated_at, score')
        .eq('customer_id', customerId)
        .gte('calculated_at', cutoff.toISOString())
        .order('calculated_at', { ascending: true });

      if (data && data.length > 0) {
        return data.map(d => ({
          date: d.calculated_at,
          score: d.score
        }));
      }
    } catch (e) {
      // Table may not exist
    }

    return [];
  }

  // ==================== Data Processing ====================

  private buildCustomerSnapshot(
    customer: any,
    healthHistory: Array<{ date: string; score: number }>,
    previousMeetings: PreviousMeetingSummary[]
  ): CustomerSnapshot {
    // Calculate health trend
    let healthTrend: 'up' | 'down' | 'stable' = 'stable';
    if (healthHistory.length >= 2) {
      const recent = healthHistory[healthHistory.length - 1].score;
      const earlier = healthHistory[0].score;
      if (recent > earlier + 5) healthTrend = 'up';
      else if (recent < earlier - 5) healthTrend = 'down';
    }

    // Calculate days since last meeting
    let daysSinceLastMeeting = 999;
    if (previousMeetings.length > 0) {
      const lastMeetingDate = new Date(previousMeetings[0].date);
      daysSinceLastMeeting = Math.floor(
        (Date.now() - lastMeetingDate.getTime()) / (1000 * 60 * 60 * 24)
      );
    }

    return {
      name: customer.name,
      healthScore: customer.health_score || 0,
      healthTrend,
      arr: customer.arr || 0,
      renewalDate: customer.contract_end || null,
      stage: customer.stage || 'active',
      daysSinceLastMeeting,
      industry: customer.industry,
      csmName: customer.csm_name
    };
  }

  private buildAttendeeProfiles(
    calendarAttendees: Array<{ email: string; displayName?: string }>,
    stakeholders: any[],
    recentActivity: ActivitySummary[]
  ): AttendeeProfile[] {
    return calendarAttendees
      .filter(a => !a.email?.includes('resource.calendar') && !a.email?.includes('@group.calendar'))
      .map(attendee => {
        // Try to match with known stakeholder
        const stakeholder = stakeholders.find(
          s => s.email?.toLowerCase() === attendee.email?.toLowerCase()
        );

        // Count interactions
        const interactionCount = recentActivity.filter(
          a => a.description?.toLowerCase().includes(attendee.email?.toLowerCase() || '')
        ).length;

        // Infer influence level
        let influence: AttendeeProfile['influence'] = 'unknown';
        if (stakeholder) {
          const role = stakeholder.title?.toLowerCase() || '';
          if (role.includes('vp') || role.includes('director') || role.includes('head') || role.includes('ceo') || role.includes('cto')) {
            influence = 'decision_maker';
          } else if (role.includes('manager') || role.includes('lead')) {
            influence = 'influencer';
          } else {
            influence = 'user';
          }
        }

        return {
          name: stakeholder?.name || attendee.displayName || attendee.email?.split('@')[0] || 'Unknown',
          email: attendee.email,
          role: stakeholder?.title || stakeholder?.role,
          influence,
          sentiment: stakeholder?.metadata?.sentiment || 'unknown',
          lastContact: stakeholder?.last_contact,
          interactionCount,
          notes: stakeholder?.notes
        };
      });
  }

  private inferMeetingType(
    event: CalendarEvent
  ): MeetingContext['meetingType'] {
    const title = (event.title || '').toLowerCase();
    const desc = (event.description || '').toLowerCase();
    const combined = `${title} ${desc}`;

    if (combined.includes('qbr') || combined.includes('quarterly business review')) {
      return 'qbr';
    }
    if (combined.includes('renewal')) {
      return 'renewal';
    }
    if (combined.includes('kickoff') || combined.includes('kick-off') || combined.includes('onboarding')) {
      return 'kickoff';
    }
    if (combined.includes('escalation') || combined.includes('urgent') || combined.includes('issue')) {
      return 'escalation';
    }
    if (combined.includes('training') || combined.includes('demo') || combined.includes('workshop')) {
      return 'training';
    }
    if (combined.includes('check-in') || combined.includes('check in') || combined.includes('sync')) {
      return 'check_in';
    }

    return 'other';
  }

  private parseAgendaFromDescription(description?: string): string[] {
    if (!description) return [];

    const agenda: string[] = [];
    const lines = description.split('\n');

    let inAgendaSection = false;
    for (const line of lines) {
      const trimmed = line.trim();
      if (trimmed.toLowerCase().includes('agenda')) {
        inAgendaSection = true;
        continue;
      }
      if (inAgendaSection) {
        // Look for bullet points or numbered items
        const match = trimmed.match(/^[\-\*\d\.]+\s*(.+)/);
        if (match) {
          agenda.push(match[1]);
        } else if (trimmed === '' && agenda.length > 0) {
          break; // End of agenda section
        }
      }
    }

    return agenda;
  }

  // ==================== AI Content Generation ====================

  private async generateAIContent(
    customerSnapshot: CustomerSnapshot,
    recentActivity: ActivitySummary[],
    openItems: OpenItem[],
    attendeeProfiles: AttendeeProfile[],
    previousMeetings: PreviousMeetingSummary[],
    meetingType: MeetingContext['meetingType'],
    calendarEvent: CalendarEvent
  ): Promise<{
    talkingPoints: TalkingPoint[];
    questions: string[];
    recommendations: string[];
    objectives: string[];
  }> {
    if (!this.anthropic) {
      return this.getFallbackAIContent(meetingType, customerSnapshot, openItems);
    }

    const systemPrompt = `You are an expert Customer Success Manager preparing for an important customer meeting.
Your goal is to help the CSM be fully prepared with relevant context, talking points, and questions.

Guidelines:
- Be specific and actionable based on the data provided
- Prioritize talking points by importance
- Include both celebration items and concerns to address
- Suggest questions that demonstrate deep understanding
- Consider the attendees' roles and influence
- Reference recent activity and history when relevant`;

    const prompt = `Generate meeting prep content for this upcoming meeting.

Meeting Details:
- Type: ${meetingType.toUpperCase()}
- Title: ${calendarEvent.title}
- Date: ${calendarEvent.startTime.toISOString()}
${calendarEvent.description ? `- Description: ${calendarEvent.description}` : ''}

Customer Context:
${JSON.stringify(customerSnapshot, null, 2)}

Attendees:
${attendeeProfiles.map(a => `- ${a.name} (${a.role || 'Unknown role'}) - ${a.influence}`).join('\n')}

Recent Activity (last 30 days):
${recentActivity.slice(0, 5).map(a => `- ${a.type}: ${a.description}`).join('\n') || 'No recent activity'}

Open Items:
${openItems.slice(0, 5).map(i => `- [${i.priority.toUpperCase()}] ${i.type}: ${i.description}`).join('\n') || 'No open items'}

Previous Meetings:
${previousMeetings.slice(0, 3).map(m => `- ${m.date}: ${m.title}${m.summary ? ` - ${m.summary}` : ''}`).join('\n') || 'No previous meetings'}

Generate the following as a JSON object:
{
  "objectives": ["2-3 specific meeting objectives"],
  "talkingPoints": [
    {"point": "specific talking point", "priority": "must_discuss|should_discuss|nice_to_have", "context": "why this matters"}
  ],
  "questions": ["5-7 insightful questions to ask"],
  "recommendations": ["3-5 recommended actions or areas to focus on"]
}

Ensure talking points cover:
1. Relationship building / wins to celebrate
2. Business value / ROI discussion
3. Any risks or concerns to address
4. Future roadmap / upcoming initiatives
5. Action items from previous meetings (if any)

Return ONLY valid JSON, no markdown formatting.`;

    try {
      const message = await this.anthropic.messages.create({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 2000,
        system: systemPrompt,
        messages: [{ role: 'user', content: prompt }]
      });

      const textBlock = message.content.find(block => block.type === 'text');
      const responseText = textBlock?.type === 'text' ? textBlock.text : '';

      // Parse JSON response
      let jsonString = responseText.trim();
      if (jsonString.startsWith('```')) {
        jsonString = jsonString.replace(/```json?\n?/g, '').replace(/```/g, '');
      }

      const parsed = JSON.parse(jsonString);

      return {
        talkingPoints: (parsed.talkingPoints || []).map((t: any) => ({
          point: t.point,
          priority: t.priority || 'should_discuss',
          context: t.context,
          dataSource: 'ai'
        })),
        questions: parsed.questions || [],
        recommendations: parsed.recommendations || [],
        objectives: parsed.objectives || []
      };
    } catch (error) {
      console.error('[MeetingPrep] AI generation error:', error);
      return this.getFallbackAIContent(meetingType, customerSnapshot, openItems);
    }
  }

  private getFallbackAIContent(
    meetingType: MeetingContext['meetingType'],
    customerSnapshot: CustomerSnapshot,
    openItems: OpenItem[]
  ): {
    talkingPoints: TalkingPoint[];
    questions: string[];
    recommendations: string[];
    objectives: string[];
  } {
    const talkingPointsByType: Record<string, TalkingPoint[]> = {
      qbr: [
        { point: `Review ${customerSnapshot.name}'s business performance this quarter`, priority: 'must_discuss', context: 'Core QBR content' },
        { point: 'Discuss product adoption and usage trends', priority: 'must_discuss', context: 'Value demonstration' },
        { point: 'Share upcoming product roadmap relevant to their use case', priority: 'should_discuss', context: 'Future value' },
        { point: 'Align on goals for next quarter', priority: 'must_discuss', context: 'Strategic planning' }
      ],
      check_in: [
        { point: `How are things going with ${customerSnapshot.name}?`, priority: 'must_discuss', context: 'Relationship building' },
        { point: 'Review any open action items or blockers', priority: 'should_discuss', context: 'Progress tracking' },
        { point: 'Share relevant product updates or tips', priority: 'nice_to_have', context: 'Value add' }
      ],
      renewal: [
        { point: 'Review value delivered over the contract period', priority: 'must_discuss', context: 'ROI justification' },
        { point: 'Discuss renewal terms and timeline', priority: 'must_discuss', context: 'Commercial discussion' },
        { point: 'Address any concerns or competitive considerations', priority: 'must_discuss', context: 'Risk mitigation' }
      ],
      escalation: [
        { point: 'Acknowledge the situation and impact', priority: 'must_discuss', context: 'Build trust' },
        { point: 'Present root cause analysis', priority: 'must_discuss', context: 'Show ownership' },
        { point: 'Propose resolution plan with timeline', priority: 'must_discuss', context: 'Path forward' }
      ],
      kickoff: [
        { point: 'Team introductions and roles', priority: 'must_discuss', context: 'Foundation setting' },
        { point: 'Review project goals and success criteria', priority: 'must_discuss', context: 'Alignment' },
        { point: 'Establish communication cadence', priority: 'should_discuss', context: 'Process' }
      ],
      training: [
        { point: 'Review learning objectives', priority: 'must_discuss', context: 'Set expectations' },
        { point: 'Hands-on product demonstration', priority: 'must_discuss', context: 'Core content' },
        { point: 'Q&A and next steps', priority: 'should_discuss', context: 'Engagement' }
      ],
      other: [
        { point: `Discuss ${customerSnapshot.name}'s current priorities`, priority: 'should_discuss', context: 'Understanding needs' },
        { point: 'Review any outstanding items', priority: 'should_discuss', context: 'Follow-through' }
      ]
    };

    // Add open items as talking points
    const openItemPoints: TalkingPoint[] = openItems
      .filter(i => i.priority === 'high')
      .slice(0, 3)
      .map(i => ({
        point: `Address: ${i.description}`,
        priority: 'must_discuss' as const,
        context: `Open ${i.type}`
      }));

    return {
      objectives: [
        `Strengthen relationship with ${customerSnapshot.name}`,
        'Address any blockers or concerns',
        'Identify opportunities for additional value'
      ],
      talkingPoints: [
        ...openItemPoints,
        ...(talkingPointsByType[meetingType] || talkingPointsByType.other)
      ],
      questions: [
        'How has the team been finding the product lately?',
        'What are your key priorities for the coming quarter?',
        'Are there any pain points we should be addressing?',
        'How can we better support your goals?',
        'Who else on your team should we be engaging with?'
      ],
      recommendations: [
        'Review recent usage data before the call',
        'Prepare relevant success stories or case studies',
        'Have ROI data ready if value questions arise'
      ]
    };
  }

  // ==================== Database Operations ====================

  private async saveBrief(params: {
    calendarEventId: string;
    customerId: string;
    csmId: string;
    scheduledAt: Date;
    content: MeetingPrepContent;
    dataCompleteness: number;
  }): Promise<MeetingPrepBrief | null> {
    if (!supabase) {
      // Return mock brief for demo mode
      return {
        id: `mock_${Date.now()}`,
        calendarEventId: params.calendarEventId,
        customerId: params.customerId,
        csmId: params.csmId,
        scheduledAt: params.scheduledAt,
        content: params.content,
        status: 'scheduled',
        dataCompleteness: params.dataCompleteness
      };
    }

    const { data, error } = await supabase
      .from('meeting_prep_briefs')
      .upsert({
        calendar_event_id: params.calendarEventId,
        customer_id: params.customerId,
        csm_id: params.csmId,
        scheduled_at: params.scheduledAt.toISOString(),
        content: params.content,
        data_completeness: params.dataCompleteness,
        status: 'scheduled'
      }, {
        onConflict: 'calendar_event_id,csm_id'
      })
      .select()
      .single();

    if (error) {
      console.error('[MeetingPrep] Error saving brief:', error);
      return null;
    }

    return this.mapDbBriefToModel(data);
  }

  async getBriefById(id: string): Promise<MeetingPrepBrief | null> {
    if (!supabase) return null;

    const { data, error } = await supabase
      .from('meeting_prep_briefs')
      .select('*')
      .eq('id', id)
      .single();

    if (error || !data) return null;
    return this.mapDbBriefToModel(data);
  }

  async getBriefByCalendarEventId(eventId: string): Promise<MeetingPrepBrief | null> {
    if (!supabase) return null;

    const { data, error } = await supabase
      .from('meeting_prep_briefs')
      .select('*')
      .eq('calendar_event_id', eventId)
      .single();

    if (error || !data) return null;
    return this.mapDbBriefToModel(data);
  }

  async getTodaysBriefs(csmId: string): Promise<MeetingPrepBrief[]> {
    if (!supabase) {
      return this.getMockTodaysBriefs(csmId);
    }

    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);

    const todayEnd = new Date();
    todayEnd.setHours(23, 59, 59, 999);

    const { data, error } = await supabase
      .from('meeting_prep_briefs')
      .select('*')
      .eq('csm_id', csmId)
      .gte('scheduled_at', todayStart.toISOString())
      .lte('scheduled_at', todayEnd.toISOString())
      .order('scheduled_at', { ascending: true });

    if (error) {
      console.error('[MeetingPrep] Error fetching today\'s briefs:', error);
      return [];
    }

    return (data || []).map(d => this.mapDbBriefToModel(d));
  }

  async getUpcomingBriefs(csmId: string, days: number = 7): Promise<MeetingPrepBrief[]> {
    if (!supabase) {
      return this.getMockTodaysBriefs(csmId);
    }

    const now = new Date();
    const future = new Date(Date.now() + days * 24 * 60 * 60 * 1000);

    const { data, error } = await supabase
      .from('meeting_prep_briefs')
      .select('*')
      .eq('csm_id', csmId)
      .gte('scheduled_at', now.toISOString())
      .lte('scheduled_at', future.toISOString())
      .order('scheduled_at', { ascending: true });

    if (error) {
      console.error('[MeetingPrep] Error fetching upcoming briefs:', error);
      return [];
    }

    return (data || []).map(d => this.mapDbBriefToModel(d));
  }

  async markAsViewed(briefId: string): Promise<boolean> {
    if (!supabase) return true;

    const { error } = await supabase
      .from('meeting_prep_briefs')
      .update({
        status: 'viewed',
        viewed_at: new Date().toISOString()
      })
      .eq('id', briefId);

    return !error;
  }

  async markAsCompleted(briefId: string): Promise<boolean> {
    if (!supabase) return true;

    const { error } = await supabase
      .from('meeting_prep_briefs')
      .update({ status: 'completed' })
      .eq('id', briefId);

    return !error;
  }

  async refreshBrief(briefId: string): Promise<MeetingPrepBrief | null> {
    const existingBrief = await this.getBriefById(briefId);
    if (!existingBrief || !existingBrief.calendarEventId) return null;

    try {
      // Get the calendar event
      const event = await calendarService.getEvent(
        existingBrief.csmId,
        existingBrief.calendarEventId
      );

      // Regenerate the brief
      const newBrief = await this.generateBrief(
        event,
        existingBrief.customerId,
        existingBrief.csmId
      );

      return newBrief;
    } catch (error) {
      console.error('[MeetingPrep] Error refreshing brief:', error);
      return null;
    }
  }

  // ==================== Customer Matching ====================

  private async matchEventToCustomer(event: CalendarEvent): Promise<string | null> {
    if (!supabase) return 'mock_customer_id';

    // Extract attendee emails (excluding the CSM's own domain)
    const externalEmails = event.attendees
      .filter(a => a.email && !a.self && !a.organizer)
      .map(a => a.email!)
      .filter(email => !email.includes('resource.calendar'));

    if (externalEmails.length === 0) return null;

    // Try to match by stakeholder email
    for (const email of externalEmails) {
      const domain = email.split('@')[1];

      const { data } = await supabase
        .from('customers')
        .select('id')
        .ilike('domain', `%${domain}%`)
        .limit(1)
        .single();

      if (data) return data.id;
    }

    // Try matching by stakeholder email in stakeholders table
    for (const email of externalEmails) {
      const { data } = await supabase
        .from('stakeholders')
        .select('customer_id')
        .eq('email', email)
        .limit(1)
        .single();

      if (data) return data.customer_id;
    }

    return null;
  }

  // ==================== Preferences ====================

  async getPreferences(userId: string): Promise<MeetingPrepPreferences> {
    if (!supabase) {
      return this.getDefaultPreferences(userId);
    }

    const { data, error } = await supabase
      .from('meeting_prep_preferences')
      .select('*')
      .eq('user_id', userId)
      .single();

    if (error || !data) {
      return this.getDefaultPreferences(userId);
    }

    return {
      userId: data.user_id,
      initialLeadHours: data.initial_lead_hours,
      reminderLeadMinutes: data.reminder_lead_minutes,
      morningDigestEnabled: data.morning_digest_enabled,
      morningDigestTime: data.morning_digest_time,
      appNotifications: data.app_notifications,
      emailNotifications: data.email_notifications,
      slackNotifications: data.slack_notifications,
      includeStakeholderProfiles: data.include_stakeholder_profiles,
      includePreviousMeetings: data.include_previous_meetings,
      includeRiskSignals: data.include_risk_signals,
      maxTalkingPoints: data.max_talking_points,
      autoGenerateEnabled: data.auto_generate_enabled,
      minimumMeetingDurationMinutes: data.minimum_meeting_duration_minutes
    };
  }

  async updatePreferences(
    userId: string,
    updates: Partial<MeetingPrepPreferences>
  ): Promise<boolean> {
    if (!supabase) return true;

    const dbUpdates: Record<string, any> = {};
    if (updates.initialLeadHours !== undefined) dbUpdates.initial_lead_hours = updates.initialLeadHours;
    if (updates.reminderLeadMinutes !== undefined) dbUpdates.reminder_lead_minutes = updates.reminderLeadMinutes;
    if (updates.morningDigestEnabled !== undefined) dbUpdates.morning_digest_enabled = updates.morningDigestEnabled;
    if (updates.morningDigestTime !== undefined) dbUpdates.morning_digest_time = updates.morningDigestTime;
    if (updates.appNotifications !== undefined) dbUpdates.app_notifications = updates.appNotifications;
    if (updates.emailNotifications !== undefined) dbUpdates.email_notifications = updates.emailNotifications;
    if (updates.slackNotifications !== undefined) dbUpdates.slack_notifications = updates.slackNotifications;
    if (updates.includeStakeholderProfiles !== undefined) dbUpdates.include_stakeholder_profiles = updates.includeStakeholderProfiles;
    if (updates.includePreviousMeetings !== undefined) dbUpdates.include_previous_meetings = updates.includePreviousMeetings;
    if (updates.includeRiskSignals !== undefined) dbUpdates.include_risk_signals = updates.includeRiskSignals;
    if (updates.maxTalkingPoints !== undefined) dbUpdates.max_talking_points = updates.maxTalkingPoints;
    if (updates.autoGenerateEnabled !== undefined) dbUpdates.auto_generate_enabled = updates.autoGenerateEnabled;
    if (updates.minimumMeetingDurationMinutes !== undefined) dbUpdates.minimum_meeting_duration_minutes = updates.minimumMeetingDurationMinutes;

    const { error } = await supabase
      .from('meeting_prep_preferences')
      .upsert({
        user_id: userId,
        ...dbUpdates
      }, {
        onConflict: 'user_id'
      });

    return !error;
  }

  private getDefaultPreferences(userId: string): MeetingPrepPreferences {
    return {
      userId,
      initialLeadHours: 24,
      reminderLeadMinutes: 60,
      morningDigestEnabled: true,
      morningDigestTime: '08:00:00',
      appNotifications: true,
      emailNotifications: true,
      slackNotifications: false,
      includeStakeholderProfiles: true,
      includePreviousMeetings: true,
      includeRiskSignals: true,
      maxTalkingPoints: 7,
      autoGenerateEnabled: true,
      minimumMeetingDurationMinutes: 15
    };
  }

  // ==================== Helper Methods ====================

  private mapDbBriefToModel(data: any): MeetingPrepBrief {
    return {
      id: data.id,
      meetingId: data.meeting_id,
      calendarEventId: data.calendar_event_id,
      customerId: data.customer_id,
      csmId: data.csm_id,
      scheduledAt: new Date(data.scheduled_at),
      prepDeliveredAt: data.prep_delivered_at ? new Date(data.prep_delivered_at) : undefined,
      reminderDeliveredAt: data.reminder_delivered_at ? new Date(data.reminder_delivered_at) : undefined,
      content: data.content,
      status: data.status,
      viewedAt: data.viewed_at ? new Date(data.viewed_at) : undefined,
      dataCompleteness: data.data_completeness || 0
    };
  }

  private calculateDataCompleteness(content: MeetingPrepContent): number {
    let score = 0;
    const checks = [
      { hasData: !!content.customerSnapshot.name, weight: 20 },
      { hasData: content.recentActivity.length > 0, weight: 15 },
      { hasData: content.openItems.length > 0, weight: 10 },
      { hasData: content.talkingPoints.length > 0, weight: 20 },
      { hasData: content.questions.length > 0, weight: 10 },
      { hasData: content.attendeeProfiles.length > 0, weight: 15 },
      { hasData: content.previousMeetings.length > 0, weight: 10 }
    ];

    checks.forEach(check => {
      if (check.hasData) score += check.weight;
    });

    return score;
  }

  private formatActivityType(actionType: string): string {
    const typeMap: Record<string, string> = {
      'send_email': 'Email Sent',
      'draft_email': 'Email Drafted',
      'schedule_meeting': 'Meeting Scheduled',
      'book_meeting': 'Meeting Booked',
      'create_task': 'Task Created',
      'health_check': 'Health Check',
      'qbr_prep': 'QBR Preparation',
      'risk_assessment': 'Risk Assessment'
    };

    return typeMap[actionType] || actionType.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
  }

  // ==================== Mock Data ====================

  private getMockCustomerData() {
    return {
      id: 'mock_customer',
      name: 'Acme Corporation',
      health_score: 78,
      arr: 150000,
      contract_end: '2026-12-31',
      stage: 'active',
      industry: 'Technology',
      csm_name: 'Demo CSM'
    };
  }

  private getMockActivity(): ActivitySummary[] {
    return [
      { type: 'Email Sent', description: 'Check-in email sent', date: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString() },
      { type: 'Meeting', description: 'Monthly sync completed', date: new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString() },
      { type: 'Support Ticket', description: 'Integration issue resolved', date: new Date(Date.now() - 21 * 24 * 60 * 60 * 1000).toISOString() }
    ];
  }

  private getMockOpenItems(): OpenItem[] {
    return [
      { type: 'follow_up', description: 'Send updated ROI analysis', priority: 'high', dueDate: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString() },
      { type: 'task', description: 'Schedule training for new team members', priority: 'medium', owner: 'CSM' }
    ];
  }

  private getMockStakeholders(): any[] {
    return [
      { name: 'John Smith', title: 'VP Engineering', email: 'john@acme.com', metadata: { sentiment: 'positive' } },
      { name: 'Sarah Johnson', title: 'Product Manager', email: 'sarah@acme.com', metadata: { sentiment: 'neutral' } }
    ];
  }

  private getMockPreviousMeetings(): PreviousMeetingSummary[] {
    return [
      {
        date: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString(),
        title: 'Monthly Check-in',
        summary: 'Reviewed Q4 goals, discussed new feature rollout',
        decisions: ['Proceed with training program'],
        followUps: ['Send training schedule']
      }
    ];
  }

  private getMockHealthHistory(): Array<{ date: string; score: number }> {
    return [
      { date: new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString(), score: 72 },
      { date: new Date(Date.now() - 60 * 24 * 60 * 60 * 1000).toISOString(), score: 75 },
      { date: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString(), score: 78 }
    ];
  }

  private getMockTodaysBriefs(csmId: string): MeetingPrepBrief[] {
    const now = new Date();
    return [
      {
        id: 'mock_brief_1',
        calendarEventId: 'event_1',
        customerId: 'customer_1',
        csmId,
        scheduledAt: new Date(now.setHours(10, 0, 0, 0)),
        content: {
          customerSnapshot: {
            name: 'Acme Corporation',
            healthScore: 78,
            healthTrend: 'up',
            arr: 150000,
            renewalDate: '2026-12-31',
            stage: 'active',
            daysSinceLastMeeting: 30
          },
          recentActivity: this.getMockActivity(),
          openItems: this.getMockOpenItems(),
          talkingPoints: [
            { point: 'Review Q1 progress against goals', priority: 'must_discuss', context: 'QBR prep' },
            { point: 'Discuss new feature adoption', priority: 'should_discuss', context: 'Value demonstration' }
          ],
          questions: ['What are your priorities for Q2?', 'How is the new team member ramping up?'],
          attendeeProfiles: [
            { name: 'John Smith', role: 'VP Engineering', influence: 'decision_maker', sentiment: 'positive' }
          ],
          recommendations: ['Prepare ROI summary', 'Review support ticket trends'],
          previousMeetings: this.getMockPreviousMeetings(),
          meetingContext: { meetingType: 'check_in', objectives: ['Align on Q2 goals'] }
        },
        status: 'scheduled',
        dataCompleteness: 85
      }
    ];
  }
}

export const meetingPrepService = new MeetingPrepService();
