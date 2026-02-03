/**
 * Newsletter Personalization Service
 * PRD-045: Quarterly Newsletter Personalization
 *
 * Core service for personalizing quarterly newsletters based on
 * customer data, usage patterns, and relevant product updates
 */

import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { config } from '../../config/index.js';
import { metricsService } from './metricsSection.js';
import {
  generateQuarterlyNewsletterEmail,
  type QuarterlyNewsletterVariables,
} from '../../templates/emails/quarterly-newsletter.js';
import type {
  PersonalizedNewsletter,
  ProductUpdate,
  RelevantProductUpdate,
  NewsletterRecommendation,
  NewsletterRecipient,
  BulkPersonalizationRequest,
  BulkPersonalizationResult,
} from '../../../../types/newsletter.js';

// Initialize Supabase client
let supabase: SupabaseClient | null = null;
if (config.supabaseUrl && config.supabaseServiceKey) {
  supabase = createClient(config.supabaseUrl, config.supabaseServiceKey);
}

export interface PersonalizationConfig {
  maxProductUpdates?: number;
  maxRecommendations?: number;
  includeEvents?: boolean;
  includeTips?: boolean;
  includeCsmNote?: boolean;
  csmNoteTemplate?: string;
}

export interface CustomerData {
  id: string;
  name: string;
  arr: number;
  tier?: string;
  industry?: string;
  healthScore: number;
  primaryContactName: string;
  primaryContactEmail: string;
  primaryContactTitle?: string;
}

export interface CsmData {
  name: string;
  email: string;
  title?: string;
}

// ============================================
// Main Personalization Function
// ============================================

/**
 * Generate a personalized newsletter for a customer
 */
export async function personalizeNewsletter(
  customerId: string,
  quarter: string,
  year: number,
  csmData: CsmData,
  customConfig?: PersonalizationConfig
): Promise<PersonalizedNewsletter> {
  const config: PersonalizationConfig = {
    maxProductUpdates: 3,
    maxRecommendations: 2,
    includeEvents: true,
    includeTips: true,
    includeCsmNote: true,
    ...customConfig,
  };

  // Fetch customer data
  const customer = await fetchCustomerData(customerId);
  if (!customer) {
    throw new Error(`Customer not found: ${customerId}`);
  }

  // Generate customer-specific metrics
  const metrics = await metricsService.generateCustomerMetrics(customerId, quarter, year);

  // Find relevant product updates
  const relevantUpdates = await findRelevantProductUpdates(customer, quarter, year, config.maxProductUpdates);

  // Generate recommendations based on usage patterns
  const recommendations = await generateRecommendations(customer, metrics, config.maxRecommendations);

  // Fetch upcoming events
  const events = config.includeEvents ? await fetchUpcomingEvents() : [];

  // Get tips relevant to customer
  const tips = config.includeTips ? await getRelevantTips(customer, metrics) : [];

  // Generate CSM note
  const csmNote = config.includeCsmNote
    ? generateCsmNote(customer, metrics, csmData.name, config.csmNoteTemplate)
    : undefined;

  // Fetch stakeholders as recipients
  const recipients = await fetchRecipients(customerId, customer.primaryContactEmail);

  // Build template variables
  const templateVariables: QuarterlyNewsletterVariables = {
    customerName: customer.name,
    contactName: customer.primaryContactName,
    contactTitle: customer.primaryContactTitle,
    tier: customer.tier,
    csmName: csmData.name,
    csmEmail: csmData.email,
    csmTitle: csmData.title || 'Customer Success Manager',
    quarter,
    year,
    metrics: {
      healthScore: metrics.healthScore,
      healthScoreChange: metrics.healthScoreChange,
      activeUsers: metrics.activeUsers,
      activeUsersChangePercent: metrics.activeUsersChange,
      featureAdoption: metrics.featureAdoption,
      featureAdoptionChange: metrics.featureAdoptionChange,
      timeSaved: metrics.timeSaved,
      timeSavedChange: metrics.timeSavedChange,
    },
    productUpdates: relevantUpdates.map((u) => ({
      title: u.title,
      description: u.description,
      relevanceNote: u.relevanceReason,
      wasRequested: !!u.matchedRequest,
      link: u.link,
    })),
    recommendations: recommendations.map((r) => ({
      title: r.title,
      description: r.description,
      ctaText: r.ctaText,
      ctaUrl: r.ctaUrl,
    })),
    events,
    csmNote,
    includeEventsSection: events.length > 0,
    includeTipsSection: tips.length > 0,
    tips,
    dashboardUrl: `${process.env.APP_URL || 'https://app.cscx.ai'}/customers/${customerId}`,
  };

  // Generate email content
  const emailContent = generateQuarterlyNewsletterEmail(templateVariables);

  // Build personalized newsletter object
  const newsletter: PersonalizedNewsletter = {
    templateId: `quarterly-${quarter}-${year}`,
    customerId,
    customerName: customer.name,
    quarter,
    year,
    subject: emailContent.subject,
    bodyHtml: emailContent.bodyHtml,
    bodyText: emailContent.bodyText,
    metricsSection: metricsService.formatMetricsSection(metrics, customer.name, quarter),
    relevantUpdates,
    recommendations,
    csmNote: csmNote || '',
    recipients,
    generatedAt: new Date().toISOString(),
    personalizedBy: csmData.email,
  };

  return newsletter;
}

