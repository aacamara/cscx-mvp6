/**
 * Account Briefing Service (PRD-056)
 *
 * Aggregates customer data from multiple sources to generate
 * a comprehensive 360-degree account briefing for CSMs.
 */

import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { config } from '../config/index.js';
import { ClaudeService } from './claude.js';

// Initialize Supabase client
let supabase: SupabaseClient | null = null;
if (config.supabaseUrl && config.supabaseServiceKey) {
  supabase = createClient(config.supabaseUrl, config.supabaseServiceKey);
}

// Types
export interface QuickStats {
  arr: number;
  arrTrend: string; // 'Growing', 'Stable', 'Declining'
  arrChangePercent: number;
  healthScore: number;
  healthTrend: string;
  stage: string;
  renewalDate: string | null;
  daysUntilRenewal: number | null;
  csmName: string | null;
}

export interface KeyStakeholder {
  name: string;
  role: string;
  email: string | null;
  sentiment: 'Positive' | 'Neutral' | 'Negative' | 'Unknown';
  lastContact: string | null;
}

export interface HealthIndicator {
  name: string;
  score: number;
  maxScore: number;
  explanation: string;
}

export interface RiskSignal {
  type: string;
  severity: 'High' | 'Medium' | 'Low';
  description: string;
  detectedAt: string;
}

export interface RecentActivity {
  date: string;
  type: string;
  description: string;
}

export interface ExpansionOpportunity {
  name: string;
  potential: number;
  stage: string;
  probability: number;
}

export interface RecommendedAction {
  action: string;
  priority: 'High' | 'Medium' | 'Low';
  reason: string;
}

export interface AccountBriefing {
  customerId: string;
  accountName: string;
  generatedAt: string;
  quickStats: QuickStats;
  executiveSummary: string;
  keyStakeholders: KeyStakeholder[];
  healthIndicators: HealthIndicator[];
  activeRiskSignals: RiskSignal[];
  recentActivity: RecentActivity[];
  expansionOpportunities: ExpansionOpportunity[];
  recommendedActions: RecommendedAction[];
  dataCompleteness: number; // Percentage of sections with data
}

export interface AccountSearchResult {
  id: string;
  name: string;
  arr: number;
  healthScore: number;
  stage: string;
  matchScore: number;
}

class AccountBriefingService {
  private claude: ClaudeService;

  constructor() {
    this.claude = new ClaudeService();
  }

  /**
   * Search for accounts by name with fuzzy matching
   */
  async searchAccounts(query: string): Promise<AccountSearchResult[]> {
    if (!supabase) {
      return [];
    }

    // Use ilike for fuzzy matching
    const { data, error } = await supabase
      .from('customers')
      .select('id, name, arr, health_score, stage')
      .or(`name.ilike.%${query}%,domain.ilike.%${query}%`)
      .limit(10);

    if (error) {
      console.error('Error searching accounts:', error);
      return [];
    }

    // Calculate match score based on query similarity
    return (data || []).map(customer => {
      const nameLower = customer.name.toLowerCase();
      const queryLower = query.toLowerCase();

      // Calculate simple match score
      let matchScore = 0;
      if (nameLower === queryLower) {
        matchScore = 100;
      } else if (nameLower.startsWith(queryLower)) {
        matchScore = 90;
      } else if (nameLower.includes(queryLower)) {
        matchScore = 70;
      } else {
        // Levenshtein-like scoring for typos
        const overlap = queryLower.split('').filter(c => nameLower.includes(c)).length;
        matchScore = Math.round((overlap / query.length) * 50);
      }

      return {
        id: customer.id,
        name: customer.name,
        arr: customer.arr || 0,
        healthScore: customer.health_score || 0,
        stage: customer.stage || 'unknown',
        matchScore
      };
    }).sort((a, b) => b.matchScore - a.matchScore);
  }

