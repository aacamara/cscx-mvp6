/**
 * Win-Back Sequence Generator Service
 * PRD-030: Win-Back Campaign Generator
 *
 * Generates personalized win-back email campaigns for churned customers.
 * Analyzes churn history, usage patterns, and product updates to create
 * targeted re-engagement sequences.
 */

import { v4 as uuidv4 } from 'uuid';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { config } from '../../config/index.js';
import {
  generateWinbackDay1Email,
  generateWinbackDay7Email,
  generateWinbackDay14Email,
  generateWinbackDay21Email,
  generateWinbackDay28Email,
} from '../../templates/emails/index.js';

// Types
export interface ChurnedCustomerData {
  id: string;
  name: string;
  industry?: string;
  previousArr?: number;
  churnedAt: Date;
  churnReason?: string;
  churnCategory?: string;
  tenureMonths?: number;
  lastContactName?: string;
  lastContactEmail?: string;
  productUpdatesSinceChurn?: ProductUpdate[];
}

export interface ProductUpdate {
  title: string;
  description: string;
  releaseDate?: string;
  category?: 'feature' | 'performance' | 'integration' | 'pricing';
}

export interface StakeholderContact {
  name: string;
  email: string;
  title?: string;
  stillAtCompany?: boolean;
}

export interface CSMData {
  name: string;
  email: string;
  title?: string;
  phone?: string;
  calendarLink?: string;
}

export interface ChurnAnalysis {
  reason: string;
  category: string;
  recoveryPotential: 'high' | 'medium' | 'low';
  recommendedApproach: 'product_update' | 'special_offer' | 'relationship' | 'case_study';
  relevantUpdates: ProductUpdate[];
  pastSuccesses?: PastSuccess[];
}

export interface PastSuccess {
  metric: string;
  value: string;
  context?: string;
}

export interface CaseStudy {
  companyName: string;
  industry: string;
  situation: string;
  result: string;
  quote?: {
    text: string;
    author: string;
    title: string;
  };
  metrics?: Array<{ label: string; value: string }>;
}

export interface SpecialOffer {
  title: string;
  description: string;
  discountPercentage?: number;
  validUntil?: string;
}

export interface WinBackCampaignOptions {
  customerId: string;
  userId: string;
  customer: ChurnedCustomerData;
  targetContact: StakeholderContact;
  csm: CSMData;
  productName?: string;
  approach?: 'product_update' | 'special_offer' | 'relationship' | 'case_study';
  churnAnalysis?: ChurnAnalysis;
  caseStudy?: CaseStudy;
  specialOffer?: SpecialOffer;
  customVariables?: Record<string, any>;
}

export interface GeneratedWinBackCampaign {
  id: string;
  customerId: string;
  name: string;
  status: 'draft' | 'scheduled' | 'active' | 'paused' | 'completed' | 'cancelled';
  approach: string;
  targetContactName: string;
  targetContactEmail: string;
  startDate: Date;
  endDate: Date;
  totalEmails: number;
  items: GeneratedWinBackCampaignItem[];
  churnAnalysis?: ChurnAnalysis;
}

export interface GeneratedWinBackCampaignItem {
  id: string;
  itemOrder: number;
  dayOffset: number;
  sendTime: string;
  scheduledAt: Date;
  purpose: 'reconnect' | 'value_reminder' | 'new_capabilities' | 'social_proof' | 'final_invitation';
  subject: string;
  bodyHtml: string;
  bodyText: string;
  toEmail: string;
  status: 'pending' | 'scheduled' | 'sent' | 'opened' | 'clicked' | 'replied' | 'bounced';
}

export interface WinBackSuccessMetrics {
  totalCampaigns: number;
  completedCampaigns: number;
  successfulCampaigns: number;
  successRate: number;
  totalWonBackArr: number;
  avgWonBackArr: number;
  campaignsWithReplies: number;
  avgOpenRate: number;
  avgClickRate: number;
}

/**
 * Win-Back Sequence Generator
 * Creates personalized 5-email win-back sequences for churned customers
 */
export class WinBackSequenceGenerator {
  private supabase: SupabaseClient | null = null;

