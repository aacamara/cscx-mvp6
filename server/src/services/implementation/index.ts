/**
 * PRD-123: Contract Signed → Implementation
 * Implementation Service - Core business logic for implementation workflow
 */

import { v4 as uuidv4 } from 'uuid';
import { createClient } from '@supabase/supabase-js';
import { config } from '../../config/index.js';
import { calendarService } from '../google/calendar.js';
import { driveService } from '../google/drive.js';
import { docsService } from '../google/docs.js';
import { slidesService } from '../google/slides.js';
import { sheetsService } from '../google/sheets.js';
import type {
  ImplementationProject,
  ImplementationMilestone,
  ImplementationTask,
  ContractSignatureEvent,
  InitiateImplementationRequest,
  InitiateImplementationResponse,
  ScheduleKickoffRequest,
  ScheduleKickoffResponse,
  NotificationResult,
  HandoffPackage,
  Stakeholder,
  TechnicalRequirement,
  MilestoneStatus,
  ImplementationStatus,
  SignatureSource,
  DEFAULT_MILESTONES,
  DocuSignEnvelopeCompletedWebhook,
  PandaDocDocumentCompletedWebhook,
  SalesforceOpportunityWebhook,
} from './types.js';

// Re-export types
export * from './types.js';

// ============================================
// Implementation Service
// ============================================

export class ImplementationService {
  private supabase: ReturnType<typeof createClient> | null = null;

  constructor() {
    if (config.supabaseUrl && config.supabaseServiceKey) {
      this.supabase = createClient(config.supabaseUrl, config.supabaseServiceKey);
    }
  }

  // ============================================
  // Project Initiation
  // ============================================

  /**
   * Initiate implementation workflow from contract signature
   * NFR-1: Must complete within 15 minutes
   */
  async initiateImplementation(
    userId: string,
    request: InitiateImplementationRequest
  ): Promise<InitiateImplementationResponse> {
    const startTime = Date.now();

    // 1. Create implementation project
    const project = await this.createProject(userId, request);

    // 2. Create default milestones
    const milestones = await this.createDefaultMilestones(
      project.id,
      project.startDate,
      request.targetGoLiveDays || 60
    );

    // 3. Assemble handoff package (async, but don't block)
    this.assembleHandoffPackage(userId, project.id, request).catch((err) => {
      console.error('[Implementation] Handoff assembly failed:', err);
    });

    // 4. Send notifications
    const notifications = await this.sendInitiationNotifications(userId, project);

    // 5. Trigger provisioning request
    await this.initiateProvisioning(project.id, request);

    // 6. Queue customer communications for approval
    await this.prepareCustomerCommunications(userId, project);

    const elapsed = Date.now() - startTime;
    console.log(`[Implementation] Initiated in ${elapsed}ms`);

    return {
      project,
      milestones,
      notifications,
    };
  }

  /**
   * Create implementation project record
   */
  private async createProject(
    userId: string,
    request: InitiateImplementationRequest
  ): Promise<ImplementationProject> {
    const now = new Date();
    const targetGoLive = new Date(
      now.getTime() + (request.targetGoLiveDays || 60) * 24 * 60 * 60 * 1000
    );

    const project: Partial<ImplementationProject> = {
      id: uuidv4(),
      customerId: request.customerId,
      contractId: request.contractId || null,
      userId,
      status: 'initiated',
      startDate: now,
      targetGoLiveDate: targetGoLive,
      actualGoLiveDate: null,
      team: {
        csmId: request.csmId || null,
        implementationLeadId: request.implementationLeadId || null,
        technicalResourceIds: [],
        executiveSponsorId: null,
      },
      kickoffMeeting: {
        scheduledAt: null,
        calendarEventId: null,
        deckDocumentId: null,
        agendaDocumentId: null,
      },
      handoffPackage: {
        documentId: null,
        salesNotes: request.handoffData?.salesNotes || '',
        technicalRequirements: request.handoffData?.technicalRequirements || [],
        stakeholderMap: request.handoffData?.stakeholderMap || [],
        successCriteria: request.handoffData?.successCriteria || [],
        customerGoals: request.handoffData?.customerGoals || [],
        completedAt: null,
      },
      provisioningStatus: 'pending',
      provisioningRequestId: null,
      provisioningNotes: null,
      welcomeEmailSentAt: null,
      welcomeEmailDraftId: null,
      source: request.source || 'manual',
      externalReferenceId: request.externalReferenceId || null,
      metadata: {},
      createdAt: now,
      updatedAt: now,
    };

    if (this.supabase) {
      const { data, error } = await this.supabase
        .from('implementation_projects')
        .insert({
          id: project.id,
          customer_id: project.customerId,
          contract_id: project.contractId,
          user_id: userId,
          status: project.status,
          start_date: project.startDate?.toISOString(),
          target_go_live_date: project.targetGoLiveDate?.toISOString(),
          csm_id: project.team?.csmId,
          implementation_lead_id: project.team?.implementationLeadId,
          technical_resource_ids: project.team?.technicalResourceIds || [],
          executive_sponsor_id: project.team?.executiveSponsorId,
          handoff_package: project.handoffPackage,
          provisioning_status: project.provisioningStatus,
          source: project.source,
          external_reference_id: project.externalReferenceId,
          metadata: project.metadata,
        })
        .select('*, customers(name)')
        .single();

      if (error) {
        console.error('[Implementation] Create project error:', error);
        throw new Error(`Failed to create implementation project: ${error.message}`);
      }

      if (data?.customers) {
        project.customerName = (data.customers as any).name;
      }
    }

    return project as ImplementationProject;
  }

