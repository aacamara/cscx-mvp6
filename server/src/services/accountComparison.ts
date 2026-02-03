/**
 * Account Comparison Service (PRD-058)
 *
 * Enables CSMs to compare 2-5 accounts side-by-side across key metrics,
 * behaviors, and outcomes. Includes AI-powered analysis of key differentiators
 * and actionable recommendations.
 */

import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { config } from '../config/index.js';
import { ClaudeService } from './claude.js';
import { v4 as uuidv4 } from 'uuid';

// Initialize Supabase client
let supabase: SupabaseClient | null = null;
if (config.supabaseUrl && config.supabaseServiceKey) {
  supabase = createClient(config.supabaseUrl, config.supabaseServiceKey);
}

// ============================================
// Types
// ============================================

export type ComparisonFocus = 'health' | 'usage' | 'engagement' | 'financial' | 'all';
export type ComparisonTimePeriod = 'current' | 'last_quarter' | 'last_year';

export interface ComparedAccount {
  id: string;
  name: string;
  arr: number;
  segment: string;
  industry: string;
  healthScore: number;
  stage: string;
  contractStart: string | null;
  contractEnd: string | null;
  csmName: string | null;
}

export interface MetricComparison {
  metric: string;
  values: MetricValue[];
  delta: string | number;
  deltaType: 'percentage' | 'absolute' | 'points';
  winner: string | null;
  importance: 'high' | 'medium' | 'low';
}

export interface MetricValue {
  accountId: string;
  accountName: string;
  value: number | string | boolean;
  displayValue: string;
  trend?: 'up' | 'down' | 'stable';
}

export interface KeyDifferentiator {
  factor: string;
  description: string;
  impact: 'high' | 'medium' | 'low';
  accounts: {
    accountId: string;
    accountName: string;
    performance: 'strong' | 'average' | 'weak';
    detail: string;
  }[];
}

export interface RecommendedAction {
  targetAccount: string;
  targetAccountId: string;
  action: string;
  priority: 'Immediate' | 'This Week' | 'This Month' | 'Ongoing';
  reason: string;
  expectedImpact: string;
}

export interface PatternToApply {
  pattern: string;
  sourceAccount: string;
  targetAccounts: string[];
  description: string;
}

export interface AccountComparisonResult {
  comparisonId: string;
  generatedAt: string;
  accounts: ComparedAccount[];
  comparisons: {
    financial: Record<string, MetricComparison>;
    health: Record<string, MetricComparison>;
    engagement: Record<string, MetricComparison>;
    usage: Record<string, MetricComparison>;
  };
  analysis: {
    headline: string;
    keyDifferentiators: KeyDifferentiator[];
    recommendedActions: RecommendedAction[];
    patternsToApply: PatternToApply[];
  };
  visualization: {
    radarChart: {
      dimensions: string[];
      datasets: { accountId: string; accountName: string; values: number[]; color: string }[];
    };
  };
  warnings: string[];
  focus: ComparisonFocus;
  timePeriod: ComparisonTimePeriod;
}

// ============================================
// Service Class
// ============================================

class AccountComparisonService {
  private claude: ClaudeService;
  private accountColors = ['#e63946', '#457b9d', '#2a9d8f', '#e9c46a', '#f4a261'];

  constructor() {
    this.claude = new ClaudeService();
  }

