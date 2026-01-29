/**
 * Trigger Engine
 * Processes events and fires matching triggers
 */

import { v4 as uuidv4 } from 'uuid';
import { createClient } from '@supabase/supabase-js';
import { config } from '../config/index.js';
import { mcpRegistry } from '../mcp/registry.js';
import { MCPContext } from '../mcp/index.js';
import {
  Trigger,
  TriggerCondition,
  TriggerAction,
  CustomerEvent,
  TriggerEvent,
  TriggerEngineEvent,
  ConditionProcessor,
  TriggerType,
} from './index.js';

// Import condition processors
import { healthScoreDropProcessor } from './conditions/health-score-drop.js';
import { noLoginProcessor } from './conditions/no-login.js';
import { renewalApproachingProcessor } from './conditions/renewal-approaching.js';
import { ticketEscalatedProcessor } from './conditions/ticket-escalated.js';
import { npsSubmittedProcessor } from './conditions/nps-submitted.js';
import { usageAnomalyProcessor } from './conditions/usage-anomaly.js';

// ============================================
// Trigger Engine
// ============================================

export class TriggerEngine {
  private supabase: ReturnType<typeof createClient> | null = null;
  private processors: Map<TriggerType, ConditionProcessor> = new Map();
  private eventListeners: Array<(event: TriggerEngineEvent) => void> = [];
  private triggerCache: Map<string, Trigger[]> = new Map();
  private cacheExpiry: Date = new Date(0);

  constructor() {
    if (config.supabaseUrl && config.supabaseServiceKey) {
      this.supabase = createClient(config.supabaseUrl, config.supabaseServiceKey);
    }

    // Register condition processors
    this.registerProcessors();
  }

  private registerProcessors(): void {
    this.processors.set('health_score_drop', healthScoreDropProcessor);
    this.processors.set('no_login', noLoginProcessor);
    this.processors.set('renewal_approaching', renewalApproachingProcessor);
    this.processors.set('ticket_escalated', ticketEscalatedProcessor);
    this.processors.set('nps_submitted', npsSubmittedProcessor);
    this.processors.set('usage_anomaly', usageAnomalyProcessor);
  }

  // ============================================
  // Event Processing
  // ============================================

  /**
   * Process an event and fire matching triggers
   */
  async processEvent(event: CustomerEvent): Promise<TriggerEvent[]> {
    const firedTriggers: TriggerEvent[] = [];

    // Get applicable triggers
    const triggers = await this.getApplicableTriggers(event.customerId);

    for (const trigger of triggers) {
      try {
        // Check cooldown
        if (!this.checkCooldown(trigger)) {
          this.emitEvent({
            type: 'trigger_skipped',
            triggerId: trigger.id,
            triggerName: trigger.name,
            customerId: event.customerId,
            details: { reason: 'cooldown' },
            timestamp: new Date(),
          });
          continue;
        }

        // Check daily limit
        if (!await this.checkDailyLimit(trigger)) {
          this.emitEvent({
            type: 'trigger_skipped',
            triggerId: trigger.id,
            triggerName: trigger.name,
            customerId: event.customerId,
            details: { reason: 'daily_limit' },
            timestamp: new Date(),
          });
          continue;
        }

        // Evaluate condition
        const matches = await this.evaluateCondition(trigger.condition, event);

        this.emitEvent({
          type: 'trigger_evaluated',
          triggerId: trigger.id,
          triggerName: trigger.name,
          customerId: event.customerId,
          details: { matches },
          timestamp: new Date(),
        });

        if (matches) {
          // Fire trigger
          const triggerEvent = await this.fireTrigger(trigger, event);
          firedTriggers.push(triggerEvent);
        }
      } catch (error) {
        console.error(`[TriggerEngine] Error processing trigger ${trigger.id}:`, error);
      }
    }

    return firedTriggers;
  }

  // ============================================
  // Condition Evaluation
  // ============================================

  private async evaluateCondition(
    condition: TriggerCondition,
    event: CustomerEvent
  ): Promise<boolean> {
    const processor = this.processors.get(condition.type);

    if (!processor) {
      console.warn(`[TriggerEngine] No processor for condition type: ${condition.type}`);
      return false;
    }

    // Evaluate main condition
    const mainResult = await processor.evaluate(condition, event);

    // Handle sub-conditions if present
    if (condition.subConditions && condition.subConditions.length > 0) {
      const subResults = await Promise.all(
        condition.subConditions.map((sub) => this.evaluateCondition(sub, event))
      );

      if (condition.logic === 'OR') {
        return mainResult || subResults.some((r) => r);
      }
      return mainResult && subResults.every((r) => r);
    }

    return mainResult;
  }

