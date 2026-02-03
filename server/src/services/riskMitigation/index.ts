/**
 * Risk Mitigation Service (PRD-136)
 *
 * Handles completion detection, status updates, stakeholder notifications,
 * health score recalculation, and post-mitigation monitoring.
 */

import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { v4 as uuidv4 } from 'uuid';
import { config } from '../../config/index.js';
import { recalculateHealthScore } from '../usage/health-score.js';
import type {
  RiskMitigationCompletion,
  CompleteMitigationRequest,
  CompleteMitigationResponse,
  LogRecurrenceRequest,
  LogRecurrenceResponse,
  ResolvedMitigationFilters,
  ResolvedMitigationListResponse,
  GeneratedStatusUpdate,
  RiskMitigationMetrics,
  CustomerMitigationHistory,
  MitigationTimelineEvent,
  HealthScoreUpdate,
  StakeholderNotification,
  MitigationMonitoring,
  MonitoringCheckpoint,
  RiskType,
  MitigationOutcome,
  STABILITY_PERIODS,
  NOTIFICATION_CHANNELS_BY_SEVERITY,
  NotificationChannel,
} from '../../../types/riskMitigation.js';

// ============================================
// DATABASE CLIENT
// ============================================

let supabase: SupabaseClient | null = null;
if (config.supabaseUrl && config.supabaseServiceKey) {
  supabase = createClient(config.supabaseUrl, config.supabaseServiceKey);
}

// In-memory store for demo mode
const mitigationStore = new Map<string, RiskMitigationCompletion>();
const statusUpdateStore = new Map<string, GeneratedStatusUpdate>();
const timelineStore = new Map<string, MitigationTimelineEvent[]>();

// ============================================
// CORE SERVICE CLASS
// ============================================

export class RiskMitigationService {
  /**
   * Complete a risk mitigation and trigger all downstream actions
   */
  async completeMitigation(
    userId: string,
    request: CompleteMitigationRequest
  ): Promise<CompleteMitigationResponse> {
    const mitigationId = uuidv4();
    const now = new Date();

    // 1. Get customer information
    const customer = await this.getCustomerInfo(request.customerId);

    // 2. Determine stakeholders to notify
    const stakeholders = request.notifyStakeholders !== false
      ? await this.getStakeholdersToNotify(request.customerId, request.stakeholderIds)
      : [];

    // 3. Calculate health score update
    const healthUpdate = await this.recalculateHealthAfterMitigation(
      request.customerId,
      request.riskId,
      request.riskType
    );

    // 4. Set up post-mitigation monitoring
    const monitoring = this.createMonitoringPlan(request.riskType, now);

    // 5. Send notifications to stakeholders
    const notifications = await this.sendStakeholderNotifications(
      stakeholders,
      customer.name,
      request.resolution.summary,
      request.outcome,
      healthUpdate
    );

    // 6. Create the mitigation completion record
    const mitigation: RiskMitigationCompletion = {
      id: mitigationId,
      riskId: request.riskId,
      customerId: request.customerId,
      customerName: customer.name,
      riskType: request.riskType,
      originalSeverity: await this.getRiskSeverity(request.riskId, request.riskType),
      outcome: request.outcome,
      resolution: {
        summary: request.resolution.summary,
        actionsTaken: request.resolution.actionsTaken,
        lessonsLearned: request.resolution.lessonsLearned || [],
        nextSteps: request.resolution.nextSteps || [],
      },
      notifications: {
        recipients: notifications,
        sentAt: now,
        totalSent: notifications.length,
        totalDelivered: notifications.filter(n => n.status === 'delivered' || n.status === 'sent').length,
      },
      healthUpdate,
      monitoring,
      completedAt: now,
      completedBy: userId,
      createdAt: now,
      updatedAt: now,
    };

    // 7. Save to database
    await this.saveMitigation(mitigation);

    // 8. Update the original risk record
    await this.updateRiskRecord(request.riskId, request.riskType, request.outcome);

    // 9. Log timeline event
    await this.logTimelineEvent({
      id: uuidv4(),
      type: 'mitigation_completed',
      mitigationId,
      customerId: request.customerId,
      timestamp: now,
      title: 'Risk Mitigation Completed',
      description: `${request.riskType.replace('_', ' ')} resolved with outcome: ${request.outcome}`,
      metadata: {
        outcome: request.outcome,
        healthDelta: healthUpdate.newScore - healthUpdate.previousScore,
      },
    });

    // 10. Generate status update document
    await this.generateStatusUpdate(mitigation);

    return {
      success: true,
      mitigation,
      healthUpdate,
      notificationsSent: notifications.length,
    };
  }

