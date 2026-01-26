/**
 * Agentic Loop Engine
 * Enables autonomous multi-step execution with tool result feedback
 *
 * This is the core component that makes agents truly autonomous.
 * It implements the loop: Claude → Tool → Result → Claude → Next Tool → ...
 */

import Anthropic from '@anthropic-ai/sdk';
import { config } from '../../config/index.js';
import {
  AgentContext,
  Tool,
  ToolResult,
  TaskLedger,
  TaskStep,
  Approval,
  ApprovalType
} from '../types.js';
import { shouldRequireApproval, getApprovalPolicy } from '../index.js';

// Initialize Anthropic client
const anthropic = new Anthropic({
  apiKey: config.anthropicApiKey,
});

// Agentic mode configuration
export interface AgenticModeConfig {
  enabled: boolean;
  maxSteps: number;              // Maximum steps before requiring human check-in
  autoApproveLevel: 'none' | 'low_risk' | 'all';  // What to auto-approve
  pauseOnHighRisk: boolean;      // Always pause for high-risk actions
  notifyOnCompletion: boolean;   // Notify when goal achieved
}

// Default agentic mode (conservative)
export const DEFAULT_AGENTIC_CONFIG: AgenticModeConfig = {
  enabled: false,
  maxSteps: 10,
  autoApproveLevel: 'none',
  pauseOnHighRisk: true,
  notifyOnCompletion: true,
};

// Agentic loop state
export interface AgenticLoopState {
  goalDescription: string;
  currentStep: number;
  maxSteps: number;
  steps: ExecutedStep[];
  status: 'running' | 'completed' | 'paused_for_approval' | 'failed' | 'max_steps_reached';
  pendingApproval?: PendingApprovalInfo;
  finalResult?: any;
  error?: string;
}

interface ExecutedStep {
  stepNumber: number;
  toolName: string;
  toolInput: any;
  toolResult: ToolResult;
  reasoning: string;
  timestamp: Date;
}

interface PendingApprovalInfo {
  approvalId: string;
  toolName: string;
  toolInput: any;
  reason: string;
  riskLevel: 'low' | 'medium' | 'high' | 'critical';
}

// Convert our Tool type to Anthropic's tool format
function toolToAnthropicFormat(tool: Tool): Anthropic.Tool {
  return {
    name: tool.name,
    description: tool.description,
    input_schema: tool.inputSchema as Anthropic.Tool.InputSchema,
  };
}

// Determine risk level of an action
function determineRiskLevel(toolName: string, tool?: Tool): 'low' | 'medium' | 'high' | 'critical' {
  // If tool has explicit riskLevel, use it
  if (tool?.riskLevel) {
    return tool.riskLevel as 'low' | 'medium' | 'high' | 'critical';
  }

  const highRiskTools = ['send_email', 'book_meeting', 'share_externally', 'escalation'];
  const mediumRiskTools = ['draft_email', 'propose_meeting', 'create_document', 'create_sequence'];
  // request_human_approval is ALWAYS critical - it's an explicit request for human decision
  const criticalTools = ['delete', 'remove', 'cancel', 'request_human_approval'];

  if (criticalTools.some(t => toolName.includes(t))) return 'critical';
  if (highRiskTools.includes(toolName)) return 'high';
  if (mediumRiskTools.includes(toolName)) return 'medium';
  return 'low';
}

// Check if action should be auto-approved based on agentic config
function shouldAutoApprove(
  toolName: string,
  agenticConfig: AgenticModeConfig,
  context: AgentContext,
  tool?: Tool
): boolean {
  if (!agenticConfig.enabled) return false;

  const riskLevel = determineRiskLevel(toolName, tool);

  // Never auto-approve critical actions
  if (riskLevel === 'critical') return false;

  // Check agentic config
  // At this point riskLevel is 'low' | 'medium' | 'high' (critical was handled above)
  switch (agenticConfig.autoApproveLevel) {
    case 'all':
      return !(agenticConfig.pauseOnHighRisk && riskLevel === 'high');
    case 'low_risk':
      return riskLevel === 'low';
    case 'none':
    default:
      return false;
  }
}

/**
 * The Agentic Loop Engine
 *
 * Executes a goal autonomously by:
 * 1. Sending goal to Claude with available tools
 * 2. Executing tool calls
 * 3. Feeding results back to Claude
 * 4. Repeating until goal complete or approval needed
 */
