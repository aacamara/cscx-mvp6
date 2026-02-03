/**
 * Product Update Announcement Service
 * PRD-033: Product Update Announcement
 *
 * Generates personalized product update emails based on:
 * - Customer entitlements
 * - Usage patterns
 * - Past feature requests
 * - Industry/use case fit
 */

import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { config } from '../../config/index.js';
import { generateProductUpdateEmail, type ProductUpdateVariables } from '../../templates/emails/product-update.js';
import { generateFeatureAnnouncementEmail, type FeatureAnnouncementVariables } from '../../templates/emails/feature-announcement.js';
import { googleOAuth } from '../google/oauth.js';

// Types
export interface ProductUpdate {
  id: string;
  title: string;
  slug?: string;
  version?: string;
  releaseDate: string;
  category: 'feature' | 'enhancement' | 'bugfix' | 'security' | 'performance' | 'deprecation';
  description: string;
  keyBenefits: string[];
  useCases: string[];
  affectedProducts: string[];
  documentationUrl?: string;
  migrationGuideUrl?: string;
  trainingUrl?: string;
  videoUrl?: string;
  relevanceCriteria?: RelevanceCriteria;
  targetSegments?: string[];
  targetEntitlements?: string[];
  isMajor: boolean;
}

export interface RelevanceCriteria {
  minUsagePercentage?: number;
  requiredEntitlements?: string[];
  requiredSegments?: string[];
  requiredFeaturesUsed?: string[];
  excludeSegments?: string[];
  minHealthScore?: number;
}

export interface CustomerRelevance {
  customerId: string;
  customerName: string;
  score: number;
  reasons: string[];
  stakeholders: Array<{
    id: string;
    name: string;
    email: string;
    title?: string;
  }>;
  personalizationData: {
    usageStats?: Record<string, any>;
    relevantBenefits?: string[];
    specificUseCases?: string[];
    previousRequests?: string[];
    customCta?: string;
  };
}

export interface AnnouncementDraft {
  customerId: string;
  customerName: string;
  stakeholderId?: string;
  recipientName: string;
  recipientEmail: string;
  recipientTitle?: string;
  subject: string;
  bodyHtml: string;
  bodyText: string;
  relevanceScore: number;
  relevanceReasons: string[];
  personalizationData: Record<string, any>;
}

export interface BulkAnnouncementResult {
  productUpdateId: string;
  campaignId?: string;
  totalCustomers: number;
  drafts: AnnouncementDraft[];
  summary: {
    bySegment: Record<string, number>;
    byRelevanceReason: Record<string, number>;
    averageRelevanceScore: number;
  };
}

export class ProductUpdateAnnouncementService {
  private supabase: SupabaseClient | null = null;

  constructor() {
    if (config.supabaseUrl && config.supabaseServiceKey) {
      this.supabase = createClient(config.supabaseUrl, config.supabaseServiceKey);
    }
  }

  /**
   * Get a product update by ID
   */
  async getProductUpdate(updateId: string): Promise<ProductUpdate | null> {
    if (!this.supabase) return null;

    const { data, error } = await this.supabase
      .from('product_updates')
      .select('*')
      .eq('id', updateId)
      .single();

    if (error || !data) return null;

    return this.mapProductUpdate(data);
  }

  /**
   * List product updates
   */
  async listProductUpdates(options?: {
    category?: string;
    isMajor?: boolean;
    limit?: number;
    since?: string;
  }): Promise<ProductUpdate[]> {
    if (!this.supabase) return [];

    let query = this.supabase
      .from('product_updates')
      .select('*')
      .order('release_date', { ascending: false });

    if (options?.category) {
      query = query.eq('category', options.category);
    }
    if (options?.isMajor !== undefined) {
      query = query.eq('is_major', options.isMajor);
    }
    if (options?.since) {
      query = query.gte('release_date', options.since);
    }
    if (options?.limit) {
      query = query.limit(options.limit);
    }

    const { data, error } = await query;
    if (error || !data) return [];

    return data.map(this.mapProductUpdate);
  }

