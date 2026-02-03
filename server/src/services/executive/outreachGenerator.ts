/**
 * Executive Outreach Generator Service
 * PRD-031: Executive Sponsor Outreach
 *
 * Generates professional, executive-appropriate outreach emails with
 * high-level value insights and strategic engagement opportunities.
 */

import { createClient, SupabaseClient } from '@supabase/supabase-js';
import Anthropic from '@anthropic-ai/sdk';
import { v4 as uuidv4 } from 'uuid';
import { config } from '../../config/index.js';
import {
  generateExecutiveIntroEmail,
  generateExecutiveBriefingEmail,
  generateExecutiveStrategicEmail,
  type ExecutiveIntroData,
  type ExecutiveBriefingData,
  type ExecutiveStrategicData,
} from '../../templates/emails/index.js';

// ============================================
// Types
// ============================================

export type OutreachPurpose =
  | 'introduction'
  | 'strategic_alignment'
  | 'pre_qbr'
  | 'escalation_awareness'
  | 'expansion'
  | 'value_summary';

export interface Executive {
  id: string;
  name: string;
  firstName: string;
  email: string;
  title: string;
  linkedinUrl?: string;
  lastContactDate?: string;
  lastContactContext?: string;
  engagementScore?: number;
  priorContacts: number;
  sentiment?: 'positive' | 'neutral' | 'negative' | 'unknown';
}

export interface ExecutiveOutreachRequest {
  customerId: string;
  executiveId?: string;
  purpose: OutreachPurpose;
  csmId?: string;
  csmName?: string;
  csmEmail?: string;
  customMessage?: string;
  proposedDates?: Array<{ date: string; time: string }>;
  expansionDetails?: {
    description: string;
    potentialValue: number;
    businessCase: string[];
  };
  escalationDetails?: {
    issue: string;
    impact: string;
    resolution: string;
    status: string;
  };
}

export interface ExecutiveSummary {
  customerId: string;
  customerName: string;
  partnershipHighlights: {
    metric: string;
    value: string;
    context?: string;
  }[];
  roi?: string;
  achievements: string[];
  strategicInitiatives: string[];
  keyRisks?: string[];
  upcomingMilestones?: string[];
}

export interface OutreachDraft {
  id: string;
  executiveId: string;
  executiveName: string;
  executiveTitle: string;
  executiveEmail: string;
  purpose: OutreachPurpose;
  subject: string;
  bodyHtml: string;
  bodyText: string;
  talkingPoints: string[];
  suggestedSendTime: string;
  followUpActions?: string[];
  sentiment: 'positive' | 'neutral' | 'concerned';
  context: {
    healthScore: number;
    arr: number;
    daysToRenewal?: number;
    lastExecContact?: string;
  };
  generatedAt: string;
}

export interface GenerateOutreachResult {
  success: boolean;
  drafts: OutreachDraft[];
  executives: Executive[];
  summary: ExecutiveSummary;
  error?: string;
}

// ============================================
// Executive Outreach Generator Service
// ============================================

export class ExecutiveOutreachGeneratorService {
  private supabase: SupabaseClient | null = null;
  private anthropic: Anthropic | null = null;

  constructor() {
    if (config.supabaseUrl && config.supabaseServiceKey) {
      this.supabase = createClient(config.supabaseUrl, config.supabaseServiceKey);
    }
    if (config.anthropicApiKey) {
      this.anthropic = new Anthropic({ apiKey: config.anthropicApiKey });
    }
  }

  // ============================================
  // Executive Identification
  // ============================================

  /**
   * Get executives for a customer
   */
  async getExecutives(customerId: string): Promise<Executive[]> {
    if (!this.supabase) {
      return this.getMockExecutives(customerId);
    }

    try {
      const { data, error } = await this.supabase
        .from('stakeholders')
        .select('*')
        .eq('customer_id', customerId)
        .eq('status', 'active')
        .eq('is_exec_sponsor', true)
        .order('engagement_score', { ascending: false });

      if (error) throw error;

      if (!data || data.length === 0) {
        // Fall back to getting C-level executives by title
        const { data: cLevelData } = await this.supabase
          .from('stakeholders')
          .select('*')
          .eq('customer_id', customerId)
          .eq('status', 'active')
          .or('role.ilike.%CEO%,role.ilike.%CFO%,role.ilike.%CTO%,role.ilike.%COO%,role.ilike.%CIO%,role.ilike.%VP%,role.ilike.%Director%,role.ilike.%President%')
          .order('engagement_score', { ascending: false });

        return (cLevelData || []).map(this.mapStakeholderToExecutive);
      }

      return data.map(this.mapStakeholderToExecutive);
    } catch (error) {
      console.error('Error fetching executives:', error);
      return this.getMockExecutives(customerId);
    }
  }

