/**
 * Automation Service
 * Natural language-driven automation builder and scheduler
 */

import { createClient } from '@supabase/supabase-js';
import { Anthropic } from '@anthropic-ai/sdk';
import { config } from '../../config/index.js';
import { skillsService } from '../skills/index.js';
import { triggerEngine } from '../../triggers/engine.js';
import type { MCPContext } from '../../mcp/index.js';

const supabase = createClient(config.supabaseUrl!, config.supabaseServiceKey!);

// ============================================
// Types
// ============================================

export type AutomationType = 'scheduled' | 'triggered' | 'on_demand';

export type AutomationFrequency =
  | 'once'
  | 'daily'
  | 'weekly'
  | 'monthly'
  | 'custom';

export interface Automation {
  id: string;
  name: string;
  description: string;
  type: AutomationType;

  /**
   * Natural language description of what the automation should do
   */
  nlDescription: string;

  /**
   * Parsed automation steps
   */
  steps: AutomationStep[];

  /**
   * Schedule configuration (for scheduled type)
   */
  schedule?: {
    frequency: AutomationFrequency;
    time?: string;  // HH:MM
    dayOfWeek?: number;  // 0-6
    dayOfMonth?: number;  // 1-31
    cron?: string;  // Custom cron expression
    timezone?: string;
  };

  /**
   * Trigger configuration (for triggered type)
   */
  trigger?: {
    eventType: string;
    conditions?: Array<{
      field: string;
      operator: string;
      value: any;
    }>;
  };

  /**
   * Target scope
   */
  scope: {
    type: 'all_customers' | 'customer_segment' | 'specific_customers';
    segment?: string;
    customerIds?: string[];
    filter?: Record<string, any>;
  };

  enabled: boolean;
  createdBy: string;
  lastRunAt?: Date;
  nextRunAt?: Date;
  runCount: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface AutomationStep {
  order: number;
  type: 'skill' | 'tool' | 'condition' | 'delay';

  /**
   * For skill/tool types
   */
  skillId?: string;
  toolName?: string;
  params?: Record<string, any>;

  /**
   * For condition type
   */
  condition?: {
    field: string;
    operator: string;
    value: any;
    thenSteps?: AutomationStep[];
    elseSteps?: AutomationStep[];
  };

  /**
   * For delay type
   */
  delayMinutes?: number;
}

export interface AutomationRun {
  id: string;
  automationId: string;
  automationName: string;
  status: 'pending' | 'running' | 'completed' | 'failed' | 'partial';
  triggeredBy: 'schedule' | 'event' | 'manual';
  customersProcessed: number;
  customersSucceeded: number;
  customersFailed: number;
  errors: Array<{
    customerId: string;
    customerName?: string;
    error: string;
    step?: number;
  }>;
  startedAt: Date;
  completedAt?: Date;
}

export interface ParsedAutomation {
  name: string;
  description: string;
  type: AutomationType;
  steps: AutomationStep[];
  schedule?: Automation['schedule'];
  trigger?: Automation['trigger'];
  scope: Automation['scope'];
  confidence: number;
  suggestions?: string[];
}

// ============================================
// NL Automation Parser
// ============================================

export class NLAutomationParser {
  private anthropic: Anthropic;

  constructor() {
    this.anthropic = new Anthropic({
      apiKey: config.anthropicApiKey,
    });
  }

  /**
   * Parse natural language description into automation definition
   */
  async parse(nlDescription: string, context?: {
    availableSkills?: Array<{ id: string; name: string; description: string }>;
    availableTools?: string[];
    customerSegments?: string[];
  }): Promise<ParsedAutomation> {
    const systemPrompt = this.buildSystemPrompt(context);

    const response = await this.anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 4000,
      system: systemPrompt,
      messages: [
        {
          role: 'user',
          content: `Parse this automation request into a structured definition:\n\n"${nlDescription}"`,
        },
      ],
    });