  constructor() {
    if (config.supabaseUrl && config.supabaseServiceKey) {
      this.supabase = createClient(config.supabaseUrl, config.supabaseServiceKey);
    }
  }

  /**
   * Analyze a churned customer and generate recommendations
   */
  async analyzeChurnedCustomer(customerId: string): Promise<ChurnAnalysis | null> {
    if (!this.supabase) return null;

    // Fetch customer data
    const { data: customer, error } = await this.supabase
      .from('customers')
      .select('*')
      .eq('id', customerId)
      .single();

    if (error || !customer) {
      console.error('Failed to fetch customer for churn analysis:', error);
      return null;
    }

    // Fetch product updates since churn
    const churnDate = customer.churned_at ? new Date(customer.churned_at) : new Date();
    const productUpdates = customer.product_updates_since_churn || [];

    // Determine recovery potential based on churn reason and tenure
    let recoveryPotential: 'high' | 'medium' | 'low' = 'medium';
    const churnCategory = customer.churn_category?.toLowerCase() || '';
    const tenureMonths = customer.tenure_months || 0;

    // High potential: budget issues, timing problems, feature gaps (now addressed)
    if (['budget', 'timing', 'delayed_project', 'feature_gap'].some(c => churnCategory.includes(c))) {
      recoveryPotential = 'high';
    }
    // Low potential: competitor win, executive mandate, company closure
    else if (['competitor', 'executive_mandate', 'closed', 'acquired'].some(c => churnCategory.includes(c))) {
      recoveryPotential = 'low';
    }

    // Longer tenure increases recovery potential
    if (tenureMonths > 24 && recoveryPotential === 'medium') {
      recoveryPotential = 'high';
    }

    // Determine recommended approach
    let recommendedApproach: 'product_update' | 'special_offer' | 'relationship' | 'case_study' = 'relationship';

    if (productUpdates.length > 0) {
      recommendedApproach = 'product_update';
    } else if (churnCategory.includes('budget') || churnCategory.includes('pricing')) {
      recommendedApproach = 'special_offer';
    } else if (tenureMonths > 12) {
      recommendedApproach = 'relationship';
    }

    // Fetch past successes from usage metrics if available
    const pastSuccesses: PastSuccess[] = [];

    const { data: usageData } = await this.supabase
      .from('usage_metrics')
      .select('*')
      .eq('customer_id', customerId)
      .order('metric_date', { ascending: false })
      .limit(10);

    if (usageData && usageData.length > 0) {
      // Extract meaningful metrics
      const avgHealthScore = usageData.reduce((sum, d) => sum + (d.health_score || 0), 0) / usageData.length;
      if (avgHealthScore > 70) {
        pastSuccesses.push({
          metric: 'Average Health Score',
          value: `${Math.round(avgHealthScore)}%`,
          context: 'During active period'
        });
      }
    }

    return {
      reason: customer.churn_reason || 'Not documented',
      category: customer.churn_category || 'unknown',
      recoveryPotential,
      recommendedApproach,
      relevantUpdates: productUpdates,
      pastSuccesses: pastSuccesses.length > 0 ? pastSuccesses : undefined,
    };
  }

  /**
   * Get list of churned customers for targeting
   */
  async getChurnedCustomers(options: {
    minMonthsSinceChurn?: number;
    maxMonthsSinceChurn?: number;
    minPreviousArr?: number;
    excludeRecentAttempts?: boolean;
    limit?: number;
  } = {}): Promise<ChurnedCustomerData[]> {
    if (!this.supabase) return [];

    let query = this.supabase
      .from('churned_customers')
      .select('*');

    if (options.minMonthsSinceChurn) {
      query = query.gte('months_since_churn', options.minMonthsSinceChurn);
    }

    if (options.maxMonthsSinceChurn) {
      query = query.lte('months_since_churn', options.maxMonthsSinceChurn);
    }

    if (options.minPreviousArr) {
      query = query.gte('previous_arr', options.minPreviousArr);
    }

    if (options.excludeRecentAttempts) {
      // Exclude customers with win-back attempts in last 90 days
      const ninetyDaysAgo = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString();
      query = query.or(`last_winback_attempt.is.null,last_winback_attempt.lt.${ninetyDaysAgo}`);
    }

    if (options.limit) {
      query = query.limit(options.limit);
    }

    const { data, error } = await query.order('previous_arr', { ascending: false });

    if (error) {
      console.error('Failed to fetch churned customers:', error);
      return [];
    }

    return (data || []).map(c => ({
      id: c.id,
      name: c.name,
      industry: c.industry,
      previousArr: c.previous_arr,
      churnedAt: new Date(c.churned_at),
      churnReason: c.churn_reason,
      churnCategory: c.churn_category,
      tenureMonths: c.tenure_months,
      lastContactName: c.last_contact_name,
      lastContactEmail: c.last_contact_email,
      productUpdatesSinceChurn: c.product_updates_since_churn,
    }));
  }

