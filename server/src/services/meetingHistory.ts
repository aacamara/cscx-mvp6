/**
 * Meeting History Service (PRD-077)
 *
 * Provides comprehensive view of all meetings with a customer account
 * including schedules, attendees, outcomes, action items, and follow-up status.
 */

import { SupabaseService } from './supabase.js';

// Type definitions (matching frontend types)
type MeetingStatus = 'scheduled' | 'completed' | 'cancelled' | 'no_show';
type MeetingTypeValue = 'kickoff' | 'check_in' | 'qbr' | 'training' | 'escalation' | 'expansion' | 'renewal' | 'executive' | 'technical' | 'other';
type OutcomeType = 'decision' | 'commitment' | 'insight' | 'risk' | 'opportunity';
type OutcomeStatus = 'open' | 'in_progress' | 'completed' | 'overdue';
type ActionItemStatus = 'pending' | 'completed' | 'overdue';
type AttendanceStatus = 'attended' | 'no_show' | 'partial';
type MeetingSentiment = 'positive' | 'neutral' | 'negative';

interface MeetingAttendee {
  email: string;
  name: string;
  role?: string;
  isInternal: boolean;
}

interface MeetingOutcome {
  id: string;
  type: OutcomeType;
  description: string;
  owner: string;
  dueDate: string | null;
  status: OutcomeStatus;
}

interface MeetingActionItem {
  id: string;
  description: string;
  owner: string;
  dueDate: string;
  status: ActionItemStatus;
  completedAt: string | null;
  notes?: string;
  meetingId: string;
  meetingTitle?: string;
  meetingDate?: string;
}

interface MeetingAnalysis {
  keyTopics: string[];
  customerSignals: string[];
  competitorMentions: string[];
  featureRequests: string[];
  riskIndicators: string[];
  expansionOpportunities: string[];
}

interface Meeting {
  id: string;
  customerId: string;
  customerName?: string;
  title: string;
  description: string;
  meetingType: MeetingTypeValue;
  scheduledAt: string;
  duration: number;
  status: MeetingStatus;
  organizer: string;
  internalAttendees: MeetingAttendee[];
  externalAttendees: MeetingAttendee[];
  attendanceStatus: Record<string, AttendanceStatus>;
  meetingUrl?: string;
  calendarEventId?: string;
  recordingUrl?: string;
  transcriptId?: string;
  summary?: string;
  outcomes: MeetingOutcome[];
  actionItems: MeetingActionItem[];
  nextMeeting?: string | null;
  sentiment?: MeetingSentiment;
  analysis?: MeetingAnalysis;
  createdAt: string;
  updatedAt: string;
}

interface MeetingStats {
  totalMeetings: number;
  meetingsThisQuarter: number;
  avgFrequency: string;
  attendanceRate: number;
  lastMeetingDate: string | null;
  lastMeetingDaysAgo: number | null;
  nextMeetingDate: string | null;
  nextMeetingType?: MeetingTypeValue;
  vsAverageTotal: number;
  vsAverageQuarter: string;
}

interface MeetingTypeDistribution {
  type: MeetingTypeValue;
  count: number;
  percentage: number;
  lastDate: string | null;
}

interface AttendeeAnalysis {
  name: string;
  email: string;
  role?: string;
  meetingsAttended: number;
  attendanceRate: number;
  lastAttendedDate: string | null;
  isExecutive: boolean;
  isChampion: boolean;
}

interface CommitmentTracking {
  commitment: string;
  madeDate: string;
  meetingId: string;
  owner: string;
  status: 'scheduled' | 'completed' | 'in_progress' | 'overdue';
  dueDate?: string;
  completedDate?: string;
}

interface PrepChecklistItem {
  id: string;
  description: string;
  completed: boolean;
  completedAt?: string;
}

interface UpcomingMeeting extends Meeting {
  prepStatus: 'not_started' | 'in_progress' | 'ready';
  prepProgress: number;
  prepChecklist: PrepChecklistItem[];
  agenda: string[];
  suggestedTopics: string[];
}

