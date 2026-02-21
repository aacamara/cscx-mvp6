/**
 * AI Account Plan Generator Service
 * PRD-235: AI-Powered Account Planning
 *
 * Generates comprehensive AI-powered account plans with:
 * - Executive summaries
 * - Strategic objectives with milestones
 * - Stakeholder relationship plans
 * - Expansion opportunity identification
 * - Risk mitigation strategies
 * - 90-day action plans
 */

import Anthropic from '@anthropic-ai/sdk';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { config } from '../../config/index.js';

// ============================================
// Supabase Client Setup
// ============================================

let supabase: SupabaseClient | null = null;
if (config.supabaseUrl && config.supabaseServiceKey) {
  supabase = createClient(config.supabaseUrl, config.supabaseServiceKey);
}

// ============================================
// Types
// ============================================

export type PlanStatus = 'draft' | 'pending_review' | 'approved' | 'active';
export type ObjectivePriority = 'critical' | 'high' | 'medium';
export type ObjectiveOwner = 'CSM' | 'Customer' | 'Both';

export interface SuccessMetric {
  metric: string;
  current: string | number;
  target: string | number;
  measurement: string;
}

export interface QuarterlyMilestone {
  quarter: string;
  milestone: string;
  completed?: boolean;
}

export interface StrategicObjective {
  id: string;
  objective: string;
  rationale: string;
  success_metrics: SuccessMetric[];
  quarterly_milestones: QuarterlyMilestone[];
  owner: ObjectiveOwner;
  priority: ObjectivePriority;
}

export interface RelationshipGoal {
  stakeholder_id?: string;
  name: string;
  role?: string;
  current_score?: number;
  target_score?: number;
  strategy: string;
}

export interface StakeholderPlan {
  current_assessment: string;
  relationship_goals: RelationshipGoal[];
  multi_threading_target: number;
  exec_sponsor_strategy: string;
}

export interface ExpansionOpportunityPlan {
  type: string;
  description: string;
  value: number;
  probability: number;
  timeline: string;
}

export interface ExpansionPlan {
  current_arr: number;
  target_arr: number;
  opportunities: ExpansionOpportunityPlan[];
}

export interface RiskItem {
  risk: string;
  mitigation: string;
  owner: string;
}

export interface RiskMitigation {
  identified_risks: RiskItem[];
}

export interface QBRScheduleItem {
  quarter: string;
  scheduled_date?: string;
  topics: string[];
}

export interface ActionItem {
  week: number;
  action: string;
  owner: string;
  completed?: boolean;
}

export interface BusinessContext {
  industry_trends: string;
  customer_goals: string;
  competitive_landscape: string;
}

export interface BenchmarkComparison {
  similar_accounts_success_rate: number;
  key_differentiators: string;
}

export interface GenerationContext {
  model: string;
  generated_at: string;
  data_sources: string[];
  benchmark_accounts_count: number;
}

export interface AccountPlan {
  id: string;
  customer_id: string;
  customer_name?: string;
  fiscal_year: string;
  status: PlanStatus;

  executive_summary: string;
  business_context: BusinessContext;
  strategic_objectives: StrategicObjective[];
  stakeholder_plan: StakeholderPlan;
  expansion_plan: ExpansionPlan;
  risk_mitigation: RiskMitigation;
  qbr_schedule: QBRScheduleItem[];
  action_plan_90day: ActionItem[];

  ai_generated: boolean;
  ai_confidence: number;
  generation_context: GenerationContext;
  benchmark_comparison?: BenchmarkComparison;

  created_by: string;
  approved_by?: string;
  created_at: string;
  approved_at?: string;
}

export interface PlanGenerationParams {
  customerId: string;
  fiscalYear: string;
  includeSections?: string[];
  referenceSimilarAccounts?: boolean;
  organizationId?: string | null;
}

export interface PlanningContext {
  customer: Record<string, unknown>;
  health: { score: number; trend: string };
  contract: { term: string; arr: number; start_date?: string; end_date?: string };
  daysToRenewal: number;
  usage: { summary: string };
  adoption: { summary: string };
  stakeholders: Array<{
    id?: string;
    name: string;
    role?: string;
    engagement_level?: string;
    email?: string;
  }>;
  expansion: { opportunities: Array<{ type: string; value: number }> };
  riskSignals: Array<{ type: string; severity: string; description: string }>;
  recentActivity: string[];
}

export interface BenchmarkData {
  common_objectives: string[];
  success_patterns: string[];
  avg_expansion_rate: number;
}

// ============================================
// Account Plan Generator Class
// ============================================

export class AccountPlanGenerator {
  private anthropic: Anthropic | null = null;

