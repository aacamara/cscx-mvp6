/**
 * Renewal Checklist Service (PRD-089)
 *
 * Manages renewal preparation checklists at key milestones:
 * - 90 days: Strategic Preparation
 * - 60 days: Active Engagement
 * - 30 days: Negotiation & Close
 * - 7 days: Final Push
 */

import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { v4 as uuidv4 } from 'uuid';
import { config } from '../config/index.js';
import { docsService } from './google/docs.js';

// ============================================
// Types
// ============================================

export type MilestoneType = '90_day' | '60_day' | '30_day' | '7_day';
export type ItemPriority = 'low' | 'medium' | 'high' | 'critical';
export type ItemStatus = 'pending' | 'in_progress' | 'completed' | 'skipped';
export type AlertSeverity = 'info' | 'warning' | 'critical';

export interface ChecklistItem {
  id: string;
  title: string;
  description?: string;
  priority: ItemPriority;
  status: ItemStatus;
  completedAt?: string;
  completedBy?: string;
  dueOffsetDays?: number;
  documentId?: string;
  autoGenerate?: 'value_summary' | 'renewal_proposal';
  autoCheck?: boolean;
  notes?: string;
}

export interface RenewalChecklist {
  id: string;
  customerId: string;
  renewalDate: Date;
  milestone: MilestoneType;
  milestoneName: string;
  items: ChecklistItem[];
  completionRate: number;
  arr?: number;
  healthScore?: number;
  segment?: string;
  documents: Array<{
    type: string;
    id: string;
    url: string;
    generatedAt: string;
  }>;
  stakeholderStatus: Record<string, {
    lastContact?: string;
    engaged: boolean;
    role?: string;
  }>;
  riskFactors: string[];
  createdAt: Date;
  updatedAt: Date;
  completedAt?: Date;
}

export interface MilestoneTemplate {
  name: string;
  items: Array<Omit<ChecklistItem, 'status' | 'completedAt' | 'completedBy'>>;
}

// ============================================
// Milestone Templates (from PRD-089)
// ============================================

export const RENEWAL_CHECKLISTS: Record<MilestoneType, MilestoneTemplate> = {
  '90_day': {
    name: 'Strategic Preparation',
    items: [
      {
        id: 'review_health',
        title: 'Review current health score and trends',
        priority: 'high',
        autoCheck: true,
        description: 'Analyze health score trajectory over the past quarter'
      },
      {
        id: 'value_summary',
        title: 'Generate value summary document',
        priority: 'high',
        autoGenerate: 'value_summary',
        description: 'Create comprehensive value document with ROI metrics and achievements'
      },
      {
        id: 'stakeholder_audit',
        title: 'Audit stakeholder engagement',
        priority: 'high',
        description: 'Review contact frequency and engagement levels for all stakeholders'
      },
      {
        id: 'exec_sponsor',
        title: 'Confirm exec sponsor engagement',
        priority: 'medium',
        description: 'Ensure executive sponsor is engaged and aware of renewal timeline'
      },
      {
        id: 'risk_assessment',
        title: 'Complete risk assessment',
        priority: 'high',
        description: 'Identify and document any churn risks or concerns'
      },
      {
        id: 'expansion_review',
        title: 'Review expansion opportunities',
        priority: 'medium',
        description: 'Identify upsell/cross-sell opportunities for renewal conversation'
      },
      {
        id: 'qbr_schedule',
        title: 'Schedule pre-renewal QBR',
        priority: 'high',
        description: 'Book QBR meeting to review value delivered and set renewal expectations'
      }
    ]
  },
  '60_day': {
    name: 'Active Engagement',
    items: [
      {
        id: 'renewal_proposal',
        title: 'Prepare renewal proposal',
        priority: 'high',
        autoGenerate: 'renewal_proposal',
        description: 'Generate formal renewal proposal document with pricing'
      },
      {
        id: 'pricing_confirm',
        title: 'Confirm pricing with finance',
        priority: 'high',
        description: 'Get pricing approval and any discount authorization'
      },
      {
        id: 'champion_aligned',
        title: 'Align with champion on renewal',
        priority: 'high',
        description: 'Ensure internal champion is aligned and advocating for renewal'
      },
      {
        id: 'decision_timeline',
        title: 'Understand decision timeline and process',
        priority: 'high',
        description: 'Map decision makers and understand approval process'
      },
      {
        id: 'competitor_check',
        title: 'Check for competitive threats',
        priority: 'medium',
        description: 'Research if customer is evaluating alternatives'
      },
      {
        id: 'contract_terms',
        title: 'Review contract terms for changes',
        priority: 'medium',
        description: 'Identify any terms that need renegotiation'
      }
    ]
  },
  '30_day': {
    name: 'Negotiation & Close',
    items: [
      {
        id: 'proposal_sent',
        title: 'Formal proposal sent',
        priority: 'critical',
        description: 'Ensure renewal proposal has been formally delivered'
      },
      {
        id: 'objections_handled',
        title: 'Address all objections',
        priority: 'critical',
        description: 'Document and resolve all customer objections or concerns'
      },
      {
        id: 'legal_review',
        title: 'Legal/procurement review started',
        priority: 'high',
        description: 'Confirm contract is in legal/procurement review'
      },
      {
        id: 'executive_alignment',
        title: 'Executive alignment confirmed',
        priority: 'high',
        description: 'Both sides have executive alignment on renewal'
      },
      {
        id: 'verbal_commit',
        title: 'Secure verbal commitment',
        priority: 'high',
        description: 'Get verbal confirmation of intent to renew'
      }
    ]
  },
  '7_day': {
    name: 'Final Push',
    items: [
      {
        id: 'contract_sent',
        title: 'Contract sent for signature',
        priority: 'critical',
        description: 'Final contract sent and awaiting signature'
      },
      {
        id: 'blockers_cleared',
        title: 'All blockers cleared',
        priority: 'critical',
        description: 'No outstanding issues preventing signature'
      },
      {
        id: 'signature_timeline',
        title: 'Confirm signature timeline',
        priority: 'critical',
        description: 'Have confirmed date for signature completion'
      },
      {
        id: 'escalate_if_needed',
        title: 'Escalate if at risk',
        priority: 'critical',
        description: 'Escalate to management if renewal is at risk'
      }
    ]
  }
};

