/**
 * Multi-Threading Service
 * PRD-044: Multi-Threading Introduction
 *
 * Provides functionality to:
 * - Assess multi-threading depth and risk
 * - Identify stakeholder gaps
 * - Generate introduction requests
 * - Track introduction status
 */

import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { v4 as uuidv4 } from 'uuid';
import { config } from '../../config/index.js';
import { generateIntroRequestEmail, type IntroRequestData, type IntroRequestResult } from '../../templates/emails/intro-request.js';
import { generateIntroDraftEmail, INTRO_DRAFT_PRESETS, type IntroDraftData, type IntroDraftPreset } from '../../templates/emails/intro-draft.js';
import { stakeholderRelationshipMapService, type MultiThreadingScore, type Stakeholder } from '../stakeholderRelationshipMap.js';

// Initialize Supabase client
const supabase: SupabaseClient | null = config.supabaseUrl && config.supabaseServiceKey
  ? createClient(config.supabaseUrl, config.supabaseServiceKey)
  : null;

// ============================================
// Types
// ============================================

export type StakeholderType =
  | 'executive_sponsor'
  | 'technical_champion'
  | 'business_champion'
  | 'end_user_leader'
  | 'finance_procurement'
  | 'decision_maker'
  | 'influencer';

export interface StakeholderGap {
  type: StakeholderType;
  label: string;
  importance: 'critical' | 'high' | 'medium';
  reason: string;
  suggestedAction: string;
}

export interface ThreadingAssessment {
  customerId: string;
  customerName: string;
  score: MultiThreadingScore;
  riskLevel: 'critical' | 'high' | 'medium' | 'low';
  currentContacts: number;
  gaps: StakeholderGap[];
  recommendations: string[];
  bestIntroducer?: {
    id: string;
    name: string;
    title: string;
    reason: string;
  };
}

export interface IntroductionTarget {
  stakeholderId?: string;
  name: string;
  firstName: string;
  title: string;
  email?: string;
  department?: string;
  reason: string;
  priority: 'critical' | 'high' | 'medium';
}

export interface IntroductionRequest {
  id: string;
  customerId: string;
  championId: string;
  targetId?: string;
  targetName: string;
  targetTitle: string;
  targetEmail?: string;
  status: 'pending' | 'sent' | 'introduced' | 'declined' | 'no_response';
  emailSubject: string;
  emailBody: string;
  draftIntroSubject: string;
  draftIntroBody: string;
  createdAt: Date;
  sentAt?: Date;
  introducedAt?: Date;
  responseAt?: Date;
  notes?: string;
}

export interface GenerateIntroRequestInput {
  customerId: string;
  championId: string;
  target: IntroductionTarget;
  context?: {
    reason?: string;
    customMessage?: string;
    keyMetrics?: Array<{ metric: string; value: string }>;
  };
}

export interface GenerateIntroRequestOutput {
  request: IntroductionRequest;
  email: IntroRequestResult;
  assessment: ThreadingAssessment;
}

// ============================================
// Stakeholder Gap Definitions
// ============================================

const STAKEHOLDER_GAP_DEFINITIONS: Record<StakeholderType, Omit<StakeholderGap, 'reason' | 'suggestedAction'>> = {
  executive_sponsor: {
    type: 'executive_sponsor',
    label: 'Executive Sponsor',
    importance: 'critical',
  },
  technical_champion: {
    type: 'technical_champion',
    label: 'Technical Champion',
    importance: 'high',
  },
  business_champion: {
    type: 'business_champion',
    label: 'Business Champion',
    importance: 'critical',
  },
  end_user_leader: {
    type: 'end_user_leader',
    label: 'End User Leader',
    importance: 'medium',
  },
  finance_procurement: {
    type: 'finance_procurement',
    label: 'Finance/Procurement',
    importance: 'high',
  },
  decision_maker: {
    type: 'decision_maker',
    label: 'Decision Maker',
    importance: 'critical',
  },
  influencer: {
    type: 'influencer',
    label: 'Key Influencer',
    importance: 'medium',
  },
};

