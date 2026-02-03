/**
 * Executive Sponsor Service
 * PRD-246: Executive Sponsor Assignment
 *
 * Manages executive sponsor assignments, engagements, matching, and impact metrics
 */

import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { config } from '../config/index.js';

// ============================================
// TYPE DEFINITIONS
// ============================================

export type AssignmentStatus = 'proposed' | 'active' | 'ended';
export type EngagementCadence = 'monthly' | 'quarterly' | 'biannual';
export type EngagementType = 'meeting' | 'email' | 'ebr' | 'call' | 'event';
export type EngagementSource = 'manual' | 'calendar' | 'email';

export interface ExecutiveSponsor {
  id: string;
  user_id: string;
  title: string;
  bio?: string;
  industries: string[];
  specialties: string[];
  max_accounts: number;
  current_accounts: number;
  active: boolean;
  created_at: Date;
  user?: {
    id: string;
    email: string;
    name: string;
    avatar_url?: string;
  };
}

export interface ExecutiveAssignment {
  id: string;
  customer_id: string;
  executive_sponsor_id: string;
  assigned_by_user_id?: string;
  status: AssignmentStatus;
  engagement_cadence: EngagementCadence;
  assignment_reason?: string;
  started_at: Date;
  ended_at?: Date;
  end_reason?: string;
  created_at: Date;
  customer?: Record<string, unknown>;
  executive_sponsor?: ExecutiveSponsor;
}

export interface ExecutiveEngagement {
  id: string;
  assignment_id?: string;
  customer_id: string;
  executive_sponsor_id: string;
  engagement_type: EngagementType;
  title: string;
  description?: string;
  customer_attendees: string[];
  outcome?: string;
  next_steps?: string;
  engagement_date: Date;
  logged_by_user_id?: string;
  source: EngagementSource;
  external_id?: string;
  created_at: Date;
}

export interface ExecutiveMatch {
  executive_sponsor_id: string;
  executive_sponsor: ExecutiveSponsor;
  match_score: number;
  factors: {
    industry_match: boolean;
    capacity_available: boolean;
    relationship_history: boolean;
    specialty_match: boolean;
  };
}

export interface SponsorCriteria {
  id: string;
  name: string;
  conditions: Record<string, unknown>;
  auto_qualify: boolean;
  priority: number;
  active: boolean;
}

const ENGAGEMENT_CADENCE_DAYS: Record<EngagementCadence, number> = {
  monthly: 30,
  quarterly: 90,
  biannual: 180
};

// ============================================
// SERVICE CLASS
// ============================================

export class ExecutiveSponsorService {
  private supabase: SupabaseClient | null = null;

  constructor() {
    if (config.supabaseUrl && config.supabaseServiceKey) {
      this.supabase = createClient(config.supabaseUrl, config.supabaseServiceKey);
    }
  }

  // ============================================
  // EXECUTIVE SPONSOR CRUD
  // ============================================

  /**
   * Get all executive sponsors with optional filters
   */
  async getExecutiveSponsors(options: {
    active?: boolean;
    has_capacity?: boolean;
    industry?: string;
    specialty?: string;
    search?: string;
    page?: number;
    pageSize?: number;
  } = {}): Promise<{ sponsors: ExecutiveSponsor[]; total: number }> {
    if (!this.supabase) {
      return { sponsors: this.getMockSponsors(), total: 3 };
    }

    const page = options.page || 1;
    const pageSize = options.pageSize || 20;
    const offset = (page - 1) * pageSize;

    let query = this.supabase
      .from('executive_sponsors')
      .select('*, users(id, email, name, avatar_url)', { count: 'exact' });

    if (options.active !== undefined) {
      query = query.eq('active', options.active);
    }

    if (options.industry) {
      query = query.contains('industries', [options.industry]);
    }

    if (options.specialty) {
      query = query.contains('specialties', [options.specialty]);
    }

    if (options.search) {
      query = query.or(`title.ilike.%${options.search}%,bio.ilike.%${options.search}%`);
    }

    const { data, count, error } = await query
      .order('created_at', { ascending: false })
      .range(offset, offset + pageSize - 1);

    if (error) {
      console.error('Error fetching executive sponsors:', error);
      throw new Error(`Failed to fetch executive sponsors: ${error.message}`);
    }

    const sponsors = await Promise.all((data || []).map(async (s) => {
      const currentAccounts = await this.getAssignmentCount(s.id);
      return this.mapToExecutiveSponsor(s, currentAccounts);
    }));

    // Filter by capacity if requested
    const filteredSponsors = options.has_capacity
      ? sponsors.filter(s => s.current_accounts < s.max_accounts)
      : sponsors;

    return {
      sponsors: filteredSponsors,
      total: count || 0
    };
  }

  /**
   * Get executive sponsor by ID
   */
  async getExecutiveSponsor(id: string): Promise<ExecutiveSponsor | null> {
    if (!this.supabase) {
      const mock = this.getMockSponsors().find(s => s.id === id);
      return mock || null;
    }

    const { data, error } = await this.supabase
      .from('executive_sponsors')
      .select('*, users(id, email, name, avatar_url)')
      .eq('id', id)
      .single();

    if (error || !data) {
      return null;
    }

    const currentAccounts = await this.getAssignmentCount(id);
    return this.mapToExecutiveSponsor(data, currentAccounts);
  }