// ARR tier adjustments
const ARR_TIER_ADJUSTMENTS: Record<string, ChecklistItem[]> = {
  enterprise: [
    {
      id: 'exec_briefing',
      title: 'Prepare executive briefing',
      priority: 'high',
      status: 'pending',
      description: 'Create executive-level presentation for C-suite'
    },
    {
      id: 'multi_stakeholder',
      title: 'Multi-stakeholder alignment meeting',
      priority: 'high',
      status: 'pending',
      description: 'Coordinate alignment across all stakeholder groups'
    }
  ],
  'high-value': [
    {
      id: 'custom_success_plan',
      title: 'Update custom success plan',
      priority: 'high',
      status: 'pending',
      description: 'Refresh the strategic success plan for next term'
    }
  ]
};

// Health-based additions
const HEALTH_RISK_ITEMS: ChecklistItem[] = [
  {
    id: 'save_play',
    title: 'Develop save play strategy',
    priority: 'critical',
    status: 'pending',
    description: 'Create intervention plan to address churn risk'
  },
  {
    id: 'escalation_plan',
    title: 'Prepare escalation path',
    priority: 'high',
    status: 'pending',
    description: 'Define escalation strategy if standard approach fails'
  },
  {
    id: 'exec_intervention',
    title: 'Schedule exec sponsor call',
    priority: 'high',
    status: 'pending',
    description: 'Arrange executive-to-executive conversation'
  }
];

// ============================================
// Service Class
// ============================================

export class RenewalChecklistService {
  private supabase: SupabaseClient | null = null;

  constructor() {
    if (config.supabaseUrl && config.supabaseServiceKey) {
      this.supabase = createClient(config.supabaseUrl, config.supabaseServiceKey);
    }
  }

  /**
   * Get the current milestone based on days until renewal
   */
  getCurrentMilestone(daysUntilRenewal: number): MilestoneType | null {
    if (daysUntilRenewal <= 7) return '7_day';
    if (daysUntilRenewal <= 30) return '30_day';
    if (daysUntilRenewal <= 60) return '60_day';
    if (daysUntilRenewal <= 90) return '90_day';
    return null;
  }

  /**
   * Get alert severity based on milestone
   */
  getAlertSeverity(milestone: MilestoneType): AlertSeverity {
    switch (milestone) {
      case '7_day': return 'critical';
      case '30_day': return 'warning';
      default: return 'info';
    }
  }

  /**
   * Calculate days until renewal
   */
  getDaysUntilRenewal(renewalDate: Date): number {
    const now = new Date();
    const diffTime = renewalDate.getTime() - now.getTime();
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  }

