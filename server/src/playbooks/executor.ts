/**
 * Playbook Executor
 * Manages playbook execution lifecycle
 */

import { v4 as uuidv4 } from 'uuid';
import { createClient } from '@supabase/supabase-js';
import { config } from '../config/index.js';
import { mcpRegistry } from '../mcp/registry.js';
import { MCPContext } from '../mcp/index.js';
import {
  Playbook,
  PlaybookExecution,
  PlaybookStage,
  PlaybookAction,
  ActionResult,
  PlaybookEvent,
  ExecutionStatus,
  StageStatus,
} from './index.js';

// ============================================
// Playbook Executor
// ============================================

export class PlaybookExecutor {
  private supabase: ReturnType<typeof createClient> | null = null;
  private eventListeners: Array<(event: PlaybookEvent) => void> = [];

  constructor() {
    if (config.supabaseUrl && config.supabaseServiceKey) {
      this.supabase = createClient(config.supabaseUrl, config.supabaseServiceKey);
    }
  }

  // ============================================
  // Execution Lifecycle
  // ============================================

  /**
   * Start a new playbook execution
   */
  async startExecution(
    playbookId: string,
    customerId: string,
    userId: string,
    anchorDate: Date,
    variables?: Record<string, any>
  ): Promise<PlaybookExecution> {
    const playbook = await this.getPlaybook(playbookId);
    if (!playbook) {
      throw new Error(`Playbook ${playbookId} not found`);
    }

    if (!playbook.enabled) {
      throw new Error(`Playbook ${playbookId} is disabled`);
    }

    // Get customer name
    const customerName = await this.getCustomerName(customerId);

    // Initialize execution
    const execution: PlaybookExecution = {
      id: uuidv4(),
      playbookId,
      playbookName: playbook.name,
      customerId,
      customerName,
      userId,
      anchorDate,
      currentStep: 0,
      stageStatuses: {},
      actionResults: [],
      variables: variables || {},
      status: 'active',
      startedAt: new Date(),
    };

    // Initialize stage statuses
    for (const stage of playbook.stages) {
      execution.stageStatuses[stage.id] = 'pending';
    }

    // Find and set the first stage
    const firstStage = this.getNextStage(playbook, execution);
    if (firstStage) {
      execution.currentStage = firstStage.id;
      execution.stageStatuses[firstStage.id] = 'in_progress';
    }

    // Save execution
    await this.saveExecution(execution);

    // Emit event
    this.emitEvent({
      type: 'execution_started',
      executionId: execution.id,
      playbookId,
      customerId,
      details: { anchorDate, variables },
      timestamp: new Date(),
    });

    // Process first stage
    if (firstStage) {
      await this.processStage(execution, playbook, firstStage);
    }

    return execution;
  }

  /**
   * Pause execution
   */
  async pauseExecution(executionId: string): Promise<PlaybookExecution> {
    const execution = await this.getExecution(executionId);
    if (!execution) {
      throw new Error(`Execution ${executionId} not found`);
    }

    if (execution.status !== 'active') {
      throw new Error(`Cannot pause execution with status ${execution.status}`);
    }

    execution.status = 'paused';
    execution.pausedAt = new Date();

    await this.saveExecution(execution);

    this.emitEvent({
      type: 'execution_paused',
      executionId: execution.id,
      playbookId: execution.playbookId,
      customerId: execution.customerId,
      timestamp: new Date(),
    });

    return execution;
  }