  /**
   * Get a specific executive by ID
   */
  async getExecutive(executiveId: string): Promise<Executive | null> {
    if (!this.supabase) return null;

    try {
      const { data, error } = await this.supabase
        .from('stakeholders')
        .select('*')
        .eq('id', executiveId)
        .single();

      if (error || !data) return null;

      return this.mapStakeholderToExecutive(data);
    } catch (error) {
      console.error('Error fetching executive:', error);
      return null;
    }
  }

  // ============================================
  // Executive Summary Generation
  // ============================================

  /**
   * Generate executive-level partnership summary
   */
  async generateExecutiveSummary(customerId: string): Promise<ExecutiveSummary> {
    if (!this.supabase) {
      return this.getMockExecutiveSummary(customerId);
    }

    try {
      // Fetch customer data
      const { data: customer } = await this.supabase
        .from('customers')
        .select('*')
        .eq('id', customerId)
        .single();

      if (!customer) {
        return this.getMockExecutiveSummary(customerId);
      }

      // Fetch account plan if exists
      const { data: accountPlan } = await this.supabase
        .from('account_plans')
        .select('*')
        .eq('customer_id', customerId)
        .order('created_at', { ascending: false })
        .limit(1)
        .single();

      // Fetch renewal data
      const { data: renewal } = await this.supabase
        .from('renewal_pipeline')
        .select('*')
        .eq('customer_id', customerId)
        .order('renewal_date', { ascending: true })
        .limit(1)
        .single();

      // Fetch success metrics
      const { data: metrics } = await this.supabase
        .from('customer_metrics')
        .select('*')
        .eq('customer_id', customerId)
        .order('recorded_at', { ascending: false })
        .limit(10);

      // Build summary
      const highlights = this.buildPartnershipHighlights(customer, metrics || [], renewal);
      const achievements = this.extractAchievements(customer, accountPlan);
      const initiatives = accountPlan?.strategic_initiatives || [];

      return {
        customerId,
        customerName: customer.name,
        partnershipHighlights: highlights,
        roi: this.calculateROI(customer, metrics || []),
        achievements,
        strategicInitiatives: initiatives,
        keyRisks: this.extractRisks(customer, renewal),
        upcomingMilestones: this.extractMilestones(customer, renewal),
      };
    } catch (error) {
      console.error('Error generating executive summary:', error);
      return this.getMockExecutiveSummary(customerId);
    }
  }

  // ============================================
  // Outreach Generation
  // ============================================

  /**
   * Generate executive outreach email(s)
   */
  async generateOutreach(request: ExecutiveOutreachRequest): Promise<GenerateOutreachResult> {
    try {
      // Get executives
      const executives = request.executiveId
        ? [await this.getExecutive(request.executiveId)].filter(Boolean) as Executive[]
        : await this.getExecutives(request.customerId);

      if (executives.length === 0) {
        return {
          success: false,
          drafts: [],
          executives: [],
          summary: await this.generateExecutiveSummary(request.customerId),
          error: 'No executives found for this customer',
        };
      }

      // Get executive summary
      const summary = await this.generateExecutiveSummary(request.customerId);

      // Get customer context
      const customerContext = await this.getCustomerContext(request.customerId);

      // Get CSM info
      const csm = {
        name: request.csmName || 'Your CSM',
        email: request.csmEmail || 'csm@company.com',
        title: 'Customer Success Manager',
      };

      // Generate drafts for each executive
      const drafts: OutreachDraft[] = [];
      for (const exec of executives) {
        const draft = await this.generateDraftForExecutive(
          exec,
          request,
          summary,
          customerContext,
          csm
        );
        drafts.push(draft);
      }

      // Record outreach attempt
      await this.recordOutreachAttempt(request.customerId, drafts);

      return {
        success: true,
        drafts,
        executives,
        summary,
      };
    } catch (error) {
      console.error('Error generating executive outreach:', error);
      return {
        success: false,
        drafts: [],
        executives: [],
        summary: await this.generateExecutiveSummary(request.customerId),
        error: error instanceof Error ? error.message : 'Failed to generate outreach',
      };
    }
  }