  /**
   * Create a new checklist for a milestone
   */
  async createChecklist(
    customerId: string,
    renewalDate: Date,
    milestone: MilestoneType,
    options?: {
      arr?: number;
      healthScore?: number;
      segment?: string;
      inheritIncomplete?: boolean;
      previousChecklist?: RenewalChecklist;
    }
  ): Promise<RenewalChecklist> {
    const template = RENEWAL_CHECKLISTS[milestone];

    // Build base items
    let items: ChecklistItem[] = template.items.map(item => ({
      ...item,
      status: 'pending' as ItemStatus
    }));

    // Add ARR tier specific items
    if (options?.segment) {
      const tierItems = ARR_TIER_ADJUSTMENTS[options.segment.toLowerCase()];
      if (tierItems) {
        items = [...items, ...tierItems];
      }
    }

    // Add risk items for at-risk accounts
    if (options?.healthScore && options.healthScore < 60) {
      items = [...items, ...HEALTH_RISK_ITEMS];
    }

    // Inherit incomplete items from previous milestone
    if (options?.inheritIncomplete && options.previousChecklist) {
      const incompleteItems = options.previousChecklist.items
        .filter(item => item.status === 'pending' || item.status === 'in_progress')
        .map(item => ({
          ...item,
          id: `inherited_${item.id}`,
          title: `[Carryover] ${item.title}`,
          priority: 'high' as ItemPriority // Elevate priority for carryovers
        }));
      items = [...incompleteItems, ...items];
    }

    const checklist: RenewalChecklist = {
      id: uuidv4(),
      customerId,
      renewalDate,
      milestone,
      milestoneName: template.name,
      items,
      completionRate: 0,
      arr: options?.arr,
      healthScore: options?.healthScore,
      segment: options?.segment,
      documents: [],
      stakeholderStatus: {},
      riskFactors: [],
      createdAt: new Date(),
      updatedAt: new Date()
    };

    // Save to database
    if (this.supabase) {
      const { error } = await this.supabase
        .from('renewal_checklists')
        .upsert({
          id: checklist.id,
          customer_id: customerId,
          renewal_date: renewalDate.toISOString().split('T')[0],
          milestone,
          milestone_name: template.name,
          items: JSON.stringify(items),
          completion_rate: 0,
          arr: options?.arr,
          health_score: options?.healthScore,
          segment: options?.segment,
          documents: JSON.stringify([]),
          stakeholder_status: JSON.stringify({}),
          risk_factors: JSON.stringify([])
        }, { onConflict: 'customer_id,milestone' });

      if (error) {
        console.error('[RenewalChecklist] Error creating checklist:', error);
        throw error;
      }
    }

    return checklist;
  }

  /**
   * Get checklist for a customer
   */
  async getCustomerChecklist(customerId: string, milestone?: MilestoneType): Promise<RenewalChecklist | null> {
    if (!this.supabase) return null;

    let query = this.supabase
      .from('renewal_checklists')
      .select('*')
      .eq('customer_id', customerId);

    if (milestone) {
      query = query.eq('milestone', milestone);
    } else {
      query = query.order('created_at', { ascending: false }).limit(1);
    }

    const { data, error } = await query.single();

    if (error || !data) return null;

    return this.mapDbToChecklist(data);
  }

  /**
   * Get all checklists for a customer
   */
  async getAllCustomerChecklists(customerId: string): Promise<RenewalChecklist[]> {
    if (!this.supabase) return [];

    const { data, error } = await this.supabase
      .from('renewal_checklists')
      .select('*')
      .eq('customer_id', customerId)
      .order('created_at', { ascending: false });

    if (error || !data) return [];

    return data.map(this.mapDbToChecklist);
  }