/**
 * Bulk personalize newsletters for multiple customers
 */
export async function bulkPersonalizeNewsletters(
  request: BulkPersonalizationRequest,
  csmData: CsmData
): Promise<BulkPersonalizationResult> {
  const requestId = `bulk_${Date.now()}_${Math.random().toString(36).substring(7)}`;
  const results: BulkPersonalizationResult['newsletters'] = [];

  const config: PersonalizationConfig = {
    maxProductUpdates: request.options?.maxUpdates || 3,
    maxRecommendations: request.options?.maxRecommendations || 2,
    includeCsmNote: request.options?.includeCsmNote ?? true,
    csmNoteTemplate: request.options?.noteTemplate,
  };

  // Filter out excluded customers
  const customerIds = request.customerIds.filter(
    (id) => !request.options?.excludeCustomers?.includes(id)
  );

  let successful = 0;
  let failed = 0;

  for (const customerId of customerIds) {
    try {
      const newsletter = await personalizeNewsletter(
        customerId,
        request.quarter,
        request.year,
        csmData,
        config
      );

      // Store newsletter in database
      const newsletterId = await storeNewsletter(newsletter);

      results.push({
        customerId,
        customerName: newsletter.customerName,
        status: 'success',
        newsletterId,
      });
      successful++;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      results.push({
        customerId,
        customerName: 'Unknown',
        status: 'error',
        error: errorMessage,
      });
      failed++;
    }
  }

  return {
    requestId,
    totalCustomers: customerIds.length,
    successful,
    failed,
    newsletters: results,
    completedAt: new Date().toISOString(),
  };
}

// ============================================
// Data Fetching Functions
// ============================================

async function fetchCustomerData(customerId: string): Promise<CustomerData | null> {
  if (!supabase) {
    // Return mock data for testing
    return {
      id: customerId,
      name: 'CloudTech',
      arr: 150000,
      tier: 'Enterprise',
      industry: 'Technology',
      healthScore: 84,
      primaryContactName: 'Sarah Johnson',
      primaryContactEmail: 'sarah@cloudtech.com',
      primaryContactTitle: 'VP of Engineering',
    };
  }

  try {
    const { data, error } = await supabase
      .from('customers')
      .select('*')
      .eq('id', customerId)
      .single();

    if (error || !data) return null;

    return {
      id: data.id,
      name: data.name,
      arr: data.arr || 0,
      tier: data.tier,
      industry: data.industry,
      healthScore: data.health_score || 70,
      primaryContactName: data.primary_contact_name || 'Customer',
      primaryContactEmail: data.primary_contact_email || '',
      primaryContactTitle: data.primary_contact_title,
    };
  } catch (error) {
    console.error('Error fetching customer data:', error);
    return null;
  }
}

