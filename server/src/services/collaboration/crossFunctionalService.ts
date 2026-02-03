/**
 * PRD-257: Cross-Functional Alignment Service
 *
 * Service for managing cross-functional activities, account teams,
 * conflict detection, and coordination requests.
 */

import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { v4 as uuidv4 } from 'uuid';
import { config } from '../../config/index.js';
import {
  CrossFunctionalActivity,
  CreateActivityParams,
  ActivityFilters,
  AccountTeamMember,
  CreateTeamMemberParams,
  UpdateTeamMemberParams,
  CoordinationRequest,
  CreateCoordinationRequestParams,
  UpdateCoordinationRequestParams,
  ActivityConflict,
  ResolveConflictParams,
  IntegrationSyncStatus,
  ActivityTimeline,
  AccountTeam,
  ConflictSummary,
  CrossFunctionalSummary,
  ConflictDetectionParams,
  ConflictDetectionResult,
  Team,
  SourceSystem,
  ConflictType,
  ConflictSeverity,
} from './crossFunctionalTypes.js';

// ============================================
// CrossFunctionalService Class
// ============================================

export class CrossFunctionalService {
  private supabase: SupabaseClient | null = null;

  // In-memory stores for fallback
  private activities: Map<string, CrossFunctionalActivity> = new Map();
  private teamMembers: Map<string, AccountTeamMember> = new Map();
  private coordinationRequests: Map<string, CoordinationRequest> = new Map();
  private conflicts: Map<string, ActivityConflict> = new Map();

  constructor() {
    if (config.supabaseUrl && config.supabaseServiceKey) {
      this.supabase = createClient(config.supabaseUrl, config.supabaseServiceKey);
    }
  }

  // ============================================
  // Activity Operations
  // ============================================

  /**
   * Create a new cross-functional activity
   */
  async createActivity(params: CreateActivityParams): Promise<CrossFunctionalActivity> {
    const id = uuidv4();
    const now = new Date();

    const activity: CrossFunctionalActivity = {
      id,
      customerId: params.customerId,
      sourceSystem: params.sourceSystem,
      sourceId: params.sourceId,
      sourceUrl: params.sourceUrl,
      activityType: params.activityType,
      title: params.title,
      description: params.description,
      team: params.team,
      performedByName: params.performedByName,
      performedByEmail: params.performedByEmail,
      performedByUserId: params.performedByUserId,
      contactName: params.contactName,
      contactEmail: params.contactEmail,
      activityDate: new Date(params.activityDate),
      isPlanned: params.isPlanned || false,
      status: params.status,
      outcome: params.outcome,
      metadata: params.metadata || {},
      syncedAt: now,
      createdAt: now,
      updatedAt: now,
    };

    if (this.supabase) {
      const { data, error } = await this.supabase
        .from('cross_functional_activities')
        .insert({
          id,
          customer_id: params.customerId,
          source_system: params.sourceSystem,
          source_id: params.sourceId,
          source_url: params.sourceUrl,
          activity_type: params.activityType,
          title: params.title,
          description: params.description,
          team: params.team,
          performed_by_name: params.performedByName,
          performed_by_email: params.performedByEmail,
          performed_by_user_id: params.performedByUserId,
          contact_name: params.contactName,
          contact_email: params.contactEmail,
          activity_date: new Date(params.activityDate).toISOString(),
          is_planned: params.isPlanned || false,
          status: params.status,
          outcome: params.outcome,
          metadata: params.metadata || {},
        })
        .select()
        .single();

      if (error) {
        console.error('[CrossFunctionalService] Error creating activity:', error);
        throw error;
      }

      return this.mapDbActivity(data);
    }

    // Fallback to in-memory
    this.activities.set(id, activity);
    return activity;
  }