  /**
   * Generate draft for a specific executive
   */
  private async generateDraftForExecutive(
    executive: Executive,
    request: ExecutiveOutreachRequest,
    summary: ExecutiveSummary,
    customerContext: CustomerContext,
    csm: { name: string; email: string; title: string }
  ): Promise<OutreachDraft> {
    const { purpose, customMessage, proposedDates, expansionDetails, escalationDetails } = request;

    let subject: string;
    let bodyHtml: string;
    let bodyText: string;
    let talkingPoints: string[] = [];
    let suggestedSendTime: string;
    let followUpActions: string[] = [];
    let sentiment: 'positive' | 'neutral' | 'concerned' = 'neutral';

    switch (purpose) {
      case 'introduction': {
        const data: ExecutiveIntroData = {
          customer: {
            name: summary.customerName,
            arr: customerContext.arr,
            healthScore: customerContext.healthScore,
            industry: customerContext.industry,
            partnershipDuration: customerContext.partnershipDuration,
          },
          executive: {
            name: executive.name,
            firstName: executive.firstName,
            email: executive.email,
            title: executive.title,
            linkedinUrl: executive.linkedinUrl,
          },
          csm,
          context: {
            existingChampion: customerContext.primaryChampion,
            championTitle: customerContext.championTitle,
            keyMetrics: summary.partnershipHighlights.slice(0, 3),
          },
          customMessage,
        };
        const result = generateExecutiveIntroEmail(data);
        subject = result.subject;
        bodyHtml = result.bodyHtml;
        bodyText = result.bodyText;
        talkingPoints = result.talkingPoints;
        suggestedSendTime = result.suggestedSendTime;
        sentiment = 'positive';
        break;
      }

      case 'pre_qbr':
      case 'strategic_alignment': {
        const briefingType = purpose === 'pre_qbr' ? 'pre_qbr' : 'strategic_alignment';
        const data: ExecutiveBriefingData = {
          customer: {
            name: summary.customerName,
            arr: customerContext.arr,
            healthScore: customerContext.healthScore,
            healthTrend: customerContext.healthTrend,
            renewalDate: customerContext.renewalDate,
            daysToRenewal: customerContext.daysToRenewal,
          },
          executive: {
            name: executive.name,
            firstName: executive.firstName,
            email: executive.email,
            title: executive.title,
            lastContactDate: executive.lastContactDate,
            lastContactContext: executive.lastContactContext,
          },
          csm,
          briefing: {
            type: briefingType,
            quarter: customerContext.currentQuarter,
            year: new Date().getFullYear(),
            proposedDates,
          },
          highlights: {
            achievements: summary.partnershipHighlights.slice(0, 4).map(h => ({
              title: h.metric,
              value: h.value,
            })),
            upcomingInitiatives: summary.strategicInitiatives?.slice(0, 3),
          },
          customMessage,
        };
        const result = generateExecutiveBriefingEmail(data);
        subject = result.subject;
        bodyHtml = result.bodyHtml;
        bodyText = result.bodyText;
        talkingPoints = result.talkingPoints;
        suggestedSendTime = result.suggestedSendTime;
        followUpActions = result.followUpActions;
        sentiment = 'neutral';
        break;
      }

      case 'expansion':
      case 'escalation_awareness':
      case 'value_summary': {
        const strategicPurpose = purpose === 'expansion' ? 'expansion'
          : purpose === 'escalation_awareness' ? 'escalation_awareness'
          : 'value_summary';

        const data: ExecutiveStrategicData = {
          customer: {
            name: summary.customerName,
            arr: customerContext.arr,
            healthScore: customerContext.healthScore,
            industry: customerContext.industry,
            tier: customerContext.tier,
          },
          executive: {
            name: executive.name,
            firstName: executive.firstName,
            email: executive.email,
            title: executive.title,
          },
          csm,
          strategic: {
            purpose: strategicPurpose,
            expansionOpportunity: expansionDetails,
            escalation: escalationDetails,
            valueDelivered: purpose === 'value_summary' ? {
              totalROI: summary.roi,
              costSavings: summary.partnershipHighlights.find(h => h.metric.toLowerCase().includes('cost'))?.value,
              efficiencyGains: summary.partnershipHighlights.find(h => h.metric.toLowerCase().includes('efficien'))?.value,
            } : undefined,
          },
          metrics: summary.partnershipHighlights.slice(0, 4),
          customMessage,
        };
        const result = generateExecutiveStrategicEmail(data);
        subject = result.subject;
        bodyHtml = result.bodyHtml;
        bodyText = result.bodyText;
        talkingPoints = result.talkingPoints;
        suggestedSendTime = result.suggestedSendTime;
        followUpActions = result.followUpActions;
        sentiment = result.sentiment;
        break;
      }

      default:
        throw new Error(`Unknown outreach purpose: ${purpose}`);
    }

    return {
      id: uuidv4(),
      executiveId: executive.id,
      executiveName: executive.name,
      executiveTitle: executive.title,
      executiveEmail: executive.email,
      purpose,
      subject,
      bodyHtml,
      bodyText,
      talkingPoints,
      suggestedSendTime,
      followUpActions,
      sentiment,
      context: {
        healthScore: customerContext.healthScore,
        arr: customerContext.arr,
        daysToRenewal: customerContext.daysToRenewal,
        lastExecContact: executive.lastContactDate,
      },
      generatedAt: new Date().toISOString(),
    };
  }