  /**
   * Get resolved mitigations for a customer
   */
  async getResolvedMitigations(
    filters: ResolvedMitigationFilters,
    page: number = 1,
    pageSize: number = 20
  ): Promise<ResolvedMitigationListResponse> {
    if (!supabase) {
      // Demo mode: filter in-memory store
      let mitigations = Array.from(mitigationStore.values());

      if (filters.customerId) {
        mitigations = mitigations.filter(m => m.customerId === filters.customerId);
      }
      if (filters.riskType) {
        const types = Array.isArray(filters.riskType) ? filters.riskType : [filters.riskType];
        mitigations = mitigations.filter(m => types.includes(m.riskType));
      }
      if (filters.outcome) {
        const outcomes = Array.isArray(filters.outcome) ? filters.outcome : [filters.outcome];
        mitigations = mitigations.filter(m => outcomes.includes(m.outcome));
      }
      if (filters.monitoringActive) {
        const now = new Date();
        mitigations = mitigations.filter(m => m.monitoring.monitoringEndDate > now);
      }
      if (filters.hasRecurrence) {
        mitigations = mitigations.filter(m => m.monitoring.recurrenceDetected);
      }

      // Sort by completedAt descending
      mitigations.sort((a, b) => b.completedAt.getTime() - a.completedAt.getTime());

      const total = mitigations.length;
      const offset = (page - 1) * pageSize;
      const paginatedMitigations = mitigations.slice(offset, offset + pageSize);

      return {
        mitigations: paginatedMitigations,
        total,
        page,
        pageSize,
        hasMore: offset + paginatedMitigations.length < total,
      };
    }

    // Real database query
    let query = supabase
      .from('risk_mitigations')
      .select('*', { count: 'exact' });

    if (filters.customerId) {
      query = query.eq('customer_id', filters.customerId);
    }
    if (filters.riskType) {
      const types = Array.isArray(filters.riskType) ? filters.riskType : [filters.riskType];
      query = query.in('risk_type', types);
    }
    if (filters.outcome) {
      const outcomes = Array.isArray(filters.outcome) ? filters.outcome : [filters.outcome];
      query = query.in('outcome', outcomes);
    }
    if (filters.completedAfter) {
      query = query.gte('completed_at', filters.completedAfter.toISOString());
    }
    if (filters.completedBefore) {
      query = query.lte('completed_at', filters.completedBefore.toISOString());
    }
    if (filters.monitoringActive) {
      query = query.gt('monitoring_end_date', new Date().toISOString());
    }
    if (filters.hasRecurrence) {
      query = query.eq('recurrence_detected', true);
    }

    const offset = (page - 1) * pageSize;
    query = query
      .order('completed_at', { ascending: false })
      .range(offset, offset + pageSize - 1);

    const { data, count, error } = await query;

    if (error) {
      throw new Error(`Failed to fetch mitigations: ${error.message}`);
    }

    const mitigations = (data || []).map(this.mapDbToMitigation);
    const total = count || 0;

    return {
      mitigations,
      total,
      page,
      pageSize,
      hasMore: offset + mitigations.length < total,
    };
  }

  /**
   * Get a single mitigation by ID
   */
  async getMitigation(mitigationId: string): Promise<RiskMitigationCompletion | null> {
    if (!supabase) {
      return mitigationStore.get(mitigationId) || null;
    }

    const { data, error } = await supabase
      .from('risk_mitigations')
      .select('*')
      .eq('id', mitigationId)
      .single();

    if (error || !data) {
      return null;
    }

    return this.mapDbToMitigation(data);
  }

