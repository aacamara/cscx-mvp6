/**
 * CSM Specialist Agents
 * Each specialist handles a specific domain of Customer Success
 */

import Anthropic from '@anthropic-ai/sdk';
import { config } from '../../../config/index.js';
import { agentTracer, StepType } from '../../../services/agentTracer.js';
import { approvalService } from '../../../services/approval.js';
import { calendarService } from '../../../services/google/calendar.js';
import { gmailService } from '../../../services/google/gmail.js';

// ============================================
// Types
// ============================================

export type SpecialistType =
  | 'onboarding'    // New customer setup, kickoffs, 30-60-90 plans
  | 'adoption'      // Product usage, feature enablement, training
  | 'renewal'       // Renewals, expansion, commercial negotiations
  | 'risk'          // At-risk accounts, save plays, escalations
  | 'strategic'     // Executive relationships, QBRs, planning
  | 'email'         // Communications
  | 'meeting'       // Scheduling, prep, follow-ups
  | 'knowledge'     // Playbook search, best practices
  | 'research'      // Company research, news
  | 'analytics';    // Health scoring, metrics

export interface SpecialistConfig {
  id: SpecialistType;
  name: string;
  description: string;
  systemPrompt: string;
  tools: Anthropic.Tool[];
  approvalRequired: string[];
  keywords: string[];  // For routing
  healthScoreRange?: [number, number];  // For routing by health
  daysToRenewal?: [number, number];  // For routing by renewal proximity
}

export interface SpecialistContext {
  userId: string;
  sessionId?: string;
  customerContext?: {
    id?: string;
    name?: string;
    arr?: number;
    healthScore?: number;
    status?: string;
    daysToRenewal?: number;
    primaryContact?: { name: string; email: string; };
    industry?: string;
    products?: string[];
  };
  contractContext?: {
    entitlements?: any[];
    stakeholders?: any[];
    technicalRequirements?: any[];
    tasks?: any[];
  };
  conversationHistory?: Array<{ role: string; content: string }>;
}

export interface SpecialistResult {
  response: string;
  requiresApproval: boolean;
  pendingActions: any[];
  toolsUsed: string[];
  nextAgent?: SpecialistType;  // For handoff
  metadata?: Record<string, any>;
}

// ============================================
// Claude Client
// ============================================

const anthropic = new Anthropic({
  apiKey: config.anthropicApiKey
});

// ============================================
// Tool Definitions
// ============================================

const COMMON_TOOLS: Anthropic.Tool[] = [
  {
    name: 'get_todays_meetings',
    description: 'Get all calendar events/meetings for today.',
    input_schema: { type: 'object' as const, properties: {}, required: [] }
  },
  {
    name: 'get_upcoming_meetings',
    description: 'Get upcoming calendar events for the next N days.',
    input_schema: {
      type: 'object' as const,
      properties: {
        days: { type: 'number', description: 'Number of days to look ahead (default 7)' }
      },
      required: []
    }
  },
  {
    name: 'get_recent_emails',
    description: 'Get recent email threads from Gmail.',
    input_schema: {
      type: 'object' as const,
      properties: {
        maxResults: { type: 'number', description: 'Maximum threads to return (default 10)' }
      },
      required: []
    }
  },
  {
    name: 'schedule_meeting',
    description: 'Schedule a new calendar meeting. REQUIRES USER APPROVAL.',
    input_schema: {
      type: 'object' as const,
      properties: {
        title: { type: 'string', description: 'Meeting title' },
        description: { type: 'string', description: 'Meeting description or agenda' },
        attendees: { type: 'array', items: { type: 'string' }, description: 'Attendee emails' },
        startTime: { type: 'string', description: 'Start time (e.g., "tomorrow at 2pm")' },
        durationMinutes: { type: 'number', description: 'Duration in minutes (default 30)' }
      },
      required: ['title', 'startTime']
    }
  },
  {
    name: 'draft_email',
    description: 'Draft an email. REQUIRES USER APPROVAL before sending.',
    input_schema: {
      type: 'object' as const,
      properties: {
        to: { type: 'array', items: { type: 'string' }, description: 'Recipient emails' },
        subject: { type: 'string', description: 'Email subject' },
        body: { type: 'string', description: 'Email body content' }
      },
      required: ['to', 'subject', 'body']
    }
  },
  {
    name: 'create_task',
    description: 'Create a follow-up task. REQUIRES USER APPROVAL.',
    input_schema: {
      type: 'object' as const,
      properties: {
        title: { type: 'string', description: 'Task title' },
        notes: { type: 'string', description: 'Task notes' },
        dueDate: { type: 'string', description: 'Due date (e.g., "next week")' },
        priority: { type: 'string', enum: ['low', 'medium', 'high'] }
      },
      required: ['title']
    }
  },
  {
    name: 'handoff_to_specialist',
    description: 'Hand off the conversation to a different specialist agent.',
    input_schema: {
      type: 'object' as const,
      properties: {
        specialist: {
          type: 'string',
          enum: ['onboarding', 'adoption', 'renewal', 'risk', 'strategic', 'email', 'meeting', 'knowledge', 'research', 'analytics'],
          description: 'Which specialist to hand off to'
        },
        reason: { type: 'string', description: 'Why this handoff is needed' },
        context: { type: 'string', description: 'Additional context for the specialist' }
      },
      required: ['specialist', 'reason']
    }
  }
];

