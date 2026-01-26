/**
 * HITL Approval Service for Google Actions
 * Manages human-in-the-loop approval workflows for sensitive operations
 */

import { createClient } from '@supabase/supabase-js';
import { config } from '../../config/index.js';

// Action categories and their approval requirements
export type GoogleActionType =
  // Gmail actions
  | 'send_email'
  | 'draft_email'
  | 'reply_email'
  | 'forward_email'
  | 'delete_email'

  // Calendar actions
  | 'book_meeting'
  | 'propose_meeting'
  | 'cancel_meeting'
  | 'update_meeting'
  | 'invite_attendees'

  // Drive actions
  | 'create_folder'
  | 'delete_file'
  | 'share_externally'
  | 'share_internally'
  | 'move_file'

  // Docs/Sheets/Slides actions
  | 'create_document'
  | 'update_document'
  | 'delete_document'
  | 'share_document'

  // Apps Script actions
  | 'deploy_script'
  | 'execute_script'
  | 'create_trigger'
  | 'delete_trigger'

  // High-level agent actions
  | 'generate_qbr'
  | 'send_renewal_proposal'
  | 'create_save_play'
  | 'escalate_to_exec'
  | 'bulk_email'
  | 'update_crm'
  | 'research_action'
  | 'internal_note';

export type ApprovalPolicy = 'always_approve' | 'auto_approve' | 'require_approval';

export interface ApprovalRule {
  action: GoogleActionType;
  policy: ApprovalPolicy;
  reason: string;
  notifyOnAuto?: boolean;
  conditions?: ApprovalCondition[];
}

export interface ApprovalCondition {
  field: string;
  operator: 'equals' | 'contains' | 'greater_than' | 'less_than' | 'in';
  value: unknown;
  policy: ApprovalPolicy;
}

export interface PendingApproval {
  id: string;
  userId: string;
  customerId?: string;
  agentType: string;
  actionType: GoogleActionType;
  actionData: Record<string, unknown>;
  status: 'pending' | 'approved' | 'rejected' | 'expired';
  reason: string;
  createdAt: Date;
  expiresAt: Date;
  decidedAt?: Date;
  decidedBy?: string;
  decisionNote?: string;
}

export interface ApprovalResult {
  approved: boolean;
  requiresApproval: boolean;
  approvalId?: string;
  reason: string;
  autoApproved?: boolean;
}

// Default approval rules
const DEFAULT_APPROVAL_RULES: ApprovalRule[] = [
  // Always require approval (blocking)
  { action: 'send_email', policy: 'require_approval', reason: 'External communication requires human review' },
  { action: 'bulk_email', policy: 'require_approval', reason: 'Bulk emails require explicit approval' },
  { action: 'book_meeting', policy: 'require_approval', reason: 'Meeting bookings commit time resources' },
  { action: 'cancel_meeting', policy: 'require_approval', reason: 'Cancellations affect attendees' },
  { action: 'share_externally', policy: 'require_approval', reason: 'External sharing exposes data' },
  { action: 'delete_file', policy: 'require_approval', reason: 'File deletion is irreversible' },
  { action: 'delete_document', policy: 'require_approval', reason: 'Document deletion is irreversible' },
  { action: 'deploy_script', policy: 'require_approval', reason: 'Script deployment has automation implications' },
  { action: 'execute_script', policy: 'require_approval', reason: 'Script execution can modify data' },
  { action: 'create_trigger', policy: 'require_approval', reason: 'Triggers run automatically' },
  { action: 'send_renewal_proposal', policy: 'require_approval', reason: 'Renewal proposals are contractual' },
  { action: 'escalate_to_exec', policy: 'require_approval', reason: 'Executive escalations need verification' },

  // Auto-approve with notification
  { action: 'draft_email', policy: 'auto_approve', reason: 'Drafts can be reviewed before sending', notifyOnAuto: true },
  { action: 'propose_meeting', policy: 'auto_approve', reason: 'Proposals are suggestions only', notifyOnAuto: true },
  { action: 'update_meeting', policy: 'auto_approve', reason: 'Minor meeting updates', notifyOnAuto: true },
  { action: 'invite_attendees', policy: 'auto_approve', reason: 'Adding attendees to existing meetings', notifyOnAuto: true },
  { action: 'create_document', policy: 'auto_approve', reason: 'Document creation is non-destructive' },
  { action: 'update_document', policy: 'auto_approve', reason: 'Document updates are tracked' },
  { action: 'share_internally', policy: 'auto_approve', reason: 'Internal sharing is lower risk' },
  { action: 'generate_qbr', policy: 'auto_approve', reason: 'QBR generation creates draft for review', notifyOnAuto: true },
  { action: 'update_crm', policy: 'auto_approve', reason: 'CRM updates are logged', notifyOnAuto: true },

  // Always auto-approve (no notification needed)
  { action: 'create_folder', policy: 'always_approve', reason: 'Folder creation is non-destructive' },
  { action: 'move_file', policy: 'always_approve', reason: 'File organization is reversible' },
  { action: 'share_document', policy: 'auto_approve', reason: 'Sharing for collaboration' },
  { action: 'reply_email', policy: 'require_approval', reason: 'Replies are external communication' },
  { action: 'forward_email', policy: 'require_approval', reason: 'Forwarding shares content externally' },
  { action: 'delete_email', policy: 'auto_approve', reason: 'Email deletion from trash' },
  { action: 'delete_trigger', policy: 'auto_approve', reason: 'Removing automations reduces risk' },
  { action: 'create_save_play', policy: 'auto_approve', reason: 'Save play creation for review', notifyOnAuto: true },
  { action: 'research_action', policy: 'always_approve', reason: 'Research is read-only' },
  { action: 'internal_note', policy: 'always_approve', reason: 'Internal notes are private' },
];

