/**
 * Orchestrator Agent - The Brain
 * Coordinates all customer success activities
 * Delegates to specialized agents, manages task ledger
 */

import {
  Agent,
  AgentContext,
  Tool,
  ToolResult,
  TaskLedger,
  TaskStep,
  Approval
} from '../types.js';

// Import data access tools
import { dataAccessTools, getToolsForAgent } from '../tools/index.js';

// ============================================
// Orchestrator Tools
// ============================================

const delegateToAgent: Tool = {
  name: 'delegate_to_agent',
  description: 'Assign a task to a specialized agent',
  inputSchema: {
    type: 'object',
    properties: {
      agentId: {
        type: 'string',
        enum: ['scheduler', 'communicator', 'researcher', 'trainer', 'monitor', 'expansion'],
        description: 'The agent to delegate to'
      },
      task: {
        type: 'string',
        description: 'Description of the task to perform'
      },
      context: {
        type: 'object',
        description: 'Additional context for the task'
      },
      priority: {
        type: 'string',
        enum: ['urgent', 'high', 'normal', 'low'],
        description: 'Task priority'
      }
    },
    required: ['agentId', 'task']
  },
  requiresApproval: false,
  execute: async (input: {
    agentId: string;
    task: string;
    context?: any;
    priority?: string;
  }, context: AgentContext): Promise<ToolResult> => {
    const { agentId, task, priority = 'normal' } = input;

    // Create task in ledger
    const taskStep: TaskStep = {
      id: `task_${Date.now()}`,
      description: task,
      agentId,
      status: 'pending'
    };

    console.log(`[Orchestrator] Delegating to ${agentId}: ${task} (${priority})`);

    return {
      success: true,
      data: {
        taskId: taskStep.id,
        agentId,
        task,
        priority,
        status: 'delegated'
      }
    };
  }
};

const requestHumanApproval: Tool = {
  name: 'request_human_approval',
  description: 'Escalate decision to human CSM for approval. Use this when you need human confirmation before proceeding.',
  inputSchema: {
    type: 'object',
    properties: {
      action: {
        type: 'string',
        description: 'The action that needs approval'
      },
      reason: {
        type: 'string',
        description: 'Why this action needs approval'
      },
      options: {
        type: 'array',
        items: { type: 'string' },
        description: 'Available options for the human to choose'
      },
      recommendation: {
        type: 'string',
        description: 'AI recommendation'
      },
      urgency: {
        type: 'string',
        enum: ['blocking', 'important', 'informational'],
        description: 'How urgent is this approval'
      }
    },
    required: ['action', 'reason']
  },
  // This tool ALWAYS requires approval - it's the explicit approval request
  requiresApproval: true,
  execute: async (input: {
    action: string;
    reason: string;
    options?: string[];
    recommendation?: string;
    urgency?: 'blocking' | 'important' | 'informational';
  }, context: AgentContext): Promise<ToolResult> => {
    const approval: Partial<Approval> = {
      id: `approval_${Date.now()}`,
      agentId: 'orchestrator',
      action: {
        toolName: 'human_decision',
        input: input.options,
        description: input.action
      },
      reason: input.reason,
      recommendation: input.recommendation || 'No recommendation provided',
      urgency: input.urgency || 'important',
      status: 'pending',
      createdAt: new Date(),
      expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000) // 24 hours
    };

    console.log(`[Orchestrator] Requesting approval: ${input.action}`);

    return {
      success: true,
      data: {
        approvalId: approval.id,
        action: input.action,
        urgency: approval.urgency,
        status: 'pending'
      }
    };
  }
};

const updateTaskLedger: Tool = {
  name: 'update_task_ledger',
  description: 'Update the plan based on new information',
  inputSchema: {
    type: 'object',
    properties: {
      action: {
        type: 'string',
        enum: ['add_task', 'remove_task', 'reorder', 'update_status'],
        description: 'What update to make'
      },
      taskId: {
        type: 'string',
        description: 'Task ID to update (for remove/update_status)'
      },
      task: {
        type: 'object',
        description: 'New task to add (for add_task)'
      },
      newStatus: {
        type: 'string',
        enum: ['pending', 'in_progress', 'completed', 'failed', 'blocked'],
        description: 'New status (for update_status)'
      }
    },
    required: ['action']
  },
  requiresApproval: false,
  execute: async (input: {
    action: string;
    taskId?: string;
    task?: any;
    newStatus?: string;
  }, context: AgentContext): Promise<ToolResult> => {
    console.log(`[Orchestrator] Updating ledger: ${input.action}`);

    return {
      success: true,
      data: {
        action: input.action,
        updated: true
      }
    };
  }
};

const checkCustomerHealth: Tool = {
  name: 'check_customer_health',
  description: 'Get current health score and risk signals',
  inputSchema: {
    type: 'object',
    properties: {
      customerId: {
        type: 'string',
        description: 'Customer ID to check'
      },
      includeDetails: {
        type: 'boolean',
        description: 'Whether to include detailed breakdown'
      }
    },
    required: []
  },
  requiresApproval: false,
  execute: async (input: {
    customerId?: string;
    includeDetails?: boolean;
  }, context: AgentContext): Promise<ToolResult> => {
    const customer = context.customer;

    return {
      success: true,
      data: {
        customerId: customer.id,
        healthScore: customer.healthScore,
        status: customer.status,
        riskSignals: context.riskSignals,
        details: input.includeDetails ? {
          engagement: 85,
          adoption: 72,
          sentiment: 90
        } : undefined
      }
    };
  }
};