    const responseText = response.content[0].type === 'text'
      ? response.content[0].text
      : '';

    return this.parseResponse(responseText, nlDescription);
  }

  /**
   * Build system prompt for parsing
   */
  private buildSystemPrompt(context?: {
    availableSkills?: Array<{ id: string; name: string; description: string }>;
    availableTools?: string[];
    customerSegments?: string[];
  }): string {
    let skillsSection = '';
    if (context?.availableSkills && context.availableSkills.length > 0) {
      skillsSection = `\nAvailable Skills:\n${context.availableSkills.map(s =>
        `- ${s.name} (${s.id}): ${s.description}`
      ).join('\n')}`;
    }

    let toolsSection = '';
    if (context?.availableTools && context.availableTools.length > 0) {
      toolsSection = `\nAvailable Tools:\n${context.availableTools.join(', ')}`;
    }

    let segmentsSection = '';
    if (context?.customerSegments && context.customerSegments.length > 0) {
      segmentsSection = `\nCustomer Segments:\n${context.customerSegments.join(', ')}`;
    }

    return `You are an automation builder for a Customer Success platform. Parse natural language descriptions of automations into structured definitions.

${skillsSection}
${toolsSection}
${segmentsSection}

Output a JSON object with this structure:
{
  "name": "Short descriptive name for the automation",
  "description": "Clear description of what the automation does",
  "type": "scheduled" | "triggered" | "on_demand",
  "steps": [
    {
      "order": 1,
      "type": "skill" | "tool" | "condition" | "delay",
      "skillId": "skill_id if type is skill",
      "toolName": "tool_name if type is tool",
      "params": { "param": "value or {{variable}}" },
      "condition": { /* if type is condition */ },
      "delayMinutes": 0
    }
  ],
  "schedule": {
    "frequency": "once" | "daily" | "weekly" | "monthly" | "custom",
    "time": "HH:MM",
    "dayOfWeek": 0-6,
    "dayOfMonth": 1-31,
    "cron": "custom cron if frequency is custom"
  },
  "trigger": {
    "eventType": "event_name",
    "conditions": [{ "field": "x", "operator": "eq", "value": "y" }]
  },
  "scope": {
    "type": "all_customers" | "customer_segment" | "specific_customers",
    "segment": "segment_name if applicable",
    "customerIds": ["id1", "id2"],
    "filter": { "field": "value" }
  },
  "confidence": 0.0-1.0,
  "suggestions": ["Suggestion for improvement or clarification"]
}

Important:
- Extract timing information to determine type and schedule
- Identify target customers/segments from the description
- Break complex actions into multiple steps
- Use available skills when possible, otherwise use tools
- Include conditions for branching logic
- Add appropriate delays between steps if needed
- Set confidence based on how well you understood the request
- Add suggestions if the request is ambiguous

Return ONLY valid JSON.`;
  }

  /**
   * Parse Claude's response
   */
  private parseResponse(responseText: string, originalDescription: string): ParsedAutomation {
    try {
      const jsonMatch = responseText.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        throw new Error('No JSON found in response');
      }

      const parsed = JSON.parse(jsonMatch[0]);

      return {
        name: parsed.name || 'Untitled Automation',
        description: parsed.description || originalDescription,
        type: parsed.type || 'on_demand',
        steps: parsed.steps || [],
        schedule: parsed.schedule,
        trigger: parsed.trigger,
        scope: parsed.scope || { type: 'all_customers' },
        confidence: parsed.confidence || 0.5,
        suggestions: parsed.suggestions,
      };
    } catch (error) {
      // Return a minimal parsed result on error
      return {
        name: 'Untitled Automation',
        description: originalDescription,
        type: 'on_demand',
        steps: [],
        scope: { type: 'all_customers' },
        confidence: 0,
        suggestions: ['Could not parse automation. Please provide more details.'],
      };
    }
  }
}