  /**
   * Main comparison method - compare 2-5 accounts
   */
  async compareAccounts(
    accountIds: string[],
    focus: ComparisonFocus = 'all',
    timePeriod: ComparisonTimePeriod = 'current'
  ): Promise<AccountComparisonResult> {
    // Validation
    if (accountIds.length < 2) {
      throw new Error('Please select at least 2 accounts to compare');
    }
    if (accountIds.length > 5) {
      throw new Error('Maximum 5 accounts can be compared at once');
    }

    // Fetch all account data in parallel
    const accountDataPromises = accountIds.map(id => this.fetchAccountData(id, timePeriod));
    const accountsData = await Promise.all(accountDataPromises);

    // Check for missing accounts
    const missingAccounts = accountIds.filter((id, idx) => !accountsData[idx]);
    if (missingAccounts.length > 0) {
      throw new Error(`Could not find accounts: ${missingAccounts.join(', ')}`);
    }

    // Build compared accounts summary
    const accounts: ComparedAccount[] = accountsData.map(data => ({
      id: data.customer.id,
      name: data.customer.name,
      arr: data.customer.arr || 0,
      segment: data.customer.segment || 'Unknown',
      industry: data.customer.industry || 'Unknown',
      healthScore: data.customer.health_score || 0,
      stage: data.customer.stage || 'active',
      contractStart: data.customer.contract_start || null,
      contractEnd: data.customer.contract_end || null,
      csmName: data.customer.csm_name || null
    }));

    // Generate warnings for different industries
    const warnings: string[] = [];
    const industries = new Set(accounts.map(a => a.industry).filter(i => i !== 'Unknown'));
    if (industries.size > 1) {
      warnings.push('Note: Accounts are from different industries. Some comparisons may not be meaningful.');
    }

    // Check for insufficient data
    accountsData.forEach(data => {
      if (!data.usageMetrics || data.usageMetrics.length === 0) {
        warnings.push(`Limited data available for ${data.customer.name}. Comparison may be incomplete.`);
      }
    });

    // Calculate all dimension comparisons
    const comparisons = {
      financial: this.calculateFinancialComparison(accountsData),
      health: this.calculateHealthComparison(accountsData),
      engagement: this.calculateEngagementComparison(accountsData),
      usage: this.calculateUsageComparison(accountsData)
    };

    // Generate AI analysis
    const analysis = await this.generateAIAnalysis(accounts, comparisons, focus);

    // Build visualization data
    const visualization = this.buildVisualizationData(accounts, comparisons);

    return {
      comparisonId: uuidv4(),
      generatedAt: new Date().toISOString(),
      accounts,
      comparisons,
      analysis,
      visualization,
      warnings,
      focus,
      timePeriod
    };
  }

  // ============================================
  // Data Fetching
  // ============================================

  private async fetchAccountData(accountId: string, timePeriod: ComparisonTimePeriod) {
    if (!supabase) {
      return this.generateMockAccountData(accountId);
    }

    const startDate = this.getStartDate(timePeriod);

    // Fetch all data in parallel
    const [
      customerResult,
      stakeholdersResult,
      meetingsResult,
      usageResult,
      activitiesResult,
      contractsResult
    ] = await Promise.all([
      supabase.from('customers').select('*').eq('id', accountId).single(),
      supabase.from('stakeholders').select('*').eq('customer_id', accountId),
      supabase.from('meetings').select('*').eq('customer_id', accountId).gte('scheduled_at', startDate.toISOString()),
      supabase.from('usage_metrics').select('*').eq('customer_id', accountId).gte('metric_date', startDate.toISOString()).order('metric_date', { ascending: false }),
      supabase.from('agent_activity_log').select('*').eq('customer_id', accountId).gte('started_at', startDate.toISOString()),
      supabase.from('contracts').select('*, entitlements(*)').eq('customer_id', accountId)
    ]);

    if (customerResult.error || !customerResult.data) {
      return null;
    }

    return {
      customer: customerResult.data,
      stakeholders: stakeholdersResult.data || [],
      meetings: meetingsResult.data || [],
      usageMetrics: usageResult.data || [],
      activities: activitiesResult.data || [],
      contracts: contractsResult.data || []
    };
  }

  private getStartDate(timePeriod: ComparisonTimePeriod): Date {
    const now = new Date();
    switch (timePeriod) {
      case 'last_quarter':
        return new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
      case 'last_year':
        return new Date(now.getTime() - 365 * 24 * 60 * 60 * 1000);
      case 'current':
      default:
        return new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    }
  }

  // ============================================
  // Financial Comparison
  // ============================================

