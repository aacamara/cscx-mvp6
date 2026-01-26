/**
 * Agent Tracer Service
 * Real-time observability for AI agent execution
 * Tracks all agent runs, steps, tool calls, and state changes
 * Persists to Supabase and emits WebSocket events for live UI updates
 */

import { EventEmitter } from 'events';
import { v4 as uuidv4 } from 'uuid';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import * as langsmith from './langsmith.js';
import { config } from '../config/index.js';

// ============================================
// Types
// ============================================

export type StepType =
  | 'thinking'      // Agent is processing/reasoning
  | 'tool_call'     // Calling a tool
  | 'tool_result'   // Tool returned result
  | 'llm_call'      // Calling LLM (Claude/Gemini)
  | 'llm_response'  // LLM returned response
  | 'decision'      // Agent made a decision/branch
  | 'handoff'       // Handing off to another agent
  | 'approval'      // Waiting for HITL approval
  | 'response'      // Final response to user
  | 'error';        // Error occurred

export type RunStatus = 'running' | 'completed' | 'failed' | 'waiting_approval';

export interface AgentStep {
  id: string;
  runId: string;
  type: StepType;
  name: string;
  description?: string;
  input?: any;
  output?: any;
  timestamp: Date;
  duration?: number;
  parentStepId?: string;  // For nested steps
  metadata?: Record<string, any>;
  tokens?: {
    input: number;
    output: number;
  };
}

export interface AgentRun {
  id: string;
  agentId: string;
  agentName: string;
  agentType: 'orchestrator' | 'specialist' | 'support';
  userId: string;
  sessionId?: string;
  customerId?: string;
  customerContext?: Record<string, any>;
  startTime: Date;
  endTime?: Date;
  status: RunStatus;
  steps: AgentStep[];
  input: string;
  output?: string;
  totalTokens?: {
    input: number;
    output: number;
  };
  childRuns?: string[];  // IDs of child agent runs (for orchestrator)
  parentRunId?: string;  // Parent run if this is a sub-agent
  error?: string;
  metadata?: Record<string, any>;
  langsmithRunId?: string;
}

export interface TraceEvent {
  type: 'run:start' | 'run:end' | 'step:start' | 'step:end' | 'status:change';
  runId: string;
  data: Partial<AgentRun> | AgentStep;
  timestamp: Date;
}

// ============================================
// Agent Tracer Service (Singleton)
// ============================================

class AgentTracerService extends EventEmitter {
  private runs: Map<string, AgentRun> = new Map();
  private activeRuns: Set<string> = new Set();
  private stepTimers: Map<string, number> = new Map();
  private supabase: SupabaseClient | null = null;
  private persistenceEnabled: boolean = false;

  // LangSmith integration
  private langsmithEnabled: boolean = false;
  private langsmithProject?: string;

  constructor() {
    super();

    // Initialize Supabase client for persistence
    if (config.supabaseUrl && config.supabaseServiceKey) {
      this.supabase = createClient(config.supabaseUrl, config.supabaseServiceKey);
      this.persistenceEnabled = true;
      console.log('📊 Agent Tracer: Supabase persistence enabled');
    } else {
      console.warn('⚠️ Agent Tracer: Running in memory-only mode (no Supabase)');
    }

    // Initialize LangSmith
    this.langsmithEnabled = process.env.LANGCHAIN_TRACING_V2 === 'true';
    this.langsmithProject = process.env.LANGCHAIN_PROJECT || 'cscx-agents';

    if (this.langsmithEnabled) {
      console.log(`🔍 LangSmith tracing enabled for project: ${this.langsmithProject}`);
    }
  }

  // ============================================
  // Run Management
  // ============================================

