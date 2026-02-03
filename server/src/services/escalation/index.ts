/**
 * PRD-121: Escalation Service
 *
 * Handles escalation detection, classification, and management.
 * Automatically triggers war room creation when escalations are logged.
 */

import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { config } from '../../config/index.js';
import { warRoomService, WarRoom } from '../warRoom/index.js';
import type {
  Escalation,
  EscalationSeverity,
  EscalationStatus,
  EscalationCategory,
  EscalationTrigger,
  TimelineEvent,
  CustomerContact,
  PreviousEscalation,
  CreateEscalationRequest,
  CreateEscalationResponse,
  UpdateEscalationStatusRequest,
  AddStatusUpdateRequest,
  ResolveEscalationRequest,
  EscalationFilters,
  EscalationListResponse,
} from '../../../types/escalation.js';

// ============================================
// Types
// ============================================

interface CustomerData {
  id: string;
  name: string;
  arr?: number;
  health_score?: number;
  segment?: string;
  primary_contact?: {
    name: string;
    email?: string;
    role?: string;
  };
}

interface RiskSignal {
  severity: 'low' | 'medium' | 'high' | 'critical';
  type: string;
  description: string;
}

// ============================================
// Escalation Service
// ============================================

export class EscalationService {
  private supabase: SupabaseClient | null = null;

  constructor() {
    if (config.supabaseUrl && config.supabaseServiceKey) {
      this.supabase = createClient(config.supabaseUrl, config.supabaseServiceKey);
    }
  }

  // ============================================
  // Escalation Creation
  // ============================================

  /**
   * Create a new escalation and automatically set up war room
   */
  async createEscalation(
    userId: string,
    request: CreateEscalationRequest
  ): Promise<CreateEscalationResponse> {
    const startTime = Date.now();
    console.log(`[Escalation] Creating escalation for customer ${request.customerId}`);

    // 1. Fetch customer data
    const customer = await this.getCustomerData(request.customerId);
    if (!customer) {
      throw new Error(`Customer not found: ${request.customerId}`);
    }

    // 2. Check for previous escalations
    const previousEscalations = await this.getPreviousEscalations(request.customerId);

    // 3. Generate recommended resolution based on category and history
    const recommendedResolution = this.generateRecommendedResolution(
      request.category,
      request.severity,
      previousEscalations
    );

    // 4. Create the escalation record
    const escalation: Escalation = {
      id: this.generateId(),
      customerId: request.customerId,
      customerName: customer.name,
      customerARR: customer.arr,
      customerHealthScore: customer.health_score,
      customerSegment: customer.segment,
      severity: request.severity,
      status: 'active',
      category: request.category,
      trigger: request.trigger || 'manual',
      title: request.title,
      description: request.description,
      impact: request.impact,
      customerContacts: request.customerContacts || this.extractCustomerContacts(customer),
      timeline: [
        {
          id: this.generateId(),
          timestamp: new Date(),
          type: 'created',
          title: 'Escalation Created',
          description: `${request.severity} escalation created by ${userId}`,
          userId,
        },
      ],
      previousEscalations,
      recommendedResolution,
      createdAt: new Date(),
      resolvedAt: null,
      closedAt: null,
      createdBy: userId,
      ownerId: userId,
    };

    // 5. Save escalation to database
    await this.saveEscalation(escalation);
    console.log(`[Escalation] Escalation saved: ${escalation.id}`);

    // 6. Create war room automatically
    const { warRoom } = await warRoomService.createWarRoom({
      escalation,
      userId,
    });
    console.log(`[Escalation] War room created: ${warRoom.id}`);

    // 7. Update customer health score if critical
    if (request.severity === 'P1') {
      await this.updateCustomerHealthOnEscalation(request.customerId);
    }

    const duration = Date.now() - startTime;
    console.log(`[Escalation] Complete escalation + war room created in ${duration}ms`);

    return { escalation, warRoom };
  }