  /**
   * Generate a complete win-back sequence for a churned customer
   */
  async generateCampaign(options: WinBackCampaignOptions): Promise<GeneratedWinBackCampaign> {
    const {
      customerId,
      customer,
      targetContact,
      csm,
      productName = 'our platform',
      approach = 'relationship',
      churnAnalysis,
      caseStudy,
      specialOffer,
    } = options;

    const campaignId = uuidv4();
    const startDate = new Date();
    const endDate = new Date(startDate.getTime() + 28 * 24 * 60 * 60 * 1000); // 28 days

    const monthsSinceChurn = Math.floor(
      (Date.now() - customer.churnedAt.getTime()) / (1000 * 60 * 60 * 24 * 30)
    );

    const items: GeneratedWinBackCampaignItem[] = [];

    // Day 1 - Reconnect
    const day1 = generateWinbackDay1Email({
      customerName: customer.name,
      contactName: targetContact.name,
      contactTitle: targetContact.title,
      csmName: csm.name,
      csmEmail: csm.email,
      csmTitle: csm.title,
      productName,
      monthsSinceChurn,
      previousArr: customer.previousArr,
      tenureYears: customer.tenureMonths ? Math.round(customer.tenureMonths / 12 * 10) / 10 : undefined,
      churnReason: customer.churnReason,
      productUpdates: churnAnalysis?.relevantUpdates?.slice(0, 3),
    });

    items.push({
      id: uuidv4(),
      itemOrder: 1,
      dayOffset: 0,
      sendTime: '09:00',
      scheduledAt: this.calculateSendDate(startDate, 0, '09:00'),
      purpose: 'reconnect',
      subject: day1.subject,
      bodyHtml: day1.bodyHtml,
      bodyText: day1.bodyText,
      toEmail: targetContact.email,
      status: 'pending',
    });

    // Day 7 - Value Reminder
    const day7 = generateWinbackDay7Email({
      customerName: customer.name,
      contactName: targetContact.name,
      csmName: csm.name,
      csmEmail: csm.email,
      productName,
      pastSuccesses: churnAnalysis?.pastSuccesses,
      roi: customer.previousArr && customer.previousArr > 100000 ? {
        percentage: 3,
        timeframe: 'first year'
      } : undefined,
    });

    items.push({
      id: uuidv4(),
      itemOrder: 2,
      dayOffset: 6,
      sendTime: '10:00',
      scheduledAt: this.calculateSendDate(startDate, 6, '10:00'),
      purpose: 'value_reminder',
      subject: day7.subject,
      bodyHtml: day7.bodyHtml,
      bodyText: day7.bodyText,
      toEmail: targetContact.email,
      status: 'pending',
    });

    // Day 14 - New Capabilities
    const requestedFeature = churnAnalysis?.relevantUpdates?.find(
      u => u.category === 'feature'
    );

    const day14 = generateWinbackDay14Email({
      customerName: customer.name,
      contactName: targetContact.name,
      csmName: csm.name,
      csmEmail: csm.email,
      productName,
      requestedFeature: requestedFeature ? {
        name: requestedFeature.title,
        description: requestedFeature.description,
        benefits: ['Improved efficiency', 'Better ROI', 'Enhanced user experience'],
      } : undefined,
      newFeatures: churnAnalysis?.relevantUpdates?.filter(u => u.category !== 'feature').slice(0, 3).map(u => ({
        name: u.title,
        description: u.description,
        releaseDate: u.releaseDate,
      })),
      performanceImprovements: churnAnalysis?.relevantUpdates
        ?.filter(u => u.category === 'performance')
        .map(u => ({
          metric: u.title,
          improvement: u.description,
        })),
    });

    items.push({
      id: uuidv4(),
      itemOrder: 3,
      dayOffset: 13,
      sendTime: '10:00',
      scheduledAt: this.calculateSendDate(startDate, 13, '10:00'),
      purpose: 'new_capabilities',
      subject: day14.subject,
      bodyHtml: day14.bodyHtml,
      bodyText: day14.bodyText,
      toEmail: targetContact.email,
      status: 'pending',
    });

    // Day 21 - Social Proof
    const day21 = generateWinbackDay21Email({
      customerName: customer.name,
      contactName: targetContact.name,
      csmName: csm.name,
      csmEmail: csm.email,
      productName,
      caseStudy: caseStudy || (customer.industry ? {
        companyName: 'Similar Company',
        industry: customer.industry,
        situation: 'Returned after a brief break and saw immediate value',
        result: 'Achieved 40% better results than their previous engagement',
        metrics: [
          { label: 'Time to Value', value: '2 weeks' },
          { label: 'ROI', value: '3.5x' },
        ],
      } : undefined),
      specialOffer,
    });

    items.push({
      id: uuidv4(),
      itemOrder: 4,
      dayOffset: 20,
      sendTime: '10:00',
      scheduledAt: this.calculateSendDate(startDate, 20, '10:00'),
      purpose: 'social_proof',
      subject: day21.subject,
      bodyHtml: day21.bodyHtml,
      bodyText: day21.bodyText,
      toEmail: targetContact.email,
      status: 'pending',
    });

    // Day 28 - Final Invitation
    const day28 = generateWinbackDay28Email({
      customerName: customer.name,
      contactName: targetContact.name,
      csmName: csm.name,
      csmEmail: csm.email,
      csmPhone: csm.phone,
      productName,
      calendarLink: csm.calendarLink,
      localMeetingOption: false,
    });

    items.push({
      id: uuidv4(),
      itemOrder: 5,
      dayOffset: 27,
      sendTime: '14:00',
      scheduledAt: this.calculateSendDate(startDate, 27, '14:00'),
      purpose: 'final_invitation',
      subject: day28.subject,
      bodyHtml: day28.bodyHtml,
      bodyText: day28.bodyText,
      toEmail: targetContact.email,
      status: 'pending',
    });

    const campaign: GeneratedWinBackCampaign = {
      id: campaignId,
      customerId,
      name: `${customer.name} Win-Back Campaign`,
      status: 'draft',
      approach,
      targetContactName: targetContact.name,
      targetContactEmail: targetContact.email,
      startDate,
      endDate,
      totalEmails: items.length,
      items,
      churnAnalysis,
    };

    return campaign;
  }

