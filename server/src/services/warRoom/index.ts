/**
 * PRD-121: War Room Service
 *
 * Handles automated war room creation and management for escalations.
 * Creates Slack channels, generates escalation briefs, and coordinates
 * stakeholder communication.
 */

import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { config } from '../../config/index.js';
import { slackService, SlackChannel } from '../slack/index.js';
import { docsService } from '../google/docs.js';
import { calendarService } from '../google/calendar.js';
import type {
  Escalation,
  EscalationSeverity,
  EscalationCategory,
  WarRoom,
  Participant,
  ParticipantRole,
  StatusUpdate,
  MeetingRef,
  CommunicationLog,
  Resolution,
  DEFAULT_PARTICIPANTS,
  STATUS_UPDATE_SCHEDULE,
  COMMUNICATION_TEMPLATES,
} from '../../../types/escalation.js';

// ============================================
// Types
// ============================================

interface CreateWarRoomOptions {
  escalation: Escalation;
  userId: string;
  participantEmails?: Record<ParticipantRole, string>;
}

interface WarRoomResult {
  warRoom: WarRoom;
  slackChannel: SlackChannel;
  briefDocumentUrl: string;
}

interface TeamMember {
  userId: string;
  name: string;
  email: string;
  role: ParticipantRole;
  slackUserId?: string;
}

// ============================================
// War Room Service
// ============================================

export class WarRoomService {
  private supabase: SupabaseClient | null = null;

  constructor() {
    if (config.supabaseUrl && config.supabaseServiceKey) {
      this.supabase = createClient(config.supabaseUrl, config.supabaseServiceKey);
    }
  }

  // ============================================
  // War Room Creation
  // ============================================

  /**
   * Create a war room for an escalation
   * This is the main entry point that orchestrates all war room setup
   */
  async createWarRoom(options: CreateWarRoomOptions): Promise<WarRoomResult> {
    const { escalation, userId, participantEmails } = options;
    const startTime = Date.now();

    console.log(`[WarRoom] Creating war room for escalation ${escalation.id}`);

    // 1. Generate channel name
    const channelName = this.generateChannelName(escalation);
    console.log(`[WarRoom] Generated channel name: ${channelName}`);

    // 2. Create Slack channel
    const slackChannel = await this.createSlackChannel(userId, channelName, escalation);
    console.log(`[WarRoom] Slack channel created: ${slackChannel.id}`);

    // 3. Determine participants based on escalation category and severity
    const participants = await this.determineParticipants(
      escalation,
      userId,
      participantEmails
    );
    console.log(`[WarRoom] Determined ${participants.length} participants`);

    // 4. Add participants to Slack channel
    await this.addParticipantsToChannel(userId, slackChannel.id, participants);
    console.log(`[WarRoom] Added participants to Slack channel`);

    // 5. Create escalation brief document
    const briefDoc = await this.createEscalationBrief(userId, escalation);
    console.log(`[WarRoom] Created escalation brief: ${briefDoc.documentUrl}`);

    // 6. Pin the brief to the Slack channel
    await this.pinBriefToChannel(userId, slackChannel.id, briefDoc.documentUrl, escalation);
    console.log(`[WarRoom] Pinned brief to channel`);

    // 7. Schedule initial coordination meetings
    const meetings = await this.scheduleInitialMeetings(userId, escalation, participants);
    console.log(`[WarRoom] Scheduled ${meetings.length} initial meetings`);

    // 8. Generate communication templates
    const communications = await this.generateCommunicationTemplates(userId, escalation);
    console.log(`[WarRoom] Generated ${communications.length} communication templates`);

    // 9. Create war room record
    const warRoom: WarRoom = {
      id: this.generateId(),
      escalationId: escalation.id,
      slackChannelId: slackChannel.id,
      slackChannelName: channelName,
      slackChannelUrl: `https://slack.com/app_redirect?channel=${slackChannel.id}`,
      participants,
      briefDocumentId: briefDoc.documentId,
      briefDocumentUrl: briefDoc.documentUrl,
      dashboardUrl: `/escalations/${escalation.id}/war-room`,
      statusUpdates: [],
      meetings,
      communications,
      resolution: null,
      createdAt: new Date(),
      closedAt: null,
      archivedAt: null,
    };

    // 10. Save war room to database
    await this.saveWarRoom(warRoom);
    console.log(`[WarRoom] Saved war room to database`);

    // 11. Send initial notifications
    await this.sendInitialNotifications(userId, escalation, warRoom, participants);
    console.log(`[WarRoom] Sent initial notifications`);

    const duration = Date.now() - startTime;
    console.log(`[WarRoom] War room created in ${duration}ms`);

    return {
      warRoom,
      slackChannel,
      briefDocumentUrl: briefDoc.documentUrl,
    };
  }