  /**
   * Generate comprehensive account briefing
   */
  async generateBriefing(customerId: string, focusArea?: string, timePeriod?: string): Promise<AccountBriefing | null> {
    if (!supabase) {
      return this.generateMockBriefing(customerId);
    }

    // Fetch all data in parallel for performance
    const [
      customerData,
      stakeholders,
      contracts,
      meetings,
      activities,
      insights,
      healthHistory
    ] = await Promise.all([
      this.fetchCustomerData(customerId),
      this.fetchStakeholders(customerId),
      this.fetchContracts(customerId),
      this.fetchMeetings(customerId, timePeriod),
      this.fetchActivities(customerId, timePeriod),
      this.fetchInsights(customerId),
      this.fetchHealthHistory(customerId)
    ]);

    if (!customerData) {
      return null;
    }

    // Calculate health indicators
    const healthIndicators = this.calculateHealthIndicators(customerData, activities, meetings);

    // Detect risk signals
    const riskSignals = this.detectRiskSignals(customerData, healthHistory, activities);

    // Format recent activity
    const recentActivity = this.formatRecentActivity(activities, meetings);

    // Identify expansion opportunities
    const expansionOpportunities = this.identifyExpansionOpportunities(contracts, customerData);

    // Calculate data completeness
    const dataCompleteness = this.calculateDataCompleteness({
      customerData,
      stakeholders,
      contracts,
      meetings,
      activities,
      healthHistory
    });

    // Generate AI summary and recommendations
    const { summary, actions } = await this.generateAISummary(
      customerData,
      stakeholders,
      healthIndicators,
      riskSignals,
      recentActivity,
      expansionOpportunities,
      focusArea
    );

    // Build quick stats
    const quickStats = this.buildQuickStats(customerData, healthHistory);

    // Format stakeholders with sentiment
    const keyStakeholders = this.formatStakeholders(stakeholders, activities);

    return {
      customerId,
      accountName: customerData.name,
      generatedAt: new Date().toISOString(),
      quickStats,
      executiveSummary: summary,
      keyStakeholders,
      healthIndicators,
      activeRiskSignals: riskSignals,
      recentActivity: recentActivity.slice(0, 10),
      expansionOpportunities,
      recommendedActions: actions,
      dataCompleteness
    };
  }

  // Private helper methods

  private async fetchCustomerData(customerId: string) {
    if (!supabase) return null;

    const { data, error } = await supabase
      .from('customers')
      .select('*')
      .eq('id', customerId)
      .single();

    if (error) {
      console.error('Error fetching customer:', error);
      return null;
    }

    return data;
  }

  private async fetchStakeholders(customerId: string) {
    if (!supabase) return [];

    const { data, error } = await supabase
      .from('stakeholders')
      .select('*')
      .eq('customer_id', customerId);

    if (error) {
      console.error('Error fetching stakeholders:', error);
      return [];
    }

    return data || [];
  }

  private async fetchContracts(customerId: string) {
    if (!supabase) return [];

    const { data, error } = await supabase
      .from('contracts')
      .select('*, entitlements(*)')
      .eq('customer_id', customerId);

    if (error) {
      console.error('Error fetching contracts:', error);
      return [];
    }

    return data || [];
  }

  private async fetchMeetings(customerId: string, timePeriod?: string) {
    if (!supabase) return [];

    let query = supabase
      .from('meetings')
      .select('*')
      .eq('customer_id', customerId)
      .order('scheduled_at', { ascending: false });

    // Apply time period filter
    if (timePeriod) {
      const startDate = this.parseTimePeriod(timePeriod);
      if (startDate) {
        query = query.gte('scheduled_at', startDate.toISOString());
      }
    } else {
      // Default to last 30 days
      const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
      query = query.gte('scheduled_at', thirtyDaysAgo.toISOString());
    }

    const { data, error } = await query.limit(20);

    if (error) {
      console.error('Error fetching meetings:', error);
      return [];
    }

    return data || [];
  }

  private async fetchActivities(customerId: string, timePeriod?: string) {
    if (!supabase) return [];

    let query = supabase
      .from('agent_activity_log')
      .select('*')
      .eq('customer_id', customerId)
      .order('started_at', { ascending: false });

    if (timePeriod) {
      const startDate = this.parseTimePeriod(timePeriod);
      if (startDate) {
        query = query.gte('started_at', startDate.toISOString());
      }
    } else {
      const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
      query = query.gte('started_at', thirtyDaysAgo.toISOString());
    }

    const { data, error } = await query.limit(50);

    if (error) {
      console.error('Error fetching activities:', error);
      return [];
    }

    return data || [];
  }