  // ============================================
  // AI-Enhanced Content Generation (Optional)
  // ============================================

  /**
   * Use AI to enhance email content with personalization
   */
  async enhanceWithAI(draft: OutreachDraft, executivePriorities?: string[]): Promise<OutreachDraft> {
    if (!this.anthropic) {
      return draft;
    }

    try {
      const prompt = `You are an expert Customer Success Manager assistant. Enhance this executive email to be more personalized and impactful.

Current email subject: ${draft.subject}

Current email body:
${draft.bodyText}

Executive Name: ${draft.executiveName}
Executive Title: ${draft.executiveTitle}
${executivePriorities ? `Known Executive Priorities: ${executivePriorities.join(', ')}` : ''}

Context:
- Health Score: ${draft.context.healthScore}
- ARR: $${draft.context.arr.toLocaleString()}
${draft.context.daysToRenewal ? `- Days to Renewal: ${draft.context.daysToRenewal}` : ''}

Instructions:
1. Make the email more concise (executives are busy)
2. Ensure it leads with value, not asks
3. Reference any known executive priorities if available
4. Keep the same structure but improve the wording
5. Return ONLY the enhanced email body text, nothing else`;

      const message = await this.anthropic.messages.create({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 1000,
        messages: [{ role: 'user', content: prompt }],
      });

      const textBlock = message.content.find(block => block.type === 'text');
      if (textBlock?.type === 'text') {
        draft.bodyText = textBlock.text;
        // Note: HTML version would need separate enhancement
      }

      return draft;
    } catch (error) {
      console.error('AI enhancement failed:', error);
      return draft;
    }
  }

  // ============================================
  // Tracking & Recording
  // ============================================

  /**
   * Record executive outreach attempt for analytics
   */
  private async recordOutreachAttempt(customerId: string, drafts: OutreachDraft[]): Promise<void> {
    if (!this.supabase) return;

    try {
      for (const draft of drafts) {
        // Update stakeholder last_exec_outreach
        await this.supabase
          .from('stakeholders')
          .update({
            last_exec_outreach: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          })
          .eq('id', draft.executiveId);

        // Log activity
        await this.supabase
          .from('activity_feed')
          .insert({
            id: uuidv4(),
            customer_id: customerId,
            action_type: 'executive_outreach_drafted',
            action_data: {
              executiveId: draft.executiveId,
              executiveName: draft.executiveName,
              purpose: draft.purpose,
              subject: draft.subject,
            },
            created_at: new Date().toISOString(),
          });
      }
    } catch (error) {
      console.error('Error recording outreach attempt:', error);
    }
  }

  /**
   * Record that an executive outreach was sent
   */
  async recordOutreachSent(
    draftId: string,
    executiveId: string,
    customerId: string
  ): Promise<void> {
    if (!this.supabase) return;

    try {
      // Update stakeholder engagement
      await this.supabase
        .from('stakeholders')
        .update({
          last_contact_at: new Date().toISOString(),
          interaction_count: this.supabase.rpc('increment_interaction_count', { stakeholder_id: executiveId }),
          updated_at: new Date().toISOString(),
        })
        .eq('id', executiveId);

      // Log activity
      await this.supabase
        .from('activity_feed')
        .insert({
          id: uuidv4(),
          customer_id: customerId,
          action_type: 'executive_outreach_sent',
          action_data: {
            draftId,
            executiveId,
            sentAt: new Date().toISOString(),
          },
          created_at: new Date().toISOString(),
        });
    } catch (error) {
      console.error('Error recording outreach sent:', error);
    }
  }

