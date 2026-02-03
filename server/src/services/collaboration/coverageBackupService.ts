/**
 * PRD-258: Coverage Backup System Service
 * Manages absences, backup assignments, coverage briefs, and handback
 */

import { v4 as uuidv4 } from 'uuid';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { config } from '../../config/index.js';
import {
  CSMAbsence,
  AbsenceType,
  AbsenceStatus,
  CoverageAssignment,
  CoverageType,
  AssignmentStatus,
  CoverageTier,
  BackupSuggestion,
  BackupScoreFactors,
  CoverageBrief,
  CoverageBriefContent,
  CustomerBriefInfo,
  StakeholderInfo,
  UrgentItem,
  ActivityRecord,
  ScheduledEvent,
  RiskSignal,
  CoverageActivity,
  CoverageActivityType,
  CoverageHandback,
  HandbackSummary,
  AccountHandbackSummary,
  CreateAbsenceRequest,
  UpdateAbsenceRequest,
  CreateCoverageAssignmentRequest,
  AddCoverageNoteRequest,
  TeamAbsenceCalendarView,
  TeamAbsenceEntry,
} from './types.js';

// ============================================
// Coverage Backup Service Class
// ============================================

export class CoverageBackupService {
  private supabase: SupabaseClient | null = null;

  // In-memory stores for fallback/demo
  private absences: Map<string, CSMAbsence> = new Map();
  private assignments: Map<string, CoverageAssignment> = new Map();
  private briefs: Map<string, CoverageBrief> = new Map();
  private activities: Map<string, CoverageActivity> = new Map();

  constructor() {
    if (config.supabaseUrl && config.supabaseServiceKey) {
      this.supabase = createClient(config.supabaseUrl, config.supabaseServiceKey);
    }
    this.initializeSampleData();
  }

  private initializeSampleData(): void {
    // Sample absences for demo
    const now = new Date();
    const nextWeek = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
    const twoWeeksOut = new Date(now.getTime() + 14 * 24 * 60 * 60 * 1000);

    const sampleAbsence: CSMAbsence = {
      id: 'absence-001',
      userId: 'csm-001',
      absenceType: 'vacation',
      startDate: nextWeek,
      endDate: twoWeeksOut,
      isPartial: false,
      status: 'planned',
      createdAt: now,
      updatedAt: now,
    };

    this.absences.set(sampleAbsence.id, sampleAbsence);
  }

  // ============================================
  // Absence Management
  // ============================================

