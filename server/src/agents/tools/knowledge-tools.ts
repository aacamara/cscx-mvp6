/**
 * Knowledge Base Tools for Agents
 * PRD: Agent Data Access Layer
 *
 * Tools for querying the RAG knowledge base:
 * - search_knowledge_base: Semantic search for playbooks, best practices
 * - get_playbook: Retrieve specific playbook by situation
 * - search_similar_cases: Find historical cases for reference
 */

import { Tool, ToolResult, AgentContext, KnowledgeSearchResult } from '../types.js';
import { knowledgeService } from '../../services/knowledge.js';

// ============================================
// search_knowledge_base Tool
// ============================================

export const searchKnowledgeBaseTool: Tool = {
  name: 'search_knowledge_base',
  description: 'Search the knowledge base for playbooks, best practices, templates, and documentation relevant to the query. Returns semantically similar content with relevance scores. Use this to find CS strategies, escalation procedures, renewal tactics, and other guidance.',
  inputSchema: {
    type: 'object',
    properties: {
      query: {
        type: 'string',
        description: 'Natural language search query (e.g., "how to handle champion departure", "renewal best practices for enterprise")'
      },
      layer: {
        type: 'string',
        enum: ['universal', 'company', 'customer', 'all'],
        description: 'Knowledge layer to search. universal=general CS knowledge, company=organization-specific, customer=customer-specific docs, all=search all layers',
        default: 'all'
      },
      category: {
        type: 'string',
        enum: ['playbooks', 'templates', 'best-practices', 'case-studies', 'faqs'],
        description: 'Optional category filter to narrow results'
      },
      limit: {
        type: 'number',
        description: 'Maximum number of results to return',
        default: 5,
        minimum: 1,
        maximum: 20
      }
    },
    required: ['query']
  },
  requiresApproval: false,

  async execute(input: {
    query: string;
    layer?: 'universal' | 'company' | 'customer' | 'all';
    category?: string;
    limit?: number;
  }, context: AgentContext): Promise<ToolResult> {
    try {
      const { query, layer = 'all', category, limit = 5 } = input;

      // Build search options
      const searchOptions: any = {
        limit,
        threshold: 0.6, // Lower threshold for more results
        userId: context.userId,
      };

      // Add layer filter if not 'all'
      if (layer && layer !== 'all') {
        searchOptions.layer = layer;
      }

      // Add category filter if specified
      if (category) {
        searchOptions.category = category;
      }

      // Add customer context for customer-specific searches
      if (context.customer?.id) {
        searchOptions.customerId = context.customer.id;
      }

      // Execute search
      const results = await knowledgeService.search(query, searchOptions);

      // Transform results to standard format
      const formattedResults: KnowledgeSearchResult[] = results.map(r => ({
        title: r.documentTitle,
        content: r.content,
        relevanceScore: Math.round(r.similarity * 100) / 100,
        source: r.id,
        layer: r.documentLayer,
        category: r.metadata?.category as string | undefined
      }));

      return {
        success: true,
        data: {
          query,
          results: formattedResults,
          totalFound: formattedResults.length,
          searchLayer: layer,
          searchCategory: category
        },
        metadata: {
          tool: 'search_knowledge_base',
          executedAt: new Date().toISOString()
        }
      };
    } catch (error) {
      console.error('[search_knowledge_base] Error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to search knowledge base',
        data: { results: [] }
      };
    }
  }
};

// ============================================
// get_playbook Tool
// ============================================

