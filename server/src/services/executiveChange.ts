/**
 * Executive Change Detection Service
 * PRD-095: Handles detection and response to executive-level changes at customer organizations
 */

import { createClient } from '@supabase/supabase-js';
import { v4 as uuidv4 } from 'uuid';
import { config } from '../config/index.js';
import { slackService } from './slack/index.js';

// ============================================
// Types
// ============================================

export type ExecutiveChangeType = 'new_hire' | 'departure' | 'promotion' | 'title_change';
export type DetectionSource = 'linkedin' | 'press_release' | 'company_announcement' | 'email_signature' | 'manual' | 'api_enrichment';

export interface ExecutiveChange {
  id: string;
  customerId: string;
  stakeholderId?: string;
  changeType: ExecutiveChangeType;
  executiveName: string;
  newTitle: string;
  previousTitle?: string;
  previousCompany?: string;
  linkedinUrl?: string;
  background: ExecutiveBackground;
  detectedAt: Date;
  source: DetectionSource;
  outreachSentAt?: Date;
  status: 'pending' | 'acknowledged' | 'outreach_sent' | 'meeting_scheduled' | 'completed';
  metadata?: Record<string, any>;
  createdAt: Date;
  updatedAt: Date;
}

export interface ExecutiveBackground {
  summary?: string;
  previousRoles?: Array<{
    title: string;
    company: string;
    duration?: string;
  }>;
  expertise?: string[];
  education?: Array<{
    institution: string;
    degree?: string;
    field?: string;
  }>;
  sharedConnections?: Array<{
    name: string;
    relationship: string;
    company?: string;
  }>;
  focusAreas?: string[];
  publications?: string[];
  socialProfiles?: Record<string, string>;
}

export interface ExecutiveChangeSignal {
  id?: string;
  customerId: string;
  stakeholderId?: string;
  signalType: DetectionSource;
  executiveName: string;
  newTitle?: string;
  previousTitle?: string;
  rawData: Record<string, any>;
  confidence: number;
  detectedAt?: Date;
}

export interface ImpactAssessment {
  riskLevel: 'low' | 'medium' | 'high';
  opportunities: string[];
  risks: string[];
  recommendedActions: string[];
  urgency: 'immediate' | 'within_week' | 'within_month';
}

export interface OutreachDraft {
  recipientEmail?: string;
  recipientName: string;
  subject: string;
  body: string;
  caseStudies?: Array<{
    title: string;
    relevance: string;
    url?: string;
  }>;
  suggestedMeetingTopics?: string[];
}

export interface ExecutiveChangeCreateInput {
  customerId: string;
  stakeholderId?: string;
  changeType: ExecutiveChangeType;
  executiveName: string;
  newTitle: string;
  previousTitle?: string;
  previousCompany?: string;
  linkedinUrl?: string;
  background?: Partial<ExecutiveBackground>;
  source: DetectionSource;
  metadata?: Record<string, any>;
}

// Executive level patterns for detection
const EXECUTIVE_TITLE_PATTERNS = [
  /\b(chief|c[eotifrmosd]o|ceo|cto|cfo|coo|cio|cso|cro|cmo)\b/i,
  /\bvp\b|\bvice\s*president\b/i,
  /\b(svp|evp|gvp)\b/i,
  /\bhead\s+of\b/i,
  /\bdirector\b/i,
  /\bpartner\b/i,
  /\bpresident\b/i,
  /\bmanaging\s+director\b/i,
  /\bgeneral\s+manager\b/i,
];

// ============================================
// Executive Change Detection Service
// ============================================

export class ExecutiveChangeService {
  private supabase: ReturnType<typeof createClient> | null = null;

  constructor() {
    if (config.supabaseUrl && config.supabaseServiceKey) {
      this.supabase = createClient(config.supabaseUrl, config.supabaseServiceKey);
    }
  }

  // ============================================
  // Executive Change Detection
  // ============================================