// ============================================
// Automation Service
// ============================================

export class AutomationService {
  private parser: NLAutomationParser;

  constructor() {
    this.parser = new NLAutomationParser();
  }

  /**
   * Create automation from natural language
   */
  async createFromNL(
    nlDescription: string,
    userId: string,
    options?: {
      name?: string;
      enabled?: boolean;
    },
    organizationId: string | null = null
  ): Promise<Automation> {
    // Get available skills for context
    const skills = await skillsService.listSkills({ enabled: true });
    const skillsContext = skills.map(s => ({
      id: s.id,
      name: s.name,
      description: s.description,
    }));

    // Parse the NL description
    const parsed = await this.parser.parse(nlDescription, {
      availableSkills: skillsContext,
    });

    // Create the automation
    return this.createAutomation({
      name: options?.name || parsed.name,
      description: parsed.description,
      type: parsed.type,
      nlDescription,
      steps: parsed.steps,
      schedule: parsed.schedule,
      trigger: parsed.trigger,
      scope: parsed.scope,
      enabled: options?.enabled ?? false,
      createdBy: userId,
    }, organizationId);
  }

  /**
   * Create an automation
   */
  async createAutomation(
    automation: Omit<Automation, 'id' | 'lastRunAt' | 'nextRunAt' | 'runCount' | 'createdAt' | 'updatedAt'>,
    organizationId: string | null = null
  ): Promise<Automation> {
    // Calculate next run time for scheduled automations
    let nextRunAt: Date | undefined;
    if (automation.type === 'scheduled' && automation.schedule && automation.enabled) {
      nextRunAt = this.calculateNextRunTime(automation.schedule);
    }

    const { data, error } = await supabase
      .from('automations')
      .insert({
        name: automation.name,
        description: automation.description,
        type: automation.type,
        nl_description: automation.nlDescription,
        steps: JSON.stringify(automation.steps),
        schedule: automation.schedule ? JSON.stringify(automation.schedule) : null,
        trigger_config: automation.trigger ? JSON.stringify(automation.trigger) : null,
        scope: JSON.stringify(automation.scope),
        enabled: automation.enabled,
        created_by: automation.createdBy,
        next_run_at: nextRunAt?.toISOString(),
        run_count: 0,
        ...(organizationId ? { organization_id: organizationId } : {}),
      })
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to create automation: ${error.message}`);
    }

    return this.parseAutomationRow(data);
  }

  /**
   * Get automation by ID
   */
  async getAutomation(automationId: string, organizationId: string | null = null): Promise<Automation | null> {
    let query = supabase
      .from('automations')
      .select('*')
      .eq('id', automationId);

    if (organizationId) query = query.eq('organization_id', organizationId);

    const { data, error } = await query.single();

    if (error || !data) return null;

    return this.parseAutomationRow(data);
  }

  /**
   * List automations
   */
  async listAutomations(options?: {
    type?: AutomationType;
    enabled?: boolean;
    createdBy?: string;
    limit?: number;
    offset?: number;
  }, organizationId: string | null = null): Promise<Automation[]> {
    let query = supabase
      .from('automations')
      .select('*')
      .order('created_at', { ascending: false });

    if (options?.type) query = query.eq('type', options.type);
    if (options?.enabled !== undefined) query = query.eq('enabled', options.enabled);
    if (options?.createdBy) query = query.eq('created_by', options.createdBy);
    if (organizationId) query = query.eq('organization_id', organizationId);

    query = query.range(
      options?.offset || 0,
      (options?.offset || 0) + (options?.limit || 50) - 1
    );

    const { data, error } = await query;
    if (error || !data) return [];

    return data.map(this.parseAutomationRow);
  }

  /**
   * Update automation
   */
  async updateAutomation(
    automationId: string,
    updates: Partial<Automation>,
    organizationId: string | null = null
  ): Promise<Automation> {
    const updateData: Record<string, any> = {
      updated_at: new Date().toISOString(),
    };

    if (updates.name) updateData.name = updates.name;
    if (updates.description) updateData.description = updates.description;
    if (updates.nlDescription) updateData.nl_description = updates.nlDescription;
    if (updates.steps) updateData.steps = JSON.stringify(updates.steps);
    if (updates.schedule) updateData.schedule = JSON.stringify(updates.schedule);
    if (updates.trigger) updateData.trigger_config = JSON.stringify(updates.trigger);
    if (updates.scope) updateData.scope = JSON.stringify(updates.scope);
    if (updates.enabled !== undefined) updateData.enabled = updates.enabled;

    // Recalculate next run time if schedule or enabled changed
    if (updates.schedule || updates.enabled !== undefined) {
      const current = await this.getAutomation(automationId, organizationId);
      if (current) {
        const schedule = updates.schedule || current.schedule;
        const enabled = updates.enabled !== undefined ? updates.enabled : current.enabled;

        if (current.type === 'scheduled' && schedule && enabled) {
          updateData.next_run_at = this.calculateNextRunTime(schedule)?.toISOString();
        } else {
          updateData.next_run_at = null;
        }
      }
    }

    let query = supabase
      .from('automations')
      .update(updateData)
      .eq('id', automationId);

    if (organizationId) query = query.eq('organization_id', organizationId);

    const { data, error } = await query
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to update automation: ${error.message}`);
    }

    return this.parseAutomationRow(data);
  }

  /**
   * Delete automation
   */
  async deleteAutomation(automationId: string, organizationId: string | null = null): Promise<void> {
    let query = supabase
      .from('automations')
      .delete()
      .eq('id', automationId);

    if (organizationId) query = query.eq('organization_id', organizationId);

    const { error } = await query;

    if (error) {
      throw new Error(`Failed to delete automation: ${error.message}`);
    }
  }

  /**
   * Run automation manually
   */
  async runAutomation(
    automationId: string,
    context: MCPContext,
    options?: {
      customerIds?: string[];
    },
    organizationId: string | null = null
  ): Promise<AutomationRun> {
    const automation = await this.getAutomation(automationId, organizationId);
    if (!automation) {
      throw new Error(`Automation not found: ${automationId}`);
    }

    // Create run record
    const run: AutomationRun = {
      id: `run_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      automationId,
      automationName: automation.name,
      status: 'running',
      triggeredBy: 'manual',
      customersProcessed: 0,
      customersSucceeded: 0,
      customersFailed: 0,
      errors: [],
      startedAt: new Date(),
    };

    // Store run
    await this.storeRun(run, organizationId);

    try {
      // Get target customers
      const customerIds = options?.customerIds || await this.getTargetCustomers(automation.scope, organizationId);

      // Process each customer
      for (const customerId of customerIds) {
        run.customersProcessed++;

        try {
          await this.runForCustomer(automation, customerId, context);
          run.customersSucceeded++;
        } catch (error) {
          run.customersFailed++;
          run.errors.push({
            customerId,
            error: (error as Error).message,
          });
        }
      }

      run.status = run.customersFailed > 0 && run.customersSucceeded > 0 ? 'partial' :
                   run.customersFailed > 0 ? 'failed' : 'completed';
    } catch (error) {
      run.status = 'failed';
      run.errors.push({
        customerId: 'system',
        error: (error as Error).message,
      });
    }

    run.completedAt = new Date();
    await this.updateRun(run, organizationId);

    // Update automation last run time and count
    await supabase
      .from('automations')
      .update({
        last_run_at: run.startedAt.toISOString(),
        run_count: automation.runCount + 1,
        next_run_at: automation.type === 'scheduled' && automation.schedule
          ? this.calculateNextRunTime(automation.schedule)?.toISOString()
          : null,
      })
      .eq('id', automationId);

    return run;
  }

  /**
   * Run automation for a specific customer
   */
  private async runForCustomer(
    automation: Automation,
    customerId: string,
    context: MCPContext
  ): Promise<void> {
    const customerContext: MCPContext = {
      ...context,
      customerId,
    };

    // Execute steps in order
    for (const step of automation.steps.sort((a, b) => a.order - b.order)) {
      await this.executeStep(step, customerContext);
    }
  }

  /**
   * Execute a single automation step
   */
  private async executeStep(
    step: AutomationStep,
    context: MCPContext
  ): Promise<void> {
    switch (step.type) {
      case 'skill':
        if (step.skillId) {
          await skillsService.executeSkill(step.skillId, step.params || {}, context);
        }
        break;

      case 'delay':
        if (step.delayMinutes) {
          await new Promise(resolve => setTimeout(resolve, step.delayMinutes! * 60 * 1000));
        }
        break;

      case 'condition':
        // Handle conditional branching
        // This would need access to customer data to evaluate
        break;

      default:
        // Unknown step type
        break;
    }
  }

  /**
   * Get target customers based on scope
   */
  private async getTargetCustomers(scope: Automation['scope'], organizationId: string | null = null): Promise<string[]> {
    switch (scope.type) {
      case 'specific_customers':
        return scope.customerIds || [];

      case 'customer_segment':
        let segQuery = supabase
          .from('customers')
          .select('id')
          .eq('segment', scope.segment);
        if (organizationId) segQuery = segQuery.eq('organization_id', organizationId);
        const { data: segmentCustomers } = await segQuery;
        return segmentCustomers?.map(c => c.id) || [];

      case 'all_customers':
      default:
        let query = supabase.from('customers').select('id');

        if (organizationId) query = query.eq('organization_id', organizationId);

        if (scope.filter) {
          for (const [field, value] of Object.entries(scope.filter)) {
            query = query.eq(field, value);
          }
        }

        const { data: allCustomers } = await query;
        return allCustomers?.map(c => c.id) || [];
    }
  }

  /**
   * Calculate next run time for scheduled automation
   */
  private calculateNextRunTime(schedule: Automation['schedule']): Date | undefined {
    if (!schedule) return undefined;

    const now = new Date();
    const next = new Date(now);

    // Set time if specified
    if (schedule.time) {
      const [hours, minutes] = schedule.time.split(':').map(Number);
      next.setHours(hours, minutes, 0, 0);
    }

    switch (schedule.frequency) {
      case 'once':
        // Return the scheduled time if in future
        return next > now ? next : undefined;

      case 'daily':
        if (next <= now) {
          next.setDate(next.getDate() + 1);
        }
        return next;

      case 'weekly':
        if (schedule.dayOfWeek !== undefined) {
          const daysUntilTarget = (schedule.dayOfWeek - now.getDay() + 7) % 7;
          next.setDate(now.getDate() + (daysUntilTarget || 7));
        }
        if (next <= now) {
          next.setDate(next.getDate() + 7);
        }
        return next;

      case 'monthly':
        if (schedule.dayOfMonth !== undefined) {
          next.setDate(schedule.dayOfMonth);
        }
        if (next <= now) {
          next.setMonth(next.getMonth() + 1);
        }
        return next;

      default:
        return undefined;
    }
  }

  /**
   * Parse automation row from database
   */
  private parseAutomationRow(row: any): Automation {
    return {
      id: row.id,
      name: row.name,
      description: row.description,
      type: row.type,
      nlDescription: row.nl_description,
      steps: typeof row.steps === 'string' ? JSON.parse(row.steps) : row.steps,
      schedule: row.schedule ? (typeof row.schedule === 'string' ? JSON.parse(row.schedule) : row.schedule) : undefined,
      trigger: row.trigger_config ? (typeof row.trigger_config === 'string' ? JSON.parse(row.trigger_config) : row.trigger_config) : undefined,
      scope: typeof row.scope === 'string' ? JSON.parse(row.scope) : row.scope,
      enabled: row.enabled,
      createdBy: row.created_by,
      lastRunAt: row.last_run_at ? new Date(row.last_run_at) : undefined,
      nextRunAt: row.next_run_at ? new Date(row.next_run_at) : undefined,
      runCount: row.run_count || 0,
      createdAt: new Date(row.created_at),
      updatedAt: new Date(row.updated_at || row.created_at),
    };
  }

  /**
   * Store run record
   */
  private async storeRun(run: AutomationRun, organizationId: string | null = null): Promise<void> {
    await supabase.from('automation_runs').insert({
      id: run.id,
      automation_id: run.automationId,
      automation_name: run.automationName,
      status: run.status,
      triggered_by: run.triggeredBy,
      customers_processed: run.customersProcessed,
      customers_succeeded: run.customersSucceeded,
      customers_failed: run.customersFailed,
      errors: JSON.stringify(run.errors),
      started_at: run.startedAt.toISOString(),
      ...(organizationId ? { organization_id: organizationId } : {}),
    });
  }

  /**
   * Update run record
   */
  private async updateRun(run: AutomationRun, organizationId: string | null = null): Promise<void> {
    let query = supabase
      .from('automation_runs')
      .update({
        status: run.status,
        customers_processed: run.customersProcessed,
        customers_succeeded: run.customersSucceeded,
        customers_failed: run.customersFailed,
        errors: JSON.stringify(run.errors),
        completed_at: run.completedAt?.toISOString(),
      })
      .eq('id', run.id);

    if (organizationId) query = query.eq('organization_id', organizationId);

    await query;
  }

  /**
   * Get run by ID
   */
  async getRun(runId: string, organizationId: string | null = null): Promise<AutomationRun | null> {
    let query = supabase
      .from('automation_runs')
      .select('*')
      .eq('id', runId);

    if (organizationId) query = query.eq('organization_id', organizationId);

    const { data, error } = await query.single();

    if (error || !data) return null;

    return {
      id: data.id,
      automationId: data.automation_id,
      automationName: data.automation_name,
      status: data.status,
      triggeredBy: data.triggered_by,
      customersProcessed: data.customers_processed,
      customersSucceeded: data.customers_succeeded,
      customersFailed: data.customers_failed,
      errors: typeof data.errors === 'string' ? JSON.parse(data.errors) : data.errors,
      startedAt: new Date(data.started_at),
      completedAt: data.completed_at ? new Date(data.completed_at) : undefined,
    };
  }

  /**
   * List runs for an automation
   */
  async listRuns(options?: {
    automationId?: string;
    status?: string;
    limit?: number;
    offset?: number;
  }, organizationId: string | null = null): Promise<AutomationRun[]> {
    let query = supabase
      .from('automation_runs')
      .select('*')
      .order('started_at', { ascending: false });

    if (options?.automationId) query = query.eq('automation_id', options.automationId);
    if (options?.status) query = query.eq('status', options.status);
    if (organizationId) query = query.eq('organization_id', organizationId);

    query = query.range(
      options?.offset || 0,
      (options?.offset || 0) + (options?.limit || 50) - 1
    );

    const { data, error } = await query;
    if (error || !data) return [];

    return data.map(row => ({
      id: row.id,
      automationId: row.automation_id,
      automationName: row.automation_name,
      status: row.status,
      triggeredBy: row.triggered_by,
      customersProcessed: row.customers_processed,
      customersSucceeded: row.customers_succeeded,
      customersFailed: row.customers_failed,
      errors: typeof row.errors === 'string' ? JSON.parse(row.errors) : row.errors,
      startedAt: new Date(row.started_at),
      completedAt: row.completed_at ? new Date(row.completed_at) : undefined,
    }));
  }
}

// ============================================
// Singleton Export
// ============================================

export const automationService = new AutomationService();
export const nlAutomationParser = new NLAutomationParser();