  /**
   * Get renewal checklist overview for customer
   */
  async getRenewalChecklistOverview(customerId: string): Promise<{
    renewalDate?: Date;
    daysUntilRenewal?: number;
    currentMilestone?: MilestoneType;
    checklists: Record<MilestoneType, { items: ChecklistItem[]; completionRate: number } | null>;
    documents: Array<{ type: string; id: string; url: string; generatedAt: string }>;
  }> {
    if (!this.supabase) {
      return {
        checklists: { '90_day': null, '60_day': null, '30_day': null, '7_day': null },
        documents: []
      };
    }

    // Get customer renewal date
    const { data: customer } = await this.supabase
      .from('customers')
      .select('renewal_date')
      .eq('id', customerId)
      .single();

    if (!customer?.renewal_date) {
      return {
        checklists: { '90_day': null, '60_day': null, '30_day': null, '7_day': null },
        documents: []
      };
    }

    const renewalDate = new Date(customer.renewal_date);
    const daysUntilRenewal = this.getDaysUntilRenewal(renewalDate);
    const currentMilestone = this.getCurrentMilestone(daysUntilRenewal);

    // Get all checklists
    const checklists = await this.getAllCustomerChecklists(customerId);

    // Build response
    const checklistMap: Record<MilestoneType, { items: ChecklistItem[]; completionRate: number } | null> = {
      '90_day': null,
      '60_day': null,
      '30_day': null,
      '7_day': null
    };

    const allDocuments: Array<{ type: string; id: string; url: string; generatedAt: string }> = [];

    for (const checklist of checklists) {
      checklistMap[checklist.milestone] = {
        items: checklist.items,
        completionRate: checklist.completionRate
      };
      allDocuments.push(...checklist.documents);
    }

    return {
      renewalDate,
      daysUntilRenewal,
      currentMilestone: currentMilestone || undefined,
      checklists: checklistMap,
      documents: allDocuments
    };
  }

  /**
   * Update a checklist item
   */
  async updateItem(
    checklistId: string,
    itemId: string,
    updates: { status?: ItemStatus; notes?: string; completedBy?: string }
  ): Promise<RenewalChecklist | null> {
    if (!this.supabase) return null;

    // Get current checklist
    const { data: current, error: fetchError } = await this.supabase
      .from('renewal_checklists')
      .select('*')
      .eq('id', checklistId)
      .single();

    if (fetchError || !current) return null;

    // Parse and update items
    const items: ChecklistItem[] = JSON.parse(current.items);
    const itemIndex = items.findIndex(i => i.id === itemId);

    if (itemIndex === -1) return null;

    // Update item
    if (updates.status) {
      items[itemIndex].status = updates.status;
      if (updates.status === 'completed') {
        items[itemIndex].completedAt = new Date().toISOString();
        items[itemIndex].completedBy = updates.completedBy;
      }
    }
    if (updates.notes !== undefined) {
      items[itemIndex].notes = updates.notes;
    }

    // Calculate completion rate
    const completedCount = items.filter(i => i.status === 'completed').length;
    const completionRate = Math.round((completedCount / items.length) * 100);

    // Update in database
    const { data, error } = await this.supabase
      .from('renewal_checklists')
      .update({
        items: JSON.stringify(items),
        completion_rate: completionRate,
        updated_at: new Date().toISOString(),
        completed_at: completionRate === 100 ? new Date().toISOString() : null
      })
      .eq('id', checklistId)
      .select()
      .single();

    if (error) {
      console.error('[RenewalChecklist] Error updating item:', error);
      return null;
    }

    return this.mapDbToChecklist(data);
  }

  /**
   * Add custom item to checklist
   */
  async addCustomItem(
    checklistId: string,
    item: Omit<ChecklistItem, 'status' | 'completedAt' | 'completedBy'>
  ): Promise<RenewalChecklist | null> {
    if (!this.supabase) return null;

    const { data: current, error: fetchError } = await this.supabase
      .from('renewal_checklists')
      .select('*')
      .eq('id', checklistId)
      .single();

    if (fetchError || !current) return null;

    const items: ChecklistItem[] = JSON.parse(current.items);
    items.push({
      ...item,
      id: item.id || `custom_${uuidv4()}`,
      status: 'pending'
    });

    // Recalculate completion rate
    const completedCount = items.filter(i => i.status === 'completed').length;
    const completionRate = Math.round((completedCount / items.length) * 100);

    const { data, error } = await this.supabase
      .from('renewal_checklists')
      .update({
        items: JSON.stringify(items),
        completion_rate: completionRate,
        updated_at: new Date().toISOString()
      })
      .eq('id', checklistId)
      .select()
      .single();

    if (error) return null;

    return this.mapDbToChecklist(data);
  }

