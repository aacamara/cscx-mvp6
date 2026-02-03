/**
 * Knowledge Sharing Service
 * PRD-254: Best Practice Sharing
 *
 * Handles CRUD operations, engagement tracking, and search for best practices.
 * Enables CSMs to share and discover successful strategies.
 */

import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { config } from '../../config/index.js';

// ============================================
// Types
// ============================================

export type BestPracticeStatus = 'draft' | 'pending_review' | 'published' | 'archived';
export type BestPracticeCategory = 'onboarding' | 'renewal' | 'expansion' | 'risk' | 'communication' | 'adoption' | 'general';
export type UsageOutcome = 'helpful' | 'somewhat_helpful' | 'not_helpful';

export interface Attachment {
  type: string;
  name: string;
  url: string;
  mimeType?: string;
  size?: number;
}

export interface BestPractice {
  id: string;
  createdByUserId: string;
  createdByUserName?: string;

  // Content
  title: string;
  problemStatement: string;
  solution: string;
  expectedOutcomes?: string;
  variations?: string;
  pitfalls?: string;

  // Classification
  category?: BestPracticeCategory;
  tags: string[];
  customerSegment?: string;
  applicableIndustries: string[];

  // Proof points
  linkedCustomerIds: string[];
  attachments: Attachment[];

  // Status
  status: BestPracticeStatus;
  publishedAt?: Date;
  reviewedByUserId?: string;
  reviewedAt?: Date;
  rejectionReason?: string;

  // Engagement
  viewCount: number;
  upvoteCount: number;
  downvoteCount: number;
  saveCount: number;
  useCount: number;
  commentCount: number;

  // Featured
  isFeatured: boolean;
  featuredAt?: Date;
  featuredReason?: string;

  // Versioning
  version: number;
  previousVersionId?: string;

  createdAt: Date;
  updatedAt: Date;

  // Computed fields (when fetching with user context)
  userVote?: number; // 1, -1, or null
  isSaved?: boolean;
}

export interface BestPracticeComment {
  id: string;
  bestPracticeId: string;
  userId: string;
  userName?: string;
  parentCommentId?: string;
  content: string;
  isQuestion: boolean;
  isResolved: boolean;
  resolvedByUserId?: string;
  resolvedAt?: Date;
  upvoteCount: number;
  createdAt: Date;
  updatedAt: Date;
  replies?: BestPracticeComment[];
}

export interface BestPracticeUsage {
  id: string;
  bestPracticeId: string;
  userId: string;
  customerId?: string;
  customerName?: string;
  outcome?: UsageOutcome;
  notes?: string;
  usedAt: Date;
}

export interface CreateBestPracticeInput {
  title: string;
  problemStatement: string;
  solution: string;
  expectedOutcomes?: string;
  variations?: string;
  pitfalls?: string;
  category?: BestPracticeCategory;
  tags?: string[];
  customerSegment?: string;
  applicableIndustries?: string[];
  linkedCustomerIds?: string[];
  attachments?: Attachment[];
}

export interface UpdateBestPracticeInput {
  title?: string;
  problemStatement?: string;
  solution?: string;
  expectedOutcomes?: string;
  variations?: string;
  pitfalls?: string;
  category?: BestPracticeCategory;
  tags?: string[];
  customerSegment?: string;
  applicableIndustries?: string[];
  linkedCustomerIds?: string[];
  attachments?: Attachment[];
}

export interface SearchFilters {
  query?: string;
  category?: BestPracticeCategory;
  status?: BestPracticeStatus;
  tags?: string[];
  authorId?: string;
  isFeatured?: boolean;
  sortBy?: 'relevance' | 'recent' | 'popular' | 'most_used';
  limit?: number;
  offset?: number;
}

export interface SearchResult {
  bestPractices: BestPractice[];
  total: number;
  hasMore: boolean;
}

export interface BestPracticeRecommendation {
  bestPractice: BestPractice;
  relevanceScore: number;
  matchReasons: string[];
}

// ============================================
// Service Class
// ============================================

export class KnowledgeSharingService {
  private supabase: SupabaseClient | null = null;
  private isConfigured: boolean = false;

  // In-memory fallback for development
  private inMemoryPractices: Map<string, BestPractice> = new Map();
  private inMemoryComments: Map<string, BestPracticeComment> = new Map();
  private inMemoryVotes: Map<string, { vote: number }> = new Map();
  private inMemorySaves: Map<string, boolean> = new Map();

  constructor() {
    if (config.supabaseUrl && config.supabaseServiceKey) {
      this.supabase = createClient(config.supabaseUrl, config.supabaseServiceKey);
      this.isConfigured = true;
      console.log('[KnowledgeSharing] Initialized with Supabase');
    } else {
      console.warn('[KnowledgeSharing] Running in memory mode (no persistence)');
    }
  }

  // ============================================
  // CRUD Operations
  // ============================================