interface MeetingHistoryResponse {
  customerId: string;
  customerName: string;
  customerSince: string;
  stats: MeetingStats;
  upcomingMeetings: UpcomingMeeting[];
  recentMeetings: Meeting[];
  allMeetings: Meeting[];
  typeDistribution: MeetingTypeDistribution[];
  attendeeAnalysis: AttendeeAnalysis[];
  commitments: CommitmentTracking[];
  actionItems: {
    open: MeetingActionItem[];
    completed: MeetingActionItem[];
    overdue: MeetingActionItem[];
  };
  commitmentFulfillmentRate: number;
  totalCommitments: number;
  keptCommitments: number;
  generatedAt: string;
}

interface MeetingHistoryFilters {
  period?: 'all' | '6m' | '12m' | 'ytd';
  status?: 'all' | 'completed' | 'upcoming' | 'cancelled';
  meetingType?: MeetingTypeValue;
}

// Sample data for development/demo
const SAMPLE_CUSTOMERS: Record<string, { id: string; name: string; since: string }> = {
  'cust_acme': { id: 'cust_acme', name: 'Acme Corp', since: '2024-01-15' },
  'cust_techstar': { id: 'cust_techstar', name: 'TechStar Inc', since: '2023-06-01' },
  'cust_globex': { id: 'cust_globex', name: 'Globex Industries', since: '2024-03-20' },
};