  /**
   * Create a new product update
   */
  async createProductUpdate(update: Omit<ProductUpdate, 'id'>): Promise<ProductUpdate | null> {
    if (!this.supabase) return null;

    const { data, error } = await this.supabase
      .from('product_updates')
      .insert({
        title: update.title,
        slug: update.slug,
        version: update.version,
        release_date: update.releaseDate,
        category: update.category,
        description: update.description,
        key_benefits: update.keyBenefits,
        use_cases: update.useCases,
        affected_products: update.affectedProducts,
        documentation_url: update.documentationUrl,
        migration_guide_url: update.migrationGuideUrl,
        training_url: update.trainingUrl,
        video_url: update.videoUrl,
        relevance_criteria: update.relevanceCriteria || {},
        target_segments: update.targetSegments || [],
        target_entitlements: update.targetEntitlements || [],
        is_major: update.isMajor,
      })
      .select()
      .single();

    if (error || !data) {
      console.error('Failed to create product update:', error);
      return null;
    }

    return this.mapProductUpdate(data);
  }

  /**
   * Find customers relevant to a product update
   */
  async findRelevantCustomers(
    updateId: string,
    options?: {
      limit?: number;
      segment?: string;
      minHealthScore?: number;
    }
  ): Promise<CustomerRelevance[]> {
    if (!this.supabase) return [];

    const update = await this.getProductUpdate(updateId);
    if (!update) return [];

    // Fetch customers with entitlements and usage data
    let query = this.supabase
      .from('customers')
      .select(`
        *,
        entitlements(*),
        stakeholders(*),
        usage_metrics(feature_name, usage_count, last_used_at)
      `);

    if (options?.segment) {
      query = query.eq('segment', options.segment);
    }
    if (options?.minHealthScore) {
      query = query.gte('health_score', options.minHealthScore);
    }

    const { data: customers, error } = await query;
    if (error || !customers) return [];

    // Score each customer for relevance
    const relevantCustomers: CustomerRelevance[] = [];
    const criteria = update.relevanceCriteria || {};

    for (const customer of customers) {
      const relevanceResult = this.calculateRelevance(customer, update, criteria);

      if (relevanceResult.score > 0) {
        // Fetch feature requests that match this update
        const { data: requests } = await this.supabase
          .from('customer_feature_requests')
          .select('*')
          .eq('customer_id', customer.id)
          .or('status.eq.requested,status.eq.under_review,status.eq.planned');

        const matchingRequests = (requests || []).filter(req =>
          update.title.toLowerCase().includes(req.title?.toLowerCase() || '') ||
          update.description.toLowerCase().includes(req.title?.toLowerCase() || '')
        );

        if (matchingRequests.length > 0) {
          relevanceResult.score += 0.2; // Boost score for matching feature requests
          relevanceResult.reasons.push(
            `Previously requested related feature: "${matchingRequests[0].title}"`
          );
          relevanceResult.personalizationData.previousRequests = matchingRequests.map(r => r.title);
        }

        // Add stakeholders
        const stakeholders = (customer.stakeholders || [])
          .filter((s: any) => s.email)
          .map((s: any) => ({
            id: s.id,
            name: s.name || 'Stakeholder',
            email: s.email,
            title: s.role || s.title,
          }));

        // If no stakeholders, use primary contact
        if (stakeholders.length === 0 && customer.primary_contact_email) {
          stakeholders.push({
            id: 'primary',
            name: customer.primary_contact_name || 'Primary Contact',
            email: customer.primary_contact_email,
            title: customer.primary_contact_title,
          });
        }

        relevantCustomers.push({
          customerId: customer.id,
          customerName: customer.name,
          score: Math.min(relevanceResult.score, 1),
          reasons: relevanceResult.reasons,
          stakeholders,
          personalizationData: relevanceResult.personalizationData,
        });
      }
    }

    // Sort by relevance score
    relevantCustomers.sort((a, b) => b.score - a.score);

    // Apply limit
    if (options?.limit) {
      return relevantCustomers.slice(0, options.limit);
    }

    return relevantCustomers;
  }