  /**
   * Get activities with optional filters
   */
  async getActivities(filters: ActivityFilters): Promise<ActivityTimeline> {
    const limit = filters.limit || 50;
    const offset = filters.offset || 0;

    if (this.supabase && filters.customerId) {
      let query = this.supabase
        .from('cross_functional_activities')
        .select('*', { count: 'exact' })
        .eq('customer_id', filters.customerId)
        .order('activity_date', { ascending: false });

      if (filters.teams?.length) {
        query = query.in('team', filters.teams);
      }
      if (filters.activityTypes?.length) {
        query = query.in('activity_type', filters.activityTypes);
      }
      if (filters.sourceSystems?.length) {
        query = query.in('source_system', filters.sourceSystems);
      }
      if (filters.isPlanned !== undefined) {
        query = query.eq('is_planned', filters.isPlanned);
      }
      if (filters.startDate) {
        query = query.gte('activity_date', new Date(filters.startDate).toISOString());
      }
      if (filters.endDate) {
        query = query.lte('activity_date', new Date(filters.endDate).toISOString());
      }
      if (filters.contactEmail) {
        query = query.eq('contact_email', filters.contactEmail);
      }
      if (filters.searchQuery) {
        query = query.or(`title.ilike.%${filters.searchQuery}%,description.ilike.%${filters.searchQuery}%`);
      }

      query = query.range(offset, offset + limit - 1);

      const { data, error, count } = await query;

      if (error) {
        console.error('[CrossFunctionalService] Error fetching activities:', error);
        throw error;
      }

      const activities = (data || []).map(this.mapDbActivity);
      return this.buildActivityTimeline(activities, count || 0, limit, offset);
    }

    // Fallback to in-memory
    let results = Array.from(this.activities.values());

    if (filters.customerId) {
      results = results.filter(a => a.customerId === filters.customerId);
    }
    if (filters.teams?.length) {
      results = results.filter(a => filters.teams!.includes(a.team));
    }
    if (filters.activityTypes?.length) {
      results = results.filter(a => filters.activityTypes!.includes(a.activityType));
    }

    results.sort((a, b) => b.activityDate.getTime() - a.activityDate.getTime());
    const total = results.length;
    results = results.slice(offset, offset + limit);

    return this.buildActivityTimeline(results, total, limit, offset);
  }

  /**
   * Upsert activity by source system and source ID
   */
  async upsertActivity(params: CreateActivityParams): Promise<CrossFunctionalActivity> {
    if (this.supabase && params.sourceId) {
      // Check if exists
      const { data: existing } = await this.supabase
        .from('cross_functional_activities')
        .select('id')
        .eq('source_system', params.sourceSystem)
        .eq('source_id', params.sourceId)
        .single();

      if (existing) {
        // Update
        const { data, error } = await this.supabase
          .from('cross_functional_activities')
          .update({
            title: params.title,
            description: params.description,
            status: params.status,
            outcome: params.outcome,
            metadata: params.metadata,
            synced_at: new Date().toISOString(),
          })
          .eq('id', existing.id)
          .select()
          .single();

        if (error) throw error;
        return this.mapDbActivity(data);
      }
    }

    return this.createActivity(params);
  }

  // ============================================
  // Account Team Operations
  // ============================================

  /**
   * Add team member to account
   */
  async addTeamMember(params: CreateTeamMemberParams): Promise<AccountTeamMember> {
    const id = uuidv4();
    const now = new Date();

    const member: AccountTeamMember = {
      id,
      customerId: params.customerId,
      userId: params.userId,
      externalEmail: params.externalEmail,
      name: params.name,
      team: params.team,
      role: params.role,
      responsibilities: params.responsibilities,
      sourceSystem: params.sourceSystem,
      sourceId: params.sourceId,
      isActive: true,
      addedAt: now,
      updatedAt: now,
    };

    if (this.supabase) {
      const { data, error } = await this.supabase
        .from('account_team_members')
        .insert({
          id,
          customer_id: params.customerId,
          user_id: params.userId,
          external_email: params.externalEmail,
          name: params.name,
          team: params.team,
          role: params.role,
          responsibilities: params.responsibilities,
          source_system: params.sourceSystem,
          source_id: params.sourceId,
        })
        .select()
        .single();

      if (error) {
        console.error('[CrossFunctionalService] Error adding team member:', error);
        throw error;
      }

      return this.mapDbTeamMember(data);
    }

    this.teamMembers.set(id, member);
    return member;
  }