function generateSampleMeetings(customerId: string): Meeting[] {
  const customer = SAMPLE_CUSTOMERS[customerId] || { id: customerId, name: 'Sample Customer', since: '2024-01-01' };
  const now = new Date();

  const meetings: Meeting[] = [
    // Upcoming QBR
    {
      id: `meeting_${customerId}_qbr_upcoming`,
      customerId,
      customerName: customer.name,
      title: 'Q1 2026 QBR',
      description: 'Quarterly Business Review for Q1 2026',
      meetingType: 'qbr',
      scheduledAt: new Date(now.getTime() + 5 * 24 * 60 * 60 * 1000).toISOString(),
      duration: 60,
      status: 'scheduled',
      organizer: 'sarah.johnson@company.com',
      internalAttendees: [
        { email: 'sarah.johnson@company.com', name: 'Sarah Johnson', role: 'CSM', isInternal: true },
        { email: 'mike.chen@company.com', name: 'Mike Chen', role: 'AE', isInternal: true },
      ],
      externalAttendees: [
        { email: 'sarah.chen@acme.com', name: 'Sarah Chen', role: 'VP Operations', isInternal: false },
        { email: 'tom.williams@acme.com', name: 'Tom Williams', role: 'CEO', isInternal: false },
      ],
      attendanceStatus: {},
      meetingUrl: 'https://zoom.us/j/123456789',
      outcomes: [],
      actionItems: [],
      createdAt: new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString(),
      updatedAt: new Date().toISOString(),
    },
    // Recent check-in
    {
      id: `meeting_${customerId}_checkin_recent`,
      customerId,
      customerName: customer.name,
      title: 'Monthly Check-in',
      description: 'Regular monthly touchpoint',
      meetingType: 'check_in',
      scheduledAt: new Date(now.getTime() - 6 * 24 * 60 * 60 * 1000).toISOString(),
      duration: 45,
      status: 'completed',
      organizer: 'sarah.johnson@company.com',
      internalAttendees: [
        { email: 'sarah.johnson@company.com', name: 'Sarah Johnson', role: 'CSM', isInternal: true },
      ],
      externalAttendees: [
        { email: 'sarah.chen@acme.com', name: 'Sarah Chen', role: 'VP Operations', isInternal: false },
        { email: 'mike.lee@acme.com', name: 'Mike Lee', role: 'Product Manager', isInternal: false },
      ],
      attendanceStatus: {
        'sarah.chen@acme.com': 'attended',
        'mike.lee@acme.com': 'attended',
      },
      summary: 'Discussed Q4 achievements and Q1 priorities. Sarah Chen shared that the team is seeing significant time savings. Mike Lee raised concerns about recent performance issues which have been escalated to support.',
      outcomes: [
        { id: 'outcome_1', type: 'commitment', description: 'Demo analytics module in Feb', owner: 'Sarah Johnson', dueDate: '2026-02-15', status: 'in_progress' },
        { id: 'outcome_2', type: 'risk', description: 'Performance issues flagged', owner: 'Support Team', dueDate: null, status: 'in_progress' },
        { id: 'outcome_3', type: 'insight', description: 'Marketing team interested in expansion', owner: 'Sarah Johnson', dueDate: null, status: 'open' },
      ],
      actionItems: [
        { id: 'action_1', description: 'Send analytics demo invite', owner: 'Sarah Johnson', dueDate: '2026-01-25', status: 'completed', completedAt: '2026-01-24', meetingId: `meeting_${customerId}_checkin_recent` },
        { id: 'action_2', description: 'Escalate performance ticket', owner: 'Sarah Johnson', dueDate: '2026-01-23', status: 'completed', completedAt: '2026-01-22', meetingId: `meeting_${customerId}_checkin_recent` },
        { id: 'action_3', description: 'Intro to Marketing VP', owner: 'Sarah Chen', dueDate: '2026-02-01', status: 'pending', completedAt: null, meetingId: `meeting_${customerId}_checkin_recent` },
      ],
      sentiment: 'positive',
      recordingUrl: 'https://zoom.us/rec/123',
      transcriptId: 'transcript_123',
      createdAt: new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000).toISOString(),
      updatedAt: new Date(now.getTime() - 6 * 24 * 60 * 60 * 1000).toISOString(),
    },
    // Q4 QBR
    {
      id: `meeting_${customerId}_qbr_q4`,
      customerId,
      customerName: customer.name,
      title: 'Q4 2025 QBR',
      description: 'Quarterly Business Review for Q4 2025',
      meetingType: 'qbr',
      scheduledAt: '2025-12-15T14:00:00Z',
      duration: 60,
      status: 'completed',
      organizer: 'sarah.johnson@company.com',
      internalAttendees: [
        { email: 'sarah.johnson@company.com', name: 'Sarah Johnson', role: 'CSM', isInternal: true },
        { email: 'mike.chen@company.com', name: 'Mike Chen', role: 'AE', isInternal: true },
        { email: 'jane.smith@company.com', name: 'Jane Smith', role: 'VP CS', isInternal: true },
      ],
      externalAttendees: [
        { email: 'sarah.chen@acme.com', name: 'Sarah Chen', role: 'VP Operations', isInternal: false },
        { email: 'tom.williams@acme.com', name: 'Tom Williams', role: 'CEO', isInternal: false },
      ],
      attendanceStatus: {
        'sarah.chen@acme.com': 'attended',
        'tom.williams@acme.com': 'attended',
      },
      summary: 'Successful QBR covering Q4 performance. Highlighted 45% efficiency improvement. Tom Williams expressed satisfaction and interest in expanding to additional departments. Jane Smith proposed multi-year renewal discussion for January.',
      outcomes: [
        { id: 'outcome_4', type: 'decision', description: 'Proceed with expansion planning', owner: 'Mike Chen', dueDate: null, status: 'in_progress' },
        { id: 'outcome_5', type: 'commitment', description: 'Multi-year renewal discussion', owner: 'Mike Chen', dueDate: '2026-02-05', status: 'in_progress' },
        { id: 'outcome_6', type: 'opportunity', description: 'Marketing department expansion', owner: 'Sarah Johnson', dueDate: null, status: 'open' },
      ],
      actionItems: [],
      sentiment: 'positive',
      recordingUrl: 'https://zoom.us/rec/456',
      transcriptId: 'transcript_456',
      createdAt: '2025-12-01T10:00:00Z',
      updatedAt: '2025-12-15T16:00:00Z',
    },
    // Escalation call
    {
      id: `meeting_${customerId}_escalation_1`,
      customerId,
      customerName: customer.name,
      title: 'Support Escalation Call',
      description: 'Emergency call to address critical bug affecting reports',
      meetingType: 'escalation',
      scheduledAt: '2025-12-01T09:00:00Z',
      duration: 30,
      status: 'completed',
      organizer: 'sarah.johnson@company.com',
      internalAttendees: [
        { email: 'sarah.johnson@company.com', name: 'Sarah Johnson', role: 'CSM', isInternal: true },
        { email: 'dev.team@company.com', name: 'Dev Team', role: 'Engineering', isInternal: true },
      ],
      externalAttendees: [
        { email: 'sarah.chen@acme.com', name: 'Sarah Chen', role: 'VP Operations', isInternal: false },
      ],
      attendanceStatus: {
        'sarah.chen@acme.com': 'attended',
      },
      summary: 'Emergency call to address critical bug affecting reports. Issue identified and fix deployed within 24 hours. Customer appreciated quick response. Offered service credit for inconvenience.',
      outcomes: [
        { id: 'outcome_7', type: 'decision', description: 'Issue resolved, relationship maintained', owner: 'Support Team', dueDate: null, status: 'completed' },
      ],
      actionItems: [],
      sentiment: 'neutral',
      createdAt: '2025-12-01T08:00:00Z',
      updatedAt: '2025-12-01T10:00:00Z',
    },
    // Training session
    {
      id: `meeting_${customerId}_training_1`,
      customerId,
      customerName: customer.name,
      title: 'Advanced Analytics Training',
      description: 'Deep dive into analytics features',
      meetingType: 'training',
      scheduledAt: '2025-10-10T15:00:00Z',
      duration: 90,
      status: 'completed',
      organizer: 'sarah.johnson@company.com',
      internalAttendees: [
        { email: 'sarah.johnson@company.com', name: 'Sarah Johnson', role: 'CSM', isInternal: true },
      ],
      externalAttendees: [
        { email: 'sarah.chen@acme.com', name: 'Sarah Chen', role: 'VP Operations', isInternal: false },
        { email: 'mike.lee@acme.com', name: 'Mike Lee', role: 'Product Manager', isInternal: false },
        { email: 'amy.wang@acme.com', name: 'Amy Wang', role: 'Data Analyst', isInternal: false },
      ],
      attendanceStatus: {
        'sarah.chen@acme.com': 'attended',
        'mike.lee@acme.com': 'attended',
        'amy.wang@acme.com': 'attended',
      },
      summary: 'Comprehensive training on advanced analytics features. Team showed strong engagement. Amy Wang identified several use cases for their data analysis workflow.',
      outcomes: [
        { id: 'outcome_8', type: 'insight', description: 'Strong interest in custom dashboards', owner: 'Sarah Johnson', dueDate: null, status: 'open' },
      ],
      actionItems: [],
      sentiment: 'positive',
      createdAt: '2025-10-01T10:00:00Z',
      updatedAt: '2025-10-10T17:00:00Z',
    },
  ];

  // Add more historical meetings
  const historicalDates = [
    { months: 2, type: 'check_in' as MeetingTypeValue },
    { months: 3, type: 'check_in' as MeetingTypeValue },
    { months: 4, type: 'check_in' as MeetingTypeValue },
    { months: 5, type: 'check_in' as MeetingTypeValue },
    { months: 6, type: 'qbr' as MeetingTypeValue },
    { months: 7, type: 'check_in' as MeetingTypeValue },
    { months: 8, type: 'check_in' as MeetingTypeValue },
    { months: 9, type: 'qbr' as MeetingTypeValue },
    { months: 10, type: 'check_in' as MeetingTypeValue },
    { months: 11, type: 'check_in' as MeetingTypeValue },
    { months: 12, type: 'qbr' as MeetingTypeValue },
  ];

  historicalDates.forEach((item, index) => {
    const date = new Date(now);
    date.setMonth(date.getMonth() - item.months);

    meetings.push({
      id: `meeting_${customerId}_historical_${index}`,
      customerId,
      customerName: customer.name,
      title: item.type === 'qbr' ? `Q${Math.ceil((12 - item.months) / 3)} QBR` : 'Monthly Check-in',
      description: item.type === 'qbr' ? 'Quarterly Business Review' : 'Regular monthly touchpoint',
      meetingType: item.type,
      scheduledAt: date.toISOString(),
      duration: item.type === 'qbr' ? 60 : 30,
      status: 'completed',
      organizer: 'sarah.johnson@company.com',
      internalAttendees: [
        { email: 'sarah.johnson@company.com', name: 'Sarah Johnson', role: 'CSM', isInternal: true },
      ],
      externalAttendees: [
        { email: 'sarah.chen@acme.com', name: 'Sarah Chen', role: 'VP Operations', isInternal: false },
      ],
      attendanceStatus: {
        'sarah.chen@acme.com': 'attended',
      },
      summary: `${item.type === 'qbr' ? 'Quarterly review' : 'Regular check-in'} meeting completed successfully.`,
      outcomes: [],
      actionItems: [],
      sentiment: 'positive',
      createdAt: date.toISOString(),
      updatedAt: date.toISOString(),
    });
  });

  return meetings;
}