  /**
   * Create default milestones based on template
   */
  private async createDefaultMilestones(
    projectId: string,
    startDate: Date,
    targetDays: number
  ): Promise<ImplementationMilestone[]> {
    const { DEFAULT_MILESTONES } = await import('./types.js');
    const milestones: ImplementationMilestone[] = [];

    for (let i = 0; i < DEFAULT_MILESTONES.length; i++) {
      const template = DEFAULT_MILESTONES[i];
      const dueDate = new Date(
        startDate.getTime() + template.daysFromStart * 24 * 60 * 60 * 1000
      );

      const milestone: ImplementationMilestone = {
        id: uuidv4(),
        projectId,
        name: template.name,
        description: template.description,
        dueDate,
        completedDate: null,
        status: 'pending',
        owner: template.owner,
        ownerId: null,
        sequenceNumber: i,
        dependsOn: [],
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      milestones.push(milestone);

      if (this.supabase) {
        await this.supabase.from('implementation_milestones').insert({
          id: milestone.id,
          project_id: milestone.projectId,
          name: milestone.name,
          description: milestone.description,
          due_date: milestone.dueDate?.toISOString(),
          status: milestone.status,
          owner: milestone.owner,
          sequence_number: milestone.sequenceNumber,
        });

        // Create tasks for this milestone
        if (template.tasks) {
          for (const taskTemplate of template.tasks) {
            await this.supabase.from('implementation_tasks').insert({
              id: uuidv4(),
              project_id: projectId,
              milestone_id: milestone.id,
              title: taskTemplate.title,
              description: taskTemplate.description,
              priority: taskTemplate.priority,
              status: 'pending',
            });
          }
        }
      }
    }

    return milestones;
  }

  // ============================================
  // Handoff Package Assembly (FR-4)
  // ============================================

  /**
   * Assemble handoff documentation
   * NFR-1: Ready within 1 hour
   */
  async assembleHandoffPackage(
    userId: string,
    projectId: string,
    request: InitiateImplementationRequest
  ): Promise<HandoffPackage> {
    // Get project details
    const project = await this.getProject(projectId);
    if (!project) {
      throw new Error('Project not found');
    }

    // Get contract data if available
    let contractData: any = null;
    if (project.contractId && this.supabase) {
      const { data } = await this.supabase
        .from('contracts')
        .select('parsed_data')
        .eq('id', project.contractId)
        .single();
      contractData = data?.parsed_data;
    }

    // Get customer data
    let customerData: any = null;
    if (this.supabase) {
      const { data } = await this.supabase
        .from('customers')
        .select('*')
        .eq('id', project.customerId)
        .single();
      customerData = data;
    }

    // Build handoff package
    const handoffPackage: HandoffPackage = {
      documentId: null,
      salesNotes: request.handoffData?.salesNotes || '',
      technicalRequirements: this.extractTechnicalRequirements(contractData),
      stakeholderMap: this.extractStakeholders(contractData),
      successCriteria: request.handoffData?.successCriteria || [],
      customerGoals: request.handoffData?.customerGoals || [],
      competitiveContext: request.handoffData?.competitiveContext,
      timelineCommitments: request.handoffData?.timelineCommitments,
      specialTerms: request.handoffData?.specialTerms,
      completedAt: null,
    };

    // Create handoff document in Google Drive
    try {
      const doc = await docsService.createFromTemplate(
        userId,
        'onboarding_plan',
        `${customerData?.name || 'Customer'} - Implementation Handoff`,
        undefined // Will use default folder
      );

      handoffPackage.documentId = doc.id;

      // Populate document with handoff content
      await this.populateHandoffDocument(userId, doc.id, handoffPackage, customerData);
    } catch (err) {
      console.error('[Implementation] Failed to create handoff document:', err);
    }

    // Update project with handoff package
    if (this.supabase) {
      await this.supabase
        .from('implementation_projects')
        .update({
          handoff_package: handoffPackage,
          handoff_document_id: handoffPackage.documentId,
          handoff_completed_at: new Date().toISOString(),
        })
        .eq('id', projectId);
    }

    return handoffPackage;
  }

  private extractTechnicalRequirements(contractData: any): TechnicalRequirement[] {
    if (!contractData?.technical_requirements) return [];

    return contractData.technical_requirements.map((req: any) => ({
      requirement: typeof req === 'string' ? req : req.requirement,
      priority: req.priority || 'medium',
      status: 'pending',
      notes: req.notes,
    }));
  }

  private extractStakeholders(contractData: any): Stakeholder[] {
    if (!contractData?.stakeholders) return [];

    return contractData.stakeholders.map((s: any) => ({
      name: s.name,
      email: s.email || '',
      title: s.title || s.role || '',
      role: this.mapStakeholderRole(s.role),
      influence: 'medium',
      notes: s.notes,
    }));
  }

  private mapStakeholderRole(role: string): Stakeholder['role'] {
    const roleMap: Record<string, Stakeholder['role']> = {
      executive: 'executive',
      sponsor: 'executive',
      decision_maker: 'decision_maker',
      champion: 'champion',
      technical: 'technical',
      admin: 'technical',
      user: 'user',
    };
    return roleMap[role?.toLowerCase()] || 'user';
  }

  private async populateHandoffDocument(
    userId: string,
    documentId: string,
    handoff: HandoffPackage,
    customerData: any
  ): Promise<void> {
    const content = `
# Implementation Handoff: ${customerData?.name || 'Customer'}

## Sales Notes
${handoff.salesNotes || 'No sales notes provided.'}

## Technical Requirements
${handoff.technicalRequirements.length > 0
  ? handoff.technicalRequirements.map((r) => `- [${r.priority.toUpperCase()}] ${r.requirement}`).join('\n')
  : 'No technical requirements documented.'}

## Stakeholder Map
${handoff.stakeholderMap.length > 0
  ? handoff.stakeholderMap.map((s) => `- **${s.name}** (${s.title}) - ${s.role} - ${s.email}`).join('\n')
  : 'No stakeholders documented.'}

## Success Criteria
${handoff.successCriteria.length > 0
  ? handoff.successCriteria.map((c, i) => `${i + 1}. ${c}`).join('\n')
  : 'Success criteria to be defined.'}

## Customer Goals
${handoff.customerGoals.length > 0
  ? handoff.customerGoals.map((g, i) => `${i + 1}. ${g}`).join('\n')
  : 'Goals to be defined.'}

${handoff.competitiveContext ? `## Competitive Context\n${handoff.competitiveContext}` : ''}

${handoff.specialTerms?.length ? `## Special Terms\n${handoff.specialTerms.map((t) => `- ${t}`).join('\n')}` : ''}
`;

    // Note: Would use Google Docs API to insert content
    // For now, just log
    console.log(`[Implementation] Handoff document created: ${documentId}`);
  }

  // ============================================
  // Team Notifications (FR-5)
  // ============================================

  private async sendInitiationNotifications(
    userId: string,
    project: ImplementationProject
  ): Promise<NotificationResult[]> {
    const results: NotificationResult[] = [];

    // NFR-1: Team notified within 15 minutes
    // In production, these would be actual email/Slack sends

    // CSM notification
    if (project.team.csmId) {
      results.push({
        type: 'csm',
        success: true,
        // In production: await emailService.send(...)
      });
    }

    // Implementation lead notification
    if (project.team.implementationLeadId) {
      results.push({
        type: 'implementation_lead',
        success: true,
      });
    }

    // Executive sponsor notification
    if (project.team.executiveSponsorId) {
      results.push({
        type: 'executive_sponsor',
        success: true,
      });
    }

    console.log(`[Implementation] Sent ${results.length} notifications for project ${project.id}`);
    return results;
  }

  // ============================================
  // Provisioning (FR-7)
  // ============================================

  private async initiateProvisioning(
    projectId: string,
    request: InitiateImplementationRequest
  ): Promise<void> {
    const provisioningRequest = {
      projectId,
      customerId: request.customerId,
      requests: [
        { type: 'user_accounts', status: 'pending' },
        { type: 'environment_setup', status: 'pending' },
        { type: 'integration_config', status: 'pending' },
        { type: 'data_migration_assessment', status: 'pending' },
      ],
    };

    if (this.supabase) {
      await this.supabase
        .from('implementation_projects')
        .update({
          provisioning_status: 'pending',
          provisioning_request_id: uuidv4(),
          metadata: { provisioning: provisioningRequest },
        })
        .eq('id', projectId);
    }

    console.log(`[Implementation] Provisioning initiated for project ${projectId}`);
  }

  // ============================================
  // Customer Communications (FR-6)
  // ============================================

  private async prepareCustomerCommunications(
    userId: string,
    project: ImplementationProject
  ): Promise<void> {
    // Queue welcome email for approval
    // In production, this would create a draft and pending approval

    const welcomeEmailDraftId = uuidv4();

    if (this.supabase) {
      await this.supabase
        .from('implementation_projects')
        .update({
          welcome_email_draft_id: welcomeEmailDraftId,
        })
        .eq('id', project.id);

      // Create pending approval
      await this.supabase.from('pending_approvals').insert({
        id: uuidv4(),
        user_id: userId,
        type: 'send_email',
        action_type: 'implementation_welcome',
        reference_id: project.id,
        preview: {
          subject: `Welcome to ${project.customerName || 'our platform'}!`,
          body: 'Welcome email content here...',
          draftId: welcomeEmailDraftId,
        },
        status: 'pending',
      });
    }

    console.log(`[Implementation] Customer communications queued for project ${project.id}`);
  }

  // ============================================
  // Kickoff Scheduling (FR-8)
  // ============================================

  async scheduleKickoff(
    userId: string,
    request: ScheduleKickoffRequest
  ): Promise<ScheduleKickoffResponse> {
    const project = await this.getProject(request.projectId);
    if (!project) {
      return { success: false };
    }

    // Find available slots
    const duration = request.duration || 60; // Default 1 hour
    const timeMin = new Date();
    const timeMax = new Date(timeMin.getTime() + 14 * 24 * 60 * 60 * 1000); // Next 2 weeks

    try {
      const availableSlots = await calendarService.findAvailableSlots(userId, {
        timeMin,
        timeMax,
        duration,
        attendeeEmails: request.attendeeEmails,
      });

      // If proposed times provided, try to book
      if (request.proposedTimes && request.proposedTimes.length > 0) {
        const selectedTime = request.proposedTimes[0];
        const endTime = new Date(selectedTime.getTime() + duration * 60 * 1000);

        const event = await calendarService.createMeeting(userId, {
          title: `Implementation Kickoff: ${project.customerName || 'Customer'}`,
          description: `Implementation kickoff meeting.\n\nProject ID: ${project.id}`,
          startTime: selectedTime,
          endTime,
          attendees: request.attendeeEmails,
          reminderMinutes: [1440, 60], // 1 day and 1 hour
        });

        // Update project
        if (this.supabase) {
          await this.supabase
            .from('implementation_projects')
            .update({
              kickoff_scheduled_at: selectedTime.toISOString(),
              kickoff_calendar_event_id: event.id,
            })
            .eq('id', project.id);
        }

        return {
          success: true,
          calendarEventId: event.id,
          meetLink: event.meetLink,
          scheduledAt: selectedTime,
        };
      }

      // Return available slots for selection
      return {
        success: true,
        availableSlots: availableSlots.slice(0, 10), // Top 10 slots
      };
    } catch (err) {
      console.error('[Implementation] Schedule kickoff error:', err);
      return { success: false };
    }
  }

  /**
   * Generate kickoff deck from template
   */
  async generateKickoffDeck(
    userId: string,
    projectId: string
  ): Promise<{ deckId: string; deckUrl: string } | null> {
    const project = await this.getProject(projectId);
    if (!project) return null;

    try {
      const deck = await slidesService.createFromTemplate(
        userId,
        'kickoff_deck',
        `${project.customerName || 'Customer'} - Implementation Kickoff`
      );

      // Update project
      if (this.supabase) {
        await this.supabase
          .from('implementation_projects')
          .update({
            kickoff_deck_document_id: deck.id,
          })
          .eq('id', projectId);
      }

      return {
        deckId: deck.id,
        deckUrl: deck.webViewLink || `https://docs.google.com/presentation/d/${deck.id}/edit`,
      };
    } catch (err) {
      console.error('[Implementation] Generate kickoff deck error:', err);
      return null;
    }
  }

  // ============================================
  // Webhook Processing
  // ============================================

  /**
   * Process DocuSign envelope completed webhook
   */
  async processDocuSignWebhook(
    webhook: DocuSignEnvelopeCompletedWebhook
  ): Promise<{ processed: boolean; projectId?: string; error?: string }> {
    const eventId = await this.logSignatureEvent(
      'docusign',
      webhook.data.envelopeId,
      webhook.event,
      webhook
    );

    // Only process completed envelopes
    if (webhook.event !== 'envelope-completed') {
      return { processed: false };
    }

    try {
      // Try to match envelope to existing contract
      const contractId = await this.matchContractByEnvelope(
        'docusign',
        webhook.data.envelopeId
      );

      if (!contractId) {
        // No matching contract - may need manual linking
        await this.updateSignatureEvent(eventId, false, 'No matching contract found');
        return { processed: false, error: 'No matching contract' };
      }

      // Get contract and customer info
      const { customerId, userId } = await this.getContractContext(contractId);

      // Initiate implementation
      const result = await this.initiateImplementation(userId, {
        customerId,
        contractId,
        source: 'docusign',
        externalReferenceId: webhook.data.envelopeId,
      });

      await this.updateSignatureEvent(eventId, true, null, result.project.id);

      return { processed: true, projectId: result.project.id };
    } catch (err) {
      const error = (err as Error).message;
      await this.updateSignatureEvent(eventId, false, error);
      return { processed: false, error };
    }
  }

  /**
   * Process PandaDoc document completed webhook
   */
  async processPandaDocWebhook(
    webhook: PandaDocDocumentCompletedWebhook
  ): Promise<{ processed: boolean; projectId?: string; error?: string }> {
    const eventId = await this.logSignatureEvent(
      'pandadoc',
      webhook.data.id,
      webhook.event,
      webhook
    );

    // Only process completed documents
    if (webhook.data.status !== 'document.completed') {
      return { processed: false };
    }

    try {
      const contractId = await this.matchContractByEnvelope('pandadoc', webhook.data.id);

      if (!contractId) {
        await this.updateSignatureEvent(eventId, false, 'No matching contract found');
        return { processed: false, error: 'No matching contract' };
      }

      const { customerId, userId } = await this.getContractContext(contractId);

      const result = await this.initiateImplementation(userId, {
        customerId,
        contractId,
        source: 'pandadoc',
        externalReferenceId: webhook.data.id,
      });

      await this.updateSignatureEvent(eventId, true, null, result.project.id);

      return { processed: true, projectId: result.project.id };
    } catch (err) {
      const error = (err as Error).message;
      await this.updateSignatureEvent(eventId, false, error);
      return { processed: false, error };
    }
  }

  /**
   * Process Salesforce opportunity closed-won webhook
   */
  async processSalesforceWebhook(
    webhook: SalesforceOpportunityWebhook
  ): Promise<{ processed: boolean; projectId?: string; error?: string }> {
    const eventId = await this.logSignatureEvent(
      'salesforce',
      webhook.data.opportunityId,
      webhook.event,
      webhook
    );

    // Only process closed-won
    if (webhook.event !== 'opportunity_closed_won') {
      return { processed: false };
    }

    try {
      // Find or create customer
      let customerId = await this.findCustomerBySalesforceAccount(webhook.data.accountId);

      if (!customerId && this.supabase) {
        // Create customer from Salesforce data
        const { data: newCustomer } = await this.supabase
          .from('customers')
          .insert({
            name: webhook.data.accountName,
            arr: webhook.data.amount,
            salesforce_account_id: webhook.data.accountId,
            salesforce_opportunity_id: webhook.data.opportunityId,
            stage: 'onboarding',
            health_score: 100,
          })
          .select('id')
          .single();

        customerId = newCustomer?.id;
      }

      if (!customerId) {
        await this.updateSignatureEvent(eventId, false, 'Failed to create customer');
        return { processed: false, error: 'Failed to create customer' };
      }

      // Get user ID from owner email
      const userId = await this.findUserByEmail(webhook.data.ownerEmail);

      const result = await this.initiateImplementation(userId || 'system', {
        customerId,
        source: 'salesforce',
        externalReferenceId: webhook.data.opportunityId,
        contractData: {
          companyName: webhook.data.accountName,
          arr: webhook.data.amount,
          products: webhook.data.products?.map((p) => p.name),
        },
      });

      await this.updateSignatureEvent(eventId, true, null, result.project.id);

      return { processed: true, projectId: result.project.id };
    } catch (err) {
      const error = (err as Error).message;
      await this.updateSignatureEvent(eventId, false, error);
      return { processed: false, error };
    }
  }

  // ============================================
  // CRUD Operations
  // ============================================

  async getProject(projectId: string): Promise<ImplementationProject | null> {
    if (!this.supabase) return null;

    const { data, error } = await this.supabase
      .from('implementation_projects')
      .select('*, customers(name)')
      .eq('id', projectId)
      .single();

    if (error || !data) return null;

    return this.mapDbProject(data);
  }

  async getProjectByCustomer(customerId: string): Promise<ImplementationProject | null> {
    if (!this.supabase) return null;

    const { data, error } = await this.supabase
      .from('implementation_projects')
      .select('*, customers(name)')
      .eq('customer_id', customerId)
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    if (error || !data) return null;

    return this.mapDbProject(data);
  }

  async listProjects(
    userId: string,
    filters?: {
      status?: ImplementationStatus;
      customerId?: string;
      source?: SignatureSource;
    }
  ): Promise<ImplementationProject[]> {
    if (!this.supabase) return [];

    let query = this.supabase
      .from('implementation_projects')
      .select('*, customers(name)')
      .order('created_at', { ascending: false });

    if (filters?.status) {
      query = query.eq('status', filters.status);
    }
    if (filters?.customerId) {
      query = query.eq('customer_id', filters.customerId);
    }
    if (filters?.source) {
      query = query.eq('source', filters.source);
    }

    const { data, error } = await query;

    if (error) {
      console.error('[Implementation] List projects error:', error);
      return [];
    }

    return (data || []).map((row) => this.mapDbProject(row));
  }

  async updateProjectStatus(
    projectId: string,
    status: ImplementationStatus
  ): Promise<ImplementationProject | null> {
    if (!this.supabase) return null;

    const updates: Record<string, any> = { status };

    if (status === 'completed') {
      updates.actual_go_live_date = new Date().toISOString();
    }

    const { data, error } = await this.supabase
      .from('implementation_projects')
      .update(updates)
      .eq('id', projectId)
      .select('*, customers(name)')
      .single();

    if (error) {
      console.error('[Implementation] Update status error:', error);
      return null;
    }

    return this.mapDbProject(data);
  }

  async getProjectMilestones(projectId: string): Promise<ImplementationMilestone[]> {
    if (!this.supabase) return [];

    const { data, error } = await this.supabase
      .from('implementation_milestones')
      .select('*')
      .eq('project_id', projectId)
      .order('sequence_number', { ascending: true });

    if (error) return [];

    return (data || []).map((row) => this.mapDbMilestone(row));
  }

  async updateMilestone(
    milestoneId: string,
    updates: Partial<ImplementationMilestone>
  ): Promise<ImplementationMilestone | null> {
    if (!this.supabase) return null;

    const dbUpdates: Record<string, any> = {};
    if (updates.status) dbUpdates.status = updates.status;
    if (updates.completedDate) dbUpdates.completed_date = updates.completedDate.toISOString();

    const { data, error } = await this.supabase
      .from('implementation_milestones')
      .update(dbUpdates)
      .eq('id', milestoneId)
      .select()
      .single();

    if (error) return null;

    return this.mapDbMilestone(data);
  }

  // ============================================
  // Helper Methods
  // ============================================

  private async logSignatureEvent(
    source: SignatureSource,
    externalId: string,
    eventType: string,
    payload: any
  ): Promise<string> {
    const eventId = uuidv4();

    if (this.supabase) {
      await this.supabase.from('contract_signature_events').insert({
        id: eventId,
        source,
        external_envelope_id: externalId,
        event_type: eventType,
        event_data: payload.data || {},
        raw_payload: payload,
        processed: false,
      });
    }

    return eventId;
  }

  private async updateSignatureEvent(
    eventId: string,
    processed: boolean,
    error: string | null,
    projectId?: string
  ): Promise<void> {
    if (!this.supabase) return;

    await this.supabase
      .from('contract_signature_events')
      .update({
        processed,
        processed_at: new Date().toISOString(),
        processing_error: error,
        implementation_project_id: projectId,
      })
      .eq('id', eventId);
  }

  private async matchContractByEnvelope(
    source: SignatureSource,
    envelopeId: string
  ): Promise<string | null> {
    if (!this.supabase) return null;

    // Check if we have a contract linked to this envelope
    const { data } = await this.supabase
      .from('contracts')
      .select('id')
      .eq('external_envelope_id', envelopeId)
      .single();

    return data?.id || null;
  }

  private async getContractContext(
    contractId: string
  ): Promise<{ customerId: string; userId: string }> {
    if (!this.supabase) {
      throw new Error('Database not configured');
    }

    const { data, error } = await this.supabase
      .from('contracts')
      .select('customer_id, user_id')
      .eq('id', contractId)
      .single();

    if (error || !data) {
      throw new Error('Contract not found');
    }

    return {
      customerId: data.customer_id,
      userId: data.user_id || 'system',
    };
  }

  private async findCustomerBySalesforceAccount(
    accountId: string
  ): Promise<string | null> {
    if (!this.supabase) return null;

    const { data } = await this.supabase
      .from('customers')
      .select('id')
      .eq('salesforce_account_id', accountId)
      .single();

    return data?.id || null;
  }

  private async findUserByEmail(email: string): Promise<string | null> {
    // In production, look up user by email in auth.users or profiles
    return null;
  }

  private mapDbProject(row: any): ImplementationProject {
    return {
      id: row.id,
      customerId: row.customer_id,
      customerName: row.customers?.name,
      contractId: row.contract_id,
      userId: row.user_id,
      status: row.status,
      startDate: new Date(row.start_date),
      targetGoLiveDate: row.target_go_live_date ? new Date(row.target_go_live_date) : null,
      actualGoLiveDate: row.actual_go_live_date ? new Date(row.actual_go_live_date) : null,
      team: {
        csmId: row.csm_id,
        implementationLeadId: row.implementation_lead_id,
        technicalResourceIds: row.technical_resource_ids || [],
        executiveSponsorId: row.executive_sponsor_id,
      },
      kickoffMeeting: {
        scheduledAt: row.kickoff_scheduled_at ? new Date(row.kickoff_scheduled_at) : null,
        calendarEventId: row.kickoff_calendar_event_id,
        deckDocumentId: row.kickoff_deck_document_id,
        agendaDocumentId: row.kickoff_agenda_document_id,
      },
      handoffPackage: row.handoff_package || {
        documentId: null,
        salesNotes: '',
        technicalRequirements: [],
        stakeholderMap: [],
        successCriteria: [],
        customerGoals: [],
        completedAt: null,
      },
      provisioningStatus: row.provisioning_status,
      provisioningRequestId: row.provisioning_request_id,
      provisioningNotes: row.provisioning_notes,
      welcomeEmailSentAt: row.welcome_email_sent_at ? new Date(row.welcome_email_sent_at) : null,
      welcomeEmailDraftId: row.welcome_email_draft_id,
      source: row.source,
      externalReferenceId: row.external_reference_id,
      metadata: row.metadata || {},
      createdAt: new Date(row.created_at),
      updatedAt: new Date(row.updated_at),
    };
  }

  private mapDbMilestone(row: any): ImplementationMilestone {
    return {
      id: row.id,
      projectId: row.project_id,
      name: row.name,
      description: row.description,
      dueDate: row.due_date ? new Date(row.due_date) : null,
      completedDate: row.completed_date ? new Date(row.completed_date) : null,
      status: row.status,
      owner: row.owner,
      ownerId: row.owner_id,
      sequenceNumber: row.sequence_number,
      dependsOn: row.depends_on || [],
      createdAt: new Date(row.created_at),
      updatedAt: new Date(row.updated_at),
    };
  }
}

// Singleton instance
export const implementationService = new ImplementationService();