  /**
   * Save a generated campaign to the database
   */
  async saveCampaign(
    userId: string,
    campaign: GeneratedWinBackCampaign
  ): Promise<{ success: boolean; campaignId?: string; error?: string }> {
    if (!this.supabase) {
      return { success: false, error: 'Database not configured' };
    }

    try {
      // Insert campaign
      const { error: campaignError } = await this.supabase
        .from('winback_campaigns')
        .insert({
          id: campaign.id,
          customer_id: campaign.customerId,
          user_id: userId,
          name: campaign.name,
          status: campaign.status,
          approach: campaign.approach,
          target_contact_name: campaign.targetContactName,
          target_contact_email: campaign.targetContactEmail,
          total_emails: campaign.totalEmails,
          start_date: campaign.startDate.toISOString(),
          end_date: campaign.endDate.toISOString(),
          churn_analysis: campaign.churnAnalysis,
        });

      if (campaignError) {
        console.error('Error saving campaign:', campaignError);
        return { success: false, error: campaignError.message };
      }

      // Insert campaign items
      const itemsToInsert = campaign.items.map(item => ({
        id: item.id,
        campaign_id: campaign.id,
        item_order: item.itemOrder,
        day_offset: item.dayOffset,
        send_time: item.sendTime,
        subject: item.subject,
        body_html: item.bodyHtml,
        body_text: item.bodyText,
        purpose: item.purpose,
        to_email: item.toEmail,
        status: item.status,
        scheduled_at: item.scheduledAt.toISOString(),
      }));

      const { error: itemsError } = await this.supabase
        .from('winback_campaign_items')
        .insert(itemsToInsert);

      if (itemsError) {
        console.error('Error saving campaign items:', itemsError);
        // Rollback campaign
        await this.supabase.from('winback_campaigns').delete().eq('id', campaign.id);
        return { success: false, error: itemsError.message };
      }

      return { success: true, campaignId: campaign.id };
    } catch (error) {
      console.error('Error saving campaign:', error);
      return { success: false, error: (error as Error).message };
    }
  }