  /**
   * Generate personalized announcement emails
   */
  async generateAnnouncementDrafts(
    updateId: string,
    customerIds: string[],
    csmUserId: string,
    options?: {
      templateType?: 'product_update' | 'feature_announcement';
      includeAllStakeholders?: boolean;
    }
  ): Promise<AnnouncementDraft[]> {
    if (!this.supabase) return [];

    const update = await this.getProductUpdate(updateId);
    if (!update) return [];

    // Get CSM info
    let csmInfo = {
      name: 'Your Customer Success Manager',
      email: '',
      title: 'Customer Success Manager',
    };

    try {
      const tokens = await googleOAuth.getTokens(csmUserId);
      if (tokens?.google_email) {
        csmInfo.email = tokens.google_email;
        // Parse name from email or use placeholder
        const nameParts = tokens.google_email.split('@')[0].split('.');
        csmInfo.name = nameParts.map((p: string) => p.charAt(0).toUpperCase() + p.slice(1)).join(' ');
      }
    } catch (e) {
      console.warn('Could not get CSM info from Google tokens');
    }

    // Find relevant customers from the provided list
    const allRelevant = await this.findRelevantCustomers(updateId);
    const relevantMap = new Map(allRelevant.map(r => [r.customerId, r]));

    const drafts: AnnouncementDraft[] = [];

    for (const customerId of customerIds) {
      const relevance = relevantMap.get(customerId);
      if (!relevance) continue;

      const stakeholders = options?.includeAllStakeholders
        ? relevance.stakeholders
        : relevance.stakeholders.slice(0, 1); // Just primary contact

      for (const stakeholder of stakeholders) {
        const draft = this.generateEmailDraft(
          update,
          relevance,
          stakeholder,
          csmInfo,
          options?.templateType || 'product_update'
        );

        drafts.push({
          customerId,
          customerName: relevance.customerName,
          stakeholderId: stakeholder.id,
          recipientName: stakeholder.name,
          recipientEmail: stakeholder.email,
          recipientTitle: stakeholder.title,
          subject: draft.subject,
          bodyHtml: draft.bodyHtml,
          bodyText: draft.bodyText,
          relevanceScore: relevance.score,
          relevanceReasons: relevance.reasons,
          personalizationData: relevance.personalizationData,
        });
      }
    }

    return drafts;
  }

  /**
   * Create bulk announcement campaign
   */
  async createBulkAnnouncementCampaign(
    updateId: string,
    csmUserId: string,
    options?: {
      targetType?: 'all' | 'segment' | 'entitlement' | 'custom';
      targetCriteria?: Record<string, any>;
      customerIds?: string[];
      name?: string;
    }
  ): Promise<BulkAnnouncementResult | null> {
    if (!this.supabase) return null;

    const update = await this.getProductUpdate(updateId);
    if (!update) return null;

    // Find relevant customers
    let relevantCustomers: CustomerRelevance[];

    if (options?.customerIds && options.customerIds.length > 0) {
      // Use specific customer list
      const allRelevant = await this.findRelevantCustomers(updateId);
      relevantCustomers = allRelevant.filter(r =>
        options.customerIds!.includes(r.customerId)
      );
    } else if (options?.targetCriteria?.segment) {
      // Filter by segment
      relevantCustomers = await this.findRelevantCustomers(updateId, {
        segment: options.targetCriteria.segment,
      });
    } else {
      // All relevant customers
      relevantCustomers = await this.findRelevantCustomers(updateId);
    }

    if (relevantCustomers.length === 0) {
      return null;
    }

    // Create campaign record
    const { data: campaign, error: campaignError } = await this.supabase
      .from('announcement_campaigns')
      .insert({
        product_update_id: updateId,
        name: options?.name || `${update.title} Announcement`,
        status: 'draft',
        target_type: options?.targetType || 'custom',
        target_criteria: options?.targetCriteria || {},
        customer_count: relevantCustomers.length,
        created_by: csmUserId,
      })
      .select()
      .single();

    if (campaignError) {
      console.error('Failed to create campaign:', campaignError);
    }

    // Generate drafts
    const drafts = await this.generateAnnouncementDrafts(
      updateId,
      relevantCustomers.map(r => r.customerId),
      csmUserId
    );

    // Calculate summary
    const summary = this.calculateSummary(relevantCustomers, drafts);

    // Store drafts in database
    if (campaign) {
      for (const draft of drafts) {
        await this.supabase.from('announcement_sends').insert({
          campaign_id: campaign.id,
          product_update_id: updateId,
          customer_id: draft.customerId,
          stakeholder_id: draft.stakeholderId !== 'primary' ? draft.stakeholderId : null,
          recipient_email: draft.recipientEmail,
          recipient_name: draft.recipientName,
          csm_user_id: csmUserId,
          status: 'draft',
          personalization_data: draft.personalizationData,
          subject: draft.subject,
          body_html: draft.bodyHtml,
          body_text: draft.bodyText,
          relevance_score: draft.relevanceScore,
          relevance_reasons: draft.relevanceReasons,
        });
      }
    }

    return {
      productUpdateId: updateId,
      campaignId: campaign?.id,
      totalCustomers: relevantCustomers.length,
      drafts,
      summary,
    };
  }