// Specialist-specific tools
const ONBOARDING_TOOLS: Anthropic.Tool[] = [
  {
    name: 'create_success_plan',
    description: 'Create a 30-60-90 day success plan for the customer.',
    input_schema: {
      type: 'object' as const,
      properties: {
        goals: { type: 'array', items: { type: 'string' }, description: '30-day, 60-day, and 90-day goals' },
        milestones: { type: 'array', items: { type: 'string' }, description: 'Key milestones' },
        metrics: { type: 'array', items: { type: 'string' }, description: 'Success metrics to track' }
      },
      required: ['goals']
    }
  },
  {
    name: 'schedule_kickoff',
    description: 'Schedule the kickoff meeting with all stakeholders.',
    input_schema: {
      type: 'object' as const,
      properties: {
        stakeholders: { type: 'array', items: { type: 'string' }, description: 'Stakeholder emails' },
        proposedTimes: { type: 'array', items: { type: 'string' }, description: 'Proposed meeting times' }
      },
      required: ['stakeholders']
    }
  }
];

const RENEWAL_TOOLS: Anthropic.Tool[] = [
  {
    name: 'calculate_renewal_value',
    description: 'Calculate the renewal and expansion opportunity value.',
    input_schema: {
      type: 'object' as const,
      properties: {
        currentArr: { type: 'number' },
        expansionOpportunity: { type: 'number' },
        riskFactors: { type: 'array', items: { type: 'string' } }
      },
      required: ['currentArr']
    }
  },
  {
    name: 'generate_renewal_proposal',
    description: 'Generate a renewal proposal document.',
    input_schema: {
      type: 'object' as const,
      properties: {
        includeExpansion: { type: 'boolean' },
        discountRequested: { type: 'number' }
      },
      required: []
    }
  }
];

const RISK_TOOLS: Anthropic.Tool[] = [
  {
    name: 'analyze_risk_factors',
    description: 'Analyze and score risk factors for the account.',
    input_schema: {
      type: 'object' as const,
      properties: {
        includeUsageData: { type: 'boolean' },
        includeSentiment: { type: 'boolean' }
      },
      required: []
    }
  },
  {
    name: 'create_save_play',
    description: 'Create a save play strategy for at-risk account.',
    input_schema: {
      type: 'object' as const,
      properties: {
        riskLevel: { type: 'string', enum: ['low', 'medium', 'high', 'critical'] },
        primaryConcerns: { type: 'array', items: { type: 'string' } }
      },
      required: ['riskLevel']
    }
  },
  {
    name: 'escalate_to_leadership',
    description: 'Escalate the account to leadership with summary.',
    input_schema: {
      type: 'object' as const,
      properties: {
        urgency: { type: 'string', enum: ['normal', 'urgent', 'critical'] },
        summary: { type: 'string' },
        requestedAction: { type: 'string' }
      },
      required: ['urgency', 'summary']
    }
  }
];