  /**
   * Create executive sponsor
   */
  async createExecutiveSponsor(request: {
    user_id: string;
    title: string;
    bio?: string;
    industries?: string[];
    specialties?: string[];
    max_accounts?: number;
  }): Promise<ExecutiveSponsor> {
    if (!this.supabase) {
      return {
        id: `exec_${Date.now()}`,
        user_id: request.user_id,
        title: request.title,
        bio: request.bio,
        industries: request.industries || [],
        specialties: request.specialties || [],
        max_accounts: request.max_accounts || 10,
        current_accounts: 0,
        active: true,
        created_at: new Date()
      };
    }

    const { data, error } = await this.supabase
      .from('executive_sponsors')
      .insert({
        user_id: request.user_id,
        title: request.title,
        bio: request.bio,
        industries: request.industries || [],
        specialties: request.specialties || [],
        max_accounts: request.max_accounts || 10,
        active: true
      })
      .select('*, users(id, email, name, avatar_url)')
      .single();

    if (error) {
      throw new Error(`Failed to create executive sponsor: ${error.message}`);
    }

    return this.mapToExecutiveSponsor(data, 0);
  }

  /**
   * Update executive sponsor
   */
  async updateExecutiveSponsor(
    id: string,
    updates: {
      title?: string;
      bio?: string;
      industries?: string[];
      specialties?: string[];
      max_accounts?: number;
      active?: boolean;
    }
  ): Promise<ExecutiveSponsor> {
    if (!this.supabase) {
      throw new Error('Supabase not configured');
    }

    const { data, error } = await this.supabase
      .from('executive_sponsors')
      .update(updates)
      .eq('id', id)
      .select('*, users(id, email, name, avatar_url)')
      .single();

    if (error) {
      throw new Error(`Failed to update executive sponsor: ${error.message}`);
    }

    const currentAccounts = await this.getAssignmentCount(id);
    return this.mapToExecutiveSponsor(data, currentAccounts);
  }

  // ============================================
  // ASSIGNMENT MANAGEMENT
  // ============================================

  /**
   * Get assignments with filters
   */
  async getAssignments(options: {
    customer_id?: string;
    executive_sponsor_id?: string;
    status?: AssignmentStatus;
    page?: number;
    pageSize?: number;
  } = {}): Promise<{ assignments: ExecutiveAssignment[]; total: number }> {
    if (!this.supabase) {
      return { assignments: [], total: 0 };
    }

    const page = options.page || 1;
    const pageSize = options.pageSize || 20;
    const offset = (page - 1) * pageSize;

    let query = this.supabase
      .from('executive_assignments')
      .select(`
        *,
        customers(id, name, arr, health_score, industry, segment, renewal_date),
        executive_sponsors(*, users(id, email, name, avatar_url))
      `, { count: 'exact' });

    if (options.customer_id) {
      query = query.eq('customer_id', options.customer_id);
    }

    if (options.executive_sponsor_id) {
      query = query.eq('executive_sponsor_id', options.executive_sponsor_id);
    }

    if (options.status) {
      query = query.eq('status', options.status);
    }

    const { data, count, error } = await query
      .order('created_at', { ascending: false })
      .range(offset, offset + pageSize - 1);

    if (error) {
      console.error('Error fetching assignments:', error);
      throw new Error(`Failed to fetch assignments: ${error.message}`);
    }

    return {
      assignments: (data || []).map(a => this.mapToAssignment(a)),
      total: count || 0
    };
  }

  /**
   * Get assignment by ID
   */
  async getAssignment(id: string): Promise<ExecutiveAssignment | null> {
    if (!this.supabase) {
      return null;
    }

    const { data, error } = await this.supabase
      .from('executive_assignments')
      .select(`
        *,
        customers(id, name, arr, health_score, industry, segment, renewal_date),
        executive_sponsors(*, users(id, email, name, avatar_url))
      `)
      .eq('id', id)
      .single();

    if (error || !data) {
      return null;
    }

    return this.mapToAssignment(data);
  }

  /**
   * Create assignment (request sponsor for account)
   */
  async createAssignment(
    request: {
      customer_id: string;
      executive_sponsor_id: string;
      engagement_cadence?: EngagementCadence;
      assignment_reason?: string;
    },
    assigned_by_user_id?: string
  ): Promise<ExecutiveAssignment> {
    if (!this.supabase) {
      return {
        id: `assign_${Date.now()}`,
        customer_id: request.customer_id,
        executive_sponsor_id: request.executive_sponsor_id,
        assigned_by_user_id,
        status: 'proposed',
        engagement_cadence: request.engagement_cadence || 'quarterly',
        assignment_reason: request.assignment_reason,
        started_at: new Date(),
        created_at: new Date()
      };
    }

    // Check if sponsor has capacity
    const sponsor = await this.getExecutiveSponsor(request.executive_sponsor_id);
    if (sponsor && sponsor.current_accounts >= sponsor.max_accounts) {
      throw new Error('Executive sponsor has reached maximum account capacity');
    }

    // Check for existing active assignment
    const { data: existing } = await this.supabase
      .from('executive_assignments')
      .select('id')
      .eq('customer_id', request.customer_id)
      .eq('executive_sponsor_id', request.executive_sponsor_id)
      .eq('status', 'active')
      .single();

    if (existing) {
      throw new Error('An active assignment already exists for this customer and sponsor');
    }

    const { data, error } = await this.supabase
      .from('executive_assignments')
      .insert({
        customer_id: request.customer_id,
        executive_sponsor_id: request.executive_sponsor_id,
        assigned_by_user_id,
        status: 'proposed',
        engagement_cadence: request.engagement_cadence || 'quarterly',
        assignment_reason: request.assignment_reason,
        started_at: new Date().toISOString()
      })
      .select(`
        *,
        customers(id, name, arr, health_score, industry, segment, renewal_date),
        executive_sponsors(*, users(id, email, name, avatar_url))
      `)
      .single();

    if (error) {
      throw new Error(`Failed to create assignment: ${error.message}`);
    }

    return this.mapToAssignment(data);
  }

