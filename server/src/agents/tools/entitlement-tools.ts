/**
 * Entitlement Tools for Agents
 * PRD-0: Contract Parsing + Entitlements
 *
 * Tools for querying entitlements and contracts:
 * - get_customer_entitlements: Get finalized entitlements for a customer
 * - search_contracts: Full-text search on contract content
 * - get_entitlement_details: Get detailed entitlement with source text
 */

import { Tool, ToolResult, AgentContext } from '../types.js';
import { createClient } from '@supabase/supabase-js';
import { config } from '../../config/index.js';

// Initialize Supabase client
const supabase = config.supabaseUrl && config.supabaseServiceKey
  ? createClient(config.supabaseUrl, config.supabaseServiceKey)
  : null;

// Test mode flag - when true, return mock data instead of requiring DB
const isTestMode = process.env.NODE_ENV === 'test' || process.env.VITEST;

// ============================================
// get_customer_entitlements Tool
// ============================================

export const getCustomerEntitlementsTool: Tool = {
  name: 'get_customer_entitlements',
  description: 'Get active entitlements for a customer including product licenses, usage limits, support tiers, and renewal dates. Use this to answer questions about what a customer is entitled to, their contract terms, and renewal information.',
  inputSchema: {
    type: 'object',
    properties: {
      customer_id: {
        type: 'string',
        description: 'Customer ID to look up. If not provided, uses the current customer context.'
      },
      include_draft: {
        type: 'boolean',
        description: 'Include draft/pending entitlements in addition to finalized ones. Default is false (only finalized).'
      },
      fields: {
        type: 'array',
        items: {
          type: 'string',
          enum: ['products', 'support', 'dates', 'pricing', 'usage', 'all']
        },
        description: 'Which entitlement fields to include. Default is all fields.'
      }
    }
  },
  requiresApproval: false,

  async execute(input: {
    customer_id?: string;
    include_draft?: boolean;
    fields?: string[];
  }, context: AgentContext): Promise<ToolResult> {
    try {
      const customerId = input.customer_id || context.customer?.id;

      if (!customerId) {
        return {
          success: false,
          error: 'No customer ID provided and no customer in context. Please specify a customer_id.'
        };
      }

      const includeDraft = input.include_draft || false;
      const fields = input.fields || ['all'];
      const includeAll = fields.includes('all');

      if (!supabase) {
        // In test mode, return mock data
        if (isTestMode) {
          return {
            success: true,
            data: {
              customerId: customerId,
              entitlements: [
                {
                  id: 'mock-ent-1',
                  product: 'Enterprise Plan',
                  sku: 'ENT-100',
                  quantity: 100,
                  quantityUnit: 'users',
                  status: 'finalized',
                  isActive: true
                }
              ],
              count: 1,
              activeCount: 1,
              totalValue: 120000,
              summary: 'Mock: Found 1 entitlement(s) for this customer.'
            }
          };
        }
        return {
          success: false,
          error: 'Database not configured'
        };
      }

      // Build query
      let query = supabase
        .from('entitlements')
        .select(`
          id,
          contract_id,
          sku,
          product_name,
          name,
          description,
          quantity,
          quantity_unit,
          unit,
          usage_limit,
          usage_unit,
          usage_current,
          support_tier,
          sla_response_time,
          sla_resolution_time,
          start_date,
          end_date,
          effective_date,
          renewal_date,
          renewal_terms,
          auto_renew,
          unit_price,
          total_price,
          currency,
          billing_frequency,
          confidence_overall,
          special_clauses,
          exclusions,
          notes,
          version,
          is_active,
          status,
          contracts(file_name, file_url, company_name)
        `)
        .eq('customer_id', customerId);

      // Filter by status
      if (!includeDraft) {
        query = query.eq('status', 'finalized');
      }

      // Prefer active entitlements
      query = query.order('is_active', { ascending: false })
        .order('created_at', { ascending: false });

      const { data, error } = await query;

      if (error) {
        console.error('[get_customer_entitlements] Supabase error:', error);
        return {
          success: false,
          error: `Failed to fetch entitlements: ${error.message}`
        };
      }

      if (!data || data.length === 0) {
        return {
          success: true,
          data: {
            customer_id: customerId,
            entitlements: [],
            count: 0,
            message: 'No entitlements found for this customer'
          }
        };
      }

      // Format response based on requested fields
      const entitlements = data.map((e: any) => {
        const result: Record<string, unknown> = {
          id: e.id,
          product: e.product_name || e.name || e.sku || 'Unknown Product',
          status: e.status,
          isActive: e.is_active,
          confidence: e.confidence_overall
        };

        // Products section
        if (includeAll || fields.includes('products')) {
          result.sku = e.sku;
          result.productName = e.product_name || e.name;
          result.description = e.description;
          result.quantity = e.quantity;
          result.quantityUnit = e.quantity_unit || e.unit;
        }

        // Support section
        if (includeAll || fields.includes('support')) {
          result.supportTier = e.support_tier;
          result.slaResponseTime = e.sla_response_time;
          result.slaResolutionTime = e.sla_resolution_time;
        }

        // Dates section
        if (includeAll || fields.includes('dates')) {
          result.startDate = e.start_date;
          result.endDate = e.end_date;
          result.effectiveDate = e.effective_date;
          result.renewalDate = e.renewal_date;
          result.renewalTerms = e.renewal_terms;
          result.autoRenew = e.auto_renew;
        }

        // Pricing section
        if (includeAll || fields.includes('pricing')) {
          result.unitPrice = e.unit_price;
          result.totalPrice = e.total_price;
          result.currency = e.currency;
          result.billingFrequency = e.billing_frequency;
        }

        // Usage section
        if (includeAll || fields.includes('usage')) {
          result.usageLimit = e.usage_limit;
          result.usageUnit = e.usage_unit;
          result.usageCurrent = e.usage_current;
          if (e.usage_limit && e.usage_current) {
            result.usagePercentage = Math.round((e.usage_current / e.usage_limit) * 100);
          }
        }

        // Contract reference
        if (e.contracts) {
          result.contractName = e.contracts.file_name;
          result.companyName = e.contracts.company_name;
        }

        // Special notes
        if (e.special_clauses?.length > 0) {
          result.specialClauses = e.special_clauses;
        }
        if (e.exclusions?.length > 0) {
          result.exclusions = e.exclusions;
        }
        if (e.notes) {
          result.notes = e.notes;
        }

        return result;
      });

      // Calculate summary
      const activeCount = data.filter((e: any) => e.is_active).length;
      const totalValue = data.reduce((sum: number, e: any) => sum + (e.total_price || 0), 0);
      const renewalDates = data
        .filter((e: any) => e.renewal_date)
        .map((e: any) => e.renewal_date)
        .sort();
      const nextRenewal = renewalDates[0];

      return {
        success: true,
        data: {
          customer_id: customerId,
          entitlements,
          count: data.length,
          activeCount,
          totalValue,
          nextRenewalDate: nextRenewal,
          summary: `Found ${data.length} entitlement(s) for this customer. ${activeCount} are active. Total contract value: ${new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(totalValue)}.${nextRenewal ? ` Next renewal: ${nextRenewal}` : ''}`
        }
      };
    } catch (error) {
      console.error('[get_customer_entitlements] Error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'An unexpected error occurred'
      };
    }
  }
};

