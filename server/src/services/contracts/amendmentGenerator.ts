/**
 * Amendment Generator Service
 * PRD-042: Contract Amendment Request
 *
 * Service for creating, managing, and tracking contract amendments.
 */

import { SupabaseService } from '../supabase.js';
import { generateAmendmentRequestEmail, type AmendmentRequestEmailVariables } from '../../templates/emails/amendment-request.js';
import { generateAmendmentConfirmationEmail, type AmendmentConfirmationEmailVariables } from '../../templates/emails/amendment-confirmation.js';

// ============================================
// Types
// ============================================

export type AmendmentType =
  | 'seat_addition'
  | 'seat_reduction'
  | 'feature_upgrade'
  | 'feature_downgrade'
  | 'term_extension'
  | 'term_modification'
  | 'scope_adjustment'
  | 'pricing_change'
  | 'other';

export type AmendmentStatus =
  | 'draft'
  | 'pending_review'
  | 'pending_customer'
  | 'pending_legal'
  | 'pending_approval'
  | 'approved'
  | 'rejected'
  | 'executed'
  | 'cancelled';

export interface ContractAmendment {
  id: string;
  customer_id: string;
  contract_id?: string;
  amendment_type: AmendmentType;
  description?: string;
  reason?: string;

  // Current terms
  current_seats?: number;
  current_arr: number;
  current_term_end?: string;
  current_features?: string[];

  // Proposed changes
  proposed_seats?: number;
  proposed_arr?: number;
  proposed_term_end?: string;
  proposed_features?: string[];

  // Financial impact
  prorated_cost: number;
  months_remaining: number;
  new_annual_rate: number;
  financial_impact_details?: Record<string, unknown>;

  // Status
  status: AmendmentStatus;
  requires_legal_review: boolean;
  requires_executive_approval: boolean;

  // Communication
  email_sent: boolean;
  email_sent_at?: string;
  email_to?: string[];
  email_cc?: string[];
  email_subject?: string;
  email_body?: string;

  // Timestamps
  created_at: string;
  updated_at: string;
  completed_at?: string;
}

export interface CreateAmendmentInput {
  customerId: string;
  contractId?: string;
  amendmentType: AmendmentType;
  description?: string;
  reason?: string;
  proposedSeats?: number;
  proposedFeatures?: string[];
  proposedTermEnd?: string;
  internalNotes?: string;
  requestedById?: string;
  requestedByName?: string;
}

export interface FinancialImpact {
  customerId: string;
  customerName: string;
  contractId?: string;
  currentSeats: number;
  currentArr: number;
  currentTermEnd: string;
  monthsRemaining: number;
  proposedSeats: number;
  proposedArr: number;
  proratedCost: number;
  newAnnualRate: number;
  annualDifference: number;
  monthlyDifference: number;
  currentPricePerSeat?: number;
  proposedPricePerSeat?: number;
}

export interface AmendmentEmailInput {
  amendmentId: string;
  contactName: string;
  contactEmail: string;
  ccEmails?: string[];
  customMessage?: string;
  includeLegalCc?: boolean;
  includeSalesCc?: boolean;
}

export interface AmendmentFilters {
  customerId?: string;
  contractId?: string;
  status?: AmendmentStatus | AmendmentStatus[];
  amendmentType?: AmendmentType | AmendmentType[];
  csmId?: string;
  fromDate?: string;
  toDate?: string;
  search?: string;
  limit?: number;
  offset?: number;
}

// ============================================
// Constants
// ============================================

const AMENDMENT_TYPE_LABELS: Record<AmendmentType, string> = {
  seat_addition: 'Add Users/Seats',
  seat_reduction: 'Reduce Users/Seats',
  feature_upgrade: 'Feature Upgrade',
  feature_downgrade: 'Feature Downgrade',
  term_extension: 'Term Extension',
  term_modification: 'Term Modification',
  scope_adjustment: 'Scope Adjustment',
  pricing_change: 'Pricing Change',
  other: 'Other',
};