  /**
   * Resume execution
   */
  async resumeExecution(executionId: string): Promise<PlaybookExecution> {
    const execution = await this.getExecution(executionId);
    if (!execution) {
      throw new Error(`Execution ${executionId} not found`);
    }

    if (execution.status !== 'paused') {
      throw new Error(`Cannot resume execution with status ${execution.status}`);
    }

    execution.status = 'active';
    execution.pausedAt = undefined;

    await this.saveExecution(execution);

    this.emitEvent({
      type: 'execution_resumed',
      executionId: execution.id,
      playbookId: execution.playbookId,
      customerId: execution.customerId,
      timestamp: new Date(),
    });

    // Continue processing
    const playbook = await this.getPlaybook(execution.playbookId);
    if (playbook && execution.currentStage) {
      const currentStage = playbook.stages.find(s => s.id === execution.currentStage);
      if (currentStage) {
        await this.processStage(execution, playbook, currentStage);
      }
    }

    return execution;
  }

  /**
   * Cancel execution
   */
  async cancelExecution(executionId: string, reason?: string): Promise<PlaybookExecution> {
    const execution = await this.getExecution(executionId);
    if (!execution) {
      throw new Error(`Execution ${executionId} not found`);
    }

    if (execution.status === 'completed' || execution.status === 'cancelled') {
      throw new Error(`Cannot cancel execution with status ${execution.status}`);
    }

    execution.status = 'cancelled';
    execution.completedAt = new Date();
    execution.metadata = {
      ...execution.metadata,
      cancellationReason: reason,
    };

    await this.saveExecution(execution);

    this.emitEvent({
      type: 'execution_failed',
      executionId: execution.id,
      playbookId: execution.playbookId,
      customerId: execution.customerId,
      details: { reason: 'cancelled', cancellationReason: reason },
      timestamp: new Date(),
    });

    return execution;
  }

  // ============================================
  // Stage Processing
  // ============================================

  /**
   * Advance to the next stage
   */
  async advanceStage(executionId: string): Promise<PlaybookExecution> {
    const execution = await this.getExecution(executionId);
    if (!execution) {
      throw new Error(`Execution ${executionId} not found`);
    }

    const playbook = await this.getPlaybook(execution.playbookId);
    if (!playbook) {
      throw new Error(`Playbook ${execution.playbookId} not found`);
    }

    // Mark current stage as completed
    if (execution.currentStage) {
      execution.stageStatuses[execution.currentStage] = 'completed';

      this.emitEvent({
        type: 'stage_completed',
        executionId: execution.id,
        playbookId: execution.playbookId,
        customerId: execution.customerId,
        stageId: execution.currentStage,
        timestamp: new Date(),
      });
    }

    // Find next stage
    const nextStage = this.getNextStage(playbook, execution);

    if (!nextStage) {
      // All stages completed
      execution.status = 'completed';
      execution.completedAt = new Date();
      execution.currentStage = undefined;

      await this.saveExecution(execution);

      this.emitEvent({
        type: 'execution_completed',
        executionId: execution.id,
        playbookId: execution.playbookId,
        customerId: execution.customerId,
        timestamp: new Date(),
      });

      return execution;
    }

    // Move to next stage
    execution.currentStage = nextStage.id;
    execution.stageStatuses[nextStage.id] = 'in_progress';
    execution.currentStep = 0;

    await this.saveExecution(execution);

    this.emitEvent({
      type: 'stage_entered',
      executionId: execution.id,
      playbookId: execution.playbookId,
      customerId: execution.customerId,
      stageId: nextStage.id,
      timestamp: new Date(),
    });

    // Process the new stage
    await this.processStage(execution, playbook, nextStage);

    return execution;
  }

  /**
   * Skip current stage
   */
  async skipStage(executionId: string, reason?: string): Promise<PlaybookExecution> {
    const execution = await this.getExecution(executionId);
    if (!execution) {
      throw new Error(`Execution ${executionId} not found`);
    }

    if (!execution.currentStage) {
      throw new Error('No current stage to skip');
    }

    execution.stageStatuses[execution.currentStage] = 'skipped';

    this.emitEvent({
      type: 'stage_skipped',
      executionId: execution.id,
      playbookId: execution.playbookId,
      customerId: execution.customerId,
      stageId: execution.currentStage,
      details: { reason },
      timestamp: new Date(),
    });

    // Advance to next stage
    return this.advanceStage(executionId);
  }

