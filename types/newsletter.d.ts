/**
 * Newsletter Types
 * PRD-045: Quarterly Newsletter Personalization
 *
 * Types for newsletter templates, personalization, and tracking
 */
export interface NewsletterTemplate {
    id: string;
    name: string;
    quarter: string;
    year: number;
    version: string;
    status: 'draft' | 'active' | 'archived';
    createdAt: string;
    updatedAt: string;
    subject: string;
    introText: string;
    outroText: string;
    sections: NewsletterSection[];
    headerImage?: string;
    primaryColor?: string;
    accentColor?: string;
}
export interface NewsletterSection {
    id: string;
    type: NewsletterSectionType;
    title: string;
    order: number;
    required: boolean;
    personalizable: boolean;
    defaultContent?: string;
}
export type NewsletterSectionType = 'product_highlights' | 'customer_metrics' | 'relevant_updates' | 'recommendations' | 'upcoming_events' | 'tips_best_practices' | 'customer_spotlight' | 'csm_note' | 'custom';
export interface NewsletterCustomerMetrics {
    healthScore: number;
    healthScoreChange: number;
    healthTrend: 'improving' | 'stable' | 'declining';
    activeUsers: number;
    activeUsersChange: number;
    featureAdoption: number;
    featureAdoptionChange: number;
    timeSaved?: number;
    timeSavedChange?: number;
    npsScore?: number;
    supportTickets?: number;
    loginFrequency?: number;
    customMetrics?: Record<string, {
        value: number | string;
        change?: number;
        label: string;
    }>;
}
export interface ProductUpdate {
    id: string;
    title: string;
    description: string;
    releaseDate: string;
    category: ProductUpdateCategory;
    features: string[];
    relevantFor: RelevanceFilter[];
    importance: 'major' | 'minor' | 'patch';
    documentationUrl?: string;
    videoUrl?: string;
}
export type ProductUpdateCategory = 'new_feature' | 'enhancement' | 'integration' | 'performance' | 'security' | 'api' | 'ui_ux';
export interface RelevanceFilter {
    type: 'tier' | 'industry' | 'usage_pattern' | 'feature_request' | 'segment';
    value: string;
}
export interface PersonalizedNewsletter {
    templateId: string;
    customerId: string;
    customerName: string;
    quarter: string;
    year: number;
    subject: string;
    bodyHtml: string;
    bodyText: string;
    metricsSection: NewsletterMetricsSection;
    relevantUpdates: RelevantProductUpdate[];
    recommendations: NewsletterRecommendation[];
    csmNote: string;
    recipients: NewsletterRecipient[];
    generatedAt: string;
    personalizedBy?: string;
}
export interface NewsletterMetricsSection {
    title: string;
    metrics: Array<{
        label: string;
        value: string | number;
        change?: number;
        changeLabel?: string;
        trend?: 'up' | 'down' | 'stable';
    }>;
}
export interface RelevantProductUpdate {
    id: string;
    title: string;
    description: string;
    relevanceReason: string;
    matchedRequest?: string;
    link?: string;
}
export interface NewsletterRecommendation {
    id: string;
    title: string;
    description: string;
    type: 'feature' | 'training' | 'best_practice' | 'resource';
    ctaText?: string;
    ctaUrl?: string;
    reason: string;
}
export interface NewsletterRecipient {
    name: string;
    email: string;
    title?: string;
    role?: string;
}
export interface NewsletterSend {
    id: string;
    newsletterId: string;
    customerId: string;
    customerName: string;
    subject: string;
    recipients: string[];
    cc?: string[];
    bcc?: string[];
    status: NewsletterSendStatus;
    sentAt?: string;
    sentBy?: string;
    messageId?: string;
    opened?: boolean;
    openedAt?: string;
    clicked?: boolean;
    clickedAt?: string;
    clickedLinks?: string[];
    replied?: boolean;
    repliedAt?: string;
    createdAt: string;
    updatedAt: string;
}
export type NewsletterSendStatus = 'draft' | 'pending_approval' | 'approved' | 'scheduled' | 'sending' | 'sent' | 'failed' | 'cancelled';
export interface BulkPersonalizationRequest {
    templateId: string;
    customerIds: string[];
    quarter: string;
    year: number;
    options?: BulkPersonalizationOptions;
}
export interface BulkPersonalizationOptions {
    includeCsmNote: boolean;
    noteTemplate?: string;
    maxUpdates?: number;
    maxRecommendations?: number;
    filterUpdatesBy?: RelevanceFilter[];
    excludeCustomers?: string[];
}
export interface BulkPersonalizationResult {
    requestId: string;
    totalCustomers: number;
    successful: number;
    failed: number;
    newsletters: Array<{
        customerId: string;
        customerName: string;
        status: 'success' | 'error';
        newsletterId?: string;
        error?: string;
    }>;
    completedAt: string;
}
export interface GenerateNewsletterRequest {
    quarter?: string;
    year?: number;
    templateId?: string;
    customMessage?: string;
    includeSections?: NewsletterSectionType[];
    excludeSections?: NewsletterSectionType[];
    productUpdates?: string[];
}
export interface GenerateNewsletterResponse {
    success: boolean;
    newsletter: PersonalizedNewsletter;
    customer: {
        id: string;
        name: string;
        arr: number;
        healthScore: number;
        tier?: string;
    };
    template: {
        id: string;
        name: string;
        quarter: string;
        year: number;
    };
}
export interface SendNewsletterRequest {
    recipients?: string[];
    cc?: string[];
    bcc?: string[];
    subject?: string;
    bodyHtml?: string;
    bodyText?: string;
    scheduledFor?: string;
}
export interface SendNewsletterResponse {
    success: boolean;
    approvalId: string;
    status: NewsletterSendStatus;
    message: string;
    draft: {
        subject: string;
        recipients: string[];
        bodyPreview: string;
    };
}
export interface NewsletterAnalytics {
    quarter: string;
    year: number;
    totalSent: number;
    uniqueCustomers: number;
    engagement: {
        openRate: number;
        clickRate: number;
        replyRate: number;
        avgTimeToOpen: number;
    };
    topClickedLinks: Array<{
        url: string;
        label: string;
        clicks: number;
    }>;
    sectionEngagement: Array<{
        sectionType: NewsletterSectionType;
        clickRate: number;
        avgTimeSpent?: number;
    }>;
    customerSegments: Array<{
        segment: string;
        count: number;
        openRate: number;
        clickRate: number;
    }>;
}
export interface NewsletterEvent {
    type: 'newsletter_sent' | 'newsletter_opened' | 'newsletter_clicked' | 'newsletter_replied';
    newsletterId: string;
    customerId: string;
    timestamp: string;
    data: {
        quarter: string;
        year: number;
        subject?: string;
        linkClicked?: string;
        replyExcerpt?: string;
    };
}
//# sourceMappingURL=newsletter.d.ts.map