  private calculateFinancialComparison(accountsData: any[]): Record<string, MetricComparison> {
    const comparisons: Record<string, MetricComparison> = {};

    // ARR Comparison
    comparisons.arr = this.createMetricComparison(
      'ARR',
      accountsData.map(d => ({
        accountId: d.customer.id,
        accountName: d.customer.name,
        value: d.customer.arr || 0,
        displayValue: this.formatCurrency(d.customer.arr || 0)
      })),
      'percentage',
      'high'
    );

    // Contract Length
    comparisons.contractLength = this.createMetricComparison(
      'Contract Length',
      accountsData.map(d => {
        const monthsRemaining = this.calculateMonthsRemaining(d.customer.contract_end);
        return {
          accountId: d.customer.id,
          accountName: d.customer.name,
          value: monthsRemaining,
          displayValue: `${monthsRemaining} months`
        };
      }),
      'absolute',
      'medium'
    );

    // Expansion Revenue (calculated from contracts/entitlements)
    comparisons.expansionRevenue = this.createMetricComparison(
      'Expansion Revenue',
      accountsData.map(d => {
        const expansion = this.calculateExpansionRevenue(d.contracts);
        return {
          accountId: d.customer.id,
          accountName: d.customer.name,
          value: expansion,
          displayValue: this.formatCurrency(expansion)
        };
      }),
      'percentage',
      'medium'
    );

    // LTV (simplified: ARR * contract years remaining)
    comparisons.ltv = this.createMetricComparison(
      'LTV',
      accountsData.map(d => {
        const yearsRemaining = this.calculateMonthsRemaining(d.customer.contract_end) / 12;
        const ltv = (d.customer.arr || 0) * Math.max(yearsRemaining, 1);
        return {
          accountId: d.customer.id,
          accountName: d.customer.name,
          value: ltv,
          displayValue: this.formatCurrency(ltv)
        };
      }),
      'percentage',
      'high'
    );

    // Revenue Growth (would need historical data, using placeholder)
    comparisons.revenueGrowth = this.createMetricComparison(
      'Revenue Growth',
      accountsData.map(d => ({
        accountId: d.customer.id,
        accountName: d.customer.name,
        value: d.customer.arr_growth_percent || 0,
        displayValue: `${d.customer.arr_growth_percent || 0}%`,
        trend: (d.customer.arr_growth_percent || 0) > 0 ? 'up' : (d.customer.arr_growth_percent || 0) < 0 ? 'down' : 'stable'
      })),
      'points',
      'high'
    );

    return comparisons;
  }

  // ============================================
  // Health Comparison
  // ============================================

  private calculateHealthComparison(accountsData: any[]): Record<string, MetricComparison> {
    const comparisons: Record<string, MetricComparison> = {};

    // Health Score
    comparisons.healthScore = this.createMetricComparison(
      'Health Score',
      accountsData.map(d => ({
        accountId: d.customer.id,
        accountName: d.customer.name,
        value: d.customer.health_score || 0,
        displayValue: `${d.customer.health_score || 0}/100`,
        trend: this.calculateTrend(d.usageMetrics, 'health_score')
      })),
      'points',
      'high'
    );

    // Usage Score
    comparisons.usageScore = this.createMetricComparison(
      'Usage Score',
      accountsData.map(d => {
        const score = this.calculateUsageScore(d.usageMetrics);
        return {
          accountId: d.customer.id,
          accountName: d.customer.name,
          value: score,
          displayValue: `${score}/100`
        };
      }),
      'points',
      'high'
    );

    // Engagement Score
    comparisons.engagementScore = this.createMetricComparison(
      'Engagement Score',
      accountsData.map(d => {
        const score = this.calculateEngagementScore(d.meetings, d.activities);
        return {
          accountId: d.customer.id,
          accountName: d.customer.name,
          value: score,
          displayValue: `${score}/100`
        };
      }),
      'points',
      'medium'
    );

    // Sentiment Score
    comparisons.sentimentScore = this.createMetricComparison(
      'Sentiment Score',
      accountsData.map(d => {
        const score = this.calculateSentimentScore(d.activities, d.stakeholders);
        return {
          accountId: d.customer.id,
          accountName: d.customer.name,
          value: score,
          displayValue: `${score}/100`
        };
      }),
      'points',
      'medium'
    );

    // Risk Signal Count
    comparisons.riskSignalCount = this.createMetricComparison(
      'Risk Signals',
      accountsData.map(d => {
        const count = this.countRiskSignals(d.customer, d.activities);
        return {
          accountId: d.customer.id,
          accountName: d.customer.name,
          value: count,
          displayValue: count.toString()
        };
      }),
      'absolute',
      'high',
      true // Lower is better
    );

    return comparisons;
  }

  // ============================================
  // Engagement Comparison
  // ============================================