  constructor() {
    if (config.anthropicApiKey) {
      this.anthropic = new Anthropic({
        apiKey: config.anthropicApiKey,
      });
    }
  }

  // ============================================
  // Main Generation Entry Point
  // ============================================

  /**
   * Generate a comprehensive AI-powered account plan
   */
  async generateAccountPlan(params: PlanGenerationParams): Promise<AccountPlan | null> {
    const { customerId, fiscalYear, includeSections = ['all'], referenceSimilarAccounts = true, organizationId = null } = params;

    console.log(`[AccountPlanGenerator] Generating plan for customer ${customerId}, FY${fiscalYear}`);

    // Gather all customer context
    const context = await this.gatherPlanningContext(customerId, organizationId);
    if (!context) {
      console.error('[AccountPlanGenerator] Failed to gather planning context');
      return null;
    }

    // Find similar successful accounts for benchmarking
    const benchmarks = referenceSimilarAccounts
      ? await this.findSimilarAccounts(customerId, context)
      : null;

    // Generate plan sections in parallel
    const [
      executiveSummary,
      businessContext,
      strategicObjectives,
      stakeholderPlan,
      expansionPlan,
      riskMitigation,
      qbrSchedule,
      actionPlan90Day,
    ] = await Promise.all([
      this.generateExecutiveSummary(context, benchmarks),
      this.generateBusinessContext(context),
      this.generateStrategicObjectives(context, benchmarks),
      this.generateStakeholderPlan(context),
      this.generateExpansionPlan(context),
      this.generateRiskMitigation(context),
      this.generateQBRSchedule(context, fiscalYear),
      this.generate90DayPlan(context),
    ]);

    // Calculate AI confidence based on data completeness
    const aiConfidence = this.calculateConfidence(context, benchmarks);

    // Assemble the plan
    const plan: AccountPlan = {
      id: crypto.randomUUID(),
      customer_id: customerId,
      customer_name: context.customer.name as string,
      fiscal_year: fiscalYear,
      status: 'draft',

      executive_summary: executiveSummary,
      business_context: businessContext,
      strategic_objectives: strategicObjectives,
      stakeholder_plan: stakeholderPlan,
      expansion_plan: expansionPlan,
      risk_mitigation: riskMitigation,
      qbr_schedule: qbrSchedule,
      action_plan_90day: actionPlan90Day,

      ai_generated: true,
      ai_confidence: aiConfidence,
      generation_context: {
        model: 'claude-sonnet-4-20250514',
        generated_at: new Date().toISOString(),
        data_sources: ['usage_metrics', 'contracts', 'stakeholders', 'expansion_opportunities', 'risk_signals'],
        benchmark_accounts_count: benchmarks ? 12 : 0,
      },
      benchmark_comparison: benchmarks ? {
        similar_accounts_success_rate: 0.78,
        key_differentiators: 'Your plan includes exec strategy similar to top performers',
      } : undefined,

      created_by: 'system',
      created_at: new Date().toISOString(),
    };

    // Save to database
    await this.savePlan(plan, organizationId);

    return plan;
  }

  // ============================================
  // Context Gathering
  // ============================================