  // ============================================
  // Helper Methods
  // ============================================

  private mapStakeholderToExecutive(stakeholder: any): Executive {
    const nameParts = (stakeholder.name || '').split(' ');
    return {
      id: stakeholder.id,
      name: stakeholder.name,
      firstName: nameParts[0] || stakeholder.name,
      email: stakeholder.email,
      title: stakeholder.role || 'Executive',
      linkedinUrl: stakeholder.linkedin_url,
      lastContactDate: stakeholder.last_contact_at,
      lastContactContext: stakeholder.last_contact_context,
      engagementScore: stakeholder.engagement_score,
      priorContacts: stakeholder.interaction_count || 0,
      sentiment: stakeholder.sentiment,
    };
  }

  private async getCustomerContext(customerId: string): Promise<CustomerContext> {
    if (!this.supabase) {
      return this.getMockCustomerContext();
    }

    try {
      const { data: customer } = await this.supabase
        .from('customers')
        .select('*')
        .eq('id', customerId)
        .single();

      const { data: renewal } = await this.supabase
        .from('renewal_pipeline')
        .select('*')
        .eq('customer_id', customerId)
        .order('renewal_date', { ascending: true })
        .limit(1)
        .single();

      const { data: champion } = await this.supabase
        .from('stakeholders')
        .select('name, role')
        .eq('customer_id', customerId)
        .eq('is_champion', true)
        .eq('status', 'active')
        .limit(1)
        .single();

      const daysToRenewal = renewal?.renewal_date
        ? Math.ceil((new Date(renewal.renewal_date).getTime() - Date.now()) / (1000 * 60 * 60 * 24))
        : undefined;

      return {
        healthScore: customer?.health_score || 75,
        healthTrend: this.determineHealthTrend(customer),
        arr: customer?.arr || 50000,
        industry: customer?.industry,
        tier: customer?.tier,
        renewalDate: renewal?.renewal_date,
        daysToRenewal,
        partnershipDuration: this.calculatePartnershipDuration(customer?.created_at),
        currentQuarter: this.getCurrentQuarter(),
        primaryChampion: champion?.name,
        championTitle: champion?.role,
      };
    } catch (error) {
      console.error('Error fetching customer context:', error);
      return this.getMockCustomerContext();
    }
  }

  private buildPartnershipHighlights(
    customer: any,
    metrics: any[],
    renewal: any
  ): { metric: string; value: string; context?: string }[] {
    const highlights: { metric: string; value: string; context?: string }[] = [];

    if (customer?.health_score) {
      highlights.push({
        metric: 'Health Score',
        value: `${customer.health_score}/100`,
        context: customer.health_score >= 80 ? 'Strong partnership health' : undefined,
      });
    }

    if (customer?.arr) {
      highlights.push({
        metric: 'Partnership Value',
        value: this.formatCurrency(customer.arr),
      });
    }

    // Add metrics-based highlights
    const adoptionMetric = metrics.find(m => m.metric_name === 'adoption_rate');
    if (adoptionMetric) {
      highlights.push({
        metric: 'Adoption Rate',
        value: `${adoptionMetric.value}%`,
      });
    }

    const npsMetric = metrics.find(m => m.metric_name === 'nps');
    if (npsMetric) {
      highlights.push({
        metric: 'NPS Score',
        value: npsMetric.value.toString(),
      });
    }

    return highlights.slice(0, 5);
  }

  private extractAchievements(customer: any, accountPlan: any): string[] {
    const achievements: string[] = [];

    if (accountPlan?.achievements) {
      achievements.push(...accountPlan.achievements);
    }

    if (customer?.health_score >= 80) {
      achievements.push('Maintained strong partnership health');
    }

    return achievements.slice(0, 5);
  }

  private extractRisks(customer: any, renewal: any): string[] {
    const risks: string[] = [];

    if (customer?.health_score < 60) {
      risks.push('Health score below target');
    }

    if (renewal && renewal.risk_level === 'high') {
      risks.push('Renewal at risk');
    }

    return risks;
  }

  private extractMilestones(customer: any, renewal: any): string[] {
    const milestones: string[] = [];

    if (renewal?.renewal_date) {
      const daysTo = Math.ceil(
        (new Date(renewal.renewal_date).getTime() - Date.now()) / (1000 * 60 * 60 * 24)
      );
      if (daysTo > 0 && daysTo <= 120) {
        milestones.push(`Renewal in ${daysTo} days`);
      }
    }

    return milestones;
  }