  private calculateEngagementComparison(accountsData: any[]): Record<string, MetricComparison> {
    const comparisons: Record<string, MetricComparison> = {};

    // Stakeholder Count
    comparisons.stakeholderCount = this.createMetricComparison(
      'Stakeholders',
      accountsData.map(d => ({
        accountId: d.customer.id,
        accountName: d.customer.name,
        value: d.stakeholders.length,
        displayValue: d.stakeholders.length.toString()
      })),
      'absolute',
      'medium'
    );

    // Champion Strength
    comparisons.championStrength = this.createMetricComparison(
      'Champion Strength',
      accountsData.map(d => {
        const strength = this.calculateChampionStrength(d.stakeholders, d.activities);
        return {
          accountId: d.customer.id,
          accountName: d.customer.name,
          value: strength,
          displayValue: `${strength}/100`
        };
      }),
      'points',
      'high'
    );

    // Executive Sponsor
    comparisons.execSponsor = this.createMetricComparison(
      'Exec Sponsor',
      accountsData.map(d => {
        const hasExec = this.hasExecutiveSponsor(d.stakeholders);
        return {
          accountId: d.customer.id,
          accountName: d.customer.name,
          value: hasExec,
          displayValue: hasExec ? 'Yes' : 'No'
        };
      }),
      'absolute',
      'high'
    );

    // Meeting Frequency
    comparisons.meetingFrequency = this.createMetricComparison(
      'Meetings/Month',
      accountsData.map(d => {
        const freq = d.meetings.length;
        return {
          accountId: d.customer.id,
          accountName: d.customer.name,
          value: freq,
          displayValue: freq.toString()
        };
      }),
      'absolute',
      'medium'
    );

    // Last Contact
    comparisons.lastContact = this.createMetricComparison(
      'Last Contact',
      accountsData.map(d => {
        const days = this.daysSinceLastContact(d.activities, d.meetings);
        return {
          accountId: d.customer.id,
          accountName: d.customer.name,
          value: days,
          displayValue: `${days} days`
        };
      }),
      'absolute',
      'medium',
      true // Lower is better
    );

    // Response Time
    comparisons.responseTime = this.createMetricComparison(
      'Avg Response Time',
      accountsData.map(d => {
        const hours = this.calculateAvgResponseTime(d.activities);
        return {
          accountId: d.customer.id,
          accountName: d.customer.name,
          value: hours,
          displayValue: `${hours}h`
        };
      }),
      'absolute',
      'low',
      true // Lower is better
    );

    return comparisons;
  }

  // ============================================
  // Usage Comparison
  // ============================================

  private calculateUsageComparison(accountsData: any[]): Record<string, MetricComparison> {
    const comparisons: Record<string, MetricComparison> = {};

    // DAU/MAU
    comparisons.dauMau = this.createMetricComparison(
      'MAU',
      accountsData.map(d => {
        const mau = this.calculateMAU(d.usageMetrics);
        return {
          accountId: d.customer.id,
          accountName: d.customer.name,
          value: mau,
          displayValue: mau.toString()
        };
      }),
      'percentage',
      'high'
    );

    // Feature Adoption
    comparisons.featureAdoption = this.createMetricComparison(
      'Feature Adoption',
      accountsData.map(d => {
        const adoption = this.calculateFeatureAdoption(d.usageMetrics, d.contracts);
        return {
          accountId: d.customer.id,
          accountName: d.customer.name,
          value: adoption,
          displayValue: `${adoption}%`
        };
      }),
      'points',
      'high'
    );

    // API Usage
    comparisons.apiUsage = this.createMetricComparison(
      'API Calls/Day',
      accountsData.map(d => {
        const calls = this.calculateApiUsage(d.usageMetrics);
        return {
          accountId: d.customer.id,
          accountName: d.customer.name,
          value: calls,
          displayValue: calls.toLocaleString()
        };
      }),
      'percentage',
      'medium'
    );

    // Login Frequency
    comparisons.loginFrequency = this.createMetricComparison(
      'Logins/User/Week',
      accountsData.map(d => {
        const freq = this.calculateLoginFrequency(d.usageMetrics);
        return {
          accountId: d.customer.id,
          accountName: d.customer.name,
          value: freq,
          displayValue: freq.toFixed(1)
        };
      }),
      'percentage',
      'medium'
    );

    // Usage Trend
    comparisons.usageTrend = this.createMetricComparison(
      'Usage Trend',
      accountsData.map(d => {
        const trend = this.calculateUsageTrendPercent(d.usageMetrics);
        return {
          accountId: d.customer.id,
          accountName: d.customer.name,
          value: trend,
          displayValue: `${trend > 0 ? '+' : ''}${trend}%`,
          trend: trend > 0 ? 'up' : trend < 0 ? 'down' : 'stable'
        };
      }),
      'points',
      'high'
    );

    return comparisons;
  }

  // ============================================
  // AI Analysis Generation
  // ============================================

