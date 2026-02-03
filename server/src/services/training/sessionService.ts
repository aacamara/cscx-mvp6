/**
 * Training Session Service
 * PRD-038: Training Invitation Personalization
 *
 * Manages training sessions, attendance tracking, and related operations.
 */

import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { config } from '../../config/index.js';

let supabase: SupabaseClient | null = null;
if (config.supabaseUrl && config.supabaseServiceKey) {
  supabase = createClient(config.supabaseUrl, config.supabaseServiceKey);
}

// Types
export interface CreateSessionParams {
  title: string;
  description?: string;
  topic: string;
  format?: 'webinar' | 'workshop' | 'self-paced' | 'one-on-one';
  durationMinutes?: number;
  scheduledAt?: string;
  timezone?: string;
  maxAttendees?: number;
  presenterName?: string;
  presenterEmail?: string;
  meetingUrl?: string;
  targetRoles?: string[];
  targetFeatures?: string[];
  skillLevel?: 'beginner' | 'intermediate' | 'advanced';
  isRecurring?: boolean;
  recurrencePattern?: any;
  registrationDeadline?: string;
  createdBy?: string;
}

export interface UpdateSessionParams extends Partial<CreateSessionParams> {
  status?: 'draft' | 'scheduled' | 'in_progress' | 'completed' | 'cancelled';
  recordingUrl?: string;
  materialsUrl?: string;
}

export interface RegisterAttendeeParams {
  trainingSessionId: string;
  customerId: string;
  stakeholderId?: string;
  invitationId?: string;
  attendeeEmail: string;
  attendeeName?: string;
  registrationSource?: 'invitation' | 'self_registered' | 'manual';
}

export interface RecordAttendanceParams {
  trainingSessionId: string;
  attendeeEmail: string;
  attended: boolean;
  joinedAt?: string;
  leftAt?: string;
  attendanceDurationMinutes?: number;
  engagementScore?: number;
}

export interface TrainingMetrics {
  totalSessions: number;
  upcomingSessions: number;
  completedSessions: number;
  totalInvitations: number;
  totalRegistrations: number;
  totalAttendees: number;
  averageAttendanceRate: number;
  averageFeedbackRating: number;
}

/**
 * Training Session Service Class
 */