class MeetingHistoryService {
  private db: SupabaseService;

  constructor() {
    this.db = new SupabaseService();
  }

  /**
   * Get complete meeting history for a customer
   */
  async getMeetingHistory(
    customerId: string,
    filters: MeetingHistoryFilters = {}
  ): Promise<MeetingHistoryResponse | null> {
    try {
      // Get customer info
      const customer = SAMPLE_CUSTOMERS[customerId] || { id: customerId, name: 'Customer', since: '2024-01-01' };

      // Get all meetings for the customer
      let meetings = generateSampleMeetings(customerId);

      // Apply filters
      if (filters.period && filters.period !== 'all') {
        const now = new Date();
        let cutoffDate: Date;

        switch (filters.period) {
          case '6m':
            cutoffDate = new Date(now.setMonth(now.getMonth() - 6));
            break;
          case '12m':
            cutoffDate = new Date(now.setFullYear(now.getFullYear() - 1));
            break;
          case 'ytd':
            cutoffDate = new Date(now.getFullYear(), 0, 1);
            break;
          default:
            cutoffDate = new Date(0);
        }

        meetings = meetings.filter(m => new Date(m.scheduledAt) >= cutoffDate);
      }

      if (filters.status && filters.status !== 'all') {
        switch (filters.status) {
          case 'completed':
            meetings = meetings.filter(m => m.status === 'completed');
            break;
          case 'upcoming':
            meetings = meetings.filter(m => m.status === 'scheduled');
            break;
          case 'cancelled':
            meetings = meetings.filter(m => m.status === 'cancelled');
            break;
        }
      }

      if (filters.meetingType) {
        meetings = meetings.filter(m => m.meetingType === filters.meetingType);
      }

      // Sort meetings by date
      meetings.sort((a, b) => new Date(b.scheduledAt).getTime() - new Date(a.scheduledAt).getTime());

      // Separate upcoming and completed
      const now = new Date();
      const upcomingMeetings = meetings
        .filter(m => m.status === 'scheduled' && new Date(m.scheduledAt) > now)
        .map(m => this.enrichUpcomingMeeting(m));

      const recentMeetings = meetings
        .filter(m => m.status === 'completed')
        .slice(0, 10);

      // Calculate stats
      const stats = this.calculateStats(meetings);

      // Calculate type distribution
      const typeDistribution = this.calculateTypeDistribution(meetings);

      // Calculate attendee analysis
      const attendeeAnalysis = this.calculateAttendeeAnalysis(meetings);

      // Extract commitments
      const commitments = this.extractCommitments(meetings);

      // Extract action items
      const allActionItems = meetings.flatMap(m =>
        m.actionItems.map(a => ({
          ...a,
          meetingTitle: m.title,
          meetingDate: m.scheduledAt
        }))
      );

      const actionItems = {
        open: allActionItems.filter(a => a.status === 'pending'),
        completed: allActionItems.filter(a => a.status === 'completed'),
        overdue: allActionItems.filter(a => {
          if (a.status === 'completed') return false;
          return new Date(a.dueDate) < now;
        }),
      };

      // Calculate commitment fulfillment
      const totalCommitments = commitments.length;
      const keptCommitments = commitments.filter(c => c.status === 'completed').length;
      const commitmentFulfillmentRate = totalCommitments > 0
        ? Math.round((keptCommitments / totalCommitments) * 100)
        : 100;

      return {
        customerId,
        customerName: customer.name,
        customerSince: customer.since,
        stats,
        upcomingMeetings,
        recentMeetings,
        allMeetings: meetings,
        typeDistribution,
        attendeeAnalysis,
        commitments,
        actionItems,
        commitmentFulfillmentRate,
        totalCommitments,
        keptCommitments,
        generatedAt: new Date().toISOString(),
      };
    } catch (error) {
      console.error('[MeetingHistory] Error getting meeting history:', error);
      return null;
    }
  }

