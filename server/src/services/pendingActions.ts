/**
 * Pending Actions Service
 * Manages HITL (Human-in-the-Loop) approval workflow for AI-suggested actions
 */

import { calendarService, CreateEventOptions } from './google/calendar.js';
import { gmailService, SendEmailOptions } from './google/gmail.js';

// Action Types
export type ActionType = 'schedule_meeting' | 'send_email' | 'create_task' | 'create_draft';

export type ActionStatus = 'pending' | 'approved' | 'rejected' | 'executed' | 'failed';

export interface PendingAction {
  id: string;
  userId: string;
  type: ActionType;
  status: ActionStatus;
  title: string;
  description: string;
  details: ScheduleMeetingDetails | SendEmailDetails | CreateTaskDetails;
  createdAt: Date;
  updatedAt: Date;
  executedAt?: Date;
  result?: any;
  error?: string;
}

export interface ScheduleMeetingDetails {
  title: string;
  description?: string;
  attendees: string[];
  startTime: string; // ISO string
  endTime: string;   // ISO string
  location?: string;
  createMeetLink: boolean;
}

export interface SendEmailDetails {
  to: string[];
  cc?: string[];
  subject: string;
  bodyHtml: string;
  bodyText?: string;
  threadId?: string; // For replies
}

export interface CreateTaskDetails {
  title: string;
  description: string;
  dueDate: string;
  priority: 'low' | 'medium' | 'high' | 'urgent';
  category: string;
}

/**
 * Pending Actions Service
 */
class PendingActionsService {
  // In-memory storage (can be moved to Supabase for persistence)
  private actions: Map<string, PendingAction> = new Map();

  /**
   * Generate a unique action ID
   */
  private generateId(): string {
    return `action_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
  }

  /**
   * Create a new pending action
   */
  async createAction(
    userId: string,
    type: ActionType,
    title: string,
    description: string,
    details: PendingAction['details']
  ): Promise<PendingAction> {
    const action: PendingAction = {
      id: this.generateId(),
      userId,
      type,
      status: 'pending',
      title,
      description,
      details,
      createdAt: new Date(),
      updatedAt: new Date()
    };

    this.actions.set(action.id, action);
    console.log(`📋 Created pending action: ${action.id} - ${type} - ${title}`);

    return action;
  }

  /**
   * Get a pending action by ID
   */
  async getAction(actionId: string): Promise<PendingAction | null> {
    return this.actions.get(actionId) || null;
  }

  /**
   * Get all pending actions for a user
   */
  async getUserActions(userId: string, status?: ActionStatus): Promise<PendingAction[]> {
    const userActions: PendingAction[] = [];

    for (const action of this.actions.values()) {
      if (action.userId === userId) {
        if (!status || action.status === status) {
          userActions.push(action);
        }
      }
    }

    // Sort by createdAt descending
    return userActions.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  }

  /**
   * Approve and execute an action
   */
  async approveAction(actionId: string): Promise<PendingAction> {
    const action = this.actions.get(actionId);

    if (!action) {
      throw new Error(`Action not found: ${actionId}`);
    }

    if (action.status !== 'pending') {
      throw new Error(`Action is not pending: ${action.status}`);
    }

    // Update status to approved
    action.status = 'approved';
    action.updatedAt = new Date();

    console.log(`✅ Approved action: ${actionId}`);

    // Execute the action
    try {
      const result = await this.executeAction(action);
      action.status = 'executed';
      action.executedAt = new Date();
      action.result = result;
      console.log(`🚀 Executed action: ${actionId}`);
    } catch (error) {
      action.status = 'failed';
      action.error = (error as Error).message;
      console.error(`❌ Failed to execute action: ${actionId}`, error);
    }

    action.updatedAt = new Date();
    this.actions.set(actionId, action);

    return action;
  }

  /**
   * Reject an action
   */
  async rejectAction(actionId: string, reason?: string): Promise<PendingAction> {
    const action = this.actions.get(actionId);

    if (!action) {
      throw new Error(`Action not found: ${actionId}`);
    }

    if (action.status !== 'pending') {
      throw new Error(`Action is not pending: ${action.status}`);
    }

    action.status = 'rejected';
    action.updatedAt = new Date();
    if (reason) {
      action.error = reason;
    }

    this.actions.set(actionId, action);
    console.log(`❌ Rejected action: ${actionId}`);

    return action;
  }

  /**
   * Execute an approved action
   */
  private async executeAction(action: PendingAction): Promise<any> {
    switch (action.type) {
      case 'schedule_meeting':
        return this.executeMeetingAction(action);

      case 'send_email':
        return this.executeEmailAction(action);

      case 'create_draft':
        return this.executeDraftAction(action);

      case 'create_task':
        // Tasks are stored locally for now
        return { success: true, message: 'Task created' };

      default:
        throw new Error(`Unknown action type: ${action.type}`);
    }
  }

  /**
   * Execute a meeting scheduling action
   */
  private async executeMeetingAction(action: PendingAction): Promise<any> {
    const details = action.details as ScheduleMeetingDetails;

    const eventOptions: CreateEventOptions = {
      title: details.title,
      description: details.description,
      startTime: new Date(details.startTime),
      endTime: new Date(details.endTime),
      attendees: details.attendees,
      location: details.location,
      createMeetLink: details.createMeetLink,
      sendNotifications: true
    };

    const event = await calendarService.createEvent(action.userId, eventOptions);

    return {
      success: true,
      eventId: event.id,
      meetLink: event.meetLink,
      message: `Meeting "${details.title}" scheduled successfully`
    };
  }

  /**
   * Execute an email sending action
   */
  private async executeEmailAction(action: PendingAction): Promise<any> {
    const details = action.details as SendEmailDetails;

    const emailOptions: SendEmailOptions = {
      to: details.to,
      cc: details.cc,
      subject: details.subject,
      bodyHtml: details.bodyHtml,
      bodyText: details.bodyText,
      threadId: details.threadId
    };

    const messageId = await gmailService.sendEmail(action.userId, emailOptions);

    return {
      success: true,
      messageId,
      message: `Email sent to ${details.to.join(', ')}`
    };
  }

  /**
   * Execute a draft creation action
   */
  private async executeDraftAction(action: PendingAction): Promise<any> {
    const details = action.details as SendEmailDetails;

    const draftId = await gmailService.createDraft(action.userId, {
      to: details.to,
      cc: details.cc,
      subject: details.subject,
      bodyHtml: details.bodyHtml,
      bodyText: details.bodyText,
      threadId: details.threadId
    });

    return {
      success: true,
      draftId,
      message: `Draft created for ${details.to.join(', ')}`
    };
  }

  /**
   * Delete an action (cleanup)
   */
  async deleteAction(actionId: string): Promise<boolean> {
    return this.actions.delete(actionId);
  }

  /**
   * Clear all actions for a user
   */
  async clearUserActions(userId: string): Promise<number> {
    let deleted = 0;
    for (const [id, action] of this.actions.entries()) {
      if (action.userId === userId) {
        this.actions.delete(id);
        deleted++;
      }
    }
    return deleted;
  }
}

// Export singleton instance
export const pendingActionsService = new PendingActionsService();