  /**
   * Log a recurrence of a previously resolved risk
   */
  async logRecurrence(
    userId: string,
    request: LogRecurrenceRequest
  ): Promise<LogRecurrenceResponse> {
    const mitigation = await this.getMitigation(request.mitigationId);
    if (!mitigation) {
      throw new Error('Mitigation not found');
    }

    const now = new Date();

    // Update the mitigation record
    mitigation.monitoring.recurrenceDetected = true;
    mitigation.monitoring.recurrenceDate = now;
    mitigation.monitoring.recurrenceDetails = request.details;
    mitigation.updatedAt = now;

    // Save update
    await this.saveMitigation(mitigation);

    // Log timeline event
    await this.logTimelineEvent({
      id: uuidv4(),
      type: 'recurrence_detected',
      mitigationId: mitigation.id,
      customerId: mitigation.customerId,
      timestamp: now,
      title: 'Risk Recurrence Detected',
      description: request.details,
      metadata: {
        severity: request.severity,
        originalRiskType: mitigation.riskType,
      },
    });

    // Create escalation if requested
    let escalationId: string | undefined;
    let escalationCreated = false;

    if (request.shouldEscalate) {
      escalationId = uuidv4();
      escalationCreated = true;
      // In a real implementation, we would call the escalation service here
      console.log(`[RiskMitigation] Creating escalation ${escalationId} for recurrence`);
    }

    return {
      success: true,
      mitigation,
      escalationCreated,
      escalationId,
    };
  }

  /**
   * Get metrics for the risk mitigation dashboard
   */
  async getMetrics(): Promise<RiskMitigationMetrics> {
    const now = new Date();
    const last7Days = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const last30Days = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    const last90Days = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);

    if (!supabase) {
      // Demo mode metrics
      const mitigations = Array.from(mitigationStore.values());
      return this.calculateMetrics(mitigations, now, last7Days, last30Days, last90Days);
    }

    const { data, error } = await supabase
      .from('risk_mitigations')
      .select('*')
      .gte('completed_at', last90Days.toISOString());

    if (error) {
      throw new Error(`Failed to fetch metrics: ${error.message}`);
    }