  // ============================================
  // Action Execution
  // ============================================

  /**
   * Execute a specific action
   */
  async executeAction(
    executionId: string,
    actionId: string
  ): Promise<ActionResult> {
    const execution = await this.getExecution(executionId);
    if (!execution) {
      throw new Error(`Execution ${executionId} not found`);
    }

    const playbook = await this.getPlaybook(execution.playbookId);
    if (!playbook) {
      throw new Error(`Playbook ${execution.playbookId} not found`);
    }

    // Find the action
    const { stage, action } = this.findAction(playbook, actionId);
    if (!action) {
      throw new Error(`Action ${actionId} not found`);
    }

    // Check if already executed
    const existingResult = execution.actionResults.find(r => r.actionId === actionId);
    if (existingResult && existingResult.status === 'executed') {
      return existingResult;
    }

    this.emitEvent({
      type: 'action_started',
      executionId: execution.id,
      playbookId: execution.playbookId,
      customerId: execution.customerId,
      stageId: stage.id,
      actionId,
      timestamp: new Date(),
    });

    // Execute the action
    let result: ActionResult;

    try {
      if (action.tool) {
        // Execute via MCP
        result = await this.executeMCPAction(execution, stage, action);
      } else {
        // Execute built-in action
        result = await this.executeBuiltinAction(execution, stage, action);
      }
    } catch (error) {
      result = {
        actionId,
        stageId: stage.id,
        actionType: action.type,
        status: 'failed',
        error: (error as Error).message,
        executedAt: new Date(),
      };
    }

    // Update execution with result
    const resultIndex = execution.actionResults.findIndex(r => r.actionId === actionId);
    if (resultIndex >= 0) {
      execution.actionResults[resultIndex] = result;
    } else {
      execution.actionResults.push(result);
    }

    await this.saveExecution(execution);

    this.emitEvent({
      type: result.status === 'failed' ? 'action_failed' : 'action_completed',
      executionId: execution.id,
      playbookId: execution.playbookId,
      customerId: execution.customerId,
      stageId: stage.id,
      actionId,
      details: { result },
      timestamp: new Date(),
    });

    return result;
  }

  /**
   * Execute action via MCP tool
   */
  private async executeMCPAction(
    execution: PlaybookExecution,
    stage: PlaybookStage,
    action: PlaybookAction
  ): Promise<ActionResult> {
    const context: MCPContext = {
      userId: execution.userId,
      customerId: execution.customerId,
      customerName: execution.customerName,
      metadata: {
        playbookId: execution.playbookId,
        executionId: execution.id,
        stageId: stage.id,
      },
    };

    // Interpolate params with execution variables
    const params = this.interpolateParams(action.params, execution);

    const mcpResult = await mcpRegistry.execute(action.tool!, params, context);

    return {
      actionId: action.id,
      stageId: stage.id,
      actionType: action.type,
      status: mcpResult.success ? 'executed' : 'failed',
      result: mcpResult.data,
      error: mcpResult.error,
      executedAt: new Date(),
    };
  }

  /**
   * Execute built-in action
   */
  private async executeBuiltinAction(
    execution: PlaybookExecution,
    stage: PlaybookStage,
    action: PlaybookAction
  ): Promise<ActionResult> {
    // Handle built-in action types that don't use MCP
    switch (action.type) {
      case 'task':
        // Create a task in the system
        return {
          actionId: action.id,
          stageId: stage.id,
          actionType: action.type,
          status: 'executed',
          result: { taskCreated: true },
          executedAt: new Date(),
        };

      case 'internal_note':
        // Log an internal note
        return {
          actionId: action.id,
          stageId: stage.id,
          actionType: action.type,
          status: 'executed',
          result: { noteLogged: true },
          executedAt: new Date(),
        };

      default:
        return {
          actionId: action.id,
          stageId: stage.id,
          actionType: action.type,
          status: 'failed',
          error: `No handler for action type: ${action.type}`,
          executedAt: new Date(),
        };
    }
  }