  /**
   * Submit drafts for approval
   */
  async submitForApproval(
    campaignId: string,
    csmUserId: string,
    draftIds?: string[]
  ): Promise<{ approvalIds: string[]; count: number }> {
    if (!this.supabase) return { approvalIds: [], count: 0 };

    // Get drafts
    let query = this.supabase
      .from('announcement_sends')
      .select('*')
      .eq('campaign_id', campaignId)
      .eq('status', 'draft');

    if (draftIds && draftIds.length > 0) {
      query = query.in('id', draftIds);
    }

    const { data: drafts, error } = await query;
    if (error || !drafts) return { approvalIds: [], count: 0 };

    const approvalIds: string[] = [];

    for (const draft of drafts) {
      // Create approval request
      const approvalId = `announcement_${Date.now()}_${Math.random().toString(36).substring(7)}`;

      await this.supabase.from('approval_queue').insert({
        id: approvalId,
        user_id: csmUserId,
        customer_id: draft.customer_id,
        action_type: 'send_email',
        agent_type: 'communicator',
        status: 'pending',
        urgency: 'important',
        title: `Product Update Announcement - ${draft.recipient_name}`,
        description: `Send product update email: ${draft.subject}`,
        action_data: {
          type: 'product_announcement',
          sendId: draft.id,
          campaignId,
          to: [draft.recipient_email],
          subject: draft.subject,
          bodyHtml: draft.body_html,
          bodyText: draft.body_text,
        },
        preview: {
          subject: draft.subject,
          recipients: [draft.recipient_email],
          bodyPreview: draft.body_text?.substring(0, 500),
        },
        expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
      });

      // Update draft status
      await this.supabase
        .from('announcement_sends')
        .update({ status: 'pending_approval', approval_id: approvalId })
        .eq('id', draft.id);

      approvalIds.push(approvalId);
    }

    return { approvalIds, count: approvalIds.length };
  }

  /**
   * Track feature adoption after announcement
   */
  async trackAdoption(
    productUpdateId: string,
    customerId: string,
    status: 'not_started' | 'exploring' | 'piloting' | 'adopted' | 'heavy_usage',
    options?: {
      usageCount?: number;
      feedback?: string;
      feedbackSentiment?: 'positive' | 'neutral' | 'negative';
    }
  ): Promise<void> {
    if (!this.supabase) return;

    // Find the announcement send if exists
    const { data: send } = await this.supabase
      .from('announcement_sends')
      .select('id')
      .eq('product_update_id', productUpdateId)
      .eq('customer_id', customerId)
      .eq('status', 'sent')
      .single();

    await this.supabase.from('feature_adoption').upsert({
      product_update_id: productUpdateId,
      customer_id: customerId,
      announcement_send_id: send?.id,
      adoption_status: status,
      first_used_at: status !== 'not_started' ? new Date().toISOString() : null,
      last_used_at: status !== 'not_started' ? new Date().toISOString() : null,
      usage_count: options?.usageCount || 0,
      adoption_score: this.calculateAdoptionScore(status),
      feedback: options?.feedback,
      feedback_sentiment: options?.feedbackSentiment,
      updated_at: new Date().toISOString(),
    }, {
      onConflict: 'product_update_id,customer_id',
    });
  }

  // ==================== Private Methods ====================