const ANALYTICS_TOOLS: Anthropic.Tool[] = [
  {
    name: 'calculate_health_score',
    description: 'Calculate comprehensive health score with breakdown.',
    input_schema: {
      type: 'object' as const,
      properties: {
        includeComponents: { type: 'boolean', description: 'Include component breakdown' }
      },
      required: []
    }
  },
  {
    name: 'generate_usage_report',
    description: 'Generate product usage analytics report.',
    input_schema: {
      type: 'object' as const,
      properties: {
        period: { type: 'string', enum: ['week', 'month', 'quarter'] },
        metrics: { type: 'array', items: { type: 'string' } }
      },
      required: ['period']
    }
  }
];

// ============================================
// Specialist Configurations
// ============================================

export const SPECIALIST_CONFIGS: Record<SpecialistType, SpecialistConfig> = {
  onboarding: {
    id: 'onboarding',
    name: 'Onboarding Specialist',
    description: 'New customer setup, kickoff meetings, 30-60-90 day plans',
    systemPrompt: `You are an Onboarding Specialist for Customer Success. Your expertise includes:
- Setting up new customers for success
- Planning and running kickoff meetings
- Creating 30-60-90 day success plans
- Coordinating initial training and enablement
- Establishing success metrics and milestones

When helping with onboarding:
- Be proactive about scheduling kickoff meetings
- Ask about key stakeholders and their goals
- Suggest realistic timelines and milestones
- Identify potential blockers early`,
    tools: [...COMMON_TOOLS, ...ONBOARDING_TOOLS],
    approvalRequired: ['schedule_meeting', 'draft_email', 'create_task'],
    keywords: ['onboard', 'kickoff', 'new customer', 'setup', '30-60-90', 'success plan', 'getting started', 'implementation']
  },

  adoption: {
    id: 'adoption',
    name: 'Adoption Specialist',
    description: 'Product usage tracking, feature enablement, training coordination',
    systemPrompt: `You are an Adoption Specialist for Customer Success. Your expertise includes:
- Tracking and improving product adoption
- Feature enablement and training
- Identifying underutilized features
- Creating adoption playbooks
- Measuring time-to-value

When helping with adoption:
- Review current usage patterns
- Suggest features that align with their goals
- Recommend training resources
- Set adoption targets and track progress`,
    tools: [...COMMON_TOOLS],
    approvalRequired: ['schedule_meeting', 'draft_email', 'create_task'],
    keywords: ['adoption', 'usage', 'feature', 'training', 'enable', 'utilize', 'learn', 'how to use']
  },

  renewal: {
    id: 'renewal',
    name: 'Renewal Specialist',
    description: 'Renewal management, expansion opportunities, commercial negotiations',
    systemPrompt: `You are a Renewal Specialist for Customer Success. Your expertise includes:
- Managing upcoming renewals
- Identifying expansion opportunities
- Commercial negotiations and proposals
- Contract review and optimization
- Pricing discussions

When helping with renewals:
- Review account health and history
- Calculate renewal and expansion value
- Prepare negotiation strategies
- Draft renewal proposals`,
    tools: [...COMMON_TOOLS, ...RENEWAL_TOOLS],
    approvalRequired: ['schedule_meeting', 'draft_email', 'create_task', 'generate_renewal_proposal'],
    keywords: ['renewal', 'renew', 'expand', 'upsell', 'contract', 'pricing', 'negotiate', 'proposal'],
    daysToRenewal: [0, 90]  // Route here when renewal is within 90 days
  },

  risk: {
    id: 'risk',
    name: 'Risk Specialist',
    description: 'At-risk account detection, save plays, escalation management',
    systemPrompt: `You are a Risk Specialist for Customer Success. Your expertise includes:
- Identifying at-risk accounts
- Creating and executing save plays
- Managing escalations
- Root cause analysis
- Executive intervention coordination

When helping with at-risk accounts:
- Assess risk level and urgency
- Identify root causes
- Create actionable save plays
- Coordinate escalation if needed
- Track intervention effectiveness`,
    tools: [...COMMON_TOOLS, ...RISK_TOOLS],
    approvalRequired: ['schedule_meeting', 'draft_email', 'create_task', 'escalate_to_leadership'],
    keywords: ['risk', 'at-risk', 'churn', 'cancel', 'unhappy', 'escalate', 'save', 'retain', 'problem', 'issue'],
    healthScoreRange: [0, 50]  // Route here when health score is low
  },

  strategic: {
    id: 'strategic',
    name: 'Strategic CSM',
    description: 'Executive relationships, QBRs, strategic account planning',
    systemPrompt: `You are a Strategic CSM for high-value accounts. Your expertise includes:
- Executive relationship management
- Quarterly Business Reviews (QBRs)
- Strategic account planning
- C-level communications
- Long-term partnership development

When helping with strategic accounts:
- Focus on business outcomes, not features
- Prepare executive-level content
- Plan strategic initiatives
- Build multi-threaded relationships`,
    tools: [...COMMON_TOOLS],
    approvalRequired: ['schedule_meeting', 'draft_email', 'create_task'],
    keywords: ['qbr', 'quarterly', 'executive', 'strategic', 'c-level', 'roadmap', 'partnership', 'business review']
  },

  email: {
    id: 'email',
    name: 'Email Agent',
    description: 'Customer communications, email drafting and management',
    systemPrompt: `You are an Email Agent specializing in customer communications. Your expertise includes:
- Drafting professional customer emails
- Following up on conversations
- Managing email threads
- Writing for different audiences and tones

When drafting emails:
- Be professional yet personable
- Keep emails concise and actionable
- Include clear next steps
- Personalize based on customer context`,
    tools: COMMON_TOOLS.filter(t => ['get_recent_emails', 'draft_email'].includes(t.name)),
    approvalRequired: ['draft_email'],
    keywords: ['email', 'write', 'draft', 'send', 'reply', 'follow up', 'message']
  },

  meeting: {
    id: 'meeting',
    name: 'Meeting Agent',
    description: 'Meeting scheduling, preparation, and follow-ups',
    systemPrompt: `You are a Meeting Agent for Customer Success. Your expertise includes:
- Scheduling meetings with optimal times
- Preparing meeting briefs and agendas
- Generating follow-up action items
- Managing calendar coordination

When helping with meetings:
- Check availability before suggesting times
- Prepare relevant context for meetings
- Create clear agendas
- Track action items from past meetings`,
    tools: COMMON_TOOLS.filter(t => ['get_todays_meetings', 'get_upcoming_meetings', 'schedule_meeting', 'create_task'].includes(t.name)),
    approvalRequired: ['schedule_meeting', 'create_task'],
    keywords: ['meeting', 'schedule', 'calendar', 'call', 'book', 'agenda', 'availability']
  },

  knowledge: {
    id: 'knowledge',
    name: 'Knowledge Agent',
    description: 'Playbook search, best practices, documentation',
    systemPrompt: `You are a Knowledge Agent with access to CS best practices. Your expertise includes:
- CS playbooks and methodologies
- Best practices for various scenarios
- Documentation and resources
- Industry benchmarks

When helping with knowledge:
- Reference specific playbooks when relevant
- Provide actionable best practices
- Cite sources and resources
- Adapt advice to customer context`,
    tools: [...COMMON_TOOLS],
    approvalRequired: ['create_task'],
    keywords: ['how to', 'best practice', 'playbook', 'template', 'process', 'methodology', 'benchmark']
  },

  research: {
    id: 'research',
    name: 'Research Agent',
    description: 'Company research, stakeholder mapping, news monitoring',
    systemPrompt: `You are a Research Agent for Customer Success. Your expertise includes:
- Company and industry research
- Stakeholder mapping and org charts
- News and event monitoring
- Competitive intelligence

When helping with research:
- Provide relevant company context
- Identify key stakeholders
- Highlight recent news or events
- Note competitive dynamics`,
    tools: [...COMMON_TOOLS],
    approvalRequired: ['create_task'],
    keywords: ['research', 'company', 'stakeholder', 'news', 'industry', 'competitor', 'org chart']
  },

  analytics: {
    id: 'analytics',
    name: 'Analytics Agent',
    description: 'Health scoring, usage metrics, trend analysis',
    systemPrompt: `You are an Analytics Agent for Customer Success. Your expertise includes:
- Health score calculation and analysis
- Usage metrics and trends
- Cohort analysis
- Predictive analytics
- Report generation

When helping with analytics:
- Explain metrics clearly
- Highlight trends and anomalies
- Provide actionable insights
- Compare to benchmarks`,
    tools: [...COMMON_TOOLS, ...ANALYTICS_TOOLS],
    approvalRequired: ['create_task'],
    keywords: ['analytics', 'metrics', 'health score', 'usage', 'data', 'report', 'trend', 'dashboard']
  }
};