  /**
   * Detect escalation from a support ticket
   */
  async detectFromSupportTicket(
    userId: string,
    ticket: {
      id: string;
      customerId: string;
      subject: string;
      description: string;
      priority: 'low' | 'medium' | 'high' | 'urgent';
      category?: string;
    }
  ): Promise<CreateEscalationResponse | null> {
    // Only escalate high/urgent priority tickets
    if (ticket.priority !== 'high' && ticket.priority !== 'urgent') {
      return null;
    }

    const severity: EscalationSeverity =
      ticket.priority === 'urgent' ? 'P1' : 'P2';

    return this.createEscalation(userId, {
      customerId: ticket.customerId,
      severity,
      category: this.mapTicketCategoryToEscalationCategory(ticket.category),
      title: `Support Escalation: ${ticket.subject}`,
      description: ticket.description,
      impact: 'Determined by support ticket priority',
      trigger: 'support_ticket',
    });
  }

  /**
   * Detect escalation from a critical risk signal
   */
  async detectFromRiskSignal(
    userId: string,
    customerId: string,
    signal: RiskSignal
  ): Promise<CreateEscalationResponse | null> {
    // Only escalate critical risk signals
    if (signal.severity !== 'critical') {
      return null;
    }

    return this.createEscalation(userId, {
      customerId,
      severity: 'P1',
      category: this.mapRiskTypeToCategory(signal.type),
      title: `Critical Risk: ${signal.type}`,
      description: signal.description,
      impact: 'Critical risk signal detected - immediate attention required',
      trigger: 'critical_risk_signal',
    });
  }

  // ============================================
  // Escalation Management
  // ============================================

  /**
   * Get an escalation by ID
   */
  async getEscalation(escalationId: string): Promise<Escalation | null> {
    if (!this.supabase) return null;

    const { data, error } = await this.supabase
      .from('escalations')
      .select('*')
      .eq('id', escalationId)
      .single();

    if (error || !data) return null;

    return this.mapDatabaseToEscalation(data);
  }

  /**
   * Get escalation with its war room
   */
  async getEscalationWithWarRoom(escalationId: string): Promise<{
    escalation: Escalation;
    warRoom: WarRoom | null;
  } | null> {
    const escalation = await this.getEscalation(escalationId);
    if (!escalation) return null;

    const warRoom = await warRoomService.getWarRoomByEscalation(escalationId);

    return { escalation, warRoom };
  }

  /**
   * List escalations with filters
   */
  async listEscalations(
    filters: EscalationFilters = {},
    page: number = 1,
    pageSize: number = 20
  ): Promise<EscalationListResponse> {
    if (!this.supabase) {
      return { escalations: [], total: 0, page, pageSize };
    }

    let query = this.supabase
      .from('escalations')
      .select('*', { count: 'exact' });

    // Apply filters
    if (filters.status) {
      if (Array.isArray(filters.status)) {
        query = query.in('status', filters.status);
      } else {
        query = query.eq('status', filters.status);
      }
    }

    if (filters.severity) {
      if (Array.isArray(filters.severity)) {
        query = query.in('severity', filters.severity);
      } else {
        query = query.eq('severity', filters.severity);
      }
    }

    if (filters.category) {
      query = query.eq('category', filters.category);
    }

    if (filters.customerId) {
      query = query.eq('customer_id', filters.customerId);
    }

    if (filters.ownerId) {
      query = query.eq('owner_id', filters.ownerId);
    }

    if (filters.createdAfter) {
      query = query.gte('created_at', filters.createdAfter.toISOString());
    }

    if (filters.createdBefore) {
      query = query.lte('created_at', filters.createdBefore.toISOString());
    }

    // Pagination
    const offset = (page - 1) * pageSize;
    query = query
      .order('created_at', { ascending: false })
      .range(offset, offset + pageSize - 1);

    const { data, error, count } = await query;

    if (error) {
      console.error('[Escalation] List error:', error);
      return { escalations: [], total: 0, page, pageSize };
    }

    return {
      escalations: (data || []).map(this.mapDatabaseToEscalation),
      total: count || 0,
      page,
      pageSize,
    };
  }