export const getPlaybookTool: Tool = {
  name: 'get_playbook',
  description: 'Retrieve a specific CS playbook for a situation (e.g., "churn risk", "expansion opportunity", "escalation handling", "QBR preparation"). Returns structured steps and guidance.',
  inputSchema: {
    type: 'object',
    properties: {
      situation: {
        type: 'string',
        description: 'The situation or playbook name to find (e.g., "champion departure", "low engagement", "renewal negotiation")'
      },
      customer_context: {
        type: 'boolean',
        description: 'If true, include customer-specific adaptations based on their profile',
        default: false
      }
    },
    required: ['situation']
  },
  requiresApproval: false,

  async execute(input: {
    situation: string;
    customer_context?: boolean;
  }, context: AgentContext): Promise<ToolResult> {
    try {
      const { situation, customer_context = false } = input;

      // Search for playbooks matching the situation
      const searchQuery = `playbook ${situation}`;
      const results = await knowledgeService.search(searchQuery, {
        limit: 3,
        threshold: 0.5,
        category: 'playbooks',
        userId: context.userId
      });

      if (results.length === 0) {
        // Try a broader search
        const broaderResults = await knowledgeService.search(situation, {
          limit: 3,
          threshold: 0.4,
          userId: context.userId
        });

        if (broaderResults.length === 0) {
          return {
            success: true,
            data: {
              found: false,
              situation,
              message: `No playbook found for "${situation}". Consider creating one or try a different search term.`,
              suggestedSearches: [
                'churn prevention',
                'escalation handling',
                'renewal preparation',
                'onboarding kickoff',
                'QBR execution'
              ]
            }
          };
        }

        results.push(...broaderResults);
      }

      // Get the best matching playbook
      const bestMatch = results[0];

      // Build response with optional customer context
      const playbook: any = {
        title: bestMatch.documentTitle,
        content: bestMatch.content,
        relevanceScore: bestMatch.similarity,
        situation
      };

      // Add customer-specific adaptations if requested
      if (customer_context && context.customer) {
        playbook.customerAdaptations = {
          customerName: context.customer.name,
          tier: context.customer.industry || 'Unknown',
          healthScore: context.customer.healthScore,
          status: context.customer.status,
          considerations: generateCustomerConsiderations(context.customer)
        };
      }

      // Find related playbooks
      playbook.relatedPlaybooks = results.slice(1).map(r => ({
        title: r.documentTitle,
        relevance: Math.round(r.similarity * 100) / 100
      }));

      return {
        success: true,
        data: playbook,
        metadata: {
          tool: 'get_playbook',
          executedAt: new Date().toISOString()
        }
      };
    } catch (error) {
      console.error('[get_playbook] Error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to retrieve playbook'
      };
    }
  }
};

// ============================================
// search_similar_cases Tool
// ============================================

export const searchSimilarCasesTool: Tool = {
  name: 'search_similar_cases',
  description: 'Find similar historical customer cases based on situation, outcome, or characteristics. Useful for learning from past experiences and predicting outcomes.',
  inputSchema: {
    type: 'object',
    properties: {
      situation: {
        type: 'string',
        description: 'Description of the current situation to find similar cases for'
      },
      outcome_filter: {
        type: 'string',
        enum: ['success', 'churn', 'expansion', 'all'],
        description: 'Filter by case outcome to find specific examples',
        default: 'all'
      },
      industry: {
        type: 'string',
        description: 'Optional industry filter to find more relevant cases'
      }
    },
    required: ['situation']
  },
  requiresApproval: false,

  async execute(input: {
    situation: string;
    outcome_filter?: 'success' | 'churn' | 'expansion' | 'all';
    industry?: string;
  }, context: AgentContext): Promise<ToolResult> {
    try {
      const { situation, outcome_filter = 'all', industry } = input;

      // Build search query
      let searchQuery = `case study ${situation}`;
      if (outcome_filter !== 'all') {
        searchQuery += ` ${outcome_filter}`;
      }
      if (industry) {
        searchQuery += ` ${industry}`;
      }

      // Search knowledge base for case studies
      const results = await knowledgeService.search(searchQuery, {
        limit: 5,
        threshold: 0.4,
        category: 'case-studies',
        userId: context.userId
      });

      // Transform results to case format
      const cases = results.map((r, index) => ({
        id: `case-${index + 1}`,
        title: r.documentTitle,
        situation: extractSituation(r.content),
        outcome: extractOutcome(r.content, outcome_filter),
        keyActions: extractKeyActions(r.content),
        lessonsLearned: extractLessons(r.content),
        similarity: Math.round(r.similarity * 100) / 100,
        industry: r.metadata?.industry as string | undefined
      }));

      // If no case studies found, provide general guidance
      if (cases.length === 0) {
        return {
          success: true,
          data: {
            found: false,
            situation,
            message: 'No similar cases found in the knowledge base. Consider documenting this case after resolution.',
            generalGuidance: [
              'Document the situation thoroughly',
              'Track all actions taken',
              'Measure outcomes for future reference',
              'Share learnings with the team'
            ]
          }
        };
      }

      return {
        success: true,
        data: {
          situation,
          outcomeFilter: outcome_filter,
          cases,
          summary: {
            totalFound: cases.length,
            successCases: cases.filter(c => c.outcome === 'success').length,
            churnCases: cases.filter(c => c.outcome === 'churn').length,
            expansionCases: cases.filter(c => c.outcome === 'expansion').length
          }
        },
        metadata: {
          tool: 'search_similar_cases',
          executedAt: new Date().toISOString()
        }
      };
    } catch (error) {
      console.error('[search_similar_cases] Error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to search similar cases'
      };
    }
  }
};

