/**
 * Renewal Proposal Generator Service
 * Generates comprehensive renewal proposals with value summaries and pricing options
 * PRD-027: Renewal Proposal Generator
 */

import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { config } from '../../config/index.js';
import { docsService, DocTemplate } from '../google/docs.js';
import { driveService } from '../google/drive.js';
import { gmailService, SendEmailOptions } from '../google/gmail.js';
import { activityLogger } from '../activityLogger.js';

// Initialize Supabase client
let supabase: SupabaseClient | null = null;
if (config.supabaseUrl && config.supabaseServiceKey) {
  supabase = createClient(config.supabaseUrl, config.supabaseServiceKey);
}

// Types
export interface ContractData {
  id: string;
  arr: number;
  start_date: string;
  end_date: string;
  terms?: string;
  entitlements?: Array<{
    name: string;
    quantity: number;
    unit?: string;
  }>;
}

export interface RenewalPipelineData {
  id: string;
  customer_id: string;
  renewal_date: string;
  current_arr: number;
  proposed_arr: number;
  probability: number;
  stage: string;
  risk_factors: string[];
  expansion_potential: number;
  champion_engaged: boolean;
  exec_sponsor_engaged: boolean;
  qbr_completed: boolean;
  value_summary_sent: boolean;
  proposal_sent: boolean;
  proposal_doc_url?: string;
  proposal_sent_at?: string;
}

export interface CustomerData {
  id: string;
  name: string;
  industry: string;
  arr: number;
  health_score: number;
  stage: string;
  renewal_date: string;
  primary_contact?: {
    name: string;
    email: string;
    title?: string;
  };
}

export interface UsageMetrics {
  dau: number;
  mau: number;
  login_count: number;
  api_calls: number;
  feature_adoption: Record<string, { adopted: boolean; usage_count: number }>;
  usage_trend: string;
  adoption_score: number;
  yoy_change?: number;
}

export interface ValueMetrics {
  totalValueDelivered: number;
  efficiencyImprovement: number;
  timeSavedHours: number;
  costSavings: number;
  roi: number;
  keyWins: string[];
  newUseCases: string[];
}

export interface PricingOption {
  name: string;
  description: string;
  arr: number;
  change: string;
  changePercent: number;
  features: string[];
  recommended?: boolean;
}

export interface ProposalContent {
  customer: CustomerData;
  contract: ContractData;
  renewalPipeline: RenewalPipelineData;
  usageMetrics: UsageMetrics;
  valueMetrics: ValueMetrics;
  pricingOptions: PricingOption[];
  healthScoreTrend: {
    current: number;
    direction: 'up' | 'down' | 'stable';
    previousQuarter: number;
  };
  daysUntilRenewal: number;
}

export interface RenewalProposalPackage {
  proposalDocId: string;
  proposalDocUrl: string;
  emailDraft: {
    to: string;
    subject: string;
    bodyHtml: string;
    bodyText: string;
  };
  summary: {
    currentArr: number;
    pricingOptions: PricingOption[];
    daysUntilRenewal: number;
    healthScore: number;
    valueDelivered: number;
  };
}

export interface PreviewContent extends ProposalContent {
  proposalSections: {
    executiveSummary: string;
    partnershipTimeline: string;
    valueDelivered: string;
    pricingOptions: string;
    nextSteps: string;
  };
}

class RenewalProposalGeneratorService {
  /**
   * Get customer data with related information
   */
  private async getCustomerData(customerId: string): Promise<CustomerData | null> {
    if (!supabase) return null;

    const { data, error } = await supabase
      .from('customers')
      .select(`
        id,
        name,
        industry,
        arr,
        health_score,
        stage,
        renewal_date
      `)
      .eq('id', customerId)
      .single();

    if (error || !data) {
      console.error('Error fetching customer:', error);
      return null;
    }

    // Get primary stakeholder
    const { data: stakeholders } = await supabase
      .from('stakeholders')
      .select('name, email, role')
      .eq('customer_id', customerId)
      .eq('is_primary', true)
      .limit(1);

    const primaryContact = stakeholders?.[0];

    return {
      ...data,
      primary_contact: primaryContact ? {
        name: primaryContact.name,
        email: primaryContact.email,
        title: primaryContact.role,
      } : undefined,
    };
  }