  /**
   * Get account team for a customer
   */
  async getAccountTeam(customerId: string): Promise<AccountTeam> {
    let members: AccountTeamMember[] = [];

    if (this.supabase) {
      const { data, error } = await this.supabase
        .from('account_team_members')
        .select('*')
        .eq('customer_id', customerId)
        .order('team')
        .order('name');

      if (error) {
        console.error('[CrossFunctionalService] Error fetching team:', error);
        throw error;
      }

      members = (data || []).map(this.mapDbTeamMember);
    } else {
      members = Array.from(this.teamMembers.values())
        .filter(m => m.customerId === customerId);
    }

    return this.buildAccountTeam(members);
  }

  /**
   * Update team member
   */
  async updateTeamMember(memberId: string, params: UpdateTeamMemberParams): Promise<AccountTeamMember | null> {
    if (this.supabase) {
      const updates: Record<string, any> = {};
      if (params.name !== undefined) updates.name = params.name;
      if (params.team !== undefined) updates.team = params.team;
      if (params.role !== undefined) updates.role = params.role;
      if (params.responsibilities !== undefined) updates.responsibilities = params.responsibilities;
      if (params.isActive !== undefined) updates.is_active = params.isActive;

      const { data, error } = await this.supabase
        .from('account_team_members')
        .update(updates)
        .eq('id', memberId)
        .select()
        .single();

      if (error) {
        console.error('[CrossFunctionalService] Error updating team member:', error);
        return null;
      }

      return this.mapDbTeamMember(data);
    }

    const member = this.teamMembers.get(memberId);
    if (!member) return null;

    const updated = { ...member, ...params, updatedAt: new Date() };
    this.teamMembers.set(memberId, updated);
    return updated;
  }

  /**
   * Remove team member
   */
  async removeTeamMember(memberId: string): Promise<boolean> {
    if (this.supabase) {
      const { error } = await this.supabase
        .from('account_team_members')
        .delete()
        .eq('id', memberId);

      return !error;
    }

    return this.teamMembers.delete(memberId);
  }

  // ============================================
  // Coordination Request Operations
  // ============================================

  /**
   * Create coordination request
   */
  async createCoordinationRequest(params: CreateCoordinationRequestParams): Promise<CoordinationRequest> {
    const id = uuidv4();
    const now = new Date();

    const request: CoordinationRequest = {
      id,
      customerId: params.customerId,
      requestedByUserId: params.requestedByUserId,
      requestType: params.requestType,
      targetTeam: params.targetTeam,
      targetEmail: params.targetEmail,
      reason: params.reason,
      contextNotes: params.contextNotes,
      startDate: params.startDate ? new Date(params.startDate) : undefined,
      endDate: params.endDate ? new Date(params.endDate) : undefined,
      status: 'pending',
      createdAt: now,
      updatedAt: now,
    };

    if (this.supabase) {
      const { data, error } = await this.supabase
        .from('coordination_requests')
        .insert({
          id,
          customer_id: params.customerId,
          requested_by_user_id: params.requestedByUserId,
          request_type: params.requestType,
          target_team: params.targetTeam,
          target_email: params.targetEmail,
          reason: params.reason,
          context_notes: params.contextNotes,
          start_date: params.startDate ? new Date(params.startDate).toISOString().split('T')[0] : null,
          end_date: params.endDate ? new Date(params.endDate).toISOString().split('T')[0] : null,
        })
        .select()
        .single();

      if (error) {
        console.error('[CrossFunctionalService] Error creating coordination request:', error);
        throw error;
      }

      return this.mapDbCoordinationRequest(data);
    }

    this.coordinationRequests.set(id, request);
    return request;
  }