// ============================================
// Service Implementation
// ============================================

class MultiThreadService {
  /**
   * Get comprehensive threading assessment for a customer
   */
  async getThreadingAssessment(customerId: string): Promise<ThreadingAssessment | null> {
    try {
      // Get customer info
      const customer = await this.getCustomer(customerId);
      if (!customer) {
        return null;
      }

      // Get multi-threading score from stakeholder map service
      const score = await stakeholderRelationshipMapService.calculateMultiThreadingScore(customerId);

      // Get stakeholders
      const stakeholders = await this.getStakeholders(customerId);

      // Identify gaps
      const gaps = this.identifyStakeholderGaps(stakeholders, customer);

      // Determine risk level
      const riskLevel = this.calculateRiskLevel(score, gaps);

      // Generate recommendations
      const recommendations = this.generateRecommendations(score, gaps, stakeholders, customer);

      // Find best introducer
      const bestIntroducer = this.findBestIntroducer(stakeholders);

      return {
        customerId,
        customerName: customer.name,
        score,
        riskLevel,
        currentContacts: stakeholders.length,
        gaps,
        recommendations,
        bestIntroducer,
      };
    } catch (error) {
      console.error('[MultiThread] Error getting threading assessment:', error);
      return null;
    }
  }

  /**
   * Get threading score for a customer
   */
  async getThreadingScore(customerId: string): Promise<MultiThreadingScore | null> {
    try {
      return await stakeholderRelationshipMapService.calculateMultiThreadingScore(customerId);
    } catch (error) {
      console.error('[MultiThread] Error getting threading score:', error);
      return null;
    }
  }

  /**
   * Identify stakeholder gaps for a customer
   */
  async getStakeholderGaps(customerId: string): Promise<StakeholderGap[]> {
    try {
      const customer = await this.getCustomer(customerId);
      if (!customer) return [];

      const stakeholders = await this.getStakeholders(customerId);
      return this.identifyStakeholderGaps(stakeholders, customer);
    } catch (error) {
      console.error('[MultiThread] Error getting stakeholder gaps:', error);
      return [];
    }
  }

  /**
   * Generate introduction request email
   */
  async generateIntroRequest(input: GenerateIntroRequestInput): Promise<GenerateIntroRequestOutput | null> {
    try {
      const { customerId, championId, target, context } = input;

      // Get customer and champion info
      const customer = await this.getCustomer(customerId);
      const champion = await this.getStakeholderById(championId);

      if (!customer || !champion) {
        console.error('[MultiThread] Customer or champion not found');
        return null;
      }

      // Get CSM info (from customer or default)
      const csm = await this.getCsmInfo(customerId);

      // Calculate days until renewal
      const daysUntilRenewal = customer.renewal_date
        ? Math.ceil((new Date(customer.renewal_date).getTime() - Date.now()) / (1000 * 60 * 60 * 24))
        : undefined;

      // Build value proposition based on target role
      const valueProposition = this.buildValueProposition(target, customer, context?.keyMetrics);

      // Prepare email data
      const emailData: IntroRequestData = {
        customer: {
          name: customer.name,
          arr: customer.arr || 0,
          healthScore: customer.health_score,
          renewalDate: customer.renewal_date,
        },
        champion: {
          name: champion.name,
          firstName: this.getFirstName(champion.name),
          email: champion.email || '',
          title: champion.title || champion.role,
        },
        target: {
          name: target.name,
          firstName: target.firstName || this.getFirstName(target.name),
          title: target.title,
          email: target.email,
          department: target.department,
        },
        csm: {
          name: csm.name,
          email: csm.email,
          title: csm.title,
          phone: csm.phone,
        },
        context: {
          reason: context?.reason || target.reason,
          valueProposition,
          keyMetrics: context?.keyMetrics,
          daysUntilRenewal,
        },
        customMessage: context?.customMessage,
      };

      // Generate email
      const email = generateIntroRequestEmail(emailData);

      // Create introduction request record
      const request: IntroductionRequest = {
        id: uuidv4(),
        customerId,
        championId,
        targetId: target.stakeholderId,
        targetName: target.name,
        targetTitle: target.title,
        targetEmail: target.email,
        status: 'pending',
        emailSubject: email.subject,
        emailBody: email.bodyText,
        draftIntroSubject: email.draftIntroEmail.subject,
        draftIntroBody: email.draftIntroEmail.bodyText,
        createdAt: new Date(),
      };

      // Save to database if available
      await this.saveIntroductionRequest(request);

      // Get updated assessment
      const assessment = await this.getThreadingAssessment(customerId);

      return {
        request,
        email,
        assessment: assessment!,
      };
    } catch (error) {
      console.error('[MultiThread] Error generating intro request:', error);
      return null;
    }
  }