// Default price per seat (used if not available from contract)
const DEFAULT_PRICE_PER_SEAT = 1800;

// ============================================
// Service Class
// ============================================

class AmendmentGeneratorService {
  private db: SupabaseService;

  constructor() {
    this.db = new SupabaseService();
  }

  /**
   * Calculate financial impact of a proposed amendment
   */
  async calculateFinancialImpact(
    customerId: string,
    proposedSeats?: number,
    proposedFeatures?: string[],
    proposedTermEnd?: string
  ): Promise<FinancialImpact> {
    // Get customer data
    const customer = await this.db.getCustomer(customerId);
    if (!customer) {
      throw new Error(`Customer not found: ${customerId}`);
    }

    // Get contract data if available
    const contracts = await this.db.listContracts({ customerId, limit: 1 });
    const contract = contracts.contracts?.[0];

    // Extract current values
    const currentSeats = customer.seats || contract?.parsed_data?.seats || 100;
    const currentArr = customer.arr || contract?.arr || 0;
    const currentTermEnd = customer.renewal_date || contract?.contract_period || this.getDefaultTermEnd();

    // Calculate months remaining
    const termEndDate = new Date(currentTermEnd);
    const today = new Date();
    const monthsRemaining = Math.max(
      0,
      Math.ceil((termEndDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24 * 30))
    );

    // Calculate price per seat
    const currentPricePerSeat = currentSeats > 0 ? currentArr / currentSeats : DEFAULT_PRICE_PER_SEAT;

    // Calculate proposed values
    const finalProposedSeats = proposedSeats ?? currentSeats;
    const proposedPricePerSeat = currentPricePerSeat; // Maintain same price per seat
    const proposedArr = finalProposedSeats * proposedPricePerSeat;

    // Calculate differences
    const annualDifference = proposedArr - currentArr;
    const monthlyDifference = annualDifference / 12;
    const proratedCost = (annualDifference / 12) * monthsRemaining;

    return {
      customerId,
      customerName: customer.name,
      contractId: contract?.id,
      currentSeats,
      currentArr,
      currentTermEnd,
      monthsRemaining,
      proposedSeats: finalProposedSeats,
      proposedArr,
      proratedCost: Math.round(proratedCost * 100) / 100,
      newAnnualRate: Math.round(proposedArr * 100) / 100,
      annualDifference: Math.round(annualDifference * 100) / 100,
      monthlyDifference: Math.round(monthlyDifference * 100) / 100,
      currentPricePerSeat: Math.round(currentPricePerSeat * 100) / 100,
      proposedPricePerSeat: Math.round(proposedPricePerSeat * 100) / 100,
    };
  }

  /**
   * Create a new contract amendment
   */
  async createAmendment(input: CreateAmendmentInput): Promise<ContractAmendment> {
    // Calculate financial impact
    const impact = await this.calculateFinancialImpact(
      input.customerId,
      input.proposedSeats,
      input.proposedFeatures,
      input.proposedTermEnd
    );

    // Determine approval requirements
    const requiresLegalReview = this.determineRequiresLegalReview(input.amendmentType, impact);
    const requiresExecutiveApproval = this.determineRequiresExecutiveApproval(input.amendmentType, impact);

    // Create amendment record
    const amendmentData = {
      customer_id: input.customerId,
      contract_id: input.contractId || impact.contractId,
      amendment_type: input.amendmentType,
      description: input.description || this.generateDescription(input.amendmentType, impact),
      reason: input.reason,

      // Current terms
      current_seats: impact.currentSeats,
      current_arr: impact.currentArr,
      current_term_end: impact.currentTermEnd,

      // Proposed changes
      proposed_seats: impact.proposedSeats,
      proposed_arr: impact.proposedArr,
      proposed_term_end: input.proposedTermEnd,
      proposed_features: input.proposedFeatures ? JSON.stringify(input.proposedFeatures) : null,

      // Financial impact
      prorated_cost: impact.proratedCost,
      months_remaining: impact.monthsRemaining,
      new_annual_rate: impact.newAnnualRate,
      financial_impact_details: JSON.stringify({
        annualDifference: impact.annualDifference,
        monthlyDifference: impact.monthlyDifference,
        currentPricePerSeat: impact.currentPricePerSeat,
        proposedPricePerSeat: impact.proposedPricePerSeat,
      }),

      // Status
      status: 'draft',
      requires_legal_review: requiresLegalReview,
      requires_executive_approval: requiresExecutiveApproval,

      // Ownership
      requested_by: input.requestedById,
      requested_by_name: input.requestedByName,
    };

    const { data, error } = await this.db.supabase
      .from('contract_amendments')
      .insert(amendmentData)
      .select()
      .single();

    if (error) {
      console.error('[AmendmentGenerator] Create error:', error);
      throw new Error(`Failed to create amendment: ${error.message}`);
    }

    // Record history
    await this.recordHistory(data.id, null, 'draft', 'created', {
      createdBy: input.requestedByName || 'System',
    });

    console.log(`[AmendmentGenerator] Created amendment ${data.id} for customer ${input.customerId}`);

    return this.transformAmendment(data);
  }