  /**
   * Get contract data for customer
   */
  private async getContractData(customerId: string): Promise<ContractData | null> {
    if (!supabase) return null;

    const { data, error } = await supabase
      .from('contracts')
      .select(`
        id,
        arr,
        start_date,
        end_date,
        contract_term
      `)
      .eq('customer_id', customerId)
      .eq('status', 'active')
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    if (error || !data) {
      console.error('Error fetching contract:', error);
      return null;
    }

    // Get entitlements
    const { data: entitlements } = await supabase
      .from('entitlements')
      .select('name, quantity, unit')
      .eq('contract_id', data.id);

    return {
      ...data,
      terms: data.contract_term,
      entitlements: entitlements || [],
    };
  }

  /**
   * Get renewal pipeline data for customer
   */
  private async getRenewalPipelineData(customerId: string): Promise<RenewalPipelineData | null> {
    if (!supabase) return null;

    const { data, error } = await supabase
      .from('renewal_pipeline')
      .select('*')
      .eq('customer_id', customerId)
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    if (error || !data) {
      // Create new pipeline record if doesn't exist
      console.log('No renewal pipeline found, will be created on proposal generation');
      return null;
    }

    return data;
  }

  /**
   * Get usage metrics for customer
   */
  private async getUsageMetrics(customerId: string): Promise<UsageMetrics> {
    if (!supabase) {
      return this.getDefaultUsageMetrics();
    }

    // Get recent usage metrics
    const { data: metrics } = await supabase
      .from('usage_metrics')
      .select('*')
      .eq('customer_id', customerId)
      .order('metric_date', { ascending: false })
      .limit(30);

    if (!metrics || metrics.length === 0) {
      return this.getDefaultUsageMetrics();
    }

    const latestMetric = metrics[0];

    // Calculate YoY change if we have data from a year ago
    const yearAgoMetric = metrics.find((m: any) => {
      const date = new Date(m.metric_date);
      const yearAgo = new Date();
      yearAgo.setFullYear(yearAgo.getFullYear() - 1);
      return Math.abs(date.getTime() - yearAgo.getTime()) < 30 * 24 * 60 * 60 * 1000;
    });

    const yoyChange = yearAgoMetric
      ? ((latestMetric.mau - yearAgoMetric.mau) / yearAgoMetric.mau) * 100
      : undefined;

    return {
      dau: latestMetric.dau || 0,
      mau: latestMetric.mau || 0,
      login_count: latestMetric.login_count || 0,
      api_calls: latestMetric.api_calls || 0,
      feature_adoption: latestMetric.feature_adoption || {},
      usage_trend: latestMetric.usage_trend || 'stable',
      adoption_score: latestMetric.adoption_score || 70,
      yoy_change: yoyChange,
    };
  }

  private getDefaultUsageMetrics(): UsageMetrics {
    return {
      dau: 0,
      mau: 0,
      login_count: 0,
      api_calls: 0,
      feature_adoption: {},
      usage_trend: 'stable',
      adoption_score: 70,
      yoy_change: undefined,
    };
  }

  /**
   * Calculate value metrics based on usage and contract data
   */
  private calculateValueMetrics(
    customer: CustomerData,
    usageMetrics: UsageMetrics,
    contract: ContractData | null
  ): ValueMetrics {
    const arr = customer.arr || contract?.arr || 100000;

    // Calculate estimated value based on usage patterns
    const adoptionMultiplier = usageMetrics.adoption_score / 100;
    const usageTrendMultiplier = usageMetrics.usage_trend === 'growing' ? 1.3 :
                                  usageMetrics.usage_trend === 'declining' ? 0.8 : 1.0;

    // Value calculation formula (simplified)
    const totalValueDelivered = Math.round(arr * 3 * adoptionMultiplier * usageTrendMultiplier);

    // Efficiency improvement based on adoption
    const efficiencyImprovement = Math.round(20 + (adoptionMultiplier * 30));

    // Time saved calculation (hours per month * 12)
    const timeSavedHours = Math.round(usageMetrics.mau * 2 * 12);

    // Cost savings (roughly 30% of value delivered)
    const costSavings = Math.round(totalValueDelivered * 0.3);

    // ROI calculation
    const roi = Math.round(((totalValueDelivered - arr) / arr) * 100);

    // Generate key wins based on feature adoption
    const adoptedFeatures = Object.entries(usageMetrics.feature_adoption)
      .filter(([_, data]) => data.adopted)
      .map(([feature]) => feature);

    const keyWins: string[] = [];
    if (efficiencyImprovement > 30) {
      keyWins.push(`${efficiencyImprovement}% efficiency improvement`);
    }
    if (adoptedFeatures.length >= 3) {
      keyWins.push(`${adoptedFeatures.length} key features fully adopted`);
    }
    if (usageMetrics.yoy_change && usageMetrics.yoy_change > 10) {
      keyWins.push(`${Math.round(usageMetrics.yoy_change)}% YoY usage growth`);
    }
    if (timeSavedHours > 1000) {
      keyWins.push(`${timeSavedHours.toLocaleString()} hours saved annually`);
    }

    return {
      totalValueDelivered,
      efficiencyImprovement,
      timeSavedHours,
      costSavings,
      roi,
      keyWins,
      newUseCases: adoptedFeatures.slice(0, 3),
    };
  }

