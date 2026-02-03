/**
 * Zoom Meetings Service
 * PRD-209: Zoom Meeting Management - Database persistence and customer matching
 */

import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { config } from '../../config/index.js';
import { zoomService, ZoomMeeting, ZoomParticipant } from './index.js';

// Initialize Supabase client
const supabase = createClient(config.supabaseUrl!, config.supabaseServiceKey!);

// ============================================
// Types
// ============================================

export interface StoredZoomMeeting {
  id: string;
  meeting_id?: string;
  customer_id?: string;
  user_id: string;
  zoom_meeting_id: number;
  zoom_uuid?: string;
  topic?: string;
  agenda?: string;
  meeting_type?: number;
  start_time?: string;
  scheduled_duration_minutes?: number;
  actual_duration_minutes?: number;
  timezone?: string;
  status?: string;
  host_email?: string;
  host_id?: string;
  join_url?: string;
  start_url?: string;
  recording_url?: string;
  recording_download_url?: string;
  recording_file_size?: number;
  recording_duration_minutes?: number;
  recording_expires_at?: string;
  has_transcript?: boolean;
  transcript_file_url?: string;
  transcript_content?: string;
  transcript_vtt?: string;
  transcript_processed_at?: string;
  analysis_status?: string;
  analysis_result_id?: string;
  participant_count?: number;
  internal_participant_count?: number;
  external_participant_count?: number;
  participants?: any[];
  customer_match_method?: string;
  customer_match_confidence?: number;
  synced_at?: string;
  last_updated_from_zoom?: string;
  created_at?: string;
  updated_at?: string;
}

export interface StoredZoomParticipant {
  id: string;
  zoom_meeting_id: number;
  zoom_meetings_table_id?: string;
  participant_id?: string;
  participant_email?: string;
  participant_name?: string;
  stakeholder_id?: string;
  customer_id?: string;
  is_host?: boolean;
  is_internal?: boolean;
  join_time?: string;
  leave_time?: string;
  duration_minutes?: number;
  attended?: boolean;
  was_no_show?: boolean;
  attentiveness_score?: number;
  created_at?: string;
  updated_at?: string;
}

export interface CustomerMatch {
  customer_id: string;
  customer_name: string;
  match_method: 'email' | 'topic' | 'stakeholder';
  confidence: number;
}

export interface MeetingSyncResult {
  meeting: StoredZoomMeeting;
  participants: StoredZoomParticipant[];
  customerMatch?: CustomerMatch;
  isNew: boolean;
}

// ============================================
// Zoom Meetings Database Service
// ============================================

export class ZoomMeetingsService {
  /**
   * Sync a Zoom meeting to the database
   */
  async syncMeeting(
    userId: string,
    zoomMeeting: ZoomMeeting,
    participants?: ZoomParticipant[]
  ): Promise<MeetingSyncResult> {
    // Check if meeting already exists
    const { data: existing } = await supabase
      .from('zoom_meetings')
      .select('*')
      .eq('zoom_meeting_id', parseInt(zoomMeeting.id))
      .single();

    // Try to match to a customer
    const customerMatch = await this.matchMeetingToCustomer(
      zoomMeeting,
      participants
    );

    // Prepare meeting data
    const meetingData: Partial<StoredZoomMeeting> = {
      user_id: userId,
      zoom_meeting_id: parseInt(zoomMeeting.id),
      zoom_uuid: zoomMeeting.uuid,
      topic: zoomMeeting.topic,
      meeting_type: zoomMeeting.type,
      start_time: zoomMeeting.start_time,
      scheduled_duration_minutes: zoomMeeting.duration,
      timezone: zoomMeeting.timezone,
      status: zoomMeeting.status,
      host_email: zoomMeeting.host_email,
      host_id: zoomMeeting.host_id,
      join_url: zoomMeeting.join_url,
      participant_count: participants?.length || 0,
      customer_id: customerMatch?.customer_id,
      customer_match_method: customerMatch?.match_method,
      customer_match_confidence: customerMatch?.confidence,
      synced_at: new Date().toISOString(),
      last_updated_from_zoom: new Date().toISOString(),
    };

    let storedMeeting: StoredZoomMeeting;
    let isNew = !existing;

    if (existing) {
      // Update existing
      const { data, error } = await supabase
        .from('zoom_meetings')
        .update(meetingData)
        .eq('id', existing.id)
        .select()
        .single();

      if (error) {
        console.error('Error updating zoom meeting:', error);
        throw new Error('Failed to update meeting');
      }
      storedMeeting = data;
    } else {
      // Insert new
      const { data, error } = await supabase
        .from('zoom_meetings')
        .insert(meetingData)
        .select()
        .single();

      if (error) {
        console.error('Error inserting zoom meeting:', error);
        throw new Error('Failed to insert meeting');
      }
      storedMeeting = data;
    }

    // Sync participants
    const storedParticipants = await this.syncParticipants(
      storedMeeting,
      participants || []
    );

    return {
      meeting: storedMeeting,
      participants: storedParticipants,
      customerMatch,
      isNew,
    };
  }