// ============================================
// Helper Functions
// ============================================

function generateCustomerConsiderations(customer: any): string[] {
  const considerations: string[] = [];

  if (customer.healthScore < 50) {
    considerations.push('Health score is critical - prioritize immediate intervention');
  } else if (customer.healthScore < 70) {
    considerations.push('Health score indicates risk - monitor closely');
  }

  if (customer.status === 'at_risk') {
    considerations.push('Customer is flagged at-risk - escalation may be needed');
  }

  if (customer.status === 'onboarding') {
    considerations.push('Customer is still onboarding - focus on time-to-value');
  }

  if (customer.arr > 100000) {
    considerations.push('High-value account - consider executive engagement');
  }

  if (customer.renewalDate) {
    const daysToRenewal = Math.floor(
      (new Date(customer.renewalDate).getTime() - Date.now()) / (1000 * 60 * 60 * 24)
    );
    if (daysToRenewal < 30) {
      considerations.push(`Renewal in ${daysToRenewal} days - urgent attention needed`);
    } else if (daysToRenewal < 90) {
      considerations.push(`Renewal in ${daysToRenewal} days - begin renewal preparation`);
    }
  }

  return considerations.length > 0 ? considerations : ['Standard engagement approach recommended'];
}

function extractSituation(content: string): string {
  // Extract situation description from content (first paragraph or summary)
  const lines = content.split('\n').filter(l => l.trim());
  return lines[0]?.slice(0, 200) || 'Situation details not available';
}

function extractOutcome(content: string, filter: string): string {
  const lowerContent = content.toLowerCase();
  if (lowerContent.includes('churned') || lowerContent.includes('lost')) {
    return 'churn';
  }
  if (lowerContent.includes('expanded') || lowerContent.includes('upsell')) {
    return 'expansion';
  }
  if (lowerContent.includes('renewed') || lowerContent.includes('retained') || lowerContent.includes('success')) {
    return 'success';
  }
  return filter !== 'all' ? filter : 'unknown';
}

function extractKeyActions(content: string): string[] {
  // Look for bullet points or numbered lists indicating actions
  const actionPatterns = [
    /(?:^|\n)[-•*]\s*(.+)/g,
    /(?:^|\n)\d+\.\s*(.+)/g,
    /action[s]?:?\s*(.+)/gi
  ];

  const actions: string[] = [];
  for (const pattern of actionPatterns) {
    let match;
    while ((match = pattern.exec(content)) !== null && actions.length < 5) {
      const action = match[1].trim();
      if (action.length > 10 && action.length < 200) {
        actions.push(action);
      }
    }
  }

  return actions.length > 0 ? actions : ['Detailed actions not documented'];
}

function extractLessons(content: string): string[] {
  const lowerContent = content.toLowerCase();
  const lessons: string[] = [];

  // Look for lesson indicators
  if (lowerContent.includes('learned')) {
    const lessonMatch = content.match(/learned[:\s]+([^.]+)/i);
    if (lessonMatch) lessons.push(lessonMatch[1].trim());
  }

  if (lowerContent.includes('takeaway')) {
    const takeawayMatch = content.match(/takeaway[s]?[:\s]+([^.]+)/i);
    if (takeawayMatch) lessons.push(takeawayMatch[1].trim());
  }

  if (lowerContent.includes('insight')) {
    const insightMatch = content.match(/insight[s]?[:\s]+([^.]+)/i);
    if (insightMatch) lessons.push(insightMatch[1].trim());
  }

  return lessons.length > 0 ? lessons : ['Document lessons after case resolution'];
}