  /**
   * Get coordination requests
   */
  async getCoordinationRequests(
    customerId?: string,
    status?: string
  ): Promise<CoordinationRequest[]> {
    if (this.supabase) {
      let query = this.supabase
        .from('coordination_requests')
        .select('*')
        .order('created_at', { ascending: false });

      if (customerId) query = query.eq('customer_id', customerId);
      if (status) query = query.eq('status', status);

      const { data, error } = await query;

      if (error) {
        console.error('[CrossFunctionalService] Error fetching coordination requests:', error);
        return [];
      }

      return (data || []).map(this.mapDbCoordinationRequest);
    }

    let results = Array.from(this.coordinationRequests.values());
    if (customerId) results = results.filter(r => r.customerId === customerId);
    if (status) results = results.filter(r => r.status === status);
    return results;
  }

  /**
   * Update coordination request
   */
  async updateCoordinationRequest(
    requestId: string,
    params: UpdateCoordinationRequestParams
  ): Promise<CoordinationRequest | null> {
    if (this.supabase) {
      const updates: Record<string, any> = {};
      if (params.status) updates.status = params.status;
      if (params.responseNotes !== undefined) updates.response_notes = params.responseNotes;
      if (params.respondedByUserId) {
        updates.responded_by_user_id = params.respondedByUserId;
        updates.responded_at = new Date().toISOString();
      }

      const { data, error } = await this.supabase
        .from('coordination_requests')
        .update(updates)
        .eq('id', requestId)
        .select()
        .single();

      if (error) return null;
      return this.mapDbCoordinationRequest(data);
    }

    const request = this.coordinationRequests.get(requestId);
    if (!request) return null;

    const updated = {
      ...request,
      ...params,
      respondedAt: params.respondedByUserId ? new Date() : request.respondedAt,
      updatedAt: new Date(),
    };
    this.coordinationRequests.set(requestId, updated);
    return updated;
  }

  // ============================================
  // Conflict Detection & Management
  // ============================================

  /**
   * Detect conflicts for a customer
   */
  async detectConflicts(params: ConflictDetectionParams): Promise<ConflictDetectionResult> {
    const {
      customerId,
      lookbackDays = 7,
      outreachThreshold = 2,
      gapThresholdDays = 14,
    } = params;

    const startDate = new Date();
    startDate.setDate(startDate.getDate() - lookbackDays);

    const { activities } = await this.getActivities({
      customerId,
      startDate,
      limit: 500,
    });

    const detectedConflicts: Omit<ActivityConflict, 'id' | 'createdAt' | 'updatedAt'>[] = [];
    const teamsInvolved = new Set<Team>();
    const contactActivityMap = new Map<string, CrossFunctionalActivity[]>();

    // Group activities by contact email
    for (const activity of activities) {
      teamsInvolved.add(activity.team);

      if (activity.contactEmail) {
        const existing = contactActivityMap.get(activity.contactEmail) || [];
        existing.push(activity);
        contactActivityMap.set(activity.contactEmail, existing);
      }
    }

    // Detect multiple outreach to same contact
    for (const [contactEmail, contactActivities] of Array.from(contactActivityMap.entries())) {
      // Filter to outreach activities within 2-day windows
      const outreachTypes = ['email', 'call', 'meeting'];
      const outreachActivities = contactActivities.filter(a =>
        outreachTypes.includes(a.activityType)
      );

      if (outreachActivities.length > outreachThreshold) {
        // Check if from different teams (cross-functional overlap)
        const teamsReaching = new Set(outreachActivities.map(a => a.team));

        if (teamsReaching.size > 1) {
          detectedConflicts.push({
            customerId,
            conflictType: 'multiple_outreach',
            severity: outreachActivities.length > 4 ? 'critical' : 'warning',
            description: `${outreachActivities.length} outreach activities to ${contactEmail} from ${teamsReaching.size} different teams in ${lookbackDays} days`,
            activities: outreachActivities.map(a => a.id),
            detectedAt: new Date(),
            isDismissed: false,
          });
        }
      }
    }

    // Detect coverage gaps
    if (activities.length > 0) {
      const latestActivity = activities[0];
      const daysSinceLastActivity = Math.floor(
        (new Date().getTime() - latestActivity.activityDate.getTime()) / (1000 * 60 * 60 * 24)
      );

      if (daysSinceLastActivity > gapThresholdDays) {
        detectedConflicts.push({
          customerId,
          conflictType: 'gap',
          severity: daysSinceLastActivity > 30 ? 'critical' : 'info',
          description: `No cross-functional activity in ${daysSinceLastActivity} days`,
          activities: [],
          detectedAt: new Date(),
          isDismissed: false,
        });
      }
    }

    // Save detected conflicts
    for (const conflict of detectedConflicts) {
      await this.createConflict(conflict);
    }

    return {
      conflicts: detectedConflicts,
      analyzed: {
        activitiesChecked: activities.length,
        contactsAnalyzed: contactActivityMap.size,
        teamsInvolved: Array.from(teamsInvolved),
      },
    };
  }