export class GoogleApprovalService {
  private supabase: ReturnType<typeof createClient> | null = null;
  private rules: Map<GoogleActionType, ApprovalRule>;

  constructor() {
    if (config.supabaseUrl && config.supabaseServiceKey) {
      this.supabase = createClient(config.supabaseUrl, config.supabaseServiceKey);
    }

    // Initialize rules map
    this.rules = new Map();
    DEFAULT_APPROVAL_RULES.forEach(rule => {
      this.rules.set(rule.action, rule);
    });
  }

  /**
   * Check if an action requires approval
   */
  async checkApproval(
    userId: string,
    agentType: string,
    actionType: GoogleActionType,
    actionData: Record<string, unknown>,
    customerId?: string
  ): Promise<ApprovalResult> {
    const rule = this.rules.get(actionType);

    if (!rule) {
      // Unknown action type - require approval by default
      return {
        approved: false,
        requiresApproval: true,
        reason: 'Unknown action type requires approval',
      };
    }

    // Check for condition-based policy overrides
    let effectivePolicy = rule.policy;
    if (rule.conditions) {
      for (const condition of rule.conditions) {
        if (this.evaluateCondition(condition, actionData)) {
          effectivePolicy = condition.policy;
          break;
        }
      }
    }

    switch (effectivePolicy) {
      case 'always_approve':
        return {
          approved: true,
          requiresApproval: false,
          reason: rule.reason,
          autoApproved: true,
        };

      case 'auto_approve':
        // Log the auto-approval if needed
        if (rule.notifyOnAuto) {
          await this.logAutoApproval(userId, agentType, actionType, actionData, customerId);
        }
        return {
          approved: true,
          requiresApproval: false,
          reason: rule.reason,
          autoApproved: true,
        };

      case 'require_approval':
        // Create pending approval
        const approval = await this.createPendingApproval(
          userId,
          agentType,
          actionType,
          actionData,
          rule.reason,
          customerId
        );
        return {
          approved: false,
          requiresApproval: true,
          approvalId: approval.id,
          reason: rule.reason,
        };

      default:
        return {
          approved: false,
          requiresApproval: true,
          reason: 'Default approval required',
        };
    }
  }