export async function executeAgenticLoop(
  goal: string,
  tools: Tool[],
  context: AgentContext,
  agenticConfig: AgenticModeConfig = DEFAULT_AGENTIC_CONFIG,
  systemPrompt?: string,
  conversationHistory: Anthropic.MessageParam[] = []
): Promise<AgenticLoopState> {

  const state: AgenticLoopState = {
    goalDescription: goal,
    currentStep: 0,
    maxSteps: agenticConfig.maxSteps,
    steps: [],
    status: 'running',
  };

  // Build context string for Claude
  const contextString = buildContextString(context);

  // Build system prompt
  const fullSystemPrompt = `${systemPrompt || 'You are an autonomous Customer Success agent.'}

CURRENT CONTEXT:
${contextString}

AGENTIC MODE: ${agenticConfig.enabled ? 'ENABLED' : 'DISABLED'}
${agenticConfig.enabled ? `
You are operating autonomously. Complete the goal step by step.
- Execute tools to accomplish the goal
- After each tool result, evaluate progress and decide next action
- Continue until the goal is fully achieved
- If you need human approval for a high-risk action, stop and request it
` : `
You are in assisted mode. Suggest actions but wait for human approval.
`}

When you have completed the goal, respond with a final summary (no tool calls).
`;

  // Convert tools to Anthropic format
  const anthropicTools = tools.map(toolToAnthropicFormat);

  // Build initial messages
  const messages: Anthropic.MessageParam[] = [
    ...conversationHistory,
    { role: 'user', content: `Goal: ${goal}\n\nPlease accomplish this goal step by step.` }
  ];

  console.log(`[AgenticLoop] Starting loop for goal: "${goal.substring(0, 50)}..."`);

  // The agentic loop
  while (state.status === 'running' && state.currentStep < state.maxSteps) {
    state.currentStep++;
    console.log(`[AgenticLoop] Step ${state.currentStep}/${state.maxSteps}`);

    try {
      // Call Claude
      const response = await anthropic.messages.create({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 4096,
        system: fullSystemPrompt,
        tools: anthropicTools,
        messages: messages,
      });

      // Check stop reason
      if (response.stop_reason === 'end_turn') {
        // Claude finished without tool use - goal complete or needs clarification
        const textContent = response.content.find(c => c.type === 'text');
        state.status = 'completed';
        state.finalResult = textContent ? (textContent as Anthropic.TextBlock).text : 'Goal completed';
        console.log(`[AgenticLoop] Completed: ${state.finalResult?.substring(0, 100)}...`);
        break;
      }

      if (response.stop_reason === 'tool_use') {
        // Process tool calls
        const toolUseBlocks = response.content.filter(c => c.type === 'tool_use') as Anthropic.ToolUseBlock[];

        // Get reasoning (text before tool use)
        const textBlock = response.content.find(c => c.type === 'text') as Anthropic.TextBlock | undefined;
        const reasoning = textBlock?.text || '';

        // Add assistant message with tool use
        messages.push({ role: 'assistant', content: response.content });

        // Execute each tool
        const toolResults: Anthropic.ToolResultBlockParam[] = [];

        for (const toolUse of toolUseBlocks) {
          const tool = tools.find(t => t.name === toolUse.name);

          if (!tool) {
            toolResults.push({
              type: 'tool_result',
              tool_use_id: toolUse.id,
              content: JSON.stringify({ success: false, error: `Unknown tool: ${toolUse.name}` }),
              is_error: true,
            });
            continue;
          }

          // Check if approval is required
          const riskLevel = determineRiskLevel(toolUse.name, tool);
          const needsApproval = tool.requiresApproval && !shouldAutoApprove(toolUse.name, agenticConfig, context, tool);

          if (needsApproval) {
            // Pause for approval
            state.status = 'paused_for_approval';
            state.pendingApproval = {
              approvalId: `approval_${Date.now()}`,
              toolName: toolUse.name,
              toolInput: toolUse.input,
              reason: reasoning,
              riskLevel,
            };
            console.log(`[AgenticLoop] Paused for approval: ${toolUse.name}`);

            // Store the current state for resumption
            (state as any)._resumeMessages = messages;
            (state as any)._resumeToolUse = toolUse;
            return state;
          }

          // Execute the tool
          console.log(`[AgenticLoop] Executing tool: ${toolUse.name}`);
          const result = await tool.execute(toolUse.input, context);

          // Record the step
          state.steps.push({
            stepNumber: state.currentStep,
            toolName: toolUse.name,
            toolInput: toolUse.input,
            toolResult: result,
            reasoning,
            timestamp: new Date(),
          });

          // Add tool result
          toolResults.push({
            type: 'tool_result',
            tool_use_id: toolUse.id,
            content: JSON.stringify(result),
            is_error: !result.success,
          });
        }

        // Add tool results to messages
        messages.push({ role: 'user', content: toolResults });
      }
    } catch (error) {
      console.error(`[AgenticLoop] Error at step ${state.currentStep}:`, error);
      state.status = 'failed';
      state.error = (error as Error).message;
      break;
    }
  }

  // Check if we hit max steps
  if (state.currentStep >= state.maxSteps && state.status === 'running') {
    state.status = 'max_steps_reached';
    console.log(`[AgenticLoop] Max steps reached (${state.maxSteps})`);
  }

  return state;
}

/**
 * Resume an agentic loop after approval
 */