  /**
   * Check if a title indicates executive level
   */
  isExecutiveTitle(title: string): boolean {
    return EXECUTIVE_TITLE_PATTERNS.some(pattern => pattern.test(title));
  }

  /**
   * Record a detected executive change signal
   */
  async recordChangeSignal(signal: ExecutiveChangeSignal): Promise<ExecutiveChangeSignal> {
    if (!this.supabase) throw new Error('Database not available');

    const { data, error } = await this.supabase
      .from('executive_change_signals')
      .insert({
        id: uuidv4(),
        customer_id: signal.customerId,
        stakeholder_id: signal.stakeholderId,
        signal_type: signal.signalType,
        executive_name: signal.executiveName,
        new_title: signal.newTitle,
        previous_title: signal.previousTitle,
        raw_data: signal.rawData,
        confidence: signal.confidence,
        detected_at: signal.detectedAt || new Date(),
      })
      .select()
      .single();

    if (error) throw error;

    return this.mapSignal(data);
  }

  /**
   * Create a confirmed executive change record
   */
  async createExecutiveChange(input: ExecutiveChangeCreateInput): Promise<ExecutiveChange> {
    if (!this.supabase) throw new Error('Database not available');

    const { data, error } = await this.supabase
      .from('executive_changes')
      .insert({
        id: uuidv4(),
        customer_id: input.customerId,
        stakeholder_id: input.stakeholderId,
        change_type: input.changeType,
        executive_name: input.executiveName,
        new_title: input.newTitle,
        previous_title: input.previousTitle,
        previous_company: input.previousCompany,
        linkedin_url: input.linkedinUrl,
        background: input.background || {},
        source: input.source,
        status: 'pending',
        metadata: input.metadata || {},
        detected_at: new Date(),
      })
      .select()
      .single();

    if (error) throw error;

    const change = this.mapExecutiveChange(data);

    // Create risk signal for tracking
    await this.createExecutiveChangeRiskSignal(change, input.customerId);

    return change;
  }

  /**
   * Get executive change by ID
   */
  async getExecutiveChange(changeId: string): Promise<ExecutiveChange | null> {
    if (!this.supabase) return null;

    const { data, error } = await this.supabase
      .from('executive_changes')
      .select('*, customers(id, name, arr, health_score)')
      .eq('id', changeId)
      .single();

    if (error || !data) return null;

    return this.mapExecutiveChange(data);
  }

  /**
   * List executive changes for a customer
   */
  async listExecutiveChanges(options: {
    customerId?: string;
    changeType?: ExecutiveChangeType;
    status?: string;
    limit?: number;
    offset?: number;
  } = {}): Promise<{ changes: ExecutiveChange[]; total: number }> {
    if (!this.supabase) return { changes: [], total: 0 };

    let query = this.supabase
      .from('executive_changes')
      .select('*, customers(id, name)', { count: 'exact' })
      .order('detected_at', { ascending: false });

    if (options.customerId) query = query.eq('customer_id', options.customerId);
    if (options.changeType) query = query.eq('change_type', options.changeType);
    if (options.status) query = query.eq('status', options.status);

    const limit = options.limit || 50;
    const offset = options.offset || 0;
    query = query.range(offset, offset + limit - 1);

    const { data, error, count } = await query;

    if (error) throw error;

    return {
      changes: (data || []).map(this.mapExecutiveChange),
      total: count || 0,
    };
  }

  /**
   * Get recent executive changes (last 90 days)
   */
  async getRecentExecutiveChanges(customerId: string): Promise<ExecutiveChange[]> {
    if (!this.supabase) return [];

    const ninetyDaysAgo = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000);

    const { data, error } = await this.supabase
      .from('executive_changes')
      .select('*')
      .eq('customer_id', customerId)
      .gte('detected_at', ninetyDaysAgo.toISOString())
      .order('detected_at', { ascending: false });

    if (error) throw error;