  /**
   * Get a single meeting by ID
   */
  async getMeeting(meetingId: string): Promise<Meeting | null> {
    // In real implementation, fetch from database
    // For now, search through sample data
    for (const customerId of Object.keys(SAMPLE_CUSTOMERS)) {
      const meetings = generateSampleMeetings(customerId);
      const meeting = meetings.find(m => m.id === meetingId);
      if (meeting) return meeting;
    }
    return null;
  }

  /**
   * Update meeting outcomes
   */
  async updateMeetingOutcomes(
    meetingId: string,
    updates: {
      summary?: string;
      outcomes?: Omit<MeetingOutcome, 'id'>[];
      actionItems?: Omit<MeetingActionItem, 'id' | 'meetingId'>[];
      sentiment?: MeetingSentiment;
      nextMeeting?: string | null;
    }
  ): Promise<Meeting | null> {
    try {
      const meeting = await this.getMeeting(meetingId);
      if (!meeting) return null;

      // Apply updates
      if (updates.summary !== undefined) {
        meeting.summary = updates.summary;
      }

      if (updates.outcomes) {
        meeting.outcomes = updates.outcomes.map((o, idx) => ({
          ...o,
          id: `outcome_${meetingId}_${idx}`,
        }));
      }

      if (updates.actionItems) {
        meeting.actionItems = updates.actionItems.map((a, idx) => ({
          ...a,
          id: `action_${meetingId}_${idx}`,
          meetingId,
        }));
      }

      if (updates.sentiment !== undefined) {
        meeting.sentiment = updates.sentiment;
      }

      if (updates.nextMeeting !== undefined) {
        meeting.nextMeeting = updates.nextMeeting;
      }

      meeting.updatedAt = new Date().toISOString();

      // In real implementation, save to database
      return meeting;
    } catch (error) {
      console.error('[MeetingHistory] Error updating meeting outcomes:', error);
      return null;
    }
  }

