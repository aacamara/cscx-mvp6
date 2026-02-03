/**
 * Upsell Introduction Generator
 * PRD-047: Upsell Introduction Email
 *
 * Generates value-focused upsell introduction emails based on
 * customer context, usage data, and expansion signals.
 */

import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { v4 as uuidv4 } from 'uuid';
import { config } from '../../config/index.js';
import { expansionDetector } from './detector.js';
import { expansionOpportunityService } from './opportunity-service.js';
import {
  generateUpsellEducationalEmail,
  UpsellEducationalVariables,
} from '../../templates/emails/upsell-educational.js';
import {
  generateUpsellProblemEmail,
  UpsellProblemVariables,
} from '../../templates/emails/upsell-problem.js';
import {
  generateUpsellValueEmail,
  UpsellValueVariables,
} from '../../templates/emails/upsell-value.js';

// ============================================
// Types
// ============================================

export type UpsellApproach = 'educational' | 'problem_solving' | 'value_add' | 'proactive';

export interface UpsellIntroRequest {
  customerId: string;
  approach?: UpsellApproach;
  ccAccountExecutive?: boolean;
  aeEmail?: string;
  calendarLink?: string;
}

export interface UsageLimit {
  type: 'users' | 'api' | 'storage' | 'features' | 'other';
  current: string | number;
  limit: string | number;
  percentUsed: number;
  impact?: string;
}

export interface ExpansionContext {
  customerId: string;
  customerName: string;
  currentTier: string;
  suggestedTier: string;
  arr: number;
  healthScore: number;
  usageLimits: UsageLimit[];
  featureRequests: string[];
  expansionOpportunity?: {
    id: string;
    type: string;
    estimatedValue: number;
    signals: string[];
  };
  contactInfo: {
    name: string;
    email: string;
    title?: string;
  };
  csmInfo: {
    name: string;
    email: string;
    title: string;
  };
  recommendedApproach: UpsellApproach;
  approachReasoning: string;
}

export interface GeneratedUpsellIntro {
  id: string;
  customerId: string;
  approach: UpsellApproach;
  email: {
    to: string[];
    cc?: string[];
    subject: string;
    bodyHtml: string;
    bodyText: string;
  };
  context: ExpansionContext;
  generatedAt: Date;
}

export interface UpsellIntroTracking {
  id: string;
  customerId: string;
  opportunityId?: string;
  approach: UpsellApproach;
  sentAt?: Date;
  openedAt?: Date;
  respondedAt?: Date;
  response?: 'positive' | 'neutral' | 'negative' | 'no_response';
  outcome?: 'converted' | 'deferred' | 'declined' | 'pending';
  createdAt: Date;
  updatedAt: Date;
}

// ============================================
// Tier Configuration
// ============================================

const TIER_HIERARCHY = ['Starter', 'Professional', 'Business', 'Enterprise', 'Enterprise Plus'];

const TIER_FEATURES: Record<string, Array<{ name: string; description: string; benefit: string }>> = {
  Professional: [
    { name: 'Advanced Analytics', description: 'Real-time dashboards and custom reports', benefit: 'Gain deeper insights into your team\'s performance' },
    { name: 'API Access', description: 'Full REST API with 10,000 calls/month', benefit: 'Integrate with your existing tools seamlessly' },
    { name: 'Priority Support', description: '4-hour response SLA with dedicated queue', benefit: 'Get faster resolution for critical issues' },
  ],
  Business: [
    { name: 'Unlimited Users', description: 'No seat restrictions for your entire organization', benefit: 'Scale adoption without worrying about costs' },
    { name: 'Custom Integrations', description: 'Build custom integrations with our SDK', benefit: 'Connect any tool in your stack' },
    { name: 'Advanced Security', description: 'SSO, SCIM provisioning, audit logs', benefit: 'Meet enterprise security requirements' },
    { name: 'Dedicated CSM', description: 'Named Customer Success Manager', benefit: 'Get personalized guidance and strategic planning' },
  ],
  Enterprise: [
    { name: 'Unlimited Everything', description: 'No limits on users, API calls, or storage', benefit: 'Complete freedom to scale' },
    { name: 'Custom SLA', description: 'Tailored uptime and support guarantees', benefit: 'Guaranteed reliability for mission-critical use' },
    { name: 'Professional Services', description: 'Implementation and training included', benefit: 'Faster time-to-value with expert help' },
    { name: 'Executive Briefings', description: 'Quarterly business reviews with leadership', benefit: 'Strategic alignment at the executive level' },
  ],
};