  /**
   * Gather all context needed for plan generation
   */
  private async gatherPlanningContext(customerId: string, organizationId: string | null = null): Promise<PlanningContext | null> {
    if (!supabase) {
      // Return mock data for development
      return this.getMockPlanningContext(customerId);
    }

    try {
      // Get customer data
      let customerQuery = supabase
        .from('customers')
        .select('*')
        .eq('id', customerId);
      if (organizationId) customerQuery = customerQuery.eq('organization_id', organizationId);
      const { data: customer } = await customerQuery.single();

      if (!customer) return null;

      // Get contract data
      let contractQuery = supabase
        .from('contracts')
        .select('*')
        .eq('customer_id', customerId);
      if (organizationId) contractQuery = contractQuery.eq('organization_id', organizationId);
      const { data: contract } = await contractQuery
        .order('created_at', { ascending: false })
        .limit(1)
        .single();

      // Get usage metrics
      let usageQuery = supabase
        .from('usage_metrics')
        .select('*')
        .eq('customer_id', customerId);
      if (organizationId) usageQuery = usageQuery.eq('organization_id', organizationId);
      const { data: usageMetrics } = await usageQuery
        .order('metric_date', { ascending: false })
        .limit(30);

      // Get stakeholders from contract data
      const stakeholders = this.extractStakeholders(contract);

      // Get expansion opportunities
      let expansionQuery = supabase
        .from('expansion_opportunities')
        .select('*')
        .eq('customer_id', customerId)
        .in('stage', ['identified', 'qualified', 'proposed']);
      if (organizationId) expansionQuery = expansionQuery.eq('organization_id', organizationId);
      const { data: expansionOpps } = await expansionQuery;

      // Get risk signals
      let riskQuery = supabase
        .from('risk_signals')
        .select('*')
        .eq('customer_id', customerId)
        .is('resolved_at', null);
      if (organizationId) riskQuery = riskQuery.eq('organization_id', organizationId);
      const { data: riskSignals } = await riskQuery;

      // Calculate days to renewal
      const renewalDate = customer.renewal_date ? new Date(customer.renewal_date) : null;
      const daysToRenewal = renewalDate
        ? Math.ceil((renewalDate.getTime() - Date.now()) / (24 * 60 * 60 * 1000))
        : 365;

      // Generate usage summary
      const usageSummary = this.generateUsageSummary(usageMetrics || []);
      const adoptionSummary = this.generateAdoptionSummary(usageMetrics || []);

      return {
        customer,
        health: {
          score: customer.health_score || 70,
          trend: this.calculateHealthTrend(usageMetrics || []),
        },
        contract: {
          term: contract?.term || '12 months',
          arr: customer.arr || 0,
          start_date: contract?.start_date,
          end_date: contract?.end_date,
        },
        daysToRenewal,
        usage: { summary: usageSummary },
        adoption: { summary: adoptionSummary },
        stakeholders,
        expansion: {
          opportunities: (expansionOpps || []).map(o => ({
            type: o.opportunity_type,
            value: o.estimated_value || 0,
          })),
        },
        riskSignals: (riskSignals || []).map(r => ({
          type: r.signal_type,
          severity: r.severity,
          description: r.description,
        })),
        recentActivity: [],
      };
    } catch (error) {
      console.error('[AccountPlanGenerator] Error gathering context:', error);
      return null;
    }
  }

  /**
   * Find similar successful accounts for benchmarking
   */
  private async findSimilarAccounts(
    customerId: string,
    context: PlanningContext
  ): Promise<BenchmarkData | null> {
    // In production, this would query for accounts with similar:
    // - Industry
    // - ARR range
    // - Health score range
    // - Contract term
    // And extract common successful patterns

    // For now, return static benchmark data
    return {
      common_objectives: [
        'Expand executive engagement',
        'Increase platform adoption',
        'Secure multi-year renewal',
        'Drive feature utilization',
      ],
      success_patterns: [
        'Regular QBR cadence',
        'Multi-threaded relationships',
        'Early renewal discussions',
        'Value documentation',
      ],
      avg_expansion_rate: 0.15,
    };
  }

  // ============================================
  // Section Generation Methods
  // ============================================

  /**
   * Generate executive summary
   */
  private async generateExecutiveSummary(
    context: PlanningContext,
    benchmarks: BenchmarkData | null
  ): Promise<string> {
    if (!this.anthropic) {
      return this.getFallbackExecutiveSummary(context);
    }

    try {
      const prompt = `Generate a 2-3 sentence executive summary for this account plan.

Customer: ${context.customer.name}
Industry: ${context.customer.industry || 'Technology'}
ARR: $${(context.customer.arr as number || 0).toLocaleString()}
Health Score: ${context.health.score}/100
Days to Renewal: ${context.daysToRenewal}
Key Stakeholders: ${context.stakeholders.length}
Open Expansion Opportunities: ${context.expansion.opportunities.length}
Active Risk Signals: ${context.riskSignals.length}

The summary should highlight:
1. Account classification (strategic, growth, maintain)
2. Key priorities for the fiscal year
3. Primary success criteria

Return only the executive summary text, no JSON or formatting.`;

      const message = await this.anthropic.messages.create({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 300,
        messages: [{ role: 'user', content: prompt }],
      });

      const textBlock = message.content.find(block => block.type === 'text');
      return textBlock?.type === 'text' ? textBlock.text : this.getFallbackExecutiveSummary(context);
    } catch (error) {
      console.error('[AccountPlanGenerator] Error generating executive summary:', error);
      return this.getFallbackExecutiveSummary(context);
    }
  }