  private async generateAIAnalysis(
    accounts: ComparedAccount[],
    comparisons: any,
    focus: ComparisonFocus
  ): Promise<{
    headline: string;
    keyDifferentiators: KeyDifferentiator[];
    recommendedActions: RecommendedAction[];
    patternsToApply: PatternToApply[];
  }> {
    const systemPrompt = `You are a Customer Success AI analyst specializing in account comparison and pattern recognition.
Your goal is to identify why some accounts outperform others and provide actionable recommendations.

When analyzing accounts:
1. Focus on the most impactful differentiators
2. Be specific about what can be learned from successful accounts
3. Provide concrete, actionable recommendations
4. Identify patterns that can be applied across accounts`;

    const accountSummary = accounts.map(a => ({
      name: a.name,
      arr: a.arr,
      healthScore: a.healthScore,
      industry: a.industry,
      segment: a.segment
    }));

    const comparisonSummary = this.summarizeComparisons(comparisons);

    const prompt = `Analyze these ${accounts.length} customer accounts and explain the key differences:

ACCOUNTS:
${JSON.stringify(accountSummary, null, 2)}

COMPARISON METRICS:
${JSON.stringify(comparisonSummary, null, 2)}

${focus !== 'all' ? `Focus Area: ${focus}` : ''}

Provide your analysis as a JSON object with this exact structure:
{
  "headline": "One sentence explaining why the top performer is outperforming others",
  "keyDifferentiators": [
    {
      "factor": "Name of the differentiating factor",
      "description": "Explanation of this factor",
      "impact": "high|medium|low",
      "accounts": [
        {
          "accountId": "account ID",
          "accountName": "Account Name",
          "performance": "strong|average|weak",
          "detail": "Specific detail about this account's performance"
        }
      ]
    }
  ],
  "recommendedActions": [
    {
      "targetAccount": "Account name needing action",
      "targetAccountId": "Account ID",
      "action": "Specific action to take",
      "priority": "Immediate|This Week|This Month|Ongoing",
      "reason": "Why this action matters",
      "expectedImpact": "What improvement to expect"
    }
  ],
  "patternsToApply": [
    {
      "pattern": "Name of the pattern",
      "sourceAccount": "Account to learn from",
      "targetAccounts": ["Account names to apply this to"],
      "description": "How to apply this pattern"
    }
  ]
}

Return ONLY the JSON object, no markdown formatting.`;

    try {
      const response = await this.claude.generate(prompt, systemPrompt);

      let jsonString = response.trim();
      if (jsonString.startsWith('```')) {
        jsonString = jsonString.replace(/```json?\n?/g, '').replace(/```/g, '');
      }

      const parsed = JSON.parse(jsonString);

      return {
        headline: parsed.headline || this.generateFallbackHeadline(accounts, comparisons),
        keyDifferentiators: parsed.keyDifferentiators || [],
        recommendedActions: parsed.recommendedActions || [],
        patternsToApply: parsed.patternsToApply || []
      };
    } catch (error) {
      console.error('Error generating AI analysis:', error);
      return this.generateFallbackAnalysis(accounts, comparisons);
    }
  }

  private summarizeComparisons(comparisons: any): Record<string, any> {
    const summary: Record<string, any> = {};

    Object.entries(comparisons).forEach(([dimension, metrics]) => {
      summary[dimension] = {};
      Object.entries(metrics as Record<string, MetricComparison>).forEach(([metric, data]) => {
        summary[dimension][metric] = {
          winner: data.winner,
          delta: data.delta,
          values: data.values.map((v: MetricValue) => ({
            account: v.accountName,
            value: v.displayValue
          }))
        };
      });
    });

    return summary;
  }

  private generateFallbackHeadline(accounts: ComparedAccount[], comparisons: any): string {
    const sorted = [...accounts].sort((a, b) => b.healthScore - a.healthScore);
    const best = sorted[0];
    const worst = sorted[sorted.length - 1];

    if (best.healthScore - worst.healthScore > 20) {
      return `${best.name} is outperforming ${worst.name} primarily due to higher engagement and feature adoption.`;
    }
    return `Comparing ${accounts.length} accounts reveals opportunities for cross-pollination of best practices.`;
  }

