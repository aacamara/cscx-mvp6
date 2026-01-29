/**
 * Skills Service
 * Reusable multi-step workflows that agents can compose
 */

import { createClient } from '@supabase/supabase-js';
import { Anthropic } from '@anthropic-ai/sdk';
import { config } from '../../config/index.js';
import { mcpRegistry } from '../../mcp/registry.js';
import type { MCPContext, MCPResult } from '../../mcp/index.js';

const supabase = createClient(config.supabaseUrl!, config.supabaseServiceKey!);

// ============================================
// Types
// ============================================

export type SkillCategory =
  | 'communication'
  | 'scheduling'
  | 'research'
  | 'reporting'
  | 'documentation'
  | 'analysis'
  | 'workflow'
  | 'custom';

export interface SkillStep {
  id: string;
  name: string;
  description?: string;

  /**
   * The MCP tool to execute
   */
  tool: string;

  /**
   * Parameters for the tool - can include {{variables}}
   */
  params: Record<string, any>;

  /**
   * Condition for executing this step (optional)
   */
  condition?: {
    type: 'always' | 'if_previous_success' | 'if_variable' | 'custom';
    variable?: string;
    operator?: 'eq' | 'ne' | 'contains' | 'exists';
    value?: any;
  };

  /**
   * How to handle the result
   */
  resultHandling?: {
    saveAs?: string;  // Variable name to save result
    extractField?: string;  // Extract specific field from result
    transform?: 'stringify' | 'parse' | 'first' | 'count';
  };

  /**
   * If true, continue even if this step fails
   */
  continueOnError?: boolean;

  /**
   * Retry configuration
   */
  retry?: {
    maxAttempts: number;
    delayMs: number;
  };
}

export interface Skill {
  id: string;
  name: string;
  description: string;
  category: SkillCategory;
  steps: SkillStep[];

  /**
   * Input variables required to execute this skill
   */
  inputs: SkillInput[];

  /**
   * Output produced by the skill
   */
  outputs?: SkillOutput[];

  /**
   * Permissions required
   */
  requiredPermissions?: string[];

  /**
   * Whether this skill requires human approval before executing
   */
  requiresApproval?: boolean;

  /**
   * Estimated execution time in seconds
   */
  estimatedDuration?: number;

  /**
   * Tags for discovery
   */
  tags?: string[];

  enabled: boolean;
  source: 'system' | 'user';
  createdBy?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface SkillInput {
  name: string;
  type: 'string' | 'number' | 'boolean' | 'date' | 'customer' | 'array' | 'object';
  required: boolean;
  description?: string;
  defaultValue?: any;
  validation?: {
    pattern?: string;
    min?: number;
    max?: number;
    options?: any[];
  };
}

export interface SkillOutput {
  name: string;
  type: string;
  description?: string;
}

export interface SkillExecution {
  id: string;
  skillId: string;
  skillName: string;
  userId: string;
  customerId?: string;

  /**
   * Input values provided
   */
  inputs: Record<string, any>;

  /**
   * Variables accumulated during execution
   */
  variables: Record<string, any>;

  /**
   * Results from each step
   */
  stepResults: SkillStepResult[];

  /**
   * Final output
   */
  output?: Record<string, any>;

  status: 'pending' | 'running' | 'completed' | 'failed' | 'cancelled';
  error?: string;
  startedAt: Date;
  completedAt?: Date;
}

export interface SkillStepResult {
  stepId: string;
  stepName: string;
  tool: string;
  status: 'pending' | 'running' | 'success' | 'failed' | 'skipped';
  result?: any;
  error?: string;
  startedAt?: Date;
  completedAt?: Date;
  durationMs?: number;
}

// ============================================
// Skills Service
// ============================================

export class SkillsService {
  private anthropic: Anthropic;

  constructor() {
    this.anthropic = new Anthropic({
      apiKey: config.anthropicApiKey,
    });
  }

  // ============================================
  // Skill Management
  // ============================================

  /**
   * Get a skill by ID
   */
  async getSkill(skillId: string): Promise<Skill | null> {
    const { data, error } = await supabase
      .from('skills')
      .select('*')
      .eq('id', skillId)
      .single();

    if (error || !data) return null;

    return this.parseSkillRow(data);
  }

  /**
   * List available skills
   */
  async listSkills(options?: {
    category?: SkillCategory;
    enabled?: boolean;
    search?: string;
    tags?: string[];
  }): Promise<Skill[]> {
    let query = supabase.from('skills').select('*');

    if (options?.category) {
      query = query.eq('category', options.category);
    }

    if (options?.enabled !== undefined) {
      query = query.eq('enabled', options.enabled);
    }

    if (options?.search) {
      query = query.or(
        `name.ilike.%${options.search}%,description.ilike.%${options.search}%`
      );
    }

    if (options?.tags && options.tags.length > 0) {
      query = query.contains('tags', options.tags);
    }

    const { data, error } = await query.order('name');

    if (error || !data) return [];

    return data.map(this.parseSkillRow);
  }

