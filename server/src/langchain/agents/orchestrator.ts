/**
 * Agent Orchestrator
 * Intelligently routes conversations to appropriate specialist agents
 */

import Anthropic from '@anthropic-ai/sdk';
import { config } from '../../config/index.js';
import { agentTracer } from '../../services/agentTracer.js';
import {
  SpecialistType,
  SpecialistContext,
  SPECIALIST_CONFIGS,
  createSpecialist,
  getAllSpecialists
} from './specialists/index.js';

interface RoutingDecision {
  specialist: SpecialistType;
  confidence: number;
  reasoning: string;
}

interface OrchestratorResult {
  response: string;
  specialistUsed: SpecialistType;
  requiresApproval: boolean;
  pendingActions: any[];
  toolsUsed: string[];
  trace: {
    runId: string;
    steps: number;
    duration?: number;
  };
}

const anthropic = new Anthropic({
  apiKey: config.anthropicApiKey
});

function keywordRoute(message: string): RoutingDecision | null {
  const lowerMessage = message.toLowerCase();
  const specialists = getAllSpecialists();

  for (const spec of specialists) {
    for (const keyword of spec.keywords) {
      if (lowerMessage.includes(keyword.toLowerCase())) {
        return {
          specialist: spec.id,
          confidence: 0.7,
          reasoning: `Matched keyword: "${keyword}"`
        };
      }
    }
  }

  return null;
}

function contextRoute(context: SpecialistContext): RoutingDecision | null {
  const customer = context.customerContext;
  if (!customer) return null;

  if (customer.healthScore !== undefined) {
    for (const spec of getAllSpecialists()) {
      if (spec.healthScoreRange) {
        const [min, max] = spec.healthScoreRange;
        if (customer.healthScore >= min && customer.healthScore <= max) {
          return {
            specialist: spec.id,
            confidence: 0.8,
            reasoning: `Health score ${customer.healthScore} falls in range for ${spec.name}`
          };
        }
      }
    }
  }

  if (customer.daysToRenewal !== undefined) {
    for (const spec of getAllSpecialists()) {
      if (spec.daysToRenewal) {
        const [min, max] = spec.daysToRenewal;
        if (customer.daysToRenewal >= min && customer.daysToRenewal <= max) {
          return {
            specialist: spec.id,
            confidence: 0.8,
            reasoning: `Renewal in ${customer.daysToRenewal} days triggers ${spec.name}`
          };
        }
      }
    }
  }

  return null;
}

async function llmRoute(message: string, context: SpecialistContext): Promise<RoutingDecision> {
  const specialists = getAllSpecialists();
  const specialistDescriptions = specialists
    .map(s => `- ${s.id}: ${s.name} - ${s.description}`)
    .join('\n');

  const prompt = `You are a routing agent. Choose the best specialist.

Available specialists:
${specialistDescriptions}

Customer: ${context.customerContext ? JSON.stringify(context.customerContext) : 'None'}
Message: "${message}"

Respond with JSON: {"specialist": "<id>", "confidence": <0-1>, "reasoning": "<why>"}`;

  try {
    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 256,
      messages: [{ role: 'user', content: prompt }]
    });

    const text = response.content
      .filter((b): b is Anthropic.TextBlock => b.type === 'text')
      .map(b => b.text)
      .join('');

    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      return JSON.parse(jsonMatch[0]) as RoutingDecision;
    }
  } catch (error) {
    console.error('LLM routing error:', error);
  }

  return { specialist: 'strategic', confidence: 0.5, reasoning: 'Default fallback' };
}

export class AgentOrchestrator {
  private specialists = new Map();
  private conversationHistory: Array<{ role: string; content: string }> = [];
  private currentSpecialist: SpecialistType | null = null;

  constructor() {
    for (const type of Object.keys(SPECIALIST_CONFIGS) as SpecialistType[]) {
      this.specialists.set(type, createSpecialist(type));
    }
  }