  /**
   * Update assignment (accept/decline, change cadence, end)
   */
  async updateAssignment(
    id: string,
    updates: {
      status?: AssignmentStatus;
      engagement_cadence?: EngagementCadence;
      end_reason?: string;
    }
  ): Promise<ExecutiveAssignment> {
    if (!this.supabase) {
      throw new Error('Supabase not configured');
    }

    const updateData: Record<string, unknown> = { ...updates };

    // Set ended_at if status is being set to 'ended'
    if (updates.status === 'ended') {
      updateData.ended_at = new Date().toISOString();
    }

    const { data, error } = await this.supabase
      .from('executive_assignments')
      .update(updateData)
      .eq('id', id)
      .select(`
        *,
        customers(id, name, arr, health_score, industry, segment, renewal_date),
        executive_sponsors(*, users(id, email, name, avatar_url))
      `)
      .single();

    if (error) {
      throw new Error(`Failed to update assignment: ${error.message}`);
    }

    return this.mapToAssignment(data);
  }

  /**
   * Delete assignment
   */
  async deleteAssignment(id: string): Promise<void> {
    if (!this.supabase) {
      return;
    }

    const { error } = await this.supabase
      .from('executive_assignments')
      .delete()
      .eq('id', id);

    if (error) {
      throw new Error(`Failed to delete assignment: ${error.message}`);
    }
  }

  // ============================================
  // ENGAGEMENT TRACKING
  // ============================================

  /**
   * Get engagements with filters
   */
  async getEngagements(options: {
    customer_id?: string;
    executive_sponsor_id?: string;
    assignment_id?: string;
    engagement_type?: EngagementType;
    start_date?: Date;
    end_date?: Date;
    page?: number;
    pageSize?: number;
  } = {}): Promise<{ engagements: ExecutiveEngagement[]; total: number }> {
    if (!this.supabase) {
      return { engagements: [], total: 0 };
    }

    const page = options.page || 1;
    const pageSize = options.pageSize || 20;
    const offset = (page - 1) * pageSize;

    let query = this.supabase
      .from('executive_engagements')
      .select(`
        *,
        customers(id, name),
        executive_sponsors(*, users(id, email, name, avatar_url))
      `, { count: 'exact' });

    if (options.customer_id) {
      query = query.eq('customer_id', options.customer_id);
    }

    if (options.executive_sponsor_id) {
      query = query.eq('executive_sponsor_id', options.executive_sponsor_id);
    }

    if (options.assignment_id) {
      query = query.eq('assignment_id', options.assignment_id);
    }

    if (options.engagement_type) {
      query = query.eq('engagement_type', options.engagement_type);
    }

    if (options.start_date) {
      query = query.gte('engagement_date', options.start_date.toISOString());
    }

    if (options.end_date) {
      query = query.lte('engagement_date', options.end_date.toISOString());
    }

    const { data, count, error } = await query
      .order('engagement_date', { ascending: false })
      .range(offset, offset + pageSize - 1);

    if (error) {
      console.error('Error fetching engagements:', error);
      throw new Error(`Failed to fetch engagements: ${error.message}`);
    }

    return {
      engagements: (data || []).map(e => this.mapToEngagement(e)),
      total: count || 0
    };
  }

  /**
   * Create engagement
   */
  async createEngagement(
    request: {
      assignment_id?: string;
      customer_id: string;
      executive_sponsor_id: string;
      engagement_type: EngagementType;
      title: string;
      description?: string;
      customer_attendees?: string[];
      outcome?: string;
      next_steps?: string;
      engagement_date: string | Date;
      source?: EngagementSource;
      external_id?: string;
    },
    logged_by_user_id?: string
  ): Promise<ExecutiveEngagement> {
    if (!this.supabase) {
      return {
        id: `eng_${Date.now()}`,
        ...request,
        engagement_date: new Date(request.engagement_date),
        customer_attendees: request.customer_attendees || [],
        source: request.source || 'manual',
        logged_by_user_id,
        created_at: new Date()
      };
    }

    const { data, error } = await this.supabase
      .from('executive_engagements')
      .insert({
        assignment_id: request.assignment_id,
        customer_id: request.customer_id,
        executive_sponsor_id: request.executive_sponsor_id,
        engagement_type: request.engagement_type,
        title: request.title,
        description: request.description,
        customer_attendees: request.customer_attendees || [],
        outcome: request.outcome,
        next_steps: request.next_steps,
        engagement_date: new Date(request.engagement_date).toISOString(),
        logged_by_user_id,
        source: request.source || 'manual',
        external_id: request.external_id
      })
      .select(`
        *,
        customers(id, name),
        executive_sponsors(*, users(id, email, name, avatar_url))
      `)
      .single();

    if (error) {
      throw new Error(`Failed to create engagement: ${error.message}`);
    }

    return this.mapToEngagement(data);
  }