  /**
   * Create a pending approval request
   */
  async createPendingApproval(
    userId: string,
    agentType: string,
    actionType: GoogleActionType,
    actionData: Record<string, unknown>,
    reason: string,
    customerId?: string
  ): Promise<PendingApproval> {
    const approval: PendingApproval = {
      id: `approval_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      userId,
      customerId,
      agentType,
      actionType,
      actionData,
      status: 'pending',
      reason,
      createdAt: new Date(),
      expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000), // 24 hour expiry
    };

    if (this.supabase) {
      await (this.supabase as any).from('google_action_approvals').insert({
        id: approval.id,
        user_id: approval.userId,
        customer_id: approval.customerId,
        agent_type: approval.agentType,
        action_type: approval.actionType,
        action_data: approval.actionData,
        status: approval.status,
        reason: approval.reason,
        created_at: approval.createdAt.toISOString(),
        expires_at: approval.expiresAt.toISOString(),
      });
    }

    return approval;
  }

  /**
   * Approve a pending action
   */
  async approve(
    approvalId: string,
    decidedBy: string,
    note?: string
  ): Promise<PendingApproval | null> {
    if (!this.supabase) return null;

    const { data, error } = await (this.supabase as any)
      .from('google_action_approvals')
      .update({
        status: 'approved',
        decided_at: new Date().toISOString(),
        decided_by: decidedBy,
        decision_note: note,
      })
      .eq('id', approvalId)
      .eq('status', 'pending')
      .select()
      .single();

    if (error || !data) return null;

    return this.mapDbToApproval(data);
  }

  /**
   * Reject a pending action
   */
  async reject(
    approvalId: string,
    decidedBy: string,
    note?: string
  ): Promise<PendingApproval | null> {
    if (!this.supabase) return null;

    const { data, error } = await (this.supabase as any)
      .from('google_action_approvals')
      .update({
        status: 'rejected',
        decided_at: new Date().toISOString(),
        decided_by: decidedBy,
        decision_note: note,
      })
      .eq('id', approvalId)
      .eq('status', 'pending')
      .select()
      .single();

    if (error || !data) return null;

    return this.mapDbToApproval(data);
  }

  /**
   * Get pending approvals for a user
   */
  async getPendingApprovals(userId: string): Promise<PendingApproval[]> {
    if (!this.supabase) return [];

    const { data, error } = await (this.supabase as any)
      .from('google_action_approvals')
      .select('*')
      .eq('user_id', userId)
      .eq('status', 'pending')
      .gt('expires_at', new Date().toISOString())
      .order('created_at', { ascending: false });

    if (error || !data) return [];

    return data.map(this.mapDbToApproval);
  }

  /**
   * Get approval by ID
   */
  async getApproval(approvalId: string): Promise<PendingApproval | null> {
    if (!this.supabase) return null;

    const { data, error } = await (this.supabase as any)
      .from('google_action_approvals')
      .select('*')
      .eq('id', approvalId)
      .single();

    if (error || !data) return null;

    return this.mapDbToApproval(data);
  }

  /**
   * Get approval history
   */
  async getApprovalHistory(
    userId: string,
    options: { limit?: number; customerId?: string; actionType?: GoogleActionType } = {}
  ): Promise<PendingApproval[]> {
    if (!this.supabase) return [];

    let query = (this.supabase as any)
      .from('google_action_approvals')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(options.limit || 50);

    if (options.customerId) {
      query = query.eq('customer_id', options.customerId);
    }

    if (options.actionType) {
      query = query.eq('action_type', options.actionType);
    }

    const { data, error } = await query;

    if (error || !data) return [];

    return data.map(this.mapDbToApproval);
  }

  /**
   * Expire old pending approvals
   */
  async expireOldApprovals(): Promise<number> {
    if (!this.supabase) return 0;

    const { data, error } = await (this.supabase as any)
      .from('google_action_approvals')
      .update({ status: 'expired' })
      .eq('status', 'pending')
      .lt('expires_at', new Date().toISOString())
      .select('id');

    if (error) return 0;

    return data?.length || 0;
  }

  /**
   * Get approval rules
   */
  getApprovalRules(): ApprovalRule[] {
    return Array.from(this.rules.values());
  }

  /**
   * Update an approval rule (for customization)
   */
  updateRule(actionType: GoogleActionType, updates: Partial<ApprovalRule>): void {
    const existing = this.rules.get(actionType);
    if (existing) {
      this.rules.set(actionType, { ...existing, ...updates, action: actionType });
    }
  }

  /**
   * Get rule for action type
   */
  getRule(actionType: GoogleActionType): ApprovalRule | undefined {
    return this.rules.get(actionType);
  }

  // ==================== Helper Methods ====================

  /**
   * Log auto-approval for audit
   */
  private async logAutoApproval(
    userId: string,
    agentType: string,
    actionType: GoogleActionType,
    actionData: Record<string, unknown>,
    customerId?: string
  ): Promise<void> {
    if (!this.supabase) return;

    await (this.supabase as any).from('google_action_approvals').insert({
      id: `auto_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      user_id: userId,
      customer_id: customerId,
      agent_type: agentType,
      action_type: actionType,
      action_data: actionData,
      status: 'approved',
      reason: 'Auto-approved by policy',
      created_at: new Date().toISOString(),
      expires_at: new Date().toISOString(), // Already decided
      decided_at: new Date().toISOString(),
      decided_by: 'system',
      decision_note: 'Auto-approved based on approval policy',
    });
  }

  /**
   * Evaluate a condition against action data
   */
  private evaluateCondition(condition: ApprovalCondition, actionData: Record<string, unknown>): boolean {
    const fieldValue = actionData[condition.field];

    switch (condition.operator) {
      case 'equals':
        return fieldValue === condition.value;
      case 'contains':
        return String(fieldValue).includes(String(condition.value));
      case 'greater_than':
        return Number(fieldValue) > Number(condition.value);
      case 'less_than':
        return Number(fieldValue) < Number(condition.value);
      case 'in':
        return Array.isArray(condition.value) && condition.value.includes(fieldValue);
      default:
        return false;
    }
  }

  /**
   * Map database row to PendingApproval
   */
  private mapDbToApproval(data: any): PendingApproval {
    return {
      id: data.id,
      userId: data.user_id,
      customerId: data.customer_id,
      agentType: data.agent_type,
      actionType: data.action_type,
      actionData: data.action_data,
      status: data.status,
      reason: data.reason,
      createdAt: new Date(data.created_at),
      expiresAt: new Date(data.expires_at),
      decidedAt: data.decided_at ? new Date(data.decided_at) : undefined,
      decidedBy: data.decided_by,
      decisionNote: data.decision_note,
    };
  }
}

// Singleton instance
export const googleApprovalService = new GoogleApprovalService();