  /**
   * Generate pricing options based on customer data
   */
  private generatePricingOptions(
    customer: CustomerData,
    contract: ContractData | null,
    valueMetrics: ValueMetrics,
    renewalPipeline: RenewalPipelineData | null
  ): PricingOption[] {
    const currentArr = customer.arr || contract?.arr || 100000;
    const expansionPotential = renewalPipeline?.expansion_potential || 0;

    // Option A: Flat renewal
    const optionA: PricingOption = {
      name: 'Option A: Standard Renewal',
      description: 'Continue with current plan and feature set',
      arr: currentArr,
      change: 'No change',
      changePercent: 0,
      features: [
        'All current features',
        'Standard support SLA',
        'Current user limit',
        'Existing integrations',
      ],
    };

    // Option B: Growth tier (10-15% increase)
    const growthMultiplier = 1.15;
    const growthArr = Math.round(currentArr * growthMultiplier);
    const optionB: PricingOption = {
      name: 'Option B: Growth Tier',
      description: 'Enhanced support and expanded capacity',
      arr: growthArr,
      change: `+$${(growthArr - currentArr).toLocaleString()}`,
      changePercent: Math.round((growthMultiplier - 1) * 100),
      features: [
        'All current features',
        'Premium support SLA (4hr response)',
        '+2 additional seats',
        'Advanced analytics dashboard',
        'Dedicated success manager',
      ],
      recommended: valueMetrics.roi > 200, // Recommend if strong ROI
    };

    // Option C: Enterprise upgrade (40-60% increase)
    const enterpriseMultiplier = 1.5;
    const enterpriseArr = Math.round(currentArr * enterpriseMultiplier);
    const optionC: PricingOption = {
      name: 'Option C: Enterprise',
      description: 'Full platform access with enterprise features',
      arr: enterpriseArr,
      change: `+$${(enterpriseArr - currentArr).toLocaleString()}`,
      changePercent: Math.round((enterpriseMultiplier - 1) * 100),
      features: [
        'Full platform access',
        'Enterprise support SLA (1hr response)',
        'Unlimited seats',
        'Custom integrations',
        'Executive business reviews',
        'Early access to new features',
        'Custom training program',
      ],
    };

    // Set recommended based on expansion potential
    if (expansionPotential > currentArr * 0.3) {
      optionC.recommended = true;
      optionB.recommended = false;
    }

    return [optionA, optionB, optionC];
  }

  /**
   * Get health score trend
   */
  private async getHealthScoreTrend(customerId: string, currentHealthScore: number): Promise<{
    current: number;
    direction: 'up' | 'down' | 'stable';
    previousQuarter: number;
  }> {
    if (!supabase) {
      return {
        current: currentHealthScore,
        direction: 'stable',
        previousQuarter: currentHealthScore,
      };
    }

    // Get historical health scores if available
    const threeMonthsAgo = new Date();
    threeMonthsAgo.setMonth(threeMonthsAgo.getMonth() - 3);

    const { data: historicalData } = await supabase
      .from('usage_metrics')
      .select('adoption_score, metric_date')
      .eq('customer_id', customerId)
      .gte('metric_date', threeMonthsAgo.toISOString().split('T')[0])
      .order('metric_date', { ascending: true });

    if (!historicalData || historicalData.length === 0) {
      return {
        current: currentHealthScore,
        direction: 'stable',
        previousQuarter: currentHealthScore,
      };
    }

    const previousQuarter = historicalData[0]?.adoption_score || currentHealthScore;
    const diff = currentHealthScore - previousQuarter;

    let direction: 'up' | 'down' | 'stable' = 'stable';
    if (diff > 5) direction = 'up';
    else if (diff < -5) direction = 'down';

    return {
      current: currentHealthScore,
      direction,
      previousQuarter,
    };
  }