  /**
   * Start a new agent run
   */
  async startRun(params: {
    agentId: string;
    agentName: string;
    agentType: 'orchestrator' | 'specialist' | 'support';
    userId: string;
    sessionId?: string;
    customerId?: string;
    customerContext?: Record<string, any>;
    input: string;
    parentRunId?: string;
    metadata?: Record<string, any>;
  }): Promise<AgentRun> {
    const runId = uuidv4();

    const run: AgentRun = {
      id: runId,
      agentId: params.agentId,
      agentName: params.agentName,
      agentType: params.agentType,
      userId: params.userId,
      sessionId: params.sessionId,
      customerId: params.customerId,
      customerContext: params.customerContext,
      startTime: new Date(),
      status: 'running',
      steps: [],
      input: params.input,
      parentRunId: params.parentRunId,
      totalTokens: { input: 0, output: 0 },
      childRuns: [],
      metadata: params.metadata
    };

    // Store in memory for real-time access
    this.runs.set(run.id, run);
    this.activeRuns.add(run.id);

    // If this is a child run, add to parent's childRuns
    if (params.parentRunId) {
      const parentRun = this.runs.get(params.parentRunId);
      if (parentRun) {
        parentRun.childRuns = parentRun.childRuns || [];
        parentRun.childRuns.push(run.id);
      }
    }

    // Persist to Supabase
    if (this.persistenceEnabled && this.supabase) {
      try {
        // Helper to validate UUID format (user_id column requires UUID or NULL)
        const isValidUUID = (str: string) => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(str);

        await this.supabase.from('agent_runs').insert({
          id: run.id,
          agent_id: run.agentId,
          agent_name: run.agentName,
          agent_type: run.agentType,
          user_id: isValidUUID(run.userId) ? run.userId : null, // NULL if not a valid UUID
          session_id: run.sessionId,
          customer_id: run.customerId,
          customer_context: run.customerContext,
          parent_run_id: run.parentRunId,
          status: run.status,
          input: run.input,
          metadata: { ...run.metadata, original_user_id: run.userId }, // Store original ID in metadata
          started_at: run.startTime.toISOString()
        });
      } catch (error) {
        console.error('Failed to persist run to Supabase:', error);
      }
    }

    // Emit event for WebSocket
    this.emitEvent({
      type: 'run:start',
      runId: run.id,
      data: run,
      timestamp: new Date()
    });

    // Send to LangSmith if enabled
    if (langsmith.isEnabled()) {
      try {
        await langsmith.startRun(run.id, {
          name: run.agentName,
          runType: 'chain',
          inputs: { message: params.input, customerContext: params.customerContext },
          metadata: { agentId: run.agentId, agentType: run.agentType, ...params.metadata },
          tags: [run.agentType, run.agentId],
          parentRunId: params.parentRunId,
        });
        run.langsmithRunId = run.id;
      } catch (err) {
        console.error('LangSmith startRun error:', err);
      }
    }

    console.log(`🚀 Agent run started: ${run.agentName} (${run.id})`);
    return run;
  }

  /**
   * End an agent run
   */
  async endRun(runId: string, params: {
    status: RunStatus;
    output?: string;
    error?: string;
  }): Promise<AgentRun | null> {
    const run = this.runs.get(runId);
    if (!run) return null;

    run.endTime = new Date();
    run.status = params.status;
    run.output = params.output;
    run.error = params.error;

    this.activeRuns.delete(runId);

    // Persist to Supabase
    if (this.persistenceEnabled && this.supabase) {
      try {
        await this.supabase.from('agent_runs').update({
          status: run.status,
          output: run.output,
          error: run.error,
          total_tokens_input: run.totalTokens?.input || 0,
          total_tokens_output: run.totalTokens?.output || 0,
          ended_at: run.endTime.toISOString()
        }).eq('id', runId);
      } catch (error) {
        console.error('Failed to update run in Supabase:', error);
      }
    }

    // Emit event
    this.emitEvent({
      type: 'run:end',
      runId: run.id,
      data: run,
      timestamp: new Date()
    });

    // Send to LangSmith if enabled
    if (langsmith.isEnabled()) {
      try {
        await langsmith.endRun(
          runId,
          { response: params.output, status: params.status },
          params.error
        );
      } catch (err) {
        console.error('LangSmith endRun error:', err);
      }
    }

    const duration = run.endTime.getTime() - run.startTime.getTime();
    console.log(`✅ Agent run ended: ${run.agentName} (${duration}ms) - ${params.status}`);

    return run;
  }

