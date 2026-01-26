/**
 * Approval Queue Service
 * Manages Human-in-the-Loop (HITL) approval for agent actions
 *
 * Features:
 * - Queue management for pending approvals
 * - Approve/reject/modify actions
 * - Automatic expiration handling
 * - Feedback tracking for learning
 */

import { createClient } from '@supabase/supabase-js';
import { config } from '../config/index.js';
import { gmailService } from './google/gmail.js';
import { calendarService, CreateEventOptions } from './google/calendar.js';
import { docsService } from './google/docs.js';
import { sheetsService } from './google/sheets.js';
import { slidesService } from './google/slides.js';
import { driveService } from './google/drive.js';

// Type definitions
export type ActionType =
  // Basic actions
  | 'send_email' | 'schedule_meeting' | 'create_task' | 'share_document' | 'create_document' | 'create_spreadsheet'
  // Agent-specific actions
  | 'onboarding_kickoff' | 'onboarding_welcome_sequence'
  | 'renewal_value_summary'
  | 'risk_save_play' | 'risk_escalation'
  | 'strategic_qbr_prep' | 'strategic_exec_briefing' | 'strategic_account_plan'
  | 'other';
export type ApprovalStatus = 'pending' | 'approved' | 'rejected' | 'modified' | 'expired';

export interface ApprovalItem {
  id: string;
  executionId?: string;
  userId: string;
  actionType: ActionType;
  actionData: Record<string, any>;
  originalContent?: string;
  modifiedContent?: string;
  status: ApprovalStatus;
  reviewedAt?: Date;
  reviewerNotes?: string;
  expiresAt: Date;
  createdAt: Date;
}

export interface CreateApprovalRequest {
  userId: string;
  executionId?: string;
  actionType: ActionType;
  actionData: Record<string, any>;
  originalContent?: string;
  expiresInHours?: number; // default 24
}

export interface ApprovalDecision {
  status: 'approved' | 'rejected' | 'modified';
  modifiedContent?: string;
  reviewerNotes?: string;
}

export interface ApprovalStats {
  pending: number;
  approved: number;
  rejected: number;
  modified: number;
  expired: number;
  avgApprovalTimeMinutes: number;
}

export interface PaginatedApprovals {
  items: ApprovalItem[];
  total: number;
  page: number;
  pageSize: number;
  hasMore: boolean;
}

export class ApprovalService {
  private supabase: ReturnType<typeof createClient> | null = null;

  constructor() {
    if (config.supabaseUrl && config.supabaseServiceKey) {
      this.supabase = createClient(config.supabaseUrl, config.supabaseServiceKey);
    }
  }