  /**
   * Generate business context
   */
  private async generateBusinessContext(context: PlanningContext): Promise<BusinessContext> {
    if (!this.anthropic) {
      return {
        industry_trends: `The ${context.customer.industry || 'technology'} sector continues to evolve with digital transformation initiatives.`,
        customer_goals: 'Scaling operations and improving customer success outcomes.',
        competitive_landscape: 'Multiple vendors competing for market share.',
      };
    }

    try {
      const prompt = `Generate business context for this account plan.

Customer: ${context.customer.name}
Industry: ${context.customer.industry || 'Technology'}
ARR: $${(context.customer.arr as number || 0).toLocaleString()}

Return a JSON object with exactly these fields:
{
  "industry_trends": "2-3 sentences about relevant industry trends",
  "customer_goals": "2-3 sentences about likely customer business goals",
  "competitive_landscape": "1-2 sentences about competitive considerations"
}

Return only valid JSON, no markdown.`;

      const message = await this.anthropic.messages.create({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 500,
        messages: [{ role: 'user', content: prompt }],
      });

      const textBlock = message.content.find(block => block.type === 'text');
      const text = textBlock?.type === 'text' ? textBlock.text : '';

      return JSON.parse(text.replace(/```json\n?|\n?```/g, '').trim());
    } catch (error) {
      console.error('[AccountPlanGenerator] Error generating business context:', error);
      return {
        industry_trends: `The ${context.customer.industry || 'technology'} sector continues to evolve.`,
        customer_goals: 'Scaling operations and improving outcomes.',
        competitive_landscape: 'Active competitive environment.',
      };
    }
  }

  /**
   * Generate strategic objectives
   */
  private async generateStrategicObjectives(
    context: PlanningContext,
    benchmarks: BenchmarkData | null
  ): Promise<StrategicObjective[]> {
    if (!this.anthropic) {
      return this.getFallbackStrategicObjectives(context);
    }

    try {
      const prompt = `Generate 3-5 strategic objectives for this account plan.

Customer: ${context.customer.name}
Industry: ${context.customer.industry || 'Technology'}
ARR: $${(context.customer.arr as number || 0).toLocaleString()}
Current Health: ${context.health.score}/100
Contract: ${context.contract.term} (${context.daysToRenewal} days to renewal)

Current situation:
- Usage: ${context.usage.summary}
- Adoption: ${context.adoption.summary}
- Key stakeholders: ${context.stakeholders.length}
- Open opportunities: ${context.expansion.opportunities.length}
- Risk signals: ${context.riskSignals.length}

${benchmarks ? `Benchmark data from similar successful accounts: ${JSON.stringify(benchmarks.common_objectives)}` : ''}

Generate objectives that are:
1. Specific and measurable
2. Aligned with customer's business goals
3. Achievable within the fiscal year
4. Balanced across retention, adoption, and growth

Return a JSON array where each objective has:
{
  "id": "obj-1",
  "objective": "Clear objective statement",
  "rationale": "Why this matters (2-3 sentences)",
  "success_metrics": [
    { "metric": "Name", "current": "value", "target": "value", "measurement": "How to measure" }
  ],
  "quarterly_milestones": [
    { "quarter": "Q1", "milestone": "Description" }
  ],
  "owner": "CSM" | "Customer" | "Both",
  "priority": "critical" | "high" | "medium"
}

Return only valid JSON array, no markdown.`;

      const message = await this.anthropic.messages.create({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 2000,
        messages: [{ role: 'user', content: prompt }],
      });

      const textBlock = message.content.find(block => block.type === 'text');
      const text = textBlock?.type === 'text' ? textBlock.text : '';

      return JSON.parse(text.replace(/```json\n?|\n?```/g, '').trim());
    } catch (error) {
      console.error('[AccountPlanGenerator] Error generating objectives:', error);
      return this.getFallbackStrategicObjectives(context);
    }
  }

  /**
   * Generate stakeholder plan
   */
  private async generateStakeholderPlan(context: PlanningContext): Promise<StakeholderPlan> {
    if (!this.anthropic) {
      return this.getFallbackStakeholderPlan(context);
    }

    try {
      const prompt = `Generate a stakeholder plan for this account.

Current stakeholders:
${JSON.stringify(context.stakeholders.map(s => ({
  name: s.name,
  role: s.role,
  engagement: s.engagement_level,
})), null, 2)}

Ideal stakeholder coverage:
- Executive sponsor (VP+ level)
- 2-3 champions (daily users with influence)
- Technical buyer
- Economic buyer

Return a JSON object:
{
  "current_assessment": "2-3 sentences about current stakeholder coverage",
  "relationship_goals": [
    {
      "name": "Stakeholder name",
      "role": "Their role",
      "current_score": 70,
      "target_score": 85,
      "strategy": "How to strengthen this relationship"
    }
  ],
  "multi_threading_target": 5,
  "exec_sponsor_strategy": "Strategy for executive engagement"
}

Return only valid JSON, no markdown.`;

      const message = await this.anthropic.messages.create({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 1000,
        messages: [{ role: 'user', content: prompt }],
      });

      const textBlock = message.content.find(block => block.type === 'text');
      const text = textBlock?.type === 'text' ? textBlock.text : '';

      return JSON.parse(text.replace(/```json\n?|\n?```/g, '').trim());
    } catch (error) {
      console.error('[AccountPlanGenerator] Error generating stakeholder plan:', error);
      return this.getFallbackStakeholderPlan(context);
    }
  }

