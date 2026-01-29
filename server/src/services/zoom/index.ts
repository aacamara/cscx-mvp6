/**
 * Zoom Service
 * Handles Zoom API interactions for meeting management and recordings
 */

import { config } from '../../config/index.js';

// ============================================
// Types
// ============================================

export interface ZoomMeeting {
  id: string;
  uuid: string;
  topic: string;
  type: number;
  start_time: string;
  duration: number;
  timezone: string;
  created_at: string;
  join_url: string;
  host_id: string;
  host_email?: string;
  status: 'waiting' | 'started' | 'finished';
  settings?: ZoomMeetingSettings;
}

export interface ZoomMeetingSettings {
  host_video: boolean;
  participant_video: boolean;
  join_before_host: boolean;
  mute_upon_entry: boolean;
  auto_recording: 'local' | 'cloud' | 'none';
  waiting_room: boolean;
}

export interface ZoomRecording {
  id: string;
  meeting_id: string;
  recording_start: string;
  recording_end: string;
  file_type: string;
  file_extension: string;
  file_size: number;
  download_url: string;
  status: 'processing' | 'completed';
  recording_type: 'shared_screen_with_speaker_view' | 'shared_screen_with_gallery_view' | 'audio_only' | 'audio_transcript' | 'chat_file';
}

export interface ZoomTranscript {
  meeting_id: string;
  recording_id: string;
  transcript_url: string;
  content?: string;
  vtt_content?: string;
}

export interface ZoomParticipant {
  id: string;
  user_id: string;
  user_name: string;
  email?: string;
  join_time: string;
  leave_time?: string;
  duration: number;
  attentiveness_score?: number;
}

export interface ZoomWebhookEvent {
  event: string;
  event_ts: number;
  payload: {
    account_id: string;
    object: any;
  };
}

export interface ZoomConnection {
  userId: string;
  accessToken: string;
  refreshToken: string;
  expiresAt: Date;
  accountId?: string;
  scope?: string[];
}

// ============================================
// Zoom Service Class
// ============================================

export class ZoomService {
  private baseUrl = 'https://api.zoom.us/v2';
  private connections: Map<string, ZoomConnection> = new Map();

  /**
   * Set connection for a user
   */
  setConnection(userId: string, connection: Omit<ZoomConnection, 'userId'>): void {
    this.connections.set(userId, { userId, ...connection });
  }

  /**
   * Get connection for a user
   */
  getConnection(userId: string): ZoomConnection | undefined {
    return this.connections.get(userId);
  }

  /**
   * Check if user has valid connection
   */
  hasValidConnection(userId: string): boolean {
    const connection = this.connections.get(userId);
    if (!connection) return false;
    return connection.expiresAt > new Date();
  }

  /**
   * Refresh access token
   */
  async refreshToken(userId: string): Promise<boolean> {
    const connection = this.connections.get(userId);
    if (!connection) return false;

    try {
      const response = await fetch('https://zoom.us/oauth/token', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'Authorization': `Basic ${Buffer.from(`${config.zoomClientId}:${config.zoomClientSecret}`).toString('base64')}`,
        },
        body: new URLSearchParams({
          grant_type: 'refresh_token',
          refresh_token: connection.refreshToken,
        }),
      });

      if (!response.ok) {
        console.error('Failed to refresh Zoom token:', await response.text());
        return false;
      }

      const data = await response.json();

      this.connections.set(userId, {
        ...connection,
        accessToken: data.access_token,
        refreshToken: data.refresh_token || connection.refreshToken,
        expiresAt: new Date(Date.now() + data.expires_in * 1000),
      });