  /**
   * Generate a standardized war room channel name
   */
  private generateChannelName(escalation: Escalation): string {
    const customerSlug = escalation.customerName
      .toLowerCase()
      .replace(/[^a-z0-9]/g, '-')
      .replace(/-+/g, '-')
      .substring(0, 20);

    const date = new Date().toISOString().split('T')[0].replace(/-/g, '');

    return `war-room-${customerSlug}-${date}`;
  }

  /**
   * Create a private Slack channel for the war room
   */
  private async createSlackChannel(
    userId: string,
    channelName: string,
    escalation: Escalation
  ): Promise<SlackChannel> {
    const client = await slackService.getClient(userId);

    // Create private channel
    const response = await client.conversations.create({
      name: channelName,
      is_private: true,
    });

    if (!response.ok || !response.channel?.id) {
      throw new Error('Failed to create Slack channel');
    }

    const channelId = response.channel.id;

    // Set channel topic
    const topic = `${escalation.severity} Escalation: ${escalation.title} | Customer: ${escalation.customerName} | Status: ${escalation.status}`;
    await client.conversations.setTopic({
      channel: channelId,
      topic: topic.substring(0, 250),
    });

    // Set channel purpose/description
    const purpose = `War room for ${escalation.customerName} escalation. Category: ${escalation.category}. Created: ${new Date().toLocaleDateString()}`;
    await client.conversations.setPurpose({
      channel: channelId,
      purpose: purpose.substring(0, 250),
    });

    return {
      id: channelId,
      name: channelName,
      isPrivate: true,
      isMember: true,
      topic,
      purpose,
    };
  }

  /**
   * Determine which participants should be added based on escalation type
   */
  private async determineParticipants(
    escalation: Escalation,
    userId: string,
    providedEmails?: Record<ParticipantRole, string>
  ): Promise<Participant[]> {
    const participants: Participant[] = [];
    const now = new Date();

    // Get default participant config for this category
    const participantConfigs = DEFAULT_PARTICIPANTS[escalation.category] || [];

    // Add owner (the user creating the escalation)
    participants.push({
      userId,
      userName: escalation.ownerName || 'CSM',
      email: '', // Will be populated from user lookup
      role: 'owner',
      addedAt: now,
      notificationPreference: 'all',
    });

    // Add other required participants based on severity
    for (const config of participantConfigs) {
      if (config.role === 'owner') continue; // Already added

      if (config.severity.includes(escalation.severity)) {
        const email = providedEmails?.[config.role];
        if (email || config.required) {
          participants.push({
            userId: this.generateId(),
            userName: this.getRoleDisplayName(config.role),
            email: email || '',
            role: config.role,
            addedAt: now,
            notificationPreference: config.role === 'executive' ? 'critical' : 'all',
          });
        }
      }
    }

    return participants;
  }