  private async fetchInsights(customerId: string) {
    if (!supabase) return [];

    const { data, error } = await supabase
      .from('insights')
      .select('*')
      .eq('customer_id', customerId)
      .eq('acknowledged', false)
      .order('created_at', { ascending: false })
      .limit(10);

    if (error) {
      console.error('Error fetching insights:', error);
      return [];
    }

    return data || [];
  }

  private async fetchHealthHistory(customerId: string) {
    if (!supabase) return [];

    // Try to fetch from health_score_history if it exists
    const { data, error } = await supabase
      .from('customers')
      .select('health_score, updated_at')
      .eq('id', customerId)
      .order('updated_at', { ascending: false })
      .limit(30);

    if (error) {
      console.error('Error fetching health history:', error);
      return [];
    }

    return data || [];
  }

  private parseTimePeriod(period: string): Date | null {
    const now = new Date();
    const lower = period.toLowerCase();

    if (lower.includes('30 day') || lower.includes('month')) {
      return new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    } else if (lower.includes('quarter') || lower.includes('90 day')) {
      return new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
    } else if (lower.includes('week') || lower.includes('7 day')) {
      return new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    } else if (lower.includes('year')) {
      return new Date(now.getTime() - 365 * 24 * 60 * 60 * 1000);
    }

    return null;
  }

