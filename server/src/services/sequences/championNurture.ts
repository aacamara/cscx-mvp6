/**
 * Champion Nurture Sequence Generator Service
 * PRD-032: Generates personalized nurture sequences for customer champions
 */

import { v4 as uuidv4 } from 'uuid';
import { createClient } from '@supabase/supabase-js';
import { config } from '../../config/index.js';
import {
  generateChampionRecognitionEmail,
  generateChampionExclusiveEmail,
  generateChampionCareerEmail,
  generateChampionCommunityEmail,
  generateChampionCheckinEmail,
  CHAMPION_NURTURE_SEQUENCE_TEMPLATE,
} from '../../templates/emails/index.js';

// Types
export interface ChampionData {
  id: string;
  name: string;
  email: string;
  role?: string;
  title?: string;
  championSince?: Date;
  engagementScore?: number;
  lastInteractionDate?: Date;
  keyContributions?: string[];
  impactMetrics?: {
    expansions?: number;
    caseStudies?: number;
    referrals?: number;
    productFeedback?: number;
  };
}

export interface CustomerData {
  id: string;
  name: string;
  arr?: number;
  industry?: string;
  segment?: string;
}

export interface CSMData {
  name: string;
  email: string;
  title?: string;
  calendarLink?: string;
}

export interface NurtureStrategyOptions {
  focus: 'recognition' | 'engagement' | 'career' | 'community' | 'balanced';
  frequency: 'weekly' | 'biweekly' | 'monthly';
  duration: 4 | 6 | 8 | 12; // weeks
}

export interface ChampionNurtureOptions {
  customerId: string;
  userId: string;
  champion: ChampionData;
  customer: CustomerData;
  csm: CSMData;
  strategy?: NurtureStrategyOptions;
  previewContent?: {
    title?: string;
    description?: string;
    highlights?: string[];
    link?: string;
    quarter?: string;
    year?: number;
  };
  careerOpportunity?: {
    type: 'speaking' | 'report' | 'webinar' | 'podcast' | 'article' | 'conference';
    title: string;
    description?: string;
    date?: string;
    link?: string;
  };
  communityInfo?: {
    name?: string;
    description?: string;
    benefits?: string[];
    memberCount?: number;
    joinLink?: string;
  };
  customVariables?: Record<string, any>;
}

export interface GeneratedNurtureSequence {
  id: string;
  customerId: string;
  stakeholderId: string;
  name: string;
  sequenceType: string;
  status: 'draft' | 'scheduled' | 'active' | 'paused' | 'completed';
  strategyFocus: string;
  startDate: Date;
  totalEmails: number;
  items: GeneratedNurtureItem[];
  championProfile: {
    name: string;
    title?: string;
    championSince?: string;
    engagementScore: number;
    engagementTrend: 'improving' | 'stable' | 'declining';
    lastInteraction?: string;
  };
  recommendedFocus: string;
}

export interface GeneratedNurtureItem {
  id: string;
  itemOrder: number;
  weekOffset: number;
  dayOffset: number;
  sendTime: string;
  scheduledAt: Date;
  purpose: string;
  subject: string;
  bodyHtml: string;
  bodyText: string;
  toEmail: string;
  status: 'pending' | 'scheduled' | 'sent' | 'opened' | 'clicked' | 'replied';
}

export interface ChampionEngagementMetrics {
  stakeholderId: string;
  score: number;
  trend: 'improving' | 'stable' | 'declining';
  lastInteractionDays: number;
  totalInteractions: number;
  recentActivityScore: number;
  riskLevel: 'low' | 'medium' | 'high';
  recommendedAction: string;
}

/**
 * Champion Nurture Sequence Generator
 * Creates personalized 5-email nurture sequences for customer champions
 */
export class ChampionNurtureGenerator {
  private supabase: ReturnType<typeof createClient> | null = null;