async function fetchRecipients(
  customerId: string,
  primaryEmail: string
): Promise<NewsletterRecipient[]> {
  const recipients: NewsletterRecipient[] = [];

  if (!supabase) {
    return [
      { name: 'Sarah Johnson', email: primaryEmail || 'contact@customer.com', title: 'VP of Engineering' },
    ];
  }

  try {
    // Fetch stakeholders
    const { data: stakeholders } = await supabase
      .from('stakeholders')
      .select('name, email, role, title')
      .eq('customer_id', customerId)
      .eq('is_active', true);

    if (stakeholders) {
      for (const s of stakeholders) {
        if (s.email) {
          recipients.push({
            name: s.name || 'Stakeholder',
            email: s.email,
            title: s.title,
            role: s.role,
          });
        }
      }
    }

    // Add primary contact if not in stakeholders
    if (primaryEmail && !recipients.some((r) => r.email === primaryEmail)) {
      recipients.unshift({
        name: 'Primary Contact',
        email: primaryEmail,
      });
    }

    return recipients.length > 0 ? recipients : [{ name: 'Contact', email: primaryEmail || 'contact@customer.com' }];
  } catch (error) {
    console.error('Error fetching recipients:', error);
    return [{ name: 'Contact', email: primaryEmail || 'contact@customer.com' }];
  }
}

// ============================================
// Relevance Matching Functions
// ============================================

async function findRelevantProductUpdates(
  customer: CustomerData,
  quarter: string,
  year: number,
  maxUpdates: number = 3
): Promise<RelevantProductUpdate[]> {
  // In a real implementation, this would query a product updates table
  // and match based on customer attributes and usage patterns

  const relevantUpdates: RelevantProductUpdate[] = [];

  if (!supabase) {
    // Return mock relevant updates
    return getMockRelevantUpdates(customer);
  }

  try {
    // Fetch product updates for the quarter
    const { startDate, endDate } = getQuarterDateRange(quarter, year);

    const { data: updates } = await supabase
      .from('product_updates')
      .select('*')
      .gte('release_date', startDate)
      .lte('release_date', endDate)
      .order('release_date', { ascending: false });

    if (!updates || updates.length === 0) {
      return getMockRelevantUpdates(customer);
    }

    // Fetch customer's feature requests for matching
    const { data: featureRequests } = await supabase
      .from('feature_requests')
      .select('title, description')
      .eq('customer_id', customer.id)
      .eq('status', 'open');

    const requestTitles = (featureRequests || []).map((r: any) => r.title.toLowerCase());

    // Score and filter updates based on relevance
    for (const update of updates) {
      const relevanceScore = calculateRelevanceScore(update, customer, requestTitles);

      if (relevanceScore > 0) {
        const matchedRequest = requestTitles.find((req) =>
          update.title.toLowerCase().includes(req) || req.includes(update.title.toLowerCase())
        );

        relevantUpdates.push({
          id: update.id,
          title: update.title,
          description: update.description,
          relevanceReason: generateRelevanceReason(update, customer),
          matchedRequest: matchedRequest,
          link: update.documentation_url,
        });
      }

      if (relevantUpdates.length >= maxUpdates) break;
    }

    return relevantUpdates.length > 0 ? relevantUpdates : getMockRelevantUpdates(customer);
  } catch (error) {
    console.error('Error finding relevant product updates:', error);
    return getMockRelevantUpdates(customer);
  }
}

function calculateRelevanceScore(
  update: any,
  customer: CustomerData,
  requestTitles: string[]
): number {
  let score = 0;

  // Base score for all updates
  score += 1;

  // Higher score if customer tier matches target
  if (update.target_tiers && update.target_tiers.includes(customer.tier)) {
    score += 3;
  }

  // Higher score if industry matches
  if (update.target_industries && update.target_industries.includes(customer.industry)) {
    score += 2;
  }

  // Highest score if matches a feature request
  const updateTitle = update.title.toLowerCase();
  for (const req of requestTitles) {
    if (updateTitle.includes(req) || req.includes(updateTitle)) {
      score += 5;
      break;
    }
  }

  // Major updates get priority
  if (update.importance === 'major') {
    score += 2;
  }

  return score;
}

