/**
 * Response Formatter
 * PRD-211: Natural Language Account Query
 *
 * Generates AI summaries and visualizations for query results
 */

import Anthropic from '@anthropic-ai/sdk';
import { config } from '../../config/index.js';
import {
  QueryIntent,
  QueryData,
  QueryEntities,
  VisualizationSpec,
  SuggestedAction,
} from './types.js';

// Initialize Anthropic client
const anthropic = config.anthropicApiKey
  ? new Anthropic({ apiKey: config.anthropicApiKey })
  : null;

/**
 * Generate AI summary for query results
 */
export async function generateSummary(
  intent: QueryIntent,
  data: QueryData,
  entities: QueryEntities
): Promise<string> {
  if (!anthropic) {
    return generateFallbackSummary(intent, data, entities);
  }

  const dataContext = JSON.stringify(data, null, 2);

  try {
    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 512,
      system: `You are a Customer Success AI assistant. Generate a concise, informative summary of the data provided. Be specific with numbers and metrics. Use a professional but friendly tone. Keep it to 2-4 sentences unless there's a lot of important information.`,
      messages: [
        {
          role: 'user',
          content: `Generate a summary for this ${intent} query.

Query entities: ${JSON.stringify(entities)}

Data:
${dataContext}

Provide a natural language summary that a CSM would find helpful.`,
        },
      ],
    });

    const content = response.content[0];
    if (content.type === 'text') {
      return content.text;
    }

    return generateFallbackSummary(intent, data, entities);
  } catch (error) {
    console.error('Summary generation error:', error);
    return generateFallbackSummary(intent, data, entities);
  }
}

/**
 * Generate fallback summary without AI
 */
function generateFallbackSummary(
  intent: QueryIntent,
  data: QueryData,
  entities: QueryEntities
): string {
  switch (intent) {
    case 'account_summary': {
      const c = data.customer;
      if (!c) return 'No customer data found.';

      const healthStatus =
        c.health_score >= 80 ? 'healthy' : c.health_score >= 60 ? 'moderate' : 'at risk';
      const riskCount = data.risk_signals?.length || 0;

      let summary = `${c.name} is a ${formatCurrency(c.arr)} ARR ${c.industry || 'company'} `;
      summary += `with a ${healthStatus} health score of ${c.health_score}.`;

      if (c.days_until_renewal && c.days_until_renewal > 0) {
        summary += ` Renewal is in ${c.days_until_renewal} days.`;
      }

      if (riskCount > 0) {
        summary += ` There ${riskCount === 1 ? 'is' : 'are'} ${riskCount} open risk signal${riskCount === 1 ? '' : 's'}.`;
      }

      return summary;
    }

    case 'account_list': {
      const customers = data.customers || [];
      if (customers.length === 0) return 'No accounts match your criteria.';

      const totalArr = customers.reduce((sum, c) => sum + c.arr, 0);
      const avgHealth = Math.round(
        customers.reduce((sum, c) => sum + c.health_score, 0) / customers.length
      );

      return `Found ${customers.length} accounts with total ARR of ${formatCurrency(totalArr)} and average health score of ${avgHealth}.`;
    }

    case 'metric_query': {
      const c = data.customer;
      const metrics = data.metrics;
      if (!c || !metrics) return 'No metrics data found.';

      const metricStrings = Object.entries(metrics)
        .map(([key, value]) => `${formatMetricName(key)}: ${formatMetricValue(key, value)}`)
        .join(', ');

      return `${c.name} - ${metricStrings}`;
    }

    case 'stakeholder_query': {
      const stakeholders = data.stakeholders || [];
      if (stakeholders.length === 0) return 'No stakeholders found for this account.';

      const primary = stakeholders.find(s => s.is_primary);
      const summary = primary
        ? `Primary contact is ${primary.name} (${primary.role}).`
        : `Found ${stakeholders.length} stakeholder${stakeholders.length === 1 ? '' : 's'}.`;

      return summary + ` Total of ${stakeholders.length} contacts on file.`;
    }

    case 'usage_query': {
      const usage = data.usage;
      if (!usage) return 'No usage data available.';

      const trendEmoji = usage.usage_trend === 'growing' ? '📈' : usage.usage_trend === 'declining' ? '📉' : '➡️';
      return `Usage is ${usage.usage_trend} ${trendEmoji}. DAU: ${usage.dau}, MAU: ${usage.mau}, Adoption Score: ${usage.adoption_score}/100.`;
    }

    case 'timeline_query': {
      const activities = data.recent_activity || [];
      if (activities.length === 0) return 'No recent activity found.';

      return `Found ${activities.length} activities in the selected time period. Most recent: ${activities[0]?.title || 'Unknown activity'}.`;
    }

    case 'comparison_query': {
      const comparison = data.comparison;
      if (!comparison || !comparison.accounts?.length) return 'No comparison data available.';

      const accounts = comparison.accounts;
      return `Comparing ${accounts.length} accounts: ${accounts.map(a => a.name).join(' vs ')}.`;
    }

    case 'aggregation_query': {
      const agg = data.aggregations;
      if (!agg) return 'No aggregation data available.';

      let summary = `Portfolio overview: ${agg.total_accounts} accounts, ${formatCurrency(agg.total_arr)} total ARR`;
      summary += `, average health ${agg.average_health_score}.`;

      if (agg.at_risk_count > 0) {
        summary += ` ${agg.at_risk_count} account${agg.at_risk_count === 1 ? '' : 's'} at risk.`;
      }

      return summary;
    }

    default:
      return 'Query completed successfully.';
  }
}