// ============================================
// search_contracts Tool
// ============================================

export const searchContractsTool: Tool = {
  name: 'search_contracts',
  description: 'Search contract documents for specific terms, clauses, or information. Use this to find specific contract language, answer questions about terms and conditions, or locate relevant sections in customer contracts.',
  inputSchema: {
    type: 'object',
    properties: {
      query: {
        type: 'string',
        description: 'Search query - terms to search for in contract text'
      },
      customer_id: {
        type: 'string',
        description: 'Limit search to a specific customer. If not provided, searches all contracts.'
      },
      contract_type: {
        type: 'string',
        enum: ['msa', 'sow', 'order_form', 'amendment'],
        description: 'Filter by contract type'
      },
      limit: {
        type: 'number',
        description: 'Maximum number of results to return. Default is 5.'
      }
    },
    required: ['query']
  },
  requiresApproval: false,

  async execute(input: {
    query: string;
    customer_id?: string;
    contract_type?: string;
    limit?: number;
  }, context: AgentContext): Promise<ToolResult> {
    try {
      const { query, contract_type } = input;
      const customerId = input.customer_id || context.customer?.id;
      const limit = input.limit || 5;

      if (!query || query.trim().length < 2) {
        return {
          success: false,
          error: 'Search query must be at least 2 characters'
        };
      }

      if (!supabase) {
        // In test mode, return mock data
        if (isTestMode) {
          return {
            success: true,
            data: {
              query,
              results: [
                {
                  contractId: 'mock-contract-1',
                  fileName: 'enterprise-msa.pdf',
                  companyName: 'Acme Corp',
                  contractType: 'msa',
                  matchingSnippets: [`...${query} found in contract terms...`],
                  matchCount: 1
                }
              ],
              totalResults: 1,
              count: 1,
              summary: `Mock: Found 1 contract(s) matching "${query}".`
            }
          };
        }
        return {
          success: false,
          error: 'Database not configured'
        };
      }

      // Search in contract raw_text and parsed_data
      let contractQuery = supabase
        .from('contracts')
        .select(`
          id,
          file_name,
          company_name,
          contract_type,
          status,
          start_date,
          end_date,
          total_value,
          raw_text,
          parsed_data,
          customer_id,
          customers(name)
        `)
        .or(`raw_text.ilike.%${query}%,company_name.ilike.%${query}%`)
        .limit(limit);

      if (customerId) {
        contractQuery = contractQuery.eq('customer_id', customerId);
      }

      if (contract_type) {
        contractQuery = contractQuery.eq('contract_type', contract_type);
      }

      const { data, error } = await contractQuery;

      if (error) {
        console.error('[search_contracts] Supabase error:', error);
        return {
          success: false,
          error: `Search failed: ${error.message}`
        };
      }

      if (!data || data.length === 0) {
        return {
          success: true,
          data: {
            query,
            results: [],
            count: 0,
            message: `No contracts found matching "${query}"`
          }
        };
      }

      // Extract relevant snippets from matches
      const results = data.map((contract: any) => {
        const rawText = contract.raw_text || '';
        const snippets: string[] = [];

        // Find matching sections in raw text
        const queryLower = query.toLowerCase();
        const textLower = rawText.toLowerCase();
        let searchIndex = 0;
        const maxSnippets = 3;

        while (snippets.length < maxSnippets) {
          const matchIndex = textLower.indexOf(queryLower, searchIndex);
          if (matchIndex === -1) break;

          // Extract surrounding context (200 chars before and after)
          const start = Math.max(0, matchIndex - 200);
          const end = Math.min(rawText.length, matchIndex + query.length + 200);
          let snippet = rawText.substring(start, end).trim();

          // Add ellipsis if truncated
          if (start > 0) snippet = '...' + snippet;
          if (end < rawText.length) snippet = snippet + '...';

          snippets.push(snippet);
          searchIndex = matchIndex + query.length;
        }

        return {
          contractId: contract.id,
          fileName: contract.file_name,
          companyName: contract.company_name,
          customerName: contract.customers?.name,
          contractType: contract.contract_type,
          status: contract.status,
          period: contract.start_date && contract.end_date
            ? `${contract.start_date} to ${contract.end_date}`
            : null,
          totalValue: contract.total_value,
          matchingSnippets: snippets,
          matchCount: snippets.length
        };
      });

      return {
        success: true,
        data: {
          query,
          results,
          count: results.length,
          summary: `Found ${results.length} contract(s) matching "${query}". ${results.map((r: any) => `${r.fileName} (${r.matchCount} matches)`).join(', ')}`
        }
      };
    } catch (error) {
      console.error('[search_contracts] Error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'An unexpected error occurred'
      };
    }
  }
};