  async chat(message: string, context: SpecialistContext): Promise<OrchestratorResult> {
    const run = await agentTracer.startRun({
      agentId: 'orchestrator',
      agentName: 'Agent Orchestrator',
      agentType: 'orchestrator',
      userId: context.userId,
      sessionId: context.sessionId,
      customerContext: context.customerContext,
      input: message
    });

    const startTime = Date.now();
    let stepCount = 0;

    try {
      await agentTracer.logStep(run.id, {
        type: 'thinking',
        name: 'Routing',
        description: 'Determining best specialist for request'
      });
      stepCount++;

      const routingDecision = await this.route(message, context);

      await agentTracer.logStep(run.id, {
        type: 'decision',
        name: `Route to ${routingDecision.specialist}`,
        description: routingDecision.reasoning,
        output: routingDecision
      });
      stepCount++;

      let specialist = this.specialists.get(routingDecision.specialist);
      if (!specialist) {
        specialist = createSpecialist(routingDecision.specialist);
        this.specialists.set(routingDecision.specialist, specialist);
      }

      const contextWithHistory: SpecialistContext = {
        ...context,
        conversationHistory: this.conversationHistory
      };

      const result = await specialist.execute(message, contextWithHistory, run.id);

      if (result.nextAgent && result.nextAgent !== routingDecision.specialist) {
        const nextSpecialist = this.specialists.get(result.nextAgent) || createSpecialist(result.nextAgent);
        const handoffResult = await nextSpecialist.execute(message, contextWithHistory, run.id);
        result.response = handoffResult.response;
        result.requiresApproval = result.requiresApproval || handoffResult.requiresApproval;
        result.pendingActions = [...result.pendingActions, ...handoffResult.pendingActions];
        result.toolsUsed = [...result.toolsUsed, ...handoffResult.toolsUsed];
      }

      this.conversationHistory.push(
        { role: 'user', content: message },
        { role: 'assistant', content: result.response }
      );

      if (this.conversationHistory.length > 20) {
        this.conversationHistory = this.conversationHistory.slice(-20);
      }

      this.currentSpecialist = result.nextAgent || routingDecision.specialist;

      await agentTracer.endRun(run.id, {
        status: result.requiresApproval ? 'waiting_approval' : 'completed',
        output: result.response
      });

      return {
        response: result.response,
        specialistUsed: this.currentSpecialist,
        requiresApproval: result.requiresApproval,
        pendingActions: result.pendingActions,
        toolsUsed: result.toolsUsed,
        trace: { runId: run.id, steps: stepCount, duration: Date.now() - startTime }
      };

    } catch (error) {
      await agentTracer.endRun(run.id, { status: 'failed', error: (error as Error).message });
      return {
        response: `Error: ${(error as Error).message}`,
        specialistUsed: this.currentSpecialist || 'strategic',
        requiresApproval: false,
        pendingActions: [],
        toolsUsed: [],
        trace: { runId: run.id, steps: stepCount, duration: Date.now() - startTime }
      };
    }
  }

  private async route(message: string, context: SpecialistContext): Promise<RoutingDecision> {
    if (this.currentSpecialist && this.conversationHistory.length > 0) {
      if (this.isFollowUpMessage(message)) {
        return { specialist: this.currentSpecialist, confidence: 0.9, reasoning: 'Continuing conversation' };
      }
    }

    const keywordDecision = keywordRoute(message);
    if (keywordDecision && keywordDecision.confidence >= 0.7) return keywordDecision;

    const contextDecision = contextRoute(context);
    if (contextDecision && contextDecision.confidence >= 0.7) return contextDecision;

    return await llmRoute(message, context);
  }

  private isFollowUpMessage(message: string): boolean {
    const indicators = ['yes', 'no', 'sure', 'ok', 'thanks', 'that', 'this', 'sounds good', 'perfect'];
    const lower = message.toLowerCase().trim();
    if (lower.split(' ').length <= 5) {
      return indicators.some(ind => lower.includes(ind));
    }
    return false;
  }