    return (data || []).map(this.mapExecutiveChange);
  }

  // ============================================
  // Executive Research
  // ============================================

  /**
   * Research executive background (placeholder for LinkedIn/enrichment API integration)
   */
  async researchExecutive(
    executiveName: string,
    companyName: string,
    linkedinUrl?: string
  ): Promise<ExecutiveBackground> {
    // TODO: Integrate with LinkedIn Sales Navigator API, Clearbit, or other enrichment services
    console.log(`[ExecutiveChange] Researching executive: ${executiveName} at ${companyName}`);

    // Return placeholder data for now
    return {
      summary: `${executiveName} is a technology executive with experience in enterprise software.`,
      previousRoles: [],
      expertise: [],
      focusAreas: [],
      sharedConnections: [],
    };
  }

  /**
   * Find shared connections with CSM or company
   */
  async findSharedConnections(
    executiveName: string,
    linkedinUrl?: string,
    userId?: string
  ): Promise<ExecutiveBackground['sharedConnections']> {
    // TODO: Integrate with LinkedIn API to find mutual connections
    console.log(`[ExecutiveChange] Finding shared connections for: ${executiveName}`);

    return [];
  }

  // ============================================
  // Impact Assessment
  // ============================================

  /**
   * Assess the impact of an executive change
   */
  async assessImpact(change: ExecutiveChange, customerId: string): Promise<ImpactAssessment> {
    if (!this.supabase) {
      return this.getDefaultAssessment(change);
    }

    // Get customer details
    const { data: customer } = await this.supabase
      .from('customers')
      .select('arr, health_score, status, renewal_date')
      .eq('id', customerId)
      .single();

    // Get existing stakeholder relationships
    const { data: stakeholders } = await this.supabase
      .from('stakeholders')
      .select('*')
      .eq('customer_id', customerId)
      .eq('status', 'active');

    const remainingContacts = stakeholders?.length || 0;
    const isHighValueAccount = (customer?.arr || 0) > 100000;
    const isNearRenewal = customer?.renewal_date &&
      new Date(customer.renewal_date).getTime() - Date.now() < 90 * 24 * 60 * 60 * 1000;

    // Determine risk level
    let riskLevel: ImpactAssessment['riskLevel'] = 'medium';
    const risks: string[] = [];
    const opportunities: string[] = [];
    const recommendedActions: string[] = [];

    // Analyze by change type
    switch (change.changeType) {
      case 'new_hire':
        riskLevel = isHighValueAccount || isNearRenewal ? 'high' : 'medium';
        risks.push('New executive may review all vendor relationships');
        risks.push('Different priorities or technology preferences possible');
        opportunities.push('Opportunity to demonstrate value and build fresh relationship');
        opportunities.push('New executive may bring expansion budget');
        recommendedActions.push('Send congratulatory introduction email');
        recommendedActions.push('Share relevant case studies matching executive background');
        recommendedActions.push('Request introduction meeting within 2 weeks');
        break;

      case 'departure':
        riskLevel = remainingContacts < 3 ? 'high' : 'medium';
        risks.push('Loss of potential sponsor or champion');
        risks.push('Knowledge and relationship continuity at risk');
        opportunities.push('Opportunity to strengthen relationships with remaining stakeholders');
        recommendedActions.push('Immediately establish contact with remaining stakeholders');
        recommendedActions.push('Request introduction to replacement');
        break;

      case 'promotion':
        riskLevel = 'low';
        opportunities.push('Promoted contact may have more influence');
        opportunities.push('Expansion opportunity with increased budget authority');
        recommendedActions.push('Send congratulations');
        recommendedActions.push('Schedule meeting to discuss expanded partnership');
        break;

      case 'title_change':
        riskLevel = 'low';
        risks.push('Role change may shift priorities');
        opportunities.push('New role may create new use cases');
        recommendedActions.push('Understand new responsibilities and how product supports them');
        break;
    }

    // Executive background analysis
    if (change.background?.focusAreas?.length) {
      const alignedAreas = change.background.focusAreas.filter(area =>
        area.toLowerCase().includes('ai') ||
        area.toLowerCase().includes('automation') ||
        area.toLowerCase().includes('customer') ||
        area.toLowerCase().includes('data')
      );
      if (alignedAreas.length > 0) {
        opportunities.push(`Executive focus on ${alignedAreas.join(', ')} aligns with product strengths`);
      }
    }

    // Shared connections
    if (change.background?.sharedConnections?.length) {
      recommendedActions.push(
        `Request introduction via ${change.background.sharedConnections[0].name}`
      );
    }

    // Determine urgency
    let urgency: ImpactAssessment['urgency'] = 'within_week';
    if (change.changeType === 'new_hire' && isHighValueAccount) {
      urgency = 'immediate';
    } else if (change.changeType === 'departure') {
      urgency = 'immediate';
    } else if (isNearRenewal) {
      urgency = 'immediate';
    }

    return {
      riskLevel,
      opportunities,
      risks,
      recommendedActions,
      urgency,
    };
  }

  private getDefaultAssessment(change: ExecutiveChange): ImpactAssessment {
    return {
      riskLevel: change.changeType === 'departure' ? 'high' : 'medium',
      opportunities: ['Opportunity to build new relationship'],
      risks: ['New executive may evaluate vendor relationships'],
      recommendedActions: [
        'Send introduction email',
        'Schedule introductory meeting',
        'Share relevant case studies',
      ],
      urgency: 'within_week',
    };
  }

  // ============================================
  // Outreach Generation
  // ============================================

  /**
   * Generate introduction email draft
   */
  async generateOutreachDraft(
    change: ExecutiveChange,
    customerId: string,
    csmName?: string
  ): Promise<OutreachDraft> {
    if (!this.supabase) {
      return this.getDefaultOutreachDraft(change, csmName || 'Your CSM');
    }

    // Get customer details
    const { data: customer } = await this.supabase
      .from('customers')
      .select('name')
      .eq('id', customerId)
      .single();

    const customerName = customer?.name || 'your organization';
    const firstName = change.executiveName.split(' ')[0];

    // Find relevant case studies based on executive background
    const caseStudies = await this.findRelevantCaseStudies(change);

    let subject = '';
    let body = '';
    const suggestedMeetingTopics: string[] = [];

    switch (change.changeType) {
      case 'new_hire':
        subject = `Congratulations on your new role at ${customerName}`;
        body = `Hi ${firstName},

Congratulations on your appointment as ${change.newTitle} at ${customerName}! I'm ${csmName || 'the Customer Success Manager'} supporting your team's partnership with us.

${change.previousCompany ? `I understand you're joining from ${change.previousCompany}. ` : ''}I wanted to reach out to introduce myself and share how we've been supporting ${customerName}'s success.

${change.background?.focusAreas?.length ?
`Based on your focus on ${change.background.focusAreas.join(', ')}, I thought you might find particular value in some of our capabilities in these areas. ` :
''}

I'd love to schedule a brief call to:
1. Share an overview of our current partnership and the value we're delivering
2. Understand your priorities and how we can best support your vision
3. Discuss any questions you might have about our platform

Would you have 30 minutes this week or next for an introductory call?

Looking forward to connecting!

Best regards,
${csmName || 'Your Customer Success Manager'}`;
        suggestedMeetingTopics.push('Current partnership overview and value delivered');
        suggestedMeetingTopics.push('Your priorities for the first 90 days');
        suggestedMeetingTopics.push('How we can support your strategic initiatives');
        break;

      case 'promotion':
        subject = `Congratulations on your promotion, ${firstName}!`;
        body = `Hi ${firstName},

I just heard the wonderful news about your promotion to ${change.newTitle}! Congratulations - it's well deserved.

Given your expanded role, I'd love to discuss how we can better support your broader objectives. Our partnership has been delivering great results, and I see opportunities to expand the value we provide to match your new scope.

Would you have time for a brief call to discuss how we can evolve our partnership to support your new responsibilities?

Congratulations again!

Best regards,
${csmName || 'Your Customer Success Manager'}`;
        suggestedMeetingTopics.push('Expanded use cases for your new scope');
        suggestedMeetingTopics.push('Additional value opportunities');
        break;

      default:
        subject = `Checking in - ${customerName} Partnership`;
        body = `Hi ${firstName},

I hope this message finds you well. As your Customer Success Manager, I wanted to reach out to ensure we're aligned on how we can best support ${customerName}.

I'd appreciate the opportunity to discuss your current priorities and how our partnership can deliver maximum value.

Would you have 20-30 minutes for a brief call?

Best regards,
${csmName || 'Your Customer Success Manager'}`;
    }

    return {
      recipientName: change.executiveName,
      subject,
      body,
      caseStudies,
      suggestedMeetingTopics,
    };
  }

  private async findRelevantCaseStudies(change: ExecutiveChange): Promise<OutreachDraft['caseStudies']> {
    // TODO: Integrate with case study repository
    // For now, return placeholder based on executive background
    const caseStudies: OutreachDraft['caseStudies'] = [];

    if (change.background?.focusAreas?.includes('digital transformation')) {
      caseStudies.push({
        title: 'Digital Transformation Success Story',
        relevance: 'Matches your focus on digital transformation initiatives',
      });
    }

    if (change.background?.previousRoles?.some(r => r.company.toLowerCase().includes('tech'))) {
      caseStudies.push({
        title: 'Enterprise Technology Adoption Case Study',
        relevance: 'Relevant to your technology background',
      });
    }

    return caseStudies;
  }

  private getDefaultOutreachDraft(change: ExecutiveChange, csmName: string): OutreachDraft {
    const firstName = change.executiveName.split(' ')[0];

    return {
      recipientName: change.executiveName,
      subject: `Welcome and Introduction`,
      body: `Hi ${firstName},

I'm ${csmName}, your Customer Success Manager. I wanted to reach out and introduce myself following your recent appointment as ${change.newTitle}.

I'd love to schedule a brief call to discuss how we can best support your priorities.

Best regards,
${csmName}`,
      suggestedMeetingTopics: [
        'Partnership overview',
        'Your priorities',
        'How we can help',
      ],
    };
  }

  // ============================================
  // Status Management
  // ============================================

  /**
   * Update executive change status
   */
  async updateStatus(
    changeId: string,
    status: ExecutiveChange['status'],
    metadata?: Record<string, any>
  ): Promise<ExecutiveChange> {
    if (!this.supabase) throw new Error('Database not available');

    const updates: Record<string, any> = {
      status,
      updated_at: new Date().toISOString(),
    };

    if (status === 'outreach_sent') {
      updates.outreach_sent_at = new Date().toISOString();
    }

    if (metadata) {
      updates.metadata = metadata;
    }

    const { data, error } = await this.supabase
      .from('executive_changes')
      .update(updates)
      .eq('id', changeId)
      .select()
      .single();

    if (error) throw error;

    return this.mapExecutiveChange(data);
  }

  /**
   * Mark outreach as sent
   */
  async markOutreachSent(changeId: string, emailDetails?: Record<string, any>): Promise<ExecutiveChange> {
    return this.updateStatus(changeId, 'outreach_sent', { emailDetails });
  }

  // ============================================
  // Risk Signal Integration
  // ============================================

  /**
   * Create a risk signal for executive change
   */
  private async createExecutiveChangeRiskSignal(
    change: ExecutiveChange,
    customerId: string
  ): Promise<void> {
    if (!this.supabase) return;

    // Get customer details
    const { data: customer } = await this.supabase
      .from('customers')
      .select('name, arr')
      .eq('id', customerId)
      .single();

    const assessment = await this.assessImpact(change, customerId);

    const severity = assessment.riskLevel === 'high' ? 'high' :
                     assessment.riskLevel === 'medium' ? 'medium' : 'low';

    await this.supabase.from('risk_signals').insert({
      id: uuidv4(),
      customer_id: customerId,
      signal_type: 'executive_change',
      severity,
      title: `Executive Change: ${change.executiveName} (${change.newTitle}) - ${change.changeType.replace('_', ' ')}`,
      description: this.formatChangeDescription(change, customer?.name),
      metadata: {
        executive_change_id: change.id,
        change_type: change.changeType,
        executive_name: change.executiveName,
        new_title: change.newTitle,
        previous_title: change.previousTitle,
        previous_company: change.previousCompany,
        source: change.source,
        impact_assessment: assessment,
      },
      resolved: false,
    });

    // Adjust health score based on change type
    if (change.changeType === 'departure' || change.changeType === 'new_hire') {
      const adjustment = change.changeType === 'departure' ? -15 : -10;
      await this.adjustHealthScore(customerId, adjustment, `Executive ${change.changeType}: ${change.executiveName}`);
    }
  }

  /**
   * Adjust customer health score
   */
  private async adjustHealthScore(customerId: string, adjustment: number, reason: string): Promise<void> {
    if (!this.supabase) return;

    const { data: customer } = await this.supabase
      .from('customers')
      .select('health_score')
      .eq('id', customerId)
      .single();

    if (!customer) return;

    const newScore = Math.max(0, Math.min(100, (customer.health_score || 50) + adjustment));

    await this.supabase
      .from('customers')
      .update({
        health_score: newScore,
        updated_at: new Date().toISOString(),
      })
      .eq('id', customerId);

    await this.supabase.from('activity_log').insert({
      customer_id: customerId,
      action: 'health_score_adjusted',
      entity_type: 'customer',
      entity_id: customerId,
      old_values: { health_score: customer.health_score },
      new_values: { health_score: newScore, reason },
    });
  }

  private formatChangeDescription(change: ExecutiveChange, customerName?: string): string {
    switch (change.changeType) {
      case 'new_hire':
        return `New ${change.newTitle} detected at ${customerName || 'account'}: ${change.executiveName}${change.previousCompany ? ` (from ${change.previousCompany})` : ''}.`;
      case 'departure':
        return `${change.executiveName} (${change.previousTitle || change.newTitle}) has departed from ${customerName || 'account'}.`;
      case 'promotion':
        return `${change.executiveName} promoted to ${change.newTitle}${change.previousTitle ? ` from ${change.previousTitle}` : ''} at ${customerName || 'account'}.`;
      case 'title_change':
        return `${change.executiveName}'s role changed from ${change.previousTitle || 'previous role'} to ${change.newTitle} at ${customerName || 'account'}.`;
      default:
        return `Executive change detected at ${customerName || 'account'}: ${change.executiveName} - ${change.newTitle}.`;
    }
  }

  // ============================================
  // Task Creation
  // ============================================

  /**
   * Create response tasks for executive change
   */
  async createResponseTasks(change: ExecutiveChange, customerId: string): Promise<void> {
    if (!this.supabase) return;

    const now = new Date();
    const assessment = await this.assessImpact(change, customerId);

    // Determine due dates based on urgency
    let introEmailDue: Date;
    let researchDue: Date;
    let meetingDue: Date;

    switch (assessment.urgency) {
      case 'immediate':
        introEmailDue = new Date(now.getTime() + 24 * 60 * 60 * 1000);
        researchDue = new Date(now.getTime() + 24 * 60 * 60 * 1000);
        meetingDue = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
        break;
      case 'within_week':
        introEmailDue = new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000);
        researchDue = new Date(now.getTime() + 2 * 24 * 60 * 60 * 1000);
        meetingDue = new Date(now.getTime() + 14 * 24 * 60 * 60 * 1000);
        break;
      default:
        introEmailDue = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
        researchDue = new Date(now.getTime() + 5 * 24 * 60 * 60 * 1000);
        meetingDue = new Date(now.getTime() + 21 * 24 * 60 * 60 * 1000);
    }

    const tasks = [
      {
        id: uuidv4(),
        customer_id: customerId,
        executive_change_id: change.id,
        task_type: 'send_intro_email',
        title: `Send introduction email to ${change.executiveName} (${change.newTitle})`,
        description: `Introduce yourself to the new ${change.newTitle} and share relevant value proposition.`,
        priority: assessment.urgency === 'immediate' ? 'critical' : 'high',
        status: 'pending',
        due_at: introEmailDue.toISOString(),
      },
      {
        id: uuidv4(),
        customer_id: customerId,
        executive_change_id: change.id,
        task_type: 'research_executive',
        title: `Research ${change.executiveName}'s background and priorities`,
        description: 'Review LinkedIn profile, recent publications, and public statements to understand priorities.',
        priority: 'high',
        status: 'pending',
        due_at: researchDue.toISOString(),
      },
      {
        id: uuidv4(),
        customer_id: customerId,
        executive_change_id: change.id,
        task_type: 'schedule_meeting',
        title: `Schedule introduction meeting with ${change.executiveName}`,
        description: 'Request 30-minute introduction meeting to establish relationship.',
        priority: 'medium',
        status: 'pending',
        due_at: meetingDue.toISOString(),
      },
    ];

    // Add case study task if relevant
    if (change.background?.focusAreas?.length) {
      tasks.push({
        id: uuidv4(),
        customer_id: customerId,
        executive_change_id: change.id,
        task_type: 'share_case_studies',
        title: `Share relevant case studies with ${change.executiveName}`,
        description: `Identify and share case studies relevant to: ${change.background.focusAreas.join(', ')}.`,
        priority: 'medium',
        status: 'pending',
        due_at: new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000).toISOString(),
      });
    }

    await this.supabase.from('executive_change_tasks').insert(tasks);
  }

  // ============================================
  // Slack Notifications
  // ============================================

  /**
   * Send executive change Slack alert
   */
  async sendSlackAlert(
    userId: string,
    change: ExecutiveChange,
    customerId: string
  ): Promise<void> {
    try {
      const isConnected = await slackService.isConnected(userId);
      if (!isConnected) return;

      // Get customer details
      let customerName = 'Unknown';
      let customerArr = 0;
      if (this.supabase) {
        const { data: customer } = await this.supabase
          .from('customers')
          .select('name, arr')
          .eq('id', customerId)
          .single();
        if (customer) {
          customerName = customer.name;
          customerArr = customer.arr || 0;
        }
      }

      const assessment = await this.assessImpact(change, customerId);

      const changeTypeEmoji = {
        new_hire: ':necktie:',
        departure: ':wave:',
        promotion: ':tada:',
        title_change: ':arrows_counterclockwise:',
      };

      const blocks: any[] = [
        {
          type: 'header',
          text: {
            type: 'plain_text',
            text: `${changeTypeEmoji[change.changeType]} Executive Change: ${customerName}`,
            emoji: true,
          },
        },
        {
          type: 'section',
          text: {
            type: 'mrkdwn',
            text: `*${change.executiveName}* - ${change.newTitle}`,
          },
        },
        {
          type: 'divider',
        },
        {
          type: 'section',
          fields: [
            {
              type: 'mrkdwn',
              text: `*Change Type:*\n${change.changeType.replace('_', ' ').charAt(0).toUpperCase() + change.changeType.replace('_', ' ').slice(1)}`,
            },
            {
              type: 'mrkdwn',
              text: `*Source:*\n${change.source.replace('_', ' ')}`,
            },
          ],
        },
      ];

      if (change.previousTitle || change.previousCompany) {
        blocks.push({
          type: 'section',
          fields: [
            ...(change.previousTitle ? [{
              type: 'mrkdwn',
              text: `*Previous Title:*\n${change.previousTitle}`,
            }] : []),
            ...(change.previousCompany ? [{
              type: 'mrkdwn',
              text: `*Previous Company:*\n${change.previousCompany}`,
            }] : []),
          ],
        });
      }

      if (change.background?.focusAreas?.length) {
        blocks.push({
          type: 'section',
          text: {
            type: 'mrkdwn',
            text: `*Background Highlights:*\n${change.background.focusAreas.map((a: string) => `• ${a}`).join('\n')}`,
          },
        });
      }

      if (change.background?.sharedConnections?.length) {
        blocks.push({
          type: 'section',
          text: {
            type: 'mrkdwn',
            text: `*Shared Connections:*\n${change.background.sharedConnections.map((c) => `• ${c.name} (${c.relationship})`).join('\n')}`,
          },
        });
      }

      blocks.push({
        type: 'section',
        fields: [
          {
            type: 'mrkdwn',
            text: `*Account ARR:*\n$${customerArr.toLocaleString()}`,
          },
          {
            type: 'mrkdwn',
            text: `*Risk Level:*\n${assessment.riskLevel.charAt(0).toUpperCase() + assessment.riskLevel.slice(1)}`,
          },
        ],
      });

      blocks.push({
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: `*Impact Assessment:*\n${assessment.risks[0] || 'Review needed'}\n\n*Opportunity:*\n${assessment.opportunities[0] || 'TBD'}`,
        },
      });

      blocks.push({
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: `*Recommended Actions:*\n${assessment.recommendedActions.map((a, i) => `${i + 1}. ${a}`).join('\n')}`,
        },
      });

      const actionButtons: any[] = [
        {
          type: 'button',
          text: { type: 'plain_text', text: 'Draft Introduction Email', emoji: true },
          style: 'primary',
          url: `${config.frontendUrl || 'http://localhost:5173'}/customers/${customerId}?action=draft-exec-intro&changeId=${change.id}`,
        },
      ];

      if (change.linkedinUrl) {
        actionButtons.push({
          type: 'button',
          text: { type: 'plain_text', text: 'View LinkedIn', emoji: true },
          url: change.linkedinUrl,
        });
      }

      actionButtons.push({
        type: 'button',
        text: { type: 'plain_text', text: 'View Account', emoji: true },
        url: `${config.frontendUrl || 'http://localhost:5173'}/customers/${customerId}`,
      });

      blocks.push({
        type: 'actions',
        elements: actionButtons,
      });

      await slackService.sendMessage(userId, {
        channel: '#cscx-alerts',
        text: `Executive Change Alert: ${change.executiveName} (${change.newTitle}) at ${customerName}`,
        blocks,
      });
    } catch (error) {
      console.error('[ExecutiveChange] Failed to send Slack alert:', error);
    }
  }

  // ============================================
  // Mappers
  // ============================================

  private mapSignal(row: any): ExecutiveChangeSignal {
    return {
      id: row.id,
      customerId: row.customer_id,
      stakeholderId: row.stakeholder_id,
      signalType: row.signal_type,
      executiveName: row.executive_name,
      newTitle: row.new_title,
      previousTitle: row.previous_title,
      rawData: row.raw_data || {},
      confidence: row.confidence,
      detectedAt: row.detected_at ? new Date(row.detected_at) : undefined,
    };
  }

  private mapExecutiveChange(row: any): ExecutiveChange {
    return {
      id: row.id,
      customerId: row.customer_id,
      stakeholderId: row.stakeholder_id,
      changeType: row.change_type,
      executiveName: row.executive_name,
      newTitle: row.new_title,
      previousTitle: row.previous_title,
      previousCompany: row.previous_company,
      linkedinUrl: row.linkedin_url,
      background: row.background || {},
      detectedAt: new Date(row.detected_at),
      source: row.source,
      outreachSentAt: row.outreach_sent_at ? new Date(row.outreach_sent_at) : undefined,
      status: row.status,
      metadata: row.metadata || {},
      createdAt: new Date(row.created_at),
      updatedAt: new Date(row.updated_at),
    };
  }
}

// Singleton instance
export const executiveChangeService = new ExecutiveChangeService();