// ============================================
// Upsell Introduction Generator Service
// ============================================

export class UpsellIntroGenerator {
  private supabase: SupabaseClient | null = null;

  constructor() {
    if (config.supabaseUrl && config.supabaseServiceKey) {
      this.supabase = createClient(config.supabaseUrl, config.supabaseServiceKey);
    }
  }

  // ============================================
  // FR-1: Get Expansion Context
  // ============================================

  /**
   * Gather all context needed for upsell introduction
   */
  async getExpansionContext(customerId: string): Promise<ExpansionContext | null> {
    if (!this.supabase) {
      console.warn('[UpsellIntro] Supabase not configured');
      return this.getMockExpansionContext(customerId);
    }

    // Get customer data
    const { data: customer, error } = await this.supabase
      .from('customers')
      .select(`
        id,
        name,
        arr,
        health_score,
        plan,
        primary_contact_name,
        primary_contact_email,
        primary_contact_title,
        csm_name,
        csm_email
      `)
      .eq('id', customerId)
      .single();

    if (error || !customer) {
      console.error('[UpsellIntro] Failed to get customer:', error);
      return null;
    }

    // Get usage metrics
    const usageLimits = await this.getUsageLimits(customerId, customer.plan);

    // Get feature requests
    const featureRequests = await this.getFeatureRequests(customerId);

    // Detect expansion signals
    const detection = await expansionDetector.detectSignals(customerId);

    // Determine recommended approach
    const { approach, reasoning } = this.determineApproach(
      customer.health_score,
      usageLimits,
      detection?.signals || []
    );

    // Determine next tier
    const suggestedTier = this.getSuggestedTier(customer.plan);

    return {
      customerId,
      customerName: customer.name,
      currentTier: customer.plan || 'Professional',
      suggestedTier,
      arr: customer.arr || 0,
      healthScore: customer.health_score || 0,
      usageLimits,
      featureRequests,
      expansionOpportunity: detection ? {
        id: uuidv4(),
        type: detection.expansionType,
        estimatedValue: detection.estimatedExpansionArr,
        signals: detection.signals.map(s => s.details),
      } : undefined,
      contactInfo: {
        name: customer.primary_contact_name || 'there',
        email: customer.primary_contact_email || '',
        title: customer.primary_contact_title,
      },
      csmInfo: {
        name: customer.csm_name || 'Your CSM',
        email: customer.csm_email || 'csm@company.com',
        title: 'Customer Success Manager',
      },
      recommendedApproach: approach,
      approachReasoning: reasoning,
    };
  }