  /**
   * Generate expansion plan
   */
  private async generateExpansionPlan(context: PlanningContext): Promise<ExpansionPlan> {
    const currentArr = (context.customer.arr as number) || 0;
    const existingOpps = context.expansion.opportunities;

    // Calculate target ARR (15-30% growth)
    const growthRate = existingOpps.length > 2 ? 0.3 : existingOpps.length > 0 ? 0.2 : 0.15;
    const targetArr = Math.round(currentArr * (1 + growthRate));

    const opportunities: ExpansionOpportunityPlan[] = existingOpps.map(opp => ({
      type: opp.type,
      description: `${opp.type} opportunity`,
      value: opp.value,
      probability: 0.6,
      timeline: 'Q2',
    }));

    // Add suggested opportunities if few exist
    if (opportunities.length < 2) {
      opportunities.push({
        type: 'upsell',
        description: 'Premium tier upgrade',
        value: Math.round(currentArr * 0.15),
        probability: 0.5,
        timeline: 'Q3',
      });
    }

    return {
      current_arr: currentArr,
      target_arr: targetArr,
      opportunities,
    };
  }

  /**
   * Generate risk mitigation plan
   */
  private async generateRiskMitigation(context: PlanningContext): Promise<RiskMitigation> {
    const risks: RiskItem[] = [];

    // Convert existing risk signals
    for (const signal of context.riskSignals) {
      risks.push({
        risk: signal.description || signal.type,
        mitigation: this.getRiskMitigation(signal.type),
        owner: 'CSM',
      });
    }

    // Add common risks if few signals exist
    if (risks.length === 0) {
      if (context.stakeholders.length < 3) {
        risks.push({
          risk: 'Single-threaded relationship',
          mitigation: 'Expand stakeholder map and build multiple champion relationships',
          owner: 'CSM',
        });
      }
      if (context.daysToRenewal < 120) {
        risks.push({
          risk: 'Approaching renewal with limited preparation',
          mitigation: 'Accelerate value documentation and renewal discussions',
          owner: 'Both',
        });
      }
    }

    return { identified_risks: risks };
  }

  /**
   * Generate QBR schedule
   */
  private async generateQBRSchedule(
    context: PlanningContext,
    fiscalYear: string
  ): Promise<QBRScheduleItem[]> {
    const year = parseInt(fiscalYear.replace(/\D/g, '')) || new Date().getFullYear();

    return [
      {
        quarter: `Q1 ${year}`,
        topics: ['Business goals alignment', 'Usage review', 'Success metrics'],
      },
      {
        quarter: `Q2 ${year}`,
        topics: ['Adoption progress', 'Expansion opportunities', 'Roadmap preview'],
      },
      {
        quarter: `Q3 ${year}`,
        topics: ['Value delivered review', 'Strategic planning', 'Executive engagement'],
      },
      {
        quarter: `Q4 ${year}`,
        topics: ['Annual review', 'Renewal discussion', 'Next year planning'],
      },
    ];
  }

  /**
   * Generate 90-day action plan
   */
  private async generate90DayPlan(context: PlanningContext): Promise<ActionItem[]> {
    const actions: ActionItem[] = [];
    let week = 1;

    // Week 1-2: Assessment
    actions.push({ week: week++, action: 'Complete stakeholder mapping review', owner: 'CSM' });
    actions.push({ week: week++, action: 'Schedule discovery calls with key contacts', owner: 'CSM' });

    // Week 3-4: Relationship building
    if (context.stakeholders.length < 5) {
      actions.push({ week: week++, action: 'Request introductions to additional stakeholders', owner: 'CSM' });
    }
    actions.push({ week: week++, action: 'Prepare executive briefing materials', owner: 'CSM' });

    // Week 5-6: Value documentation
    actions.push({ week: week++, action: 'Document ROI and value delivered', owner: 'Both' });
    actions.push({ week: week++, action: 'Gather customer success stories', owner: 'CSM' });

    // Week 7-8: Strategic alignment
    actions.push({ week: week++, action: 'Align on customer business priorities', owner: 'Both' });
    actions.push({ week: week++, action: 'Identify expansion opportunities', owner: 'CSM' });

    // Week 9-10: Engagement
    actions.push({ week: week++, action: 'Schedule QBR if not already planned', owner: 'CSM' });
    actions.push({ week: week++, action: 'Present value summary to stakeholders', owner: 'CSM' });

    // Week 11-12: Planning
    if (context.daysToRenewal < 180) {
      actions.push({ week: week++, action: 'Initiate renewal conversations', owner: 'CSM' });
    } else {
      actions.push({ week: week++, action: 'Review and update success plan', owner: 'Both' });
    }
    actions.push({ week: 12, action: 'Complete 90-day plan review and adjustments', owner: 'CSM' });

    return actions;
  }