  /**
   * Create a new best practice
   */
  async create(userId: string, input: CreateBestPracticeInput): Promise<BestPractice> {
    const id = crypto.randomUUID();
    const now = new Date();

    const practice: BestPractice = {
      id,
      createdByUserId: userId,
      title: input.title,
      problemStatement: input.problemStatement,
      solution: input.solution,
      expectedOutcomes: input.expectedOutcomes,
      variations: input.variations,
      pitfalls: input.pitfalls,
      category: input.category,
      tags: input.tags || [],
      customerSegment: input.customerSegment,
      applicableIndustries: input.applicableIndustries || [],
      linkedCustomerIds: input.linkedCustomerIds || [],
      attachments: input.attachments || [],
      status: 'draft',
      viewCount: 0,
      upvoteCount: 0,
      downvoteCount: 0,
      saveCount: 0,
      useCount: 0,
      commentCount: 0,
      isFeatured: false,
      version: 1,
      createdAt: now,
      updatedAt: now,
    };

    if (this.supabase) {
      const { error } = await this.supabase
        .from('best_practices')
        .insert(this.toDbRow(practice));

      if (error) {
        console.error('[KnowledgeSharing] Create error:', error);
        throw new Error(`Failed to create best practice: ${error.message}`);
      }
    } else {
      this.inMemoryPractices.set(id, practice);
    }

    console.log(`[KnowledgeSharing] Created best practice: ${id}`);
    return practice;
  }

  /**
   * Get a best practice by ID
   */
  async getById(id: string, userId?: string): Promise<BestPractice | null> {
    if (this.supabase) {
      const { data, error } = await this.supabase
        .from('best_practices')
        .select('*')
        .eq('id', id)
        .single();

      if (error || !data) {
        return null;
      }

      const practice = this.fromDbRow(data);

      // Get user-specific data if userId provided
      if (userId) {
        practice.userVote = await this.getUserVote(id, userId);
        practice.isSaved = await this.isSavedByUser(id, userId);
      }

      return practice;
    } else {
      const practice = this.inMemoryPractices.get(id);
      if (!practice) return null;

      if (userId) {
        practice.userVote = this.inMemoryVotes.get(`${userId}:${id}`)?.vote;
        practice.isSaved = this.inMemorySaves.get(`${userId}:${id}`) || false;
      }

      return practice;
    }
  }

  /**
   * Update a best practice
   */
  async update(id: string, userId: string, input: UpdateBestPracticeInput): Promise<BestPractice | null> {
    const existing = await this.getById(id);
    if (!existing) {
      throw new Error('Best practice not found');
    }

    if (existing.createdByUserId !== userId) {
      throw new Error('Not authorized to update this best practice');
    }

    const updates: Partial<BestPractice> = {
      ...input,
      updatedAt: new Date(),
    };

    if (this.supabase) {
      const { error } = await this.supabase
        .from('best_practices')
        .update(this.toDbUpdateRow(updates))
        .eq('id', id);

      if (error) {
        console.error('[KnowledgeSharing] Update error:', error);
        throw new Error(`Failed to update best practice: ${error.message}`);
      }
    } else {
      const practice = this.inMemoryPractices.get(id);
      if (practice) {
        Object.assign(practice, updates);
      }
    }

    return this.getById(id);
  }

  /**
   * Delete a best practice (only drafts)
   */
  async delete(id: string, userId: string): Promise<boolean> {
    const existing = await this.getById(id);
    if (!existing) {
      throw new Error('Best practice not found');
    }

    if (existing.createdByUserId !== userId) {
      throw new Error('Not authorized to delete this best practice');
    }

    if (existing.status !== 'draft') {
      throw new Error('Only draft best practices can be deleted');
    }

    if (this.supabase) {
      const { error } = await this.supabase
        .from('best_practices')
        .delete()
        .eq('id', id);

      if (error) {
        console.error('[KnowledgeSharing] Delete error:', error);
        return false;
      }
    } else {
      this.inMemoryPractices.delete(id);
    }

    console.log(`[KnowledgeSharing] Deleted best practice: ${id}`);
    return true;
  }

  // ============================================
  // Publishing Workflow
  // ============================================

  /**
   * Submit for review
   */
  async submitForReview(id: string, userId: string): Promise<BestPractice> {
    const practice = await this.getById(id);
    if (!practice) throw new Error('Best practice not found');
    if (practice.createdByUserId !== userId) throw new Error('Not authorized');
    if (practice.status !== 'draft') throw new Error('Can only submit drafts for review');

    await this.updateStatus(id, 'pending_review');
    return (await this.getById(id))!;
  }

