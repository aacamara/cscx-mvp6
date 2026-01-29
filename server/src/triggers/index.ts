/**
 * Trigger System Types
 * Defines types for proactive automation triggers
 */

// ============================================
// Trigger Types
// ============================================

export type TriggerType =
  | 'health_score_drop'
  | 'no_login'
  | 'renewal_approaching'
  | 'ticket_escalated'
  | 'nps_submitted'
  | 'usage_anomaly'
  | 'contract_expiring'
  | 'champion_left'
  | 'expansion_signal'
  | 'custom';

export type CustomerEventType =
  | 'health_score_updated'
  | 'login_activity'
  | 'renewal_date_approaching'
  | 'support_ticket_created'
  | 'support_ticket_escalated'
  | 'nps_response'
  | 'usage_metric_updated'
  | 'contract_updated'
  | 'stakeholder_changed'
  | 'product_usage'
  | 'custom';

// ============================================
// Trigger Condition
// ============================================

export interface TriggerCondition {
  type: TriggerType;
  params: Record<string, any>;
  logic?: 'AND' | 'OR';
  subConditions?: TriggerCondition[];
}

// ============================================
// Trigger Action
// ============================================

export type TriggerActionType =
  | 'send_email'
  | 'send_slack'
  | 'create_task'
  | 'start_playbook'
  | 'update_health_score'
  | 'notify_csm'
  | 'log_activity'
  | 'webhook'
  | 'custom';

export interface TriggerAction {
  id: string;
  type: TriggerActionType;
  tool?: string;  // MCP tool name if applicable
  params: Record<string, any>;
  delay?: number;  // Delay in minutes
  condition?: string;  // JS expression for conditional execution
  requiresApproval?: boolean;
}

// ============================================
// Trigger Definition
// ============================================

export interface Trigger {
  id: string;
  userId: string;
  customerId?: string;  // null = applies to all customers
  name: string;
  description?: string;
  type: TriggerType;
  condition: TriggerCondition;
  actions: TriggerAction[];
  cooldownMinutes: number;
  maxFiresPerDay: number;
  enabled: boolean;
  lastFiredAt?: Date;
  fireCount: number;
  metadata?: Record<string, any>;
  createdAt: Date;
  updatedAt: Date;
}

// ============================================
// Customer Event
// ============================================

export interface CustomerEvent {
  id: string;
  type: CustomerEventType;
  customerId: string;
  customerName?: string;
  userId?: string;
  data: Record<string, any>;
  timestamp: Date;
  source?: string;
}

// ============================================
// Condition Processor
// ============================================

export interface ConditionProcessor {
  type: TriggerType;

  /**
   * Evaluate if the condition matches the event
   */
  evaluate: (condition: TriggerCondition, event: CustomerEvent) => Promise<boolean>;

  /**
   * Get human-readable description
   */
  getDescription: (condition: TriggerCondition) => string;

  /**
   * Validate condition params
   */
  validate?: (condition: TriggerCondition) => { valid: boolean; error?: string };
}

// ============================================
// Trigger Event (Fire Log)
// ============================================

export interface TriggerEvent {
  id: string;
  triggerId: string;
  customerId: string;
  eventType: CustomerEventType;
  eventData: Record<string, any>;
  actionsExecuted: Array<{
    actionId: string;
    actionType: TriggerActionType;
    success: boolean;
    result?: any;
    error?: string;
    executedAt: Date;
  }>;
  success: boolean;
  errorMessage?: string;
  firedAt: Date;
}

// ============================================
// Engine Events (for observability)
// ============================================

export interface TriggerEngineEvent {
  type: 'trigger_evaluated' | 'trigger_fired' | 'trigger_skipped' | 'action_executed' | 'action_failed';
  triggerId: string;
  triggerName: string;
  customerId?: string;
  details?: Record<string, any>;
  timestamp: Date;
}

// ============================================
// Exports
// ============================================

export { TriggerEngine, triggerEngine } from './engine.js';