  /**
   * Create a conflict record
   */
  private async createConflict(
    conflict: Omit<ActivityConflict, 'id' | 'createdAt' | 'updatedAt'>
  ): Promise<ActivityConflict> {
    const id = uuidv4();
    const now = new Date();

    const fullConflict: ActivityConflict = {
      ...conflict,
      id,
      createdAt: now,
      updatedAt: now,
    };

    if (this.supabase) {
      const { data, error } = await this.supabase
        .from('activity_conflicts')
        .insert({
          id,
          customer_id: conflict.customerId,
          conflict_type: conflict.conflictType,
          severity: conflict.severity,
          description: conflict.description,
          activities: conflict.activities,
          detected_at: conflict.detectedAt.toISOString(),
          is_dismissed: conflict.isDismissed,
        })
        .select()
        .single();

      if (error) {
        console.error('[CrossFunctionalService] Error creating conflict:', error);
        throw error;
      }

      return this.mapDbConflict(data);
    }

    this.conflicts.set(id, fullConflict);
    return fullConflict;
  }

  /**
   * Get conflicts for a customer
   */
  async getConflicts(customerId: string, includeResolved = false): Promise<ConflictSummary> {
    let conflicts: ActivityConflict[] = [];

    if (this.supabase) {
      let query = this.supabase
        .from('activity_conflicts')
        .select('*')
        .eq('customer_id', customerId)
        .order('detected_at', { ascending: false });

      if (!includeResolved) {
        query = query.is('resolved_at', null);
      }

      const { data, error } = await query;

      if (error) {
        console.error('[CrossFunctionalService] Error fetching conflicts:', error);
        throw error;
      }

      conflicts = (data || []).map(this.mapDbConflict);
    } else {
      conflicts = Array.from(this.conflicts.values())
        .filter(c => c.customerId === customerId)
        .filter(c => includeResolved || !c.resolvedAt);
    }

    return this.buildConflictSummary(conflicts);
  }

  /**
   * Resolve a conflict
   */
  async resolveConflict(conflictId: string, params: ResolveConflictParams): Promise<ActivityConflict | null> {
    if (this.supabase) {
      const { data, error } = await this.supabase
        .from('activity_conflicts')
        .update({
          resolved_at: new Date().toISOString(),
          resolved_by_user_id: params.resolvedByUserId,
          resolution_notes: params.resolutionNotes,
        })
        .eq('id', conflictId)
        .select()
        .single();

      if (error) return null;
      return this.mapDbConflict(data);
    }

    const conflict = this.conflicts.get(conflictId);
    if (!conflict) return null;

    const resolved = {
      ...conflict,
      resolvedAt: new Date(),
      resolvedByUserId: params.resolvedByUserId,
      resolutionNotes: params.resolutionNotes,
      updatedAt: new Date(),
    };
    this.conflicts.set(conflictId, resolved);
    return resolved;
  }

  // ============================================
  // Integration Sync Status
  // ============================================