  // ============================================
  // Step Management
  // ============================================

  /**
   * Start a new step within a run
   */
  async startStep(runId: string, params: {
    type: StepType;
    name: string;
    description?: string;
    input?: any;
    parentStepId?: string;
    metadata?: Record<string, any>;
  }): Promise<AgentStep | null> {
    const run = this.runs.get(runId);
    if (!run) return null;

    const step: AgentStep = {
      id: uuidv4(),
      runId,
      type: params.type,
      name: params.name,
      description: params.description,
      input: params.input,
      timestamp: new Date(),
      parentStepId: params.parentStepId,
      metadata: params.metadata
    };

    run.steps.push(step);
    this.stepTimers.set(step.id, Date.now());

    // Persist to Supabase
    if (this.persistenceEnabled && this.supabase) {
      try {
        await this.supabase.from('agent_steps').insert({
          id: step.id,
          run_id: runId,
          parent_step_id: params.parentStepId,
          type: step.type,
          name: step.name,
          description: step.description,
          input: step.input,
          metadata: params.metadata,
          created_at: step.timestamp.toISOString()
        });
      } catch (error) {
        console.error('Failed to persist step to Supabase:', error);
      }
    }

    this.emitEvent({
      type: 'step:start',
      runId,
      data: step,
      timestamp: new Date()
    });

    return step;
  }

  /**
   * End a step with result
   */
  async endStep(stepId: string, params: {
    output?: any;
    tokens?: { input: number; output: number };
    error?: string;
  }): Promise<AgentStep | null> {
    // Find the step across all runs
    let step: AgentStep | null = null;
    let run: AgentRun | null = null;

    for (const [_, r] of this.runs) {
      const found = r.steps.find(s => s.id === stepId);
      if (found) {
        step = found;
        run = r;
        break;
      }
    }

    if (!step || !run) return null;

    const startTime = this.stepTimers.get(stepId);
    if (startTime) {
      step.duration = Date.now() - startTime;
      this.stepTimers.delete(stepId);
    }

    step.output = params.output;
    if (params.tokens) {
      step.tokens = params.tokens;
      // Add to run totals
      if (run.totalTokens) {
        run.totalTokens.input += params.tokens.input;
        run.totalTokens.output += params.tokens.output;
      }
    }

    if (params.error) {
      step.metadata = { ...step.metadata, error: params.error };
    }

    // Persist to Supabase
    if (this.persistenceEnabled && this.supabase) {
      try {
        await this.supabase.from('agent_steps').update({
          output: params.output,
          duration_ms: step.duration,
          tokens_input: params.tokens?.input,
          tokens_output: params.tokens?.output,
          metadata: step.metadata
        }).eq('id', stepId);
      } catch (error) {
        console.error('Failed to update step in Supabase:', error);
      }
    }

    this.emitEvent({
      type: 'step:end',
      runId: run.id,
      data: step,
      timestamp: new Date()
    });

    return step;
  }

  /**
   * Quick helper: log a complete step in one call
   */
  async logStep(runId: string, params: {
    type: StepType;
    name: string;
    description?: string;
    input?: any;
    output?: any;
    duration?: number;
    tokens?: { input: number; output: number };
    metadata?: Record<string, any>;
  }): Promise<AgentStep | null> {
    const run = this.runs.get(runId);
    if (!run) return null;

    const step: AgentStep = {
      id: uuidv4(),
      runId,
      type: params.type,
      name: params.name,
      description: params.description,
      input: params.input,
      output: params.output,
      timestamp: new Date(),
      duration: params.duration,
      tokens: params.tokens,
      metadata: params.metadata
    };

    run.steps.push(step);

    if (params.tokens && run.totalTokens) {
      run.totalTokens.input += params.tokens.input;
      run.totalTokens.output += params.tokens.output;
    }

    // Persist to Supabase
    if (this.persistenceEnabled && this.supabase) {
      try {
        await this.supabase.from('agent_steps').insert({
          id: step.id,
          run_id: runId,
          type: step.type,
          name: step.name,
          description: step.description,
          input: step.input,
          output: step.output,
          duration_ms: step.duration,
          tokens_input: params.tokens?.input,
          tokens_output: params.tokens?.output,
          metadata: params.metadata,
          created_at: step.timestamp.toISOString()
        });
      } catch (error) {
        console.error('Failed to persist step to Supabase:', error);
      }
    }

    this.emitEvent({
      type: 'step:end',
      runId,
      data: step,
      timestamp: new Date()
    });

    return step;
  }