  /**
   * Approve and publish
   */
  async approve(id: string, reviewerId: string): Promise<BestPractice> {
    const practice = await this.getById(id);
    if (!practice) throw new Error('Best practice not found');
    if (practice.status !== 'pending_review') throw new Error('Can only approve pending practices');

    const now = new Date();

    if (this.supabase) {
      const { error } = await this.supabase
        .from('best_practices')
        .update({
          status: 'published',
          published_at: now.toISOString(),
          reviewed_by_user_id: reviewerId,
          reviewed_at: now.toISOString(),
          rejection_reason: null,
          updated_at: now.toISOString(),
        })
        .eq('id', id);

      if (error) throw new Error(`Failed to approve: ${error.message}`);
    } else {
      const p = this.inMemoryPractices.get(id);
      if (p) {
        p.status = 'published';
        p.publishedAt = now;
        p.reviewedByUserId = reviewerId;
        p.reviewedAt = now;
        p.updatedAt = now;
      }
    }

    console.log(`[KnowledgeSharing] Approved best practice: ${id}`);
    return (await this.getById(id))!;
  }

  /**
   * Reject submission
   */
  async reject(id: string, reviewerId: string, reason: string): Promise<BestPractice> {
    const practice = await this.getById(id);
    if (!practice) throw new Error('Best practice not found');
    if (practice.status !== 'pending_review') throw new Error('Can only reject pending practices');

    const now = new Date();

    if (this.supabase) {
      const { error } = await this.supabase
        .from('best_practices')
        .update({
          status: 'draft',
          reviewed_by_user_id: reviewerId,
          reviewed_at: now.toISOString(),
          rejection_reason: reason,
          updated_at: now.toISOString(),
        })
        .eq('id', id);

      if (error) throw new Error(`Failed to reject: ${error.message}`);
    } else {
      const p = this.inMemoryPractices.get(id);
      if (p) {
        p.status = 'draft';
        p.reviewedByUserId = reviewerId;
        p.reviewedAt = now;
        p.rejectionReason = reason;
        p.updatedAt = now;
      }
    }

    console.log(`[KnowledgeSharing] Rejected best practice: ${id}`);
    return (await this.getById(id))!;
  }

  /**
   * Archive a published practice
   */
  async archive(id: string, userId: string): Promise<BestPractice> {
    const practice = await this.getById(id);
    if (!practice) throw new Error('Best practice not found');
    if (practice.status !== 'published') throw new Error('Can only archive published practices');

    await this.updateStatus(id, 'archived');
    console.log(`[KnowledgeSharing] Archived best practice: ${id}`);
    return (await this.getById(id))!;
  }

  /**
   * Feature a best practice
   */
  async setFeatured(id: string, featured: boolean, reason?: string): Promise<BestPractice> {
    const practice = await this.getById(id);
    if (!practice) throw new Error('Best practice not found');
    if (practice.status !== 'published') throw new Error('Can only feature published practices');

    const now = new Date();

    if (this.supabase) {
      const { error } = await this.supabase
        .from('best_practices')
        .update({
          is_featured: featured,
          featured_at: featured ? now.toISOString() : null,
          featured_reason: featured ? reason : null,
          updated_at: now.toISOString(),
        })
        .eq('id', id);

      if (error) throw new Error(`Failed to set featured: ${error.message}`);
    } else {
      const p = this.inMemoryPractices.get(id);
      if (p) {
        p.isFeatured = featured;
        p.featuredAt = featured ? now : undefined;
        p.featuredReason = featured ? reason : undefined;
        p.updatedAt = now;
      }
    }

    return (await this.getById(id))!;
  }

  // ============================================
  // Search & Discovery
  // ============================================