function generateRelevanceReason(update: any, customer: CustomerData): string {
  const reasons: string[] = [];

  if (update.target_tiers?.includes(customer.tier)) {
    reasons.push(`Designed for ${customer.tier} customers`);
  }

  if (update.target_industries?.includes(customer.industry)) {
    reasons.push(`Tailored for the ${customer.industry} industry`);
  }

  if (update.usage_benefit) {
    reasons.push(update.usage_benefit);
  }

  return reasons.length > 0 ? reasons[0] : 'Relevant to your usage patterns';
}

function getMockRelevantUpdates(customer: CustomerData): RelevantProductUpdate[] {
  return [
    {
      id: 'update-1',
      title: 'Advanced Reporting 2.0',
      description: 'Now live with customizable dashboards and real-time data visualization.',
      relevanceReason: 'You requested this feature last quarter!',
      matchedRequest: 'Advanced Reporting',
      link: 'https://docs.example.com/reporting-2.0',
    },
    {
      id: 'update-2',
      title: 'Slack Integration Update',
      description: 'Faster notifications and improved thread syncing for your workflow.',
      relevanceReason: 'Based on your team\'s Slack usage patterns',
    },
    {
      id: 'update-3',
      title: 'API Rate Limits Increased',
      description: '10x higher API limits to support your growing usage.',
      relevanceReason: `Supports ${customer.name}'s expanding integration needs`,
      link: 'https://docs.example.com/api-limits',
    },
  ];
}

// ============================================
// Recommendation Generation
// ============================================

async function generateRecommendations(
  customer: CustomerData,
  metrics: any,
  maxRecommendations: number = 2
): Promise<NewsletterRecommendation[]> {
  const recommendations: NewsletterRecommendation[] = [];

  // Recommendation based on feature adoption
  if (metrics.featureAdoption < 60) {
    recommendations.push({
      id: 'rec-training',
      title: 'Schedule a Training Session',
      description: `Boost your team's feature adoption with a customized training session. We've seen similar teams increase usage by 40% after training.`,
      type: 'training',
      ctaText: 'Book Training',
      ctaUrl: `${process.env.APP_URL || 'https://app.cscx.ai'}/customers/${customer.id}/training`,
      reason: 'Low feature adoption detected',
    });
  }

  // Recommendation based on health score trend
  if (metrics.healthTrend === 'declining') {
    recommendations.push({
      id: 'rec-review',
      title: 'Schedule a Strategy Review',
      description: `Let's discuss opportunities to get more value from your subscription and address any concerns.`,
      type: 'best_practice',
      ctaText: 'Schedule Review',
      ctaUrl: `${process.env.APP_URL || 'https://app.cscx.ai'}/customers/${customer.id}/meeting`,
      reason: 'Declining health score trend',
    });
  }

  // Default recommendations if none generated
  if (recommendations.length === 0) {
    recommendations.push(
      {
        id: 'rec-dashboard',
        title: 'Try the New Dashboard Builder',
        description: 'Perfect for your monthly reviews. Create custom dashboards in minutes.',
        type: 'feature',
        ctaText: 'Explore Dashboard Builder',
        ctaUrl: `${process.env.APP_URL || 'https://app.cscx.ai'}/dashboard/builder`,
        reason: 'Based on your usage patterns',
      },
      {
        id: 'rec-filters',
        title: 'Advanced Filters Training',
        description: 'Our data shows this feature could save your team significant time.',
        type: 'training',
        ctaText: 'Learn More',
        ctaUrl: `${process.env.APP_URL || 'https://app.cscx.ai'}/training/advanced-filters`,
        reason: 'Low adoption area with high value potential',
      }
    );
  }

  return recommendations.slice(0, maxRecommendations);
}

// ============================================
// Events and Tips
// ============================================