  /**
   * Preview proposal content before generation
   */
  async previewProposal(customerId: string, userId: string): Promise<PreviewContent | null> {
    const customer = await this.getCustomerData(customerId);
    if (!customer) {
      throw new Error('Customer not found');
    }

    const contract = await this.getContractData(customerId);
    const renewalPipeline = await this.getRenewalPipelineData(customerId);
    const usageMetrics = await this.getUsageMetrics(customerId);
    const valueMetrics = this.calculateValueMetrics(customer, usageMetrics, contract);
    const pricingOptions = this.generatePricingOptions(customer, contract, valueMetrics, renewalPipeline);
    const healthScoreTrend = await this.getHealthScoreTrend(customerId, customer.health_score);

    // Calculate days until renewal
    const renewalDate = renewalPipeline?.renewal_date || customer.renewal_date || contract?.end_date;
    const daysUntilRenewal = renewalDate
      ? Math.ceil((new Date(renewalDate).getTime() - Date.now()) / (1000 * 60 * 60 * 24))
      : 90;

    const proposalContent: ProposalContent = {
      customer,
      contract: contract || { id: '', arr: customer.arr, start_date: '', end_date: '' },
      renewalPipeline: renewalPipeline || {
        id: '',
        customer_id: customerId,
        renewal_date: renewalDate || '',
        current_arr: customer.arr,
        proposed_arr: customer.arr,
        probability: 50,
        stage: 'early',
        risk_factors: [],
        expansion_potential: 0,
        champion_engaged: false,
        exec_sponsor_engaged: false,
        qbr_completed: false,
        value_summary_sent: false,
        proposal_sent: false,
      },
      usageMetrics,
      valueMetrics,
      pricingOptions,
      healthScoreTrend,
      daysUntilRenewal,
    };

    // Generate section previews
    const proposalSections = {
      executiveSummary: this.generateExecutiveSummary(proposalContent),
      partnershipTimeline: this.generatePartnershipTimeline(proposalContent),
      valueDelivered: this.generateValueDeliveredSection(proposalContent),
      pricingOptions: this.generatePricingOptionsSection(proposalContent),
      nextSteps: this.generateNextStepsSection(proposalContent),
    };

    return {
      ...proposalContent,
      proposalSections,
    };
  }