  /**
   * Get usage limits for customer
   */
  private async getUsageLimits(customerId: string, plan: string): Promise<UsageLimit[]> {
    if (!this.supabase) return [];

    const limits: UsageLimit[] = [];

    // Get usage metrics
    const { data: usage } = await this.supabase
      .from('usage_metrics')
      .select('*')
      .eq('customer_id', customerId)
      .order('recorded_at', { ascending: false })
      .limit(1)
      .single();

    if (!usage) return limits;

    // Define tier limits
    const tierLimits: Record<string, { users: number; apiCalls: number; storage: number }> = {
      Starter: { users: 10, apiCalls: 1000, storage: 5 },
      Professional: { users: 50, apiCalls: 10000, storage: 25 },
      Business: { users: 200, apiCalls: 50000, storage: 100 },
      Enterprise: { users: 999999, apiCalls: 999999, storage: 999999 },
    };

    const tierLimit = tierLimits[plan] || tierLimits.Professional;

    // Check user limit
    if (usage.active_users) {
      const percentUsed = Math.round((usage.active_users / tierLimit.users) * 100);
      if (percentUsed >= 70) {
        limits.push({
          type: 'users',
          current: usage.active_users,
          limit: tierLimit.users,
          percentUsed,
          impact: percentUsed >= 90 ? 'May block new user onboarding soon' : undefined,
        });
      }
    }

    // Check API limit
    if (usage.api_calls_month) {
      const percentUsed = Math.round((usage.api_calls_month / tierLimit.apiCalls) * 100);
      if (percentUsed >= 70) {
        limits.push({
          type: 'api',
          current: usage.api_calls_month.toLocaleString(),
          limit: tierLimit.apiCalls.toLocaleString(),
          percentUsed,
          impact: percentUsed >= 90 ? 'API calls may be throttled' : undefined,
        });
      }
    }

    // Check storage limit
    if (usage.storage_gb) {
      const percentUsed = Math.round((usage.storage_gb / tierLimit.storage) * 100);
      if (percentUsed >= 70) {
        limits.push({
          type: 'storage',
          current: `${usage.storage_gb}GB`,
          limit: `${tierLimit.storage}GB`,
          percentUsed,
          impact: percentUsed >= 90 ? 'File uploads may fail' : undefined,
        });
      }
    }

    return limits;
  }

  /**
   * Get recent feature requests from customer
   */
  private async getFeatureRequests(customerId: string): Promise<string[]> {
    if (!this.supabase) return [];

    const { data } = await this.supabase
      .from('feature_requests')
      .select('feature_name')
      .eq('customer_id', customerId)
      .eq('status', 'requested')
      .order('created_at', { ascending: false })
      .limit(5);

    return data?.map(r => r.feature_name) || [];
  }

  /**
   * Determine recommended approach based on context
   */
  private determineApproach(
    healthScore: number,
    usageLimits: UsageLimit[],
    signals: any[]
  ): { approach: UpsellApproach; reasoning: string } {
    const hasHighUsage = usageLimits.some(l => l.percentUsed >= 80);
    const hasCriticalUsage = usageLimits.some(l => l.percentUsed >= 95);
    const hasExpansionSignals = signals.length > 0;

    // Problem-solving: Critical limits being hit
    if (hasCriticalUsage) {
      return {
        approach: 'problem_solving',
        reasoning: 'Customer is hitting critical usage limits that may impact their operations',
      };
    }

    // Value-add: Healthy customer with strong metrics
    if (healthScore >= 80 && !hasHighUsage) {
      return {
        approach: 'value_add',
        reasoning: 'High health score indicates strong value realization - build on success',
      };
    }

    // Problem-solving: Approaching limits
    if (hasHighUsage) {
      return {
        approach: 'problem_solving',
        reasoning: 'Usage is approaching limits - proactive outreach before constraints',
      };
    }

    // Educational: Good engagement but may not know about advanced features
    if (healthScore >= 60 && hasExpansionSignals) {
      return {
        approach: 'educational',
        reasoning: 'Engaged customer with expansion signals - educate on possibilities',
      };
    }

    // Default: Proactive / Educational
    return {
      approach: 'educational',
      reasoning: 'General educational approach to explore expansion opportunities',
    };
  }

  /**
   * Get suggested next tier
   */
  private getSuggestedTier(currentTier: string): string {
    const currentIndex = TIER_HIERARCHY.indexOf(currentTier);
    if (currentIndex === -1) return 'Business';
    if (currentIndex >= TIER_HIERARCHY.length - 1) return currentTier;
    return TIER_HIERARCHY[currentIndex + 1];
  }

  // ============================================
  // FR-2: Generate Upsell Introduction
  // ============================================