  /**
   * Get sync status for all integrations
   */
  async getSyncStatus(): Promise<IntegrationSyncStatus[]> {
    if (this.supabase) {
      const { data, error } = await this.supabase
        .from('integration_sync_status')
        .select('*')
        .order('source_system');

      if (error) {
        console.error('[CrossFunctionalService] Error fetching sync status:', error);
        return [];
      }

      return (data || []).map(this.mapDbSyncStatus);
    }

    // Return default statuses for fallback
    const defaultSystems: SourceSystem[] = ['salesforce', 'zendesk', 'jira', 'slack', 'cscx'];
    return defaultSystems.map(system => ({
      id: uuidv4(),
      sourceSystem: system,
      lastSyncStatus: 'never' as const,
      recordsSynced: 0,
      isEnabled: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    }));
  }

  /**
   * Update sync status for a source
   */
  async updateSyncStatus(
    sourceSystem: SourceSystem,
    status: 'success' | 'partial' | 'failed',
    recordsSynced: number,
    error?: string
  ): Promise<void> {
    if (this.supabase) {
      await this.supabase
        .from('integration_sync_status')
        .update({
          last_sync_at: new Date().toISOString(),
          last_sync_status: status,
          last_error: error,
          records_synced: recordsSynced,
        })
        .eq('source_system', sourceSystem);
    }
  }

  // ============================================
  // Summary Operations
  // ============================================

  /**
   * Get full cross-functional summary for a customer
   */
  async getCrossFunctionalSummary(customerId: string): Promise<CrossFunctionalSummary> {
    const [timeline, team, conflicts, coordinationRequests, syncStatus] = await Promise.all([
      this.getActivities({ customerId, limit: 100 }),
      this.getAccountTeam(customerId),
      this.getConflicts(customerId),
      this.getCoordinationRequests(customerId),
      this.getSyncStatus(),
    ]);

    return {
      timeline,
      team,
      conflicts,
      coordinationRequests,
      syncStatus,
    };
  }

  // ============================================
  // Helper Methods - Data Mapping
  // ============================================

  private mapDbActivity(row: any): CrossFunctionalActivity {
    return {
      id: row.id,
      customerId: row.customer_id,
      sourceSystem: row.source_system,
      sourceId: row.source_id,
      sourceUrl: row.source_url,
      activityType: row.activity_type,
      title: row.title,
      description: row.description,
      team: row.team,
      performedByName: row.performed_by_name,
      performedByEmail: row.performed_by_email,
      performedByUserId: row.performed_by_user_id,
      contactName: row.contact_name,
      contactEmail: row.contact_email,
      activityDate: new Date(row.activity_date),
      isPlanned: row.is_planned,
      status: row.status,
      outcome: row.outcome,
      metadata: row.metadata || {},
      syncedAt: new Date(row.synced_at),
      createdAt: new Date(row.created_at),
      updatedAt: new Date(row.updated_at),
    };
  }

  private mapDbTeamMember(row: any): AccountTeamMember {
    return {
      id: row.id,
      customerId: row.customer_id,
      userId: row.user_id,
      externalEmail: row.external_email,
      name: row.name,
      team: row.team,
      role: row.role,
      responsibilities: row.responsibilities,
      sourceSystem: row.source_system,
      sourceId: row.source_id,
      isActive: row.is_active,
      addedAt: new Date(row.added_at),
      updatedAt: new Date(row.updated_at),
    };
  }

  private mapDbCoordinationRequest(row: any): CoordinationRequest {
    return {
      id: row.id,
      customerId: row.customer_id,
      requestedByUserId: row.requested_by_user_id,
      requestType: row.request_type,
      targetTeam: row.target_team,
      targetEmail: row.target_email,
      reason: row.reason,
      contextNotes: row.context_notes,
      startDate: row.start_date ? new Date(row.start_date) : undefined,
      endDate: row.end_date ? new Date(row.end_date) : undefined,
      status: row.status,
      responseNotes: row.response_notes,
      respondedByUserId: row.responded_by_user_id,
      respondedAt: row.responded_at ? new Date(row.responded_at) : undefined,
      createdAt: new Date(row.created_at),
      updatedAt: new Date(row.updated_at),
    };
  }