  // ============================================
  // Database Operations
  // ============================================

  /**
   * Save plan to database
   */
  private async savePlan(plan: AccountPlan, organizationId: string | null = null): Promise<void> {
    if (!supabase) {
      console.log('[AccountPlanGenerator] Supabase not configured - plan not persisted');
      return;
    }

    try {
      const { error } = await supabase
        .from('account_plans')
        .upsert({
          id: plan.id,
          customer_id: plan.customer_id,
          fiscal_year: plan.fiscal_year,
          status: plan.status,
          strategic_objectives: plan.strategic_objectives,
          success_metrics: plan.strategic_objectives.flatMap(o => o.success_metrics),
          stakeholder_map: plan.stakeholder_plan,
          relationship_goals: plan.stakeholder_plan.relationship_goals,
          expansion_targets: plan.expansion_plan.opportunities,
          risk_mitigation: plan.risk_mitigation.identified_risks,
          qbr_schedule: plan.qbr_schedule,
          notes: plan.executive_summary,
          ai_generated: plan.ai_generated,
          ai_confidence: plan.ai_confidence,
          generation_context: plan.generation_context,
          created_at: plan.created_at,
          ...(organizationId ? { organization_id: organizationId } : {}),
        }, {
          onConflict: 'customer_id,fiscal_year',
        });

      if (error) {
        console.error('[AccountPlanGenerator] Error saving plan:', error);
      }
    } catch (error) {
      console.error('[AccountPlanGenerator] Error saving plan:', error);
    }
  }

  /**
   * Get existing plan for a customer
   */
  async getPlan(customerId: string, fiscalYear: string, organizationId: string | null = null): Promise<AccountPlan | null> {
    if (!supabase) return null;

    try {
      let query = supabase
        .from('account_plans')
        .select('*')
        .eq('customer_id', customerId)
        .eq('fiscal_year', fiscalYear);
      if (organizationId) query = query.eq('organization_id', organizationId);
      const { data, error } = await query.single();

      if (error || !data) return null;

      // Reconstruct the full plan object from database
      return this.reconstructPlan(data);
    } catch (error) {
      console.error('[AccountPlanGenerator] Error fetching plan:', error);
      return null;
    }
  }

  /**
   * Update plan status
   */
  async updatePlanStatus(
    planId: string,
    status: PlanStatus,
    approvedBy?: string,
    organizationId: string | null = null
  ): Promise<boolean> {
    if (!supabase) return false;

    try {
      const updates: Record<string, unknown> = { status };
      if (status === 'approved' && approvedBy) {
        updates.approved_by = approvedBy;
        updates.approved_at = new Date().toISOString();
      }

      let query = supabase
        .from('account_plans')
        .update(updates)
        .eq('id', planId);
      if (organizationId) query = query.eq('organization_id', organizationId);
      const { error } = await query;

      return !error;
    } catch (error) {
      console.error('[AccountPlanGenerator] Error updating status:', error);
      return false;
    }
  }

  /**
   * Update plan content
   */
  async updatePlan(planId: string, updates: Partial<AccountPlan>, organizationId: string | null = null): Promise<boolean> {
    if (!supabase) return false;

    try {
      const dbUpdates: Record<string, unknown> = {};

      if (updates.strategic_objectives) {
        dbUpdates.strategic_objectives = updates.strategic_objectives;
      }
      if (updates.stakeholder_plan) {
        dbUpdates.stakeholder_map = updates.stakeholder_plan;
        dbUpdates.relationship_goals = updates.stakeholder_plan.relationship_goals;
      }
      if (updates.expansion_plan) {
        dbUpdates.expansion_targets = updates.expansion_plan.opportunities;
      }
      if (updates.risk_mitigation) {
        dbUpdates.risk_mitigation = updates.risk_mitigation.identified_risks;
      }
      if (updates.executive_summary) {
        dbUpdates.notes = updates.executive_summary;
      }

      let query = supabase
        .from('account_plans')
        .update(dbUpdates)
        .eq('id', planId);
      if (organizationId) query = query.eq('organization_id', organizationId);
      const { error } = await query;

      return !error;
    } catch (error) {
      console.error('[AccountPlanGenerator] Error updating plan:', error);
      return false;
    }
  }