  /**
   * Search best practices
   */
  async search(filters: SearchFilters, userId?: string): Promise<SearchResult> {
    const {
      query,
      category,
      status = 'published',
      tags,
      authorId,
      isFeatured,
      sortBy = 'popular',
      limit = 20,
      offset = 0,
    } = filters;

    if (this.supabase) {
      // Use the search function for full-text search
      if (query) {
        const { data, error } = await this.supabase.rpc('search_best_practices', {
          search_query: query,
          category_filter: category || null,
          status_filter: status,
          tags_filter: tags || null,
          author_filter: authorId || null,
          limit_count: limit + 1, // Fetch one extra to check hasMore
          offset_count: offset,
        });

        if (error) {
          console.error('[KnowledgeSharing] Search error:', error);
          throw new Error(`Search failed: ${error.message}`);
        }

        const hasMore = (data || []).length > limit;
        const practices = await Promise.all(
          (data || []).slice(0, limit).map((row: any) =>
            this.enrichWithUserData(this.fromDbRow(row), userId)
          )
        );

        return {
          bestPractices: practices,
          total: practices.length,
          hasMore,
        };
      }

      // Regular query without full-text search
      let query_builder = this.supabase
        .from('best_practices')
        .select('*', { count: 'exact' });

      if (status) query_builder = query_builder.eq('status', status);
      if (category) query_builder = query_builder.eq('category', category);
      if (authorId) query_builder = query_builder.eq('created_by_user_id', authorId);
      if (isFeatured !== undefined) query_builder = query_builder.eq('is_featured', isFeatured);
      if (tags && tags.length > 0) query_builder = query_builder.overlaps('tags', tags);

      // Sorting
      switch (sortBy) {
        case 'recent':
          query_builder = query_builder.order('published_at', { ascending: false, nullsFirst: false });
          break;
        case 'popular':
          query_builder = query_builder.order('upvote_count', { ascending: false });
          break;
        case 'most_used':
          query_builder = query_builder.order('use_count', { ascending: false });
          break;
        default:
          query_builder = query_builder.order('is_featured', { ascending: false });
          query_builder = query_builder.order('upvote_count', { ascending: false });
      }

      const { data, count, error } = await query_builder
        .range(offset, offset + limit - 1);

      if (error) {
        console.error('[KnowledgeSharing] Query error:', error);
        throw new Error(`Query failed: ${error.message}`);
      }

      const practices = await Promise.all(
        (data || []).map((row: any) =>
          this.enrichWithUserData(this.fromDbRow(row), userId)
        )
      );

      return {
        bestPractices: practices,
        total: count || 0,
        hasMore: (offset + limit) < (count || 0),
      };
    } else {
      // In-memory search fallback
      let results = Array.from(this.inMemoryPractices.values())
        .filter((p) => {
          if (status && p.status !== status) return false;
          if (category && p.category !== category) return false;
          if (authorId && p.createdByUserId !== authorId) return false;
          if (isFeatured !== undefined && p.isFeatured !== isFeatured) return false;
          if (tags && tags.length > 0 && !tags.some((t) => p.tags.includes(t))) return false;
          if (query) {
            const searchText = `${p.title} ${p.problemStatement} ${p.solution}`.toLowerCase();
            if (!searchText.includes(query.toLowerCase())) return false;
          }
          return true;
        });

      // Sort
      results.sort((a, b) => {
        if (sortBy === 'recent') return (b.publishedAt?.getTime() || 0) - (a.publishedAt?.getTime() || 0);
        if (sortBy === 'most_used') return b.useCount - a.useCount;
        // Default: popular
        return (b.upvoteCount - b.downvoteCount) - (a.upvoteCount - a.downvoteCount);
      });

      const total = results.length;
      results = results.slice(offset, offset + limit);

      return {
        bestPractices: results,
        total,
        hasMore: (offset + limit) < total,
      };
    }
  }

  /**
   * Get featured best practices
   */
  async getFeatured(limit: number = 5): Promise<BestPractice[]> {
    const result = await this.search({
      status: 'published',
      isFeatured: true,
      sortBy: 'recent',
      limit,
    });
    return result.bestPractices;
  }

  /**
   * Get popular best practices
   */
  async getPopular(limit: number = 10): Promise<BestPractice[]> {
    const result = await this.search({
      status: 'published',
      sortBy: 'popular',
      limit,
    });
    return result.bestPractices;
  }

  /**
   * Get user's own best practices
   */
  async getMyPractices(userId: string, status?: BestPracticeStatus): Promise<BestPractice[]> {
    const result = await this.search({
      authorId: userId,
      status,
      sortBy: 'recent',
      limit: 100,
    }, userId);
    return result.bestPractices;
  }

  /**
   * Get user's saved best practices
   */
  async getSaved(userId: string): Promise<BestPractice[]> {
    if (this.supabase) {
      const { data, error } = await this.supabase
        .from('best_practice_saves')
        .select('best_practice_id')
        .eq('user_id', userId)
        .order('saved_at', { ascending: false });

      if (error) {
        console.error('[KnowledgeSharing] Get saved error:', error);
        return [];
      }

      const practiceIds = (data || []).map((s: any) => s.best_practice_id);
      const practices = await Promise.all(
        practiceIds.map((id: string) => this.getById(id, userId))
      );

      return practices.filter((p): p is BestPractice => p !== null);
    } else {
      const saved: BestPractice[] = [];
      for (const [key, value] of this.inMemorySaves) {
        if (key.startsWith(`${userId}:`) && value) {
          const practiceId = key.split(':')[1];
          const practice = this.inMemoryPractices.get(practiceId);
          if (practice) saved.push(practice);
        }
      }
      return saved;
    }
  }

  /**
   * Get pending review practices (for admins/managers)
   */
  async getPendingReview(): Promise<BestPractice[]> {
    const result = await this.search({
      status: 'pending_review',
      sortBy: 'recent',
      limit: 50,
    });
    return result.bestPractices;
  }