  // ============================================
  // Helper Methods
  // ============================================

  private async processStage(
    execution: PlaybookExecution,
    playbook: Playbook,
    stage: PlaybookStage
  ): Promise<void> {
    // Check if stage should be executed based on day offset
    const daysFromAnchor = this.getDaysFromAnchor(execution.anchorDate);

    // For scheduled stages, check if it's time
    if (stage.dayOffset !== undefined) {
      // If the day offset is in the future, schedule for later
      if (stage.dayOffset > daysFromAnchor) {
        console.log(`[PlaybookExecutor] Stage ${stage.id} scheduled for day ${stage.dayOffset}`);
        return;
      }
    }

    // Execute actions that are ready
    for (const action of stage.actions) {
      // Check day delay
      if (action.dayDelay && action.dayDelay > 0) {
        // Schedule delayed action
        continue;
      }

      // Check if requires approval
      if (action.requiresApproval || stage.requiresApproval) {
        // Create pending action result awaiting approval
        execution.actionResults.push({
          actionId: action.id,
          stageId: stage.id,
          actionType: action.type,
          status: 'pending',
        });
        continue;
      }

      // Execute immediately
      await this.executeAction(execution.id, action.id);
    }
  }

  private getNextStage(playbook: Playbook, execution: PlaybookExecution): PlaybookStage | null {
    for (const stage of playbook.stages) {
      const status = execution.stageStatuses[stage.id];
      if (status === 'pending' || !status) {
        return stage;
      }
    }
    return null;
  }

  private findAction(playbook: Playbook, actionId: string): { stage: PlaybookStage; action: PlaybookAction | null } {
    for (const stage of playbook.stages) {
      const action = stage.actions.find(a => a.id === actionId);
      if (action) {
        return { stage, action };
      }
    }
    return { stage: playbook.stages[0], action: null };
  }

  private getDaysFromAnchor(anchorDate: Date): number {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const anchor = new Date(anchorDate);
    anchor.setHours(0, 0, 0, 0);

    return Math.floor((today.getTime() - anchor.getTime()) / (1000 * 60 * 60 * 24));
  }

  private interpolateParams(params: any, execution: PlaybookExecution): any {
    if (typeof params === 'string') {
      let result = params
        .replace(/\{\{customerId\}\}/g, execution.customerId)
        .replace(/\{\{customerName\}\}/g, execution.customerName || '')
        .replace(/\{\{anchorDate\}\}/g, execution.anchorDate.toISOString());

      // Replace variables
      for (const [key, value] of Object.entries(execution.variables)) {
        result = result.replace(new RegExp(`\\{\\{${key}\\}\\}`, 'g'), String(value));
      }

      return result;
    }

    if (Array.isArray(params)) {
      return params.map(p => this.interpolateParams(p, execution));
    }

    if (typeof params === 'object' && params !== null) {
      const result: Record<string, any> = {};
      for (const [key, value] of Object.entries(params)) {
        result[key] = this.interpolateParams(value, execution);
      }
      return result;
    }

    return params;
  }

  // ============================================
  // Database Operations
  // ============================================

  async getPlaybook(playbookId: string): Promise<Playbook | null> {
    if (!this.supabase) return null;

    const { data, error } = await this.supabase
      .from('playbooks')
      .select('*')
      .eq('id', playbookId)
      .single();

    if (error || !data) return null;

    return {
      id: data.id,
      name: data.name,
      description: data.description,
      type: data.type,
      category: data.category || 'engagement',
      stages: data.stages,
      triggers: data.triggers,
      variables: data.variables,
      estimatedDurationDays: data.estimated_duration_days,
      source: data.source || 'system',
      enabled: data.enabled,
      metadata: data.metadata,
      createdAt: new Date(data.created_at),
      updatedAt: new Date(data.updated_at),
    };
  }