  // ============================================
  // Status Updates
  // ============================================

  /**
   * Update run status (e.g., waiting for approval)
   */
  async updateStatus(runId: string, status: RunStatus, metadata?: Record<string, any>): Promise<void> {
    const run = this.runs.get(runId);
    if (!run) return;

    run.status = status;
    if (metadata) {
      run.metadata = { ...run.metadata, ...metadata };
    }

    // Persist to Supabase
    if (this.persistenceEnabled && this.supabase) {
      try {
        await this.supabase.from('agent_runs').update({
          status,
          metadata: run.metadata
        }).eq('id', runId);
      } catch (error) {
        console.error('Failed to update run status in Supabase:', error);
      }
    }

    this.emitEvent({
      type: 'status:change',
      runId,
      data: { status, metadata },
      timestamp: new Date()
    });
  }

  // ============================================
  // Query Methods
  // ============================================

  /**
   * Get a specific run by ID (from memory or database)
   */
  async getRun(runId: string): Promise<AgentRun | null> {
    // Check memory first
    const memoryRun = this.runs.get(runId);
    if (memoryRun) return memoryRun;

    // Fall back to database
    if (this.persistenceEnabled && this.supabase) {
      try {
        const { data, error } = await this.supabase
          .from('agent_runs')
          .select('*, agent_steps(*)')
          .eq('id', runId)
          .single();

        if (error || !data) return null;

        return this.mapDbRunToAgentRun(data);
      } catch (error) {
        console.error('Failed to fetch run from Supabase:', error);
        return null;
      }
    }

    return null;
  }

  /**
   * Get all active runs (from memory)
   */
  getActiveRuns(): AgentRun[] {
    return Array.from(this.activeRuns)
      .map(id => this.runs.get(id))
      .filter((r): r is AgentRun => r !== undefined);
  }

  /**
   * Get runs for a user (from database or memory)
   */
  async getUserRuns(userId: string, limit: number = 50): Promise<AgentRun[]> {
    if (this.persistenceEnabled && this.supabase) {
      try {
        const { data, error } = await this.supabase
          .from('agent_runs')
          .select('*, agent_steps(*)')
          .eq('user_id', userId)
          .order('started_at', { ascending: false })
          .limit(limit);

        if (error || !data) return [];

        return data.map(row => this.mapDbRunToAgentRun(row));
      } catch (error) {
        console.error('Failed to fetch user runs from Supabase:', error);
      }
    }

    // Fall back to memory
    return Array.from(this.runs.values())
      .filter(r => r.userId === userId)
      .sort((a, b) => b.startTime.getTime() - a.startTime.getTime())
      .slice(0, limit);
  }

  /**
   * Get run with full tree (including child runs)
   */
  async getRunTree(runId: string): Promise<AgentRun | null> {
    const run = await this.getRun(runId);
    if (!run) return null;

    // Recursively get child runs
    const getChildren = async (r: AgentRun): Promise<AgentRun> => {
      if (!r.childRuns || r.childRuns.length === 0) return r;

      const children = await Promise.all(
        r.childRuns.map(async (id) => {
          const child = await this.getRun(id);
          return child ? await getChildren(child) : null;
        })
      );

      return { ...r, childRuns: children.filter(Boolean) as any };
    };

    return getChildren(run);
  }

