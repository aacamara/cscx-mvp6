/**
 * Researcher Agent
 * Gathers and synthesizes customer intelligence
 * Uses web search, CRM data, and analytics
 */

import {
  Agent,
  AgentContext,
  Tool,
  ToolResult
} from '../types.js';

// Import data access tools for researcher
import { getToolsForAgent } from '../tools/index.js';

// ============================================
// Researcher Tools
// ============================================

const researchCompany: Tool = {
  name: 'research_company',
  description: 'Deep research on customer company',
  inputSchema: {
    type: 'object',
    properties: {
      companyName: {
        type: 'string',
        description: 'Company name to research'
      },
      researchAreas: {
        type: 'array',
        items: {
          type: 'string',
          enum: ['financials', 'news', 'competitors', 'leadership', 'techStack', 'hiring', 'strategy']
        },
        description: 'Areas to focus research on'
      },
      depth: {
        type: 'string',
        enum: ['quick', 'standard', 'deep'],
        description: 'How thorough the research should be'
      }
    },
    required: ['companyName']
  },
  requiresApproval: false,
  execute: async (input: {
    companyName: string;
    researchAreas?: string[];
    depth?: string;
  }, context: AgentContext): Promise<ToolResult> => {
    console.log(`[Researcher] Researching company: ${input.companyName}`);

    // TODO: Integrate with web search APIs, LinkedIn, news APIs
    return {
      success: true,
      data: {
        companyName: input.companyName,
        summary: `${input.companyName} is a growing technology company with a focus on innovation.`,
        keyInsights: [
          'Recent Series B funding of $50M',
          'Expanding engineering team by 30%',
          'New product launch announced for Q2'
        ],
        riskSignals: [],
        opportunities: [
          'Growth trajectory suggests expansion opportunity',
          'New product may require additional training'
        ],
        sources: [
          'Company website',
          'LinkedIn',
          'Recent news articles'
        ]
      }
    };
  }
};

const mapStakeholders: Tool = {
  name: 'map_stakeholders',
  description: 'Identify and map customer stakeholders',
  inputSchema: {
    type: 'object',
    properties: {
      companyName: {
        type: 'string',
        description: 'Company name'
      },
      includeLinkedIn: {
        type: 'boolean',
        description: 'Whether to search LinkedIn for stakeholders'
      },
      departmentFocus: {
        type: 'array',
        items: { type: 'string' },
        description: 'Departments to focus on (e.g., "Engineering", "Product")'
      }
    },
    required: ['companyName']
  },
  requiresApproval: false,
  execute: async (input: {
    companyName: string;
    includeLinkedIn?: boolean;
    departmentFocus?: string[];
  }, context: AgentContext): Promise<ToolResult> => {
    console.log(`[Researcher] Mapping stakeholders for: ${input.companyName}`);

    const existingStakeholders = context.contract?.stakeholders || [];

    return {
      success: true,
      data: {
        companyName: input.companyName,
        knownStakeholders: existingStakeholders,
        discoveredStakeholders: [],
        orgChart: {
          executive: existingStakeholders.filter(s => s.role.toLowerCase().includes('ceo') || s.role.toLowerCase().includes('cto')),
          management: existingStakeholders.filter(s => s.role.toLowerCase().includes('director') || s.role.toLowerCase().includes('manager')),
          technical: existingStakeholders.filter(s => s.role.toLowerCase().includes('engineer') || s.role.toLowerCase().includes('developer'))
        }
      }
    };
  }
};

const analyzeUsagePatterns: Tool = {
  name: 'analyze_usage_patterns',
  description: 'Analyze product usage data for insights',
  inputSchema: {
    type: 'object',
    properties: {
      customerId: {
        type: 'string',
        description: 'Customer ID to analyze'
      },
      timeRange: {
        type: 'string',
        enum: ['7d', '30d', '90d', '1y'],
        description: 'Time range for analysis'
      },
      metrics: {
        type: 'array',
        items: { type: 'string' },
        description: 'Specific metrics to analyze'
      }
    },
    required: []
  },
  requiresApproval: false,
  execute: async (input: {
    customerId?: string;
    timeRange?: string;
    metrics?: string[];
  }, context: AgentContext): Promise<ToolResult> => {
    console.log(`[Researcher] Analyzing usage patterns`);

    return {
      success: true,
      data: {
        customerId: input.customerId || context.customer.id,
        timeRange: input.timeRange || '30d',
        overallAdoption: 72,
        trends: {
          direction: 'increasing',
          percentage: 15
        },
        topFeatures: [
          { name: 'Dashboard', usage: 89 },
          { name: 'Reports', usage: 67 },
          { name: 'Integrations', usage: 45 }
        ],
        underutilized: [
          { name: 'Advanced Analytics', usage: 12 },
          { name: 'Custom Workflows', usage: 8 }
        ]
      }
    };
  }
};