  /**
   * Create a new approval request
   */
  async createApproval(request: CreateApprovalRequest): Promise<ApprovalItem> {
    if (!this.supabase) {
      throw new Error('Supabase not configured');
    }

    const expiresAt = new Date();
    expiresAt.setHours(expiresAt.getHours() + (request.expiresInHours || 24));

    const { data, error } = await (this.supabase as any)
      .from('approval_queue')
      .insert({
        user_id: request.userId,
        execution_id: request.executionId,
        action_type: request.actionType,
        action_data: request.actionData,
        original_content: request.originalContent,
        status: 'pending',
        expires_at: expiresAt.toISOString()
      })
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to create approval: ${error.message}`);
    }

    return this.mapToApprovalItem(data);
  }

  /**
   * Get pending approvals for a user
   */
  async getPendingApprovals(
    userId: string,
    options: { page?: number; pageSize?: number } = {}
  ): Promise<PaginatedApprovals> {
    if (!this.supabase) {
      return { items: [], total: 0, page: 1, pageSize: 20, hasMore: false };
    }

    const page = options.page || 1;
    const pageSize = options.pageSize || 20;
    const offset = (page - 1) * pageSize;

    // First expire old items
    await this.expireOldApprovals(userId);

    // Get total count
    const { count } = await (this.supabase as any)
      .from('approval_queue')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', userId)
      .eq('status', 'pending');

    // Get paginated items
    const { data, error } = await (this.supabase as any)
      .from('approval_queue')
      .select('*')
      .eq('user_id', userId)
      .eq('status', 'pending')
      .order('created_at', { ascending: false })
      .range(offset, offset + pageSize - 1);

    if (error) {
      throw new Error(`Failed to get approvals: ${error.message}`);
    }

    const items = (data || []).map((d: any) => this.mapToApprovalItem(d));
    const total = count || 0;

    return {
      items,
      total,
      page,
      pageSize,
      hasMore: offset + items.length < total
    };
  }

  /**
   * Get a single approval by ID
   */
  async getApproval(approvalId: string): Promise<ApprovalItem | null> {
    if (!this.supabase) {
      return null;
    }

    const { data, error } = await (this.supabase as any)
      .from('approval_queue')
      .select('*')
      .eq('id', approvalId)
      .single();

    if (error || !data) {
      return null;
    }

    return this.mapToApprovalItem(data);
  }

  /**
   * Update action data for an approval (e.g., edited email)
   */
  async updateActionData(
    approvalId: string,
    updatedData: Record<string, any>
  ): Promise<void> {
    if (!this.supabase) {
      throw new Error('Supabase not configured');
    }

    // Get current approval
    const approval = await this.getApproval(approvalId);
    if (!approval) {
      throw new Error('Approval not found');
    }

    // Merge updated data with existing action data
    const mergedData = {
      ...approval.actionData,
      ...updatedData
    };

    // Update in database
    const { error } = await (this.supabase as any)
      .from('approval_queue')
      .update({ action_data: mergedData })
      .eq('id', approvalId);

    if (error) {
      throw new Error(`Failed to update action data: ${error.message}`);
    }

    console.log(`✅ Updated action_data for approval ${approvalId}`);
  }

  /**
   * Review an approval (approve, reject, or modify)
   */
  async reviewApproval(
    approvalId: string,
    decision: ApprovalDecision
  ): Promise<ApprovalItem> {
    if (!this.supabase) {
      throw new Error('Supabase not configured');
    }

    // Get the approval first
    const approval = await this.getApproval(approvalId);
    if (!approval) {
      throw new Error('Approval not found');
    }

    if (approval.status !== 'pending') {
      throw new Error(`Approval already ${approval.status}`);
    }

    // Update the approval
    const { data, error } = await (this.supabase as any)
      .from('approval_queue')
      .update({
        status: decision.status,
        modified_content: decision.modifiedContent,
        reviewer_notes: decision.reviewerNotes,
        reviewed_at: new Date().toISOString()
      })
      .eq('id', approvalId)
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to update approval: ${error.message}`);
    }

    // Record feedback for learning
    await this.recordFeedback(approval, decision);

    // If approved, execute the action
    if (decision.status === 'approved' || decision.status === 'modified') {
      const actionData = decision.status === 'modified' && decision.modifiedContent
        ? { ...approval.actionData, content: decision.modifiedContent }
        : approval.actionData;

      await this.executeAction(approval.userId, approval.actionType, actionData);
    }

    return this.mapToApprovalItem(data);
  }

  /**
   * Expire old pending approvals
   */
  private async expireOldApprovals(userId: string): Promise<void> {
    if (!this.supabase) return;

    await (this.supabase as any)
      .from('approval_queue')
      .update({ status: 'expired' })
      .eq('user_id', userId)
      .eq('status', 'pending')
      .lt('expires_at', new Date().toISOString());
  }

  /**
   * Get approval history for a user
   */
  async getApprovalHistory(
    userId: string,
    options: {
      status?: ApprovalStatus;
      actionType?: ActionType;
      startDate?: Date;
      endDate?: Date;
      page?: number;
      pageSize?: number;
    } = {}
  ): Promise<PaginatedApprovals> {
    if (!this.supabase) {
      return { items: [], total: 0, page: 1, pageSize: 20, hasMore: false };
    }

    const page = options.page || 1;
    const pageSize = options.pageSize || 20;
    const offset = (page - 1) * pageSize;

    let query = (this.supabase as any)
      .from('approval_queue')
      .select('*', { count: 'exact' })
      .eq('user_id', userId);

    if (options.status) {
      query = query.eq('status', options.status);
    }
    if (options.actionType) {
      query = query.eq('action_type', options.actionType);
    }
    if (options.startDate) {
      query = query.gte('created_at', options.startDate.toISOString());
    }
    if (options.endDate) {
      query = query.lte('created_at', options.endDate.toISOString());
    }

    const { data, count, error } = await query
      .order('created_at', { ascending: false })
      .range(offset, offset + pageSize - 1);

    if (error) {
      throw new Error(`Failed to get approval history: ${error.message}`);
    }

    const items = (data || []).map((d: any) => this.mapToApprovalItem(d));
    const total = count || 0;

    return {
      items,
      total,
      page,
      pageSize,
      hasMore: offset + items.length < total
    };
  }

  /**
   * Get approval statistics
   */
  async getStats(userId: string): Promise<ApprovalStats> {
    if (!this.supabase) {
      return {
        pending: 0,
        approved: 0,
        rejected: 0,
        modified: 0,
        expired: 0,
        avgApprovalTimeMinutes: 0
      };
    }

    // Get counts by status
    const statusCounts: Record<string, number> = {
      pending: 0,
      approved: 0,
      rejected: 0,
      modified: 0,
      expired: 0
    };

    for (const status of Object.keys(statusCounts)) {
      const { count } = await (this.supabase as any)
        .from('approval_queue')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', userId)
        .eq('status', status);

      statusCounts[status] = count || 0;
    }

    // Calculate average approval time
    const { data: avgData } = await (this.supabase as any)
      .from('approval_queue')
      .select('created_at, reviewed_at')
      .eq('user_id', userId)
      .not('reviewed_at', 'is', null);

    let avgApprovalTimeMinutes = 0;
    if (avgData && avgData.length > 0) {
      const totalMinutes = avgData.reduce((sum: number, item: any) => {
        const created = new Date(item.created_at);
        const reviewed = new Date(item.reviewed_at);
        return sum + (reviewed.getTime() - created.getTime()) / 60000;
      }, 0);
      avgApprovalTimeMinutes = Math.round(totalMinutes / avgData.length);
    }

    return {
      ...statusCounts,
      avgApprovalTimeMinutes
    } as ApprovalStats;
  }

  /**
   * Cancel a pending approval
   */
  async cancelApproval(approvalId: string): Promise<void> {
    if (!this.supabase) return;

    await (this.supabase as any)
      .from('approval_queue')
      .delete()
      .eq('id', approvalId)
      .eq('status', 'pending');
  }

  /**
   * Execute an approved action
   */
  private async executeAction(
    userId: string,
    actionType: ActionType,
    actionData: Record<string, any>
  ): Promise<void> {
    try {
      switch (actionType) {
        case 'send_email':
          await this.executeSendEmail(userId, actionData);
          break;

        case 'schedule_meeting':
          await this.executeScheduleMeeting(userId, actionData);
          break;

        case 'create_task':
          await this.executeCreateTask(userId, actionData);
          break;

        case 'share_document':
          // TODO: Implement Drive sharing
          console.log('Share document not yet implemented');
          break;

        case 'create_document':
          await this.executeCreateDocument(userId, actionData);
          break;

        case 'create_spreadsheet':
          await this.executeCreateSpreadsheet(userId, actionData);
          break;

        // ============================================
        // ONBOARDING AGENT ACTIONS
        // ============================================
        case 'onboarding_kickoff':
          await this.executeOnboardingKickoff(userId, actionData);
          break;

        case 'onboarding_welcome_sequence':
          await this.executeOnboardingWelcomeSequence(userId, actionData);
          break;

        // ============================================
        // RENEWAL AGENT ACTIONS
        // ============================================
        case 'renewal_value_summary':
          await this.executeRenewalValueSummary(userId, actionData);
          break;

        // ============================================
        // RISK AGENT ACTIONS
        // ============================================
        case 'risk_save_play':
          await this.executeRiskSavePlay(userId, actionData);
          break;

        case 'risk_escalation':
          await this.executeRiskEscalation(userId, actionData);
          break;

        // ============================================
        // STRATEGIC AGENT ACTIONS
        // ============================================
        case 'strategic_qbr_prep':
          await this.executeStrategicQBRPrep(userId, actionData);
          break;

        case 'strategic_exec_briefing':
          await this.executeStrategicExecBriefing(userId, actionData);
          break;

        case 'strategic_account_plan':
          await this.executeStrategicAccountPlan(userId, actionData);
          break;

        case 'other':
          // Handle 'other' action types by checking the _toolName field
          const toolName = actionData._toolName;
          console.log(`📋 Handling 'other' action type with tool: ${toolName}`);
          if (toolName === 'create_document') {
            await this.executeCreateDocument(userId, actionData);
          } else if (toolName === 'create_spreadsheet') {
            await this.executeCreateSpreadsheet(userId, actionData);
          } else {
            console.log(`⚠️ Unknown tool in 'other' action: ${toolName}`);
          }
          break;

        default:
          console.log(`Unknown action type: ${actionType}`);
      }
    } catch (error) {
      console.error(`Error executing action ${actionType}:`, error);
      throw error;
    }
  }

  /**
   * Execute send email action
   */
  private async executeSendEmail(
    userId: string,
    actionData: Record<string, any>
  ): Promise<void> {
    const { to, subject, bodyHtml, bodyText, body, threadId, inReplyTo } = actionData;

    // Handle both 'body' (from AI) and 'bodyHtml'/'bodyText' (legacy)
    const emailBody = bodyHtml || body || bodyText || '';
    const isHtml = emailBody.includes('<') && emailBody.includes('>');

    console.log('📧 Sending email:', { to, subject, bodyLength: emailBody.length });

    // sendEmail handles both new emails and replies via threadId
    await gmailService.sendEmail(userId, {
      to: Array.isArray(to) ? to : [to],
      subject,
      bodyHtml: isHtml ? emailBody : `<p>${emailBody.replace(/\n/g, '<br>')}</p>`,
      bodyText: isHtml ? undefined : emailBody,
      threadId,
      inReplyTo
    });

    console.log('📧 Email sent successfully to:', to);
  }

  /**
   * Execute schedule meeting action
   */
  private async executeScheduleMeeting(
    userId: string,
    actionData: Record<string, any>
  ): Promise<void> {
    const { title, description, startTime, endTime, attendees, createMeetLink, durationMinutes } = actionData;

    console.log('📅 executeScheduleMeeting called with:', JSON.stringify({ title, startTime, endTime, attendees, durationMinutes }));

    // Parse startTime - handle both ISO strings and natural language
    const parsedStartTime = this.parseDateTime(startTime);

    // Calculate endTime from duration if not provided
    const duration = durationMinutes || 30;
    const parsedEndTime = endTime
      ? this.parseDateTime(endTime)
      : new Date(parsedStartTime.getTime() + duration * 60 * 1000);

    console.log('📅 Parsed times:', {
      parsedStartTime: parsedStartTime.toISOString(),
      parsedEndTime: parsedEndTime.toISOString(),
      attendees
    });

    const options: CreateEventOptions = {
      title,
      description,
      startTime: parsedStartTime,
      endTime: parsedEndTime,
      attendees,
      createMeetLink: createMeetLink !== false,
      sendNotifications: true
    };

    console.log('📅 Calling calendarService.createMeeting for user:', userId);
    const result = await calendarService.createMeeting(userId, options);
    console.log('📅 Meeting created successfully:', { eventId: result.id, title: result.title, meetLink: result.meetLink });
  }

  /**
   * Parse date/time from various formats including natural language
   * Uses Eastern Time (America/Toronto) for natural language dates
   */
  private parseDateTime(input: string): Date {
    // Try ISO format first (if already has timezone info)
    if (input.includes('T') && (input.includes('Z') || input.includes('+') || input.includes('-'))) {
      const isoDate = new Date(input);
      if (!isNaN(isoDate.getTime())) {
        return isoDate;
      }
    }

    // Handle natural language patterns - interpret as Eastern Time
    // Get current time in Eastern Time
    const now = new Date();
    const inputLower = input.toLowerCase().trim();

    // "tomorrow at 3pm" or "tomorrow 3pm"
    const tomorrowMatch = inputLower.match(/tomorrow(?:\s+at)?\s+(\d{1,2})(?::(\d{2}))?\s*(am|pm)?/i);
    if (tomorrowMatch) {
      const tomorrow = new Date(now);
      tomorrow.setDate(tomorrow.getDate() + 1);
      return this.setTimeFromMatch(tomorrow, tomorrowMatch);
    }

    // "today at 3pm"
    const todayMatch = inputLower.match(/today(?:\s+at)?\s+(\d{1,2})(?::(\d{2}))?\s*(am|pm)?/i);
    if (todayMatch) {
      const today = new Date(now);
      return this.setTimeFromMatch(today, todayMatch);
    }

    // "next monday at 2pm"
    const nextDayMatch = inputLower.match(/next\s+(monday|tuesday|wednesday|thursday|friday|saturday|sunday)(?:\s+at)?\s+(\d{1,2})(?::(\d{2}))?\s*(am|pm)?/i);
    if (nextDayMatch) {
      const dayName = nextDayMatch[1].toLowerCase();
      const days = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
      const targetDay = days.indexOf(dayName);
      const currentDay = now.getDay();
      let daysToAdd = targetDay - currentDay;
      if (daysToAdd <= 0) daysToAdd += 7;

      const nextDay = new Date(now);
      nextDay.setDate(nextDay.getDate() + daysToAdd);
      return this.setTimeFromMatch(nextDay, [null, nextDayMatch[2], nextDayMatch[3], nextDayMatch[4]]);
    }

    // "in 2 hours"
    const inHoursMatch = inputLower.match(/in\s+(\d+)\s*hours?/i);
    if (inHoursMatch) {
      const hours = parseInt(inHoursMatch[1]);
      return new Date(now.getTime() + hours * 60 * 60 * 1000);
    }

    // Just a time like "3pm" or "15:00" - assume today or tomorrow if past
    const timeOnlyMatch = inputLower.match(/^(\d{1,2})(?::(\d{2}))?\s*(am|pm)?$/i);
    if (timeOnlyMatch) {
      const result = this.setTimeFromMatch(new Date(now), timeOnlyMatch);
      // If time is in the past, assume tomorrow
      if (result.getTime() < now.getTime()) {
        result.setDate(result.getDate() + 1);
      }
      return result;
    }

    // Last resort: throw error with helpful message
    throw new Error(`Unable to parse date/time: "${input}". Please use ISO format (e.g., "2026-01-15T14:00:00") or natural language (e.g., "tomorrow at 2pm")`);
  }

  /**
   * Helper to set time from regex match
   * Interprets time as Eastern Time (America/Toronto) and converts to UTC
   */
  private setTimeFromMatch(date: Date, match: (string | undefined)[] | RegExpMatchArray): Date {
    let hours = parseInt(match[1] || '12');
    const minutes = parseInt(match[2] || '0');
    const meridiem = match[3]?.toLowerCase();

    // Handle AM/PM
    if (meridiem === 'pm' && hours < 12) hours += 12;
    if (meridiem === 'am' && hours === 12) hours = 0;

    // Create a date string and interpret it as Eastern Time
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const hourStr = String(hours).padStart(2, '0');
    const minStr = String(minutes).padStart(2, '0');

    // Format as ISO with explicit Eastern timezone offset
    // EST = UTC-5, EDT = UTC-4
    // For simplicity, use EST (-05:00) as default - close enough for most cases
    // TODO: Could calculate exact DST offset if needed
    const isJanuary = date.getMonth() === 0; // January is month 0
    const isDST = !isJanuary && date.getMonth() >= 2 && date.getMonth() <= 10; // Rough DST check (Mar-Nov)
    const offset = isDST ? '-04:00' : '-05:00';

    const dateTimeStr = `${year}-${month}-${day}T${hourStr}:${minStr}:00${offset}`;
    const result = new Date(dateTimeStr);

    console.log(`📅 Timezone conversion: ${hours}:${minStr} ET (${isDST ? 'EDT' : 'EST'}) -> ${result.toISOString()} UTC`);

    return result;
  }

  /**
   * Execute create task action
   */
  private async executeCreateTask(
    userId: string,
    actionData: Record<string, any>
  ): Promise<void> {
    if (!this.supabase) {
      console.log('✅ Task created (in-memory only - Supabase not configured):', actionData.title);
      return;
    }

    const { title, notes, dueDate, priority, customerId, taskType } = actionData;

    console.log('✅ Creating task:', { title, dueDate, priority });

    const { data, error } = await (this.supabase as any)
      .from('google_tasks')
      .insert({
        user_id: userId,
        customer_id: customerId,
        google_task_id: `local-${Date.now()}`, // Placeholder until Google Tasks API sync
        google_tasklist_id: 'cscx-tasks',
        title,
        notes,
        due_date: dueDate,
        priority: priority || 'medium',
        task_type: taskType || 'other',
        source: 'agent',
        status: 'needsAction'
      })
      .select()
      .single();

    if (error) {
      console.error('✅ Task creation failed:', error);
      throw new Error(`Failed to create task: ${error.message}`);
    }

    console.log('✅ Task created successfully:', { id: data.id, title: data.title });
  }

  /**
   * Execute create document action
   */
  private async executeCreateDocument(
    userId: string,
    actionData: Record<string, any>
  ): Promise<void> {
    const { title, template, variables, folderId } = actionData;

    console.log('📄 Creating document:', { title, template, folderId });

    try {
      let doc;
      if (template && template !== 'blank') {
        // Create from template
        doc = await docsService.createFromTemplate(userId, template, {
          title,
          folderId,
          variables: variables || {}
        });
      } else {
        // Create blank document
        doc = await docsService.createDocument(userId, { title, folderId });
      }

      console.log('📄 Document created successfully:', { docId: doc.id, title: doc.title, webViewLink: doc.webViewLink });
    } catch (error) {
      console.error('📄 Document creation failed:', error);
      throw error;
    }
  }

  /**
   * Execute create spreadsheet action
   */
  private async executeCreateSpreadsheet(
    userId: string,
    actionData: Record<string, any>
  ): Promise<void> {
    const { title, template, variables, folderId } = actionData;

    console.log('📊 Creating spreadsheet:', { title, template, folderId });

    try {
      let sheet;
      if (template && template !== 'blank') {
        // Create from template
        sheet = await sheetsService.createFromTemplate(userId, template, {
          title,
          folderId,
          variables: variables || {}
        });
      } else {
        // Create blank spreadsheet
        sheet = await sheetsService.createSpreadsheet(userId, title, folderId);
      }

      console.log('📊 Spreadsheet created successfully:', { sheetId: sheet.id, title: sheet.title, webViewLink: sheet.webViewLink });
    } catch (error) {
      console.error('📊 Spreadsheet creation failed:', error);
      throw error;
    }
  }

  // ============================================
  // ONBOARDING AGENT ACTION IMPLEMENTATIONS
  // ============================================

  /**
   * Execute onboarding kickoff - creates meeting and kickoff deck
   */
  private async executeOnboardingKickoff(
    userId: string,
    actionData: Record<string, any>
  ): Promise<void> {
    const { customerId, title, date, duration = 60, includeKickoffDeck = true } = actionData;

    console.log('🚀 Executing onboarding kickoff:', { customerId, date });

    try {
      // Get customer details from database
      const customer = await this.getCustomerById(customerId);
      const customerName = customer?.name || 'Customer';

      // Create calendar event
      const meetingTitle = title || `${customerName} - Kickoff Meeting`;
      const startTime = date ? new Date(date) : new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // Default: 1 week from now

      const meeting = await calendarService.createEvent(userId, {
        title: meetingTitle,
        description: `Kickoff meeting for ${customerName} onboarding.\n\nAgenda:\n1. Introductions\n2. Goals and success criteria\n3. Timeline and milestones\n4. Next steps`,
        startTime,
        endTime: new Date(startTime.getTime() + duration * 60 * 1000),
        attendees: customer?.stakeholders?.map((s: any) => s.email).filter(Boolean) || []
      });

      // Create kickoff deck if requested
      if (includeKickoffDeck) {
        const deck = await slidesService.createFromTemplate(userId, 'kickoff_deck', {
          title: `${customerName} - Kickoff Presentation`,
          folderId: customer?.drive_root_id,
          variables: {
            customer_name: customerName,
            date: startTime.toLocaleDateString(),
            csm_name: 'Your CSM'
          }
        });
        console.log('🎯 Kickoff deck created:', { presentationId: deck.id });
      }

      console.log('🚀 Onboarding kickoff complete:', { meetingId: meeting.id });
    } catch (error) {
      console.error('🚀 Onboarding kickoff failed:', error);
      throw error;
    }
  }

  /**
   * Execute welcome email sequence - creates draft emails for Day 1, 3, 7, 14, 30
   */
  private async executeOnboardingWelcomeSequence(
    userId: string,
    actionData: Record<string, any>
  ): Promise<void> {
    const { customerId, stakeholderEmails = [] } = actionData;

    console.log('✉️ Creating welcome email sequence:', { customerId });

    try {
      const customer = await this.getCustomerById(customerId);
      const customerName = customer?.name || 'Customer';
      const recipients = stakeholderEmails.length > 0 ? stakeholderEmails :
        (customer?.stakeholders?.map((s: any) => s.email).filter(Boolean) || []);

      if (recipients.length === 0) {
        throw new Error('No recipients found for welcome sequence');
      }

      const sequences = [
        { day: 1, subject: `Welcome to the Team, ${customerName}!`, body: `Welcome aboard! We're excited to begin our partnership...` },
        { day: 3, subject: `Getting Started - Quick Tips`, body: `Here are some quick tips to help you get the most out of our platform...` },
        { day: 7, subject: `Week 1 Check-in`, body: `How's your first week going? Let's schedule a quick call...` },
        { day: 14, subject: `Two Week Milestone`, body: `Congratulations on reaching the two-week mark! Here's what's next...` },
        { day: 30, subject: `30-Day Success Review`, body: `Let's review your progress and celebrate your wins...` }
      ];

      for (const seq of sequences) {
        await gmailService.createDraft(userId, {
          to: recipients,
          subject: seq.subject,
          body: seq.body
        });
      }

      console.log('✉️ Welcome sequence created:', { drafts: sequences.length, recipients: recipients.length });
    } catch (error) {
      console.error('✉️ Welcome sequence failed:', error);
      throw error;
    }
  }

  // ============================================
  // RENEWAL AGENT ACTION IMPLEMENTATIONS
  // ============================================

  /**
   * Execute renewal value summary - creates comprehensive value document
   */
  private async executeRenewalValueSummary(
    userId: string,
    actionData: Record<string, any>
  ): Promise<void> {
    const { customerId, includeMetrics = [] } = actionData;

    console.log('💎 Creating value summary:', { customerId });

    try {
      const customer = await this.getCustomerById(customerId);
      const customerName = customer?.name || 'Customer';

      const doc = await docsService.createFromTemplate(userId, 'value_summary', {
        title: `${customerName} - Value Summary`,
        folderId: customer?.drive_root_id,
        variables: {
          customer_name: customerName,
          arr: customer?.arr?.toLocaleString() || 'N/A',
          start_date: customer?.created_at ? new Date(customer.created_at).toLocaleDateString() : 'N/A',
          health_score: customer?.health_score || 'N/A',
          metrics: includeMetrics.join(', ') || 'All metrics'
        }
      });

      console.log('💎 Value summary created:', { docId: doc.id });
    } catch (error) {
      console.error('💎 Value summary failed:', error);
      throw error;
    }
  }

  // ============================================
  // RISK AGENT ACTION IMPLEMENTATIONS
  // ============================================

  /**
   * Execute risk save play - creates action plan and documentation
   */
  private async executeRiskSavePlay(
    userId: string,
    actionData: Record<string, any>
  ): Promise<void> {
    const { customerId, riskLevel, primaryIssue, rootCause } = actionData;

    console.log('🛡️ Creating save play:', { customerId, riskLevel });

    try {
      const customer = await this.getCustomerById(customerId);
      const customerName = customer?.name || 'Customer';

      // Create save play document
      const doc = await docsService.createFromTemplate(userId, 'save_play', {
        title: `${customerName} - Save Play (${riskLevel.toUpperCase()})`,
        folderId: customer?.drive_root_id,
        variables: {
          customer_name: customerName,
          risk_level: riskLevel,
          primary_issue: primaryIssue,
          root_cause: rootCause || 'Under investigation',
          arr_at_risk: customer?.arr?.toLocaleString() || 'N/A',
          date: new Date().toLocaleDateString()
        }
      });

      // Store save play record in database
      if (this.supabase) {
        await (this.supabase as any).from('save_plays').insert({
          customer_id: customerId,
          risk_level: riskLevel,
          primary_issue: primaryIssue,
          root_cause: rootCause,
          status: 'active',
          arr_at_risk: customer?.arr || 0,
          created_at: new Date().toISOString()
        });
      }

      console.log('🛡️ Save play created:', { docId: doc.id });
    } catch (error) {
      console.error('🛡️ Save play failed:', error);
      throw error;
    }
  }

  /**
   * Execute risk escalation - notifies stakeholders and creates record
   */
  private async executeRiskEscalation(
    userId: string,
    actionData: Record<string, any>
  ): Promise<void> {
    const { customerId, escalationLevel, reason, arrAtRisk } = actionData;

    console.log('🚨 Executing escalation:', { customerId, escalationLevel });

    try {
      const customer = await this.getCustomerById(customerId);
      const customerName = customer?.name || 'Customer';
      const levelNames = ['Manager', 'Director', 'VP'];
      const levelName = levelNames[escalationLevel - 1] || 'Unknown';

      // Create escalation report document
      const doc = await docsService.createFromTemplate(userId, 'escalation_report', {
        title: `${customerName} - Escalation Report (${levelName})`,
        folderId: customer?.drive_root_id,
        variables: {
          customer_name: customerName,
          escalation_level: levelName,
          reason: reason,
          arr_at_risk: arrAtRisk?.toLocaleString() || customer?.arr?.toLocaleString() || 'N/A',
          date: new Date().toLocaleDateString()
        }
      });

      // Create email notification draft
      await gmailService.createDraft(userId, {
        to: [], // Would be populated from escalation matrix
        subject: `[ESCALATION - ${levelName}] ${customerName} - ${reason.substring(0, 50)}`,
        body: `Customer: ${customerName}\nEscalation Level: ${levelName}\nReason: ${reason}\nARR at Risk: $${arrAtRisk?.toLocaleString() || 'Unknown'}\n\nPlease review the attached escalation report.`
      });

      console.log('🚨 Escalation executed:', { docId: doc.id });
    } catch (error) {
      console.error('🚨 Escalation failed:', error);
      throw error;
    }
  }

  // ============================================
  // STRATEGIC AGENT ACTION IMPLEMENTATIONS
  // ============================================

  /**
   * Execute QBR preparation - creates presentation, metrics sheet, and checklist
   */
  private async executeStrategicQBRPrep(
    userId: string,
    actionData: Record<string, any>
  ): Promise<void> {
    const { customerId, quarter, year, includeRoadmap = false } = actionData;

    console.log('📊 Preparing QBR materials:', { customerId, quarter, year });

    try {
      const customer = await this.getCustomerById(customerId);
      const customerName = customer?.name || 'Customer';
      const qbrTitle = `${customerName} - ${quarter} ${year} QBR`;

      // Create QBR presentation
      const deck = await slidesService.createFromTemplate(userId, 'qbr_deck', {
        title: qbrTitle,
        folderId: customer?.drive_root_id,
        variables: {
          customer_name: customerName,
          quarter: quarter,
          year: year.toString(),
          health_score: customer?.health_score || 'N/A',
          arr: customer?.arr?.toLocaleString() || 'N/A'
        }
      });

      // Create metrics tracking sheet
      const sheet = await sheetsService.createFromTemplate(userId, 'qbr_metrics', `${qbrTitle} - Metrics`, customer?.drive_root_id);

      // Create prep checklist document
      const checklist = await docsService.createFromTemplate(userId, 'meeting_notes', {
        title: `${qbrTitle} - Prep Checklist`,
        folderId: customer?.drive_root_id,
        variables: {
          title: 'QBR Preparation Checklist',
          customer_name: customerName,
          date: new Date().toLocaleDateString()
        }
      });

      // Store QBR record
      if (this.supabase) {
        await (this.supabase as any).from('qbrs').insert({
          customer_id: customerId,
          quarter: `${quarter} ${year}`,
          status: 'planned',
          presentation_url: deck.webViewLink,
          created_at: new Date().toISOString()
        });
      }

      console.log('📊 QBR prep complete:', { presentationId: deck.id, sheetId: sheet.id });
    } catch (error) {
      console.error('📊 QBR prep failed:', error);
      throw error;
    }
  }

  /**
   * Execute executive briefing - creates briefing document
   */
  private async executeStrategicExecBriefing(
    userId: string,
    actionData: Record<string, any>
  ): Promise<void> {
    const { customerId, briefingType = 'internal', focusAreas = [] } = actionData;

    console.log('👔 Creating executive briefing:', { customerId, briefingType });

    try {
      const customer = await this.getCustomerById(customerId);
      const customerName = customer?.name || 'Customer';

      const doc = await docsService.createFromTemplate(userId, 'executive_briefing', {
        title: `${customerName} - Executive Briefing (${briefingType})`,
        folderId: customer?.drive_root_id,
        variables: {
          customer_name: customerName,
          briefing_type: briefingType,
          focus_areas: focusAreas.join(', ') || 'General overview',
          arr: customer?.arr?.toLocaleString() || 'N/A',
          health_score: customer?.health_score || 'N/A',
          date: new Date().toLocaleDateString()
        }
      });

      console.log('👔 Executive briefing created:', { docId: doc.id });
    } catch (error) {
      console.error('👔 Executive briefing failed:', error);
      throw error;
    }
  }

  /**
   * Execute strategic account plan - creates annual plan document
   */
  private async executeStrategicAccountPlan(
    userId: string,
    actionData: Record<string, any>
  ): Promise<void> {
    const { customerId, fiscalYear, objectives = [] } = actionData;

    console.log('🗺️ Creating account plan:', { customerId, fiscalYear });

    try {
      const customer = await this.getCustomerById(customerId);
      const customerName = customer?.name || 'Customer';

      const doc = await docsService.createFromTemplate(userId, 'account_plan', {
        title: `${customerName} - ${fiscalYear} Account Plan`,
        folderId: customer?.drive_root_id,
        variables: {
          customer_name: customerName,
          fiscal_year: fiscalYear,
          objectives: objectives.join('\n- ') || 'TBD',
          arr: customer?.arr?.toLocaleString() || 'N/A',
          health_score: customer?.health_score || 'N/A',
          date: new Date().toLocaleDateString()
        }
      });

      // Store account plan record
      if (this.supabase) {
        await (this.supabase as any).from('account_plans').insert({
          customer_id: customerId,
          fiscal_year: fiscalYear,
          status: 'draft',
          strategic_objectives: objectives,
          created_at: new Date().toISOString()
        });
      }

      console.log('🗺️ Account plan created:', { docId: doc.id });
    } catch (error) {
      console.error('🗺️ Account plan failed:', error);
      throw error;
    }
  }

  /**
   * Helper to get customer by ID
   */
  private async getCustomerById(customerId: string): Promise<any> {
    if (!this.supabase) return null;

    const { data } = await (this.supabase as any)
      .from('customers')
      .select('*')
      .eq('id', customerId)
      .single();

    return data;
  }

  /**
   * Record feedback for learning
   */
  private async recordFeedback(
    approval: ApprovalItem,
    decision: ApprovalDecision
  ): Promise<void> {
    if (!this.supabase) return;

    const contentType = this.getContentType(approval.actionType);

    // Calculate edit distance if modified
    let editDistance = 0;
    if (decision.status === 'modified' && approval.originalContent && decision.modifiedContent) {
      editDistance = this.calculateLevenshteinDistance(
        approval.originalContent,
        decision.modifiedContent
      );
    }

    await (this.supabase as any)
      .from('feedback_events')
      .insert({
        execution_id: approval.executionId,
        user_id: approval.userId,
        content_type: contentType,
        feedback_type: decision.status === 'approved' ? 'approved' :
                       decision.status === 'modified' ? 'edited' : 'rejected',
        original_output: approval.originalContent,
        modified_output: decision.modifiedContent,
        edit_distance: editDistance
      });
  }

  /**
   * Map action type to content type for feedback
   */
  private getContentType(actionType: ActionType): string {
    const mapping: Record<ActionType, string> = {
      send_email: 'email_draft',
      schedule_meeting: 'response',
      create_task: 'task',
      share_document: 'document',
      create_document: 'document',
      create_spreadsheet: 'spreadsheet',
      other: 'response'
    };
    return mapping[actionType] || 'response';
  }

  /**
   * Calculate Levenshtein distance between two strings
   */
  private calculateLevenshteinDistance(a: string, b: string): number {
    const matrix: number[][] = [];

    for (let i = 0; i <= b.length; i++) {
      matrix[i] = [i];
    }

    for (let j = 0; j <= a.length; j++) {
      matrix[0][j] = j;
    }

    for (let i = 1; i <= b.length; i++) {
      for (let j = 1; j <= a.length; j++) {
        if (b.charAt(i - 1) === a.charAt(j - 1)) {
          matrix[i][j] = matrix[i - 1][j - 1];
        } else {
          matrix[i][j] = Math.min(
            matrix[i - 1][j - 1] + 1,
            matrix[i][j - 1] + 1,
            matrix[i - 1][j] + 1
          );
        }
      }
    }

    return matrix[b.length][a.length];
  }

  /**
   * Map database row to ApprovalItem
   */
  private mapToApprovalItem(data: any): ApprovalItem {
    return {
      id: data.id,
      executionId: data.execution_id,
      userId: data.user_id,
      actionType: data.action_type,
      actionData: data.action_data || {},
      originalContent: data.original_content,
      modifiedContent: data.modified_content,
      status: data.status,
      reviewedAt: data.reviewed_at ? new Date(data.reviewed_at) : undefined,
      reviewerNotes: data.reviewer_notes,
      expiresAt: new Date(data.expires_at),
      createdAt: new Date(data.created_at)
    };
  }
}

// Singleton instance
export const approvalService = new ApprovalService();