/**
 * Generate visualizations for query results
 */
export function generateVisualizations(
  intent: QueryIntent,
  data: QueryData
): VisualizationSpec[] {
  const visualizations: VisualizationSpec[] = [];

  switch (intent) {
    case 'account_summary': {
      if (data.customer) {
        // Health gauge
        visualizations.push({
          type: 'health_gauge',
          title: 'Health Score',
          data: {
            score: data.customer.health_score,
            status: data.customer.health_score >= 80 ? 'healthy' : data.customer.health_score >= 60 ? 'moderate' : 'at_risk',
          },
        });

        // Key metrics card
        visualizations.push({
          type: 'card',
          title: 'Key Metrics',
          data: {
            arr: data.customer.arr,
            renewal_date: data.customer.renewal_date,
            days_until_renewal: data.customer.days_until_renewal,
            industry: data.customer.industry,
          },
        });
      }

      // Risk signals list
      if (data.risk_signals?.length) {
        visualizations.push({
          type: 'list',
          title: 'Open Risk Signals',
          data: data.risk_signals.map(r => ({
            label: r.description,
            severity: r.severity,
            date: r.detected_at,
          })),
        });
      }
      break;
    }

    case 'account_list': {
      if (data.customers?.length) {
        visualizations.push({
          type: 'table',
          title: 'Accounts',
          data: data.customers,
          config: {
            columns: ['name', 'arr', 'health_score', 'industry', 'renewal_date'],
          },
        });
      }
      break;
    }

    case 'usage_query': {
      if (data.usage) {
        visualizations.push({
          type: 'card',
          title: 'Usage Metrics',
          data: {
            dau: data.usage.dau,
            wau: data.usage.wau,
            mau: data.usage.mau,
            adoption_score: data.usage.adoption_score,
            trend: data.usage.usage_trend,
          },
        });
      }
      break;
    }

    case 'comparison_query': {
      if (data.comparison) {
        visualizations.push({
          type: 'bar_chart',
          title: 'Account Comparison',
          data: data.comparison.metrics,
          config: {
            metrics: ['health_score', 'arr', 'adoption_score'],
          },
        });
      }
      break;
    }

    case 'aggregation_query': {
      if (data.aggregations) {
        visualizations.push({
          type: 'card',
          title: 'Portfolio Summary',
          data: {
            total_accounts: data.aggregations.total_accounts,
            total_arr: data.aggregations.total_arr,
            average_health: data.aggregations.average_health_score,
            at_risk: data.aggregations.at_risk_count,
            healthy: data.aggregations.healthy_count,
          },
        });
      }
      break;
    }
  }

  return visualizations;
}