  /**
   * Generate complete renewal proposal package
   */
  async generateProposal(
    customerId: string,
    userId: string,
    options: {
      generateSlides?: boolean;
      customPricingOptions?: PricingOption[];
    } = {}
  ): Promise<RenewalProposalPackage> {
    const preview = await this.previewProposal(customerId, userId);
    if (!preview) {
      throw new Error('Failed to generate proposal preview');
    }

    const { customer, valueMetrics, pricingOptions, daysUntilRenewal, healthScoreTrend } = preview;
    const finalPricingOptions = options.customPricingOptions || pricingOptions;

    // Create proposal document
    const docVariables: Record<string, string> = {
      customerName: customer.name,
      renewalDate: preview.renewalPipeline.renewal_date || 'TBD',
      summary: this.generateExecutiveSummary(preview),
      valueDelivered: this.generateValueDeliveredSection(preview),
      roiAnalysis: `Your partnership with us has delivered a ${valueMetrics.roi}% ROI, with total estimated business impact of $${valueMetrics.totalValueDelivered.toLocaleString()}. Key efficiency gains include ${valueMetrics.efficiencyImprovement}% improvement in core processes and ${valueMetrics.timeSavedHours.toLocaleString()} hours saved annually.`,
      terms: this.generatePricingOptionsSection({ ...preview, pricingOptions: finalPricingOptions }),
      expansion: preview.renewalPipeline.expansion_potential > 0
        ? `Based on your usage patterns and growth trajectory, we see an opportunity to expand your capabilities with additional features valued at $${preview.renewalPipeline.expansion_potential.toLocaleString()}.`
        : 'We continue to monitor your usage for potential expansion opportunities that align with your business goals.',
      nextSteps: this.generateNextStepsSection(preview),
    };

    // Get or create customer folder
    let folderId: string | undefined;
    try {
      const folderName = `CSCX - ${customer.name}`;
      const existingFolder = await driveService.findFolder(userId, folderName);
      folderId = existingFolder || (await driveService.createFolder(userId, folderName));
    } catch (e) {
      console.log('Could not access drive for folder, continuing without folder');
    }

    // Create the document
    const doc = await docsService.createFromTemplate(
      userId,
      'renewal_proposal',
      docVariables,
      folderId
    );

    // Share with primary contact if available
    if (customer.primary_contact?.email) {
      try {
        await docsService.shareDocument(userId, doc.id, customer.primary_contact.email, 'reader');
      } catch (e) {
        console.error('Failed to share document:', e);
      }
    }

    // Generate email draft
    const emailDraft = this.generateProposalEmail(preview, doc.webViewLink || `https://docs.google.com/document/d/${doc.id}/edit`, finalPricingOptions);

    // Update renewal pipeline
    await this.updateRenewalPipelineWithProposal(customerId, doc.webViewLink || doc.id);

    // Log activity
    await activityLogger.log({
      agentType: 'renewal',
      actionType: 'renewal_proposal',
      customerId,
      userId,
      actionData: {
        proposalDocId: doc.id,
        pricingOptions: finalPricingOptions.map(o => ({ name: o.name, arr: o.arr })),
        daysUntilRenewal,
      },
      resultData: {
        success: true,
        docUrl: doc.webViewLink,
      },
      status: 'completed',
    });

    return {
      proposalDocId: doc.id,
      proposalDocUrl: doc.webViewLink || `https://docs.google.com/document/d/${doc.id}/edit`,
      emailDraft,
      summary: {
        currentArr: customer.arr,
        pricingOptions: finalPricingOptions,
        daysUntilRenewal,
        healthScore: healthScoreTrend.current,
        valueDelivered: valueMetrics.totalValueDelivered,
      },
    };
  }

  /**
   * Send renewal proposal email
   */
  async sendProposal(
    customerId: string,
    userId: string,
    emailOverrides?: Partial<SendEmailOptions>
  ): Promise<{ messageId: string; success: boolean }> {
    const preview = await this.previewProposal(customerId, userId);
    if (!preview) {
      throw new Error('Failed to preview proposal');
    }

    const { customer, renewalPipeline } = preview;

    if (!customer.primary_contact?.email) {
      throw new Error('No primary contact email found for customer');
    }

    // Get existing proposal doc URL or generate new proposal
    let proposalUrl = renewalPipeline.proposal_doc_url;
    if (!proposalUrl) {
      const proposal = await this.generateProposal(customerId, userId);
      proposalUrl = proposal.proposalDocUrl;
    }

    const emailContent = this.generateProposalEmail(preview, proposalUrl, preview.pricingOptions);

    const emailOptions: SendEmailOptions = {
      to: [customer.primary_contact.email],
      subject: emailContent.subject,
      bodyHtml: emailOverrides?.bodyHtml || emailContent.bodyHtml,
      bodyText: emailOverrides?.bodyText || emailContent.bodyText,
      saveToDb: true,
      customerId,
      ...emailOverrides,
    };

    const messageId = await gmailService.sendEmail(userId, emailOptions);

    // Update renewal pipeline with sent timestamp
    await this.markProposalSent(customerId);

    // Log activity
    await activityLogger.log({
      agentType: 'renewal',
      actionType: 'send_email',
      customerId,
      userId,
      actionData: {
        type: 'renewal_proposal',
        recipient: customer.primary_contact.email,
        proposalUrl,
      },
      resultData: {
        success: true,
        messageId,
      },
      status: 'completed',
    });

    return { messageId, success: true };
  }

