/**
 * Agent Data Access Tools
 * PRD: Agent Data Access Layer
 *
 * Exports all data access tools for agents to query:
 * - Knowledge Base (RAG search, playbooks, similar cases)
 * - Customer Database (360 profile, health trends, history)
 * - Metrics (engagement, risk signals, renewal forecast)
 * - Portfolio (insights, cohort comparison)
 */

import { Tool } from '../types.js';

// Knowledge tools
import {
  searchKnowledgeBaseTool,
  getPlaybookTool,
  searchSimilarCasesTool,
} from './knowledge-tools.js';

// Customer tools
import {
  getCustomer360Tool,
  getHealthTrendsTool,
  getCustomerHistoryTool,
} from './customer-tools.js';

// Metrics tools
import {
  getEngagementMetricsTool,
  getRiskSignalsTool,
  getRenewalForecastTool,
} from './metrics-tools.js';

// Portfolio tools
import {
  getPortfolioInsightsTool,
  compareToCohortTool,
} from './portfolio-tools.js';

// Re-export individual tools
export {
  // Knowledge
  searchKnowledgeBaseTool,
  getPlaybookTool,
  searchSimilarCasesTool,
  // Customer
  getCustomer360Tool,
  getHealthTrendsTool,
  getCustomerHistoryTool,
  // Metrics
  getEngagementMetricsTool,
  getRiskSignalsTool,
  getRenewalForecastTool,
  // Portfolio
  getPortfolioInsightsTool,
  compareToCohortTool,
};

/**
 * All data access tools as an array for easy registration
 */
export const dataAccessTools: Tool[] = [
  // Knowledge tools - for finding playbooks, best practices, and similar cases
  searchKnowledgeBaseTool,
  getPlaybookTool,
  searchSimilarCasesTool,

  // Customer tools - for understanding individual customers
  getCustomer360Tool,
  getHealthTrendsTool,
  getCustomerHistoryTool,

  // Metrics tools - for analytics and risk assessment
  getEngagementMetricsTool,
  getRiskSignalsTool,
  getRenewalForecastTool,

  // Portfolio tools - for cross-customer analysis
  getPortfolioInsightsTool,
  compareToCohortTool,
];

/**
 * Data access tools by category
 */
export const dataAccessToolsByCategory = {
  knowledge: [
    searchKnowledgeBaseTool,
    getPlaybookTool,
    searchSimilarCasesTool,
  ],
  customer: [
    getCustomer360Tool,
    getHealthTrendsTool,
    getCustomerHistoryTool,
  ],
  metrics: [
    getEngagementMetricsTool,
    getRiskSignalsTool,
    getRenewalForecastTool,
  ],
  portfolio: [
    getPortfolioInsightsTool,
    compareToCohortTool,
  ],
};

/**
 * Get tools relevant for a specific agent type
 */
export function getToolsForAgent(agentType: string): Tool[] {
  switch (agentType) {
    case 'orchestrator':
      // Orchestrator gets all tools
      return dataAccessTools;

    case 'researcher':
      // Researcher focuses on knowledge and metrics
      return [
        ...dataAccessToolsByCategory.knowledge,
        ...dataAccessToolsByCategory.metrics,
        getCustomer360Tool,
      ];

    case 'communicator':
      // Communicator needs customer context
      return [
        getCustomer360Tool,
        getCustomerHistoryTool,
        getRiskSignalsTool,
      ];

    case 'scheduler':
      // Scheduler needs customer context for meeting prep
      return [
        getCustomer360Tool,
        getHealthTrendsTool,
        getCustomerHistoryTool,
      ];

    default:
      // Default: core customer tools
      return [
        getCustomer360Tool,
        searchKnowledgeBaseTool,
        getRiskSignalsTool,
      ];
  }
}