  /**
   * Generate upsell introduction email
   */
  async generateUpsellIntro(request: UpsellIntroRequest): Promise<GeneratedUpsellIntro | null> {
    const context = await this.getExpansionContext(request.customerId);
    if (!context) {
      console.error('[UpsellIntro] Failed to get expansion context');
      return null;
    }

    const approach = request.approach || context.recommendedApproach;
    let email: { subject: string; bodyHtml: string; bodyText: string };

    switch (approach) {
      case 'educational':
        email = this.generateEducationalEmail(context, request);
        break;
      case 'problem_solving':
        email = this.generateProblemSolvingEmail(context, request);
        break;
      case 'value_add':
        email = this.generateValueAddEmail(context, request);
        break;
      default:
        email = this.generateEducationalEmail(context, request);
    }

    const result: GeneratedUpsellIntro = {
      id: uuidv4(),
      customerId: request.customerId,
      approach,
      email: {
        to: [context.contactInfo.email],
        cc: request.ccAccountExecutive && request.aeEmail ? [request.aeEmail] : undefined,
        subject: email.subject,
        bodyHtml: email.bodyHtml,
        bodyText: email.bodyText,
      },
      context,
      generatedAt: new Date(),
    };

    // Track the generated intro
    await this.trackIntro(result);

    return result;
  }

  /**
   * Generate educational approach email
   */
  private generateEducationalEmail(
    context: ExpansionContext,
    request: UpsellIntroRequest
  ): { subject: string; bodyHtml: string; bodyText: string } {
    const features = TIER_FEATURES[context.suggestedTier] || TIER_FEATURES.Business;

    const variables: UpsellEducationalVariables = {
      customerName: context.customerName,
      contactName: context.contactInfo.name,
      contactTitle: context.contactInfo.title,
      csmName: context.csmInfo.name,
      csmEmail: context.csmInfo.email,
      csmTitle: context.csmInfo.title,
      currentTier: context.currentTier,
      suggestedTier: context.suggestedTier,
      keyFeatures: features,
      healthScore: context.healthScore,
      usageHighlights: this.generateUsageHighlights(context),
      calendarLink: request.calendarLink,
      resourceLinks: [
        {
          title: `${context.suggestedTier} Feature Guide`,
          url: '#',
          description: 'Detailed breakdown of advanced capabilities',
        },
      ],
    };

    return generateUpsellEducationalEmail(variables);
  }

  /**
   * Generate problem-solving approach email
   */
  private generateProblemSolvingEmail(
    context: ExpansionContext,
    request: UpsellIntroRequest
  ): { subject: string; bodyHtml: string; bodyText: string } {
    const variables: UpsellProblemVariables = {
      customerName: context.customerName,
      contactName: context.contactInfo.name,
      contactTitle: context.contactInfo.title,
      csmName: context.csmInfo.name,
      csmEmail: context.csmInfo.email,
      csmTitle: context.csmInfo.title,
      currentTier: context.currentTier,
      suggestedTier: context.suggestedTier,
      limitations: context.usageLimits.map(l => ({
        type: l.type,
        current: l.current,
        limit: l.limit,
        percentUsed: l.percentUsed,
        impact: l.impact,
      })),
      optimizationOptions: [
        {
          title: 'Audit inactive users',
          description: 'I can help identify users who haven\'t logged in recently',
          effort: 'low',
        },
        {
          title: 'Optimize API usage',
          description: 'Review integration patterns for efficiency gains',
          effort: 'medium',
        },
      ],
      upgradeFeatures: this.getUpgradeFeatures(context.suggestedTier),
      estimatedValue: context.expansionOpportunity?.estimatedValue,
      featureRequests: context.featureRequests.slice(0, 3),
      calendarLink: request.calendarLink,
    };

    return generateUpsellProblemEmail(variables);
  }