async function fetchUpcomingEvents(): Promise<QuarterlyNewsletterVariables['events']> {
  // In production, this would fetch from an events table
  return [
    {
      title: 'Power User Webinar',
      date: getDateInDays(14),
      rsvpUrl: 'https://events.example.com/power-user-webinar',
      description: 'Learn advanced tips and tricks from our product team.',
    },
    {
      title: 'Customer Success Summit',
      date: getDateInDays(45),
      rsvpUrl: 'https://events.example.com/cs-summit',
      description: 'Early bird registration ends soon!',
    },
  ];
}

async function getRelevantTips(customer: CustomerData, metrics: any): Promise<string[]> {
  const tips: string[] = [];

  // Tips based on metrics
  if (metrics.featureAdoption < 70) {
    tips.push('Explore our Quick Start guides to discover features your team might be missing.');
  }

  if (metrics.healthTrend === 'improving') {
    tips.push('You\'re on a roll! Consider documenting your success playbook to share with new team members.');
  }

  // Default tips
  tips.push('Use keyboard shortcuts to navigate 3x faster. Press "?" anywhere in the app to see them.');
  tips.push('Set up automated reports to keep stakeholders informed without manual work.');

  return tips.slice(0, 3);
}

// ============================================
// CSM Note Generation
// ============================================

function generateCsmNote(
  customer: CustomerData,
  metrics: any,
  csmName: string,
  template?: string
): string {
  if (template) {
    return template
      .replace('{{customerName}}', customer.name)
      .replace('{{healthScore}}', metrics.healthScore.toString())
      .replace('{{csmName}}', csmName);
  }

  // Generate contextual note based on metrics
  if (metrics.healthTrend === 'improving') {
    return `I'm thrilled to see ${customer.name}'s progress this quarter. Your team's commitment is really showing in the numbers. Looking forward to continuing this momentum!`;
  } else if (metrics.healthTrend === 'declining') {
    return `I'd love to connect and discuss how we can better support ${customer.name}. Please don't hesitate to reach out - I'm here to help you get the most value from our partnership.`;
  } else {
    return `It's been great working with ${customer.name} this quarter. I'm always here if you have questions or want to explore new ways to leverage the platform.`;
  }
}

// ============================================
// Storage Functions
// ============================================

async function storeNewsletter(newsletter: PersonalizedNewsletter): Promise<string> {
  const newsletterId = `newsletter_${Date.now()}_${Math.random().toString(36).substring(7)}`;

  if (!supabase) {
    return newsletterId;
  }

  try {
    await supabase.from('newsletter_sends').insert({
      id: newsletterId,
      customer_id: newsletter.customerId,
      customer_name: newsletter.customerName,
      quarter: newsletter.quarter,
      year: newsletter.year,
      subject: newsletter.subject,
      body_html: newsletter.bodyHtml,
      body_text: newsletter.bodyText,
      recipients: newsletter.recipients.map((r) => r.email),
      status: 'draft',
      created_at: newsletter.generatedAt,
      personalized_by: newsletter.personalizedBy,
      metrics_snapshot: newsletter.metricsSection,
      relevant_updates: newsletter.relevantUpdates,
      recommendations: newsletter.recommendations,
    });
  } catch (error) {
    console.error('Error storing newsletter:', error);
  }

  return newsletterId;
}

// ============================================
// Helper Functions
// ============================================

function getQuarterDateRange(quarter: string, year: number): { startDate: string; endDate: string } {
  const quarterNum = parseInt(quarter.replace('Q', ''));
  const startMonth = (quarterNum - 1) * 3;
  const endMonth = startMonth + 2;

  const startDate = new Date(year, startMonth, 1);
  const endDate = new Date(year, endMonth + 1, 0);

  return {
    startDate: startDate.toISOString().split('T')[0],
    endDate: endDate.toISOString().split('T')[0],
  };
}

function getDateInDays(days: number): string {
  const date = new Date(Date.now() + days * 24 * 60 * 60 * 1000);
  return date.toISOString();
}

// ============================================
// Exports
// ============================================

export const newsletterPersonalizer = {
  personalizeNewsletter,
  bulkPersonalizeNewsletters,
  fetchCustomerData,
  findRelevantProductUpdates,
  generateRecommendations,
};

export default newsletterPersonalizer;