  /**
   * Create a new absence record
   */
  async createAbsence(request: CreateAbsenceRequest): Promise<CSMAbsence> {
    const absence: CSMAbsence = {
      id: uuidv4(),
      userId: request.userId,
      absenceType: request.absenceType,
      startDate: new Date(request.startDate),
      endDate: new Date(request.endDate),
      isPartial: request.isPartial || false,
      partialHours: request.partialHours,
      preferredBackupUserId: request.preferredBackupUserId,
      specialInstructions: request.specialInstructions,
      status: 'planned',
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    // Save to database
    if (this.supabase) {
      await this.supabase.from('csm_absences').insert({
        id: absence.id,
        user_id: absence.userId,
        absence_type: absence.absenceType,
        start_date: absence.startDate.toISOString(),
        end_date: absence.endDate.toISOString(),
        is_partial: absence.isPartial,
        partial_hours: absence.partialHours,
        preferred_backup_user_id: absence.preferredBackupUserId,
        special_instructions: absence.specialInstructions,
        status: absence.status,
      });
    }

    this.absences.set(absence.id, absence);
    return absence;
  }

  /**
   * Get absence by ID
   */
  async getAbsence(absenceId: string): Promise<CSMAbsence | null> {
    // Check in-memory first
    const cached = this.absences.get(absenceId);
    if (cached) return cached;

    // Check database
    if (this.supabase) {
      const { data, error } = await this.supabase
        .from('csm_absences')
        .select('*')
        .eq('id', absenceId)
        .single();

      if (data && !error) {
        return this.mapDbToAbsence(data);
      }
    }

    return null;
  }

  /**
   * Get absences for a user
   */
  async getAbsencesForUser(userId: string): Promise<CSMAbsence[]> {
    if (this.supabase) {
      const { data, error } = await this.supabase
        .from('csm_absences')
        .select('*')
        .eq('user_id', userId)
        .order('start_date', { ascending: true });

      if (data && !error) {
        return data.map(d => this.mapDbToAbsence(d));
      }
    }

    return Array.from(this.absences.values()).filter(a => a.userId === userId);
  }

  /**
   * Update an absence
   */
  async updateAbsence(absenceId: string, updates: UpdateAbsenceRequest): Promise<CSMAbsence | null> {
    const absence = await this.getAbsence(absenceId);
    if (!absence) return null;

    const updatedAbsence: CSMAbsence = {
      ...absence,
      ...updates,
      startDate: updates.startDate ? new Date(updates.startDate) : absence.startDate,
      endDate: updates.endDate ? new Date(updates.endDate) : absence.endDate,
      updatedAt: new Date(),
    };

    if (this.supabase) {
      const dbUpdates: Record<string, unknown> = { updated_at: new Date().toISOString() };
      if (updates.absenceType) dbUpdates.absence_type = updates.absenceType;
      if (updates.startDate) dbUpdates.start_date = updates.startDate;
      if (updates.endDate) dbUpdates.end_date = updates.endDate;
      if (updates.isPartial !== undefined) dbUpdates.is_partial = updates.isPartial;
      if (updates.partialHours) dbUpdates.partial_hours = updates.partialHours;
      if (updates.preferredBackupUserId) dbUpdates.preferred_backup_user_id = updates.preferredBackupUserId;
      if (updates.specialInstructions) dbUpdates.special_instructions = updates.specialInstructions;
      if (updates.status) dbUpdates.status = updates.status;

      await this.supabase.from('csm_absences').update(dbUpdates).eq('id', absenceId);
    }

    this.absences.set(absenceId, updatedAbsence);
    return updatedAbsence;
  }

  /**
   * Cancel an absence
   */
  async cancelAbsence(absenceId: string): Promise<boolean> {
    const absence = await this.updateAbsence(absenceId, { status: 'cancelled' });
    return absence !== null;
  }

  // ============================================
  // Backup Suggestion Algorithm
  // ============================================

  /**
   * Suggest backup CSMs for an absence based on scoring algorithm
   */
  async suggestBackups(absenceId: string): Promise<BackupSuggestion[]> {
    const absence = await this.getAbsence(absenceId);
    if (!absence) return [];

    // Get the absent user's portfolio
    const portfolio = await this.getCustomerPortfolio(absence.userId);

    // Get potential backup candidates (same team, not also out)
    const candidates = await this.getAvailableTeamMembers(
      absence.userId,
      absence.startDate,
      absence.endDate
    );

    // Score each candidate
    const suggestions: BackupSuggestion[] = await Promise.all(
      candidates.map(async (candidate) => {
        const factors = await this.calculateBackupScore(
          candidate,
          absence,
          portfolio
        );

        return {
          userId: candidate.id,
          userName: candidate.name,
          userEmail: candidate.email,
          score: this.computeOverallScore(factors, absence.preferredBackupUserId === candidate.id),
          factors,
          availability: {
            currentAccountCount: candidate.accountCount,
            maxAccountCount: candidate.maxAccounts,
            pendingCoverageCount: candidate.pendingCoverage,
            isAvailable: candidate.isAvailable,
          },
        };
      })
    );

    // Sort by score descending
    return suggestions.sort((a, b) => b.score - a.score);
  }

  private async calculateBackupScore(
    candidate: CandidateCSM,
    absence: CSMAbsence,
    portfolio: CustomerInfo[]
  ): Promise<BackupScoreFactors> {
    // Capacity Score (0-100)
    // Lower workload = higher score
    const currentLoad = candidate.accountCount + candidate.pendingCoverage * 5;
    const maxLoad = candidate.maxAccounts;
    const capacityScore = Math.max(0, 100 - (currentLoad / maxLoad) * 100);

    // Familiarity Score (0-100)
    // How many of the absent CSM's customers has this candidate worked with?
    const sharedCustomerHistory = await this.getSharedCustomerHistory(
      candidate.id,
      portfolio.map(c => c.id)
    );
    const familiarityScore = portfolio.length > 0
      ? (sharedCustomerHistory.length / portfolio.length) * 100
      : 50;

    // Skill Match Score (0-100)
    // Similar segment/industry expertise
    const skillMatchScore = await this.calculateSkillOverlap(candidate.id, absence.userId);

    // Preference Score
    // Bonus if this is the preferred backup
    const preferenceScore = absence.preferredBackupUserId === candidate.id ? 30 : 0;

    return {
      capacityScore,
      familiarityScore,
      skillMatchScore,
      preferenceScore,
    };
  }

  private computeOverallScore(factors: BackupScoreFactors, isPreferred: boolean): number {
    // Weighted scoring
    const baseScore =
      factors.capacityScore * 0.30 +
      factors.familiarityScore * 0.30 +
      factors.skillMatchScore * 0.25;

    // Preference bonus is additive
    return baseScore + factors.preferenceScore;
  }

  // ============================================
  // Coverage Assignment
  // ============================================

  /**
   * Create a coverage assignment
   */
  async createCoverageAssignment(
    request: CreateCoverageAssignmentRequest
  ): Promise<CoverageAssignment> {
    const assignment: CoverageAssignment = {
      id: uuidv4(),
      absenceId: request.absenceId,
      backupUserId: request.backupUserId,
      assignedByUserId: request.assignedByUserId,
      coverageType: request.coverageType || 'full',
      coveredCustomerIds: request.coveredCustomerIds,
      tier: request.tier || 1,
      status: 'pending',
      notificationsReceived: 0,
      actionsTaken: 0,
      createdAt: new Date(),
    };

    if (this.supabase) {
      await this.supabase.from('coverage_assignments').insert({
        id: assignment.id,
        absence_id: assignment.absenceId,
        backup_user_id: assignment.backupUserId,
        assigned_by_user_id: assignment.assignedByUserId,
        coverage_type: assignment.coverageType,
        covered_customer_ids: assignment.coveredCustomerIds,
        tier: assignment.tier,
        status: assignment.status,
      });
    }

    // Update absence status
    await this.updateAbsence(request.absenceId, { status: 'coverage_assigned' });

    this.assignments.set(assignment.id, assignment);
    return assignment;
  }

  /**
   * Accept a coverage assignment
   */
  async acceptCoverageAssignment(assignmentId: string): Promise<CoverageAssignment | null> {
    const assignment = this.assignments.get(assignmentId) || await this.getAssignment(assignmentId);
    if (!assignment) return null;

    const updated: CoverageAssignment = {
      ...assignment,
      status: 'accepted',
      acceptedAt: new Date(),
    };

    if (this.supabase) {
      await this.supabase.from('coverage_assignments')
        .update({ status: 'accepted', accepted_at: new Date().toISOString() })
        .eq('id', assignmentId);
    }

    this.assignments.set(assignmentId, updated);

    // Generate coverage briefs for this assignment
    await this.generateCoverageBriefs(assignmentId);

    return updated;
  }

  /**
   * Decline a coverage assignment
   */
  async declineCoverageAssignment(
    assignmentId: string,
    reason: string
  ): Promise<CoverageAssignment | null> {
    const assignment = this.assignments.get(assignmentId) || await this.getAssignment(assignmentId);
    if (!assignment) return null;

    const updated: CoverageAssignment = {
      ...assignment,
      status: 'declined',
      declinedReason: reason,
    };

    if (this.supabase) {
      await this.supabase.from('coverage_assignments')
        .update({ status: 'declined', declined_reason: reason })
        .eq('id', assignmentId);
    }

    this.assignments.set(assignmentId, updated);
    return updated;
  }

  /**
   * Get coverage assignments for an absence
   */
  async getCoverageAssignments(absenceId: string): Promise<CoverageAssignment[]> {
    if (this.supabase) {
      const { data, error } = await this.supabase
        .from('coverage_assignments')
        .select('*')
        .eq('absence_id', absenceId);

      if (data && !error) {
        return data.map(d => this.mapDbToAssignment(d));
      }
    }

    return Array.from(this.assignments.values())
      .filter(a => a.absenceId === absenceId);
  }

  private async getAssignment(assignmentId: string): Promise<CoverageAssignment | null> {
    if (this.supabase) {
      const { data, error } = await this.supabase
        .from('coverage_assignments')
        .select('*')
        .eq('id', assignmentId)
        .single();

      if (data && !error) {
        return this.mapDbToAssignment(data);
      }
    }

    return this.assignments.get(assignmentId) || null;
  }

  // ============================================
  // Coverage Brief Generation
  // ============================================

  /**
   * Generate coverage briefs for all customers in an assignment
   */
  async generateCoverageBriefs(assignmentId: string): Promise<CoverageBrief[]> {
    const assignment = await this.getAssignment(assignmentId);
    if (!assignment) return [];

    const absence = await this.getAbsence(assignment.absenceId);
    if (!absence) return [];

    // Get customers to generate briefs for
    let customerIds = assignment.coveredCustomerIds;
    if (!customerIds || customerIds.length === 0) {
      // Full coverage - get all customers for the absent CSM
      const portfolio = await this.getCustomerPortfolio(absence.userId);
      customerIds = portfolio.map(c => c.id);
    }

    // Generate brief for each customer
    const briefs: CoverageBrief[] = [];

    for (const customerId of customerIds) {
      const briefContent = await this.generateBriefContent(
        customerId,
        absence.startDate,
        absence.endDate
      );

      const brief: CoverageBrief = {
        id: uuidv4(),
        coverageAssignmentId: assignmentId,
        customerId,
        briefContent,
        generatedAt: new Date(),
        actionsTaken: [],
      };

      if (this.supabase) {
        await this.supabase.from('coverage_briefs').insert({
          id: brief.id,
          coverage_assignment_id: brief.coverageAssignmentId,
          customer_id: brief.customerId,
          brief_content: brief.briefContent,
          generated_at: brief.generatedAt.toISOString(),
        });
      }

      this.briefs.set(brief.id, brief);
      briefs.push(brief);
    }

    return briefs;
  }

  private async generateBriefContent(
    customerId: string,
    coverageStart: Date,
    coverageEnd: Date
  ): Promise<CoverageBriefContent> {
    // Get customer info
    const customer = await this.getCustomerInfo(customerId);

    // Get stakeholders
    const stakeholders = await this.getStakeholders(customerId);

    // Get open tasks due during coverage
    const urgentItems = await this.getUrgentItems(customerId, coverageEnd);

    // Get recent activities (last 14 days)
    const recentActivity = await this.getRecentActivities(customerId, 14);

    // Get scheduled events during coverage period
    const scheduledEvents = await this.getScheduledEvents(customerId, coverageStart, coverageEnd);

    // Get active risk signals
    const riskFlags = await this.getActiveRiskSignals(customerId);

    return {
      customer,
      keyContacts: stakeholders.filter(s => s.isPrimary).slice(0, 3),
      urgentItems,
      recentActivity: recentActivity.slice(0, 5),
      scheduledEvents,
      riskFlags,
      specialNotes: '',
    };
  }

  /**
   * Get coverage briefs for an assignment
   */
  async getCoverageBriefs(assignmentId: string): Promise<CoverageBrief[]> {
    if (this.supabase) {
      const { data, error } = await this.supabase
        .from('coverage_briefs')
        .select('*')
        .eq('coverage_assignment_id', assignmentId);

      if (data && !error) {
        return data.map(d => this.mapDbToBrief(d));
      }
    }

    return Array.from(this.briefs.values())
      .filter(b => b.coverageAssignmentId === assignmentId);
  }

  /**
   * Mark brief as viewed
   */
  async markBriefViewed(briefId: string, userId: string): Promise<void> {
    if (this.supabase) {
      await this.supabase.from('coverage_briefs')
        .update({ viewed_at: new Date().toISOString(), viewed_by: userId })
        .eq('id', briefId);
    }

    const brief = this.briefs.get(briefId);
    if (brief) {
      brief.viewedAt = new Date();
      brief.viewedBy = userId;
    }
  }

  /**
   * Add notes to a brief
   */
  async addNotesToBrief(briefId: string, notes: string): Promise<void> {
    if (this.supabase) {
      await this.supabase.from('coverage_briefs')
        .update({ notes_added: notes })
        .eq('id', briefId);
    }

    const brief = this.briefs.get(briefId);
    if (brief) {
      brief.notesAdded = notes;
    }
  }

  // ============================================
  // Coverage Activity Logging
  // ============================================

  /**
   * Log an activity performed during coverage
   */
  async logCoverageActivity(request: AddCoverageNoteRequest): Promise<CoverageActivity> {
    const assignment = await this.getAssignment(request.coverageAssignmentId);
    if (!assignment) {
      throw new Error('Coverage assignment not found');
    }

    const absence = await this.getAbsence(assignment.absenceId);
    if (!absence) {
      throw new Error('Absence not found');
    }

    const activity: CoverageActivity = {
      id: uuidv4(),
      coverageAssignmentId: request.coverageAssignmentId,
      customerId: request.customerId,
      backupUserId: assignment.backupUserId,
      originalCsmId: absence.userId,
      activityType: request.activityType,
      description: request.description,
      outcome: request.outcome,
      relatedEntityType: request.relatedEntityType,
      relatedEntityId: request.relatedEntityId,
      activityDate: new Date(),
    };

    if (this.supabase) {
      await this.supabase.from('coverage_activities').insert({
        id: activity.id,
        coverage_assignment_id: activity.coverageAssignmentId,
        customer_id: activity.customerId,
        backup_user_id: activity.backupUserId,
        original_csm_id: activity.originalCsmId,
        activity_type: activity.activityType,
        description: activity.description,
        outcome: activity.outcome,
        related_entity_type: activity.relatedEntityType,
        related_entity_id: activity.relatedEntityId,
        activity_date: activity.activityDate.toISOString(),
      });

      // Update actions taken count
      await this.supabase.from('coverage_assignments')
        .update({ actions_taken: assignment.actionsTaken + 1 })
        .eq('id', assignment.id);
    }

    this.activities.set(activity.id, activity);
    return activity;
  }

  /**
   * Get activities for a coverage assignment
   */
  async getCoverageActivities(assignmentId: string): Promise<CoverageActivity[]> {
    if (this.supabase) {
      const { data, error } = await this.supabase
        .from('coverage_activities')
        .select('*')
        .eq('coverage_assignment_id', assignmentId)
        .order('activity_date', { ascending: false });

      if (data && !error) {
        return data.map(d => this.mapDbToActivity(d));
      }
    }

    return Array.from(this.activities.values())
      .filter(a => a.coverageAssignmentId === assignmentId);
  }

  // ============================================
  // Return Handback
  // ============================================

  /**
   * Generate handback summary when coverage ends
   */
  async generateHandback(assignmentId: string): Promise<CoverageHandback> {
    const assignment = await this.getAssignment(assignmentId);
    if (!assignment) {
      throw new Error('Coverage assignment not found');
    }

    const absence = await this.getAbsence(assignment.absenceId);
    if (!absence) {
      throw new Error('Absence not found');
    }

    // Get all activities during coverage
    const activities = await this.getCoverageActivities(assignmentId);

    // Calculate summary stats
    const summary: HandbackSummary = {
      totalActivities: activities.length,
      emailsSent: activities.filter(a => a.activityType === 'email').length,
      meetingsHeld: activities.filter(a => a.activityType === 'meeting').length,
      tasksCompleted: activities.filter(a => a.activityType === 'task').length,
      escalationsHandled: activities.filter(a => a.activityType === 'escalation').length,
    };

    // Get per-account summaries
    const accountSummaries = await this.generateAccountHandbackSummaries(
      assignment,
      activities
    );

    // Mark assignment as completed
    if (this.supabase) {
      await this.supabase.from('coverage_assignments')
        .update({ status: 'completed' })
        .eq('id', assignmentId);
    }
    assignment.status = 'completed';

    // Update absence status
    await this.updateAbsence(absence.id, { status: 'completed' });

    return {
      coverageAssignmentId: assignmentId,
      originalCsmId: absence.userId,
      backupCsmId: assignment.backupUserId,
      startDate: absence.startDate,
      endDate: absence.endDate,
      summary,
      activities,
      accountSummaries,
      generatedAt: new Date(),
    };
  }

  private async generateAccountHandbackSummaries(
    assignment: CoverageAssignment,
    activities: CoverageActivity[]
  ): Promise<AccountHandbackSummary[]> {
    // Group activities by customer
    const activitiesByCustomer = new Map<string, CoverageActivity[]>();
    for (const activity of activities) {
      if (activity.customerId) {
        const existing = activitiesByCustomer.get(activity.customerId) || [];
        existing.push(activity);
        activitiesByCustomer.set(activity.customerId, existing);
      }
    }

    const summaries: AccountHandbackSummary[] = [];

    for (const [customerId, customerActivities] of Array.from(activitiesByCustomer.entries())) {
      const customer = await this.getCustomerInfo(customerId);
      const urgentItems = await this.getUrgentItems(customerId, new Date(Date.now() + 14 * 24 * 60 * 60 * 1000));

      summaries.push({
        customerId,
        customerName: customer.name,
        activitiesCount: customerActivities.length,
        healthScoreChange: 0, // Would calculate from historical data
        healthScoreBefore: customer.healthScore,
        healthScoreAfter: customer.healthScore,
        outstandingItems: urgentItems,
        highlights: customerActivities.slice(0, 3).map(a => a.description || a.activityType),
        followUpRecommendations: this.generateFollowUpRecommendations(customer, customerActivities, urgentItems),
      });
    }

    return summaries;
  }

  private generateFollowUpRecommendations(
    customer: CustomerBriefInfo,
    activities: CoverageActivity[],
    urgentItems: UrgentItem[]
  ): string[] {
    const recommendations: string[] = [];

    // Check for high-priority outstanding items
    const highPriorityItems = urgentItems.filter(item => item.priority === 'high');
    if (highPriorityItems.length > 0) {
      recommendations.push(
        `Address ${highPriorityItems.length} high-priority outstanding item(s)`
      );
    }

    // Check health score
    if (customer.healthScore < 60) {
      recommendations.push('Schedule health check call - account at risk');
    }

    // Check for escalations during coverage
    const escalations = activities.filter(a => a.activityType === 'escalation');
    if (escalations.length > 0) {
      recommendations.push('Review and follow up on escalation(s) handled during coverage');
    }

    // Default recommendation
    if (recommendations.length === 0) {
      recommendations.push('Send brief check-in message to confirm return');
    }

    return recommendations;
  }

  // ============================================
  // Team Calendar View
  // ============================================

  /**
   * Get team absence calendar for a date range
   */
  async getTeamAbsenceCalendar(
    teamId: string,
    startDate: Date,
    endDate: Date
  ): Promise<TeamAbsenceCalendarView> {
    const absences: TeamAbsenceEntry[] = [];

    if (this.supabase) {
      // Get all absences for team members in the date range
      const { data, error } = await this.supabase
        .from('csm_absences')
        .select(`
          *,
          users!csm_absences_user_id_fkey(id, name, team_id),
          coverage_assignments(id, backup_user_id, status)
        `)
        .gte('end_date', startDate.toISOString())
        .lte('start_date', endDate.toISOString())
        .neq('status', 'cancelled');

      if (data && !error) {
        for (const row of data) {
          // Filter by team if user has team info
          if (row.users?.team_id !== teamId) continue;

          const hasAcceptedCoverage = row.coverage_assignments?.some(
            (ca: any) => ca.status === 'accepted' || ca.status === 'active'
          );

          absences.push({
            absenceId: row.id,
            userId: row.user_id,
            userName: row.users?.name || 'Unknown',
            absenceType: row.absence_type,
            startDate: new Date(row.start_date),
            endDate: new Date(row.end_date),
            status: row.status,
            coverageAssigned: hasAcceptedCoverage,
            backupName: undefined, // Would need another join to get backup name
          });
        }
      }
    }

    // Add sample data for demo
    if (absences.length === 0) {
      const sampleAbsences = Array.from(this.absences.values())
        .filter(a =>
          a.endDate >= startDate &&
          a.startDate <= endDate &&
          a.status !== 'cancelled'
        );

      for (const absence of sampleAbsences) {
        const assignments = await this.getCoverageAssignments(absence.id);
        const acceptedAssignment = assignments.find(a => a.status === 'accepted');

        absences.push({
          absenceId: absence.id,
          userId: absence.userId,
          userName: 'Sarah Johnson', // Demo name
          absenceType: absence.absenceType,
          startDate: absence.startDate,
          endDate: absence.endDate,
          status: absence.status,
          coverageAssigned: !!acceptedAssignment,
          backupName: acceptedAssignment ? 'Michael Chen' : undefined,
        });
      }
    }

    return {
      startDate,
      endDate,
      absences,
    };
  }

  // ============================================
  // Helper Methods - Data Access
  // ============================================

  private async getCustomerPortfolio(userId: string): Promise<CustomerInfo[]> {
    if (this.supabase) {
      const { data } = await this.supabase
        .from('customers')
        .select('id, name, arr, health_score')
        .eq('csm_id', userId);

      if (data) {
        return data.map(c => ({
          id: c.id,
          name: c.name,
          arr: c.arr || 0,
          healthScore: c.health_score || 70,
        }));
      }
    }

    // Sample data
    return [
      { id: 'cust-001', name: 'Acme Corp', arr: 120000, healthScore: 85 },
      { id: 'cust-002', name: 'TechStart Inc', arr: 45000, healthScore: 72 },
    ];
  }

  private async getAvailableTeamMembers(
    excludeUserId: string,
    startDate: Date,
    endDate: Date
  ): Promise<CandidateCSM[]> {
    if (this.supabase) {
      // Get user's team
      const { data: user } = await this.supabase
        .from('users')
        .select('team_id')
        .eq('id', excludeUserId)
        .single();

      if (user) {
        // Get team members not also out during this period
        const { data: teamMembers } = await this.supabase
          .from('users')
          .select('id, name, email')
          .eq('team_id', user.team_id)
          .neq('id', excludeUserId);

        if (teamMembers) {
          // Filter out those with overlapping absences
          const { data: absences } = await this.supabase
            .from('csm_absences')
            .select('user_id')
            .gte('end_date', startDate.toISOString())
            .lte('start_date', endDate.toISOString())
            .in('status', ['planned', 'coverage_assigned', 'active']);

          const unavailableIds = new Set(absences?.map(a => a.user_id) || []);

          return teamMembers
            .filter(m => !unavailableIds.has(m.id))
            .map(m => ({
              id: m.id,
              name: m.name,
              email: m.email,
              accountCount: 10, // Would fetch actual count
              maxAccounts: 15,
              pendingCoverage: 0,
              isAvailable: true,
            }));
        }
      }
    }

    // Sample data
    return [
      { id: 'csm-002', name: 'Michael Chen', email: 'michael@example.com', accountCount: 10, maxAccounts: 15, pendingCoverage: 0, isAvailable: true },
      { id: 'csm-003', name: 'Emily Rodriguez', email: 'emily@example.com', accountCount: 12, maxAccounts: 15, pendingCoverage: 1, isAvailable: true },
    ];
  }

  private async getSharedCustomerHistory(
    candidateId: string,
    customerIds: string[]
  ): Promise<string[]> {
    if (this.supabase) {
      const { data } = await this.supabase
        .from('activities')
        .select('customer_id')
        .eq('user_id', candidateId)
        .in('customer_id', customerIds);

      return Array.from(new Set(data?.map(d => d.customer_id) || []));
    }

    return [];
  }

  private async calculateSkillOverlap(candidateId: string, absentUserId: string): Promise<number> {
    if (this.supabase) {
      const { data: candidateUser } = await this.supabase
        .from('users')
        .select('skills, segments')
        .eq('id', candidateId)
        .single();

      const { data: absentUser } = await this.supabase
        .from('users')
        .select('skills, segments')
        .eq('id', absentUserId)
        .single();

      if (candidateUser && absentUser) {
        const candidateSkills = new Set([
          ...(candidateUser.skills || []),
          ...(candidateUser.segments || [])
        ]);
        const absentSkills = new Set([
          ...(absentUser.skills || []),
          ...(absentUser.segments || [])
        ]);

        const intersection = Array.from(candidateSkills).filter(s => absentSkills.has(s));
        const union = new Set([...Array.from(candidateSkills), ...Array.from(absentSkills)]);

        return union.size > 0 ? (intersection.length / union.size) * 100 : 50;
      }
    }

    return 50; // Default 50% overlap
  }

  private async getCustomerInfo(customerId: string): Promise<CustomerBriefInfo> {
    if (this.supabase) {
      const { data } = await this.supabase
        .from('customers')
        .select('*')
        .eq('id', customerId)
        .single();

      if (data) {
        return {
          id: data.id,
          name: data.name,
          arr: data.arr || 0,
          healthScore: data.health_score || 70,
          stage: data.stage || 'active',
          renewalDate: data.renewal_date,
          segment: data.segment,
          industry: data.industry,
        };
      }
    }

    return {
      id: customerId,
      name: 'Sample Customer',
      arr: 50000,
      healthScore: 75,
      stage: 'active',
    };
  }

  private async getStakeholders(customerId: string): Promise<StakeholderInfo[]> {
    if (this.supabase) {
      const { data } = await this.supabase
        .from('stakeholders')
        .select('*')
        .eq('customer_id', customerId);

      if (data) {
        return data.map(s => ({
          id: s.id,
          name: s.name,
          email: s.email,
          title: s.title,
          role: s.role,
          isPrimary: s.is_primary || false,
          phone: s.phone,
          lastContactDate: s.last_contact_date ? new Date(s.last_contact_date) : undefined,
        }));
      }
    }

    return [
      { id: 'stake-001', name: 'John Smith', email: 'john@example.com', title: 'VP Engineering', isPrimary: true },
    ];
  }

  private async getUrgentItems(customerId: string, dueBefore: Date): Promise<UrgentItem[]> {
    if (this.supabase) {
      const { data: tasks } = await this.supabase
        .from('tasks')
        .select('*')
        .eq('customer_id', customerId)
        .lte('due_date', dueBefore.toISOString())
        .in('status', ['pending', 'in_progress']);

      if (tasks) {
        return tasks.map(t => ({
          id: t.id,
          type: 'task',
          description: t.title,
          dueDate: new Date(t.due_date),
          priority: t.priority || 'medium',
        }));
      }
    }

    return [];
  }

  private async getRecentActivities(customerId: string, days: number): Promise<ActivityRecord[]> {
    const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

    if (this.supabase) {
      const { data } = await this.supabase
        .from('activities')
        .select('*')
        .eq('customer_id', customerId)
        .gte('created_at', since.toISOString())
        .order('created_at', { ascending: false });

      if (data) {
        return data.map(a => ({
          id: a.id,
          type: a.type,
          title: a.title,
          summary: a.description,
          date: new Date(a.created_at),
          performedBy: a.user_id,
        }));
      }
    }

    return [];
  }

  private async getScheduledEvents(
    customerId: string,
    startDate: Date,
    endDate: Date
  ): Promise<ScheduledEvent[]> {
    if (this.supabase) {
      const { data } = await this.supabase
        .from('calendar_events')
        .select('*')
        .eq('customer_id', customerId)
        .gte('start_time', startDate.toISOString())
        .lte('start_time', endDate.toISOString());

      if (data) {
        return data.map(e => ({
          id: e.id,
          title: e.title,
          type: e.type || 'meeting',
          startTime: new Date(e.start_time),
          endTime: new Date(e.end_time),
          attendees: e.attendees || [],
          location: e.location,
          notes: e.notes,
        }));
      }
    }

    return [];
  }

  private async getActiveRiskSignals(customerId: string): Promise<RiskSignal[]> {
    if (this.supabase) {
      const { data } = await this.supabase
        .from('risk_signals')
        .select('*')
        .eq('customer_id', customerId)
        .eq('status', 'active');

      if (data) {
        return data.map(r => ({
          id: r.id,
          type: r.signal_type,
          severity: r.severity || 'medium',
          description: r.description,
          detectedAt: new Date(r.created_at),
          status: r.status,
        }));
      }
    }

    return [];
  }

  // ============================================
  // Database Mapping Helpers
  // ============================================

  private mapDbToAbsence(data: Record<string, unknown>): CSMAbsence {
    return {
      id: data.id as string,
      userId: data.user_id as string,
      absenceType: data.absence_type as AbsenceType,
      startDate: new Date(data.start_date as string),
      endDate: new Date(data.end_date as string),
      isPartial: data.is_partial as boolean || false,
      partialHours: data.partial_hours as string | undefined,
      preferredBackupUserId: data.preferred_backup_user_id as string | undefined,
      specialInstructions: data.special_instructions as string | undefined,
      status: data.status as AbsenceStatus,
      calendarEventId: data.calendar_event_id as string | undefined,
      createdAt: new Date(data.created_at as string),
      updatedAt: new Date(data.updated_at as string),
    };
  }

  private mapDbToAssignment(data: Record<string, unknown>): CoverageAssignment {
    return {
      id: data.id as string,
      absenceId: data.absence_id as string,
      backupUserId: data.backup_user_id as string,
      assignedByUserId: data.assigned_by_user_id as string | undefined,
      coverageType: data.coverage_type as CoverageType,
      coveredCustomerIds: data.covered_customer_ids as string[] | undefined,
      tier: data.tier as CoverageTier,
      status: data.status as AssignmentStatus,
      acceptedAt: data.accepted_at ? new Date(data.accepted_at as string) : undefined,
      declinedReason: data.declined_reason as string | undefined,
      notificationsReceived: data.notifications_received as number || 0,
      actionsTaken: data.actions_taken as number || 0,
      createdAt: new Date(data.created_at as string),
    };
  }

  private mapDbToBrief(data: Record<string, unknown>): CoverageBrief {
    return {
      id: data.id as string,
      coverageAssignmentId: data.coverage_assignment_id as string,
      customerId: data.customer_id as string,
      briefContent: data.brief_content as CoverageBriefContent,
      generatedAt: new Date(data.generated_at as string),
      viewedAt: data.viewed_at ? new Date(data.viewed_at as string) : undefined,
      viewedBy: data.viewed_by as string | undefined,
      notesAdded: data.notes_added as string | undefined,
      actionsTaken: (data.actions_taken as unknown[]) as CoverageBrief['actionsTaken'] || [],
    };
  }

  private mapDbToActivity(data: Record<string, unknown>): CoverageActivity {
    return {
      id: data.id as string,
      coverageAssignmentId: data.coverage_assignment_id as string,
      customerId: data.customer_id as string | undefined,
      backupUserId: data.backup_user_id as string,
      originalCsmId: data.original_csm_id as string,
      activityType: data.activity_type as CoverageActivityType,
      description: data.description as string | undefined,
      outcome: data.outcome as string | undefined,
      relatedEntityType: data.related_entity_type as string | undefined,
      relatedEntityId: data.related_entity_id as string | undefined,
      activityDate: new Date(data.activity_date as string),
    };
  }
}

// ============================================
// Internal Helper Types
// ============================================

interface CustomerInfo {
  id: string;
  name: string;
  arr: number;
  healthScore: number;
}

interface CandidateCSM {
  id: string;
  name: string;
  email: string;
  accountCount: number;
  maxAccounts: number;
  pendingCoverage: number;
  isAvailable: boolean;
}

// Export singleton instance
export const coverageBackupService = new CoverageBackupService();