  // ============================================
  // Trigger Firing
  // ============================================

  private async fireTrigger(trigger: Trigger, event: CustomerEvent): Promise<TriggerEvent> {
    const triggerEvent: TriggerEvent = {
      id: uuidv4(),
      triggerId: trigger.id,
      customerId: event.customerId,
      eventType: event.type,
      eventData: event.data,
      actionsExecuted: [],
      success: true,
      firedAt: new Date(),
    };

    this.emitEvent({
      type: 'trigger_fired',
      triggerId: trigger.id,
      triggerName: trigger.name,
      customerId: event.customerId,
      details: { eventType: event.type },
      timestamp: new Date(),
    });

    // Execute actions
    for (const action of trigger.actions) {
      try {
        // Handle delayed actions
        if (action.delay && action.delay > 0) {
          await this.scheduleDelayedAction(trigger, action, event);
          triggerEvent.actionsExecuted.push({
            actionId: action.id,
            actionType: action.type,
            success: true,
            result: { scheduled: true, delayMinutes: action.delay },
            executedAt: new Date(),
          });
          continue;
        }

        // Execute action
        const result = await this.executeAction(trigger, action, event);

        triggerEvent.actionsExecuted.push({
          actionId: action.id,
          actionType: action.type,
          success: result.success,
          result: result.data,
          error: result.error,
          executedAt: new Date(),
        });

        this.emitEvent({
          type: result.success ? 'action_executed' : 'action_failed',
          triggerId: trigger.id,
          triggerName: trigger.name,
          customerId: event.customerId,
          details: {
            actionId: action.id,
            actionType: action.type,
            error: result.error,
          },
          timestamp: new Date(),
        });

        if (!result.success) {
          triggerEvent.success = false;
        }
      } catch (error) {
        triggerEvent.actionsExecuted.push({
          actionId: action.id,
          actionType: action.type,
          success: false,
          error: (error as Error).message,
          executedAt: new Date(),
        });
        triggerEvent.success = false;
      }
    }

    // Update trigger stats
    await this.updateTriggerStats(trigger.id);

    // Save trigger event
    await this.saveTriggerEvent(triggerEvent);

    return triggerEvent;
  }

  // ============================================
  // Action Execution
  // ============================================

  private async executeAction(
    trigger: Trigger,
    action: TriggerAction,
    event: CustomerEvent
  ): Promise<{ success: boolean; data?: any; error?: string }> {
    // Check conditional execution
    if (action.condition) {
      try {
        const shouldExecute = this.evaluateActionCondition(action.condition, event);
        if (!shouldExecute) {
          return { success: true, data: { skipped: true, reason: 'condition_not_met' } };
        }
      } catch (error) {
        return { success: false, error: `Condition evaluation failed: ${(error as Error).message}` };
      }
    }

    // Execute based on action type
    switch (action.type) {
      case 'send_email':
      case 'send_slack':
        if (action.tool) {
          return this.executeMCPAction(trigger, action, event);
        }
        return { success: false, error: 'No MCP tool specified for action' };

      case 'create_task':
        return this.createTask(action, event);

      case 'start_playbook':
        return this.startPlaybook(action, event);

      case 'update_health_score':
        return this.updateHealthScore(action, event);

      case 'notify_csm':
        return this.notifyCSM(trigger, action, event);

      case 'log_activity':
        return this.logActivity(action, event);

      case 'webhook':
        return this.callWebhook(action, event);

      default:
        return { success: false, error: `Unknown action type: ${action.type}` };
    }
  }

  private async executeMCPAction(
    trigger: Trigger,
    action: TriggerAction,
    event: CustomerEvent
  ): Promise<{ success: boolean; data?: any; error?: string }> {
    if (!action.tool) {
      return { success: false, error: 'No MCP tool specified' };
    }

    const context: MCPContext = {
      userId: trigger.userId,
      customerId: event.customerId,
      customerName: event.customerName,
      metadata: {
        triggerId: trigger.id,
        triggerName: trigger.name,
      },
    };

    // Interpolate params with event data
    const params = this.interpolateParams(action.params, event);

    const result = await mcpRegistry.execute(action.tool, params, context);

    return {
      success: result.success,
      data: result.data,
      error: result.error,
    };
  }