export class TrainingSessionService {
  /**
   * Create a new training session
   */
  async createSession(params: CreateSessionParams): Promise<{ id: string; session: any }> {
    if (!supabase) {
      throw new Error('Database connection required');
    }

    const { data, error } = await supabase
      .from('training_sessions')
      .insert({
        title: params.title,
        description: params.description,
        topic: params.topic,
        format: params.format || 'webinar',
        duration_minutes: params.durationMinutes || 60,
        scheduled_at: params.scheduledAt,
        timezone: params.timezone || 'America/New_York',
        max_attendees: params.maxAttendees,
        presenter_name: params.presenterName,
        presenter_email: params.presenterEmail,
        meeting_url: params.meetingUrl,
        target_roles: params.targetRoles || [],
        target_features: params.targetFeatures || [],
        skill_level: params.skillLevel || 'intermediate',
        is_recurring: params.isRecurring || false,
        recurrence_pattern: params.recurrencePattern,
        registration_deadline: params.registrationDeadline,
        status: params.scheduledAt ? 'scheduled' : 'draft',
        created_by: params.createdBy,
      })
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to create session: ${error.message}`);
    }

    return { id: data.id, session: data };
  }

  /**
   * Update a training session
   */
  async updateSession(
    sessionId: string,
    params: UpdateSessionParams
  ): Promise<{ session: any }> {
    if (!supabase) {
      throw new Error('Database connection required');
    }

    const updateData: any = {};

    if (params.title !== undefined) updateData.title = params.title;
    if (params.description !== undefined) updateData.description = params.description;
    if (params.topic !== undefined) updateData.topic = params.topic;
    if (params.format !== undefined) updateData.format = params.format;
    if (params.durationMinutes !== undefined) updateData.duration_minutes = params.durationMinutes;
    if (params.scheduledAt !== undefined) updateData.scheduled_at = params.scheduledAt;
    if (params.timezone !== undefined) updateData.timezone = params.timezone;
    if (params.maxAttendees !== undefined) updateData.max_attendees = params.maxAttendees;
    if (params.presenterName !== undefined) updateData.presenter_name = params.presenterName;
    if (params.presenterEmail !== undefined) updateData.presenter_email = params.presenterEmail;
    if (params.meetingUrl !== undefined) updateData.meeting_url = params.meetingUrl;
    if (params.targetRoles !== undefined) updateData.target_roles = params.targetRoles;
    if (params.targetFeatures !== undefined) updateData.target_features = params.targetFeatures;
    if (params.skillLevel !== undefined) updateData.skill_level = params.skillLevel;
    if (params.status !== undefined) updateData.status = params.status;
    if (params.recordingUrl !== undefined) updateData.recording_url = params.recordingUrl;
    if (params.materialsUrl !== undefined) updateData.materials_url = params.materialsUrl;

    const { data, error } = await supabase
      .from('training_sessions')
      .update(updateData)
      .eq('id', sessionId)
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to update session: ${error.message}`);
    }

    return { session: data };
  }

  /**
   * Get a training session by ID
   */
  async getSession(sessionId: string): Promise<any> {
    if (!supabase) {
      throw new Error('Database connection required');
    }

    const { data, error } = await supabase
      .from('training_sessions')
      .select(`
        *,
        training_invitations(count),
        training_attendance(count)
      `)
      .eq('id', sessionId)
      .single();

    if (error) {
      throw new Error(`Session not found: ${error.message}`);
    }

    return data;
  }

  /**
   * List training sessions with filters
   */
  async listSessions(params: {
    status?: string;
    topic?: string;
    targetRole?: string;
    upcoming?: boolean;
    limit?: number;
    offset?: number;
  } = {}): Promise<{ sessions: any[]; total: number }> {
    if (!supabase) {
      throw new Error('Database connection required');
    }

    let query = supabase
      .from('training_sessions')
      .select('*', { count: 'exact' });

    if (params.status) {
      query = query.eq('status', params.status);
    }

    if (params.topic) {
      query = query.eq('topic', params.topic);
    }

    if (params.targetRole) {
      query = query.contains('target_roles', [params.targetRole]);
    }

    if (params.upcoming) {
      query = query.gte('scheduled_at', new Date().toISOString());
    }

    query = query.order('scheduled_at', { ascending: true });

    if (params.limit) {
      query = query.limit(params.limit);
    }

    if (params.offset) {
      query = query.range(params.offset, params.offset + (params.limit || 10) - 1);
    }

    const { data, error, count } = await query;

    if (error) {
      throw new Error(`Failed to list sessions: ${error.message}`);
    }

    return { sessions: data || [], total: count || 0 };
  }

  /**
   * Register an attendee for a training session
   */
  async registerAttendee(params: RegisterAttendeeParams): Promise<{ id: string; attendance: any }> {
    if (!supabase) {
      throw new Error('Database connection required');
    }

    // Check if already registered
    const { data: existing } = await supabase
      .from('training_attendance')
      .select('id')
      .eq('training_session_id', params.trainingSessionId)
      .eq('attendee_email', params.attendeeEmail)
      .single();

    if (existing) {
      throw new Error('Attendee already registered for this session');
    }

    // Check session capacity
    const { data: session } = await supabase
      .from('training_sessions')
      .select('max_attendees')
      .eq('id', params.trainingSessionId)
      .single();

    if (session?.max_attendees) {
      const { count } = await supabase
        .from('training_attendance')
        .select('*', { count: 'exact', head: true })
        .eq('training_session_id', params.trainingSessionId);

      if (count && count >= session.max_attendees) {
        throw new Error('Session is at full capacity');
      }
    }

    // Create registration
    const { data, error } = await supabase
      .from('training_attendance')
      .insert({
        training_session_id: params.trainingSessionId,
        training_invitation_id: params.invitationId,
        customer_id: params.customerId,
        stakeholder_id: params.stakeholderId,
        attendee_email: params.attendeeEmail,
        attendee_name: params.attendeeName,
        registration_source: params.registrationSource || 'invitation',
        registered_at: new Date().toISOString(),
      })
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to register: ${error.message}`);
    }

    // Update invitation status if applicable
    if (params.invitationId) {
      await supabase
        .from('training_invitations')
        .update({
          registered_at: new Date().toISOString(),
          status: 'registered',
        })
        .eq('id', params.invitationId);
    }

    return { id: data.id, attendance: data };
  }

  /**
   * Record attendance for a training session
   */
  async recordAttendance(params: RecordAttendanceParams): Promise<void> {
    if (!supabase) {
      throw new Error('Database connection required');
    }

    const updateData: any = {
      attended: params.attended,
    };

    if (params.joinedAt) updateData.joined_at = params.joinedAt;
    if (params.leftAt) updateData.left_at = params.leftAt;
    if (params.attendanceDurationMinutes) updateData.attendance_duration_minutes = params.attendanceDurationMinutes;
    if (params.engagementScore) updateData.engagement_score = params.engagementScore;

    const { error } = await supabase
      .from('training_attendance')
      .update(updateData)
      .eq('training_session_id', params.trainingSessionId)
      .eq('attendee_email', params.attendeeEmail);

    if (error) {
      throw new Error(`Failed to record attendance: ${error.message}`);
    }
  }

  /**
   * Submit feedback for a training session
   */
  async submitFeedback(
    trainingSessionId: string,
    attendeeEmail: string,
    rating: number,
    feedbackText?: string,
    followUpRequested?: boolean
  ): Promise<void> {
    if (!supabase) {
      throw new Error('Database connection required');
    }

    const { error } = await supabase
      .from('training_attendance')
      .update({
        feedback_rating: rating,
        feedback_text: feedbackText,
        follow_up_requested: followUpRequested || false,
      })
      .eq('training_session_id', trainingSessionId)
      .eq('attendee_email', attendeeEmail);

    if (error) {
      throw new Error(`Failed to submit feedback: ${error.message}`);
    }
  }

  /**
   * Get training metrics for analytics
   */
  async getMetrics(customerId?: string): Promise<TrainingMetrics> {
    if (!supabase) {
      throw new Error('Database connection required');
    }

    // Total sessions
    let sessionsQuery = supabase
      .from('training_sessions')
      .select('*', { count: 'exact', head: true });

    const { count: totalSessions } = await sessionsQuery;

    // Upcoming sessions
    const { count: upcomingSessions } = await supabase
      .from('training_sessions')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'scheduled')
      .gte('scheduled_at', new Date().toISOString());

    // Completed sessions
    const { count: completedSessions } = await supabase
      .from('training_sessions')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'completed');

    // Invitations
    let invitationsQuery = supabase
      .from('training_invitations')
      .select('*', { count: 'exact', head: true });

    if (customerId) {
      invitationsQuery = invitationsQuery.eq('customer_id', customerId);
    }

    const { count: totalInvitations } = await invitationsQuery;

    // Registrations and attendance
    let attendanceQuery = supabase
      .from('training_attendance')
      .select('*');

    if (customerId) {
      attendanceQuery = attendanceQuery.eq('customer_id', customerId);
    }

    const { data: attendanceData } = await attendanceQuery;

    const totalRegistrations = attendanceData?.length || 0;
    const totalAttendees = attendanceData?.filter((a: any) => a.attended).length || 0;
    const averageAttendanceRate = totalRegistrations > 0
      ? (totalAttendees / totalRegistrations) * 100
      : 0;

    // Average feedback rating
    const feedbackRatings = attendanceData
      ?.filter((a: any) => a.feedback_rating)
      .map((a: any) => a.feedback_rating) || [];
    const averageFeedbackRating = feedbackRatings.length > 0
      ? feedbackRatings.reduce((a: number, b: number) => a + b, 0) / feedbackRatings.length
      : 0;

    return {
      totalSessions: totalSessions || 0,
      upcomingSessions: upcomingSessions || 0,
      completedSessions: completedSessions || 0,
      totalInvitations: totalInvitations || 0,
      totalRegistrations,
      totalAttendees,
      averageAttendanceRate: Math.round(averageAttendanceRate * 10) / 10,
      averageFeedbackRating: Math.round(averageFeedbackRating * 10) / 10,
    };
  }

  /**
   * Get attendees for a training session
   */
  async getSessionAttendees(sessionId: string): Promise<any[]> {
    if (!supabase) {
      throw new Error('Database connection required');
    }

    const { data, error } = await supabase
      .from('training_attendance')
      .select(`
        *,
        stakeholders(name, role, email),
        customers(name)
      `)
      .eq('training_session_id', sessionId)
      .order('registered_at', { ascending: true });

    if (error) {
      throw new Error(`Failed to get attendees: ${error.message}`);
    }

    return data || [];
  }

  /**
   * Get invitations for a training session
   */
  async getSessionInvitations(sessionId: string): Promise<any[]> {
    if (!supabase) {
      throw new Error('Database connection required');
    }

    const { data, error } = await supabase
      .from('training_invitations')
      .select(`
        *,
        stakeholders(name, role),
        customers(name)
      `)
      .eq('training_session_id', sessionId)
      .order('created_at', { ascending: false });

    if (error) {
      throw new Error(`Failed to get invitations: ${error.message}`);
    }

    return data || [];
  }

  /**
   * Cancel a training session
   */
  async cancelSession(sessionId: string, reason?: string): Promise<void> {
    if (!supabase) {
      throw new Error('Database connection required');
    }

    await supabase
      .from('training_sessions')
      .update({
        status: 'cancelled',
        metadata: { cancellation_reason: reason },
      })
      .eq('id', sessionId);

    // Update all pending invitations
    await supabase
      .from('training_invitations')
      .update({ status: 'expired' })
      .eq('training_session_id', sessionId)
      .in('status', ['draft', 'pending_approval', 'approved', 'sent']);
  }

  /**
   * Mark a session as completed
   */
  async completeSession(
    sessionId: string,
    options?: { recordingUrl?: string; materialsUrl?: string }
  ): Promise<void> {
    if (!supabase) {
      throw new Error('Database connection required');
    }

    const updateData: any = { status: 'completed' };
    if (options?.recordingUrl) updateData.recording_url = options.recordingUrl;
    if (options?.materialsUrl) updateData.materials_url = options.materialsUrl;

    await supabase
      .from('training_sessions')
      .update(updateData)
      .eq('id', sessionId);
  }
}

// Singleton instance
export const trainingSessionService = new TrainingSessionService();

export default trainingSessionService;