  /**
   * Add participants to the Slack channel
   */
  private async addParticipantsToChannel(
    userId: string,
    channelId: string,
    participants: Participant[]
  ): Promise<void> {
    const client = await slackService.getClient(userId);

    for (const participant of participants) {
      if (participant.slackUserId) {
        try {
          await client.conversations.invite({
            channel: channelId,
            users: participant.slackUserId,
          });
        } catch (error: unknown) {
          const err = error as { data?: { error?: string } };
          // Ignore "already_in_channel" errors
          if (err.data?.error !== 'already_in_channel') {
            console.error(`[WarRoom] Failed to add participant ${participant.userName}:`, error);
          }
        }
      } else if (participant.email) {
        // Try to find user by email
        try {
          const slackUser = await slackService.findUserByEmail(userId, participant.email);
          if (slackUser) {
            await client.conversations.invite({
              channel: channelId,
              users: slackUser.id,
            });
            participant.slackUserId = slackUser.id;
          }
        } catch (error) {
          console.error(`[WarRoom] Failed to find/add participant by email ${participant.email}:`, error);
        }
      }
    }
  }

  /**
   * Create the escalation brief document
   */
  private async createEscalationBrief(
    userId: string,
    escalation: Escalation
  ): Promise<{ documentId: string; documentUrl: string }> {
    const variables: Record<string, string> = {
      customerName: escalation.customerName,
      priority: escalation.severity,
      date: new Date().toLocaleDateString(),
      summary: escalation.description,
      impact: escalation.impact,
      rootCause: 'Under investigation',
      actionsTaken: 'War room created. Team assembled.',
      resolutionPlan: escalation.recommendedResolution || 'To be determined',
      execAttention: escalation.severity === 'P1'
        ? 'Immediate executive attention required'
        : 'Regular updates to be provided',
    };

    // Add customer details
    if (escalation.customerARR) {
      variables.arr = `$${escalation.customerARR.toLocaleString()}`;
    }
    if (escalation.customerHealthScore) {
      variables.healthScore = `${escalation.customerHealthScore}/100`;
    }
    if (escalation.customerSegment) {
      variables.segment = escalation.customerSegment;
    }

    // Add customer contacts
    if (escalation.customerContacts.length > 0) {
      variables.customerContacts = escalation.customerContacts
        .map(c => `- ${c.name}${c.role ? ` (${c.role})` : ''}${c.email ? ` - ${c.email}` : ''}`)
        .join('\n');
    }

    // Add previous escalations if any
    if (escalation.previousEscalations && escalation.previousEscalations.length > 0) {
      variables.previousEscalations = escalation.previousEscalations
        .map(e => `- ${e.title} (${e.severity}, ${e.category}) - Resolved: ${new Date(e.resolvedAt).toLocaleDateString()}`)
        .join('\n');
    } else {
      variables.previousEscalations = 'No previous escalations on record';
    }

    // Add timeline events
    if (escalation.timeline.length > 0) {
      variables.timeline = escalation.timeline
        .map(e => `- [${new Date(e.timestamp).toLocaleString()}] ${e.title}${e.description ? `: ${e.description}` : ''}`)
        .join('\n');
    } else {
      variables.timeline = `- [${new Date().toLocaleString()}] Escalation created`;
    }

    try {
      const doc = await docsService.createFromTemplate(
        userId,
        'escalation_report',
        variables
      );

      return {
        documentId: doc.id,
        documentUrl: doc.webViewLink || `https://docs.google.com/document/d/${doc.id}/edit`,
      };
    } catch (error) {
      console.error('[WarRoom] Failed to create escalation brief:', error);
      // Return a placeholder if doc creation fails
      return {
        documentId: 'pending',
        documentUrl: '#',
      };
    }
  }