  /**
   * Create a new skill
   */
  async createSkill(skill: Omit<Skill, 'id' | 'createdAt' | 'updatedAt'>): Promise<Skill> {
    const { data, error } = await supabase
      .from('skills')
      .insert({
        name: skill.name,
        description: skill.description,
        category: skill.category,
        steps: JSON.stringify(skill.steps),
        inputs: JSON.stringify(skill.inputs),
        outputs: skill.outputs ? JSON.stringify(skill.outputs) : null,
        required_permissions: skill.requiredPermissions,
        requires_approval: skill.requiresApproval || false,
        estimated_duration: skill.estimatedDuration,
        tags: skill.tags,
        enabled: skill.enabled,
        source: skill.source,
        created_by: skill.createdBy,
      })
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to create skill: ${error.message}`);
    }

    return this.parseSkillRow(data);
  }

  /**
   * Update a skill
   */
  async updateSkill(skillId: string, updates: Partial<Skill>): Promise<Skill> {
    const updateData: Record<string, any> = {
      updated_at: new Date().toISOString(),
    };

    if (updates.name) updateData.name = updates.name;
    if (updates.description) updateData.description = updates.description;
    if (updates.category) updateData.category = updates.category;
    if (updates.steps) updateData.steps = JSON.stringify(updates.steps);
    if (updates.inputs) updateData.inputs = JSON.stringify(updates.inputs);
    if (updates.outputs) updateData.outputs = JSON.stringify(updates.outputs);
    if (updates.requiredPermissions) updateData.required_permissions = updates.requiredPermissions;
    if (updates.requiresApproval !== undefined) updateData.requires_approval = updates.requiresApproval;
    if (updates.estimatedDuration) updateData.estimated_duration = updates.estimatedDuration;
    if (updates.tags) updateData.tags = updates.tags;
    if (updates.enabled !== undefined) updateData.enabled = updates.enabled;

    const { data, error } = await supabase
      .from('skills')
      .update(updateData)
      .eq('id', skillId)
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to update skill: ${error.message}`);
    }