  private async createTask(
    action: TriggerAction,
    event: CustomerEvent
  ): Promise<{ success: boolean; data?: any; error?: string }> {
    if (!this.supabase) return { success: false, error: 'Database not available' };

    const params = this.interpolateParams(action.params, event);

    // This would integrate with your task/activity system
    console.log('[TriggerEngine] Creating task:', params);

    return { success: true, data: { taskCreated: true } };
  }

  private async startPlaybook(
    action: TriggerAction,
    event: CustomerEvent
  ): Promise<{ success: boolean; data?: any; error?: string }> {
    // This would integrate with the PlaybookExecutor
    const { playbookId, variables } = action.params;

    console.log(`[TriggerEngine] Starting playbook ${playbookId} for customer ${event.customerId}`);

    return {
      success: true,
      data: { playbookStarted: true, playbookId },
    };
  }

  private async updateHealthScore(
    action: TriggerAction,
    event: CustomerEvent
  ): Promise<{ success: boolean; data?: any; error?: string }> {
    if (!this.supabase) return { success: false, error: 'Database not available' };

    const { adjustment, reason } = action.params;

    const { data: customer } = await this.supabase
      .from('customers')
      .select('health_score')
      .eq('id', event.customerId)
      .single();

    if (!customer) return { success: false, error: 'Customer not found' };

    const newScore = Math.max(0, Math.min(100, (customer.health_score || 50) + adjustment));

    await this.supabase
      .from('customers')
      .update({ health_score: newScore, updated_at: new Date().toISOString() })
      .eq('id', event.customerId);

    return {
      success: true,
      data: { previousScore: customer.health_score, newScore, adjustment, reason },
    };
  }

  private async notifyCSM(
    trigger: Trigger,
    action: TriggerAction,
    event: CustomerEvent
  ): Promise<{ success: boolean; data?: any; error?: string }> {
    // This would send a notification to the CSM (email, Slack, in-app)
    const message = this.interpolateParams(action.params, event);

    console.log(`[TriggerEngine] Notifying CSM for trigger ${trigger.name}:`, message);

    return { success: true, data: { notified: true } };
  }

  private async logActivity(
    action: TriggerAction,
    event: CustomerEvent
  ): Promise<{ success: boolean; data?: any; error?: string }> {
    if (!this.supabase) return { success: false, error: 'Database not available' };

    const params = this.interpolateParams(action.params, event);

    // Log to activity log
    // This would integrate with your activity logging system

    return { success: true, data: { logged: true } };
  }