  private mapProductUpdate(data: any): ProductUpdate {
    return {
      id: data.id,
      title: data.title,
      slug: data.slug,
      version: data.version,
      releaseDate: data.release_date,
      category: data.category,
      description: data.description,
      keyBenefits: data.key_benefits || [],
      useCases: data.use_cases || [],
      affectedProducts: data.affected_products || [],
      documentationUrl: data.documentation_url,
      migrationGuideUrl: data.migration_guide_url,
      trainingUrl: data.training_url,
      videoUrl: data.video_url,
      relevanceCriteria: data.relevance_criteria,
      targetSegments: data.target_segments || [],
      targetEntitlements: data.target_entitlements || [],
      isMajor: data.is_major,
    };
  }

  private calculateRelevance(
    customer: any,
    update: ProductUpdate,
    criteria: RelevanceCriteria
  ): {
    score: number;
    reasons: string[];
    personalizationData: Record<string, any>;
  } {
    let score = 0.3; // Base score
    const reasons: string[] = [];
    const personalizationData: Record<string, any> = {};

    // Check segment targeting
    if (update.targetSegments && update.targetSegments.length > 0) {
      if (update.targetSegments.includes(customer.segment)) {
        score += 0.15;
        reasons.push(`Segment match: ${customer.segment}`);
      } else if (criteria.excludeSegments?.includes(customer.segment)) {
        return { score: 0, reasons: [], personalizationData: {} };
      }
    }

    // Check entitlements
    const customerEntitlements = (customer.entitlements || []).map((e: any) => e.feature_name);
    if (update.targetEntitlements && update.targetEntitlements.length > 0) {
      const matchingEntitlements = update.targetEntitlements.filter(e =>
        customerEntitlements.includes(e)
      );
      if (matchingEntitlements.length > 0) {
        score += 0.2;
        reasons.push(`Has relevant entitlements: ${matchingEntitlements.join(', ')}`);
      }
    }

    // Check usage patterns
    const usageMetrics = customer.usage_metrics || [];
    if (usageMetrics.length > 0 && criteria.requiredFeaturesUsed) {
      const usedFeatures = usageMetrics.map((m: any) => m.feature_name);
      const matchingFeatures = criteria.requiredFeaturesUsed.filter(f =>
        usedFeatures.includes(f)
      );
      if (matchingFeatures.length > 0) {
        score += 0.2;
        reasons.push(`Uses related features: ${matchingFeatures.join(', ')}`);

        // Add usage stats for personalization
        personalizationData.usageStats = {};
        for (const feature of matchingFeatures) {
          const metric = usageMetrics.find((m: any) => m.feature_name === feature);
          if (metric) {
            personalizationData.usageStats[feature] = metric.usage_count;
          }
        }
      }
    }

    // Check health score
    if (criteria.minHealthScore && customer.health_score) {
      if (customer.health_score >= criteria.minHealthScore) {
        score += 0.1;
        reasons.push(`Healthy account (score: ${customer.health_score})`);
      }
    }

    // Check ARR tier for major updates
    if (update.isMajor && customer.arr) {
      if (customer.arr >= 100000) {
        score += 0.15;
        reasons.push(`Enterprise customer ($${(customer.arr / 1000).toFixed(0)}k ARR)`);
      } else if (customer.arr >= 50000) {
        score += 0.1;
        reasons.push(`Mid-market customer ($${(customer.arr / 1000).toFixed(0)}k ARR)`);
      }
    }

    // Customize benefits based on customer profile
    if (update.keyBenefits && update.keyBenefits.length > 0) {
      personalizationData.relevantBenefits = update.keyBenefits.slice(0, 3);
    }

    // Add specific use cases
    if (update.useCases && update.useCases.length > 0) {
      personalizationData.specificUseCases = update.useCases.slice(0, 2);
    }

    return { score, reasons, personalizationData };
  }