  // ============================================
  // MATCHING ALGORITHM
  // ============================================

  /**
   * Find best-fit executive sponsors for a customer
   */
  async findBestExecutiveSponsors(customerId: string): Promise<ExecutiveMatch[]> {
    // Get customer data
    const customer = await this.getCustomer(customerId);
    if (!customer) {
      throw new Error('Customer not found');
    }

    // Get all active sponsors with capacity
    const { sponsors } = await this.getExecutiveSponsors({
      active: true,
      has_capacity: true
    });

    // Calculate match scores
    const matches: ExecutiveMatch[] = await Promise.all(
      sponsors.map(async (sponsor) => {
        const factors = await this.calculateMatchFactors(sponsor, customer);
        const score = this.calculateMatchScore(factors);

        return {
          executive_sponsor_id: sponsor.id,
          executive_sponsor: sponsor,
          match_score: score,
          factors
        };
      })
    );

    // Sort by score descending
    return matches
      .filter(m => m.factors.capacity_available)
      .sort((a, b) => b.match_score - a.match_score);
  }

  private async calculateMatchFactors(
    sponsor: ExecutiveSponsor,
    customer: Record<string, unknown>
  ): Promise<ExecutiveMatch['factors']> {
    const industryMatch = sponsor.industries.includes(customer.industry as string);
    const capacityAvailable = sponsor.current_accounts < sponsor.max_accounts;

    // Check for specialty match based on customer metadata
    const customerNeeds = (customer.metadata as Record<string, unknown>)?.needs as string[] || [];
    const specialtyMatch = sponsor.specialties.some(s => customerNeeds.includes(s));

    // Check for prior relationship
    const hasHistory = await this.hasPriorRelationship(sponsor.id, customer.id as string);

    return {
      industry_match: industryMatch,
      capacity_available: capacityAvailable,
      relationship_history: hasHistory,
      specialty_match: specialtyMatch
    };
  }

  private calculateMatchScore(factors: ExecutiveMatch['factors']): number {
    let score = 0;
    if (factors.capacity_available) score += 30;
    if (factors.industry_match) score += 25;
    if (factors.specialty_match) score += 25;
    if (factors.relationship_history) score += 20;
    return score;
  }

  private async hasPriorRelationship(sponsorId: string, customerId: string): Promise<boolean> {
    if (!this.supabase) {
      return false;
    }

    const { data } = await this.supabase
      .from('executive_assignments')
      .select('id')
      .eq('executive_sponsor_id', sponsorId)
      .eq('customer_id', customerId)
      .limit(1);

    return (data?.length || 0) > 0;
  }

  // ============================================
  // PORTFOLIO & DASHBOARD
  // ============================================

  /**
   * Get executive sponsor portfolio
   */
  async getSponsorPortfolio(sponsorId: string): Promise<{
    executive_sponsor: ExecutiveSponsor;
    accounts: Array<{
      customer_id: string;
      customer_name: string;
      arr: number;
      health_score?: number;
      industry?: string;
      segment?: string;
      assignment_status: AssignmentStatus;
      engagement_cadence: EngagementCadence;
      last_engagement_date?: Date;
      days_since_engagement?: number;
      is_overdue: boolean;
      total_engagements: number;
    }>;
    summary: {
      total_accounts: number;
      total_arr: number;
      avg_health_score: number;
      overdue_engagements: number;
      engagements_this_quarter: number;
    };
  }> {
    const sponsor = await this.getExecutiveSponsor(sponsorId);
    if (!sponsor) {
      throw new Error('Executive sponsor not found');
    }

    // Get active assignments
    const { assignments } = await this.getAssignments({
      executive_sponsor_id: sponsorId,
      status: 'active'
    });

    // Build portfolio accounts
    const accounts = await Promise.all(
      assignments.map(async (assignment) => {
        const lastEngagement = await this.getLastEngagement(sponsorId, assignment.customer_id);
        const engagementCount = await this.getEngagementCount(sponsorId, assignment.customer_id);

        const cadenceDays = ENGAGEMENT_CADENCE_DAYS[assignment.engagement_cadence];
        const daysSince = lastEngagement
          ? Math.floor((Date.now() - lastEngagement.getTime()) / (1000 * 60 * 60 * 24))
          : null;

        return {
          customer_id: assignment.customer_id,
          customer_name: (assignment.customer as Record<string, unknown>)?.name as string || 'Unknown',
          arr: (assignment.customer as Record<string, unknown>)?.arr as number || 0,
          health_score: (assignment.customer as Record<string, unknown>)?.health_score as number,
          industry: (assignment.customer as Record<string, unknown>)?.industry as string,
          segment: (assignment.customer as Record<string, unknown>)?.segment as string,
          assignment_status: assignment.status,
          engagement_cadence: assignment.engagement_cadence,
          last_engagement_date: lastEngagement || undefined,
          days_since_engagement: daysSince || undefined,
          is_overdue: daysSince !== null && daysSince > cadenceDays,
          total_engagements: engagementCount
        };
      })
    );

    // Calculate summary
    const totalArr = accounts.reduce((sum, a) => sum + a.arr, 0);
    const healthScores = accounts.filter(a => a.health_score !== undefined);
    const avgHealthScore = healthScores.length > 0
      ? Math.round(healthScores.reduce((sum, a) => sum + (a.health_score || 0), 0) / healthScores.length)
      : 0;
    const overdueCount = accounts.filter(a => a.is_overdue).length;

    // Get this quarter's engagements
    const quarterStart = this.getQuarterStart();
    const { engagements } = await this.getEngagements({
      executive_sponsor_id: sponsorId,
      start_date: quarterStart
    });

    return {
      executive_sponsor: sponsor,
      accounts,
      summary: {
        total_accounts: accounts.length,
        total_arr: totalArr,
        avg_health_score: avgHealthScore,
        overdue_engagements: overdueCount,
        engagements_this_quarter: engagements.length
      }
    };
  }