  /**
   * Sync participants for a meeting
   */
  async syncParticipants(
    meeting: StoredZoomMeeting,
    participants: ZoomParticipant[]
  ): Promise<StoredZoomParticipant[]> {
    const results: StoredZoomParticipant[] = [];

    // Get list of internal domain(s) - could be extended to be configurable
    const internalDomains = await this.getInternalDomains(meeting.user_id);

    for (const participant of participants) {
      const isInternal = participant.email
        ? internalDomains.some((d) => participant.email?.endsWith(`@${d}`))
        : false;

      // Try to match to a stakeholder
      const stakeholderMatch = await this.matchParticipantToStakeholder(
        participant.email
      );

      const participantData: Partial<StoredZoomParticipant> = {
        zoom_meeting_id: meeting.zoom_meeting_id,
        zoom_meetings_table_id: meeting.id,
        participant_id: participant.user_id,
        participant_email: participant.email,
        participant_name: participant.user_name,
        is_internal: isInternal,
        join_time: participant.join_time,
        leave_time: participant.leave_time,
        duration_minutes: participant.duration,
        attended: true,
        attentiveness_score: participant.attentiveness_score,
        stakeholder_id: stakeholderMatch?.stakeholder_id,
        customer_id: stakeholderMatch?.customer_id,
      };

      // Check if participant already exists
      const { data: existing } = await supabase
        .from('zoom_participants')
        .select('id')
        .eq('zoom_meetings_table_id', meeting.id)
        .eq('participant_email', participant.email || '')
        .single();

      let stored: StoredZoomParticipant;

      if (existing) {
        const { data, error } = await supabase
          .from('zoom_participants')
          .update(participantData)
          .eq('id', existing.id)
          .select()
          .single();

        if (error) {
          console.error('Error updating participant:', error);
          continue;
        }
        stored = data;
      } else {
        const { data, error } = await supabase
          .from('zoom_participants')
          .insert(participantData)
          .select()
          .single();

        if (error) {
          console.error('Error inserting participant:', error);
          continue;
        }
        stored = data;
      }

      results.push(stored);
    }

    // Update meeting participant counts
    const internalCount = results.filter((p) => p.is_internal).length;
    const externalCount = results.filter((p) => !p.is_internal).length;

    await supabase
      .from('zoom_meetings')
      .update({
        participant_count: results.length,
        internal_participant_count: internalCount,
        external_participant_count: externalCount,
      })
      .eq('id', meeting.id);

    return results;
  }

  /**
   * Match a meeting to a customer based on participants and topic
   */
  async matchMeetingToCustomer(
    meeting: ZoomMeeting,
    participants?: ZoomParticipant[]
  ): Promise<CustomerMatch | undefined> {
    // Strategy 1: Match by participant email domain
    if (participants && participants.length > 0) {
      const externalEmails = participants
        .filter((p) => p.email && !this.isInternalEmail(p.email))
        .map((p) => p.email!);

      for (const email of externalEmails) {
        const domain = email.split('@')[1];
        if (domain) {
          const { data: customer } = await supabase
            .from('customers')
            .select('id, name')
            .or(`domain.eq.${domain},website.ilike.%${domain}%`)
            .single();

          if (customer) {
            return {
              customer_id: customer.id,
              customer_name: customer.name,
              match_method: 'email',
              confidence: 0.9,
            };
          }
        }
      }
    }

    // Strategy 2: Match by stakeholder email
    if (participants && participants.length > 0) {
      for (const participant of participants) {
        if (participant.email) {
          const { data: stakeholder } = await supabase
            .from('stakeholders')
            .select('customer_id, customers(id, name)')
            .eq('email', participant.email)
            .single();

          if (stakeholder?.customer_id) {
            return {
              customer_id: stakeholder.customer_id,
              customer_name: (stakeholder.customers as any)?.name || '',
              match_method: 'stakeholder',
              confidence: 0.95,
            };
          }
        }
      }
    }

    // Strategy 3: Match by topic/name
    if (meeting.topic) {
      const { data: customers } = await supabase
        .from('customers')
        .select('id, name');

      if (customers) {
        for (const customer of customers) {
          if (
            meeting.topic.toLowerCase().includes(customer.name.toLowerCase())
          ) {
            return {
              customer_id: customer.id,
              customer_name: customer.name,
              match_method: 'topic',
              confidence: 0.7,
            };
          }
        }
      }
    }

    return undefined;
  }