  /**
   * Update action item status
   */
  async updateActionItem(
    actionItemId: string,
    updates: {
      status?: ActionItemStatus;
      notes?: string;
      completedAt?: string;
      dueDate?: string;
    }
  ): Promise<MeetingActionItem | null> {
    try {
      // In real implementation, fetch and update from database
      // For now, return a mock updated action item
      return {
        id: actionItemId,
        description: 'Updated action item',
        owner: 'User',
        dueDate: updates.dueDate || new Date().toISOString(),
        status: updates.status || 'pending',
        completedAt: updates.status === 'completed' ? (updates.completedAt || new Date().toISOString()) : null,
        notes: updates.notes,
        meetingId: 'meeting_123',
      };
    } catch (error) {
      console.error('[MeetingHistory] Error updating action item:', error);
      return null;
    }
  }

  // ============================================
  // Private Helper Methods
  // ============================================

  private enrichUpcomingMeeting(meeting: Meeting): UpcomingMeeting {
    // Generate prep checklist based on meeting type
    const prepChecklist: PrepChecklistItem[] = [];

    if (meeting.meetingType === 'qbr') {
      prepChecklist.push(
        { id: 'prep_1', description: 'Value summary drafted', completed: true, completedAt: new Date().toISOString() },
        { id: 'prep_2', description: 'Metrics pulled', completed: true, completedAt: new Date().toISOString() },
        { id: 'prep_3', description: 'Deck finalized', completed: false },
        { id: 'prep_4', description: 'Stakeholder objectives gathered', completed: false },
      );
    } else {
      prepChecklist.push(
        { id: 'prep_1', description: 'Review recent activity', completed: true, completedAt: new Date().toISOString() },
        { id: 'prep_2', description: 'Check open action items', completed: false },
        { id: 'prep_3', description: 'Prepare talking points', completed: false },
      );
    }

    const completedCount = prepChecklist.filter(p => p.completed).length;
    const prepProgress = Math.round((completedCount / prepChecklist.length) * 100);

    let prepStatus: 'not_started' | 'in_progress' | 'ready';
    if (prepProgress === 0) prepStatus = 'not_started';
    else if (prepProgress === 100) prepStatus = 'ready';
    else prepStatus = 'in_progress';

    // Generate suggested topics
    const suggestedTopics: string[] = [];
    if (meeting.meetingType === 'qbr') {
      suggestedTopics.push(
        'Value delivered review',
        'Success metrics update',
        'Q2 objectives alignment',
        'Expansion discussion',
        'Roadmap preview'
      );
    } else {
      suggestedTopics.push(
        'Recent usage highlights',
        'Open issues status',
        'Upcoming initiatives',
        'Feature requests'
      );
    }

    return {
      ...meeting,
      prepStatus,
      prepProgress,
      prepChecklist,
      agenda: suggestedTopics,
      suggestedTopics,
    };
  }