  /**
   * Get executive sponsor dashboard
   */
  async getSponsorDashboard(sponsorId: string): Promise<{
    executive_sponsor: ExecutiveSponsor;
    portfolio_summary: {
      total_accounts: number;
      total_arr: number;
      avg_health_score: number;
      health_distribution: {
        healthy: number;
        warning: number;
        critical: number;
      };
    };
    overdue_touchpoints: Array<{
      customer_id: string;
      customer_name: string;
      days_overdue: number;
      expected_cadence: EngagementCadence;
      last_engagement?: Date;
    }>;
    recommended_actions: Array<{
      priority: 'high' | 'medium' | 'low';
      action_type: string;
      customer_id: string;
      customer_name: string;
      reason: string;
      suggested_action: string;
    }>;
    recent_engagements: ExecutiveEngagement[];
  }> {
    const portfolio = await this.getSponsorPortfolio(sponsorId);

    // Calculate health distribution
    const healthDist = { healthy: 0, warning: 0, critical: 0 };
    portfolio.accounts.forEach(a => {
      if (!a.health_score) return;
      if (a.health_score >= 70) healthDist.healthy++;
      else if (a.health_score >= 40) healthDist.warning++;
      else healthDist.critical++;
    });

    // Get overdue touchpoints
    const overdueTouchpoints = portfolio.accounts
      .filter(a => a.is_overdue)
      .map(a => ({
        customer_id: a.customer_id,
        customer_name: a.customer_name,
        days_overdue: (a.days_since_engagement || 0) - ENGAGEMENT_CADENCE_DAYS[a.engagement_cadence],
        expected_cadence: a.engagement_cadence,
        last_engagement: a.last_engagement_date
      }))
      .sort((a, b) => b.days_overdue - a.days_overdue);

    // Generate recommended actions
    const recommendedActions = this.generateRecommendedActions(portfolio.accounts);

    // Get recent engagements
    const { engagements } = await this.getEngagements({
      executive_sponsor_id: sponsorId,
      page: 1,
      pageSize: 10
    });

    return {
      executive_sponsor: portfolio.executive_sponsor,
      portfolio_summary: {
        total_accounts: portfolio.summary.total_accounts,
        total_arr: portfolio.summary.total_arr,
        avg_health_score: portfolio.summary.avg_health_score,
        health_distribution: healthDist
      },
      overdue_touchpoints: overdueTouchpoints,
      recommended_actions: recommendedActions,
      recent_engagements: engagements
    };
  }

  private generateRecommendedActions(accounts: Array<{
    customer_id: string;
    customer_name: string;
    arr: number;
    health_score?: number;
    is_overdue: boolean;
    days_since_engagement?: number;
    engagement_cadence: EngagementCadence;
  }>): Array<{
    priority: 'high' | 'medium' | 'low';
    action_type: string;
    customer_id: string;
    customer_name: string;
    reason: string;
    suggested_action: string;
  }> {
    const actions: Array<{
      priority: 'high' | 'medium' | 'low';
      action_type: string;
      customer_id: string;
      customer_name: string;
      reason: string;
      suggested_action: string;
    }> = [];

    accounts.forEach(account => {
      // Critical health score
      if (account.health_score !== undefined && account.health_score < 40) {
        actions.push({
          priority: 'high',
          action_type: 'health_intervention',
          customer_id: account.customer_id,
          customer_name: account.customer_name,
          reason: `Health score is critical (${account.health_score})`,
          suggested_action: 'Schedule emergency executive call to understand blockers'
        });
      }

      // Overdue engagement
      if (account.is_overdue) {
        const daysOverdue = (account.days_since_engagement || 0) - ENGAGEMENT_CADENCE_DAYS[account.engagement_cadence];
        actions.push({
          priority: daysOverdue > 30 ? 'high' : 'medium',
          action_type: 'overdue_engagement',
          customer_id: account.customer_id,
          customer_name: account.customer_name,
          reason: `${daysOverdue} days overdue for ${account.engagement_cadence} touchpoint`,
          suggested_action: 'Schedule executive touchpoint meeting'
        });
      }

      // High ARR with declining health (if we had trend data)
      if (account.arr > 500000 && account.health_score !== undefined && account.health_score < 60) {
        actions.push({
          priority: 'high',
          action_type: 'strategic_account_risk',
          customer_id: account.customer_id,
          customer_name: account.customer_name,
          reason: `High-value account ($${(account.arr / 1000).toFixed(0)}K ARR) with concerning health`,
          suggested_action: 'Initiate executive escalation process'
        });
      }
    });

    // Sort by priority
    const priorityOrder = { high: 0, medium: 1, low: 2 };
    return actions.sort((a, b) => priorityOrder[a.priority] - priorityOrder[b.priority]);
  }