  /**
   * Generate value-add approach email
   */
  private generateValueAddEmail(
    context: ExpansionContext,
    request: UpsellIntroRequest
  ): { subject: string; bodyHtml: string; bodyText: string } {
    const variables: UpsellValueVariables = {
      customerName: context.customerName,
      contactName: context.contactInfo.name,
      contactTitle: context.contactInfo.title,
      csmName: context.csmInfo.name,
      csmEmail: context.csmInfo.email,
      csmTitle: context.csmInfo.title,
      currentTier: context.currentTier,
      suggestedTier: context.suggestedTier,
      healthScore: context.healthScore,
      successMetrics: [
        { metric: 'Health Score', value: `${context.healthScore}/100`, improvement: 'Top 20% of customers' },
        { metric: 'Active Users', value: 'High Adoption', context: 'Strong team engagement' },
        { metric: 'ARR', value: `$${context.arr.toLocaleString()}`, context: 'Solid investment' },
      ],
      valueDelivered: {
        summary: `${context.customerName} has become a power user of our platform`,
        examples: [
          'High engagement across your team',
          'Strong adoption of core features',
          'Consistent usage patterns indicating embedded workflows',
        ],
        estimatedRoi: 150,
      },
      growthOpportunities: this.generateGrowthOpportunities(context),
      similarCustomers: [
        { industry: 'Similar-sized companies', outcome: '40% productivity improvement with Enterprise features' },
        { industry: 'Your industry peers', outcome: 'Average 3x ROI increase after upgrade' },
      ],
      calendarLink: request.calendarLink,
    };

    return generateUpsellValueEmail(variables);
  }

  /**
   * Helper: Generate usage highlights
   */
  private generateUsageHighlights(context: ExpansionContext): string[] {
    const highlights: string[] = [];

    if (context.healthScore >= 80) {
      highlights.push(`Your health score of ${context.healthScore} puts you in our top tier of customers`);
    }

    if (context.usageLimits.length > 0) {
      highlights.push('Your team is actively using the platform at scale');
    }

    if (context.featureRequests.length > 0) {
      highlights.push(`You've expressed interest in advanced capabilities like ${context.featureRequests[0]}`);
    }

    return highlights;
  }

  /**
   * Helper: Get upgrade features for tier
   */
  private getUpgradeFeatures(tier: string): Array<{ name: string; value: string; relevance: string }> {
    const features = TIER_FEATURES[tier] || TIER_FEATURES.Business;
    return features.map(f => ({
      name: f.name,
      value: f.description,
      relevance: f.benefit,
    }));
  }

  /**
   * Helper: Generate growth opportunities
   */
  private generateGrowthOpportunities(context: ExpansionContext): Array<{
    area: string;
    potential: string;
    feature: string;
    expectedOutcome: string;
  }> {
    const opportunities = [];

    if (context.usageLimits.some(l => l.type === 'users')) {
      opportunities.push({
        area: 'Team Expansion',
        potential: 'Enable company-wide adoption without constraints',
        feature: 'Unlimited users',
        expectedOutcome: '2-3x more users engaged',
      });
    }

    if (context.usageLimits.some(l => l.type === 'api')) {
      opportunities.push({
        area: 'Integration Scale',
        potential: 'Build deeper integrations without limits',
        feature: 'Unlimited API calls',
        expectedOutcome: 'Seamless data flow across all systems',
      });
    }

    // Default opportunity
    if (opportunities.length === 0) {
      opportunities.push({
        area: 'Strategic Growth',
        potential: 'Unlock advanced capabilities for competitive advantage',
        feature: 'Full feature set',
        expectedOutcome: 'Accelerated business outcomes',
      });
    }

    return opportunities;
  }

  // ============================================
  // FR-3: Track and Coordinate
  // ============================================