      return true;
    } catch (error) {
      console.error('Error refreshing Zoom token:', error);
      return false;
    }
  }

  /**
   * Make authenticated API request
   */
  private async request<T>(
    userId: string,
    endpoint: string,
    options: RequestInit = {}
  ): Promise<T> {
    const connection = this.connections.get(userId);
    if (!connection) {
      throw new Error('No Zoom connection for user');
    }

    // Refresh token if expired
    if (connection.expiresAt <= new Date()) {
      const refreshed = await this.refreshToken(userId);
      if (!refreshed) {
        throw new Error('Failed to refresh Zoom token');
      }
    }

    const updatedConnection = this.connections.get(userId)!;

    const response = await fetch(`${this.baseUrl}${endpoint}`, {
      ...options,
      headers: {
        'Authorization': `Bearer ${updatedConnection.accessToken}`,
        'Content-Type': 'application/json',
        ...options.headers,
      },
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Zoom API error: ${response.status} - ${error}`);
    }

    return response.json();
  }

  // ============================================
  // Meetings
  // ============================================

  /**
   * List user's meetings
   */
  async listMeetings(
    userId: string,
    type: 'scheduled' | 'live' | 'upcoming' | 'upcoming_meetings' | 'previous_meetings' = 'upcoming',
    pageSize: number = 30
  ): Promise<{ meetings: ZoomMeeting[]; total_records: number }> {
    return this.request(userId, `/users/me/meetings?type=${type}&page_size=${pageSize}`);
  }

  /**
   * Get meeting details
   */
  async getMeeting(userId: string, meetingId: string): Promise<ZoomMeeting> {
    return this.request(userId, `/meetings/${meetingId}`);
  }

  /**
   * Create a meeting
   */
  async createMeeting(
    userId: string,
    options: {
      topic: string;
      type?: 1 | 2 | 3 | 8; // 1=instant, 2=scheduled, 3=recurring, 8=recurring fixed
      start_time?: string;
      duration?: number;
      timezone?: string;
      agenda?: string;
      settings?: Partial<ZoomMeetingSettings>;
    }
  ): Promise<ZoomMeeting> {
    return this.request(userId, '/users/me/meetings', {
      method: 'POST',
      body: JSON.stringify({
        topic: options.topic,
        type: options.type || 2,
        start_time: options.start_time,
        duration: options.duration || 60,
        timezone: options.timezone || 'UTC',
        agenda: options.agenda,
        settings: {
          host_video: true,
          participant_video: true,
          join_before_host: false,
          mute_upon_entry: true,
          auto_recording: 'cloud',
          waiting_room: true,
          ...options.settings,
        },
      }),
    });
  }

  /**
   * Update a meeting
   */
  async updateMeeting(
    userId: string,
    meetingId: string,
    updates: Partial<{
      topic: string;
      start_time: string;
      duration: number;
      agenda: string;
      settings: Partial<ZoomMeetingSettings>;
    }>
  ): Promise<void> {
    await this.request(userId, `/meetings/${meetingId}`, {
      method: 'PATCH',
      body: JSON.stringify(updates),
    });
  }

  /**
   * Delete a meeting
   */
  async deleteMeeting(userId: string, meetingId: string): Promise<void> {
    await this.request(userId, `/meetings/${meetingId}`, {
      method: 'DELETE',
    });
  }

  /**
   * Get meeting participants
   */
  async getMeetingParticipants(
    userId: string,
    meetingId: string
  ): Promise<{ participants: ZoomParticipant[] }> {
    return this.request(userId, `/past_meetings/${meetingId}/participants`);
  }

  // ============================================
  // Recordings
  // ============================================

  /**
   * List recordings for a meeting
   */
  async listRecordings(
    userId: string,
    from?: string,
    to?: string
  ): Promise<{ meetings: Array<{ uuid: string; recording_files: ZoomRecording[] }> }> {
    const params = new URLSearchParams();
    if (from) params.set('from', from);
    if (to) params.set('to', to);

    const query = params.toString() ? `?${params}` : '';
    return this.request(userId, `/users/me/recordings${query}`);
  }

  /**
   * Get recording details
   */
  async getRecording(userId: string, meetingId: string): Promise<{
    uuid: string;
    recording_files: ZoomRecording[];
  }> {
    return this.request(userId, `/meetings/${meetingId}/recordings`);
  }

  /**
   * Get transcript for a recording
   */
  async getTranscript(
    userId: string,
    meetingId: string,
    recordingId: string
  ): Promise<ZoomTranscript> {
    const recording = await this.getRecording(userId, meetingId);

    // Find transcript file
    const transcriptFile = recording.recording_files.find(
      (f) => f.recording_type === 'audio_transcript'
    );

    if (!transcriptFile) {
      throw new Error('No transcript available for this recording');
    }

    // Download transcript content
    const connection = this.connections.get(userId)!;
    const response = await fetch(transcriptFile.download_url, {
      headers: {
        'Authorization': `Bearer ${connection.accessToken}`,
      },
    });

    if (!response.ok) {
      throw new Error('Failed to download transcript');
    }

    const content = await response.text();

    return {
      meeting_id: meetingId,
      recording_id: recordingId,
      transcript_url: transcriptFile.download_url,
      vtt_content: content,
    };
  }

  /**
   * Delete a recording
   */
  async deleteRecording(userId: string, meetingId: string): Promise<void> {
    await this.request(userId, `/meetings/${meetingId}/recordings`, {
      method: 'DELETE',
    });
  }

  // ============================================
  // User Info
  // ============================================

  /**
   * Get current user info
   */
  async getCurrentUser(userId: string): Promise<{
    id: string;
    email: string;
    first_name: string;
    last_name: string;
    type: number;
    account_id: string;
  }> {
    return this.request(userId, '/users/me');
  }
}

// ============================================
// Singleton Export
// ============================================

export const zoomService = new ZoomService();