  /**
   * Activate a campaign (start sending)
   */
  async activateCampaign(campaignId: string): Promise<{ success: boolean; error?: string }> {
    if (!this.supabase) {
      return { success: false, error: 'Database not configured' };
    }

    try {
      const { error } = await this.supabase
        .from('winback_campaigns')
        .update({ status: 'active', updated_at: new Date().toISOString() })
        .eq('id', campaignId);

      if (error) {
        return { success: false, error: error.message };
      }

      // Update first pending item to scheduled
      await this.supabase
        .from('winback_campaign_items')
        .update({ status: 'scheduled', updated_at: new Date().toISOString() })
        .eq('campaign_id', campaignId)
        .eq('item_order', 1);

      return { success: true };
    } catch (error) {
      return { success: false, error: (error as Error).message };
    }
  }

  /**
   * Pause a campaign
   */
  async pauseCampaign(campaignId: string): Promise<{ success: boolean; error?: string }> {
    if (!this.supabase) {
      return { success: false, error: 'Database not configured' };
    }

    try {
      const { error } = await this.supabase
        .from('winback_campaigns')
        .update({ status: 'paused', updated_at: new Date().toISOString() })
        .eq('id', campaignId);

      if (error) {
        return { success: false, error: error.message };
      }

      return { success: true };
    } catch (error) {
      return { success: false, error: (error as Error).message };
    }
  }

  /**
   * Cancel a campaign
   */
  async cancelCampaign(campaignId: string): Promise<{ success: boolean; error?: string }> {
    if (!this.supabase) {
      return { success: false, error: 'Database not configured' };
    }

    try {
      const { error } = await this.supabase
        .from('winback_campaigns')
        .update({ status: 'cancelled', updated_at: new Date().toISOString() })
        .eq('id', campaignId);

      if (error) {
        return { success: false, error: error.message };
      }

      // Cancel all pending items
      await this.supabase
        .from('winback_campaign_items')
        .update({ status: 'cancelled', updated_at: new Date().toISOString() })
        .eq('campaign_id', campaignId)
        .in('status', ['pending', 'scheduled']);

      return { success: true };
    } catch (error) {
      return { success: false, error: (error as Error).message };
    }
  }

  /**
   * Record campaign outcome
   */
  async recordOutcome(
    campaignId: string,
    outcome: 'won_back' | 'no_response' | 'declined' | 'deferred',
    options: {
      notes?: string;
      wonBackArr?: number;
    } = {}
  ): Promise<{ success: boolean; error?: string }> {
    if (!this.supabase) {
      return { success: false, error: 'Database not configured' };
    }

    try {
      const { error } = await this.supabase
        .from('winback_campaigns')
        .update({
          status: 'completed',
          outcome,
          outcome_date: new Date().toISOString(),
          outcome_notes: options.notes,
          won_back_arr: options.wonBackArr,
          updated_at: new Date().toISOString(),
        })
        .eq('id', campaignId);

      if (error) {
        return { success: false, error: error.message };
      }

      // If won back, update customer stage
      if (outcome === 'won_back') {
        const { data: campaign } = await this.supabase
          .from('winback_campaigns')
          .select('customer_id')
          .eq('id', campaignId)
          .single();

        if (campaign?.customer_id) {
          await this.supabase
            .from('customers')
            .update({
              stage: 'active',
              arr: options.wonBackArr,
              updated_at: new Date().toISOString(),
            })
            .eq('id', campaign.customer_id);
        }
      }

      return { success: true };
    } catch (error) {
      return { success: false, error: (error as Error).message };
    }
  }