  private generateFallbackAnalysis(accounts: ComparedAccount[], comparisons: any) {
    const sorted = [...accounts].sort((a, b) => b.healthScore - a.healthScore);
    const best = sorted[0];
    const needsWork = sorted.filter(a => a.healthScore < 70);

    return {
      headline: this.generateFallbackHeadline(accounts, comparisons),
      keyDifferentiators: [
        {
          factor: 'Health Score Gap',
          description: 'Significant variation in overall account health',
          impact: 'high' as const,
          accounts: accounts.map(a => ({
            accountId: a.id,
            accountName: a.name,
            performance: a.healthScore >= 80 ? 'strong' as const : a.healthScore >= 60 ? 'average' as const : 'weak' as const,
            detail: `Health score: ${a.healthScore}/100`
          }))
        }
      ],
      recommendedActions: needsWork.map(account => ({
        targetAccount: account.name,
        targetAccountId: account.id,
        action: 'Schedule executive business review to understand challenges',
        priority: 'This Week' as const,
        reason: `Health score of ${account.healthScore} is below target`,
        expectedImpact: 'Identify and address root causes of underperformance'
      })),
      patternsToApply: best ? [{
        pattern: 'Engagement Model',
        sourceAccount: best.name,
        targetAccounts: needsWork.map(a => a.name),
        description: `Apply ${best.name}'s engagement cadence to underperforming accounts`
      }] : []
    };
  }

  // ============================================
  // Visualization Data
  // ============================================

  private buildVisualizationData(accounts: ComparedAccount[], comparisons: any) {
    const dimensions = ['Health', 'Usage', 'Engagement', 'Sentiment', 'Growth'];

    const datasets = accounts.map((account, idx) => {
      const health = comparisons.health.healthScore.values.find((v: MetricValue) => v.accountId === account.id)?.value || 0;
      const usage = comparisons.usage.featureAdoption.values.find((v: MetricValue) => v.accountId === account.id)?.value || 0;
      const engagement = comparisons.health.engagementScore.values.find((v: MetricValue) => v.accountId === account.id)?.value || 0;
      const sentiment = comparisons.health.sentimentScore.values.find((v: MetricValue) => v.accountId === account.id)?.value || 0;
      const growth = Math.max(0, Math.min(100, 50 + (comparisons.usage.usageTrend.values.find((v: MetricValue) => v.accountId === account.id)?.value || 0)));

      return {
        accountId: account.id,
        accountName: account.name,
        values: [health, usage, engagement, sentiment, growth],
        color: this.accountColors[idx % this.accountColors.length]
      };
    });

    return {
      radarChart: {
        dimensions,
        datasets
      }
    };
  }

  // ============================================
  // Helper Methods
  // ============================================

  private createMetricComparison(
    metric: string,
    values: MetricValue[],
    deltaType: 'percentage' | 'absolute' | 'points',
    importance: 'high' | 'medium' | 'low',
    lowerIsBetter = false
  ): MetricComparison {
    const numericValues = values.map(v => typeof v.value === 'number' ? v.value : 0);
    const maxVal = Math.max(...numericValues);
    const minVal = Math.min(...numericValues);

    let delta: string | number;
    if (deltaType === 'percentage' && minVal !== 0) {
      delta = `${Math.round(((maxVal - minVal) / minVal) * 100)}%`;
    } else if (deltaType === 'points') {
      delta = `${maxVal - minVal}pp`;
    } else {
      delta = maxVal - minVal;
    }

    const winnerIdx = lowerIsBetter ? numericValues.indexOf(minVal) : numericValues.indexOf(maxVal);
    const winner = values[winnerIdx]?.accountName || null;

    return {
      metric,
      values,
      delta,
      deltaType,
      winner,
      importance
    };
  }

  private formatCurrency(amount: number): string {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(amount);
  }

  private calculateMonthsRemaining(contractEnd: string | null): number {
    if (!contractEnd) return 0;
    const end = new Date(contractEnd);
    const now = new Date();
    const months = (end.getFullYear() - now.getFullYear()) * 12 + (end.getMonth() - now.getMonth());
    return Math.max(0, months);
  }

  private calculateExpansionRevenue(contracts: any[]): number {
    let expansion = 0;
    contracts.forEach(contract => {
      if (contract.expansion_revenue) {
        expansion += contract.expansion_revenue;
      }
      if (contract.entitlements) {
        contract.entitlements.forEach((e: any) => {
          if (e.expansion_value) {
            expansion += e.expansion_value;
          }
        });
      }
    });
    return expansion;
  }

  private calculateUsageScore(usageMetrics: any[]): number {
    if (!usageMetrics || usageMetrics.length === 0) return 50;

    const recent = usageMetrics.slice(0, 30);
    const avgDau = recent.reduce((sum, m) => sum + (m.dau || 0), 0) / recent.length;
    const avgMau = recent.reduce((sum, m) => sum + (m.mau || 0), 0) / recent.length;

    // Simplified scoring: based on DAU/MAU ratio and absolute values
    const dauMauRatio = avgMau > 0 ? avgDau / avgMau : 0;
    return Math.min(100, Math.round(dauMauRatio * 100 + 30));
  }