// ============================================
// Specialist Agent Class
// ============================================

export class SpecialistAgent {
  private config: SpecialistConfig;

  constructor(type: SpecialistType) {
    this.config = SPECIALIST_CONFIGS[type];
    if (!this.config) {
      throw new Error(`Unknown specialist type: ${type}`);
    }
  }

  get id(): SpecialistType {
    return this.config.id;
  }

  get name(): string {
    return this.config.name;
  }

  async execute(
    message: string,
    context: SpecialistContext,
    parentRunId?: string
  ): Promise<SpecialistResult> {
    // Start tracing
    const run = await agentTracer.startRun({
      agentId: this.config.id,
      agentName: this.config.name,
      agentType: 'specialist',
      userId: context.userId,
      sessionId: context.sessionId,
      customerContext: context.customerContext,
      input: message,
      parentRunId
    });

    try {
      // Build system prompt with context
      const systemPrompt = this.buildSystemPrompt(context);

      // Log thinking step
      await agentTracer.logStep(run.id, {
        type: 'thinking',
        name: 'Building context',
        description: `${this.config.name} analyzing request`,
        input: { message, customerContext: context.customerContext }
      });

      // Prepare messages
      const messages: Anthropic.MessageParam[] = [
        ...(context.conversationHistory || []).map(m => ({
          role: m.role as 'user' | 'assistant',
          content: m.content
        })),
        { role: 'user' as const, content: message }
      ];

      // Log LLM call
      const llmStep = await agentTracer.startStep(run.id, {
        type: 'llm_call',
        name: 'Claude API Call',
        description: `Calling Claude with ${this.config.tools.length} tools`,
        input: { messageCount: messages.length, tools: this.config.tools.map(t => t.name) }
      });

      // Call Claude
      const response = await anthropic.messages.create({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 2048,
        system: systemPrompt,
        tools: this.config.tools,
        messages
      });

      // End LLM step
      if (llmStep) {
        await agentTracer.endStep(llmStep.id, {
          output: { stopReason: response.stop_reason },
          tokens: {
            input: response.usage.input_tokens,
            output: response.usage.output_tokens
          }
        });
      }

      // Process response
      const result = await this.processResponse(response, context, run.id);

      // End run
      await agentTracer.endRun(run.id, {
        status: result.requiresApproval ? 'waiting_approval' : 'completed',
        output: result.response
      });

      return result;

    } catch (error) {
      await agentTracer.endRun(run.id, {
        status: 'failed',
        error: (error as Error).message
      });
      throw error;
    }
  }