  /**
   * Pin the escalation brief to the Slack channel
   */
  private async pinBriefToChannel(
    userId: string,
    channelId: string,
    briefUrl: string,
    escalation: Escalation
  ): Promise<void> {
    const client = await slackService.getClient(userId);

    // Post the initial message with the brief
    const severityEmoji = escalation.severity === 'P1' ? ':rotating_light:' :
                          escalation.severity === 'P2' ? ':warning:' : ':information_source:';

    const message = await client.chat.postMessage({
      channel: channelId,
      text: `${severityEmoji} *${escalation.severity} Escalation: ${escalation.title}*`,
      blocks: [
        {
          type: 'header',
          text: {
            type: 'plain_text',
            text: `${severityEmoji} ${escalation.severity} Escalation: ${escalation.title}`,
            emoji: true,
          },
        },
        {
          type: 'section',
          fields: [
            { type: 'mrkdwn', text: `*Customer:*\n${escalation.customerName}` },
            { type: 'mrkdwn', text: `*Category:*\n${escalation.category}` },
            { type: 'mrkdwn', text: `*Status:*\n${escalation.status}` },
            { type: 'mrkdwn', text: `*Owner:*\n${escalation.ownerName || 'TBD'}` },
          ],
        },
        {
          type: 'section',
          text: {
            type: 'mrkdwn',
            text: `*Description:*\n${escalation.description}`,
          },
        },
        {
          type: 'section',
          text: {
            type: 'mrkdwn',
            text: `*Impact:*\n${escalation.impact}`,
          },
        },
        {
          type: 'divider',
        },
        {
          type: 'section',
          text: {
            type: 'mrkdwn',
            text: `:page_facing_up: <${briefUrl}|View Escalation Brief>`,
          },
        },
        {
          type: 'context',
          elements: [
            {
              type: 'mrkdwn',
              text: `Created by ${escalation.ownerName || 'System'} | ${new Date().toLocaleString()}`,
            },
          ],
        },
      ],
    });

    // Pin the message
    if (message.ok && message.ts) {
      await client.pins.add({
        channel: channelId,
        timestamp: message.ts,
      });
    }
  }

  /**
   * Schedule initial coordination meetings based on severity
   */
  private async scheduleInitialMeetings(
    userId: string,
    escalation: Escalation,
    participants: Participant[]
  ): Promise<MeetingRef[]> {
    const meetings: MeetingRef[] = [];
    const now = new Date();

    // Schedule kickoff meeting (within 30 min for P1, 2 hours for P2, 4 hours for P3)
    const kickoffDelayMinutes = escalation.severity === 'P1' ? 30 :
                                escalation.severity === 'P2' ? 120 : 240;

    const kickoffTime = new Date(now.getTime() + kickoffDelayMinutes * 60 * 1000);

    const kickoffMeeting: MeetingRef = {
      id: this.generateId(),
      type: 'kickoff',
      title: `${escalation.severity} War Room Kickoff: ${escalation.customerName}`,
      scheduledAt: kickoffTime,
      attendees: participants.map(p => p.email).filter(Boolean),
    };

    try {
      const event = await calendarService.createEvent(userId, {
        title: kickoffMeeting.title,
        startTime: kickoffTime,
        endTime: new Date(kickoffTime.getTime() + 30 * 60 * 1000), // 30 min
        attendees: kickoffMeeting.attendees,
        description: `Kickoff meeting for ${escalation.customerName} escalation.\n\nEscalation: ${escalation.title}\nSeverity: ${escalation.severity}\nCategory: ${escalation.category}`,
      });

      kickoffMeeting.calendarEventId = event.id;
      kickoffMeeting.calendarEventUrl = event.htmlLink;
    } catch (error) {
      console.error('[WarRoom] Failed to create kickoff meeting:', error);
    }

    meetings.push(kickoffMeeting);

    // For P1, schedule recurring syncs
    if (escalation.severity === 'P1') {
      const syncTime = new Date(now.getTime() + 4 * 60 * 60 * 1000); // 4 hours from now
      meetings.push({
        id: this.generateId(),
        type: 'sync',
        title: `${escalation.severity} War Room Sync: ${escalation.customerName}`,
        scheduledAt: syncTime,
        attendees: participants.filter(p => p.notificationPreference === 'all').map(p => p.email).filter(Boolean),
      });
    }

    return meetings;
  }