  /**
   * Get active escalations for dashboard
   */
  async getActiveEscalations(): Promise<Escalation[]> {
    const result = await this.listEscalations({
      status: ['active', 'post_mortem'],
    });
    return result.escalations;
  }

  /**
   * Update escalation status
   */
  async updateStatus(
    userId: string,
    escalationId: string,
    request: UpdateEscalationStatusRequest
  ): Promise<Escalation> {
    const escalation = await this.getEscalation(escalationId);
    if (!escalation) {
      throw new Error('Escalation not found');
    }

    const previousStatus = escalation.status;
    escalation.status = request.status;

    // Add timeline event
    escalation.timeline.push({
      id: this.generateId(),
      timestamp: new Date(),
      type: 'status_change',
      title: `Status changed: ${previousStatus} → ${request.status}`,
      description: request.summary,
      userId,
    });

    // Set resolved/closed timestamps
    if (request.status === 'resolved') {
      escalation.resolvedAt = new Date();
    } else if (request.status === 'closed') {
      escalation.closedAt = new Date();
    }

    await this.saveEscalation(escalation);

    return escalation;
  }

  /**
   * Add a status update to an escalation
   */
  async addStatusUpdate(
    userId: string,
    escalationId: string,
    request: AddStatusUpdateRequest
  ): Promise<void> {
    const escalation = await this.getEscalation(escalationId);
    if (!escalation) {
      throw new Error('Escalation not found');
    }

    // Add to escalation timeline
    escalation.timeline.push({
      id: this.generateId(),
      timestamp: new Date(),
      type: 'update',
      title: 'Status Update',
      description: request.summary,
      userId,
      metadata: {
        progress: request.progress,
        blockers: request.blockers,
        nextActions: request.nextActions,
      },
    });

    await this.saveEscalation(escalation);

    // Also add to war room
    const warRoom = await warRoomService.getWarRoomByEscalation(escalationId);
    if (warRoom) {
      await warRoomService.addStatusUpdate(userId, warRoom.id, {
        status: escalation.status,
        summary: request.summary,
        progress: request.progress,
        blockers: request.blockers,
        nextActions: request.nextActions,
        updatedBy: userId,
      });
    }
  }

  /**
   * Resolve an escalation
   */
  async resolveEscalation(
    userId: string,
    escalationId: string,
    request: ResolveEscalationRequest
  ): Promise<Escalation> {
    const escalation = await this.getEscalation(escalationId);
    if (!escalation) {
      throw new Error('Escalation not found');
    }

    // Update status
    escalation.status = 'resolved';
    escalation.resolvedAt = new Date();

    // Add timeline event
    escalation.timeline.push({
      id: this.generateId(),
      timestamp: new Date(),
      type: 'resolution',
      title: 'Escalation Resolved',
      description: request.summary,
      userId,
      metadata: {
        rootCause: request.rootCause,
        actionsTaken: request.actionsTaken,
        preventionMeasures: request.preventionMeasures,
      },
    });

    await this.saveEscalation(escalation);

    // Also resolve the war room
    const warRoom = await warRoomService.getWarRoomByEscalation(escalationId);
    if (warRoom) {
      await warRoomService.resolveEscalation(userId, warRoom.id, {
        resolvedBy: userId,
        summary: request.summary,
        rootCause: request.rootCause,
        actionsTaken: request.actionsTaken,
        preventionMeasures: request.preventionMeasures,
      });
    }

    return escalation;
  }