  /**
   * Update renewal pipeline with proposal info
   */
  private async updateRenewalPipelineWithProposal(customerId: string, proposalUrl: string): Promise<void> {
    if (!supabase) return;

    // Check if pipeline record exists
    const { data: existing } = await supabase
      .from('renewal_pipeline')
      .select('id')
      .eq('customer_id', customerId)
      .limit(1)
      .single();

    if (existing) {
      // Update existing record
      await supabase
        .from('renewal_pipeline')
        .update({
          proposal_doc_url: proposalUrl,
          updated_at: new Date().toISOString(),
        })
        .eq('id', existing.id);
    } else {
      // Create new pipeline record
      const { data: customer } = await supabase
        .from('customers')
        .select('arr, renewal_date')
        .eq('id', customerId)
        .single();

      if (customer) {
        await supabase
          .from('renewal_pipeline')
          .insert({
            customer_id: customerId,
            renewal_date: customer.renewal_date || new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
            current_arr: customer.arr || 0,
            proposed_arr: customer.arr || 0,
            probability: 50,
            stage: 'mid',
            proposal_doc_url: proposalUrl,
          });
      }
    }
  }

  /**
   * Mark proposal as sent in renewal pipeline
   */
  private async markProposalSent(customerId: string): Promise<void> {
    if (!supabase) return;

    await supabase
      .from('renewal_pipeline')
      .update({
        proposal_sent: true,
        proposal_sent_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('customer_id', customerId);
  }

  // ========== Section Generators ==========

  private generateExecutiveSummary(content: ProposalContent): string {
    const { customer, valueMetrics, healthScoreTrend, daysUntilRenewal } = content;
    const trendText = healthScoreTrend.direction === 'up' ? 'continues to grow' :
                      healthScoreTrend.direction === 'down' ? 'has shown some challenges' : 'remains strong';

    return `As we approach the renewal of our partnership with ${customer.name} in ${daysUntilRenewal} days, we're pleased to reflect on the value we've delivered together. Your investment of $${customer.arr.toLocaleString()} has generated an estimated ${valueMetrics.roi}% return on investment, with total business impact of $${valueMetrics.totalValueDelivered.toLocaleString()}.

Your engagement ${trendText}, with a current health score of ${healthScoreTrend.current}. This proposal outlines our recommendations for continuing and expanding our successful collaboration.`;
  }

  private generatePartnershipTimeline(content: ProposalContent): string {
    const { contract, valueMetrics } = content;
    const startDate = contract.start_date ? new Date(contract.start_date).toLocaleDateString() : 'N/A';

    return `Since our partnership began on ${startDate}, we have achieved the following milestones:

${valueMetrics.keyWins.map(win => `• ${win}`).join('\n')}

${valueMetrics.newUseCases.length > 0 ? `New capabilities adopted: ${valueMetrics.newUseCases.join(', ')}` : ''}`;
  }

  private generateValueDeliveredSection(content: ProposalContent): string {
    const { valueMetrics, usageMetrics } = content;

    return `**Business Impact Summary**

• Total Value Delivered: $${valueMetrics.totalValueDelivered.toLocaleString()}
• Efficiency Improvement: ${valueMetrics.efficiencyImprovement}%
• Time Saved: ${valueMetrics.timeSavedHours.toLocaleString()} hours annually
• Cost Savings: $${valueMetrics.costSavings.toLocaleString()}
• Return on Investment: ${valueMetrics.roi}%

**Usage Highlights**
• Monthly Active Users: ${usageMetrics.mau.toLocaleString()}
• Adoption Score: ${usageMetrics.adoption_score}%
• Usage Trend: ${usageMetrics.usage_trend.charAt(0).toUpperCase() + usageMetrics.usage_trend.slice(1)}${usageMetrics.yoy_change ? ` (+${Math.round(usageMetrics.yoy_change)}% YoY)` : ''}`;
  }

  private generatePricingOptionsSection(content: ProposalContent): string {
    const { pricingOptions } = content;

    return pricingOptions.map(option => {
      const recommended = option.recommended ? ' **RECOMMENDED**' : '';
      return `**${option.name}**${recommended}
${option.description}
Annual Investment: $${option.arr.toLocaleString()} (${option.change})

Includes:
${option.features.map(f => `• ${f}`).join('\n')}`;
    }).join('\n\n---\n\n');
  }

  private generateNextStepsSection(content: ProposalContent): string {
    const { daysUntilRenewal, customer } = content;

    const urgency = daysUntilRenewal <= 30 ? 'To ensure continuity of service' :
                    daysUntilRenewal <= 60 ? 'As we approach your renewal date' :
                    'To help you plan ahead';

    return `${urgency}, we recommend the following next steps:

1. **Review this proposal** - Take time to review the options and discuss with your team
2. **Schedule a call** - Let's connect to discuss any questions and your business priorities for the coming year
3. **Confirm your preferred option** - Once you've decided, we'll prepare the updated agreement
4. **Sign and process** - Complete the renewal process before your current contract expires

We're committed to your continued success and look forward to expanding our partnership with ${customer.name}.

Please don't hesitate to reach out with any questions.`;
  }

  /**
   * Generate proposal email content
   */
  private generateProposalEmail(
    content: ProposalContent,
    proposalUrl: string,
    pricingOptions: PricingOption[]
  ): { to: string; subject: string; bodyHtml: string; bodyText: string } {
    const { customer, valueMetrics, daysUntilRenewal, healthScoreTrend } = content;
    const contactName = customer.primary_contact?.name?.split(' ')[0] || 'there';
    const year = new Date().getFullYear() + 1;

    const subject = `${customer.name} Partnership Renewal Proposal - FY${year}`;

    const recommendedOption = pricingOptions.find(o => o.recommended);
    const optionsSummary = pricingOptions.map(o =>
      `• ${o.name}: $${o.arr.toLocaleString()}/year${o.recommended ? ' (Recommended)' : ''}`
    ).join('\n');

    const bodyText = `Hi ${contactName},

As we approach the renewal of our partnership, I'm excited to share our proposal for continuing and expanding our collaboration.

Over the past year, your team has achieved impressive results:
• ${valueMetrics.roi}% ROI on your investment
• $${valueMetrics.totalValueDelivered.toLocaleString()} in estimated business impact
• ${valueMetrics.efficiencyImprovement}% efficiency improvement

Your health score of ${healthScoreTrend.current} reflects strong engagement and adoption.

I've prepared a comprehensive renewal proposal with three options:

${optionsSummary}

${recommendedOption ? `Based on your growth trajectory, I'd recommend ${recommendedOption.name} to maximize your team's success.` : ''}

View the full proposal here: ${proposalUrl}

I'd love to schedule a call to discuss this in more detail and answer any questions you might have. What time works best for you this week?

Best regards`;

    const bodyHtml = `<div style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
  <p>Hi ${contactName},</p>

  <p>As we approach the renewal of our partnership, I'm excited to share our proposal for continuing and expanding our collaboration.</p>

  <p>Over the past year, your team has achieved impressive results:</p>
  <ul>
    <li><strong>${valueMetrics.roi}% ROI</strong> on your investment</li>
    <li><strong>$${valueMetrics.totalValueDelivered.toLocaleString()}</strong> in estimated business impact</li>
    <li><strong>${valueMetrics.efficiencyImprovement}%</strong> efficiency improvement</li>
  </ul>

  <p>Your health score of <strong>${healthScoreTrend.current}</strong> reflects strong engagement and adoption.</p>

  <p>I've prepared a comprehensive renewal proposal with three options:</p>

  <div style="background: #f5f5f5; padding: 15px; border-radius: 8px; margin: 15px 0;">
    ${pricingOptions.map(o => `
      <p style="margin: 8px 0;">
        <strong>${o.name}:</strong> $${o.arr.toLocaleString()}/year
        ${o.recommended ? '<span style="color: #22c55e; font-size: 12px; margin-left: 8px;">★ RECOMMENDED</span>' : ''}
      </p>
    `).join('')}
  </div>

  ${recommendedOption ? `<p>Based on your growth trajectory, I'd recommend <strong>${recommendedOption.name}</strong> to maximize your team's success.</p>` : ''}

  <p>
    <a href="${proposalUrl}" style="display: inline-block; background: #e63946; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; margin: 10px 0;">
      View Full Proposal
    </a>
  </p>

  <p>I'd love to schedule a call to discuss this in more detail and answer any questions you might have. What time works best for you this week?</p>

  <p>Best regards</p>
</div>`;

    return {
      to: customer.primary_contact?.email || '',
      subject,
      bodyHtml,
      bodyText,
    };
  }
}

// Singleton instance
export const renewalProposalGenerator = new RenewalProposalGeneratorService();
