/**
 * PRD-099: High-Value Feature Released Alert
 * Feature Release Service - Main implementation
 *
 * Handles:
 * - Product release management
 * - Customer-feature matching
 * - Alert generation
 * - Tracking announcements and adoption
 */

import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { config } from '../../config/index.js';
import {
  ProductRelease,
  ProductReleaseRow,
  FeatureRequest,
  FeatureRequestRow,
  ReleaseCustomerMatch,
  ReleaseCustomerMatchRow,
  CreateReleaseRequest,
  PublishReleaseRequest,
  MatchReason,
  MatchDetails,
  FeatureReleaseAlertData,
  DEFAULT_SCORING_CONFIG,
  ProductTier,
  AnnouncementMethod,
} from './types.js';
import { featureReleaseSlackAlerts } from './slack-alerts.js';

// ============================================
// Feature Release Service Class
// ============================================

export class FeatureReleaseService {
  private supabase: SupabaseClient | null = null;

  constructor() {
    if (config.supabaseUrl && config.supabaseServiceKey) {
      this.supabase = createClient(config.supabaseUrl, config.supabaseServiceKey);
    }
  }

  // ============================================
  // Product Release CRUD
  // ============================================

  /**
   * Create a new product release (FR-1.1)
   */
  async createRelease(data: CreateReleaseRequest, userId?: string): Promise<ProductRelease> {
    if (!this.supabase) {
      // Mock for demo mode
      return this.createMockRelease(data);
    }

    const { data: release, error } = await this.supabase
      .from('product_releases')
      .insert({
        feature_id: data.featureId,
        feature_name: data.featureName,
        description: data.description || null,
        release_date: data.releaseDate || new Date().toISOString().split('T')[0],
        tier_availability: data.tierAvailability || ['starter', 'professional', 'enterprise'],
        keywords: data.keywords || [],
        documentation_url: data.documentationUrl || null,
        video_url: data.videoUrl || null,
        announcement_content: data.announcementContent || null,
        enablement_resources: data.enablementResources || {},
        category: data.category || null,
        status: 'draft',
        created_by: userId || null,
      })
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to create release: ${error.message}`);
    }

    return this.mapReleaseRow(release);
  }

  /**
   * Get a product release by ID
   */
  async getRelease(releaseId: string): Promise<ProductRelease | null> {
    if (!this.supabase) {
      return null;
    }

    const { data, error } = await this.supabase
      .from('product_releases')
      .select('*')
      .eq('id', releaseId)
      .single();

    if (error || !data) {
      return null;
    }

    return this.mapReleaseRow(data);
  }

  /**
   * List product releases
   */
  async listReleases(options?: {
    status?: string;
    category?: string;
    limit?: number;
    offset?: number;
  }): Promise<ProductRelease[]> {
    if (!this.supabase) {
      return [];
    }

    let query = this.supabase
      .from('product_releases')
      .select('*')
      .order('release_date', { ascending: false });

    if (options?.status) {
      query = query.eq('status', options.status);
    }

    if (options?.category) {
      query = query.eq('category', options.category);
    }

    if (options?.limit) {
      const offset = options.offset || 0;
      query = query.range(offset, offset + options.limit - 1);
    }

    const { data, error } = await query;

    if (error) {
      throw new Error(`Failed to list releases: ${error.message}`);
    }

    return (data || []).map(this.mapReleaseRow);
  }

  /**
   * Update a product release
   */
  async updateRelease(
    releaseId: string,
    updates: Partial<CreateReleaseRequest>
  ): Promise<ProductRelease> {
    if (!this.supabase) {
      throw new Error('Database not available');
    }

    const updateData: Record<string, unknown> = {
      updated_at: new Date().toISOString(),
    };

    if (updates.featureName) updateData.feature_name = updates.featureName;
    if (updates.description !== undefined) updateData.description = updates.description;
    if (updates.releaseDate) updateData.release_date = updates.releaseDate;
    if (updates.tierAvailability) updateData.tier_availability = updates.tierAvailability;
    if (updates.keywords) updateData.keywords = updates.keywords;
    if (updates.documentationUrl !== undefined) updateData.documentation_url = updates.documentationUrl;
    if (updates.videoUrl !== undefined) updateData.video_url = updates.videoUrl;
    if (updates.announcementContent !== undefined) updateData.announcement_content = updates.announcementContent;
    if (updates.enablementResources) updateData.enablement_resources = updates.enablementResources;
    if (updates.category !== undefined) updateData.category = updates.category;

    const { data, error } = await this.supabase
      .from('product_releases')
      .update(updateData)
      .eq('id', releaseId)
      .select()
      .single();

    if (error || !data) {
      throw new Error(`Failed to update release: ${error?.message || 'Not found'}`);
    }

    return this.mapReleaseRow(data);
  }

  // ============================================
  // Publish & Match (FR-1.1 - FR-1.5)
  // ============================================

  /**
   * Publish a release and find matching customers
   */
  async publishRelease(request: PublishReleaseRequest): Promise<{
    release: ProductRelease;
    matchesFound: number;
    alertsSent: number;
  }> {
    const { releaseId, minMatchScore = 60, notifyCSMs = true } = request;

    // Update release status to active
    if (this.supabase) {
      await this.supabase
        .from('product_releases')
        .update({ status: 'active', updated_at: new Date().toISOString() })
        .eq('id', releaseId);
    }

    const release = await this.getRelease(releaseId);
    if (!release) {
      throw new Error('Release not found');
    }

    // Find matching customers (FR-1.1 - FR-1.5)
    const matches = await this.findMatchingCustomers(release, minMatchScore);

    // Save matches to database
    const savedMatches = await this.saveMatches(releaseId, matches);

    // Send alerts to CSMs (FR-2.1)
    let alertsSent = 0;
    if (notifyCSMs) {
      alertsSent = await this.sendAlerts(release, savedMatches);
    }

    return {
      release,
      matchesFound: savedMatches.length,
      alertsSent,
    };
  }

  /**
   * Find customers that match a release (FR-1.1 - FR-1.5)
   */
  private async findMatchingCustomers(
    release: ProductRelease,
    minScore: number
  ): Promise<Array<{
    customerId: string;
    matchReason: MatchReason;
    matchScore: number;
    matchDetails: MatchDetails;
    featureRequestId?: string;
  }>> {
    if (!this.supabase) {
      return this.getMockMatches(release);
    }

    const matches: Array<{
      customerId: string;
      matchReason: MatchReason;
      matchScore: number;
      matchDetails: MatchDetails;
      featureRequestId?: string;
    }> = [];

    // 1. Match by feature requests (FR-1.1)
    const requestMatches = await this.matchByFeatureRequests(release);
    matches.push(...requestMatches);

    // 2. Match by keywords and use cases (FR-1.2)
    const keywordMatches = await this.matchByKeywords(release);
    // Merge with existing matches or add new ones
    for (const km of keywordMatches) {
      const existing = matches.find(m => m.customerId === km.customerId);
      if (existing) {
        // Combine scores
        existing.matchScore = Math.min(100, existing.matchScore + km.matchScore * 0.5);
        existing.matchDetails.matchedKeywords = [
          ...(existing.matchDetails.matchedKeywords || []),
          ...(km.matchDetails.matchedKeywords || []),
        ];
      } else {
        matches.push(km);
      }
    }

    // 3. Match by usage patterns (FR-1.3)
    const usageMatches = await this.matchByUsagePatterns(release);
    for (const um of usageMatches) {
      const existing = matches.find(m => m.customerId === um.customerId);
      if (existing) {
        existing.matchScore = Math.min(100, existing.matchScore + um.matchScore * 0.3);
        existing.matchDetails.usageMetrics = um.matchDetails.usageMetrics;
      } else {
        matches.push(um);
      }
    }

    // 4. Filter by tier availability (FR-1.5)
    const tierFiltered = await this.filterByTierAvailability(matches, release.tierAvailability);

    // 5. Filter by minimum score (FR-1.4)
    return tierFiltered.filter(m => m.matchScore >= minScore);
  }

  /**
   * Match by feature requests (FR-1.1)
   */
  private async matchByFeatureRequests(release: ProductRelease): Promise<Array<{
    customerId: string;
    matchReason: MatchReason;
    matchScore: number;
    matchDetails: MatchDetails;
    featureRequestId: string;
  }>> {
    if (!this.supabase) return [];

    // Find feature requests that match release keywords
    const releaseKeywords = release.keywords.map(k => k.toLowerCase());

    const { data: requests, error } = await this.supabase
      .from('feature_requests')
      .select('*')
      .in('status', ['open', 'under_review', 'planned', 'in_progress'])
      .not('customer_id', 'is', null);

    if (error || !requests) return [];

    const matches: Array<{
      customerId: string;
      matchReason: MatchReason;
      matchScore: number;
      matchDetails: MatchDetails;
      featureRequestId: string;
    }> = [];

    for (const request of requests as FeatureRequestRow[]) {
      const requestKeywords = request.keywords.map(k => k.toLowerCase());
      const titleWords = request.title.toLowerCase().split(/\s+/);
      const descWords = (request.description || '').toLowerCase().split(/\s+/);
      const allRequestWords = [...requestKeywords, ...titleWords, ...descWords];

      // Find matching keywords
      const matchedKeywords = releaseKeywords.filter(rk =>
        allRequestWords.some(rw => rw.includes(rk) || rk.includes(rw))
      );

      if (matchedKeywords.length > 0) {
        // Calculate score based on match quality
        let score = DEFAULT_SCORING_CONFIG.featureRequestWeight;

        // Bonus for more keyword matches
        score += Math.min(20, matchedKeywords.length * 5);

        // Bonus for recent requests (within 90 days)
        const daysSinceRequest = Math.floor(
          (Date.now() - new Date(request.submitted_at).getTime()) / (1000 * 60 * 60 * 24)
        );
        if (daysSinceRequest <= 90) {
          score += DEFAULT_SCORING_CONFIG.recentRequestBonus;
        }

        // Bonus for high priority requests
        if (request.priority === 'critical' || request.priority === 'high') {
          score += 10;
        }

        matches.push({
          customerId: request.customer_id,
          matchReason: 'feature_request',
          matchScore: Math.min(100, score),
          matchDetails: {
            featureRequestId: request.id,
            matchedKeywords,
            relevanceExplanation: `Customer requested "${request.title}" which matches this feature.`,
          },
          featureRequestId: request.id,
        });
      }
    }

    return matches;
  }

  /**
   * Match by keywords in customer goals/metadata (FR-1.2)
   */
  private async matchByKeywords(release: ProductRelease): Promise<Array<{
    customerId: string;
    matchReason: MatchReason;
    matchScore: number;
    matchDetails: MatchDetails;
  }>> {
    if (!this.supabase) return [];

    // Get customers with metadata containing goals or keywords
    const { data: customers, error } = await this.supabase
      .from('customers')
      .select('id, name, metadata')
      .not('metadata', 'is', null);

    if (error || !customers) return [];

    const releaseKeywords = release.keywords.map(k => k.toLowerCase());
    const matches: Array<{
      customerId: string;
      matchReason: MatchReason;
      matchScore: number;
      matchDetails: MatchDetails;
    }> = [];

    for (const customer of customers) {
      const metadata = customer.metadata as Record<string, unknown>;
      if (!metadata) continue;

      // Extract customer goals and keywords from metadata
      const customerGoals = (metadata.goals as string[] || []).map(g => g.toLowerCase());
      const customerKeywords = (metadata.keywords as string[] || []).map(k => k.toLowerCase());
      const useCases = (metadata.use_cases as string[] || []).map(u => u.toLowerCase());

      const allCustomerWords = [...customerGoals, ...customerKeywords, ...useCases];

      // Find matching keywords
      const matchedKeywords = releaseKeywords.filter(rk =>
        allCustomerWords.some(cw => cw.includes(rk) || rk.includes(cw))
      );

      if (matchedKeywords.length >= 2) { // Require at least 2 matching keywords
        matches.push({
          customerId: customer.id,
          matchReason: 'use_case',
          matchScore: DEFAULT_SCORING_CONFIG.keywordMatchWeight + matchedKeywords.length * 3,
          matchDetails: {
            matchedKeywords,
            customerGoals: customerGoals.slice(0, 3),
            relevanceExplanation: `Customer goals align with feature keywords: ${matchedKeywords.join(', ')}`,
          },
        });
      }
    }

    return matches;
  }

  /**
   * Match by usage patterns (FR-1.3)
   */
  private async matchByUsagePatterns(release: ProductRelease): Promise<Array<{
    customerId: string;
    matchReason: MatchReason;
    matchScore: number;
    matchDetails: MatchDetails;
  }>> {
    if (!this.supabase) return [];

    // Get recent usage data
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const { data: usageData, error } = await this.supabase
      .from('usage_metrics')
      .select('customer_id, metric_name, metric_value')
      .gte('recorded_at', thirtyDaysAgo.toISOString());

    if (error || !usageData) return [];

    // Map release keywords to potential usage metrics
    const relevantMetrics = release.keywords.flatMap(k => {
      const keyword = k.toLowerCase();
      if (keyword.includes('export')) return ['exports_count', 'data_exports'];
      if (keyword.includes('api')) return ['api_calls', 'api_requests'];
      if (keyword.includes('report')) return ['reports_generated', 'report_views'];
      if (keyword.includes('integrat')) return ['integrations_active', 'sync_count'];
      return [keyword + '_count', keyword + '_usage'];
    });

    // Group usage by customer
    const customerUsage = new Map<string, Record<string, number>>();
    for (const usage of usageData) {
      const existing = customerUsage.get(usage.customer_id) || {};
      existing[usage.metric_name] = (existing[usage.metric_name] || 0) + usage.metric_value;
      customerUsage.set(usage.customer_id, existing);
    }

    const matches: Array<{
      customerId: string;
      matchReason: MatchReason;
      matchScore: number;
      matchDetails: MatchDetails;
    }> = [];

    for (const [customerId, metrics] of customerUsage) {
      // Check for high usage of relevant metrics
      const relevantUsage: Record<string, number> = {};
      let hasHighUsage = false;

      for (const metricName of Object.keys(metrics)) {
        if (relevantMetrics.some(rm => metricName.toLowerCase().includes(rm.toLowerCase()))) {
          relevantUsage[metricName] = metrics[metricName];
          if (metrics[metricName] > 100) { // Threshold for "high" usage
            hasHighUsage = true;
          }
        }
      }

      if (hasHighUsage) {
        matches.push({
          customerId,
          matchReason: 'usage_pattern',
          matchScore: DEFAULT_SCORING_CONFIG.usagePatternWeight + (hasHighUsage ? DEFAULT_SCORING_CONFIG.highUsageBonus : 0),
          matchDetails: {
            usageMetrics: relevantUsage,
            relevanceExplanation: `High usage of related features suggests this customer would benefit.`,
          },
        });
      }
    }

    return matches;
  }

  /**
   * Filter matches by tier availability (FR-1.5)
   */
  private async filterByTierAvailability<T extends { customerId: string }>(
    matches: T[],
    tiers: ProductTier[]
  ): Promise<T[]> {
    if (!this.supabase) return matches;

    // Get customer tiers
    const customerIds = matches.map(m => m.customerId);
    const { data: customers, error } = await this.supabase
      .from('customers')
      .select('id, stage, metadata')
      .in('id', customerIds);

    if (error || !customers) return matches;

    // Map customer IDs to their tiers
    const customerTiers = new Map<string, string>();
    for (const c of customers) {
      // Try to get tier from metadata first, fallback to stage
      const tier = (c.metadata as Record<string, unknown>)?.tier as string ||
                   this.mapStageToTier(c.stage);
      customerTiers.set(c.id, tier);
    }

    // Filter matches
    return matches.filter(m => {
      const customerTier = customerTiers.get(m.customerId) || 'starter';
      return tiers.includes(customerTier as ProductTier);
    });
  }

  /**
   * Map customer stage to product tier
   */
  private mapStageToTier(stage: string): ProductTier {
    switch (stage?.toLowerCase()) {
      case 'enterprise':
      case 'strategic':
        return 'enterprise';
      case 'professional':
      case 'growth':
      case 'active':
        return 'professional';
      default:
        return 'starter';
    }
  }

  // ============================================
  // Save & Track Matches
  // ============================================

  /**
   * Save customer matches to database
   */
  private async saveMatches(
    releaseId: string,
    matches: Array<{
      customerId: string;
      matchReason: MatchReason;
      matchScore: number;
      matchDetails: MatchDetails;
      featureRequestId?: string;
    }>
  ): Promise<ReleaseCustomerMatch[]> {
    if (!this.supabase || matches.length === 0) {
      return [];
    }

    // Get CSM assignments for customers
    const customerIds = matches.map(m => m.customerId);
    const { data: customers } = await this.supabase
      .from('customers')
      .select('id, assigned_csm_id')
      .in('id', customerIds);

    const csmMap = new Map<string, string>();
    for (const c of customers || []) {
      if (c.assigned_csm_id) {
        csmMap.set(c.id, c.assigned_csm_id);
      }
    }

    // Insert matches
    const insertData = matches.map(m => ({
      release_id: releaseId,
      customer_id: m.customerId,
      match_reason: m.matchReason,
      match_score: m.matchScore,
      match_details: m.matchDetails,
      feature_request_id: m.featureRequestId || null,
      csm_user_id: csmMap.get(m.customerId) || null,
    }));

    const { data, error } = await this.supabase
      .from('release_customer_matches')
      .upsert(insertData, { onConflict: 'release_id,customer_id' })
      .select();

    if (error) {
      console.error('Failed to save matches:', error);
      return [];
    }

    return (data || []).map(this.mapMatchRow);
  }

  // ============================================
  // Send Alerts (FR-2.1 - FR-2.5)
  // ============================================

  /**
   * Send alerts to CSMs for high-value matches
   */
  private async sendAlerts(
    release: ProductRelease,
    matches: ReleaseCustomerMatch[]
  ): Promise<number> {
    let alertsSent = 0;

    // Get customer and CSM details
    const customerIds = matches.map(m => m.customerId);

    if (!this.supabase) {
      // Mock mode - just count
      return Math.min(matches.length, 5);
    }

    const { data: customers } = await this.supabase
      .from('customers')
      .select('id, name, arr, health_score, stage, metadata')
      .in('id', customerIds);

    const customerMap = new Map(customers?.map(c => [c.id, c]) || []);

    // Get feature requests for matches that have them
    const featureRequestIds = matches
      .map(m => m.featureRequestId)
      .filter(Boolean) as string[];

    let featureRequestMap = new Map<string, FeatureRequestRow>();
    if (featureRequestIds.length > 0) {
      const { data: requests } = await this.supabase
        .from('feature_requests')
        .select('*')
        .in('id', featureRequestIds);

      featureRequestMap = new Map(requests?.map(r => [r.id, r]) || []);
    }

    // Get stakeholders for champion info
    const { data: stakeholders } = await this.supabase
      .from('stakeholders')
      .select('customer_id, name, title, role')
      .in('customer_id', customerIds)
      .eq('role', 'champion');

    const championMap = new Map(stakeholders?.map(s => [s.customer_id, s]) || []);

    // Send alerts for high-scoring matches
    for (const match of matches.filter(m => m.matchScore >= 70)) {
      const customer = customerMap.get(match.customerId);
      if (!customer) continue;

      const champion = championMap.get(match.customerId);
      const featureRequest = match.featureRequestId
        ? featureRequestMap.get(match.featureRequestId)
        : undefined;

      const alertData: FeatureReleaseAlertData = {
        matchId: match.id,
        releaseId: release.id,
        customerId: customer.id,
        customerName: customer.name,
        customerArr: customer.arr || 0,
        customerTier: (customer.metadata as Record<string, unknown>)?.tier as string || customer.stage,
        customerHealthScore: customer.health_score,
        championName: champion?.name,
        championTitle: champion?.title,
        featureName: release.featureName,
        featureDescription: release.description,
        releaseDate: release.releaseDate,
        matchReason: match.matchReason,
        matchScore: match.matchScore,
        matchDetails: match.matchDetails,
        featureRequest: featureRequest ? {
          requestId: featureRequest.request_id,
          title: featureRequest.title,
          submittedAt: featureRequest.submitted_at,
        } : undefined,
        featureHighlights: this.extractFeatureHighlights(release),
        enablementResources: release.enablementResources,
      };

      try {
        // Send Slack alert to CSM
        if (match.csmUserId) {
          await featureReleaseSlackAlerts.sendCsmAlert(
            match.csmUserId,
            match.csmUserId, // DM to CSM
            alertData
          );

          // Update alert sent timestamp
          await this.supabase
            .from('release_customer_matches')
            .update({ alert_sent_at: new Date().toISOString() })
            .eq('id', match.id);

          alertsSent++;
        }
      } catch (err) {
        console.error(`Failed to send alert for match ${match.id}:`, err);
      }
    }

    return alertsSent;
  }

  /**
   * Extract feature highlights from release
   */
  private extractFeatureHighlights(release: ProductRelease): string[] {
    const highlights: string[] = [];

    // Extract from description
    if (release.description) {
      const sentences = release.description.split(/[.!]/).filter(s => s.trim().length > 0);
      highlights.push(...sentences.slice(0, 3).map(s => s.trim()));
    }

    // Extract from announcement content
    if (release.announcementContent) {
      const bullets = release.announcementContent
        .split('\n')
        .filter(line => line.trim().startsWith('-') || line.trim().startsWith('*'))
        .map(line => line.replace(/^[-*]\s*/, '').trim())
        .slice(0, 3);
      highlights.push(...bullets);
    }

    return highlights.slice(0, 5); // Max 5 highlights
  }

  // ============================================
  // Tracking Methods (FR-3.1 - FR-3.3)
  // ============================================

  /**
   * Mark a match as announced (FR-3.1)
   */
  async markAnnounced(
    matchId: string,
    method: AnnouncementMethod,
    notes?: string
  ): Promise<ReleaseCustomerMatch> {
    if (!this.supabase) {
      throw new Error('Database not available');
    }

    const { data, error } = await this.supabase
      .from('release_customer_matches')
      .update({
        announced_at: new Date().toISOString(),
        announcement_method: method,
        adoption_notes: notes,
        updated_at: new Date().toISOString(),
      })
      .eq('id', matchId)
      .select()
      .single();

    if (error || !data) {
      throw new Error(`Failed to mark announced: ${error?.message || 'Not found'}`);
    }

    return this.mapMatchRow(data);
  }

  /**
   * Mark a match as adopted (FR-3.2)
   */
  async markAdopted(matchId: string, notes?: string): Promise<ReleaseCustomerMatch> {
    if (!this.supabase) {
      throw new Error('Database not available');
    }

    const { data, error } = await this.supabase
      .from('release_customer_matches')
      .update({
        adopted_at: new Date().toISOString(),
        adoption_notes: notes,
        updated_at: new Date().toISOString(),
      })
      .eq('id', matchId)
      .select()
      .single();

    if (error || !data) {
      throw new Error(`Failed to mark adopted: ${error?.message || 'Not found'}`);
    }

    // Update linked feature request status if exists
    const match = this.mapMatchRow(data);
    if (match.featureRequestId) {
      await this.closeFeatureRequest(match.featureRequestId, match.releaseId);
    }

    return match;
  }

  /**
   * Close a feature request (FR-3.3)
   */
  async closeFeatureRequest(requestId: string, releaseId: string): Promise<void> {
    if (!this.supabase) return;

    await this.supabase
      .from('feature_requests')
      .update({
        status: 'released',
        linked_release_id: releaseId,
        resolved_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('id', requestId);
  }

  // ============================================
  // Query Methods
  // ============================================

  /**
   * Get matches for a release
   */
  async getMatchesForRelease(releaseId: string, options?: {
    minScore?: number;
    announced?: boolean;
    limit?: number;
  }): Promise<ReleaseCustomerMatch[]> {
    if (!this.supabase) return [];

    let query = this.supabase
      .from('release_customer_matches')
      .select('*')
      .eq('release_id', releaseId)
      .order('match_score', { ascending: false });

    if (options?.minScore) {
      query = query.gte('match_score', options.minScore);
    }

    if (options?.announced === true) {
      query = query.not('announced_at', 'is', null);
    } else if (options?.announced === false) {
      query = query.is('announced_at', null);
    }

    if (options?.limit) {
      query = query.limit(options.limit);
    }

    const { data, error } = await query;

    if (error) {
      throw new Error(`Failed to get matches: ${error.message}`);
    }

    return (data || []).map(this.mapMatchRow);
  }

  /**
   * Get matches for a customer
   */
  async getMatchesForCustomer(customerId: string): Promise<ReleaseCustomerMatch[]> {
    if (!this.supabase) return [];

    const { data, error } = await this.supabase
      .from('release_customer_matches')
      .select('*')
      .eq('customer_id', customerId)
      .order('created_at', { ascending: false });

    if (error) {
      throw new Error(`Failed to get matches: ${error.message}`);
    }

    return (data || []).map(this.mapMatchRow);
  }

  /**
   * Get pending announcements for a CSM
   */
  async getPendingAnnouncements(csmUserId: string): Promise<Array<{
    match: ReleaseCustomerMatch;
    release: ProductRelease;
    customer: { id: string; name: string; arr: number };
  }>> {
    if (!this.supabase) return [];

    const { data, error } = await this.supabase
      .from('v_pending_feature_announcements')
      .select('*')
      .eq('csm_user_id', csmUserId)
      .order('match_score', { ascending: false });

    if (error) {
      console.error('Failed to get pending announcements:', error);
      return [];
    }

    return (data || []).map(row => ({
      match: {
        id: row.match_id,
        releaseId: row.release_id,
        customerId: row.customer_id,
        matchReason: row.match_reason,
        matchScore: row.match_score,
        matchDetails: row.match_details,
        featureRequestId: row.feature_request_id,
        csmUserId: row.csm_user_id,
        alertSentAt: null,
        announcedAt: null,
        announcementMethod: null,
        adoptedAt: null,
        adoptionNotes: null,
        outreachTaskId: null,
        outreachTaskCreatedAt: null,
        outreachTaskDueDate: null,
        createdAt: row.match_created_at,
        updatedAt: row.match_created_at,
      },
      release: {
        id: row.release_id,
        featureId: '',
        featureName: row.feature_name,
        description: row.feature_description,
        releaseDate: row.release_date,
        tierAvailability: row.tier_availability,
        keywords: [],
        documentationUrl: null,
        videoUrl: null,
        announcementContent: null,
        enablementResources: row.enablement_resources,
        category: null,
        status: 'active',
        createdBy: null,
        createdAt: '',
        updatedAt: '',
      },
      customer: {
        id: row.customer_id,
        name: row.customer_name,
        arr: row.arr,
      },
    }));
  }

  /**
   * Get adoption statistics for a release
   */
  async getAdoptionStats(releaseId: string): Promise<{
    totalMatches: number;
    announcedCount: number;
    adoptedCount: number;
    adoptionRate: number;
    arrAnnounced: number;
    arrAdopted: number;
  }> {
    if (!this.supabase) {
      return {
        totalMatches: 0,
        announcedCount: 0,
        adoptedCount: 0,
        adoptionRate: 0,
        arrAnnounced: 0,
        arrAdopted: 0,
      };
    }

    const { data, error } = await this.supabase
      .from('v_feature_adoption_tracking')
      .select('*')
      .eq('release_id', releaseId)
      .single();

    if (error || !data) {
      return {
        totalMatches: 0,
        announcedCount: 0,
        adoptedCount: 0,
        adoptionRate: 0,
        arrAnnounced: 0,
        arrAdopted: 0,
      };
    }

    return {
      totalMatches: data.total_matches || 0,
      announcedCount: data.announced_count || 0,
      adoptedCount: data.adopted_count || 0,
      adoptionRate: data.adoption_rate || 0,
      arrAnnounced: data.arr_announced || 0,
      arrAdopted: data.arr_adopted || 0,
    };
  }

  // ============================================
  // Helper Methods
  // ============================================

  private mapReleaseRow(row: ProductReleaseRow): ProductRelease {
    return {
      id: row.id,
      featureId: row.feature_id,
      featureName: row.feature_name,
      description: row.description,
      releaseDate: row.release_date,
      tierAvailability: row.tier_availability as ProductTier[],
      keywords: row.keywords || [],
      documentationUrl: row.documentation_url,
      videoUrl: row.video_url,
      announcementContent: row.announcement_content,
      enablementResources: row.enablement_resources || {},
      category: row.category,
      status: row.status as 'draft' | 'active' | 'deprecated',
      createdBy: row.created_by,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }

  private mapMatchRow(row: ReleaseCustomerMatchRow): ReleaseCustomerMatch {
    return {
      id: row.id,
      releaseId: row.release_id,
      customerId: row.customer_id,
      matchReason: row.match_reason as MatchReason,
      matchScore: row.match_score,
      matchDetails: row.match_details || {},
      featureRequestId: row.feature_request_id,
      csmUserId: row.csm_user_id,
      alertSentAt: row.alert_sent_at,
      announcedAt: row.announced_at,
      announcementMethod: row.announcement_method as AnnouncementMethod | null,
      adoptedAt: row.adopted_at,
      adoptionNotes: row.adoption_notes,
      outreachTaskId: row.outreach_task_id,
      outreachTaskCreatedAt: row.outreach_task_created_at,
      outreachTaskDueDate: row.outreach_task_due_date,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }

  // ============================================
  // Mock Data (Demo Mode)
  // ============================================

  private createMockRelease(data: CreateReleaseRequest): ProductRelease {
    return {
      id: `mock-${Date.now()}`,
      featureId: data.featureId,
      featureName: data.featureName,
      description: data.description || null,
      releaseDate: data.releaseDate || new Date().toISOString().split('T')[0],
      tierAvailability: data.tierAvailability || ['starter', 'professional', 'enterprise'],
      keywords: data.keywords || [],
      documentationUrl: data.documentationUrl || null,
      videoUrl: data.videoUrl || null,
      announcementContent: data.announcementContent || null,
      enablementResources: data.enablementResources || {},
      category: data.category || null,
      status: 'draft',
      createdBy: null,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
  }

  private getMockMatches(release: ProductRelease): Array<{
    customerId: string;
    matchReason: MatchReason;
    matchScore: number;
    matchDetails: MatchDetails;
  }> {
    return [
      {
        customerId: 'mock-customer-1',
        matchReason: 'feature_request',
        matchScore: 85,
        matchDetails: {
          matchedKeywords: release.keywords.slice(0, 2),
          relevanceExplanation: 'Customer directly requested this feature.',
        },
      },
      {
        customerId: 'mock-customer-2',
        matchReason: 'usage_pattern',
        matchScore: 72,
        matchDetails: {
          usageMetrics: { exports_count: 250 },
          relevanceExplanation: 'Heavy usage of related features.',
        },
      },
    ];
  }
}

// Singleton instance
export const featureReleaseService = new FeatureReleaseService();