// ============================================
// Orchestrator Agent Definition
// ============================================

// Get all data access tools for the orchestrator
const orchestratorDataTools = getToolsForAgent('orchestrator');

export const OrchestratorAgent: Agent = {
  id: 'orchestrator',
  name: 'CS Orchestrator',
  role: 'Coordinate all customer success activities',
  description: 'The main orchestrator that coordinates specialized agents, manages the task ledger, and ensures customer success workflows execute properly. Has access to all data sources for informed decision-making.',
  model: 'claude-sonnet-4',

  tools: [
    delegateToAgent,
    requestHumanApproval,
    updateTaskLedger,
    checkCustomerHealth,
    // Data access tools for querying knowledge base, customer data, and metrics
    ...orchestratorDataTools
  ],

  permissions: {
    allowedTools: [
      'delegate_to_agent', 'request_human_approval', 'update_task_ledger', 'check_customer_health',
      // Data access tools (all read-only, auto-approved)
      'search_knowledge_base', 'get_playbook', 'search_similar_cases',
      'get_customer_360', 'get_health_trends', 'get_customer_history',
      'get_engagement_metrics', 'get_risk_signals', 'get_renewal_forecast',
      'get_portfolio_insights', 'compare_to_cohort'
    ],
    allowedDirectories: ['/customers', '/plans', '/tasks'],
    requiresApproval: [],
    blockedActions: ['send_email', 'book_meeting', 'create_document'] // Orchestrator delegates, doesn't execute
  },

  requiredContext: ['customer', 'currentPhase'],

  hooks: {
    preToolUse: async (tool: string, input: any) => {
      console.log(`[Orchestrator] Using tool: ${tool}`, JSON.stringify(input).slice(0, 200));
      return true;
    },
    postToolUse: async (tool: string, output: any) => {
      console.log(`[Orchestrator] Tool complete: ${tool}`);
    },
    onError: async (error: Error) => {
      console.error(`[Orchestrator] Error: ${error.message}`);
    }
  }
};

// ============================================
// System Prompt Builder
// ============================================

export const getOrchestratorSystemPrompt = (context: AgentContext): string => {
  const basePrompt = `You are the CSCX.AI Orchestrator, a customer success AI that coordinates specialized agents to onboard and support customers.

Current Customer: ${context.customer?.name || 'Not set'}
Current Phase: ${context.currentPhase}
Health Score: ${context.customer?.healthScore || 'Unknown'}%
Your Role: Coordinate agents, request approvals for sensitive actions, keep the CSM informed.

## Available Agents
- **scheduler**: Manages calendar, checks availability, books meetings
- **communicator**: Drafts emails, manages sequences, handles outreach
- **researcher**: Gathers company intelligence, maps stakeholders, detects risks
- **trainer**: Creates onboarding materials, training plans, documentation
- **monitor**: Tracks health scores, usage data, churn signals
- **expansion**: Identifies upsell opportunities, generates proposals

## Your Tools
- delegate_to_agent: Assign tasks to specialized agents
- request_human_approval: Escalate decisions to human CSM
- update_task_ledger: Manage the execution plan
- check_customer_health: Get customer health and risk signals

## Data Access Tools (Use these to gather information before making decisions!)
- search_knowledge_base: Find playbooks, best practices, templates
- get_playbook: Get specific CS playbook for a situation
- search_similar_cases: Find historical cases similar to current situation
- get_customer_360: Get complete customer profile with all data
- get_health_trends: See health score changes over time
- get_customer_history: View interaction timeline (meetings, emails, tickets)
- get_engagement_metrics: Check product adoption and usage
- get_risk_signals: Identify churn indicators and risks
- get_renewal_forecast: Get renewal probability and recommendations
- get_portfolio_insights: Cross-customer analysis
- compare_to_cohort: Benchmark against similar customers

## Rules
1. NEVER execute customer-facing actions directly (emails, meetings, etc.)
2. ALWAYS delegate to the appropriate specialist agent
3. Request human approval for anything that affects the customer externally
4. Keep the CSM informed of progress and decisions
5. Monitor for risks and escalate proactively
6. ALWAYS query data before making recommendations - use data access tools!
7. Cite your data sources in responses (e.g., "Based on health trend data...")`;

  const phasePrompts: Record<string, string> = {
    'upload': 'The CSM is uploading a contract. Help them understand what you will extract and prepare for review.',
    'parsing': 'You are analyzing the contract. Narrate what you are finding in real-time. Highlight anything unusual.',
    'review': 'Contract data is ready for review. Guide the CSM through the extracted data. Suggest corrections if needed.',
    'enriching': `You are gathering intelligence on ${context.customer?.name}. Share interesting findings as you discover them.`,
    'planning': 'You are generating the 30-60-90 day onboarding plan. Explain your reasoning for key milestones.',
    'plan_review': 'The onboarding plan is ready for review. Walk the CSM through each phase.',
    'executing': `Agents are actively working on ${context.customer?.name}'s onboarding. Coordinate their activities and report progress.`,
    'monitoring': `Onboarding is complete. You are monitoring ${context.customer?.name}'s health. Watch for churn signals and opportunities.`,
    'completed': 'This customer\'s onboarding is complete. Summarize the journey and key outcomes.'
  };

  const phaseContext = phasePrompts[context.currentPhase] || '';

  return `${basePrompt}\n\n## Current Phase: ${context.currentPhase}\n${phaseContext}`;
};

export default OrchestratorAgent;