  /**
   * Get trace data for visualization
   */
  async getTraceVisualization(runId: string): Promise<{
    nodes: Array<{
      id: string;
      type: string;
      label: string;
      status: 'pending' | 'running' | 'completed' | 'error';
      data: any;
    }>;
    edges: Array<{
      source: string;
      target: string;
      label?: string;
    }>;
  } | null> {
    const run = await this.getRun(runId);
    if (!run) return null;

    const nodes: any[] = [];
    const edges: any[] = [];

    // Add start node
    nodes.push({
      id: `${runId}-start`,
      type: 'input',
      label: 'User Input',
      status: 'completed',
      data: { input: run.input }
    });

    // Add step nodes
    let prevNodeId = `${runId}-start`;

    for (const step of run.steps) {
      const nodeId = step.id;
      nodes.push({
        id: nodeId,
        type: step.type,
        label: step.name,
        status: step.output ? 'completed' : (step.metadata?.error ? 'error' : 'running'),
        data: {
          input: step.input,
          output: step.output,
          duration: step.duration,
          tokens: step.tokens
        }
      });

      // Connect to previous node (or parent if exists)
      edges.push({
        source: step.parentStepId || prevNodeId,
        target: nodeId,
        label: step.type
      });

      prevNodeId = nodeId;
    }

    // Add output node if completed
    if (run.status === 'completed' && run.output) {
      const outputId = `${runId}-output`;
      nodes.push({
        id: outputId,
        type: 'output',
        label: 'Response',
        status: 'completed',
        data: { output: run.output }
      });
      edges.push({
        source: prevNodeId,
        target: outputId
      });
    }

    return { nodes, edges };
  }

  // ============================================
  // Helper Methods
  // ============================================

  private mapDbRunToAgentRun(data: any): AgentRun {
    return {
      id: data.id,
      agentId: data.agent_id,
      agentName: data.agent_name,
      agentType: data.agent_type,
      userId: data.user_id,
      sessionId: data.session_id,
      customerId: data.customer_id,
      customerContext: data.customer_context,
      startTime: new Date(data.started_at),
      endTime: data.ended_at ? new Date(data.ended_at) : undefined,
      status: data.status,
      steps: (data.agent_steps || []).map((s: any) => ({
        id: s.id,
        runId: s.run_id,
        type: s.type,
        name: s.name,
        description: s.description,
        input: s.input,
        output: s.output,
        timestamp: new Date(s.created_at),
        duration: s.duration_ms,
        parentStepId: s.parent_step_id,
        metadata: s.metadata,
        tokens: s.tokens_input ? { input: s.tokens_input, output: s.tokens_output } : undefined
      })),
      input: data.input,
      output: data.output,
      totalTokens: {
        input: data.total_tokens_input || 0,
        output: data.total_tokens_output || 0
      },
      parentRunId: data.parent_run_id,
      error: data.error,
      metadata: data.metadata,
      langsmithRunId: data.langsmith_run_id
    };
  }

  // ============================================
  // Event Emission
  // ============================================

  private emitEvent(event: TraceEvent): void {
    // Emit for WebSocket broadcasting
    this.emit('trace', event);

    // Emit specific event type
    this.emit(event.type, event);
  }

  // ============================================
  // Cleanup
  // ============================================

  /**
   * Clean up old runs (keep last N or by age) - in-memory only
   */
  cleanup(options: { maxRuns?: number; maxAgeMs?: number } = {}): number {
    const maxRuns = options.maxRuns || 1000;
    const maxAgeMs = options.maxAgeMs || 24 * 60 * 60 * 1000; // 24 hours
    const now = Date.now();
    let removed = 0;

    // Remove by age first
    for (const [id, run] of this.runs) {
      if (!this.activeRuns.has(id)) {
        const age = now - run.startTime.getTime();
        if (age > maxAgeMs) {
          this.runs.delete(id);
          removed++;
        }
      }
    }

    // Remove excess runs (oldest first)
    if (this.runs.size > maxRuns) {
      const sorted = Array.from(this.runs.entries())
        .filter(([id]) => !this.activeRuns.has(id))
        .sort((a, b) => a[1].startTime.getTime() - b[1].startTime.getTime());

      const toRemove = this.runs.size - maxRuns;
      for (let i = 0; i < toRemove && i < sorted.length; i++) {
        this.runs.delete(sorted[i][0]);
        removed++;
      }
    }

    return removed;
  }