  /**
   * Generate renewal document
   */
  async generateDocument(
    userId: string,
    customerId: string,
    checklistId: string,
    documentType: 'value_summary' | 'renewal_proposal',
    variables: Record<string, string>
  ): Promise<{ id: string; url: string } | null> {
    try {
      // Create document using Google Docs service
      const doc = await docsService.createFromTemplate(userId, documentType, variables);

      if (!doc || !doc.id) return null;

      // Save document reference
      if (this.supabase) {
        await this.supabase.from('renewal_documents').insert({
          customer_id: customerId,
          checklist_id: checklistId,
          document_type: documentType,
          document_name: doc.title,
          google_doc_id: doc.id,
          google_drive_url: doc.webViewLink,
          metadata: JSON.stringify(variables)
        });

        // Update checklist with document reference
        const { data: checklist } = await this.supabase
          .from('renewal_checklists')
          .select('documents')
          .eq('id', checklistId)
          .single();

        if (checklist) {
          const documents = JSON.parse(checklist.documents || '[]');
          documents.push({
            type: documentType,
            id: doc.id,
            url: doc.webViewLink,
            generatedAt: new Date().toISOString()
          });

          await this.supabase
            .from('renewal_checklists')
            .update({ documents: JSON.stringify(documents) })
            .eq('id', checklistId);
        }
      }

      return {
        id: doc.id,
        url: doc.webViewLink || `https://docs.google.com/document/d/${doc.id}/edit`
      };
    } catch (error) {
      console.error('[RenewalChecklist] Error generating document:', error);
      return null;
    }
  }

  /**
   * Get upcoming renewals that need milestone triggers
   */
  async getUpcomingRenewalsForMilestone(): Promise<Array<{
    customerId: string;
    customerName: string;
    renewalDate: Date;
    daysUntil: number;
    milestone: MilestoneType;
    arr: number;
    healthScore: number;
    segment?: string;
    hasChecklist: boolean;
  }>> {
    if (!this.supabase) return [];

    const now = new Date();
    const ninetyDaysOut = new Date(now.getTime() + 90 * 24 * 60 * 60 * 1000);

    const { data: customers, error } = await this.supabase
      .from('customers')
      .select('id, name, renewal_date, arr, health_score, segment')
      .not('renewal_date', 'is', null)
      .gte('renewal_date', now.toISOString().split('T')[0])
      .lte('renewal_date', ninetyDaysOut.toISOString().split('T')[0])
      .order('renewal_date');

    if (error || !customers) return [];

    const results = [];

    for (const customer of customers) {
      const renewalDate = new Date(customer.renewal_date);
      const daysUntil = this.getDaysUntilRenewal(renewalDate);
      const milestone = this.getCurrentMilestone(daysUntil);

      if (!milestone) continue;

      // Check if checklist exists
      const { data: existingChecklist } = await this.supabase
        .from('renewal_checklists')
        .select('id')
        .eq('customer_id', customer.id)
        .eq('milestone', milestone)
        .single();

      results.push({
        customerId: customer.id,
        customerName: customer.name,
        renewalDate,
        daysUntil,
        milestone,
        arr: customer.arr || 0,
        healthScore: customer.health_score || 70,
        segment: customer.segment,
        hasChecklist: !!existingChecklist
      });
    }

    return results;
  }

  /**
   * Log milestone alert
   */
  async logAlert(
    customerId: string,
    checklistId: string,
    milestone: MilestoneType,
    alertType: string,
    channel: string,
    metadata?: Record<string, unknown>
  ): Promise<void> {
    if (!this.supabase) return;

    await this.supabase.from('renewal_milestone_alerts').insert({
      customer_id: customerId,
      checklist_id: checklistId,
      milestone,
      alert_type: alertType,
      alert_severity: this.getAlertSeverity(milestone),
      channel,
      metadata: JSON.stringify(metadata || {})
    });
  }

  /**
   * Map database row to checklist object
   */
  private mapDbToChecklist(row: Record<string, unknown>): RenewalChecklist {
    return {
      id: row.id as string,
      customerId: row.customer_id as string,
      renewalDate: new Date(row.renewal_date as string),
      milestone: row.milestone as MilestoneType,
      milestoneName: row.milestone_name as string,
      items: JSON.parse((row.items as string) || '[]'),
      completionRate: row.completion_rate as number || 0,
      arr: row.arr as number | undefined,
      healthScore: row.health_score as number | undefined,
      segment: row.segment as string | undefined,
      documents: JSON.parse((row.documents as string) || '[]'),
      stakeholderStatus: JSON.parse((row.stakeholder_status as string) || '{}'),
      riskFactors: JSON.parse((row.risk_factors as string) || '[]'),
      createdAt: new Date(row.created_at as string),
      updatedAt: new Date(row.updated_at as string),
      completedAt: row.completed_at ? new Date(row.completed_at as string) : undefined
    };
  }
}

// Singleton export
export const renewalChecklistService = new RenewalChecklistService();