  constructor() {
    if (config.supabaseUrl && config.supabaseServiceKey) {
      this.supabase = createClient(config.supabaseUrl, config.supabaseServiceKey);
    }
  }

  /**
   * Calculate champion engagement score
   */
  async calculateEngagementScore(stakeholderId: string): Promise<ChampionEngagementMetrics> {
    if (!this.supabase) {
      return {
        stakeholderId,
        score: 50,
        trend: 'stable',
        lastInteractionDays: 30,
        totalInteractions: 0,
        recentActivityScore: 50,
        riskLevel: 'medium',
        recommendedAction: 'Initiate re-engagement outreach',
      };
    }

    // Get stakeholder data
    const { data: stakeholder } = await this.supabase
      .from('stakeholders')
      .select('*')
      .eq('id', stakeholderId)
      .single();

    if (!stakeholder) {
      return {
        stakeholderId,
        score: 0,
        trend: 'declining',
        lastInteractionDays: 999,
        totalInteractions: 0,
        recentActivityScore: 0,
        riskLevel: 'high',
        recommendedAction: 'Champion not found',
      };
    }

    // Get recent interactions
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const { data: recentTouches } = await this.supabase
      .from('champion_touches')
      .select('*')
      .eq('stakeholder_id', stakeholderId)
      .gte('created_at', thirtyDaysAgo.toISOString())
      .order('created_at', { ascending: false });

    // Get historical interactions for trend analysis
    const ninetyDaysAgo = new Date();
    ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);

    const { data: historicalTouches } = await this.supabase
      .from('champion_touches')
      .select('*')
      .eq('stakeholder_id', stakeholderId)
      .gte('created_at', ninetyDaysAgo.toISOString())
      .order('created_at', { ascending: false });

    // Calculate scores
    const recentCount = recentTouches?.length || 0;
    const historicalCount = historicalTouches?.length || 0;
    const olderCount = historicalCount - recentCount;

    // Base score from stakeholder engagement_score field
    const baseScore = stakeholder.engagement_score || 50;

    // Activity recency factor
    const lastTouch = recentTouches?.[0];
    const lastInteractionDays = lastTouch
      ? Math.floor((Date.now() - new Date(lastTouch.created_at).getTime()) / (1000 * 60 * 60 * 24))
      : stakeholder.last_interaction_at
        ? Math.floor((Date.now() - new Date(stakeholder.last_interaction_at).getTime()) / (1000 * 60 * 60 * 24))
        : 60;

    // Recency score (higher is better, decays over time)
    const recencyScore = Math.max(0, 100 - (lastInteractionDays * 2));

    // Activity trend
    let trend: 'improving' | 'stable' | 'declining' = 'stable';
    if (recentCount > olderCount * 1.5) {
      trend = 'improving';
    } else if (recentCount < olderCount * 0.5) {
      trend = 'declining';
    }

    // Combined score
    const recentActivityScore = Math.min(100, recentCount * 20);
    const combinedScore = Math.round((baseScore * 0.4) + (recencyScore * 0.3) + (recentActivityScore * 0.3));

    // Risk level
    let riskLevel: 'low' | 'medium' | 'high' = 'low';
    let recommendedAction = 'Maintain regular touchpoints';

    if (combinedScore < 40 || lastInteractionDays > 45) {
      riskLevel = 'high';
      recommendedAction = 'Immediate re-engagement needed - schedule personal call';
    } else if (combinedScore < 60 || lastInteractionDays > 30) {
      riskLevel = 'medium';
      recommendedAction = 'Proactive outreach recommended - send recognition email';
    }