  /**
   * Get recommendations based on context
   */
  async getRecommendations(context: {
    customerId?: string;
    situation?: string;
    industry?: string;
    keywords?: string[];
  }): Promise<BestPracticeRecommendation[]> {
    const { situation, industry, keywords } = context;

    // Build search based on context
    const filters: SearchFilters = {
      status: 'published',
      sortBy: 'popular',
      limit: 20,
    };

    if (situation) {
      filters.category = situation as BestPracticeCategory;
    }

    if (keywords && keywords.length > 0) {
      filters.query = keywords.join(' ');
    }

    const result = await this.search(filters);

    // Calculate relevance scores and reasons
    return result.bestPractices.map((bp) => {
      let score = 0;
      const reasons: string[] = [];

      if (bp.isFeatured) {
        score += 0.2;
        reasons.push('Featured best practice');
      }

      if (situation && bp.category === situation) {
        score += 0.3;
        reasons.push(`Matches ${situation} category`);
      }

      if (industry && bp.applicableIndustries.includes(industry)) {
        score += 0.2;
        reasons.push(`Applicable to ${industry} industry`);
      }

      // Score based on engagement
      const netVotes = bp.upvoteCount - bp.downvoteCount;
      if (netVotes > 10) {
        score += 0.2;
        reasons.push('Highly rated by team');
      } else if (netVotes > 5) {
        score += 0.1;
        reasons.push('Well rated');
      }

      if (bp.useCount > 5) {
        score += 0.1;
        reasons.push('Frequently used');
      }

      return {
        bestPractice: bp,
        relevanceScore: Math.min(score, 1),
        matchReasons: reasons,
      };
    }).sort((a, b) => b.relevanceScore - a.relevanceScore);
  }

  // ============================================
  // Engagement Features
  // ============================================

  /**
   * Record a view
   */
  async recordView(practiceId: string, userId: string): Promise<void> {
    if (this.supabase) {
      // Upsert view record
      const { error } = await this.supabase
        .from('best_practice_views')
        .upsert({
          user_id: userId,
          best_practice_id: practiceId,
          last_viewed_at: new Date().toISOString(),
          view_count: 1, // Will be incremented by DB trigger
        }, {
          onConflict: 'user_id,best_practice_id',
        });

      if (error) {
        console.error('[KnowledgeSharing] Record view error:', error);
      }

      // Update view count on practice
      await this.supabase.rpc('increment', {
        table_name: 'best_practices',
        column_name: 'view_count',
        row_id: practiceId,
      }).catch(() => {
        // Increment function may not exist, update directly
        this.supabase!.from('best_practices')
          .update({ view_count: this.supabase!.rpc('greatest', { a: 0, b: 1 }) })
          .eq('id', practiceId);
      });
    }
  }

  /**
   * Vote on a best practice
   */
  async vote(practiceId: string, userId: string, vote: 1 | -1 | 0): Promise<{ upvoteCount: number; downvoteCount: number }> {
    const practice = await this.getById(practiceId);
    if (!practice) throw new Error('Best practice not found');

    if (this.supabase) {
      if (vote === 0) {
        // Remove vote
        await this.supabase
          .from('best_practice_votes')
          .delete()
          .eq('user_id', userId)
          .eq('best_practice_id', practiceId);
      } else {
        // Upsert vote
        await this.supabase
          .from('best_practice_votes')
          .upsert({
            user_id: userId,
            best_practice_id: practiceId,
            vote,
            updated_at: new Date().toISOString(),
          }, {
            onConflict: 'user_id,best_practice_id',
          });
      }

      // Get updated counts
      const updated = await this.getById(practiceId);
      return {
        upvoteCount: updated?.upvoteCount || 0,
        downvoteCount: updated?.downvoteCount || 0,
      };
    } else {
      const key = `${userId}:${practiceId}`;
      const existing = this.inMemoryVotes.get(key);

      if (vote === 0) {
        if (existing) {
          if (existing.vote === 1) practice.upvoteCount--;
          else practice.downvoteCount--;
          this.inMemoryVotes.delete(key);
        }
      } else {
        if (existing) {
          if (existing.vote === 1) practice.upvoteCount--;
          else practice.downvoteCount--;
        }
        if (vote === 1) practice.upvoteCount++;
        else practice.downvoteCount++;
        this.inMemoryVotes.set(key, { vote });
      }

      return {
        upvoteCount: practice.upvoteCount,
        downvoteCount: practice.downvoteCount,
      };
    }
  }

  /**
   * Save to personal collection
   */
  async save(practiceId: string, userId: string, collection?: string): Promise<boolean> {
    const practice = await this.getById(practiceId);
    if (!practice) throw new Error('Best practice not found');

    if (this.supabase) {
      const { error } = await this.supabase
        .from('best_practice_saves')
        .insert({
          user_id: userId,
          best_practice_id: practiceId,
          collection: collection || 'default',
          saved_at: new Date().toISOString(),
        });

      if (error && error.code !== '23505') { // Ignore duplicate key
        console.error('[KnowledgeSharing] Save error:', error);
        return false;
      }
    } else {
      this.inMemorySaves.set(`${userId}:${practiceId}`, true);
      practice.saveCount++;
    }

    return true;
  }