  private mapDbConflict(row: any): ActivityConflict {
    return {
      id: row.id,
      customerId: row.customer_id,
      conflictType: row.conflict_type,
      severity: row.severity,
      description: row.description,
      activities: row.activities || [],
      detectedAt: new Date(row.detected_at),
      resolvedAt: row.resolved_at ? new Date(row.resolved_at) : undefined,
      resolvedByUserId: row.resolved_by_user_id,
      resolutionNotes: row.resolution_notes,
      isDismissed: row.is_dismissed,
      createdAt: new Date(row.created_at),
      updatedAt: new Date(row.updated_at),
    };
  }

  private mapDbSyncStatus(row: any): IntegrationSyncStatus {
    return {
      id: row.id,
      sourceSystem: row.source_system,
      lastSyncAt: row.last_sync_at ? new Date(row.last_sync_at) : undefined,
      lastSyncStatus: row.last_sync_status,
      lastError: row.last_error,
      recordsSynced: row.records_synced,
      nextSyncAt: row.next_sync_at ? new Date(row.next_sync_at) : undefined,
      isEnabled: row.is_enabled,
      createdAt: new Date(row.created_at),
      updatedAt: new Date(row.updated_at),
    };
  }

  // ============================================
  // Helper Methods - Response Building
  // ============================================

  private buildActivityTimeline(
    activities: CrossFunctionalActivity[],
    total: number,
    limit: number,
    offset: number
  ): ActivityTimeline {
    const teamBreakdown: Record<Team, number> = {
      sales: 0,
      support: 0,
      product: 0,
      engineering: 0,
      cs: 0,
      executive: 0,
    };

    const sourceBreakdown: Record<SourceSystem, number> = {
      salesforce: 0,
      zendesk: 0,
      jira: 0,
      slack: 0,
      cscx: 0,
      hubspot: 0,
      intercom: 0,
    };

    let plannedCount = 0;
    let completedCount = 0;

    for (const activity of activities) {
      teamBreakdown[activity.team]++;
      sourceBreakdown[activity.sourceSystem]++;

      if (activity.isPlanned) {
        plannedCount++;
      } else {
        completedCount++;
      }
    }

    return {
      activities,
      total,
      hasMore: offset + limit < total,
      teamBreakdown,
      sourceBreakdown,
      plannedCount,
      completedCount,
    };
  }

  private buildAccountTeam(members: AccountTeamMember[]): AccountTeam {
    const teamBreakdown: Record<Team, AccountTeamMember[]> = {
      sales: [],
      support: [],
      product: [],
      engineering: [],
      cs: [],
      executive: [],
    };

    let totalActive = 0;
    let totalInactive = 0;

    for (const member of members) {
      teamBreakdown[member.team].push(member);
      if (member.isActive) {
        totalActive++;
      } else {
        totalInactive++;
      }
    }

    return {
      members,
      teamBreakdown,
      totalActive,
      totalInactive,
    };
  }

  private buildConflictSummary(conflicts: ActivityConflict[]): ConflictSummary {
    const bySeverity: Record<ConflictSeverity, number> = {
      info: 0,
      warning: 0,
      critical: 0,
    };

    const byType: Record<ConflictType, number> = {
      multiple_outreach: 0,
      message_conflict: 0,
      overlap: 0,
      gap: 0,
    };

    let unresolvedCount = 0;

    for (const conflict of conflicts) {
      bySeverity[conflict.severity]++;
      byType[conflict.conflictType]++;

      if (!conflict.resolvedAt) {
        unresolvedCount++;
      }
    }

    return {
      conflicts,
      total: conflicts.length,
      unresolvedCount,
      bySeverity,
      byType,
    };
  }
}

// Singleton instance
export const crossFunctionalService = new CrossFunctionalService();