  // ============================================
  // IMPACT METRICS
  // ============================================

  /**
   * Get impact metrics comparing sponsored vs non-sponsored accounts
   */
  async getImpactMetrics(): Promise<{
    period: { start: Date; end: Date };
    sponsored_accounts: {
      count: number;
      total_arr: number;
      avg_health_score: number;
      renewal_rate: number;
    };
    non_sponsored_accounts: {
      count: number;
      total_arr: number;
      avg_health_score: number;
      renewal_rate: number;
    };
    lift: {
      health_score_lift: number;
      renewal_rate_lift: number;
    };
    executive_scorecard: Array<{
      executive_sponsor_id: string;
      executive_name: string;
      accounts: number;
      arr: number;
      avg_health_score: number;
      engagement_rate: number;
    }>;
  }> {
    if (!this.supabase) {
      return this.getMockImpactMetrics();
    }

    const periodStart = new Date();
    periodStart.setFullYear(periodStart.getFullYear() - 1);
    const periodEnd = new Date();

    // Get all customers with their sponsorship status
    const { data: customers } = await this.supabase
      .from('customers')
      .select('id, name, arr, health_score, renewal_date');

    const { data: activeAssignments } = await this.supabase
      .from('executive_assignments')
      .select('customer_id, executive_sponsor_id')
      .eq('status', 'active');

    const sponsoredIds = new Set((activeAssignments || []).map(a => a.customer_id));

    const sponsored = (customers || []).filter(c => sponsoredIds.has(c.id));
    const nonSponsored = (customers || []).filter(c => !sponsoredIds.has(c.id));

    // Calculate metrics
    const sponsoredMetrics = this.calculateAccountMetrics(sponsored);
    const nonSponsoredMetrics = this.calculateAccountMetrics(nonSponsored);

    // Get executive scorecard
    const { sponsors } = await this.getExecutiveSponsors({ active: true });
    const scorecard = await Promise.all(
      sponsors.map(async (sponsor) => {
        const portfolio = await this.getSponsorPortfolio(sponsor.id);
        const quarterStart = this.getQuarterStart();
        const { engagements } = await this.getEngagements({
          executive_sponsor_id: sponsor.id,
          start_date: quarterStart
        });

        return {
          executive_sponsor_id: sponsor.id,
          executive_name: sponsor.user?.name || sponsor.title,
          accounts: portfolio.summary.total_accounts,
          arr: portfolio.summary.total_arr,
          avg_health_score: portfolio.summary.avg_health_score,
          engagement_rate: portfolio.summary.total_accounts > 0
            ? Math.round((engagements.length / portfolio.summary.total_accounts) * 100)
            : 0
        };
      })
    );

    return {
      period: { start: periodStart, end: periodEnd },
      sponsored_accounts: {
        count: sponsored.length,
        total_arr: sponsoredMetrics.totalArr,
        avg_health_score: sponsoredMetrics.avgHealthScore,
        renewal_rate: sponsoredMetrics.renewalRate
      },
      non_sponsored_accounts: {
        count: nonSponsored.length,
        total_arr: nonSponsoredMetrics.totalArr,
        avg_health_score: nonSponsoredMetrics.avgHealthScore,
        renewal_rate: nonSponsoredMetrics.renewalRate
      },
      lift: {
        health_score_lift: sponsoredMetrics.avgHealthScore - nonSponsoredMetrics.avgHealthScore,
        renewal_rate_lift: sponsoredMetrics.renewalRate - nonSponsoredMetrics.renewalRate
      },
      executive_scorecard: scorecard
    };
  }

  private calculateAccountMetrics(accounts: Array<{
    id: string;
    arr: number;
    health_score?: number;
    renewal_date?: string;
  }>): {
    totalArr: number;
    avgHealthScore: number;
    renewalRate: number;
  } {
    if (accounts.length === 0) {
      return { totalArr: 0, avgHealthScore: 0, renewalRate: 0 };
    }

    const totalArr = accounts.reduce((sum, a) => sum + (a.arr || 0), 0);
    const healthScores = accounts.filter(a => a.health_score !== undefined);
    const avgHealthScore = healthScores.length > 0
      ? Math.round(healthScores.reduce((sum, a) => sum + (a.health_score || 0), 0) / healthScores.length)
      : 0;

    // Simplified renewal rate calculation (would need actual renewal data in production)
    const renewalRate = 85; // Placeholder

    return { totalArr, avgHealthScore, renewalRate };
  }

  // ============================================
  // QUALIFICATION & CRITERIA
  // ============================================