  /**
   * Remove from saved
   */
  async unsave(practiceId: string, userId: string): Promise<boolean> {
    if (this.supabase) {
      const { error } = await this.supabase
        .from('best_practice_saves')
        .delete()
        .eq('user_id', userId)
        .eq('best_practice_id', practiceId);

      if (error) {
        console.error('[KnowledgeSharing] Unsave error:', error);
        return false;
      }
    } else {
      this.inMemorySaves.delete(`${userId}:${practiceId}`);
      const practice = this.inMemoryPractices.get(practiceId);
      if (practice) practice.saveCount = Math.max(0, practice.saveCount - 1);
    }

    return true;
  }

  /**
   * Record usage of a best practice
   */
  async recordUsage(
    practiceId: string,
    userId: string,
    customerId?: string,
    outcome?: UsageOutcome,
    notes?: string
  ): Promise<BestPracticeUsage> {
    const practice = await this.getById(practiceId);
    if (!practice) throw new Error('Best practice not found');

    const usage: BestPracticeUsage = {
      id: crypto.randomUUID(),
      bestPracticeId: practiceId,
      userId,
      customerId,
      outcome,
      notes,
      usedAt: new Date(),
    };

    if (this.supabase) {
      const { error } = await this.supabase
        .from('best_practice_usage')
        .insert({
          id: usage.id,
          best_practice_id: usage.bestPracticeId,
          user_id: usage.userId,
          customer_id: usage.customerId,
          outcome: usage.outcome,
          notes: usage.notes,
          used_at: usage.usedAt.toISOString(),
        });

      if (error) {
        console.error('[KnowledgeSharing] Record usage error:', error);
        throw new Error(`Failed to record usage: ${error.message}`);
      }
    } else {
      practice.useCount++;
    }

    return usage;
  }

  // ============================================
  // Comments
  // ============================================

  /**
   * Get comments for a best practice
   */
  async getComments(practiceId: string): Promise<BestPracticeComment[]> {
    if (this.supabase) {
      const { data, error } = await this.supabase
        .from('best_practice_comments')
        .select('*')
        .eq('best_practice_id', practiceId)
        .order('created_at', { ascending: true });

      if (error) {
        console.error('[KnowledgeSharing] Get comments error:', error);
        return [];
      }

      const comments = (data || []).map(this.commentFromDbRow);

      // Build threaded structure
      const topLevel: BestPracticeComment[] = [];
      const byId = new Map<string, BestPracticeComment>();

      comments.forEach((c) => {
        c.replies = [];
        byId.set(c.id, c);
      });

      comments.forEach((c) => {
        if (c.parentCommentId) {
          const parent = byId.get(c.parentCommentId);
          if (parent) {
            parent.replies!.push(c);
          }
        } else {
          topLevel.push(c);
        }
      });

      return topLevel;
    } else {
      return Array.from(this.inMemoryComments.values())
        .filter((c) => c.bestPracticeId === practiceId && !c.parentCommentId);
    }
  }