  private calculateEngagementScore(meetings: any[], activities: any[]): number {
    const meetingScore = Math.min(40, meetings.length * 10);
    const activityScore = Math.min(40, activities.length * 2);
    return Math.min(100, meetingScore + activityScore + 20);
  }

  private calculateSentimentScore(activities: any[], stakeholders: any[]): number {
    let positive = 0;
    let negative = 0;

    activities.forEach(a => {
      if (a.result_data?.sentiment === 'positive') positive++;
      if (a.result_data?.sentiment === 'negative') negative++;
    });

    stakeholders.forEach(s => {
      if (s.metadata?.sentiment === 'Positive') positive++;
      if (s.metadata?.sentiment === 'Negative') negative++;
    });

    const total = positive + negative || 1;
    return Math.round((positive / total) * 100) || 70;
  }

  private countRiskSignals(customer: any, activities: any[]): number {
    let count = 0;

    if ((customer.health_score || 0) < 60) count++;
    if (customer.contract_end) {
      const daysUntil = (new Date(customer.contract_end).getTime() - Date.now()) / (1000 * 60 * 60 * 24);
      if (daysUntil <= 30) count++;
    }

    activities.forEach(a => {
      if (a.action_type?.includes('escalation') || a.result_data?.escalated) count++;
    });

    return count;
  }

  private calculateChampionStrength(stakeholders: any[], activities: any[]): number {
    const champions = stakeholders.filter(s =>
      s.role?.toLowerCase().includes('champion') ||
      s.title?.toLowerCase().includes('champion') ||
      s.metadata?.is_champion
    );

    if (champions.length === 0) return 30;

    // Score based on champion engagement
    let engagementScore = 0;
    champions.forEach(champion => {
      const championActivities = activities.filter(a =>
        a.action_data?.stakeholder === champion.name ||
        a.action_data?.email === champion.email
      );
      engagementScore += Math.min(30, championActivities.length * 10);
    });

    return Math.min(100, 40 + engagementScore);
  }

  private hasExecutiveSponsor(stakeholders: any[]): boolean {
    return stakeholders.some(s => {
      const title = (s.title || s.role || '').toLowerCase();
      return title.includes('ceo') ||
             title.includes('cto') ||
             title.includes('cfo') ||
             title.includes('vp') ||
             title.includes('director') ||
             title.includes('chief') ||
             title.includes('executive');
    });
  }

  private daysSinceLastContact(activities: any[], meetings: any[]): number {
    let lastDate: Date | null = null;

    activities.forEach(a => {
      const date = new Date(a.started_at);
      if (!lastDate || date > lastDate) lastDate = date;
    });

    meetings.forEach(m => {
      const date = new Date(m.scheduled_at);
      if (!lastDate || date > lastDate) lastDate = date;
    });

    if (!lastDate) return 30;

    return Math.floor((Date.now() - lastDate.getTime()) / (1000 * 60 * 60 * 24));
  }

  private calculateAvgResponseTime(activities: any[]): number {
    const responseTimes = activities
      .filter(a => a.result_data?.response_time_hours)
      .map(a => a.result_data.response_time_hours);

    if (responseTimes.length === 0) return 24;

    return Math.round(responseTimes.reduce((a, b) => a + b, 0) / responseTimes.length);
  }

  private calculateMAU(usageMetrics: any[]): number {
    if (!usageMetrics || usageMetrics.length === 0) return 0;
    const recent = usageMetrics.slice(0, 30);
    return Math.round(recent.reduce((sum, m) => sum + (m.mau || 0), 0) / recent.length);
  }

  private calculateFeatureAdoption(usageMetrics: any[], contracts: any[]): number {
    if (!usageMetrics || usageMetrics.length === 0) return 35;

    const recent = usageMetrics[0];
    if (recent?.feature_adoption_percent) {
      return recent.feature_adoption_percent;
    }

    // Estimate based on features used
    const featuresUsed = recent?.features_used || 3;
    const totalFeatures = 10; // Assume 10 features available
    return Math.round((featuresUsed / totalFeatures) * 100);
  }

  private calculateApiUsage(usageMetrics: any[]): number {
    if (!usageMetrics || usageMetrics.length === 0) return 0;
    const recent = usageMetrics.slice(0, 7);
    return Math.round(recent.reduce((sum, m) => sum + (m.api_calls || 0), 0) / recent.length);
  }