  /**
   * Get accounts qualifying for executive sponsorship
   */
  async getQualifiedAccounts(): Promise<{
    qualified_accounts: Array<{
      customer_id: string;
      customer_name: string;
      arr: number;
      segment?: string;
      industry?: string;
      health_score?: number;
      matching_criteria: string[];
      has_sponsor: boolean;
      current_sponsor_id?: string;
    }>;
    total_qualified: number;
    total_assigned: number;
    total_unassigned: number;
  }> {
    if (!this.supabase) {
      return {
        qualified_accounts: [],
        total_qualified: 0,
        total_assigned: 0,
        total_unassigned: 0
      };
    }

    // Get criteria
    const { data: criteriaData } = await this.supabase
      .from('executive_sponsor_criteria')
      .select('*')
      .eq('active', true)
      .order('priority', { ascending: false });

    const criteria = criteriaData || [];

    // Get all customers
    const { data: customers } = await this.supabase
      .from('customers')
      .select('id, name, arr, segment, industry, health_score');

    // Get active assignments
    const { data: assignments } = await this.supabase
      .from('executive_assignments')
      .select('customer_id, executive_sponsor_id')
      .eq('status', 'active');

    const assignmentMap = new Map((assignments || []).map(a => [a.customer_id, a.executive_sponsor_id]));

    // Evaluate each customer against criteria
    const qualifiedAccounts = (customers || [])
      .map(customer => {
        const matchingCriteria = criteria
          .filter(c => this.customerMatchesCriteria(customer, c.conditions))
          .map(c => c.name);

        if (matchingCriteria.length === 0) return null;

        return {
          customer_id: customer.id,
          customer_name: customer.name,
          arr: customer.arr,
          segment: customer.segment,
          industry: customer.industry,
          health_score: customer.health_score,
          matching_criteria: matchingCriteria,
          has_sponsor: assignmentMap.has(customer.id),
          current_sponsor_id: assignmentMap.get(customer.id)
        };
      })
      .filter((a): a is NonNullable<typeof a> => a !== null);

    const assigned = qualifiedAccounts.filter(a => a.has_sponsor).length;

    return {
      qualified_accounts: qualifiedAccounts,
      total_qualified: qualifiedAccounts.length,
      total_assigned: assigned,
      total_unassigned: qualifiedAccounts.length - assigned
    };
  }

  private customerMatchesCriteria(
    customer: { arr: number; segment?: string; industry?: string; health_score?: number },
    conditions: Record<string, unknown>
  ): boolean {
    // ARR threshold
    if (conditions.arr_min && customer.arr < (conditions.arr_min as number)) {
      return false;
    }
    if (conditions.arr_max && customer.arr > (conditions.arr_max as number)) {
      return false;
    }

    // Segment match
    if (conditions.segment && customer.segment !== conditions.segment) {
      return false;
    }
    if (conditions.segments && !(conditions.segments as string[]).includes(customer.segment || '')) {
      return false;
    }

    // Industry match
    if (conditions.industry && customer.industry !== conditions.industry) {
      return false;
    }
    if (conditions.industries && !(conditions.industries as string[]).includes(customer.industry || '')) {
      return false;
    }

    // Health score threshold (for at-risk sponsorship)
    if (conditions.health_score_max && (customer.health_score || 100) > (conditions.health_score_max as number)) {
      return false;
    }

    return true;
  }

  // ============================================
  // HELPER METHODS
  // ============================================

  private async getAssignmentCount(sponsorId: string): Promise<number> {
    if (!this.supabase) {
      return 0;
    }

    const { count } = await this.supabase
      .from('executive_assignments')
      .select('*', { count: 'exact', head: true })
      .eq('executive_sponsor_id', sponsorId)
      .eq('status', 'active');

    return count || 0;
  }

  private async getLastEngagement(sponsorId: string, customerId: string): Promise<Date | null> {
    if (!this.supabase) {
      return null;
    }

    const { data } = await this.supabase
      .from('executive_engagements')
      .select('engagement_date')
      .eq('executive_sponsor_id', sponsorId)
      .eq('customer_id', customerId)
      .order('engagement_date', { ascending: false })
      .limit(1)
      .single();

    return data ? new Date(data.engagement_date) : null;
  }

  private async getEngagementCount(sponsorId: string, customerId: string): Promise<number> {
    if (!this.supabase) {
      return 0;
    }

    const { count } = await this.supabase
      .from('executive_engagements')
      .select('*', { count: 'exact', head: true })
      .eq('executive_sponsor_id', sponsorId)
      .eq('customer_id', customerId);

    return count || 0;
  }

  private async getCustomer(customerId: string): Promise<Record<string, unknown> | null> {
    if (!this.supabase) {
      return null;
    }

    const { data } = await this.supabase
      .from('customers')
      .select('*')
      .eq('id', customerId)
      .single();

    return data;
  }

  private getQuarterStart(): Date {
    const now = new Date();
    const quarter = Math.floor(now.getMonth() / 3);
    return new Date(now.getFullYear(), quarter * 3, 1);
  }

  // ============================================
  // MAPPERS
  // ============================================