  /**
   * Track generated upsell intro
   */
  private async trackIntro(intro: GeneratedUpsellIntro): Promise<void> {
    if (!this.supabase) return;

    await this.supabase
      .from('upsell_intro_tracking')
      .insert({
        id: intro.id,
        customer_id: intro.customerId,
        opportunity_id: intro.context.expansionOpportunity?.id,
        approach: intro.approach,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .onConflict('id')
      .ignore();
  }

  /**
   * Update intro tracking with sent status
   */
  async markIntroSent(introId: string): Promise<void> {
    if (!this.supabase) return;

    await this.supabase
      .from('upsell_intro_tracking')
      .update({
        sent_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('id', introId);

    // Also update expansion opportunity if exists
    const { data } = await this.supabase
      .from('upsell_intro_tracking')
      .select('opportunity_id')
      .eq('id', introId)
      .single();

    if (data?.opportunity_id) {
      await this.supabase
        .from('expansion_opportunities')
        .update({
          intro_sent_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq('id', data.opportunity_id);
    }
  }

  /**
   * Track response to upsell intro
   */
  async trackResponse(
    introId: string,
    response: 'positive' | 'neutral' | 'negative' | 'no_response'
  ): Promise<void> {
    if (!this.supabase) return;

    await this.supabase
      .from('upsell_intro_tracking')
      .update({
        responded_at: response !== 'no_response' ? new Date().toISOString() : null,
        response,
        updated_at: new Date().toISOString(),
      })
      .eq('id', introId);

    // Update expansion opportunity
    const { data } = await this.supabase
      .from('upsell_intro_tracking')
      .select('opportunity_id')
      .eq('id', introId)
      .single();

    if (data?.opportunity_id) {
      await this.supabase
        .from('expansion_opportunities')
        .update({
          intro_response: response,
          updated_at: new Date().toISOString(),
        })
        .eq('id', data.opportunity_id);
    }
  }

  /**
   * Get intro tracking history for customer
   */
  async getIntroHistory(customerId: string): Promise<UpsellIntroTracking[]> {
    if (!this.supabase) return [];

    const { data } = await this.supabase
      .from('upsell_intro_tracking')
      .select('*')
      .eq('customer_id', customerId)
      .order('created_at', { ascending: false });

    return (data || []).map(row => ({
      id: row.id,
      customerId: row.customer_id,
      opportunityId: row.opportunity_id,
      approach: row.approach,
      sentAt: row.sent_at ? new Date(row.sent_at) : undefined,
      openedAt: row.opened_at ? new Date(row.opened_at) : undefined,
      respondedAt: row.responded_at ? new Date(row.responded_at) : undefined,
      response: row.response,
      outcome: row.outcome,
      createdAt: new Date(row.created_at),
      updatedAt: new Date(row.updated_at),
    }));
  }

  // ============================================
  // Mock Data for Development
  // ============================================

  private getMockExpansionContext(customerId: string): ExpansionContext {
    return {
      customerId,
      customerName: 'Acme Corp',
      currentTier: 'Professional',
      suggestedTier: 'Enterprise',
      arr: 48000,
      healthScore: 87,
      usageLimits: [
        { type: 'users', current: 98, limit: 100, percentUsed: 98, impact: 'May block new user onboarding soon' },
        { type: 'api', current: '8,500', limit: '10,000', percentUsed: 85 },
      ],
      featureRequests: ['Advanced analytics', 'API priority', 'Custom integrations'],
      expansionOpportunity: {
        id: uuidv4(),
        type: 'upsell',
        estimatedValue: 48000,
        signals: [
          'Usage at 98% of user licenses',
          'API calls at 85% of monthly limit',
          'Feature requests for advanced analytics',
        ],
      },
      contactInfo: {
        name: 'Jennifer Smith',
        email: 'jennifer.smith@acme.com',
        title: 'VP of Operations',
      },
      csmInfo: {
        name: 'Alex Johnson',
        email: 'alex.johnson@company.com',
        title: 'Customer Success Manager',
      },
      recommendedApproach: 'problem_solving',
      approachReasoning: 'Customer is hitting critical usage limits that may impact their operations',
    };
  }
}

// Singleton instance
export const upsellIntroGenerator = new UpsellIntroGenerator();