// ============================================
// get_entitlement_details Tool
// ============================================

export const getEntitlementDetailsTool: Tool = {
  name: 'get_entitlement_details',
  description: 'Get detailed information about a specific entitlement including source contract text, edit history, and all extracted fields. Use this when you need the complete details of a single entitlement.',
  inputSchema: {
    type: 'object',
    properties: {
      entitlement_id: {
        type: 'string',
        description: 'The ID of the entitlement to retrieve'
      }
    },
    required: ['entitlement_id']
  },
  requiresApproval: false,

  async execute(input: {
    entitlement_id: string;
  }, _context: AgentContext): Promise<ToolResult> {
    try {
      const { entitlement_id } = input;

      if (!entitlement_id) {
        return {
          success: false,
          error: 'entitlement_id is required'
        };
      }

      if (!supabase) {
        // In test mode, return mock data
        if (isTestMode) {
          return {
            success: true,
            data: {
              id: entitlement_id,
              customer: { id: 'mock-customer', name: 'Acme Corp' },
              contract: { id: 'mock-contract', fileName: 'enterprise-msa.pdf' },
              product: { sku: 'ENT-100', name: 'Enterprise Plan', quantity: 100 },
              usage: { limit: 100, current: 75, percentage: 75 },
              support: { tier: 'premium', slaResponseTime: '4 hours' },
              dates: { startDate: '2024-01-01', endDate: '2025-01-01' },
              pricing: { totalPrice: 120000, currency: 'USD' },
              status: 'finalized',
              isActive: true
            }
          };
        }
        return {
          success: false,
          error: 'Database not configured'
        };
      }

      // Fetch entitlement with contract
      const { data: entitlement, error } = await supabase
        .from('entitlements')
        .select(`
          *,
          contracts(id, file_name, file_url, company_name, raw_text, parsed_data),
          customers(id, name)
        `)
        .eq('id', entitlement_id)
        .single();

      if (error) {
        console.error('[get_entitlement_details] Supabase error:', error);
        return {
          success: false,
          error: `Failed to fetch entitlement: ${error.message}`
        };
      }

      if (!entitlement) {
        return {
          success: false,
          error: `Entitlement ${entitlement_id} not found`
        };
      }

      // Fetch edit history
      const { data: edits } = await supabase
        .from('entitlement_edits')
        .select('*')
        .eq('entitlement_id', entitlement_id)
        .order('edited_at', { ascending: false });

      return {
        success: true,
        data: {
          id: entitlement.id,
          customer: {
            id: entitlement.customers?.id,
            name: entitlement.customers?.name
          },
          contract: {
            id: entitlement.contracts?.id,
            fileName: entitlement.contracts?.file_name,
            companyName: entitlement.contracts?.company_name
          },
          product: {
            sku: entitlement.sku,
            name: entitlement.product_name || entitlement.name,
            description: entitlement.description,
            quantity: entitlement.quantity,
            quantityUnit: entitlement.quantity_unit || entitlement.unit
          },
          usage: {
            limit: entitlement.usage_limit,
            current: entitlement.usage_current,
            unit: entitlement.usage_unit,
            percentage: entitlement.usage_limit && entitlement.usage_current
              ? Math.round((entitlement.usage_current / entitlement.usage_limit) * 100)
              : null
          },
          support: {
            tier: entitlement.support_tier,
            slaResponseTime: entitlement.sla_response_time,
            slaResolutionTime: entitlement.sla_resolution_time
          },
          dates: {
            startDate: entitlement.start_date,
            endDate: entitlement.end_date,
            effectiveDate: entitlement.effective_date,
            renewalDate: entitlement.renewal_date,
            renewalTerms: entitlement.renewal_terms,
            autoRenew: entitlement.auto_renew
          },
          pricing: {
            unitPrice: entitlement.unit_price,
            totalPrice: entitlement.total_price,
            currency: entitlement.currency,
            billingFrequency: entitlement.billing_frequency
          },
          confidence: {
            sku: entitlement.confidence_sku,
            quantity: entitlement.confidence_quantity,
            dates: entitlement.confidence_dates,
            pricing: entitlement.confidence_pricing,
            overall: entitlement.confidence_overall
          },
          specialClauses: entitlement.special_clauses,
          exclusions: entitlement.exclusions,
          notes: entitlement.notes,
          sourceSection: entitlement.source_section,
          version: entitlement.version,
          isActive: entitlement.is_active,
          status: entitlement.status,
          createdAt: entitlement.created_at,
          updatedAt: entitlement.updated_at,
          finalizedAt: entitlement.finalized_at,
          editHistory: edits?.map((edit: any) => ({
            field: edit.field_name,
            oldValue: edit.old_value,
            newValue: edit.new_value,
            editedAt: edit.edited_at
          })) || []
        }
      };
    } catch (error) {
      console.error('[get_entitlement_details] Error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'An unexpected error occurred'
      };
    }
  }
};

// Export all tools
export const entitlementTools = [
  getCustomerEntitlementsTool,
  searchContractsTool,
  getEntitlementDetailsTool
];