  /**
   * Generate communication templates with escalation variables populated
   */
  private async generateCommunicationTemplates(
    userId: string,
    escalation: Escalation
  ): Promise<CommunicationLog[]> {
    const communications: CommunicationLog[] = [];
    const now = new Date();

    // Create customer acknowledgment email draft
    communications.push({
      id: this.generateId(),
      timestamp: now,
      type: 'customer_email',
      channel: 'email',
      title: 'Customer Acknowledgment (Draft)',
      recipients: escalation.customerContacts.map(c => c.email).filter(Boolean) as string[],
      sentBy: escalation.ownerId,
    });

    // Create executive briefing draft for P1/P2
    if (escalation.severity === 'P1' || escalation.severity === 'P2') {
      communications.push({
        id: this.generateId(),
        timestamp: now,
        type: 'executive_briefing',
        channel: 'document',
        title: 'Executive Briefing (Draft)',
        recipients: [],
        sentBy: escalation.ownerId,
      });
    }

    return communications;
  }

  /**
   * Send initial notifications to all participants
   */
  private async sendInitialNotifications(
    userId: string,
    escalation: Escalation,
    warRoom: WarRoom,
    participants: Participant[]
  ): Promise<void> {
    // Notify all participants via Slack DM
    for (const participant of participants) {
      if (participant.slackUserId && participant.userId !== escalation.ownerId) {
        try {
          await slackService.sendDM(
            userId,
            participant.slackUserId,
            `You've been added to a ${escalation.severity} escalation war room for ${escalation.customerName}`,
            [
              {
                type: 'section',
                text: {
                  type: 'mrkdwn',
                  text: `*${escalation.severity} Escalation Alert*\n\nYou've been added to the war room for *${escalation.customerName}*.`,
                },
              },
              {
                type: 'section',
                fields: [
                  { type: 'mrkdwn', text: `*Issue:*\n${escalation.title}` },
                  { type: 'mrkdwn', text: `*Your Role:*\n${this.getRoleDisplayName(participant.role)}` },
                ],
              },
              {
                type: 'actions',
                elements: [
                  {
                    type: 'button',
                    text: { type: 'plain_text', text: 'Join War Room' },
                    url: warRoom.slackChannelUrl,
                    style: 'primary',
                  },
                  {
                    type: 'button',
                    text: { type: 'plain_text', text: 'View Brief' },
                    url: warRoom.briefDocumentUrl,
                  },
                ],
              },
            ]
          );
        } catch (error) {
          console.error(`[WarRoom] Failed to notify participant ${participant.userName}:`, error);
        }
      }
    }
  }

  // ============================================
  // Status Updates
  // ============================================

  /**
   * Add a status update to the war room
   */
  async addStatusUpdate(
    userId: string,
    warRoomId: string,
    update: Omit<StatusUpdate, 'id' | 'timestamp'>
  ): Promise<StatusUpdate> {
    const warRoom = await this.getWarRoom(warRoomId);
    if (!warRoom) {
      throw new Error('War room not found');
    }

    const statusUpdate: StatusUpdate = {
      ...update,
      id: this.generateId(),
      timestamp: new Date(),
    };

    warRoom.statusUpdates.push(statusUpdate);
    await this.saveWarRoom(warRoom);

    // Post update to Slack channel
    await this.postStatusUpdateToSlack(userId, warRoom, statusUpdate);

    return statusUpdate;
  }