  private mapToExecutiveSponsor(data: Record<string, unknown>, currentAccounts: number): ExecutiveSponsor {
    return {
      id: data.id as string,
      user_id: data.user_id as string,
      title: data.title as string,
      bio: data.bio as string | undefined,
      industries: (data.industries as string[]) || [],
      specialties: (data.specialties as string[]) || [],
      max_accounts: data.max_accounts as number,
      current_accounts: currentAccounts,
      active: data.active as boolean,
      created_at: new Date(data.created_at as string),
      user: data.users ? {
        id: (data.users as Record<string, unknown>).id as string,
        email: (data.users as Record<string, unknown>).email as string,
        name: (data.users as Record<string, unknown>).name as string,
        avatar_url: (data.users as Record<string, unknown>).avatar_url as string | undefined
      } : undefined
    };
  }

  private mapToAssignment(data: Record<string, unknown>): ExecutiveAssignment {
    return {
      id: data.id as string,
      customer_id: data.customer_id as string,
      executive_sponsor_id: data.executive_sponsor_id as string,
      assigned_by_user_id: data.assigned_by_user_id as string | undefined,
      status: data.status as AssignmentStatus,
      engagement_cadence: data.engagement_cadence as EngagementCadence,
      assignment_reason: data.assignment_reason as string | undefined,
      started_at: new Date(data.started_at as string),
      ended_at: data.ended_at ? new Date(data.ended_at as string) : undefined,
      end_reason: data.end_reason as string | undefined,
      created_at: new Date(data.created_at as string),
      customer: data.customers as Record<string, unknown>,
      executive_sponsor: data.executive_sponsors
        ? this.mapToExecutiveSponsor(data.executive_sponsors as Record<string, unknown>, 0)
        : undefined
    };
  }

  private mapToEngagement(data: Record<string, unknown>): ExecutiveEngagement {
    return {
      id: data.id as string,
      assignment_id: data.assignment_id as string | undefined,
      customer_id: data.customer_id as string,
      executive_sponsor_id: data.executive_sponsor_id as string,
      engagement_type: data.engagement_type as EngagementType,
      title: data.title as string,
      description: data.description as string | undefined,
      customer_attendees: (data.customer_attendees as string[]) || [],
      outcome: data.outcome as string | undefined,
      next_steps: data.next_steps as string | undefined,
      engagement_date: new Date(data.engagement_date as string),
      logged_by_user_id: data.logged_by_user_id as string | undefined,
      source: data.source as EngagementSource,
      external_id: data.external_id as string | undefined,
      created_at: new Date(data.created_at as string)
    };
  }

  // ============================================
  // MOCK DATA
  // ============================================

  private getMockSponsors(): ExecutiveSponsor[] {
    return [
      {
        id: 'exec_1',
        user_id: 'user_1',
        title: 'VP of Customer Success',
        bio: 'Experienced CS leader with 15+ years in enterprise software',
        industries: ['Technology', 'Healthcare', 'Finance'],
        specialties: ['Enterprise SaaS', 'Digital Transformation'],
        max_accounts: 10,
        current_accounts: 5,
        active: true,
        created_at: new Date('2024-01-15'),
        user: {
          id: 'user_1',
          email: 'sarah.johnson@company.com',
          name: 'Sarah Johnson'
        }
      },
      {
        id: 'exec_2',
        user_id: 'user_2',
        title: 'Chief Customer Officer',
        bio: 'Strategic leader focused on customer outcomes',
        industries: ['Retail', 'Manufacturing', 'Technology'],
        specialties: ['Supply Chain', 'Operations'],
        max_accounts: 8,
        current_accounts: 6,
        active: true,
        created_at: new Date('2024-02-10'),
        user: {
          id: 'user_2',
          email: 'michael.chen@company.com',
          name: 'Michael Chen'
        }
      },
      {
        id: 'exec_3',
        user_id: 'user_3',
        title: 'SVP of Strategic Accounts',
        bio: 'Focus on Fortune 500 relationships',
        industries: ['Finance', 'Insurance', 'Banking'],
        specialties: ['Risk Management', 'Compliance'],
        max_accounts: 5,
        current_accounts: 3,
        active: true,
        created_at: new Date('2024-03-20'),
        user: {
          id: 'user_3',
          email: 'david.williams@company.com',
          name: 'David Williams'
        }
      }
    ];
  }

  private getMockImpactMetrics() {
    const periodStart = new Date();
    periodStart.setFullYear(periodStart.getFullYear() - 1);

    return {
      period: { start: periodStart, end: new Date() },
      sponsored_accounts: {
        count: 45,
        total_arr: 22500000,
        avg_health_score: 78,
        renewal_rate: 94
      },
      non_sponsored_accounts: {
        count: 180,
        total_arr: 36000000,
        avg_health_score: 68,
        renewal_rate: 85
      },
      lift: {
        health_score_lift: 10,
        renewal_rate_lift: 9
      },
      executive_scorecard: [
        {
          executive_sponsor_id: 'exec_1',
          executive_name: 'Sarah Johnson',
          accounts: 5,
          arr: 7500000,
          avg_health_score: 82,
          engagement_rate: 100
        },
        {
          executive_sponsor_id: 'exec_2',
          executive_name: 'Michael Chen',
          accounts: 6,
          arr: 9000000,
          avg_health_score: 75,
          engagement_rate: 83
        },
        {
          executive_sponsor_id: 'exec_3',
          executive_name: 'David Williams',
          accounts: 3,
          arr: 6000000,
          avg_health_score: 79,
          engagement_rate: 100
        }
      ]
    };
  }
}

// Singleton instance
export const executiveSponsorService = new ExecutiveSponsorService();