    const mitigations = (data || []).map(this.mapDbToMitigation);
    return this.calculateMetrics(mitigations, now, last7Days, last30Days, last90Days);
  }

  /**
   * Get mitigation history for a specific customer
   */
  async getCustomerHistory(customerId: string): Promise<CustomerMitigationHistory> {
    const { mitigations } = await this.getResolvedMitigations(
      { customerId },
      1,
      100
    );

    const customer = await this.getCustomerInfo(customerId);

    const totalMitigations = mitigations.length;
    const successfulMitigations = mitigations.filter(m => m.outcome === 'resolved').length;
    const successRate = totalMitigations > 0 ? (successfulMitigations / totalMitigations) * 100 : 0;

    // Calculate average resolution time (would need created_at from original risk in real impl)
    const avgResolutionTime = 48; // Placeholder: 48 hours average

    return {
      customerId,
      customerName: customer.name,
      totalMitigations,
      successRate: Math.round(successRate),
      averageResolutionTime: avgResolutionTime,
      recentMitigations: mitigations.slice(0, 5).map(m => ({
        id: m.id,
        riskType: m.riskType,
        outcome: m.outcome,
        completedAt: m.completedAt,
        healthDelta: m.healthUpdate.newScore - m.healthUpdate.previousScore,
      })),
    };
  }

  /**
   * Complete a monitoring checkpoint
   */
  async completeCheckpoint(
    mitigationId: string,
    checkpointId: string,
    healthScore: number,
    notes?: string
  ): Promise<RiskMitigationCompletion> {
    const mitigation = await this.getMitigation(mitigationId);
    if (!mitigation) {
      throw new Error('Mitigation not found');
    }

    const checkpoint = mitigation.monitoring.checkpoints.find(c => c.id === checkpointId);
    if (!checkpoint) {
      throw new Error('Checkpoint not found');
    }

    checkpoint.status = 'completed';
    checkpoint.completedAt = new Date();
    checkpoint.healthScore = healthScore;
    checkpoint.notes = notes;
    mitigation.updatedAt = new Date();

    await this.saveMitigation(mitigation);

    return mitigation;
  }

  // ============================================
  // PRIVATE HELPER METHODS
  // ============================================

  private async getCustomerInfo(customerId: string): Promise<{ id: string; name: string; arr: number }> {
    if (!supabase) {
      // Demo mode
      return {
        id: customerId,
        name: 'Meridian Capital Partners',
        arr: 250000,
      };
    }

    const { data, error } = await supabase
      .from('customers')
      .select('id, name, arr')
      .eq('id', customerId)
      .single();

    if (error || !data) {
      throw new Error(`Customer not found: ${customerId}`);
    }

    return data;
  }

  private async getStakeholdersToNotify(
    customerId: string,
    specificIds?: string[]
  ): Promise<Array<{ id: string; name: string; email: string; role: string }>> {
    if (!supabase) {
      // Demo mode stakeholders
      return [
        { id: 'csm-1', name: 'Jessica Martinez', email: 'jmartinez@company.com', role: 'CSM Manager' },
        { id: 'exec-1', name: 'David Chen', email: 'dchen@company.com', role: 'Executive Sponsor' },
      ];
    }

    let query = supabase
      .from('stakeholders')
      .select('id, name, email, role')
      .eq('customer_id', customerId);

    if (specificIds && specificIds.length > 0) {
      query = query.in('id', specificIds);
    } else {
      // Default: notify primary stakeholders and CSM
      query = query.or('is_primary.eq.true,role.ilike.%csm%,role.ilike.%manager%');
    }

    const { data, error } = await query;

    if (error) {
      console.error('[RiskMitigation] Error fetching stakeholders:', error);
      return [];
    }

    return data || [];
  }

  private async recalculateHealthAfterMitigation(
    customerId: string,
    riskId: string,
    riskType: RiskType
  ): Promise<HealthScoreUpdate> {
    // Get previous health score
    const previousResult = await this.getCustomerHealthScore(customerId);
    const previousScore = previousResult?.score || 70;
    const previousComponents = previousResult?.components;

    // Recalculate health score with risk signal removed
    const newResult = await recalculateHealthScore(customerId, 'risk_mitigation_complete');

    const newScore = newResult?.score || previousScore + 5;
    const signalRemoved = true;

    return {
      previousScore,
      newScore,
      signalRemoved,
      changeReason: `Risk mitigation completed (${riskType.replace('_', ' ')})`,
      components: newResult?.components || previousComponents,
    };
  }

  private async getCustomerHealthScore(
    customerId: string
  ): Promise<{ score: number; components?: Record<string, number> } | null> {
    if (!supabase) {
      return { score: 72, components: { usage: 75, engagement: 70, risk: 65, business: 80 } };
    }

    const { data, error } = await supabase
      .from('customers')
      .select('health_score')
      .eq('id', customerId)
      .single();

    if (error || !data) {
      return null;
    }

    return { score: data.health_score || 70 };
  }

  private createMonitoringPlan(riskType: RiskType, startDate: Date): MitigationMonitoring {
    const stabilityPeriod = STABILITY_PERIODS[riskType];
    const monitoringEndDate = new Date(startDate.getTime() + stabilityPeriod * 24 * 60 * 60 * 1000);

    // Create checkpoints at regular intervals
    const checkpoints: MonitoringCheckpoint[] = [];
    const checkpointInterval = Math.ceil(stabilityPeriod / 3);

    for (let i = 1; i <= 3; i++) {
      const scheduledAt = new Date(startDate.getTime() + i * checkpointInterval * 24 * 60 * 60 * 1000);
      if (scheduledAt <= monitoringEndDate) {
        checkpoints.push({
          id: uuidv4(),
          scheduledAt,
          status: 'pending',
        });
      }
    }

    return {
      stabilityPeriod,
      monitoringEndDate,
      recurrenceDetected: false,
      checkpoints,
    };
  }

  private async sendStakeholderNotifications(
    stakeholders: Array<{ id: string; name: string; email: string; role: string }>,
    customerName: string,
    resolutionSummary: string,
    outcome: MitigationOutcome,
    healthUpdate: HealthScoreUpdate
  ): Promise<StakeholderNotification[]> {
    const notifications: StakeholderNotification[] = [];
    const now = new Date();

    for (const stakeholder of stakeholders) {
      // Determine channels based on role (simplified logic)
      const channels: NotificationChannel[] = stakeholder.role.toLowerCase().includes('executive')
        ? ['email', 'slack', 'in_app']
        : ['email', 'in_app'];

      for (const channel of channels) {
        // In a real implementation, we would actually send the notification here
        console.log(`[RiskMitigation] Sending ${channel} notification to ${stakeholder.name}`);

        notifications.push({
          stakeholderId: stakeholder.id,
          stakeholderName: stakeholder.name,
          stakeholderRole: stakeholder.role,
          channel,
          sentAt: now,
          status: 'sent', // Would be 'delivered' after async confirmation
        });
      }
    }

    return notifications;
  }

  private async getRiskSeverity(
    riskId: string,
    riskType: RiskType
  ): Promise<'critical' | 'high' | 'medium' | 'low'> {
    // In a real implementation, we would look up the original risk record
    // For now, return a default based on risk type
    switch (riskType) {
      case 'escalation':
        return 'high';
      case 'save_play':
        return 'critical';
      default:
        return 'medium';
    }
  }

  private async saveMitigation(mitigation: RiskMitigationCompletion): Promise<void> {
    if (!supabase) {
      mitigationStore.set(mitigation.id, mitigation);
      return;
    }

    const dbRecord = this.mapMitigationToDb(mitigation);
    const { error } = await supabase
      .from('risk_mitigations')
      .upsert(dbRecord);

    if (error) {
      throw new Error(`Failed to save mitigation: ${error.message}`);
    }
  }

  private async updateRiskRecord(
    riskId: string,
    riskType: RiskType,
    outcome: MitigationOutcome
  ): Promise<void> {
    if (!supabase) {
      return;
    }

    const tableName = riskType === 'save_play' ? 'save_plays' :
                      riskType === 'escalation' ? 'escalations' : 'risk_signals';

    const { error } = await supabase
      .from(tableName)
      .update({
        status: outcome === 'resolved' ? 'resolved' : 'closed',
        resolved_at: new Date().toISOString(),
      })
      .eq('id', riskId);

    if (error) {
      console.error(`[RiskMitigation] Error updating ${tableName}:`, error);
    }
  }

  private async generateStatusUpdate(
    mitigation: RiskMitigationCompletion
  ): Promise<GeneratedStatusUpdate> {
    const statusUpdate: GeneratedStatusUpdate = {
      id: uuidv4(),
      mitigationId: mitigation.id,
      customerId: mitigation.customerId,
      customerName: mitigation.customerName,
      title: `Risk Mitigation Complete: ${mitigation.customerName}`,
      summary: mitigation.resolution.summary,
      sections: {
        resolution: mitigation.resolution.summary,
        actionsTaken: mitigation.resolution.actionsTaken.join('\n- '),
        outcome: this.formatOutcome(mitigation.outcome),
        healthImpact: `Health score ${mitigation.healthUpdate.previousScore} -> ${mitigation.healthUpdate.newScore} (${mitigation.healthUpdate.newScore - mitigation.healthUpdate.previousScore >= 0 ? '+' : ''}${mitigation.healthUpdate.newScore - mitigation.healthUpdate.previousScore})`,
        nextSteps: mitigation.resolution.nextSteps.length > 0
          ? mitigation.resolution.nextSteps.join('\n- ')
          : undefined,
      },
      recipients: mitigation.notifications.recipients.map(r => ({
        name: r.stakeholderName,
        email: '', // Would get from stakeholder lookup
        role: r.stakeholderRole,
      })),
      createdAt: new Date(),
    };

    statusUpdateStore.set(statusUpdate.id, statusUpdate);

    return statusUpdate;
  }

  private async logTimelineEvent(event: MitigationTimelineEvent): Promise<void> {
    const events = timelineStore.get(event.customerId) || [];
    events.unshift(event);
    timelineStore.set(event.customerId, events.slice(0, 100)); // Keep last 100 events

    if (supabase) {
      await supabase.from('activity_log').insert({
        id: event.id,
        customer_id: event.customerId,
        action: event.type,
        entity_type: 'risk_mitigation',
        entity_id: event.mitigationId,
        new_values: {
          title: event.title,
          description: event.description,
          ...event.metadata,
        },
        created_at: event.timestamp.toISOString(),
      });
    }
  }

  private formatOutcome(outcome: MitigationOutcome): string {
    switch (outcome) {
      case 'resolved':
        return 'Fully Resolved - All risk factors addressed';
      case 'partially_resolved':
        return 'Partially Resolved - Some factors remain, monitoring in place';
      case 'unresolved':
        return 'Unresolved - Mitigation unsuccessful, alternative action required';
    }
  }

  private calculateMetrics(
    mitigations: RiskMitigationCompletion[],
    now: Date,
    last7Days: Date,
    last30Days: Date,
    last90Days: Date
  ): RiskMitigationMetrics {
    const inLast7 = mitigations.filter(m => m.completedAt >= last7Days);
    const inLast30 = mitigations.filter(m => m.completedAt >= last30Days);
    const inLast90 = mitigations.filter(m => m.completedAt >= last90Days);

    const byOutcome = {
      resolved: mitigations.filter(m => m.outcome === 'resolved').length,
      partiallyResolved: mitigations.filter(m => m.outcome === 'partially_resolved').length,
      unresolved: mitigations.filter(m => m.outcome === 'unresolved').length,
    };

    const byRiskType = {
      savePlay: mitigations.filter(m => m.riskType === 'save_play').length,
      escalation: mitigations.filter(m => m.riskType === 'escalation').length,
      riskSignal: mitigations.filter(m => m.riskType === 'risk_signal').length,
    };

    // Average health improvement
    const healthImprovements = mitigations
      .map(m => m.healthUpdate.newScore - m.healthUpdate.previousScore)
      .filter(d => d > 0);
    const avgImprovement = healthImprovements.length > 0
      ? healthImprovements.reduce((a, b) => a + b, 0) / healthImprovements.length
      : 0;

    // Active monitoring count
    const activeMonitoring = mitigations.filter(m => m.monitoring.monitoringEndDate > now).length;

    // Recurrence rate
    const recurrenceCount = mitigations.filter(m => m.monitoring.recurrenceDetected).length;
    const recurrenceRate = mitigations.length > 0 ? (recurrenceCount / mitigations.length) * 100 : 0;

    return {
      totalResolved: {
        last7Days: inLast7.length,
        last30Days: inLast30.length,
        last90Days: inLast90.length,
      },
      byOutcome,
      byRiskType,
      averageTimeToResolution: {
        overall: 48, // Placeholder
        byType: {
          save_play: 72,
          escalation: 36,
          risk_signal: 48,
        },
      },
      healthScoreImpact: {
        avgImprovement: Math.round(avgImprovement * 10) / 10,
        totalCustomersImproved: healthImprovements.length,
      },
      activeMonitoring,
      recurrenceRate: Math.round(recurrenceRate * 10) / 10,
    };
  }

  private mapDbToMitigation(dbRecord: any): RiskMitigationCompletion {
    return {
      id: dbRecord.id,
      riskId: dbRecord.risk_id,
      customerId: dbRecord.customer_id,
      customerName: dbRecord.customer_name,
      riskType: dbRecord.risk_type,
      originalSeverity: dbRecord.original_severity,
      outcome: dbRecord.outcome,
      resolution: dbRecord.resolution,
      notifications: dbRecord.notifications,
      healthUpdate: dbRecord.health_update,
      monitoring: {
        ...dbRecord.monitoring,
        monitoringEndDate: new Date(dbRecord.monitoring_end_date),
      },
      completedAt: new Date(dbRecord.completed_at),
      completedBy: dbRecord.completed_by,
      createdAt: new Date(dbRecord.created_at),
      updatedAt: new Date(dbRecord.updated_at),
    };
  }

  private mapMitigationToDb(mitigation: RiskMitigationCompletion): Record<string, unknown> {
    return {
      id: mitigation.id,
      risk_id: mitigation.riskId,
      customer_id: mitigation.customerId,
      customer_name: mitigation.customerName,
      risk_type: mitigation.riskType,
      original_severity: mitigation.originalSeverity,
      outcome: mitigation.outcome,
      resolution: mitigation.resolution,
      notifications: mitigation.notifications,
      health_update: mitigation.healthUpdate,
      monitoring: mitigation.monitoring,
      monitoring_end_date: mitigation.monitoring.monitoringEndDate.toISOString(),
      recurrence_detected: mitigation.monitoring.recurrenceDetected,
      completed_at: mitigation.completedAt.toISOString(),
      completed_by: mitigation.completedBy,
      created_at: mitigation.createdAt.toISOString(),
      updated_at: mitigation.updatedAt.toISOString(),
    };
  }
}

// Export singleton instance
export const riskMitigationService = new RiskMitigationService();