  /**
   * Post a status update to the war room Slack channel
   */
  private async postStatusUpdateToSlack(
    userId: string,
    warRoom: WarRoom,
    update: StatusUpdate
  ): Promise<void> {
    try {
      const blocks: any[] = [
        {
          type: 'header',
          text: {
            type: 'plain_text',
            text: `:memo: Status Update`,
            emoji: true,
          },
        },
        {
          type: 'section',
          text: {
            type: 'mrkdwn',
            text: update.summary,
          },
        },
      ];

      if (update.progress !== undefined) {
        blocks.push({
          type: 'section',
          text: {
            type: 'mrkdwn',
            text: `*Progress:* ${update.progress}%`,
          },
        });
      }

      if (update.blockers && update.blockers.length > 0) {
        blocks.push({
          type: 'section',
          text: {
            type: 'mrkdwn',
            text: `*Blockers:*\n${update.blockers.map(b => `- ${b}`).join('\n')}`,
          },
        });
      }

      if (update.nextActions && update.nextActions.length > 0) {
        blocks.push({
          type: 'section',
          text: {
            type: 'mrkdwn',
            text: `*Next Actions:*\n${update.nextActions.map(a => `- ${a}`).join('\n')}`,
          },
        });
      }

      blocks.push({
        type: 'context',
        elements: [
          {
            type: 'mrkdwn',
            text: `Updated by ${update.updatedByName || update.updatedBy} | ${new Date(update.timestamp).toLocaleString()}`,
          },
        ],
      });

      await slackService.sendMessage(userId, {
        channel: warRoom.slackChannelId,
        text: `Status Update: ${update.summary}`,
        blocks,
      });
    } catch (error) {
      console.error('[WarRoom] Failed to post status update to Slack:', error);
    }
  }

  // ============================================
  // Resolution
  // ============================================

  /**
   * Mark an escalation as resolved
   */
  async resolveEscalation(
    userId: string,
    warRoomId: string,
    resolution: Omit<Resolution, 'resolvedAt' | 'customerConfirmed' | 'postMortemScheduled'>
  ): Promise<void> {
    const warRoom = await this.getWarRoom(warRoomId);
    if (!warRoom) {
      throw new Error('War room not found');
    }

    warRoom.resolution = {
      ...resolution,
      resolvedAt: new Date(),
      customerConfirmed: false,
      postMortemScheduled: false,
    };

    await this.saveWarRoom(warRoom);

    // Post resolution to Slack
    await this.postResolutionToSlack(userId, warRoom);
  }

  /**
   * Post resolution notification to Slack channel
   */
  private async postResolutionToSlack(
    userId: string,
    warRoom: WarRoom
  ): Promise<void> {
    if (!warRoom.resolution) return;

    try {
      await slackService.sendMessage(userId, {
        channel: warRoom.slackChannelId,
        text: `:white_check_mark: Escalation Resolved`,
        blocks: [
          {
            type: 'header',
            text: {
              type: 'plain_text',
              text: ':white_check_mark: Escalation Resolved',
              emoji: true,
            },
          },
          {
            type: 'section',
            text: {
              type: 'mrkdwn',
              text: `*Resolution Summary:*\n${warRoom.resolution.summary}`,
            },
          },
          {
            type: 'section',
            text: {
              type: 'mrkdwn',
              text: `*Actions Taken:*\n${warRoom.resolution.actionsTaken.map(a => `- ${a}`).join('\n')}`,
            },
          },
          {
            type: 'divider',
          },
          {
            type: 'section',
            text: {
              type: 'mrkdwn',
              text: `This channel will be archived in 7 days. Please ensure all post-mortem activities are completed.`,
            },
          },
          {
            type: 'context',
            elements: [
              {
                type: 'mrkdwn',
                text: `Resolved by ${warRoom.resolution.resolvedByName || warRoom.resolution.resolvedBy} | ${new Date(warRoom.resolution.resolvedAt).toLocaleString()}`,
              },
            ],
          },
        ],
      });
    } catch (error) {
      console.error('[WarRoom] Failed to post resolution to Slack:', error);
    }
  }