  /**
   * Get an amendment by ID
   */
  async getAmendment(amendmentId: string): Promise<ContractAmendment | null> {
    const { data, error } = await this.db.supabase
      .from('contract_amendments')
      .select('*, customers(name, primary_contact_email)')
      .eq('id', amendmentId)
      .single();

    if (error || !data) {
      return null;
    }

    return this.transformAmendment(data);
  }

  /**
   * List amendments with filters
   */
  async listAmendments(filters: AmendmentFilters = {}): Promise<{
    amendments: ContractAmendment[];
    total: number;
  }> {
    let query = this.db.supabase
      .from('contract_amendments')
      .select('*, customers(name)', { count: 'exact' });

    if (filters.customerId) {
      query = query.eq('customer_id', filters.customerId);
    }

    if (filters.contractId) {
      query = query.eq('contract_id', filters.contractId);
    }

    if (filters.status) {
      if (Array.isArray(filters.status)) {
        query = query.in('status', filters.status);
      } else {
        query = query.eq('status', filters.status);
      }
    }

    if (filters.amendmentType) {
      if (Array.isArray(filters.amendmentType)) {
        query = query.in('amendment_type', filters.amendmentType);
      } else {
        query = query.eq('amendment_type', filters.amendmentType);
      }
    }

    if (filters.csmId) {
      query = query.eq('csm_id', filters.csmId);
    }

    if (filters.fromDate) {
      query = query.gte('created_at', filters.fromDate);
    }

    if (filters.toDate) {
      query = query.lte('created_at', filters.toDate);
    }

    // Apply pagination
    const limit = filters.limit || 20;
    const offset = filters.offset || 0;
    query = query.range(offset, offset + limit - 1);
    query = query.order('created_at', { ascending: false });

    const { data, error, count } = await query;

    if (error) {
      console.error('[AmendmentGenerator] List error:', error);
      throw new Error(`Failed to list amendments: ${error.message}`);
    }

    return {
      amendments: (data || []).map(a => this.transformAmendment(a)),
      total: count || 0,
    };
  }