  private calculateROI(customer: any, metrics: any[]): string | undefined {
    const roiMetric = metrics.find(m => m.metric_name === 'roi');
    if (roiMetric) {
      return `${roiMetric.value}x`;
    }
    return undefined;
  }

  private determineHealthTrend(customer: any): 'improving' | 'stable' | 'declining' {
    if (!customer) return 'stable';
    // Simplified - would need historical data for real trend
    if (customer.health_score >= 80) return 'stable';
    if (customer.health_score >= 60) return 'stable';
    return 'declining';
  }

  private calculatePartnershipDuration(createdAt?: string): string | undefined {
    if (!createdAt) return undefined;
    const months = Math.floor(
      (Date.now() - new Date(createdAt).getTime()) / (1000 * 60 * 60 * 24 * 30)
    );
    if (months < 12) return `${months} months`;
    const years = Math.floor(months / 12);
    return years === 1 ? '1 year' : `${years} years`;
  }

  private getCurrentQuarter(): string {
    const month = new Date().getMonth();
    if (month < 3) return 'Q1';
    if (month < 6) return 'Q2';
    if (month < 9) return 'Q3';
    return 'Q4';
  }

  private formatCurrency(value: number): string {
    if (value >= 1000000) return `$${(value / 1000000).toFixed(1)}M`;
    if (value >= 1000) return `$${(value / 1000).toFixed(0)}K`;
    return `$${value.toLocaleString()}`;
  }

  // ============================================
  // Mock Data (for development/testing)
  // ============================================

  private getMockExecutives(customerId: string): Executive[] {
    return [
      {
        id: `exec-1-${customerId}`,
        name: 'Jennifer Walsh',
        firstName: 'Jennifer',
        email: 'jennifer.walsh@customer.com',
        title: 'CEO',
        priorContacts: 0,
        sentiment: 'unknown',
      },
      {
        id: `exec-2-${customerId}`,
        name: 'Robert Kim',
        firstName: 'Robert',
        email: 'robert.kim@customer.com',
        title: 'CFO',
        lastContactDate: '2025-06-15',
        lastContactContext: 'Q2 2025 QBR',
        priorContacts: 1,
        sentiment: 'positive',
      },
      {
        id: `exec-3-${customerId}`,
        name: 'Amanda Chen',
        firstName: 'Amanda',
        email: 'amanda.chen@customer.com',
        title: 'CTO',
        lastContactDate: '2025-11-20',
        priorContacts: 5,
        engagementScore: 85,
        sentiment: 'positive',
      },
    ];
  }

  private getMockExecutiveSummary(customerId: string): ExecutiveSummary {
    return {
      customerId,
      customerName: 'Global Retail Co',
      partnershipHighlights: [
        { metric: 'Cost Reduction', value: '32%', context: 'Exceeding 25% target' },
        { metric: 'ROI', value: '4.2x', context: 'On platform investment' },
        { metric: 'Adoption Rate', value: '87%', context: 'Active user engagement' },
        { metric: 'NPS Score', value: '72', context: 'Above industry benchmark' },
      ],
      roi: '4.2x',
      achievements: [
        'Successfully expanded to 3 additional business units',
        'Achieved 32% operational cost reduction',
        'Maintained 99.9% platform uptime',
      ],
      strategicInitiatives: [
        'Digital transformation acceleration',
        'Customer experience enhancement',
        'Operational efficiency program',
      ],
      keyRisks: [],
      upcomingMilestones: ['Renewal in 90 days', 'Q1 2026 QBR'],
    };
  }

  private getMockCustomerContext(): CustomerContext {
    return {
      healthScore: 85,
      healthTrend: 'stable',
      arr: 450000,
      industry: 'Retail',
      tier: 'Enterprise',
      renewalDate: '2026-03-15',
      daysToRenewal: 90,
      partnershipDuration: '2 years',
      currentQuarter: 'Q1',
      primaryChampion: 'Amanda Chen',
      championTitle: 'CTO',
    };
  }
}

// Internal type
interface CustomerContext {
  healthScore: number;
  healthTrend: 'improving' | 'stable' | 'declining';
  arr: number;
  industry?: string;
  tier?: string;
  renewalDate?: string;
  daysToRenewal?: number;
  partnershipDuration?: string;
  currentQuarter: string;
  primaryChampion?: string;
  championTitle?: string;
}

// Export singleton instance
export const executiveOutreachGenerator = new ExecutiveOutreachGeneratorService();

export default executiveOutreachGenerator;