  /**
   * Track introduction request sent
   */
  async markIntroRequestSent(requestId: string): Promise<boolean> {
    if (!supabase) return true;

    try {
      const { error } = await supabase
        .from('introduction_requests')
        .update({
          status: 'sent',
          sent_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq('id', requestId);

      return !error;
    } catch (error) {
      console.error('[MultiThread] Error marking request sent:', error);
      return false;
    }
  }

  /**
   * Record successful introduction
   */
  async recordIntroduction(
    requestId: string,
    targetStakeholderId?: string,
    notes?: string
  ): Promise<boolean> {
    if (!supabase) return true;

    try {
      // Update introduction request
      const { data: request, error: requestError } = await supabase
        .from('introduction_requests')
        .update({
          status: 'introduced',
          introduced_at: new Date().toISOString(),
          target_stakeholder_id: targetStakeholderId,
          notes,
          updated_at: new Date().toISOString(),
        })
        .eq('id', requestId)
        .select()
        .single();

      if (requestError) {
        console.error('[MultiThread] Error updating request:', requestError);
        return false;
      }

      // If we have a target stakeholder ID, update their record
      if (targetStakeholderId && request) {
        await supabase
          .from('stakeholders')
          .update({
            introduced_by: request.champion_id,
            introduction_date: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          })
          .eq('id', targetStakeholderId);
      }

      return true;
    } catch (error) {
      console.error('[MultiThread] Error recording introduction:', error);
      return false;
    }
  }

  /**
   * Get introduction requests for a customer
   */
  async getIntroductionRequests(
    customerId: string,
    status?: IntroductionRequest['status']
  ): Promise<IntroductionRequest[]> {
    if (!supabase) return [];

    try {
      let query = supabase
        .from('introduction_requests')
        .select('*')
        .eq('customer_id', customerId)
        .order('created_at', { ascending: false });

      if (status) {
        query = query.eq('status', status);
      }

      const { data, error } = await query;

      if (error) {
        console.error('[MultiThread] Error fetching requests:', error);
        return [];
      }

      return (data || []).map(this.mapIntroductionRequest);
    } catch (error) {
      console.error('[MultiThread] Error getting introduction requests:', error);
      return [];
    }
  }

  /**
   * Suggest introduction targets based on gaps
   */
  async suggestIntroductionTargets(
    customerId: string,
    limit: number = 5
  ): Promise<IntroductionTarget[]> {
    const assessment = await this.getThreadingAssessment(customerId);
    if (!assessment) return [];

    const targets: IntroductionTarget[] = assessment.gaps
      .slice(0, limit)
      .map(gap => ({
        name: `${gap.label} (TBD)`,
        firstName: '',
        title: gap.label,
        department: this.getDepartmentForGap(gap.type),
        reason: gap.reason,
        priority: gap.importance,
      }));

    return targets;
  }

  // ============================================
  // Private Helper Methods
  // ============================================

  private async getCustomer(customerId: string): Promise<any | null> {
    if (!supabase) {
      // Return mock customer for development
      return {
        id: customerId,
        name: 'TechCorp',
        arr: 120000,
        health_score: 75,
        renewal_date: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString(),
        csm_name: 'Sarah Johnson',
        csm_email: 'sarah@company.com',
      };
    }

    const { data, error } = await supabase
      .from('customers')
      .select('*')
      .eq('id', customerId)
      .single();

    if (error) {
      console.error('[MultiThread] Error fetching customer:', error);
      return null;
    }

    return data;
  }

  private async getStakeholders(customerId: string): Promise<Stakeholder[]> {
    const mapData = await stakeholderRelationshipMapService.getStakeholderMap(customerId);
    return mapData?.stakeholders || [];
  }

  private async getStakeholderById(stakeholderId: string): Promise<any | null> {
    if (!supabase) {
      // Return mock stakeholder for development
      return {
        id: stakeholderId,
        name: 'Sarah Chen',
        email: 'sarah.chen@techcorp.com',
        title: 'VP Operations',
        role: 'VP Operations',
        is_champion: true,
      };
    }

    const { data, error } = await supabase
      .from('stakeholders')
      .select('*')
      .eq('id', stakeholderId)
      .single();

    if (error) {
      console.error('[MultiThread] Error fetching stakeholder:', error);
      return null;
    }

    return data;
  }

  private async getCsmInfo(customerId: string): Promise<{
    name: string;
    email: string;
    title?: string;
    phone?: string;
  }> {
    // Try to get from customer record
    const customer = await this.getCustomer(customerId);

    if (customer?.csm_name && customer?.csm_email) {
      return {
        name: customer.csm_name,
        email: customer.csm_email,
        title: 'Customer Success Manager',
      };
    }

    // Default CSM info
    return {
      name: 'Your CSM',
      email: 'csm@company.com',
      title: 'Customer Success Manager',
    };
  }

  private identifyStakeholderGaps(
    stakeholders: Stakeholder[],
    customer: any
  ): StakeholderGap[] {
    const gaps: StakeholderGap[] = [];

    // Check for executive sponsor
    const hasExecSponsor = stakeholders.some(s =>
      s.isExecSponsor || s.stakeholderRole === 'sponsor'
    );
    if (!hasExecSponsor) {
      gaps.push({
        ...STAKEHOLDER_GAP_DEFINITIONS.executive_sponsor,
        reason: 'No executive sponsor identified - critical for strategic alignment and renewal',
        suggestedAction: 'Request introduction from champion to C-level or VP',
      });
    }

    // Check for champion
    const hasChampion = stakeholders.some(s =>
      s.isChampion || s.stakeholderRole === 'champion'
    );
    if (!hasChampion) {
      gaps.push({
        ...STAKEHOLDER_GAP_DEFINITIONS.business_champion,
        reason: 'No business champion identified - high single-point-of-failure risk',
        suggestedAction: 'Identify and cultivate most engaged user as champion',
      });
    }

    // Check for technical champion (if high ARR)
    const hasTechChampion = stakeholders.some(s =>
      s.department?.toLowerCase().includes('engineering') ||
      s.department?.toLowerCase().includes('it') ||
      s.title?.toLowerCase().includes('engineer')
    );
    if (!hasTechChampion && customer.arr > 50000) {
      gaps.push({
        ...STAKEHOLDER_GAP_DEFINITIONS.technical_champion,
        reason: 'No technical stakeholder - risk of implementation issues going unaddressed',
        suggestedAction: 'Request introduction to IT or Engineering lead',
      });
    }

    // Check for finance/procurement (especially near renewal)
    const daysUntilRenewal = customer.renewal_date
      ? Math.ceil((new Date(customer.renewal_date).getTime() - Date.now()) / (1000 * 60 * 60 * 24))
      : null;

    const hasFinance = stakeholders.some(s =>
      s.department?.toLowerCase().includes('finance') ||
      s.title?.toLowerCase().includes('cfo') ||
      s.title?.toLowerCase().includes('procurement') ||
      s.budgetAuthority
    );
    if (!hasFinance && daysUntilRenewal && daysUntilRenewal <= 120) {
      gaps.push({
        ...STAKEHOLDER_GAP_DEFINITIONS.finance_procurement,
        reason: `Renewal in ${daysUntilRenewal} days - need budget authority relationship`,
        suggestedAction: 'Request introduction to Finance or Procurement contact',
      });
    }

    // Check for decision makers
    const decisionMakers = stakeholders.filter(s => s.decisionMaker);
    if (decisionMakers.length < 2 && customer.arr > 100000) {
      gaps.push({
        ...STAKEHOLDER_GAP_DEFINITIONS.decision_maker,
        reason: 'Limited decision maker coverage - risk in strategic decisions',
        suggestedAction: 'Expand relationships with budget and authority holders',
      });
    }

    // Check for end user leaders
    const hasEndUserLeader = stakeholders.some(s =>
      s.stakeholderRole === 'user' &&
      (s.title?.toLowerCase().includes('manager') || s.title?.toLowerCase().includes('lead'))
    );
    if (!hasEndUserLeader && stakeholders.length < 3) {
      gaps.push({
        ...STAKEHOLDER_GAP_DEFINITIONS.end_user_leader,
        reason: 'No end user leader - limited visibility into adoption challenges',
        suggestedAction: 'Identify and connect with team leads using the product',
      });
    }

    // Sort by importance
    const importanceOrder = { critical: 0, high: 1, medium: 2 };
    return gaps.sort((a, b) => importanceOrder[a.importance] - importanceOrder[b.importance]);
  }

  private calculateRiskLevel(
    score: MultiThreadingScore,
    gaps: StakeholderGap[]
  ): 'critical' | 'high' | 'medium' | 'low' {
    const criticalGaps = gaps.filter(g => g.importance === 'critical').length;

    if (score.score < 30 || criticalGaps >= 2) {
      return 'critical';
    }
    if (score.score < 50 || criticalGaps >= 1) {
      return 'high';
    }
    if (score.score < 70 || gaps.length >= 2) {
      return 'medium';
    }
    return 'low';
  }

  private generateRecommendations(
    score: MultiThreadingScore,
    gaps: StakeholderGap[],
    stakeholders: Stakeholder[],
    customer: any
  ): string[] {
    const recommendations: string[] = [];

    // Based on gaps
    gaps.slice(0, 3).forEach(gap => {
      recommendations.push(gap.suggestedAction);
    });

    // Based on score components
    if (!score.hasChampion) {
      recommendations.push('Identify and cultivate a champion - essential for renewal success');
    }
    if (!score.hasExecSponsor) {
      recommendations.push('Establish executive sponsorship for strategic alignment');
    }
    if (score.engagementGapCount > 0) {
      recommendations.push(`Re-engage ${score.engagementGapCount} key stakeholder(s) with no recent contact`);
    }

    // Based on customer context
    const daysUntilRenewal = customer.renewal_date
      ? Math.ceil((new Date(customer.renewal_date).getTime() - Date.now()) / (1000 * 60 * 60 * 24))
      : null;

    if (daysUntilRenewal && daysUntilRenewal <= 90) {
      recommendations.push('Accelerate multi-threading before renewal - time is critical');
    }

    // Deduplicate and limit
    return [...new Set(recommendations)].slice(0, 5);
  }

  private findBestIntroducer(stakeholders: Stakeholder[]): ThreadingAssessment['bestIntroducer'] | undefined {
    // Priority: champion with high engagement > exec sponsor > most engaged contact
    const champions = stakeholders.filter(s => s.isChampion || s.stakeholderRole === 'champion');
    const sponsors = stakeholders.filter(s => s.isExecSponsor || s.stakeholderRole === 'sponsor');

    // Sort by engagement
    const sortByEngagement = (a: Stakeholder, b: Stakeholder) =>
      (b.engagementScore || 0) - (a.engagementScore || 0);

    const candidate = champions.sort(sortByEngagement)[0] ||
                      sponsors.sort(sortByEngagement)[0] ||
                      stakeholders.filter(s => s.engagementLevel === 'high').sort(sortByEngagement)[0];

    if (!candidate) return undefined;

    let reason = 'Most engaged contact';
    if (candidate.isChampion || candidate.stakeholderRole === 'champion') {
      reason = 'Strong champion with high engagement';
    } else if (candidate.isExecSponsor || candidate.stakeholderRole === 'sponsor') {
      reason = 'Executive sponsor with organizational influence';
    }

    return {
      id: candidate.id,
      name: candidate.name,
      title: candidate.title || '',
      reason,
    };
  }

  private buildValueProposition(
    target: IntroductionTarget,
    customer: any,
    keyMetrics?: Array<{ metric: string; value: string }>
  ): string[] {
    const props: string[] = [];
    const department = target.department?.toLowerCase() || target.title.toLowerCase();

    // Common value props
    if (keyMetrics && keyMetrics.length > 0) {
      props.push(`Overview of ROI achieved (${keyMetrics[0].value} ${keyMetrics[0].metric.toLowerCase()})`);
    }

    // Role-specific value props
    if (department.includes('finance') || target.title.toLowerCase().includes('cfo')) {
      props.push('Budget planning support and financial justification');
      props.push('Cost optimization and value realization review');
    } else if (department.includes('engineering') || department.includes('technical')) {
      props.push('Technical roadmap alignment and integration opportunities');
      props.push('Best practices for implementation optimization');
    } else if (department.includes('executive') || target.title.toLowerCase().includes('ceo') || target.title.toLowerCase().includes('president')) {
      props.push('Strategic partnership alignment and executive value summary');
      props.push('Competitive insights and industry best practices');
    } else if (department.includes('operations')) {
      props.push('Operational efficiency gains and process optimization');
      props.push('Team adoption and training opportunities');
    } else {
      props.push('Partnership value and success metrics overview');
      props.push('Strategic alignment on business objectives');
    }

    // Renewal context if applicable
    if (customer.renewal_date) {
      const daysUntil = Math.ceil((new Date(customer.renewal_date).getTime() - Date.now()) / (1000 * 60 * 60 * 24));
      if (daysUntil <= 120) {
        props.push('Renewal planning and continued partnership discussion');
      }
    }

    return props.slice(0, 4);
  }

  private getDepartmentForGap(gapType: StakeholderType): string {
    const mapping: Record<StakeholderType, string> = {
      executive_sponsor: 'Executive',
      technical_champion: 'Engineering/IT',
      business_champion: 'Operations',
      end_user_leader: 'Operations',
      finance_procurement: 'Finance',
      decision_maker: 'Leadership',
      influencer: 'Various',
    };
    return mapping[gapType] || 'Unknown';
  }

  private getFirstName(fullName: string): string {
    return fullName.split(' ')[0] || fullName;
  }

  private async saveIntroductionRequest(request: IntroductionRequest): Promise<void> {
    if (!supabase) return;

    try {
      await supabase
        .from('introduction_requests')
        .insert({
          id: request.id,
          customer_id: request.customerId,
          champion_id: request.championId,
          target_stakeholder_id: request.targetId,
          target_name: request.targetName,
          target_title: request.targetTitle,
          target_email: request.targetEmail,
          status: request.status,
          email_subject: request.emailSubject,
          email_body: request.emailBody,
          draft_intro_subject: request.draftIntroSubject,
          draft_intro_body: request.draftIntroBody,
          created_at: request.createdAt.toISOString(),
        });
    } catch (error) {
      console.error('[MultiThread] Error saving introduction request:', error);
    }
  }

  private mapIntroductionRequest(row: any): IntroductionRequest {
    return {
      id: row.id,
      customerId: row.customer_id,
      championId: row.champion_id,
      targetId: row.target_stakeholder_id,
      targetName: row.target_name,
      targetTitle: row.target_title,
      targetEmail: row.target_email,
      status: row.status,
      emailSubject: row.email_subject,
      emailBody: row.email_body,
      draftIntroSubject: row.draft_intro_subject,
      draftIntroBody: row.draft_intro_body,
      createdAt: new Date(row.created_at),
      sentAt: row.sent_at ? new Date(row.sent_at) : undefined,
      introducedAt: row.introduced_at ? new Date(row.introduced_at) : undefined,
      responseAt: row.response_at ? new Date(row.response_at) : undefined,
      notes: row.notes,
    };
  }
}

// Export singleton instance
export const multiThreadService = new MultiThreadService();

// Export types and service class
export { MultiThreadService };
export default multiThreadService;