  private calculateStats(meetings: Meeting[]): MeetingStats {
    const now = new Date();
    const completedMeetings = meetings.filter(m => m.status === 'completed');
    const upcomingMeetings = meetings.filter(m => m.status === 'scheduled' && new Date(m.scheduledAt) > now);

    // Quarter start
    const quarterStart = new Date(now.getFullYear(), Math.floor(now.getMonth() / 3) * 3, 1);
    const meetingsThisQuarter = completedMeetings.filter(m => new Date(m.scheduledAt) >= quarterStart).length;

    // Last meeting
    const sortedCompleted = [...completedMeetings].sort(
      (a, b) => new Date(b.scheduledAt).getTime() - new Date(a.scheduledAt).getTime()
    );
    const lastMeeting = sortedCompleted[0];
    const lastMeetingDate = lastMeeting?.scheduledAt || null;
    const lastMeetingDaysAgo = lastMeeting
      ? Math.floor((now.getTime() - new Date(lastMeeting.scheduledAt).getTime()) / (24 * 60 * 60 * 1000))
      : null;

    // Next meeting
    const sortedUpcoming = [...upcomingMeetings].sort(
      (a, b) => new Date(a.scheduledAt).getTime() - new Date(b.scheduledAt).getTime()
    );
    const nextMeeting = sortedUpcoming[0];

    // Attendance rate
    let totalAttendees = 0;
    let attendedCount = 0;
    completedMeetings.forEach(m => {
      const statuses = Object.values(m.attendanceStatus);
      totalAttendees += statuses.length;
      attendedCount += statuses.filter(s => s === 'attended').length;
    });
    const attendanceRate = totalAttendees > 0 ? Math.round((attendedCount / totalAttendees) * 100) : 0;

    // Average frequency (meetings per month over the past year)
    const oneYearAgo = new Date(now);
    oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1);
    const meetingsLastYear = completedMeetings.filter(m => new Date(m.scheduledAt) >= oneYearAgo).length;
    const avgPerMonth = meetingsLastYear / 12;
    const avgFrequency = avgPerMonth >= 1 ? `${Math.round(avgPerMonth)}/month` : `${Math.round(avgPerMonth * 4)}/quarter`;

    // Compare to average (mock: assume average is 2/month)
    const avgTarget = 2;
    const vsAverageTotal = Math.round(((avgPerMonth - avgTarget) / avgTarget) * 100);

    // Quarter comparison
    const avgQuarterTarget = 6; // 2/month * 3 months
    let vsAverageQuarter: string;
    if (meetingsThisQuarter > avgQuarterTarget) vsAverageQuarter = 'above';
    else if (meetingsThisQuarter < avgQuarterTarget) vsAverageQuarter = 'below';
    else vsAverageQuarter = 'average';