  /**
   * Filter context to only include fields relevant to this specialist type.
   * This reduces token usage and improves focus.
   */
  private filterContext(context: SpecialistContext): SpecialistContext {
    const CONTEXT_FIELDS: Record<SpecialistType, {
      customer: (keyof NonNullable<SpecialistContext['customerContext']>)[];
      includeContract: boolean;
    }> = {
      'onboarding': {
        customer: ['name', 'primaryContact', 'industry', 'products'],
        includeContract: true
      },
      'adoption': {
        customer: ['name', 'products', 'healthScore'],
        includeContract: false
      },
      'renewal': {
        customer: ['name', 'arr', 'daysToRenewal', 'healthScore', 'status'],
        includeContract: false
      },
      'risk': {
        customer: ['name', 'healthScore', 'status', 'arr'],
        includeContract: false
      },
      'strategic': {
        customer: ['name', 'arr', 'healthScore', 'industry', 'primaryContact'],
        includeContract: false
      },
      'email': {
        customer: ['name', 'primaryContact'],
        includeContract: false
      },
      'meeting': {
        customer: ['name', 'primaryContact'],
        includeContract: false
      },
      'knowledge': {
        customer: ['name', 'industry', 'products'],
        includeContract: false
      },
      'research': {
        customer: ['name', 'industry'],
        includeContract: false
      },
      'analytics': {
        customer: ['name', 'arr', 'healthScore', 'status', 'daysToRenewal'],
        includeContract: false
      }
    };

    const fieldConfig = CONTEXT_FIELDS[this.config.id];
    if (!fieldConfig) return context;

    const filtered: SpecialistContext = {
      userId: context.userId,
      sessionId: context.sessionId,
      conversationHistory: context.conversationHistory
    };

    // Filter customer context
    if (context.customerContext) {
      filtered.customerContext = {} as any;
      for (const field of fieldConfig.customer) {
        if (field in context.customerContext) {
          (filtered.customerContext as any)[field] = (context.customerContext as any)[field];
        }
      }
    }

    // Include contract context only for relevant specialists
    if (fieldConfig.includeContract && context.contractContext) {
      filtered.contractContext = context.contractContext;
    }

    return filtered;
  }