const detectChurnSignals: Tool = {
  name: 'detect_churn_signals',
  description: 'Identify early warning signs of churn',
  inputSchema: {
    type: 'object',
    properties: {
      customerId: {
        type: 'string',
        description: 'Customer ID to analyze'
      },
      includeHistorical: {
        type: 'boolean',
        description: 'Include historical trend analysis'
      }
    },
    required: []
  },
  requiresApproval: false,
  execute: async (input: {
    customerId?: string;
    includeHistorical?: boolean;
  }, context: AgentContext): Promise<ToolResult> => {
    console.log(`[Researcher] Detecting churn signals`);

    const customer = context.customer;
    const riskLevel = customer.healthScore < 60 ? 'high' : customer.healthScore < 80 ? 'medium' : 'low';

    return {
      success: true,
      data: {
        customerId: input.customerId || customer.id,
        riskLevel,
        churnProbability: riskLevel === 'high' ? 0.65 : riskLevel === 'medium' ? 0.35 : 0.1,
        signals: customer.healthScore < 80 ? [
          { type: 'engagement', severity: 'medium', description: 'Login frequency decreased 20% this month' }
        ] : [],
        recommendations: [
          'Schedule proactive check-in call',
          'Share new feature updates',
          'Review adoption metrics together'
        ]
      }
    };
  }
};

const findExpansionOpportunities: Tool = {
  name: 'find_expansion_opportunities',
  description: 'Identify upsell/cross-sell opportunities',
  inputSchema: {
    type: 'object',
    properties: {
      customerId: {
        type: 'string',
        description: 'Customer ID to analyze'
      },
      considerProducts: {
        type: 'array',
        items: { type: 'string' },
        description: 'Products to consider for expansion'
      }
    },
    required: []
  },
  requiresApproval: false,
  execute: async (input: {
    customerId?: string;
    considerProducts?: string[];
  }, context: AgentContext): Promise<ToolResult> => {
    console.log(`[Researcher] Finding expansion opportunities`);

    const customer = context.customer;

    return {
      success: true,
      data: {
        customerId: input.customerId || customer.id,
        currentArr: customer.arr,
        expansionPotential: customer.arr * 0.3, // 30% potential uplift
        opportunities: [
          {
            type: 'upsell',
            product: 'Enterprise Plan',
            potentialValue: customer.arr * 0.2,
            confidence: 0.75,
            reason: 'Customer hitting usage limits on current plan'
          },
          {
            type: 'cross-sell',
            product: 'Advanced Analytics',
            potentialValue: customer.arr * 0.1,
            confidence: 0.6,
            reason: 'High engagement with reporting features'
          }
        ],
        nextSteps: [
          'Present ROI case study for Enterprise features',
          'Demo Advanced Analytics capabilities'
        ]
      }
    };
  }
};

// ============================================
// Researcher Agent Definition
// ============================================

// Get data access tools for the researcher
const researcherDataTools = getToolsForAgent('researcher');

export const ResearcherAgent: Agent = {
  id: 'researcher',
  name: 'Customer Intelligence',
  role: 'Gather and synthesize customer intelligence',
  description: 'Gathers company research, maps stakeholders, analyzes usage patterns, detects churn signals, and identifies expansion opportunities. Has access to knowledge base and metrics for data-driven insights.',
  model: 'claude-sonnet-4',

  tools: [
    researchCompany,
    mapStakeholders,
    analyzeUsagePatterns,
    detectChurnSignals,
    findExpansionOpportunities,
    // Data access tools for knowledge and metrics
    ...researcherDataTools
  ],

  permissions: {
    allowedTools: [
      'research_company', 'map_stakeholders', 'analyze_usage_patterns', 'detect_churn_signals', 'find_expansion_opportunities',
      // Data access tools
      'search_knowledge_base', 'get_playbook', 'search_similar_cases',
      'get_engagement_metrics', 'get_risk_signals', 'get_renewal_forecast',
      'get_customer_360'
    ],
    allowedDirectories: ['/research', '/analytics'],
    requiresApproval: [],
    blockedActions: ['contact_customer', 'modify_data']
  },

  requiredContext: ['customer', 'contract'],

  hooks: {
    preToolUse: async (tool: string, input: any) => {
      console.log(`[Researcher] Using tool: ${tool}`);
      return true;
    },
    postToolUse: async (tool: string, output: any) => {
      console.log(`[Researcher] Tool complete: ${tool}`);
    },
    onError: async (error: Error) => {
      console.error(`[Researcher] Error: ${error.message}`);
    }
  }
};

export default ResearcherAgent;