export async function resumeAgenticLoop(
  previousState: AgenticLoopState,
  approved: boolean,
  tools: Tool[],
  context: AgentContext,
  agenticConfig: AgenticModeConfig = DEFAULT_AGENTIC_CONFIG,
  systemPrompt?: string
): Promise<AgenticLoopState> {

  if (!previousState.pendingApproval) {
    return { ...previousState, status: 'failed', error: 'No pending approval to resume' };
  }

  const messages = (previousState as any)._resumeMessages as Anthropic.MessageParam[];
  const toolUse = (previousState as any)._resumeToolUse as Anthropic.ToolUseBlock;

  if (!approved) {
    // Add rejection result
    messages.push({
      role: 'user',
      content: [{
        type: 'tool_result',
        tool_use_id: toolUse.id,
        content: JSON.stringify({ success: false, error: 'Action rejected by user' }),
        is_error: true,
      }],
    });
  } else {
    // Execute the approved tool
    const tool = tools.find(t => t.name === toolUse.name);
    if (tool) {
      const result = await tool.execute(toolUse.input, context);

      previousState.steps.push({
        stepNumber: previousState.currentStep,
        toolName: toolUse.name,
        toolInput: toolUse.input,
        toolResult: result,
        reasoning: previousState.pendingApproval.reason,
        timestamp: new Date(),
      });

      messages.push({
        role: 'user',
        content: [{
          type: 'tool_result',
          tool_use_id: toolUse.id,
          content: JSON.stringify(result),
          is_error: !result.success,
        }],
      });
    }
  }

  // Clear pending approval and continue
  const newState: AgenticLoopState = {
    ...previousState,
    pendingApproval: undefined,
    status: 'running',
  };

  // Continue the loop
  return executeAgenticLoop(
    previousState.goalDescription,
    tools,
    context,
    agenticConfig,
    systemPrompt,
    messages
  );
}

/**
 * Generate a multi-step plan for a goal
 */
export async function generatePlan(
  goal: string,
  tools: Tool[],
  context: AgentContext,
  systemPrompt?: string
): Promise<TaskLedger> {

  const contextString = buildContextString(context);

  const planningPrompt = `${systemPrompt || 'You are a planning agent.'}

CONTEXT:
${contextString}

AVAILABLE TOOLS:
${tools.map(t => `- ${t.name}: ${t.description}`).join('\n')}

Generate a step-by-step plan to accomplish this goal. Output as JSON with this structure:
{
  "plan": [
    { "step": 1, "description": "...", "tool": "tool_name", "depends_on": [] },
    { "step": 2, "description": "...", "tool": "tool_name", "depends_on": [1] }
  ]
}

Only use the tools listed above. Be specific about what each step accomplishes.
`;

  const response = await anthropic.messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 2048,
    messages: [
      { role: 'user', content: `Goal: ${goal}\n\nGenerate a plan.` }
    ],
    system: planningPrompt,
  });

  const textContent = response.content.find(c => c.type === 'text') as Anthropic.TextBlock;

  // Parse JSON from response
  const jsonMatch = textContent.text.match(/\{[\s\S]*\}/);
  let planData = { plan: [] as any[] };

  if (jsonMatch) {
    try {
      planData = JSON.parse(jsonMatch[0]);
    } catch (e) {
      console.error('[AgenticLoop] Failed to parse plan:', e);
    }
  }

  // Convert to TaskLedger format
  const ledger: TaskLedger = {
    id: `ledger_${Date.now()}`,
    originalRequest: goal,
    plan: planData.plan.map((step: any, idx: number) => ({
      id: `step_${idx + 1}`,
      description: step.description,
      agentId: 'autonomous',
      toolName: step.tool,
      status: 'pending' as const,
      dependsOn: step.depends_on?.map((d: number) => `step_${d}`) || [],
    })),
    currentStep: 0,
    completedSteps: [],
    blockedSteps: [],
    status: 'planning',
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  return ledger;
}

// Helper: Build context string for Claude
function buildContextString(context: AgentContext): string {
  const parts: string[] = [];

  if (context.customer) {
    parts.push(`Customer: ${context.customer.name}`);
    parts.push(`  ARR: $${context.customer.arr?.toLocaleString() || 'N/A'}`);
    parts.push(`  Health Score: ${context.customer.healthScore || 'N/A'}`);
    parts.push(`  Status: ${context.customer.status}`);
    if (context.customer.renewalDate) {
      parts.push(`  Renewal Date: ${context.customer.renewalDate}`);
    }
    if (context.customer.primaryContact) {
      parts.push(`  Primary Contact: ${context.customer.primaryContact.name} (${context.customer.primaryContact.email})`);
    }
  }

  if (context.currentPhase) {
    parts.push(`Current Phase: ${context.currentPhase}`);
  }

  if (context.riskSignals?.length > 0) {
    parts.push(`Risk Signals: ${context.riskSignals.length} active`);
  }

  if (context.pendingApprovals?.length > 0) {
    parts.push(`Pending Approvals: ${context.pendingApprovals.length}`);
  }

  return parts.join('\n');
}

export default {
  executeAgenticLoop,
  resumeAgenticLoop,
  generatePlan,
  DEFAULT_AGENTIC_CONFIG,
};