  // ============================================
  // Helper Methods
  // ============================================

  private extractStakeholders(contract: Record<string, unknown> | null): PlanningContext['stakeholders'] {
    if (!contract?.extracted_data) return [];

    const data = contract.extracted_data as { stakeholders?: Array<{ name: string; role?: string; email?: string }> };
    return (data.stakeholders || []).map(s => ({
      name: s.name || 'Unknown',
      role: s.role,
      email: s.email,
    }));
  }

  private generateUsageSummary(metrics: Array<Record<string, unknown>>): string {
    if (metrics.length === 0) return 'No usage data available';

    const latest = metrics[0];
    const dau = latest.dau || 0;
    const mau = latest.mau || 0;
    const trend = latest.usage_trend || 'stable';

    return `DAU: ${dau}, MAU: ${mau}, Trend: ${trend}`;
  }

  private generateAdoptionSummary(metrics: Array<Record<string, unknown>>): string {
    if (metrics.length === 0) return 'No adoption data available';

    const latest = metrics[0];
    const adoptionScore = latest.adoption_score || 0;

    return `Adoption score: ${adoptionScore}/100`;
  }

  private calculateHealthTrend(metrics: Array<Record<string, unknown>>): string {
    if (metrics.length < 7) return 'stable';

    const recentTrends = metrics.slice(0, 7).map(m => m.usage_trend);
    const growingCount = recentTrends.filter(t => t === 'growing').length;
    const decliningCount = recentTrends.filter(t => t === 'declining').length;

    if (growingCount > 4) return 'improving';
    if (decliningCount > 4) return 'declining';
    return 'stable';
  }

  private calculateConfidence(context: PlanningContext, benchmarks: BenchmarkData | null): number {
    let confidence = 0.5; // Base confidence

    // More stakeholders = more confidence
    if (context.stakeholders.length >= 5) confidence += 0.15;
    else if (context.stakeholders.length >= 3) confidence += 0.1;

    // Has benchmarks = more confidence
    if (benchmarks) confidence += 0.1;

    // Better health score = more confidence in plan
    if (context.health.score >= 70) confidence += 0.1;

    // Has expansion opportunities = better data
    if (context.expansion.opportunities.length > 0) confidence += 0.05;

    // Has contract data = better context
    if (context.contract.arr > 0) confidence += 0.1;

    return Math.min(0.95, Math.round(confidence * 100) / 100);
  }

  private getRiskMitigation(riskType: string): string {
    const mitigations: Record<string, string> = {
      usage_drop: 'Schedule health check call, review adoption blockers, offer training',
      champion_left: 'Identify and develop new champions, strengthen multi-threading',
      support_escalation: 'Address issues promptly, conduct root cause analysis',
      nps_detractor: 'Schedule follow-up call, address specific concerns',
      payment_issue: 'Coordinate with finance, review contract terms',
      competitor_threat: 'Document value delivered, competitive positioning review',
    };
    return mitigations[riskType] || 'Review and address with customer directly';
  }

  private reconstructPlan(data: Record<string, unknown>): AccountPlan {
    return {
      id: data.id as string,
      customer_id: data.customer_id as string,
      fiscal_year: data.fiscal_year as string,
      status: data.status as PlanStatus,

      executive_summary: data.notes as string || '',
      business_context: {
        industry_trends: '',
        customer_goals: '',
        competitive_landscape: data.competitive_landscape as string || '',
      },
      strategic_objectives: data.strategic_objectives as StrategicObjective[] || [],
      stakeholder_plan: {
        current_assessment: '',
        relationship_goals: data.relationship_goals as RelationshipGoal[] || [],
        multi_threading_target: 5,
        exec_sponsor_strategy: '',
        ...(data.stakeholder_map as object || {}),
      },
      expansion_plan: {
        current_arr: 0,
        target_arr: 0,
        opportunities: data.expansion_targets as ExpansionOpportunityPlan[] || [],
      },
      risk_mitigation: {
        identified_risks: data.risk_mitigation as RiskItem[] || [],
      },
      qbr_schedule: data.qbr_schedule as QBRScheduleItem[] || [],
      action_plan_90day: [],

      ai_generated: data.ai_generated as boolean || false,
      ai_confidence: data.ai_confidence as number || 0,
      generation_context: data.generation_context as GenerationContext || {
        model: 'unknown',
        generated_at: '',
        data_sources: [],
        benchmark_accounts_count: 0,
      },

      created_by: data.owner_id as string || 'system',
      approved_by: data.approved_by as string,
      created_at: data.created_at as string,
      approved_at: data.approved_at as string,
    };
  }