  private buildSystemPrompt(context: SpecialistContext): string {
    // Filter context to only include relevant fields for this specialist
    const filteredContext = this.filterContext(context);

    let prompt = this.config.systemPrompt;

    if (filteredContext.customerContext) {
      const ctx = filteredContext.customerContext;
      prompt += `\n\n## Current Customer Context`;
      if (ctx.name) prompt += `\nName: ${ctx.name}`;
      if (ctx.arr !== undefined) prompt += `\nARR: $${ctx.arr.toLocaleString()}`;
      if (ctx.healthScore !== undefined) prompt += `\nHealth Score: ${ctx.healthScore}/100`;
      if (ctx.status) prompt += `\nStatus: ${ctx.status}`;
      if (ctx.daysToRenewal !== undefined) prompt += `\nDays to Renewal: ${ctx.daysToRenewal}`;
      if (ctx.primaryContact) prompt += `\nPrimary Contact: ${ctx.primaryContact.name} (${ctx.primaryContact.email})`;
      if (ctx.industry) prompt += `\nIndustry: ${ctx.industry}`;
      if (ctx.products && ctx.products.length > 0) prompt += `\nProducts: ${ctx.products.join(', ')}`;
    }

    if (filteredContext.contractContext) {
      prompt += `\n\n## Contract Details`;
      if (filteredContext.contractContext.entitlements) {
        prompt += `\nEntitlements: ${filteredContext.contractContext.entitlements.length} items`;
      }
      if (filteredContext.contractContext.stakeholders) {
        prompt += `\nStakeholders: ${filteredContext.contractContext.stakeholders.map((s: any) => s.name).join(', ')}`;
      }
    }

    prompt += `\n\n## Guidelines
- Always explain your reasoning
- For actions requiring approval (${this.config.approvalRequired.join(', ')}), explain what will happen
- If you need to hand off to another specialist, use the handoff_to_specialist tool
- Be proactive in suggesting next steps`;

    return prompt;
  }