  /**
   * Add a comment
   */
  async addComment(
    practiceId: string,
    userId: string,
    content: string,
    options?: { parentCommentId?: string; isQuestion?: boolean; userName?: string }
  ): Promise<BestPracticeComment> {
    const practice = await this.getById(practiceId);
    if (!practice) throw new Error('Best practice not found');

    const comment: BestPracticeComment = {
      id: crypto.randomUUID(),
      bestPracticeId: practiceId,
      userId,
      userName: options?.userName,
      parentCommentId: options?.parentCommentId,
      content,
      isQuestion: options?.isQuestion || false,
      isResolved: false,
      upvoteCount: 0,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    if (this.supabase) {
      const { error } = await this.supabase
        .from('best_practice_comments')
        .insert({
          id: comment.id,
          best_practice_id: comment.bestPracticeId,
          user_id: comment.userId,
          user_name: comment.userName,
          parent_comment_id: comment.parentCommentId,
          content: comment.content,
          is_question: comment.isQuestion,
          is_resolved: comment.isResolved,
          upvote_count: comment.upvoteCount,
          created_at: comment.createdAt.toISOString(),
          updated_at: comment.updatedAt.toISOString(),
        });

      if (error) {
        console.error('[KnowledgeSharing] Add comment error:', error);
        throw new Error(`Failed to add comment: ${error.message}`);
      }
    } else {
      this.inMemoryComments.set(comment.id, comment);
      practice.commentCount++;
    }

    return comment;
  }

  /**
   * Update a comment
   */
  async updateComment(commentId: string, userId: string, content: string): Promise<BestPracticeComment | null> {
    if (this.supabase) {
      const { data, error } = await this.supabase
        .from('best_practice_comments')
        .update({
          content,
          updated_at: new Date().toISOString(),
        })
        .eq('id', commentId)
        .eq('user_id', userId)
        .select()
        .single();

      if (error) {
        console.error('[KnowledgeSharing] Update comment error:', error);
        return null;
      }

      return this.commentFromDbRow(data);
    } else {
      const comment = this.inMemoryComments.get(commentId);
      if (comment && comment.userId === userId) {
        comment.content = content;
        comment.updatedAt = new Date();
        return comment;
      }
      return null;
    }
  }

  /**
   * Resolve a question
   */
  async resolveQuestion(commentId: string, resolverId: string): Promise<boolean> {
    if (this.supabase) {
      const { error } = await this.supabase
        .from('best_practice_comments')
        .update({
          is_resolved: true,
          resolved_by_user_id: resolverId,
          resolved_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq('id', commentId)
        .eq('is_question', true);

      return !error;
    } else {
      const comment = this.inMemoryComments.get(commentId);
      if (comment && comment.isQuestion) {
        comment.isResolved = true;
        comment.resolvedByUserId = resolverId;
        comment.resolvedAt = new Date();
        return true;
      }
      return false;
    }
  }

  // ============================================
  // Statistics
  // ============================================

  /**
   * Get contributor statistics
   */
  async getContributorStats(userId: string): Promise<{
    totalCreated: number;
    totalPublished: number;
    totalUpvotes: number;
    totalUses: number;
  }> {
    if (this.supabase) {
      const { data, error } = await this.supabase
        .from('best_practices')
        .select('status, upvote_count, use_count')
        .eq('created_by_user_id', userId);

      if (error) {
        return { totalCreated: 0, totalPublished: 0, totalUpvotes: 0, totalUses: 0 };
      }

      return {
        totalCreated: data.length,
        totalPublished: data.filter((p: any) => p.status === 'published').length,
        totalUpvotes: data.reduce((sum: number, p: any) => sum + (p.upvote_count || 0), 0),
        totalUses: data.reduce((sum: number, p: any) => sum + (p.use_count || 0), 0),
      };
    } else {
      const practices = Array.from(this.inMemoryPractices.values())
        .filter((p) => p.createdByUserId === userId);

      return {
        totalCreated: practices.length,
        totalPublished: practices.filter((p) => p.status === 'published').length,
        totalUpvotes: practices.reduce((sum, p) => sum + p.upvoteCount, 0),
        totalUses: practices.reduce((sum, p) => sum + p.useCount, 0),
      };
    }
  }

  /**
   * Get categories with counts
   */
  async getCategoryCounts(): Promise<Record<string, number>> {
    if (this.supabase) {
      const { data, error } = await this.supabase
        .from('best_practices')
        .select('category')
        .eq('status', 'published');

      if (error) return {};

      const counts: Record<string, number> = {};
      (data || []).forEach((row: any) => {
        const cat = row.category || 'general';
        counts[cat] = (counts[cat] || 0) + 1;
      });

      return counts;
    } else {
      const counts: Record<string, number> = {};
      this.inMemoryPractices.forEach((p) => {
        if (p.status === 'published') {
          const cat = p.category || 'general';
          counts[cat] = (counts[cat] || 0) + 1;
        }
      });
      return counts;
    }
  }

  // ============================================
  // Helper Methods
  // ============================================

  private async updateStatus(id: string, status: BestPracticeStatus): Promise<void> {
    if (this.supabase) {
      await this.supabase
        .from('best_practices')
        .update({ status, updated_at: new Date().toISOString() })
        .eq('id', id);
    } else {
      const practice = this.inMemoryPractices.get(id);
      if (practice) {
        practice.status = status;
        practice.updatedAt = new Date();
      }
    }
  }

  private async getUserVote(practiceId: string, userId: string): Promise<number | undefined> {
    if (this.supabase) {
      const { data } = await this.supabase
        .from('best_practice_votes')
        .select('vote')
        .eq('best_practice_id', practiceId)
        .eq('user_id', userId)
        .single();

      return data?.vote;
    }
    return this.inMemoryVotes.get(`${userId}:${practiceId}`)?.vote;
  }

  private async isSavedByUser(practiceId: string, userId: string): Promise<boolean> {
    if (this.supabase) {
      const { data } = await this.supabase
        .from('best_practice_saves')
        .select('user_id')
        .eq('best_practice_id', practiceId)
        .eq('user_id', userId)
        .single();

      return !!data;
    }
    return this.inMemorySaves.get(`${userId}:${practiceId}`) || false;
  }

  private async enrichWithUserData(practice: BestPractice, userId?: string): Promise<BestPractice> {
    if (!userId) return practice;

    practice.userVote = await this.getUserVote(practice.id, userId);
    practice.isSaved = await this.isSavedByUser(practice.id, userId);

    return practice;
  }

  private toDbRow(practice: BestPractice): Record<string, any> {
    return {
      id: practice.id,
      created_by_user_id: practice.createdByUserId,
      title: practice.title,
      problem_statement: practice.problemStatement,
      solution: practice.solution,
      expected_outcomes: practice.expectedOutcomes,
      variations: practice.variations,
      pitfalls: practice.pitfalls,
      category: practice.category,
      tags: practice.tags,
      customer_segment: practice.customerSegment,
      applicable_industries: practice.applicableIndustries,
      linked_customer_ids: practice.linkedCustomerIds,
      attachments: practice.attachments,
      status: practice.status,
      published_at: practice.publishedAt?.toISOString(),
      reviewed_by_user_id: practice.reviewedByUserId,
      reviewed_at: practice.reviewedAt?.toISOString(),
      rejection_reason: practice.rejectionReason,
      view_count: practice.viewCount,
      upvote_count: practice.upvoteCount,
      downvote_count: practice.downvoteCount,
      save_count: practice.saveCount,
      use_count: practice.useCount,
      comment_count: practice.commentCount,
      is_featured: practice.isFeatured,
      featured_at: practice.featuredAt?.toISOString(),
      featured_reason: practice.featuredReason,
      version: practice.version,
      previous_version_id: practice.previousVersionId,
      created_at: practice.createdAt.toISOString(),
      updated_at: practice.updatedAt.toISOString(),
    };
  }

  private toDbUpdateRow(updates: Partial<BestPractice>): Record<string, any> {
    const row: Record<string, any> = {};

    if (updates.title !== undefined) row.title = updates.title;
    if (updates.problemStatement !== undefined) row.problem_statement = updates.problemStatement;
    if (updates.solution !== undefined) row.solution = updates.solution;
    if (updates.expectedOutcomes !== undefined) row.expected_outcomes = updates.expectedOutcomes;
    if (updates.variations !== undefined) row.variations = updates.variations;
    if (updates.pitfalls !== undefined) row.pitfalls = updates.pitfalls;
    if (updates.category !== undefined) row.category = updates.category;
    if (updates.tags !== undefined) row.tags = updates.tags;
    if (updates.customerSegment !== undefined) row.customer_segment = updates.customerSegment;
    if (updates.applicableIndustries !== undefined) row.applicable_industries = updates.applicableIndustries;
    if (updates.linkedCustomerIds !== undefined) row.linked_customer_ids = updates.linkedCustomerIds;
    if (updates.attachments !== undefined) row.attachments = updates.attachments;
    if (updates.updatedAt) row.updated_at = updates.updatedAt.toISOString();

    return row;
  }

  private fromDbRow(row: Record<string, any>): BestPractice {
    return {
      id: row.id,
      createdByUserId: row.created_by_user_id,
      title: row.title,
      problemStatement: row.problem_statement,
      solution: row.solution,
      expectedOutcomes: row.expected_outcomes,
      variations: row.variations,
      pitfalls: row.pitfalls,
      category: row.category,
      tags: row.tags || [],
      customerSegment: row.customer_segment,
      applicableIndustries: row.applicable_industries || [],
      linkedCustomerIds: row.linked_customer_ids || [],
      attachments: row.attachments || [],
      status: row.status,
      publishedAt: row.published_at ? new Date(row.published_at) : undefined,
      reviewedByUserId: row.reviewed_by_user_id,
      reviewedAt: row.reviewed_at ? new Date(row.reviewed_at) : undefined,
      rejectionReason: row.rejection_reason,
      viewCount: row.view_count || 0,
      upvoteCount: row.upvote_count || 0,
      downvoteCount: row.downvote_count || 0,
      saveCount: row.save_count || 0,
      useCount: row.use_count || 0,
      commentCount: row.comment_count || 0,
      isFeatured: row.is_featured || false,
      featuredAt: row.featured_at ? new Date(row.featured_at) : undefined,
      featuredReason: row.featured_reason,
      version: row.version || 1,
      previousVersionId: row.previous_version_id,
      createdAt: new Date(row.created_at),
      updatedAt: new Date(row.updated_at),
    };
  }

  private commentFromDbRow(row: Record<string, any>): BestPracticeComment {
    return {
      id: row.id,
      bestPracticeId: row.best_practice_id,
      userId: row.user_id,
      userName: row.user_name,
      parentCommentId: row.parent_comment_id,
      content: row.content,
      isQuestion: row.is_question || false,
      isResolved: row.is_resolved || false,
      resolvedByUserId: row.resolved_by_user_id,
      resolvedAt: row.resolved_at ? new Date(row.resolved_at) : undefined,
      upvoteCount: row.upvote_count || 0,
      createdAt: new Date(row.created_at),
      updatedAt: new Date(row.updated_at),
    };
  }

  /**
   * Check if service is properly configured
   */
  isReady(): boolean {
    return this.isConfigured;
  }
}

// Singleton instance
export const knowledgeSharingService = new KnowledgeSharingService();