  private async callWebhook(
    action: TriggerAction,
    event: CustomerEvent
  ): Promise<{ success: boolean; data?: any; error?: string }> {
    const { url, method = 'POST', headers = {} } = action.params;
    const body = this.interpolateParams(action.params.body || {}, event);

    try {
      const response = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
          ...headers,
        },
        body: JSON.stringify(body),
      });

      if (!response.ok) {
        return { success: false, error: `Webhook returned ${response.status}` };
      }

      return { success: true, data: { status: response.status } };
    } catch (error) {
      return { success: false, error: (error as Error).message };
    }
  }

  // ============================================
  // Helper Methods
  // ============================================

  private interpolateParams(params: any, event: CustomerEvent): any {
    if (typeof params === 'string') {
      return params
        .replace(/\{\{customerId\}\}/g, event.customerId)
        .replace(/\{\{customerName\}\}/g, event.customerName || '')
        .replace(/\{\{eventType\}\}/g, event.type)
        .replace(/\{\{(\w+)\}\}/g, (_, key) => event.data[key] || '');
    }

    if (Array.isArray(params)) {
      return params.map((p) => this.interpolateParams(p, event));
    }

    if (typeof params === 'object' && params !== null) {
      const result: Record<string, any> = {};
      for (const [key, value] of Object.entries(params)) {
        result[key] = this.interpolateParams(value, event);
      }
      return result;
    }

    return params;
  }

  private evaluateActionCondition(condition: string, event: CustomerEvent): boolean {
    // Simple condition evaluation (e.g., "event.data.score < 50")
    // In production, use a proper expression evaluator
    try {
      const fn = new Function('event', `return ${condition}`);
      return fn(event);
    } catch {
      return true;
    }
  }

  private checkCooldown(trigger: Trigger): boolean {
    if (!trigger.lastFiredAt) return true;

    const cooldownMs = trigger.cooldownMinutes * 60 * 1000;
    const timeSinceLastFire = Date.now() - new Date(trigger.lastFiredAt).getTime();

    return timeSinceLastFire >= cooldownMs;
  }

  private async checkDailyLimit(trigger: Trigger): Promise<boolean> {
    if (!this.supabase) return true;

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const { count } = await this.supabase
      .from('trigger_events')
      .select('id', { count: 'exact', head: true })
      .eq('trigger_id', trigger.id)
      .gte('fired_at', today.toISOString());

    return (count || 0) < trigger.maxFiresPerDay;
  }

  private async scheduleDelayedAction(
    trigger: Trigger,
    action: TriggerAction,
    event: CustomerEvent
  ): Promise<void> {
    // In production, use a proper job queue (Bull, Agenda, etc.)
    const delayMs = (action.delay || 0) * 60 * 1000;

    setTimeout(async () => {
      try {
        await this.executeAction(trigger, action, event);
      } catch (error) {
        console.error('[TriggerEngine] Delayed action failed:', error);
      }
    }, delayMs);
  }

  // ============================================
  // Database Operations
  // ============================================

  private async getApplicableTriggers(customerId: string): Promise<Trigger[]> {
    if (!this.supabase) return [];

    // Check cache
    if (this.cacheExpiry > new Date() && this.triggerCache.has(customerId)) {
      return this.triggerCache.get(customerId) || [];
    }

    // Fetch triggers for this customer or global triggers (customer_id is null)
    const { data, error } = await this.supabase
      .from('triggers')
      .select('*')
      .eq('enabled', true)
      .or(`customer_id.eq.${customerId},customer_id.is.null`);

    if (error) {
      console.error('[TriggerEngine] Failed to fetch triggers:', error);
      return [];
    }

    const triggers: Trigger[] = (data || []).map(this.mapDbTrigger);

    // Update cache
    this.triggerCache.set(customerId, triggers);
    this.cacheExpiry = new Date(Date.now() + 60000); // 1 minute cache

    return triggers;
  }

  private mapDbTrigger(row: any): Trigger {
    return {
      id: row.id,
      userId: row.user_id,
      customerId: row.customer_id,
      name: row.name,
      description: row.description,
      type: row.type,
      condition: row.condition,
      actions: row.actions,
      cooldownMinutes: row.cooldown_minutes || 60,
      maxFiresPerDay: row.max_fires_per_day || 10,
      enabled: row.enabled,
      lastFiredAt: row.last_fired_at ? new Date(row.last_fired_at) : undefined,
      fireCount: row.fire_count || 0,
      metadata: row.metadata,
      createdAt: new Date(row.created_at),
      updatedAt: new Date(row.updated_at),
    };
  }

  private async updateTriggerStats(triggerId: string): Promise<void> {
    if (!this.supabase) return;

    await this.supabase
      .from('triggers')
      .update({
        last_fired_at: new Date().toISOString(),
        fire_count: this.supabase.rpc('increment', { x: 1 }),
        updated_at: new Date().toISOString(),
      })
      .eq('id', triggerId);

    // Invalidate cache
    this.cacheExpiry = new Date(0);
  }

  private async saveTriggerEvent(event: TriggerEvent): Promise<void> {
    if (!this.supabase) return;

    await this.supabase.from('trigger_events').insert({
      id: event.id,
      trigger_id: event.triggerId,
      customer_id: event.customerId,
      event_type: event.eventType,
      event_data: event.eventData,
      actions_executed: event.actionsExecuted,
      success: event.success,
      error_message: event.errorMessage,
      fired_at: event.firedAt.toISOString(),
    });
  }

  // ============================================
  // Event Listeners
  // ============================================

  addEventListener(listener: (event: TriggerEngineEvent) => void): void {
    this.eventListeners.push(listener);
  }

  removeEventListener(listener: (event: TriggerEngineEvent) => void): void {
    const index = this.eventListeners.indexOf(listener);
    if (index > -1) {
      this.eventListeners.splice(index, 1);
    }
  }

  private emitEvent(event: TriggerEngineEvent): void {
    for (const listener of this.eventListeners) {
      try {
        listener(event);
      } catch (error) {
        console.error('[TriggerEngine] Event listener error:', error);
      }
    }
  }

  // ============================================
  // Public API
  // ============================================

  getProcessor(type: TriggerType): ConditionProcessor | undefined {
    return this.processors.get(type);
  }

  listProcessors(): TriggerType[] {
    return Array.from(this.processors.keys());
  }

  clearCache(): void {
    this.triggerCache.clear();
    this.cacheExpiry = new Date(0);
  }
}

// Singleton instance
export const triggerEngine = new TriggerEngine();