  /**
   * Update amendment status
   */
  async updateStatus(
    amendmentId: string,
    newStatus: AmendmentStatus,
    actorId?: string,
    actorName?: string,
    notes?: string
  ): Promise<ContractAmendment> {
    // Get current amendment
    const current = await this.getAmendment(amendmentId);
    if (!current) {
      throw new Error(`Amendment not found: ${amendmentId}`);
    }

    // Validate status transition
    this.validateStatusTransition(current.status, newStatus);

    // Update amendment
    const updateData: Record<string, unknown> = {
      status: newStatus,
      updated_at: new Date().toISOString(),
    };

    // Set completion timestamp if applicable
    if (newStatus === 'executed' || newStatus === 'cancelled' || newStatus === 'rejected') {
      updateData.completed_at = new Date().toISOString();
    }

    // Set approval timestamps
    if (newStatus === 'approved' && current.requires_legal_review && !current.status.includes('legal')) {
      updateData.legal_approved_at = new Date().toISOString();
      updateData.legal_approved_by = actorId;
    }

    const { data, error } = await this.db.supabase
      .from('contract_amendments')
      .update(updateData)
      .eq('id', amendmentId)
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to update amendment status: ${error.message}`);
    }

    // Record history
    await this.recordHistory(amendmentId, current.status, newStatus, 'status_change', {
      actorId,
      actorName,
      notes,
    });

    console.log(`[AmendmentGenerator] Updated amendment ${amendmentId} status: ${current.status} -> ${newStatus}`);

    return this.transformAmendment(data);
  }

  /**
   * Generate amendment request email
   */
  async generateEmail(input: AmendmentEmailInput): Promise<{
    subject: string;
    bodyHtml: string;
    bodyText: string;
    to: string[];
    cc: string[];
  }> {
    // Get amendment
    const amendment = await this.getAmendment(input.amendmentId);
    if (!amendment) {
      throw new Error(`Amendment not found: ${input.amendmentId}`);
    }

    // Get customer
    const customer = await this.db.getCustomer(amendment.customer_id);
    if (!customer) {
      throw new Error(`Customer not found: ${amendment.customer_id}`);
    }

    // Build email variables
    const variables: AmendmentRequestEmailVariables = {
      contactName: input.contactName,
      customerName: customer.name,
      csmName: 'Your CSM', // TODO: Get from user context
      currentSeats: amendment.current_seats,
      currentArr: amendment.current_arr,
      currentTermEnd: amendment.current_term_end || 'N/A',
      amendmentType: amendment.amendment_type,
      amendmentTypeLabel: AMENDMENT_TYPE_LABELS[amendment.amendment_type],
      proposedSeats: amendment.proposed_seats,
      additionalSeats: amendment.proposed_seats && amendment.current_seats
        ? amendment.proposed_seats - amendment.current_seats
        : undefined,
      proratedCost: amendment.prorated_cost,
      monthsRemaining: amendment.months_remaining,
      newAnnualRate: amendment.new_annual_rate,
      customMessage: input.customMessage,
      reason: amendment.reason,
    };

    // Generate email content
    const email = generateAmendmentRequestEmail(variables);

    // Build recipient lists
    const to = [input.contactEmail];
    const cc: string[] = input.ccEmails || [];

    if (input.includeSalesCc && customer.ae_email) {
      cc.push(customer.ae_email);
    }

    if (input.includeLegalCc) {
      cc.push('legal@company.com'); // TODO: Get from config
    }

    return {
      ...email,
      to,
      cc,
    };
  }

  /**
   * Mark amendment email as sent
   */
  async markEmailSent(
    amendmentId: string,
    to: string[],
    cc: string[],
    subject: string,
    body: string
  ): Promise<ContractAmendment> {
    const { data, error } = await this.db.supabase
      .from('contract_amendments')
      .update({
        email_sent: true,
        email_sent_at: new Date().toISOString(),
        email_to: to,
        email_cc: cc,
        email_subject: subject,
        email_body: body,
        status: 'pending_customer',
      })
      .eq('id', amendmentId)
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to mark email sent: ${error.message}`);
    }

    // Record history
    await this.recordHistory(amendmentId, null, 'pending_customer', 'email_sent', {
      to,
      cc,
      subject,
    });

    return this.transformAmendment(data);
  }

  /**
   * Generate confirmation email after execution
   */
  async generateConfirmationEmail(amendmentId: string, contactName: string): Promise<{
    subject: string;
    bodyHtml: string;
    bodyText: string;
  }> {
    const amendment = await this.getAmendment(amendmentId);
    if (!amendment) {
      throw new Error(`Amendment not found: ${amendmentId}`);
    }

    const customer = await this.db.getCustomer(amendment.customer_id);
    if (!customer) {
      throw new Error(`Customer not found: ${amendment.customer_id}`);
    }

    const variables: AmendmentConfirmationEmailVariables = {
      contactName,
      customerName: customer.name,
      csmName: 'Your CSM',
      amendmentId: amendment.id,
      amendmentType: amendment.amendment_type,
      amendmentTypeLabel: AMENDMENT_TYPE_LABELS[amendment.amendment_type],
      executedDate: new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' }),
      previousSeats: amendment.current_seats,
      previousArr: amendment.current_arr,
      newSeats: amendment.proposed_seats,
      newArr: amendment.new_annual_rate,
      newTermEnd: amendment.proposed_term_end,
      proratedAmount: amendment.prorated_cost,
      effectiveDate: new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' }),
    };

    return generateAmendmentConfirmationEmail(variables);
  }

  /**
   * Get amendment history
   */
  async getHistory(amendmentId: string): Promise<Array<{
    id: string;
    previousStatus?: AmendmentStatus;
    newStatus?: AmendmentStatus;
    action: string;
    actionDetails?: Record<string, unknown>;
    actorName?: string;
    notes?: string;
    createdAt: string;
  }>> {
    const { data, error } = await this.db.supabase
      .from('contract_amendment_history')
      .select('*')
      .eq('amendment_id', amendmentId)
      .order('created_at', { ascending: false });

    if (error) {
      throw new Error(`Failed to get amendment history: ${error.message}`);
    }

    return (data || []).map(h => ({
      id: h.id,
      previousStatus: h.previous_status,
      newStatus: h.new_status,
      action: h.action,
      actionDetails: h.action_details,
      actorName: h.actor_name,
      notes: h.notes,
      createdAt: h.created_at,
    }));
  }

  /**
   * Get amendment summary statistics
   */
  async getSummary(customerId?: string): Promise<{
    totalAmendments: number;
    byStatus: Record<AmendmentStatus, number>;
    byType: Record<AmendmentType, number>;
    totalProratedValue: number;
    pendingApprovals: number;
    awaitingCustomer: number;
  }> {
    let query = this.db.supabase
      .from('contract_amendments')
      .select('status, amendment_type, prorated_cost');

    if (customerId) {
      query = query.eq('customer_id', customerId);
    }

    const { data, error } = await query;

    if (error) {
      throw new Error(`Failed to get amendment summary: ${error.message}`);
    }

    const amendments = data || [];

    // Calculate summary
    const byStatus: Record<string, number> = {};
    const byType: Record<string, number> = {};
    let totalProratedValue = 0;
    let pendingApprovals = 0;
    let awaitingCustomer = 0;

    for (const a of amendments) {
      byStatus[a.status] = (byStatus[a.status] || 0) + 1;
      byType[a.amendment_type] = (byType[a.amendment_type] || 0) + 1;
      totalProratedValue += a.prorated_cost || 0;

      if (a.status === 'pending_approval' || a.status === 'pending_legal') {
        pendingApprovals++;
      }
      if (a.status === 'pending_customer') {
        awaitingCustomer++;
      }
    }

    return {
      totalAmendments: amendments.length,
      byStatus: byStatus as Record<AmendmentStatus, number>,
      byType: byType as Record<AmendmentType, number>,
      totalProratedValue: Math.round(totalProratedValue * 100) / 100,
      pendingApprovals,
      awaitingCustomer,
    };
  }

  // ============================================
  // Private Helper Methods
  // ============================================

  private transformAmendment(data: Record<string, unknown>): ContractAmendment {
    return {
      id: data.id as string,
      customer_id: data.customer_id as string,
      contract_id: data.contract_id as string,
      amendment_type: data.amendment_type as AmendmentType,
      description: data.description as string,
      reason: data.reason as string,
      current_seats: data.current_seats as number,
      current_arr: data.current_arr as number,
      current_term_end: data.current_term_end as string,
      current_features: data.current_features as string[],
      proposed_seats: data.proposed_seats as number,
      proposed_arr: data.proposed_arr as number,
      proposed_term_end: data.proposed_term_end as string,
      proposed_features: data.proposed_features as string[],
      prorated_cost: data.prorated_cost as number,
      months_remaining: data.months_remaining as number,
      new_annual_rate: data.new_annual_rate as number,
      financial_impact_details: data.financial_impact_details as Record<string, unknown>,
      status: data.status as AmendmentStatus,
      requires_legal_review: data.requires_legal_review as boolean,
      requires_executive_approval: data.requires_executive_approval as boolean,
      email_sent: data.email_sent as boolean,
      email_sent_at: data.email_sent_at as string,
      email_to: data.email_to as string[],
      email_cc: data.email_cc as string[],
      email_subject: data.email_subject as string,
      email_body: data.email_body as string,
      created_at: data.created_at as string,
      updated_at: data.updated_at as string,
      completed_at: data.completed_at as string,
    };
  }

  private determineRequiresLegalReview(type: AmendmentType, impact: FinancialImpact): boolean {
    // Legal review required for term modifications, large scope changes, or significant value
    if (type === 'term_extension' || type === 'term_modification') {
      return true;
    }
    if (type === 'scope_adjustment') {
      return true;
    }
    if (Math.abs(impact.annualDifference) > 50000) {
      return true;
    }
    return false;
  }

  private determineRequiresExecutiveApproval(type: AmendmentType, impact: FinancialImpact): boolean {
    // Executive approval for reductions or very large changes
    if (type === 'seat_reduction' || type === 'feature_downgrade') {
      return true;
    }
    if (Math.abs(impact.annualDifference) > 100000) {
      return true;
    }
    return false;
  }

  private generateDescription(type: AmendmentType, impact: FinancialImpact): string {
    const seatDiff = impact.proposedSeats - impact.currentSeats;
    switch (type) {
      case 'seat_addition':
        return `Add ${seatDiff} seats to ${impact.customerName} (${impact.currentSeats} -> ${impact.proposedSeats})`;
      case 'seat_reduction':
        return `Reduce ${Math.abs(seatDiff)} seats for ${impact.customerName} (${impact.currentSeats} -> ${impact.proposedSeats})`;
      case 'feature_upgrade':
        return `Feature upgrade for ${impact.customerName}`;
      case 'term_extension':
        return `Term extension for ${impact.customerName}`;
      default:
        return `Contract amendment for ${impact.customerName}`;
    }
  }

  private validateStatusTransition(from: AmendmentStatus, to: AmendmentStatus): void {
    const validTransitions: Record<AmendmentStatus, AmendmentStatus[]> = {
      draft: ['pending_review', 'pending_customer', 'cancelled'],
      pending_review: ['pending_customer', 'pending_legal', 'pending_approval', 'rejected', 'cancelled'],
      pending_customer: ['pending_legal', 'pending_approval', 'approved', 'rejected', 'cancelled'],
      pending_legal: ['pending_approval', 'approved', 'rejected', 'cancelled'],
      pending_approval: ['approved', 'rejected', 'cancelled'],
      approved: ['executed', 'cancelled'],
      rejected: [],
      executed: [],
      cancelled: [],
    };

    if (!validTransitions[from]?.includes(to)) {
      throw new Error(`Invalid status transition: ${from} -> ${to}`);
    }
  }

  private async recordHistory(
    amendmentId: string,
    previousStatus: AmendmentStatus | null,
    newStatus: AmendmentStatus | null,
    action: string,
    details: Record<string, unknown>
  ): Promise<void> {
    try {
      await this.db.supabase.from('contract_amendment_history').insert({
        amendment_id: amendmentId,
        previous_status: previousStatus,
        new_status: newStatus,
        action,
        action_details: details,
        actor_name: details.actorName || details.createdBy || 'System',
        notes: details.notes,
      });
    } catch (error) {
      console.error('[AmendmentGenerator] Failed to record history:', error);
    }
  }

  private getDefaultTermEnd(): string {
    const date = new Date();
    date.setFullYear(date.getFullYear() + 1);
    return date.toISOString().split('T')[0];
  }
}

// Export singleton instance
export const amendmentGenerator = new AmendmentGeneratorService();
export default amendmentGenerator;