  /**
   * Match participant email to a stakeholder
   */
  async matchParticipantToStakeholder(
    email?: string
  ): Promise<{ stakeholder_id: string; customer_id: string } | undefined> {
    if (!email) return undefined;

    const { data } = await supabase
      .from('stakeholders')
      .select('id, customer_id')
      .eq('email', email)
      .single();

    if (data) {
      return {
        stakeholder_id: data.id,
        customer_id: data.customer_id,
      };
    }

    return undefined;
  }

  /**
   * Get internal email domains
   */
  async getInternalDomains(userId: string): Promise<string[]> {
    // For now, derive from user's email domain
    // Could be extended to pull from organization settings
    const { data: connection } = await supabase
      .from('zoom_connections')
      .select('email')
      .eq('user_id', userId)
      .single();

    if (connection?.email) {
      const domain = connection.email.split('@')[1];
      if (domain) return [domain];
    }

    return [];
  }

  /**
   * Check if email is internal (basic check)
   */
  isInternalEmail(email: string): boolean {
    // Add more domains as needed
    const internalDomains = ['gmail.com', 'outlook.com', 'hotmail.com'];
    return !internalDomains.some((d) => email.endsWith(`@${d}`));
  }

  /**
   * List meetings for a user
   */
  async listMeetings(
    userId: string,
    options: {
      customerId?: string;
      status?: string;
      limit?: number;
      offset?: number;
      startAfter?: string;
      startBefore?: string;
    } = {}
  ): Promise<{ meetings: StoredZoomMeeting[]; total: number }> {
    let query = supabase
      .from('zoom_meetings')
      .select('*, customers(id, name)', { count: 'exact' })
      .eq('user_id', userId)
      .order('start_time', { ascending: false });

    if (options.customerId) {
      query = query.eq('customer_id', options.customerId);
    }

    if (options.status) {
      query = query.eq('status', options.status);
    }

    if (options.startAfter) {
      query = query.gte('start_time', options.startAfter);
    }

    if (options.startBefore) {
      query = query.lte('start_time', options.startBefore);
    }

    if (options.limit) {
      query = query.limit(options.limit);
    }

    if (options.offset) {
      query = query.range(options.offset, options.offset + (options.limit || 10) - 1);
    }

    const { data, error, count } = await query;

    if (error) {
      console.error('Error listing meetings:', error);
      throw new Error('Failed to list meetings');
    }

    return {
      meetings: data || [],
      total: count || 0,
    };
  }

  /**
   * Get a meeting by ID
   */
  async getMeeting(
    userId: string,
    meetingId: string
  ): Promise<StoredZoomMeeting | null> {
    const { data, error } = await supabase
      .from('zoom_meetings')
      .select('*, customers(id, name)')
      .eq('user_id', userId)
      .eq('id', meetingId)
      .single();

    if (error) {
      if (error.code === 'PGRST116') return null;
      console.error('Error getting meeting:', error);
      throw new Error('Failed to get meeting');
    }

    return data;
  }

  /**
   * Get meetings for a customer
   */
  async getMeetingsForCustomer(
    customerId: string,
    limit: number = 10
  ): Promise<StoredZoomMeeting[]> {
    const { data, error } = await supabase
      .from('zoom_meetings')
      .select('*')
      .eq('customer_id', customerId)
      .order('start_time', { ascending: false })
      .limit(limit);

    if (error) {
      console.error('Error getting customer meetings:', error);
      return [];
    }

    return data || [];
  }

  /**
   * Update meeting recording info
   */
  async updateRecordingInfo(
    zoomMeetingId: number,
    recordingInfo: {
      recording_url?: string;
      recording_download_url?: string;
      recording_file_size?: number;
      recording_duration_minutes?: number;
      recording_expires_at?: string;
      has_transcript?: boolean;
      transcript_file_url?: string;
    }
  ): Promise<StoredZoomMeeting | null> {
    const { data, error } = await supabase
      .from('zoom_meetings')
      .update({
        ...recordingInfo,
        last_updated_from_zoom: new Date().toISOString(),
      })
      .eq('zoom_meeting_id', zoomMeetingId)
      .select()
      .single();

    if (error) {
      console.error('Error updating recording info:', error);
      return null;
    }

    return data;
  }