  private buildQuickStats(customer: any, healthHistory: any[]): QuickStats {
    const now = new Date();
    const renewalDate = customer.contract_end ? new Date(customer.contract_end) : null;
    const daysUntilRenewal = renewalDate
      ? Math.ceil((renewalDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
      : null;

    // Calculate health trend from history
    let healthTrend = 'Stable';
    if (healthHistory.length > 1) {
      const currentHealth = customer.health_score || 0;
      const prevHealth = healthHistory[healthHistory.length - 1]?.health_score || currentHealth;
      if (currentHealth > prevHealth + 5) {
        healthTrend = 'Growing';
      } else if (currentHealth < prevHealth - 5) {
        healthTrend = 'Declining';
      }
    }

    return {
      arr: customer.arr || 0,
      arrTrend: 'Stable', // Would need historical ARR data for accurate trend
      arrChangePercent: 0,
      healthScore: customer.health_score || 0,
      healthTrend,
      stage: customer.stage || 'active',
      renewalDate: renewalDate ? renewalDate.toISOString().split('T')[0] : null,
      daysUntilRenewal,
      csmName: customer.csm_name || null
    };
  }

  private formatStakeholders(stakeholders: any[], activities: any[]): KeyStakeholder[] {
    return stakeholders.map(s => {
      // Find last activity involving this stakeholder
      const lastActivity = activities.find(a =>
        a.action_data?.stakeholder === s.name ||
        a.action_data?.email === s.email
      );

      return {
        name: s.name,
        role: s.title || s.role || 'Unknown',
        email: s.email || null,
        sentiment: this.inferSentiment(s, activities),
        lastContact: lastActivity?.started_at || s.created_at || null
      };
    }).slice(0, 5); // Limit to top 5
  }

  private inferSentiment(stakeholder: any, activities: any[]): 'Positive' | 'Neutral' | 'Negative' | 'Unknown' {
    // Basic sentiment inference from metadata
    if (stakeholder.metadata?.sentiment) {
      return stakeholder.metadata.sentiment;
    }

    // Check recent activities for sentiment indicators
    const stakeholderActivities = activities.filter(a =>
      a.action_data?.stakeholder === stakeholder.name ||
      a.action_data?.email === stakeholder.email
    );

    if (stakeholderActivities.length === 0) {
      return 'Unknown';
    }

    // Count positive/negative indicators
    let positiveCount = 0;
    let negativeCount = 0;

    stakeholderActivities.forEach(a => {
      if (a.result_data?.sentiment === 'positive' || a.action_type === 'positive_feedback') {
        positiveCount++;
      } else if (a.result_data?.sentiment === 'negative' || a.action_type === 'escalation') {
        negativeCount++;
      }
    });

    if (positiveCount > negativeCount) return 'Positive';
    if (negativeCount > positiveCount) return 'Negative';
    return 'Neutral';
  }

  private calculateHealthIndicators(customer: any, activities: any[], meetings: any[]): HealthIndicator[] {
    const indicators: HealthIndicator[] = [];

    // Usage Score
    const usageScore = Math.min(100, Math.max(0, customer.health_score || 70));
    indicators.push({
      name: 'Usage Score',
      score: usageScore,
      maxScore: 100,
      explanation: usageScore >= 80 ? 'Strong product engagement' :
                   usageScore >= 60 ? 'Moderate usage levels' : 'Low engagement - needs attention'
    });

    // Engagement Score based on meetings/activities
    const recentMeetings = meetings.filter(m => {
      const meetingDate = new Date(m.scheduled_at);
      const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
      return meetingDate >= thirtyDaysAgo;
    }).length;

    const engagementScore = Math.min(100, recentMeetings * 20);
    indicators.push({
      name: 'Engagement Score',
      score: engagementScore,
      maxScore: 100,
      explanation: engagementScore >= 60 ? 'Regular touchpoints maintained' :
                   engagementScore >= 40 ? 'Some engagement gaps' : 'Low engagement - outreach recommended'
    });

    // Sentiment Score
    const positiveActivities = activities.filter(a =>
      a.result_data?.sentiment === 'positive' ||
      a.action_type?.includes('success')
    ).length;
    const totalActivities = activities.length || 1;
    const sentimentScore = Math.min(100, Math.round((positiveActivities / totalActivities) * 100));

    indicators.push({
      name: 'Sentiment Score',
      score: sentimentScore || 70,
      maxScore: 100,
      explanation: sentimentScore >= 70 ? 'Positive relationship indicators' :
                   sentimentScore >= 50 ? 'Mixed signals' : 'Sentiment concerns detected'
    });

    return indicators;
  }

  private detectRiskSignals(customer: any, healthHistory: any[], activities: any[]): RiskSignal[] {
    const risks: RiskSignal[] = [];

    // Check for declining health score
    if (customer.health_score < 60) {
      risks.push({
        type: 'Low Health Score',
        severity: customer.health_score < 40 ? 'High' : 'Medium',
        description: `Health score is ${customer.health_score}/100, below healthy threshold`,
        detectedAt: new Date().toISOString()
      });
    }

    // Check for upcoming renewal
    if (customer.contract_end) {
      const daysUntilRenewal = Math.ceil(
        (new Date(customer.contract_end).getTime() - Date.now()) / (1000 * 60 * 60 * 24)
      );

      if (daysUntilRenewal <= 30 && daysUntilRenewal > 0) {
        risks.push({
          type: 'Imminent Renewal',
          severity: 'High',
          description: `Contract renewal in ${daysUntilRenewal} days`,
          detectedAt: new Date().toISOString()
        });
      } else if (daysUntilRenewal <= 90 && daysUntilRenewal > 30) {
        risks.push({
          type: 'Upcoming Renewal',
          severity: 'Medium',
          description: `Contract renewal in ${daysUntilRenewal} days - begin renewal discussions`,
          detectedAt: new Date().toISOString()
        });
      }
    }

    // Check for low engagement
    const recentActivities = activities.filter(a => {
      const actDate = new Date(a.started_at);
      const twoWeeksAgo = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000);
      return actDate >= twoWeeksAgo;
    });

    if (recentActivities.length === 0) {
      risks.push({
        type: 'Engagement Drop',
        severity: 'Medium',
        description: 'No recent touchpoints in the last 2 weeks',
        detectedAt: new Date().toISOString()
      });
    }

    // Check for escalations
    const recentEscalations = activities.filter(a =>
      a.action_type?.includes('escalation') || a.result_data?.escalated
    );

    if (recentEscalations.length > 0) {
      risks.push({
        type: 'Recent Escalation',
        severity: 'High',
        description: `${recentEscalations.length} escalation(s) in recent activity`,
        detectedAt: recentEscalations[0].started_at
      });
    }

    return risks.sort((a, b) => {
      const severityOrder = { 'High': 0, 'Medium': 1, 'Low': 2 };
      return severityOrder[a.severity] - severityOrder[b.severity];
    });
  }

  private formatRecentActivity(activities: any[], meetings: any[]): RecentActivity[] {
    const formatted: RecentActivity[] = [];

    // Add activities
    activities.forEach(a => {
      formatted.push({
        date: a.started_at,
        type: this.formatActivityType(a.action_type),
        description: a.result_data?.summary || a.action_data?.description || a.action_type
      });
    });

    // Add meetings
    meetings.forEach(m => {
      formatted.push({
        date: m.scheduled_at,
        type: 'Meeting',
        description: m.title || m.meeting_type || 'Customer Meeting'
      });
    });

    // Sort by date descending
    return formatted.sort((a, b) =>
      new Date(b.date).getTime() - new Date(a.date).getTime()
    );
  }

  private formatActivityType(actionType: string): string {
    const typeMap: Record<string, string> = {
      'send_email': 'Email Sent',
      'draft_email': 'Email Drafted',
      'schedule_meeting': 'Meeting Scheduled',
      'book_meeting': 'Meeting Booked',
      'create_task': 'Task Created',
      'health_check': 'Health Check',
      'qbr_prep': 'QBR Preparation',
      'risk_assessment': 'Risk Assessment',
      'renewal_forecast': 'Renewal Forecast'
    };

    return typeMap[actionType] || actionType.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
  }

  private identifyExpansionOpportunities(contracts: any[], customer: any): ExpansionOpportunity[] {
    const opportunities: ExpansionOpportunity[] = [];

    // Check for unused entitlements or expansion signals
    contracts.forEach(contract => {
      if (contract.entitlements) {
        contract.entitlements.forEach((e: any) => {
          if (e.status === 'active' && e.expansion_potential) {
            opportunities.push({
              name: `${e.type} Expansion`,
              potential: e.expansion_value || Math.round(customer.arr * 0.2),
              stage: 'Identified',
              probability: 50
            });
          }
        });
      }
    });

    // Add generic opportunities based on customer health
    if (customer.health_score >= 80) {
      opportunities.push({
        name: 'Upsell Opportunity',
        potential: Math.round((customer.arr || 0) * 0.3),
        stage: 'Qualified',
        probability: 70
      });
    }

    return opportunities;
  }

  private calculateDataCompleteness(data: {
    customerData: any;
    stakeholders: any[];
    contracts: any[];
    meetings: any[];
    activities: any[];
    healthHistory: any[];
  }): number {
    let sections = 0;
    let populatedSections = 0;

    // Check each section
    const checks = [
      { name: 'Customer', hasData: !!data.customerData },
      { name: 'Stakeholders', hasData: data.stakeholders.length > 0 },
      { name: 'Contracts', hasData: data.contracts.length > 0 },
      { name: 'Meetings', hasData: data.meetings.length > 0 },
      { name: 'Activities', hasData: data.activities.length > 0 },
      { name: 'Health History', hasData: data.healthHistory.length > 0 }
    ];

    checks.forEach(check => {
      sections++;
      if (check.hasData) populatedSections++;
    });

    return Math.round((populatedSections / sections) * 100);
  }

  private async generateAISummary(
    customer: any,
    stakeholders: any[],
    healthIndicators: HealthIndicator[],
    riskSignals: RiskSignal[],
    recentActivity: RecentActivity[],
    expansionOpportunities: ExpansionOpportunity[],
    focusArea?: string
  ): Promise<{ summary: string; actions: RecommendedAction[] }> {
    const systemPrompt = `You are a Customer Success AI analyst. Given the following account data,
generate a concise executive summary and recommended actions.

Focus on:
1. Overall account health trajectory
2. Key relationship strengths and gaps
3. Immediate concerns requiring attention
4. Growth opportunities
5. Time-sensitive items

Be specific, actionable, and data-driven in your analysis.`;

    const customerData = {
      name: customer.name,
      arr: customer.arr,
      stage: customer.stage,
      healthScore: customer.health_score,
      industry: customer.industry,
      stakeholderCount: stakeholders.length,
      healthIndicators: healthIndicators.map(h => `${h.name}: ${h.score}/${h.maxScore}`),
      riskSignals: riskSignals.map(r => `${r.type} (${r.severity}): ${r.description}`),
      recentActivityCount: recentActivity.length,
      expansionPotential: expansionOpportunities.reduce((sum, o) => sum + o.potential, 0)
    };

    const prompt = `Analyze this customer account and provide:
1. A 2-3 sentence executive summary
2. 3-5 recommended actions with priorities

${focusArea ? `Focus particularly on: ${focusArea}` : ''}

Account Data:
${JSON.stringify(customerData, null, 2)}

Return a JSON object with exactly this structure:
{
  "summary": "2-3 sentence executive summary",
  "actions": [
    { "action": "specific action to take", "priority": "High|Medium|Low", "reason": "why this matters" }
  ]
}

Return ONLY the JSON object, no markdown formatting.`;

    try {
      const response = await this.claude.generate(prompt, systemPrompt);

      // Parse the JSON response
      let jsonString = response.trim();
      if (jsonString.startsWith('```')) {
        jsonString = jsonString.replace(/```json?\n?/g, '').replace(/```/g, '');
      }

      const parsed = JSON.parse(jsonString);

      return {
        summary: parsed.summary || `${customer.name} is a ${customer.stage} account with a health score of ${customer.health_score}/100 and ARR of $${customer.arr?.toLocaleString() || 0}.`,
        actions: (parsed.actions || []).map((a: any) => ({
          action: a.action,
          priority: a.priority || 'Medium',
          reason: a.reason || ''
        }))
      };
    } catch (error) {
      console.error('Error generating AI summary:', error);

      // Return fallback summary
      return {
        summary: `${customer.name} is a ${customer.stage} account with a health score of ${customer.health_score}/100 and ARR of $${customer.arr?.toLocaleString() || 0}. ${riskSignals.length > 0 ? `There are ${riskSignals.length} active risk signals requiring attention.` : 'No critical risks detected.'}`,
        actions: riskSignals.slice(0, 3).map(r => ({
          action: `Address: ${r.description}`,
          priority: r.severity,
          reason: `Risk signal detected: ${r.type}`
        }))
      };
    }
  }

  private generateMockBriefing(customerId: string): AccountBriefing {
    // Generate mock data when Supabase is not configured
    return {
      customerId,
      accountName: 'Demo Account',
      generatedAt: new Date().toISOString(),
      quickStats: {
        arr: 150000,
        arrTrend: 'Growing',
        arrChangePercent: 12,
        healthScore: 82,
        healthTrend: 'Stable',
        stage: 'active',
        renewalDate: '2026-06-15',
        daysUntilRenewal: 137,
        csmName: 'Demo CSM'
      },
      executiveSummary: 'Demo Account is a healthy, growing account with strong product adoption. The executive sponsor remains engaged, and there is expansion potential in their engineering team.',
      keyStakeholders: [
        { name: 'John Smith', role: 'VP Engineering', email: 'john@demo.com', sentiment: 'Positive', lastContact: new Date().toISOString() }
      ],
      healthIndicators: [
        { name: 'Usage Score', score: 85, maxScore: 100, explanation: 'Strong product engagement' },
        { name: 'Engagement Score', score: 75, maxScore: 100, explanation: 'Regular touchpoints maintained' },
        { name: 'Sentiment Score', score: 80, maxScore: 100, explanation: 'Positive relationship indicators' }
      ],
      activeRiskSignals: [],
      recentActivity: [
        { date: new Date().toISOString(), type: 'Meeting', description: 'Quarterly Business Review' }
      ],
      expansionOpportunities: [
        { name: 'Team Expansion', potential: 30000, stage: 'Qualified', probability: 70 }
      ],
      recommendedActions: [
        { action: 'Schedule renewal discussion', priority: 'Medium', reason: '137 days until renewal' }
      ],
      dataCompleteness: 100
    };
  }
}

export const accountBriefingService = new AccountBriefingService();