    return this.parseSkillRow(data);
  }

  /**
   * Delete a skill
   */
  async deleteSkill(skillId: string): Promise<void> {
    const { error } = await supabase
      .from('skills')
      .delete()
      .eq('id', skillId);

    if (error) {
      throw new Error(`Failed to delete skill: ${error.message}`);
    }
  }

  // ============================================
  // Skill Execution
  // ============================================

  /**
   * Execute a skill
   */
  async executeSkill(
    skillId: string,
    inputs: Record<string, any>,
    context: MCPContext
  ): Promise<SkillExecution> {
    const skill = await this.getSkill(skillId);
    if (!skill) {
      throw new Error(`Skill not found: ${skillId}`);
    }

    if (!skill.enabled) {
      throw new Error(`Skill is disabled: ${skill.name}`);
    }

    // Validate inputs
    this.validateInputs(skill, inputs);

    // Create execution record
    const execution: SkillExecution = {
      id: `exec_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      skillId,
      skillName: skill.name,
      userId: context.userId,
      customerId: context.customerId,
      inputs,
      variables: { ...inputs },
      stepResults: [],
      status: 'running',
      startedAt: new Date(),
    };

    // Store execution
    await this.storeExecution(execution);

    try {
      // Execute steps
      for (const step of skill.steps) {
        const stepResult = await this.executeStep(step, execution, context);
        execution.stepResults.push(stepResult);

        // Check if we should continue
        if (stepResult.status === 'failed' && !step.continueOnError) {
          execution.status = 'failed';
          execution.error = stepResult.error;
          break;
        }

        // Store intermediate result
        if (step.resultHandling?.saveAs && stepResult.result) {
          let valueToSave = stepResult.result;

          if (step.resultHandling.extractField) {
            valueToSave = stepResult.result[step.resultHandling.extractField];
          }

          if (step.resultHandling.transform) {
            valueToSave = this.transformValue(valueToSave, step.resultHandling.transform);
          }

          execution.variables[step.resultHandling.saveAs] = valueToSave;
        }
      }

      // Mark completed if not failed
      if (execution.status !== 'failed') {
        execution.status = 'completed';
        execution.output = execution.variables;
      }
    } catch (error) {
      execution.status = 'failed';
      execution.error = (error as Error).message;
    }

    execution.completedAt = new Date();
    await this.updateExecution(execution);

    return execution;
  }

  /**
   * Execute a single step
   */
  private async executeStep(
    step: SkillStep,
    execution: SkillExecution,
    context: MCPContext
  ): Promise<SkillStepResult> {
    const stepResult: SkillStepResult = {
      stepId: step.id,
      stepName: step.name,
      tool: step.tool,
      status: 'pending',
      startedAt: new Date(),
    };

    // Check condition
    if (step.condition) {
      const shouldExecute = this.evaluateCondition(step.condition, execution);
      if (!shouldExecute) {
        stepResult.status = 'skipped';
        stepResult.completedAt = new Date();
        return stepResult;
      }
    }

    stepResult.status = 'running';

    // Interpolate parameters
    const params = this.interpolateParams(step.params, execution.variables);

    // Execute with retry
    let attempts = 0;
    const maxAttempts = step.retry?.maxAttempts || 1;
    const delayMs = step.retry?.delayMs || 1000;

    while (attempts < maxAttempts) {
      attempts++;

      try {
        const result = await mcpRegistry.executeTool(step.tool, params, context);

        if (result.success) {
          stepResult.status = 'success';
          stepResult.result = result.data;
        } else {
          throw new Error(result.error || 'Tool execution failed');
        }
        break;
      } catch (error) {
        if (attempts < maxAttempts) {
          await new Promise((resolve) => setTimeout(resolve, delayMs));
        } else {
          stepResult.status = 'failed';
          stepResult.error = (error as Error).message;
        }
      }
    }

    stepResult.completedAt = new Date();
    stepResult.durationMs = stepResult.completedAt.getTime() - stepResult.startedAt!.getTime();

    return stepResult;
  }

  /**
   * Validate inputs against skill definition
   */
  private validateInputs(skill: Skill, inputs: Record<string, any>): void {
    for (const input of skill.inputs) {
      const value = inputs[input.name];

      if (input.required && (value === undefined || value === null)) {
        throw new Error(`Missing required input: ${input.name}`);
      }

      if (value !== undefined && value !== null) {
        // Type validation
        const actualType = Array.isArray(value) ? 'array' : typeof value;
        if (input.type !== 'customer' && actualType !== input.type) {
          throw new Error(`Invalid type for ${input.name}: expected ${input.type}, got ${actualType}`);
        }

        // Validation rules
        if (input.validation) {
          if (input.validation.pattern && typeof value === 'string') {
            if (!new RegExp(input.validation.pattern).test(value)) {
              throw new Error(`${input.name} does not match required pattern`);
            }
          }

          if (input.validation.min !== undefined && typeof value === 'number') {
            if (value < input.validation.min) {
              throw new Error(`${input.name} must be at least ${input.validation.min}`);
            }
          }

          if (input.validation.max !== undefined && typeof value === 'number') {
            if (value > input.validation.max) {
              throw new Error(`${input.name} must be at most ${input.validation.max}`);
            }
          }

          if (input.validation.options && !input.validation.options.includes(value)) {
            throw new Error(`${input.name} must be one of: ${input.validation.options.join(', ')}`);
          }
        }
      }
    }
  }

  /**
   * Evaluate a step condition
   */
  private evaluateCondition(
    condition: SkillStep['condition'],
    execution: SkillExecution
  ): boolean {
    if (!condition) return true;

    switch (condition.type) {
      case 'always':
        return true;

      case 'if_previous_success':
        const lastResult = execution.stepResults[execution.stepResults.length - 1];
        return lastResult?.status === 'success';

      case 'if_variable':
        if (!condition.variable) return true;
        const value = execution.variables[condition.variable];

        switch (condition.operator) {
          case 'eq':
            return value === condition.value;
          case 'ne':
            return value !== condition.value;
          case 'contains':
            return String(value).includes(String(condition.value));
          case 'exists':
            return value !== undefined && value !== null;
          default:
            return true;
        }

      default:
        return true;
    }
  }

  /**
   * Interpolate variables in parameters
   */
  private interpolateParams(
    params: Record<string, any>,
    variables: Record<string, any>
  ): Record<string, any> {
    const result: Record<string, any> = {};

    for (const [key, value] of Object.entries(params)) {
      if (typeof value === 'string') {
        // Replace {{variable}} patterns
        result[key] = value.replace(/\{\{(\w+)\}\}/g, (_, varName) => {
          return variables[varName] !== undefined ? String(variables[varName]) : '';
        });
      } else if (typeof value === 'object' && value !== null) {
        result[key] = this.interpolateParams(value, variables);
      } else {
        result[key] = value;
      }
    }

    return result;
  }

  /**
   * Transform a value
   */
  private transformValue(value: any, transform: string): any {
    switch (transform) {
      case 'stringify':
        return JSON.stringify(value);
      case 'parse':
        return typeof value === 'string' ? JSON.parse(value) : value;
      case 'first':
        return Array.isArray(value) ? value[0] : value;
      case 'count':
        return Array.isArray(value) ? value.length : 1;
      default:
        return value;
    }
  }

  /**
   * Parse a skill row from database
   */
  private parseSkillRow(row: any): Skill {
    return {
      id: row.id,
      name: row.name,
      description: row.description,
      category: row.category,
      steps: typeof row.steps === 'string' ? JSON.parse(row.steps) : row.steps,
      inputs: typeof row.inputs === 'string' ? JSON.parse(row.inputs) : row.inputs,
      outputs: row.outputs ? (typeof row.outputs === 'string' ? JSON.parse(row.outputs) : row.outputs) : undefined,
      requiredPermissions: row.required_permissions,
      requiresApproval: row.requires_approval,
      estimatedDuration: row.estimated_duration,
      tags: row.tags,
      enabled: row.enabled,
      source: row.source,
      createdBy: row.created_by,
      createdAt: new Date(row.created_at),
      updatedAt: new Date(row.updated_at || row.created_at),
    };
  }

  /**
   * Store execution record
   */
  private async storeExecution(execution: SkillExecution): Promise<void> {
    await supabase.from('skill_executions').insert({
      id: execution.id,
      skill_id: execution.skillId,
      skill_name: execution.skillName,
      user_id: execution.userId,
      customer_id: execution.customerId,
      inputs: JSON.stringify(execution.inputs),
      variables: JSON.stringify(execution.variables),
      step_results: JSON.stringify(execution.stepResults),
      status: execution.status,
      started_at: execution.startedAt.toISOString(),
    });
  }

  /**
   * Update execution record
   */
  private async updateExecution(execution: SkillExecution): Promise<void> {
    await supabase
      .from('skill_executions')
      .update({
        variables: JSON.stringify(execution.variables),
        step_results: JSON.stringify(execution.stepResults),
        output: execution.output ? JSON.stringify(execution.output) : null,
        status: execution.status,
        error: execution.error,
        completed_at: execution.completedAt?.toISOString(),
      })
      .eq('id', execution.id);
  }

  /**
   * Get execution by ID
   */
  async getExecution(executionId: string): Promise<SkillExecution | null> {
    const { data, error } = await supabase
      .from('skill_executions')
      .select('*')
      .eq('id', executionId)
      .single();

    if (error || !data) return null;

    return {
      id: data.id,
      skillId: data.skill_id,
      skillName: data.skill_name,
      userId: data.user_id,
      customerId: data.customer_id,
      inputs: typeof data.inputs === 'string' ? JSON.parse(data.inputs) : data.inputs,
      variables: typeof data.variables === 'string' ? JSON.parse(data.variables) : data.variables,
      stepResults: typeof data.step_results === 'string' ? JSON.parse(data.step_results) : data.step_results,
      output: data.output ? (typeof data.output === 'string' ? JSON.parse(data.output) : data.output) : undefined,
      status: data.status,
      error: data.error,
      startedAt: new Date(data.started_at),
      completedAt: data.completed_at ? new Date(data.completed_at) : undefined,
    };
  }

  /**
   * List executions
   */
  async listExecutions(options?: {
    skillId?: string;
    userId?: string;
    customerId?: string;
    status?: string;
    limit?: number;
    offset?: number;
  }): Promise<SkillExecution[]> {
    let query = supabase
      .from('skill_executions')
      .select('*')
      .order('started_at', { ascending: false });

    if (options?.skillId) query = query.eq('skill_id', options.skillId);
    if (options?.userId) query = query.eq('user_id', options.userId);
    if (options?.customerId) query = query.eq('customer_id', options.customerId);
    if (options?.status) query = query.eq('status', options.status);

    query = query.range(
      options?.offset || 0,
      (options?.offset || 0) + (options?.limit || 50) - 1
    );

    const { data, error } = await query;
    if (error || !data) return [];

    return data.map((row) => ({
      id: row.id,
      skillId: row.skill_id,
      skillName: row.skill_name,
      userId: row.user_id,
      customerId: row.customer_id,
      inputs: typeof row.inputs === 'string' ? JSON.parse(row.inputs) : row.inputs,
      variables: typeof row.variables === 'string' ? JSON.parse(row.variables) : row.variables,
      stepResults: typeof row.step_results === 'string' ? JSON.parse(row.step_results) : row.step_results,
      output: row.output ? (typeof row.output === 'string' ? JSON.parse(row.output) : row.output) : undefined,
      status: row.status,
      error: row.error,
      startedAt: new Date(row.started_at),
      completedAt: row.completed_at ? new Date(row.completed_at) : undefined,
    }));
  }
}

// ============================================
// Singleton Export
// ============================================

export const skillsService = new SkillsService();