    return {
      totalMeetings: completedMeetings.length,
      meetingsThisQuarter,
      avgFrequency,
      attendanceRate,
      lastMeetingDate,
      lastMeetingDaysAgo,
      nextMeetingDate: nextMeeting?.scheduledAt || null,
      nextMeetingType: nextMeeting?.meetingType,
      vsAverageTotal,
      vsAverageQuarter,
    };
  }

  private calculateTypeDistribution(meetings: Meeting[]): MeetingTypeDistribution[] {
    const completedMeetings = meetings.filter(m => m.status === 'completed');
    const typeCount: Record<MeetingTypeValue, { count: number; lastDate: string | null }> = {
      kickoff: { count: 0, lastDate: null },
      check_in: { count: 0, lastDate: null },
      qbr: { count: 0, lastDate: null },
      training: { count: 0, lastDate: null },
      escalation: { count: 0, lastDate: null },
      expansion: { count: 0, lastDate: null },
      renewal: { count: 0, lastDate: null },
      executive: { count: 0, lastDate: null },
      technical: { count: 0, lastDate: null },
      other: { count: 0, lastDate: null },
    };

    completedMeetings.forEach(m => {
      typeCount[m.meetingType].count++;
      if (!typeCount[m.meetingType].lastDate || new Date(m.scheduledAt) > new Date(typeCount[m.meetingType].lastDate!)) {
        typeCount[m.meetingType].lastDate = m.scheduledAt;
      }
    });

    const total = completedMeetings.length;

    return Object.entries(typeCount)
      .filter(([_, data]) => data.count > 0)
      .map(([type, data]) => ({
        type: type as MeetingTypeValue,
        count: data.count,
        percentage: total > 0 ? Math.round((data.count / total) * 100) : 0,
        lastDate: data.lastDate,
      }))
      .sort((a, b) => b.count - a.count);
  }

  private calculateAttendeeAnalysis(meetings: Meeting[]): AttendeeAnalysis[] {
    const completedMeetings = meetings.filter(m => m.status === 'completed');
    const attendeeStats: Record<string, {
      name: string;
      email: string;
      role?: string;
      meetingsInvited: number;
      meetingsAttended: number;
      lastAttendedDate: string | null;
    }> = {};

    completedMeetings.forEach(m => {
      m.externalAttendees.forEach(attendee => {
        if (!attendeeStats[attendee.email]) {
          attendeeStats[attendee.email] = {
            name: attendee.name,
            email: attendee.email,
            role: attendee.role,
            meetingsInvited: 0,
            meetingsAttended: 0,
            lastAttendedDate: null,
          };
        }

        attendeeStats[attendee.email].meetingsInvited++;

        const status = m.attendanceStatus[attendee.email];
        if (status === 'attended' || status === 'partial') {
          attendeeStats[attendee.email].meetingsAttended++;
          if (!attendeeStats[attendee.email].lastAttendedDate ||
              new Date(m.scheduledAt) > new Date(attendeeStats[attendee.email].lastAttendedDate!)) {
            attendeeStats[attendee.email].lastAttendedDate = m.scheduledAt;
          }
        }
      });
    });

    return Object.values(attendeeStats).map(stats => ({
      name: stats.name,
      email: stats.email,
      role: stats.role,
      meetingsAttended: stats.meetingsAttended,
      attendanceRate: stats.meetingsInvited > 0
        ? Math.round((stats.meetingsAttended / stats.meetingsInvited) * 100)
        : 0,
      lastAttendedDate: stats.lastAttendedDate,
      isExecutive: ['CEO', 'CFO', 'COO', 'CTO', 'VP', 'Director'].some(
        title => stats.role?.toLowerCase().includes(title.toLowerCase())
      ),
      isChampion: stats.attendanceRate >= 80 && stats.meetingsAttended >= 3,
    })).sort((a, b) => b.meetingsAttended - a.meetingsAttended);
  }

  private extractCommitments(meetings: Meeting[]): CommitmentTracking[] {
    const commitments: CommitmentTracking[] = [];

    meetings.forEach(m => {
      m.outcomes
        .filter(o => o.type === 'commitment' || o.type === 'decision')
        .forEach(o => {
          let status: 'scheduled' | 'completed' | 'in_progress' | 'overdue';

          if (o.status === 'completed') {
            status = 'completed';
          } else if (o.dueDate && new Date(o.dueDate) < new Date()) {
            status = 'overdue';
          } else if (o.status === 'in_progress') {
            status = 'in_progress';
          } else {
            status = 'scheduled';
          }

          commitments.push({
            commitment: o.description,
            madeDate: m.scheduledAt,
            meetingId: m.id,
            owner: o.owner,
            status,
            dueDate: o.dueDate || undefined,
            completedDate: o.status === 'completed' ? new Date().toISOString() : undefined,
          });
        });
    });

    return commitments.sort((a, b) => new Date(b.madeDate).getTime() - new Date(a.madeDate).getTime());
  }
}

export const meetingHistoryService = new MeetingHistoryService();
export default meetingHistoryService;