    return {
      stakeholderId,
      score: combinedScore,
      trend,
      lastInteractionDays,
      totalInteractions: historicalCount,
      recentActivityScore,
      riskLevel,
      recommendedAction,
    };
  }

  /**
   * Determine recommended nurture focus based on engagement data
   */
  private determineNurtureFocus(engagement: ChampionEngagementMetrics): string {
    if (engagement.riskLevel === 'high') {
      return 'Re-engagement + Recognition';
    } else if (engagement.trend === 'declining') {
      return 'Recognition + Value Reinforcement';
    } else if (engagement.score >= 80) {
      return 'Career Development + Community';
    } else {
      return 'Balanced Nurturing';
    }
  }

  /**
   * Generate a complete champion nurture sequence
   */
  async generateSequence(options: ChampionNurtureOptions): Promise<GeneratedNurtureSequence> {
    const {
      customerId,
      userId,
      champion,
      customer,
      csm,
      strategy = { focus: 'balanced', frequency: 'biweekly', duration: 8 },
      previewContent,
      careerOpportunity,
      communityInfo,
    } = options;

    const sequenceId = uuidv4();
    const startDate = new Date();

    // Calculate engagement metrics
    const engagement = await this.calculateEngagementScore(champion.id);
    const recommendedFocus = this.determineNurtureFocus(engagement);

    // Calculate time since champion status
    let championSinceStr: string | undefined;
    if (champion.championSince) {
      const months = Math.floor(
        (Date.now() - new Date(champion.championSince).getTime()) / (1000 * 60 * 60 * 24 * 30)
      );
      if (months >= 12) {
        const years = Math.floor(months / 12);
        const remainingMonths = months % 12;
        championSinceStr = remainingMonths > 0
          ? `${years} year${years > 1 ? 's' : ''}, ${remainingMonths} month${remainingMonths > 1 ? 's' : ''}`
          : `${years} year${years > 1 ? 's' : ''}`;
      } else {
        championSinceStr = `${months} month${months > 1 ? 's' : ''}`;
      }
    }

    // Generate all 5 emails
    const items: GeneratedNurtureItem[] = [];

    // Email 1 - Recognition (Immediate)
    const recognition = generateChampionRecognitionEmail({
      championName: champion.name,
      championTitle: champion.title,
      customerName: customer.name,
      csmName: csm.name,
      csmEmail: csm.email,
      csmTitle: csm.title,
      championSince: championSinceStr,
      keyContributions: champion.keyContributions,
      impactMetrics: champion.impactMetrics,
    });

    items.push({
      id: uuidv4(),
      itemOrder: 1,
      weekOffset: 0,
      dayOffset: 0,
      sendTime: '10:00',
      scheduledAt: this.calculateSendDate(startDate, 0, '10:00'),
      purpose: 'recognition',
      subject: recognition.subject,
      bodyHtml: recognition.bodyHtml,
      bodyText: recognition.bodyText,
      toEmail: champion.email,
      status: 'pending',
    });

    // Email 2 - Exclusive Preview (Week 2)
    const exclusive = generateChampionExclusiveEmail({
      championName: champion.name,
      championTitle: champion.title,
      customerName: customer.name,
      csmName: csm.name,
      csmEmail: csm.email,
      csmTitle: csm.title,
      previewType: previewContent?.quarter ? 'roadmap' : 'feature',
      previewTitle: previewContent?.title || `Q${Math.ceil((new Date().getMonth() + 1) / 3)} Product Roadmap`,
      previewDescription: previewContent?.description,
      previewHighlights: previewContent?.highlights || [
        'New dashboard analytics with AI-powered insights',
        'Enhanced workflow automation capabilities',
        'Improved collaboration features',
        'Performance optimizations across the platform',
      ],
      previewLink: previewContent?.link,
      quarter: previewContent?.quarter || `Q${Math.ceil((new Date().getMonth() + 1) / 3)}`,
      year: previewContent?.year || new Date().getFullYear(),
      exclusivePerks: [
        'Direct input on feature prioritization',
        'Early beta access before general release',
        'Dedicated feedback channel with product team',
      ],
    });

    items.push({
      id: uuidv4(),
      itemOrder: 2,
      weekOffset: 2,
      dayOffset: 14,
      sendTime: '09:00',
      scheduledAt: this.calculateSendDate(startDate, 14, '09:00'),
      purpose: 'exclusive',
      subject: exclusive.subject,
      bodyHtml: exclusive.bodyHtml,
      bodyText: exclusive.bodyText,
      toEmail: champion.email,
      status: 'pending',
    });

    // Email 3 - Career Development (Week 4)
    const career = generateChampionCareerEmail({
      championName: champion.name,
      championTitle: champion.title,
      customerName: customer.name,
      csmName: csm.name,
      csmEmail: csm.email,
      csmTitle: csm.title,
      opportunityType: careerOpportunity?.type || 'webinar',
      opportunityTitle: careerOpportunity?.title || 'Industry Leaders Panel: The Future of Customer Success',
      opportunityDescription: careerOpportunity?.description ||
        'Join fellow industry experts to share insights on emerging trends and best practices. This is a great opportunity to build your professional profile and connect with peers.',
      opportunityDate: careerOpportunity?.date,
      opportunityLink: careerOpportunity?.link,
      resourceTitle: 'Industry Trends Report 2025',
      resourceDescription: 'Our latest analysis of trends shaping your industry, including exclusive data and insights.',
      industryInsights: [
        'Customer success teams are increasingly leveraging AI for proactive engagement',
        'Cross-functional collaboration is becoming a key differentiator',
        'Data-driven decision making is now table stakes',
      ],
      careerTips: [
        'Building a personal brand through thought leadership',
        'Networking strategies for busy professionals',
        'Turning operational excellence into career advancement',
      ],
    });

    items.push({
      id: uuidv4(),
      itemOrder: 3,
      weekOffset: 4,
      dayOffset: 28,
      sendTime: '10:00',
      scheduledAt: this.calculateSendDate(startDate, 28, '10:00'),
      purpose: 'career',
      subject: career.subject,
      bodyHtml: career.bodyHtml,
      bodyText: career.bodyText,
      toEmail: champion.email,
      status: 'pending',
    });

    // Email 4 - Community (Week 6)
    const community = generateChampionCommunityEmail({
      championName: champion.name,
      championTitle: champion.title,
      customerName: customer.name,
      csmName: csm.name,
      csmEmail: csm.email,
      csmTitle: csm.title,
      communityName: communityInfo?.name || 'Champion Advisory Board',
      communityDescription: communityInfo?.description ||
        'An exclusive community of customer champions who shape our product direction, share best practices, and connect with industry peers.',
      communityBenefits: communityInfo?.benefits || [
        'Direct influence on product roadmap priorities',
        'Exclusive early access to new features',
        'Networking with industry peers and leaders',
        'Quarterly executive briefings and insights',
        'Recognition at our annual customer conference',
      ],
      memberCount: communityInfo?.memberCount || 150,
      joinLink: communityInfo?.joinLink,
      upcomingEvents: [
        {
          title: 'Quarterly Product Strategy Session',
          date: 'Next Month',
          description: 'Review upcoming features and provide input on priorities',
        },
        {
          title: 'Champion Networking Happy Hour',
          date: 'Bi-monthly',
          description: 'Casual virtual gathering to connect with peers',
        },
      ],
      exclusivePerks: [
        'VIP access to annual customer conference',
        'Featured in customer success stories',
        'Early access to research reports and benchmarks',
      ],
    });

    items.push({
      id: uuidv4(),
      itemOrder: 4,
      weekOffset: 6,
      dayOffset: 42,
      sendTime: '10:00',
      scheduledAt: this.calculateSendDate(startDate, 42, '10:00'),
      purpose: 'community',
      subject: community.subject,
      bodyHtml: community.bodyHtml,
      bodyText: community.bodyText,
      toEmail: champion.email,
      status: 'pending',
    });

    // Email 5 - Check-in (Week 8)
    const checkin = generateChampionCheckinEmail({
      championName: champion.name,
      championTitle: champion.title,
      customerName: customer.name,
      csmName: csm.name,
      csmEmail: csm.email,
      csmTitle: csm.title,
      lastInteractionDate: engagement.lastInteractionDays > 0
        ? `${engagement.lastInteractionDays} days ago`
        : undefined,
      calendarLink: csm.calendarLink,
      recentWins: [
        `Strong adoption metrics across ${customer.name}`,
        'Positive feedback from your team on recent updates',
        'Successful achievement of key milestones',
      ],
      suggestedTopics: [
        'Your strategic priorities for the upcoming quarter',
        'Any challenges we can help address',
        'Ideas for getting even more value from our partnership',
      ],
    });

    items.push({
      id: uuidv4(),
      itemOrder: 5,
      weekOffset: 8,
      dayOffset: 56,
      sendTime: '14:00',
      scheduledAt: this.calculateSendDate(startDate, 56, '14:00'),
      purpose: 'checkin',
      subject: checkin.subject,
      bodyHtml: checkin.bodyHtml,
      bodyText: checkin.bodyText,
      toEmail: champion.email,
      status: 'pending',
    });

    const sequence: GeneratedNurtureSequence = {
      id: sequenceId,
      customerId,
      stakeholderId: champion.id,
      name: `${champion.name} Champion Nurture Sequence`,
      sequenceType: 'champion_nurture',
      status: 'draft',
      strategyFocus: strategy.focus,
      startDate,
      totalEmails: items.length,
      items,
      championProfile: {
        name: champion.name,
        title: champion.title,
        championSince: championSinceStr,
        engagementScore: engagement.score,
        engagementTrend: engagement.trend,
        lastInteraction: engagement.lastInteractionDays > 0
          ? `${engagement.lastInteractionDays} days ago`
          : 'Recently',
      },
      recommendedFocus,
    };

    return sequence;
  }

  /**
   * Save a generated sequence to the database
   */
  async saveSequence(
    userId: string,
    sequence: GeneratedNurtureSequence
  ): Promise<{ success: boolean; sequenceId?: string; error?: string }> {
    if (!this.supabase) {
      return { success: false, error: 'Database not configured' };
    }

    try {
      // Insert sequence
      const { data: sequenceData, error: sequenceError } = await this.supabase
        .from('email_sequences')
        .insert({
          id: sequence.id,
          customer_id: sequence.customerId,
          stakeholder_id: sequence.stakeholderId,
          user_id: userId,
          name: sequence.name,
          sequence_type: sequence.sequenceType,
          status: sequence.status,
          strategy_focus: sequence.strategyFocus,
          start_date: sequence.startDate.toISOString(),
          total_emails: sequence.totalEmails,
          emails_sent: 0,
          metadata: {
            championProfile: sequence.championProfile,
            recommendedFocus: sequence.recommendedFocus,
          },
        })
        .select()
        .single();

      if (sequenceError) {
        console.error('Error saving sequence:', sequenceError);
        return { success: false, error: sequenceError.message };
      }

      // Insert sequence items
      const itemsToInsert = sequence.items.map(item => ({
        id: item.id,
        sequence_id: sequence.id,
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
        .from('email_sequence_items')
        .insert(itemsToInsert);

      if (itemsError) {
        console.error('Error saving sequence items:', itemsError);
        // Rollback sequence
        await this.supabase.from('email_sequences').delete().eq('id', sequence.id);
        return { success: false, error: itemsError.message };
      }

      return { success: true, sequenceId: sequence.id };
    } catch (error) {
      console.error('Error saving sequence:', error);
      return { success: false, error: (error as Error).message };
    }
  }

  /**
   * Activate a sequence (change status from draft to scheduled)
   */
  async activateSequence(
    sequenceId: string
  ): Promise<{ success: boolean; error?: string }> {
    if (!this.supabase) {
      return { success: false, error: 'Database not configured' };
    }

    try {
      const { error } = await this.supabase
        .from('email_sequences')
        .update({ status: 'active', updated_at: new Date().toISOString() })
        .eq('id', sequenceId);

      if (error) {
        return { success: false, error: error.message };
      }

      // Update items to scheduled
      await this.supabase
        .from('email_sequence_items')
        .update({ status: 'scheduled', updated_at: new Date().toISOString() })
        .eq('sequence_id', sequenceId)
        .eq('status', 'pending');

      return { success: true };
    } catch (error) {
      return { success: false, error: (error as Error).message };
    }
  }

  /**
   * Record a champion touch/interaction
   */
  async recordChampionTouch(
    stakeholderId: string,
    customerId: string,
    touchType: 'email_sent' | 'email_opened' | 'email_clicked' | 'meeting' | 'call' | 'feedback' | 'other',
    details?: {
      sequenceId?: string;
      emailId?: string;
      subject?: string;
      notes?: string;
    }
  ): Promise<{ success: boolean; touchId?: string; error?: string }> {
    if (!this.supabase) {
      return { success: false, error: 'Database not configured' };
    }

    try {
      const touchId = uuidv4();

      const { error } = await this.supabase
        .from('champion_touches')
        .insert({
          id: touchId,
          stakeholder_id: stakeholderId,
          customer_id: customerId,
          touch_type: touchType,
          sequence_id: details?.sequenceId,
          email_id: details?.emailId,
          subject: details?.subject,
          notes: details?.notes,
        });

      if (error) {
        return { success: false, error: error.message };
      }

      // Update stakeholder last_interaction_at
      await this.supabase
        .from('stakeholders')
        .update({
          last_interaction_at: new Date().toISOString(),
          interaction_count: this.supabase.rpc ? undefined : undefined, // Would need RPC for increment
        })
        .eq('id', stakeholderId);

      return { success: true, touchId };
    } catch (error) {
      return { success: false, error: (error as Error).message };
    }
  }

  /**
   * Get champions for a customer
   */
  async getCustomerChampions(customerId: string): Promise<ChampionData[]> {
    if (!this.supabase) return [];

    const { data, error } = await this.supabase
      .from('stakeholders')
      .select('*')
      .eq('customer_id', customerId)
      .eq('is_champion', true)
      .eq('status', 'active')
      .order('engagement_score', { ascending: false });

    if (error || !data) return [];

    return data.map(s => ({
      id: s.id,
      name: s.name,
      email: s.email,
      role: s.role,
      title: s.title,
      championSince: s.champion_since ? new Date(s.champion_since) : undefined,
      engagementScore: s.engagement_score,
      lastInteractionDate: s.last_interaction_at ? new Date(s.last_interaction_at) : undefined,
    }));
  }

  /**
   * Get sequence by ID with all items
   */
  async getSequence(sequenceId: string): Promise<{
    sequence: any;
    items: any[];
  } | null> {
    if (!this.supabase) return null;

    const { data: sequence, error: seqError } = await this.supabase
      .from('email_sequences')
      .select('*')
      .eq('id', sequenceId)
      .single();

    if (seqError || !sequence) return null;

    const { data: items } = await this.supabase
      .from('email_sequence_items')
      .select('*')
      .eq('sequence_id', sequenceId)
      .order('item_order', { ascending: true });

    return { sequence, items: items || [] };
  }

  /**
   * Get all champion nurture sequences for a stakeholder
   */
  async getStakeholderSequences(stakeholderId: string): Promise<any[]> {
    if (!this.supabase) return [];

    const { data, error } = await this.supabase
      .from('email_sequences')
      .select(`
        *,
        email_sequence_items (
          id, item_order, day_offset, subject, purpose, status, scheduled_at, sent_at
        )
      `)
      .eq('stakeholder_id', stakeholderId)
      .eq('sequence_type', 'champion_nurture')
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching stakeholder sequences:', error);
      return [];
    }

    return data || [];
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
export const championNurtureGenerator = new ChampionNurtureGenerator();