/**
 * Generate suggested follow-up actions
 */
export function generateSuggestions(
  intent: QueryIntent,
  data: QueryData,
  entities: QueryEntities
): SuggestedAction[] {
  const suggestions: SuggestedAction[] = [];

  switch (intent) {
    case 'account_summary': {
      const customerName = data.customer?.name;
      if (customerName) {
        suggestions.push({
          label: 'View usage trends',
          query: `How is ${customerName} using the product?`,
          icon: '📈',
        });
        suggestions.push({
          label: 'See stakeholders',
          query: `Who are the key stakeholders at ${customerName}?`,
          icon: '👥',
        });
        suggestions.push({
          label: 'Recent activity',
          query: `What happened with ${customerName} last month?`,
          icon: '📅',
        });
      }
      break;
    }

    case 'account_list': {
      suggestions.push({
        label: 'Show at-risk accounts',
        query: 'Show me accounts with health score below 50',
        icon: '⚠️',
      });
      suggestions.push({
        label: 'Renewals this quarter',
        query: 'Which accounts are renewing in the next 90 days?',
        icon: '📆',
      });
      break;
    }

    case 'stakeholder_query': {
      const customerName = data.customer?.name;
      if (customerName) {
        suggestions.push({
          label: 'Account overview',
          query: `Tell me about ${customerName}`,
          icon: '🏢',
        });
        suggestions.push({
          label: 'Schedule meeting',
          query: `Help me schedule a meeting with ${customerName}`,
          icon: '📅',
        });
      }
      break;
    }

    case 'usage_query': {
      const customerName = data.customer?.name;
      if (customerName) {
        suggestions.push({
          label: 'Full account summary',
          query: `Tell me about ${customerName}`,
          icon: '📋',
        });
        if (data.usage?.usage_trend === 'declining') {
          suggestions.push({
            label: 'Check risk signals',
            query: `What are the risk signals for ${customerName}?`,
            icon: '⚠️',
          });
        }
      }
      break;
    }

    case 'aggregation_query': {
      suggestions.push({
        label: 'View at-risk accounts',
        query: 'Show me all at-risk accounts',
        icon: '🚨',
      });
      suggestions.push({
        label: 'Top accounts by ARR',
        query: 'Show me top 10 accounts by ARR',
        icon: '💰',
      });
      break;
    }
  }

  // Default suggestions
  if (suggestions.length === 0) {
    suggestions.push({
      label: 'Portfolio overview',
      query: 'What is the overall health of my portfolio?',
      icon: '📊',
    });
    suggestions.push({
      label: 'Accounts needing attention',
      query: 'What accounts need attention today?',
      icon: '🔔',
    });
  }

  return suggestions.slice(0, 4);
}

// Helper functions
function formatCurrency(amount: number): string {
  if (amount >= 1000000) {
    return `$${(amount / 1000000).toFixed(1)}M`;
  } else if (amount >= 1000) {
    return `$${(amount / 1000).toFixed(0)}K`;
  }
  return `$${amount}`;
}

function formatMetricName(key: string): string {
  const names: Record<string, string> = {
    health_score: 'Health Score',
    arr: 'ARR',
    renewal_date: 'Renewal Date',
    industry: 'Industry',
    stage: 'Stage',
  };
  return names[key] || key.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
}

function formatMetricValue(key: string, value: number | string): string {
  if (key === 'arr' && typeof value === 'number') {
    return formatCurrency(value);
  }
  return String(value);
}