  /**
   * Get a campaign by ID with all items
   */
  async getCampaign(campaignId: string): Promise<{
    campaign: any;
    items: any[];
  } | null> {
    if (!this.supabase) return null;

    const { data: campaign, error: campaignError } = await this.supabase
      .from('winback_campaigns')
      .select('*')
      .eq('id', campaignId)
      .single();

    if (campaignError || !campaign) return null;

    const { data: items } = await this.supabase
      .from('winback_campaign_items')
      .select('*')
      .eq('campaign_id', campaignId)
      .order('item_order', { ascending: true });

    return { campaign, items: items || [] };
  }

  /**
   * Get all campaigns for a customer
   */
  async getCustomerCampaigns(customerId: string): Promise<any[]> {
    if (!this.supabase) return [];

    const { data, error } = await this.supabase
      .from('winback_campaigns')
      .select(`
        *,
        winback_campaign_items (
          id, item_order, day_offset, subject, purpose, status, scheduled_at, sent_at, opened_at, clicked_at, replied_at
        )
      `)
      .eq('customer_id', customerId)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching customer campaigns:', error);
      return [];
    }

    return data || [];
  }

  /**
   * Get success metrics for a user
   */
  async getSuccessMetrics(userId: string): Promise<WinBackSuccessMetrics> {
    if (!this.supabase) {
      return {
        totalCampaigns: 0,
        completedCampaigns: 0,
        successfulCampaigns: 0,
        successRate: 0,
        totalWonBackArr: 0,
        avgWonBackArr: 0,
        campaignsWithReplies: 0,
        avgOpenRate: 0,
        avgClickRate: 0,
      };
    }

    const { data, error } = await this.supabase
      .from('winback_success_metrics')
      .select('*')
      .eq('user_id', userId)
      .single();

    if (error || !data) {
      return {
        totalCampaigns: 0,
        completedCampaigns: 0,
        successfulCampaigns: 0,
        successRate: 0,
        totalWonBackArr: 0,
        avgWonBackArr: 0,
        campaignsWithReplies: 0,
        avgOpenRate: 0,
        avgClickRate: 0,
      };
    }

    return {
      totalCampaigns: data.total_campaigns || 0,
      completedCampaigns: data.completed_campaigns || 0,
      successfulCampaigns: data.successful_campaigns || 0,
      successRate: data.success_rate || 0,
      totalWonBackArr: data.total_won_back_arr || 0,
      avgWonBackArr: data.avg_won_back_arr || 0,
      campaignsWithReplies: data.campaigns_with_replies || 0,
      avgOpenRate: data.avg_open_rate || 0,
      avgClickRate: data.avg_click_rate || 0,
    };
  }

  /**
   * Track email engagement (open, click, reply)
   */
  async trackEngagement(
    itemId: string,
    eventType: 'opened' | 'clicked' | 'replied'
  ): Promise<{ success: boolean; error?: string }> {
    if (!this.supabase) {
      return { success: false, error: 'Database not configured' };
    }

    try {
      const updateData: Record<string, any> = {
        updated_at: new Date().toISOString(),
      };

      if (eventType === 'opened') {
        updateData.opened_at = new Date().toISOString();
        updateData.status = 'opened';
      } else if (eventType === 'clicked') {
        updateData.clicked_at = new Date().toISOString();
        updateData.status = 'clicked';
      } else if (eventType === 'replied') {
        updateData.replied_at = new Date().toISOString();
        updateData.status = 'replied';
      }

      const { error } = await this.supabase
        .from('winback_campaign_items')
        .update(updateData)
        .eq('id', itemId);

      if (error) {
        return { success: false, error: error.message };
      }

      return { success: true };
    } catch (error) {
      return { success: false, error: (error as Error).message };
    }
  }

  // Helper methods
  private calculateSendDate(startDate: Date, dayOffset: number, time: string): Date {
    const [hours, minutes] = time.split(':').map(Number);
    const sendDate = new Date(startDate);
    sendDate.setDate(sendDate.getDate() + dayOffset);
    sendDate.setHours(hours, minutes, 0, 0);
    return sendDate;
  }
}

// Singleton instance
export const winBackSequenceGenerator = new WinBackSequenceGenerator();