  /**
   * Close an escalation and archive the war room
   */
  async closeEscalation(
    userId: string,
    escalationId: string
  ): Promise<void> {
    const escalation = await this.getEscalation(escalationId);
    if (!escalation) {
      throw new Error('Escalation not found');
    }

    if (escalation.status !== 'resolved' && escalation.status !== 'post_mortem') {
      throw new Error('Escalation must be resolved before closing');
    }

    // Update status
    escalation.status = 'closed';
    escalation.closedAt = new Date();

    // Add timeline event
    escalation.timeline.push({
      id: this.generateId(),
      timestamp: new Date(),
      type: 'status_change',
      title: 'Escalation Closed',
      userId,
    });

    await this.saveEscalation(escalation);

    // Archive the war room channel
    const warRoom = await warRoomService.getWarRoomByEscalation(escalationId);
    if (warRoom) {
      await warRoomService.archiveWarRoom(userId, warRoom.id);
    }
  }

  // ============================================
  // Helper Methods
  // ============================================

  /**
   * Get customer data from database
   */
  private async getCustomerData(customerId: string): Promise<CustomerData | null> {
    if (!this.supabase) return null;

    const { data, error } = await this.supabase
      .from('customers')
      .select('id, name, arr, health_score, segment, primary_contact')
      .eq('id', customerId)
      .single();

    if (error || !data) return null;

    return data;
  }

  /**
   * Get previous escalations for a customer
   */
  private async getPreviousEscalations(customerId: string): Promise<PreviousEscalation[]> {
    if (!this.supabase) return [];

    const { data, error } = await this.supabase
      .from('escalations')
      .select('id, title, category, severity, resolved_at, timeline')
      .eq('customer_id', customerId)
      .eq('status', 'closed')
      .order('resolved_at', { ascending: false })
      .limit(5);

    if (error || !data) return [];

    return data.map((e: any) => ({
      id: e.id,
      title: e.title,
      category: e.category,
      severity: e.severity,
      resolvedAt: new Date(e.resolved_at),
      resolution: this.extractResolutionFromTimeline(e.timeline),
    }));
  }

  /**
   * Extract resolution summary from timeline
   */
  private extractResolutionFromTimeline(timeline: TimelineEvent[]): string {
    const resolutionEvent = timeline?.find(e => e.type === 'resolution');
    return resolutionEvent?.description || 'Resolution details not available';
  }

  /**
   * Generate recommended resolution based on category and history
   */
  private generateRecommendedResolution(
    category: EscalationCategory,
    severity: EscalationSeverity,
    previousEscalations: PreviousEscalation[]
  ): string {
    let recommendation = '';

    // Check for similar previous escalations
    const similarPrevious = previousEscalations.find(e => e.category === category);
    if (similarPrevious) {
      recommendation += `Previous similar escalation resolved with: ${similarPrevious.resolution}\n\n`;
    }

    // Add category-specific recommendations
    const categoryRecommendations: Record<EscalationCategory, string> = {
      technical: 'Engage engineering team for root cause analysis. Review recent deployments and system changes.',
      support: 'Escalate to tier 2/3 support. Review support ticket history for patterns.',
      product: 'Involve product team for feature review. Check roadmap for related items.',
      commercial: 'Engage account management. Review contract terms and commercial history.',
      relationship: 'Schedule executive engagement call. Review relationship health indicators.',
    };

    recommendation += categoryRecommendations[category];

    // Add severity-specific actions
    if (severity === 'P1') {
      recommendation += '\n\n**P1 Priority:** All hands on deck. Executive notification required.';
    }

    return recommendation;
  }

  /**
   * Extract customer contacts from customer data
   */
  private extractCustomerContacts(customer: CustomerData): CustomerContact[] {
    const contacts: CustomerContact[] = [];

    if (customer.primary_contact) {
      contacts.push({
        name: customer.primary_contact.name,
        email: customer.primary_contact.email,
        role: customer.primary_contact.role || 'Primary Contact',
        isPrimary: true,
      });
    }

    return contacts;
  }

  /**
   * Update customer health score on P1 escalation
   */
  private async updateCustomerHealthOnEscalation(customerId: string): Promise<void> {
    if (!this.supabase) return;

    // Reduce health score by 10 points on P1 escalation
    const { data: customer } = await this.supabase
      .from('customers')
      .select('health_score')
      .eq('id', customerId)
      .single();

    if (customer) {
      const newScore = Math.max(0, (customer.health_score || 50) - 10);
      await this.supabase
        .from('customers')
        .update({ health_score: newScore })
        .eq('id', customerId);
    }
  }