  private calculateLoginFrequency(usageMetrics: any[]): number {
    if (!usageMetrics || usageMetrics.length === 0) return 0;
    const recent = usageMetrics.slice(0, 7);
    const totalLogins = recent.reduce((sum, m) => sum + (m.login_count || 0), 0);
    const avgUsers = recent.reduce((sum, m) => sum + (m.mau || 1), 0) / recent.length;
    return Math.round((totalLogins / avgUsers) * 10) / 10;
  }

  private calculateUsageTrendPercent(usageMetrics: any[]): number {
    if (!usageMetrics || usageMetrics.length < 14) return 0;

    const firstHalf = usageMetrics.slice(7, 14);
    const secondHalf = usageMetrics.slice(0, 7);

    const firstAvg = firstHalf.reduce((sum, m) => sum + (m.dau || 0), 0) / firstHalf.length;
    const secondAvg = secondHalf.reduce((sum, m) => sum + (m.dau || 0), 0) / secondHalf.length;

    if (firstAvg === 0) return 0;
    return Math.round(((secondAvg - firstAvg) / firstAvg) * 100);
  }

  private calculateTrend(usageMetrics: any[], field: string): 'up' | 'down' | 'stable' {
    if (!usageMetrics || usageMetrics.length < 7) return 'stable';

    const recent = usageMetrics.slice(0, 7);
    const previous = usageMetrics.slice(7, 14);

    if (previous.length === 0) return 'stable';

    const recentAvg = recent.reduce((sum, m) => sum + (m[field] || 0), 0) / recent.length;
    const prevAvg = previous.reduce((sum, m) => sum + (m[field] || 0), 0) / previous.length;

    if (recentAvg > prevAvg * 1.05) return 'up';
    if (recentAvg < prevAvg * 0.95) return 'down';
    return 'stable';
  }

  // ============================================
  // Mock Data Generator
  // ============================================

  private generateMockAccountData(accountId: string) {
    const names = ['Acme Corp', 'Beta Industries', 'Gamma Tech', 'Delta Solutions', 'Epsilon Systems'];
    const index = parseInt(accountId.slice(-1), 16) % names.length;
    const baseHealth = 50 + (index * 10);

    return {
      customer: {
        id: accountId,
        name: names[index],
        arr: 100000 + (index * 50000),
        segment: index % 2 === 0 ? 'Enterprise' : 'Mid-Market',
        industry: 'SaaS',
        health_score: baseHealth + Math.floor(Math.random() * 20),
        stage: 'active',
        contract_start: '2025-01-01',
        contract_end: '2026-12-31',
        csm_name: 'Demo CSM',
        arr_growth_percent: -5 + (index * 5)
      },
      stakeholders: Array.from({ length: 2 + index }, (_, i) => ({
        id: `stakeholder-${i}`,
        name: `Contact ${i + 1}`,
        title: i === 0 ? 'VP Engineering' : 'Manager',
        email: `contact${i + 1}@${names[index].toLowerCase().replace(' ', '')}.com`,
        metadata: { sentiment: i % 2 === 0 ? 'Positive' : 'Neutral' }
      })),
      meetings: Array.from({ length: Math.max(1, index) }, (_, i) => ({
        id: `meeting-${i}`,
        title: 'Customer Meeting',
        scheduled_at: new Date(Date.now() - i * 7 * 24 * 60 * 60 * 1000).toISOString()
      })),
      usageMetrics: Array.from({ length: 30 }, (_, i) => ({
        metric_date: new Date(Date.now() - i * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
        dau: 20 + (index * 10) + Math.floor(Math.random() * 10),
        mau: 100 + (index * 30) + Math.floor(Math.random() * 20),
        login_count: 50 + (index * 20),
        api_calls: 1000 + (index * 500),
        features_used: 3 + index
      })),
      activities: Array.from({ length: 5 + index * 2 }, (_, i) => ({
        id: `activity-${i}`,
        action_type: i % 3 === 0 ? 'send_email' : 'health_check',
        started_at: new Date(Date.now() - i * 3 * 24 * 60 * 60 * 1000).toISOString(),
        result_data: { sentiment: i % 2 === 0 ? 'positive' : 'neutral' }
      })),
      contracts: [{
        id: `contract-${accountId}`,
        expansion_revenue: index * 10000,
        entitlements: []
      }]
    };
  }
}

export const accountComparisonService = new AccountComparisonService();