  private generateEmailDraft(
    update: ProductUpdate,
    relevance: CustomerRelevance,
    stakeholder: { id: string; name: string; email: string; title?: string },
    csmInfo: { name: string; email: string; title: string },
    templateType: 'product_update' | 'feature_announcement'
  ): { subject: string; bodyHtml: string; bodyText: string } {
    const personalization = relevance.personalizationData;

    if (templateType === 'feature_announcement') {
      const variables: FeatureAnnouncementVariables = {
        customerName: relevance.customerName,
        contactName: stakeholder.name,
        contactTitle: stakeholder.title,
        csmName: csmInfo.name,
        csmEmail: csmInfo.email,
        csmTitle: csmInfo.title,
        featureName: update.title,
        tagline: update.keyBenefits[0] || update.description.substring(0, 100),
        releaseDate: new Date(update.releaseDate).toLocaleDateString('en-US', {
          month: 'long',
          day: 'numeric',
          year: 'numeric',
        }),
        category: update.category === 'bugfix' || update.category === 'deprecation'
          ? 'enhancement'
          : update.category as any,
        relevanceReason: relevance.reasons[0] || 'Based on your usage patterns',
        usageMetric: personalization.usageStats
          ? {
              label: Object.keys(personalization.usageStats)[0],
              value: String(Object.values(personalization.usageStats)[0]),
              context: 'Current monthly usage',
            }
          : undefined,
        customerBenefits: (personalization.relevantBenefits || update.keyBenefits).map(b => ({
          title: b.split(' - ')[0] || b.substring(0, 50),
          description: b.split(' - ')[1] || b,
        })),
        primaryCta: {
          label: update.documentationUrl ? 'View Documentation' : 'Learn More',
          url: update.documentationUrl || '#',
        },
        secondaryCta: update.trainingUrl
          ? { label: 'Start Training', url: update.trainingUrl }
          : undefined,
        previousRequestReference: personalization.previousRequests?.[0]
          ? `You previously requested "${personalization.previousRequests[0]}" - this update addresses that!`
          : undefined,
      };

      return generateFeatureAnnouncementEmail(variables);
    }

    // Default: product_update template
    const variables: ProductUpdateVariables = {
      customerName: relevance.customerName,
      contactName: stakeholder.name,
      contactTitle: stakeholder.title,
      csmName: csmInfo.name,
      csmEmail: csmInfo.email,
      csmTitle: csmInfo.title,
      updateTitle: update.title,
      updateDescription: update.description,
      releaseDate: new Date(update.releaseDate).toLocaleDateString('en-US', {
        month: 'long',
        day: 'numeric',
        year: 'numeric',
      }),
      keyBenefits: update.keyBenefits,
      relevantBenefits: personalization.relevantBenefits,
      useCases: personalization.specificUseCases,
      documentationUrl: update.documentationUrl,
      migrationGuideUrl: update.migrationGuideUrl,
      trainingUrl: update.trainingUrl,
      videoUrl: update.videoUrl,
      previousRequestNote: personalization.previousRequests?.[0]
        ? `This addresses your previous request for "${personalization.previousRequests[0]}".`
        : undefined,
    };

    // Add usage context if available
    if (personalization.usageStats) {
      const stats = Object.entries(personalization.usageStats);
      if (stats.length > 0) {
        const [feature, count] = stats[0];
        variables.usageContext = `Given ${relevance.customerName}'s significant ${feature} usage (${count} operations last month), this update is particularly relevant.`;
      }
    }

    return generateProductUpdateEmail(variables);
  }

  private calculateSummary(
    relevantCustomers: CustomerRelevance[],
    drafts: AnnouncementDraft[]
  ): BulkAnnouncementResult['summary'] {
    const bySegment: Record<string, number> = {};
    const byRelevanceReason: Record<string, number> = {};
    let totalScore = 0;

    for (const customer of relevantCustomers) {
      totalScore += customer.score;

      for (const reason of customer.reasons) {
        const category = reason.split(':')[0];
        byRelevanceReason[category] = (byRelevanceReason[category] || 0) + 1;
      }
    }

    return {
      bySegment,
      byRelevanceReason,
      averageRelevanceScore: relevantCustomers.length > 0
        ? totalScore / relevantCustomers.length
        : 0,
    };
  }

  private calculateAdoptionScore(status: string): number {
    const scores: Record<string, number> = {
      not_started: 0,
      exploring: 0.25,
      piloting: 0.5,
      adopted: 0.75,
      heavy_usage: 1,
    };
    return scores[status] || 0;
  }
}

// Singleton instance
export const productUpdateAnnouncementService = new ProductUpdateAnnouncementService();