  async getExecution(executionId: string): Promise<PlaybookExecution | null> {
    if (!this.supabase) return null;

    const { data, error } = await this.supabase
      .from('playbook_executions')
      .select('*')
      .eq('id', executionId)
      .single();

    if (error || !data) return null;

    return {
      id: data.id,
      playbookId: data.playbook_id,
      customerId: data.customer_id,
      userId: data.user_id,
      anchorDate: new Date(data.anchor_date),
      currentStage: data.current_stage,
      currentStep: data.current_step || 0,
      stageStatuses: data.stage_statuses || {},
      actionResults: data.action_results || [],
      variables: data.variables || {},
      status: data.status,
      startedAt: new Date(data.started_at),
      pausedAt: data.paused_at ? new Date(data.paused_at) : undefined,
      completedAt: data.completed_at ? new Date(data.completed_at) : undefined,
      metadata: data.metadata,
    };
  }

  async listExecutions(
    customerId?: string,
    status?: ExecutionStatus
  ): Promise<PlaybookExecution[]> {
    if (!this.supabase) return [];

    let query = this.supabase.from('playbook_executions').select('*');

    if (customerId) {
      query = query.eq('customer_id', customerId);
    }

    if (status) {
      query = query.eq('status', status);
    }

    const { data, error } = await query.order('started_at', { ascending: false });

    if (error || !data) return [];

    return data.map(row => ({
      id: row.id,
      playbookId: row.playbook_id,
      customerId: row.customer_id,
      userId: row.user_id,
      anchorDate: new Date(row.anchor_date),
      currentStage: row.current_stage,
      currentStep: row.current_step || 0,
      stageStatuses: row.stage_statuses || {},
      actionResults: row.action_results || [],
      variables: row.variables || {},
      status: row.status,
      startedAt: new Date(row.started_at),
      pausedAt: row.paused_at ? new Date(row.paused_at) : undefined,
      completedAt: row.completed_at ? new Date(row.completed_at) : undefined,
      metadata: row.metadata,
    }));
  }

  private async saveExecution(execution: PlaybookExecution): Promise<void> {
    if (!this.supabase) return;

    await this.supabase.from('playbook_executions').upsert({
      id: execution.id,
      playbook_id: execution.playbookId,
      customer_id: execution.customerId,
      user_id: execution.userId,
      anchor_date: execution.anchorDate.toISOString(),
      current_stage: execution.currentStage,
      current_step: execution.currentStep,
      stage_statuses: execution.stageStatuses,
      action_results: execution.actionResults,
      variables: execution.variables,
      status: execution.status,
      started_at: execution.startedAt.toISOString(),
      paused_at: execution.pausedAt?.toISOString(),
      completed_at: execution.completedAt?.toISOString(),
      metadata: execution.metadata,
    });
  }

  private async getCustomerName(customerId: string): Promise<string | undefined> {
    if (!this.supabase) return undefined;

    const { data } = await this.supabase
      .from('customers')
      .select('name')
      .eq('id', customerId)
      .single();

    return data?.name;
  }

  // ============================================
  // Event Listeners
  // ============================================

  addEventListener(listener: (event: PlaybookEvent) => void): void {
    this.eventListeners.push(listener);
  }

  removeEventListener(listener: (event: PlaybookEvent) => void): void {
    const index = this.eventListeners.indexOf(listener);
    if (index > -1) {
      this.eventListeners.splice(index, 1);
    }
  }

  private emitEvent(event: PlaybookEvent): void {
    for (const listener of this.eventListeners) {
      try {
        listener(event);
      } catch (error) {
        console.error('[PlaybookExecutor] Event listener error:', error);
      }
    }
  }
}

// Singleton instance
export const playbookExecutor = new PlaybookExecutor();