  private async processResponse(
    response: Anthropic.Message,
    context: SpecialistContext,
    runId: string
  ): Promise<SpecialistResult> {
    const toolUseBlocks = response.content.filter(
      (block): block is Anthropic.ToolUseBlock => block.type === 'tool_use'
    );

    const textBlocks = response.content.filter(
      (block): block is Anthropic.TextBlock => block.type === 'text'
    );

    const textContent = textBlocks.map(b => b.text).join('\n');
    const pendingActions: any[] = [];
    const toolsUsed: string[] = [];
    let nextAgent: SpecialistType | undefined;

    // Process tool calls
    for (const toolUse of toolUseBlocks) {
      const toolInput = toolUse.input as Record<string, any>;

      // Log tool call
      agentTracer.logStep(runId, {
        type: 'tool_call',
        name: toolUse.name,
        description: `Calling tool: ${toolUse.name}`,
        input: toolInput
      });

      toolsUsed.push(toolUse.name);

      // Handle handoff
      if (toolUse.name === 'handoff_to_specialist') {
        nextAgent = toolInput.specialist as SpecialistType;
        agentTracer.logStep(runId, {
          type: 'handoff',
          name: `Handoff to ${nextAgent}`,
          description: toolInput.reason,
          input: toolInput
        });
        continue;
      }

      // Check if approval required
      if (this.config.approvalRequired.includes(toolUse.name)) {
        // Create approval request
        const actionTypeMap: Record<string, any> = {
          'schedule_meeting': 'schedule_meeting',
          'draft_email': 'send_email',
          'create_task': 'create_task'
        };

        const actionType = actionTypeMap[toolUse.name];
        if (actionType) {
          const approval = await approvalService.createApproval({
            userId: context.userId,
            actionType,
            actionData: toolInput,
            originalContent: JSON.stringify(toolInput, null, 2)
          });

          pendingActions.push({
            toolName: toolUse.name,
            input: toolInput,
            approvalId: approval.id,
            status: 'pending_approval'
          });

          agentTracer.logStep(runId, {
            type: 'approval',
            name: `Approval: ${toolUse.name}`,
            description: 'Waiting for user approval',
            input: { approvalId: approval.id, action: toolInput }
          });
        }
      } else {
        // Execute read-only tools immediately
        try {
          const result = await this.executeReadOnlyTool(toolUse.name, toolInput, context.userId);
          agentTracer.logStep(runId, {
            type: 'tool_result',
            name: `Result: ${toolUse.name}`,
            output: result
          });
        } catch (error) {
          agentTracer.logStep(runId, {
            type: 'error',
            name: `Error: ${toolUse.name}`,
            metadata: { error: (error as Error).message }
          });
        }
      }
    }

    // Build final response
    let finalResponse = textContent;
    if (pendingActions.length > 0) {
      finalResponse += '\n\n**Actions Pending Approval:**\n';
      for (const action of pendingActions) {
        finalResponse += `- ${action.toolName}: Check Pending Approvals panel\n`;
      }
    }

    return {
      response: finalResponse,
      requiresApproval: pendingActions.length > 0,
      pendingActions,
      toolsUsed,
      nextAgent
    };
  }

  private async executeReadOnlyTool(
    toolName: string,
    input: Record<string, any>,
    userId: string
  ): Promise<any> {
    switch (toolName) {
      case 'get_todays_meetings': {
        const events = await calendarService.getTodayEvents(userId);
        return { success: true, meetings: events };
      }
      case 'get_upcoming_meetings': {
        const events = await calendarService.getUpcomingEvents(userId, input.days || 7);
        return { success: true, meetings: events };
      }
      case 'get_recent_emails': {
        const result = await gmailService.listThreads(userId, { maxResults: input.maxResults || 10 });
        return { success: true, emails: result.threads };
      }
      default:
        return { success: false, error: `Unknown tool: ${toolName}` };
    }
  }
}

// ============================================
// Factory function
// ============================================

export function createSpecialist(type: SpecialistType): SpecialistAgent {
  return new SpecialistAgent(type);
}

// Export all configs for orchestrator use
export const getAllSpecialists = (): SpecialistConfig[] => Object.values(SPECIALIST_CONFIGS);