  /**
   * Get statistics (from database if available)
   */
  async getStats(): Promise<{
    totalRuns: number;
    activeRuns: number;
    avgDuration: number;
    totalTokens: { input: number; output: number };
    byAgent: Record<string, number>;
    byStatus: Record<string, number>;
  }> {
    if (this.persistenceEnabled && this.supabase) {
      try {
        // Get total count
        const { count: totalRuns } = await this.supabase
          .from('agent_runs')
          .select('*', { count: 'exact', head: true });

        // Get stats by agent
        const { data: agentStats } = await this.supabase
          .from('agent_runs')
          .select('agent_name, status')
          .order('started_at', { ascending: false })
          .limit(1000);

        const byAgent: Record<string, number> = {};
        const byStatus: Record<string, number> = {};

        (agentStats || []).forEach((row: any) => {
          byAgent[row.agent_name] = (byAgent[row.agent_name] || 0) + 1;
          byStatus[row.status] = (byStatus[row.status] || 0) + 1;
        });

        // Get token totals
        const { data: tokenData } = await this.supabase
          .from('agent_runs')
          .select('total_tokens_input, total_tokens_output')
          .not('total_tokens_input', 'is', null);

        const totalTokens = (tokenData || []).reduce(
          (sum: any, r: any) => ({
            input: sum.input + (r.total_tokens_input || 0),
            output: sum.output + (r.total_tokens_output || 0)
          }),
          { input: 0, output: 0 }
        );

        // Get avg duration
        const { data: durationData } = await this.supabase
          .from('agent_runs')
          .select('started_at, ended_at')
          .not('ended_at', 'is', null)
          .limit(100);

        let avgDuration = 0;
        if (durationData && durationData.length > 0) {
          const durations = durationData.map((r: any) =>
            new Date(r.ended_at).getTime() - new Date(r.started_at).getTime()
          );
          avgDuration = durations.reduce((a: number, b: number) => a + b, 0) / durations.length;
        }

        return {
          totalRuns: totalRuns || 0,
          activeRuns: this.activeRuns.size,
          avgDuration,
          totalTokens,
          byAgent,
          byStatus
        };
      } catch (error) {
        console.error('Failed to fetch stats from Supabase:', error);
      }
    }

    // Fall back to memory
    const runs = Array.from(this.runs.values());
    const completedRuns = runs.filter(r => r.endTime);

    const avgDuration = completedRuns.length > 0
      ? completedRuns.reduce((sum, r) => sum + (r.endTime!.getTime() - r.startTime.getTime()), 0) / completedRuns.length
      : 0;

    const totalTokens = runs.reduce(
      (sum, r) => ({
        input: sum.input + (r.totalTokens?.input || 0),
        output: sum.output + (r.totalTokens?.output || 0)
      }),
      { input: 0, output: 0 }
    );

    const byAgent: Record<string, number> = {};
    const byStatus: Record<string, number> = {};

    for (const run of runs) {
      byAgent[run.agentName] = (byAgent[run.agentName] || 0) + 1;
      byStatus[run.status] = (byStatus[run.status] || 0) + 1;
    }

    return {
      totalRuns: runs.length,
      activeRuns: this.activeRuns.size,
      avgDuration,
      totalTokens,
      byAgent,
      byStatus
    };
  }

  /**
   * Check if persistence is enabled
   */
  isPersistenceEnabled(): boolean {
    return this.persistenceEnabled;
  }
}

// Export singleton instance
export const agentTracer = new AgentTracerService();