  /**
   * Archive a war room channel
   */
  async archiveWarRoom(userId: string, warRoomId: string): Promise<void> {
    const warRoom = await this.getWarRoom(warRoomId);
    if (!warRoom) {
      throw new Error('War room not found');
    }

    try {
      const client = await slackService.getClient(userId);
      await client.conversations.archive({
        channel: warRoom.slackChannelId,
      });

      warRoom.archivedAt = new Date();
      await this.saveWarRoom(warRoom);
    } catch (error) {
      console.error('[WarRoom] Failed to archive war room:', error);
      throw error;
    }
  }

  // ============================================
  // Database Operations
  // ============================================

  /**
   * Get a war room by ID
   */
  async getWarRoom(warRoomId: string): Promise<WarRoom | null> {
    if (!this.supabase) return null;

    const { data, error } = await this.supabase
      .from('war_rooms')
      .select('*')
      .eq('id', warRoomId)
      .single();

    if (error || !data) return null;

    return this.mapDatabaseToWarRoom(data);
  }

  /**
   * Get war room by escalation ID
   */
  async getWarRoomByEscalation(escalationId: string): Promise<WarRoom | null> {
    if (!this.supabase) return null;

    const { data, error } = await this.supabase
      .from('war_rooms')
      .select('*')
      .eq('escalation_id', escalationId)
      .single();

    if (error || !data) return null;

    return this.mapDatabaseToWarRoom(data);
  }

  /**
   * Save war room to database
   */
  async saveWarRoom(warRoom: WarRoom): Promise<void> {
    if (!this.supabase) return;

    await this.supabase.from('war_rooms').upsert({
      id: warRoom.id,
      escalation_id: warRoom.escalationId,
      slack_channel_id: warRoom.slackChannelId,
      slack_channel_name: warRoom.slackChannelName,
      slack_channel_url: warRoom.slackChannelUrl,
      participants: warRoom.participants,
      brief_document_id: warRoom.briefDocumentId,
      brief_document_url: warRoom.briefDocumentUrl,
      dashboard_url: warRoom.dashboardUrl,
      status_updates: warRoom.statusUpdates,
      meetings: warRoom.meetings,
      communications: warRoom.communications,
      resolution: warRoom.resolution,
      created_at: warRoom.createdAt.toISOString(),
      closed_at: warRoom.closedAt?.toISOString() || null,
      archived_at: warRoom.archivedAt?.toISOString() || null,
    });
  }

  /**
   * Map database record to WarRoom type
   */
  private mapDatabaseToWarRoom(data: any): WarRoom {
    return {
      id: data.id,
      escalationId: data.escalation_id,
      slackChannelId: data.slack_channel_id,
      slackChannelName: data.slack_channel_name,
      slackChannelUrl: data.slack_channel_url,
      participants: data.participants || [],
      briefDocumentId: data.brief_document_id,
      briefDocumentUrl: data.brief_document_url,
      dashboardUrl: data.dashboard_url,
      statusUpdates: data.status_updates || [],
      meetings: data.meetings || [],
      communications: data.communications || [],
      resolution: data.resolution,
      createdAt: new Date(data.created_at),
      closedAt: data.closed_at ? new Date(data.closed_at) : null,
      archivedAt: data.archived_at ? new Date(data.archived_at) : null,
    };
  }

  // ============================================
  // Utilities
  // ============================================

  private generateId(): string {
    return `wr_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
  }

  private getRoleDisplayName(role: ParticipantRole): string {
    const names: Record<ParticipantRole, string> = {
      owner: 'Escalation Owner',
      support: 'Support Lead',
      product: 'Product Contact',
      engineering: 'Engineering Contact',
      executive: 'Executive Sponsor',
      observer: 'Observer',
    };
    return names[role] || role;
  }
}

// Singleton instance
export const warRoomService = new WarRoomService();

// Re-export types
export type { WarRoom, Participant, StatusUpdate, MeetingRef, CommunicationLog, Resolution };