  reset(): void {
    this.conversationHistory = [];
    this.currentSpecialist = null;
  }

  // Backward compatibility alias
  clearSession(): void {
    this.reset();
  }

  getState() {
    return {
      currentSpecialist: this.currentSpecialist,
      historyLength: this.conversationHistory.length,
      availableSpecialists: getAllSpecialists().map(s => ({ id: s.id, name: s.name, description: s.description }))
    };
  }

  // Backward compatibility alias
  getSessionState() {
    const state = this.getState();
    return {
      ...state,
      currentAgent: state.currentSpecialist || 'onboarding',
      availableAgents: state.availableSpecialists.map(s => s.id)
    };
  }

  // Placeholder for comprehensive analysis (was in old orchestrator)
  async getComprehensiveAnalysis(customerContext: Record<string, any>): Promise<any> {
    // Route to analytics specialist for comprehensive analysis
    const context: SpecialistContext = {
      userId: 'system',
      customerContext
    };
    const result = await this.chatWithSpecialist(
      `Provide a comprehensive analysis of this customer including health score assessment, risk factors, and recommended actions.`,
      'analytics',
      context
    );
    return {
      analysis: result.response,
      specialist: result.specialistUsed,
      trace: result.trace
    };
  }

  // Placeholder for workflow execution (was in old orchestrator)
  async executeWorkflow(
    workflowType: 'onboarding' | 'renewal_prep' | 'risk_mitigation' | 'qbr_prep',
    customerContext: Record<string, any>
  ): Promise<any> {
    const workflowToSpecialist: Record<string, SpecialistType> = {
      onboarding: 'onboarding',
      renewal_prep: 'renewal',
      risk_mitigation: 'risk',
      qbr_prep: 'strategic'
    };

    const specialist = workflowToSpecialist[workflowType] || 'strategic';
    const context: SpecialistContext = {
      userId: 'system',
      customerContext
    };

    const result = await this.chatWithSpecialist(
      `Execute the ${workflowType} workflow for this customer. Provide step-by-step guidance and actions.`,
      specialist,
      context
    );

    return {
      workflowType,
      response: result.response,
      specialist: result.specialistUsed,
      requiresApproval: result.requiresApproval,
      pendingActions: result.pendingActions,
      trace: result.trace
    };
  }

  async chatWithSpecialist(message: string, specialistType: SpecialistType, context: SpecialistContext): Promise<OrchestratorResult> {
    const specialist = this.specialists.get(specialistType) || createSpecialist(specialistType);
    const run = await agentTracer.startRun({
      agentId: 'orchestrator',
      agentName: 'Agent Orchestrator',
      agentType: 'orchestrator',
      userId: context.userId,
      input: message,
      metadata: { forcedSpecialist: specialistType }
    });

    const startTime = Date.now();
    let stepCount = 0;

    try {
      const result = await specialist.execute(message, { ...context, conversationHistory: this.conversationHistory }, run.id);
      this.conversationHistory.push({ role: 'user', content: message }, { role: 'assistant', content: result.response });
      this.currentSpecialist = specialistType;
      await agentTracer.endRun(run.id, { status: result.requiresApproval ? 'waiting_approval' : 'completed', output: result.response });

      return {
        response: result.response,
        specialistUsed: specialistType,
        requiresApproval: result.requiresApproval,
        pendingActions: result.pendingActions,
        toolsUsed: result.toolsUsed,
        trace: { runId: run.id, steps: stepCount, duration: Date.now() - startTime }
      };
    } catch (error) {
      await agentTracer.endRun(run.id, { status: 'failed', error: (error as Error).message });
      throw error;
    }
  }
}

export const agentOrchestrator = new AgentOrchestrator();