  /**
   * Update meeting transcript
   */
  async updateTranscript(
    zoomMeetingId: number,
    transcriptContent: string,
    vttContent?: string
  ): Promise<StoredZoomMeeting | null> {
    const { data, error } = await supabase
      .from('zoom_meetings')
      .update({
        has_transcript: true,
        transcript_content: transcriptContent,
        transcript_vtt: vttContent,
        transcript_processed_at: new Date().toISOString(),
      })
      .eq('zoom_meeting_id', zoomMeetingId)
      .select()
      .single();

    if (error) {
      console.error('Error updating transcript:', error);
      return null;
    }

    return data;
  }

  /**
   * Link meeting to customer manually
   */
  async linkMeetingToCustomer(
    meetingId: string,
    customerId: string,
    userId: string
  ): Promise<StoredZoomMeeting | null> {
    const { data, error } = await supabase
      .from('zoom_meetings')
      .update({
        customer_id: customerId,
        customer_match_method: 'manual',
        customer_match_confidence: 1.0,
      })
      .eq('id', meetingId)
      .eq('user_id', userId)
      .select()
      .single();

    if (error) {
      console.error('Error linking meeting to customer:', error);
      return null;
    }

    return data;
  }

  /**
   * Log a webhook event
   */
  async logWebhookEvent(
    eventType: string,
    eventTs: number,
    accountId: string,
    zoomMeetingId: number | undefined,
    payload: any
  ): Promise<string> {
    const { data, error } = await supabase
      .from('zoom_webhook_events')
      .insert({
        event_type: eventType,
        event_ts: eventTs,
        account_id: accountId,
        zoom_meeting_id: zoomMeetingId,
        payload,
      })
      .select('id')
      .single();

    if (error) {
      console.error('Error logging webhook:', error);
      throw new Error('Failed to log webhook');
    }

    return data.id;
  }

  /**
   * Mark webhook as processed
   */
  async markWebhookProcessed(
    webhookId: string,
    error?: string
  ): Promise<void> {
    await supabase
      .from('zoom_webhook_events')
      .update({
        processed: true,
        processed_at: new Date().toISOString(),
        processing_error: error,
      })
      .eq('id', webhookId);
  }

  /**
   * Sync all meetings from Zoom for a user
   */
  async syncAllMeetings(
    userId: string,
    type: 'upcoming' | 'previous_meetings' = 'upcoming'
  ): Promise<{ synced: number; errors: string[] }> {
    const errors: string[] = [];
    let synced = 0;

    try {
      const { meetings } = await zoomService.listMeetings(userId, type, 100);

      for (const meeting of meetings) {
        try {
          // Get participants if meeting has ended
          let participants: ZoomParticipant[] = [];
          if (meeting.status === 'finished') {
            try {
              const participantData = await zoomService.getMeetingParticipants(
                userId,
                meeting.id
              );
              participants = participantData.participants || [];
            } catch (err) {
              // Participants may not be available for all meetings
              console.log(`Could not get participants for meeting ${meeting.id}`);
            }
          }

          await this.syncMeeting(userId, meeting, participants);
          synced++;
        } catch (err) {
          const error = err instanceof Error ? err.message : 'Unknown error';
          errors.push(`Meeting ${meeting.id}: ${error}`);
        }
      }
    } catch (err) {
      const error = err instanceof Error ? err.message : 'Unknown error';
      errors.push(`Failed to list meetings: ${error}`);
    }

    return { synced, errors };
  }

  /**
   * Get attendance stats for a customer
   */
  async getCustomerAttendanceStats(
    customerId: string
  ): Promise<{
    totalMeetings: number;
    totalAttended: number;
    avgAttendance: number;
    noShows: number;
    lastMeetingAt?: string;
  }> {
    const { data: meetings } = await supabase
      .from('zoom_meetings')
      .select('id, start_time, participant_count')
      .eq('customer_id', customerId)
      .eq('status', 'ended')
      .order('start_time', { ascending: false });

    if (!meetings || meetings.length === 0) {
      return {
        totalMeetings: 0,
        totalAttended: 0,
        avgAttendance: 0,
        noShows: 0,
      };
    }

    const { data: noShowCount } = await supabase
      .from('zoom_participants')
      .select('id')
      .eq('customer_id', customerId)
      .eq('was_no_show', true);

    const totalMeetings = meetings.length;
    const totalAttended = meetings.filter((m) => (m.participant_count || 0) > 0).length;
    const noShows = noShowCount?.length || 0;

    return {
      totalMeetings,
      totalAttended,
      avgAttendance: totalMeetings > 0 ? totalAttended / totalMeetings : 0,
      noShows,
      lastMeetingAt: meetings[0]?.start_time,
    };
  }
}

// Singleton export
export const zoomMeetingsService = new ZoomMeetingsService();