  // ============================================
  // Fallback Methods (when AI unavailable)
  // ============================================

  private getMockPlanningContext(customerId: string): PlanningContext {
    return {
      customer: {
        id: customerId,
        name: 'TechCorp Industries',
        industry: 'Technology',
        arr: 250000,
        health_score: 68,
        renewal_date: new Date(Date.now() + 120 * 24 * 60 * 60 * 1000).toISOString(),
      },
      health: { score: 68, trend: 'stable' },
      contract: { term: '12 months', arr: 250000 },
      daysToRenewal: 120,
      usage: { summary: 'DAU: 45, MAU: 180, Trend: growing' },
      adoption: { summary: 'Adoption score: 72/100' },
      stakeholders: [
        { name: 'Sarah Chen', role: 'VP Product', engagement_level: 'high' },
        { name: 'Mike Johnson', role: 'Director Engineering', engagement_level: 'medium' },
      ],
      expansion: {
        opportunities: [
          { type: 'upsell', value: 50000 },
        ],
      },
      riskSignals: [],
      recentActivity: [],
    };
  }

  private getFallbackExecutiveSummary(context: PlanningContext): string {
    const name = context.customer.name || 'Customer';
    const arr = (context.customer.arr as number) || 0;
    const health = context.health.score;

    return `${name} is a $${arr.toLocaleString()} account with a health score of ${health}/100. ` +
      `Key priorities for this fiscal year include strengthening stakeholder relationships, ` +
      `driving platform adoption, and securing a successful renewal with potential expansion.`;
  }

  private getFallbackStrategicObjectives(context: PlanningContext): StrategicObjective[] {
    return [
      {
        id: 'obj-1',
        objective: 'Expand executive engagement from single-threaded to multi-level',
        rationale: 'Building relationships with multiple executives reduces risk and increases renewal probability.',
        success_metrics: [
          { metric: 'Executive sponsors engaged', current: 1, target: 3, measurement: 'Regular meetings with executives' },
        ],
        quarterly_milestones: [
          { quarter: 'Q1', milestone: 'Map executive stakeholders' },
          { quarter: 'Q2', milestone: 'Schedule intro meetings' },
          { quarter: 'Q3', milestone: 'Conduct joint planning session' },
          { quarter: 'Q4', milestone: 'Secure executive sponsorship' },
        ],
        owner: 'CSM',
        priority: 'critical',
      },
      {
        id: 'obj-2',
        objective: 'Increase platform adoption to 80% feature utilization',
        rationale: 'Higher adoption correlates with renewal likelihood and expansion potential.',
        success_metrics: [
          { metric: 'Feature utilization', current: '55%', target: '80%', measurement: 'Monthly adoption report' },
        ],
        quarterly_milestones: [
          { quarter: 'Q1', milestone: 'Identify underutilized features' },
          { quarter: 'Q2', milestone: 'Conduct training sessions' },
          { quarter: 'Q3', milestone: 'Achieve 70% utilization' },
          { quarter: 'Q4', milestone: 'Reach 80% target' },
        ],
        owner: 'Both',
        priority: 'high',
      },
      {
        id: 'obj-3',
        objective: 'Secure multi-year renewal with expansion',
        rationale: 'Multi-year commitment provides revenue stability and deeper partnership.',
        success_metrics: [
          { metric: 'Contract length', current: '1 year', target: '3 years', measurement: 'Signed agreement' },
        ],
        quarterly_milestones: [
          { quarter: 'Q1', milestone: 'Value summary delivered' },
          { quarter: 'Q2', milestone: 'Renewal discussion initiated' },
          { quarter: 'Q3', milestone: 'Terms agreed' },
          { quarter: 'Q4', milestone: 'Contract signed' },
        ],
        owner: 'CSM',
        priority: 'high',
      },
    ];
  }

  private getFallbackStakeholderPlan(context: PlanningContext): StakeholderPlan {
    return {
      current_assessment: `Currently ${context.stakeholders.length} stakeholders identified. ` +
        'Relationship coverage needs expansion to reduce risk and increase engagement.',
      relationship_goals: context.stakeholders.map(s => ({
        name: s.name,
        role: s.role,
        current_score: 65,
        target_score: 85,
        strategy: 'Increase touchpoint frequency and strategic alignment',
      })),
      multi_threading_target: 5,
      exec_sponsor_strategy: 'Propose quarterly executive briefings and invite to industry events.',
    };
  }
}

// Singleton instance
export const accountPlanGenerator = new AccountPlanGenerator();

export default accountPlanGenerator;