  /**
   * Map ticket category to escalation category
   */
  private mapTicketCategoryToEscalationCategory(
    ticketCategory?: string
  ): EscalationCategory {
    const mapping: Record<string, EscalationCategory> = {
      bug: 'technical',
      feature: 'product',
      billing: 'commercial',
      account: 'relationship',
    };
    return mapping[ticketCategory?.toLowerCase() || ''] || 'support';
  }

  /**
   * Map risk type to escalation category
   */
  private mapRiskTypeToCategory(riskType: string): EscalationCategory {
    const mapping: Record<string, EscalationCategory> = {
      usage_drop: 'product',
      payment_failure: 'commercial',
      nps_detractor: 'relationship',
      support_volume: 'support',
      outage: 'technical',
    };
    return mapping[riskType.toLowerCase()] || 'technical';
  }

  // ============================================
  // Database Operations
  // ============================================

  /**
   * Save escalation to database
   */
  async saveEscalation(escalation: Escalation): Promise<void> {
    if (!this.supabase) return;

    await this.supabase.from('escalations').upsert({
      id: escalation.id,
      customer_id: escalation.customerId,
      customer_name: escalation.customerName,
      customer_arr: escalation.customerARR,
      customer_health_score: escalation.customerHealthScore,
      customer_segment: escalation.customerSegment,
      severity: escalation.severity,
      status: escalation.status,
      category: escalation.category,
      trigger: escalation.trigger,
      title: escalation.title,
      description: escalation.description,
      impact: escalation.impact,
      customer_contacts: escalation.customerContacts,
      timeline: escalation.timeline,
      previous_escalations: escalation.previousEscalations,
      recommended_resolution: escalation.recommendedResolution,
      created_at: escalation.createdAt.toISOString(),
      resolved_at: escalation.resolvedAt?.toISOString() || null,
      closed_at: escalation.closedAt?.toISOString() || null,
      created_by: escalation.createdBy,
      owner_id: escalation.ownerId,
      owner_name: escalation.ownerName,
    });
  }

  /**
   * Map database record to Escalation type
   */
  private mapDatabaseToEscalation(data: any): Escalation {
    return {
      id: data.id,
      customerId: data.customer_id,
      customerName: data.customer_name,
      customerARR: data.customer_arr,
      customerHealthScore: data.customer_health_score,
      customerSegment: data.customer_segment,
      severity: data.severity,
      status: data.status,
      category: data.category,
      trigger: data.trigger,
      title: data.title,
      description: data.description,
      impact: data.impact,
      customerContacts: data.customer_contacts || [],
      timeline: (data.timeline || []).map((e: any) => ({
        ...e,
        timestamp: new Date(e.timestamp),
      })),
      previousEscalations: data.previous_escalations || [],
      recommendedResolution: data.recommended_resolution,
      createdAt: new Date(data.created_at),
      resolvedAt: data.resolved_at ? new Date(data.resolved_at) : null,
      closedAt: data.closed_at ? new Date(data.closed_at) : null,
      createdBy: data.created_by,
      ownerId: data.owner_id,
      ownerName: data.owner_name,
    };
  }

  // ============================================
  // Utilities
  // ============================================

  private generateId(): string {
    return `esc_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
  }
}

// Singleton instance
export const escalationService = new EscalationService();

// PRD-236: Intelligent Escalation Routing
export { escalationRoutingService, type RoutingDecision, type RoutedMember, type TeamMember } from './routing.js';
export { issueClassifier, type ClassificationResult, type ClassificationInput } from './classifier.js';

// Re-export types
export type {
  Escalation,
  EscalationSeverity,
  EscalationStatus,
  EscalationCategory,
  CreateEscalationRequest,
  CreateEscalationResponse,
  EscalationFilters,
};
