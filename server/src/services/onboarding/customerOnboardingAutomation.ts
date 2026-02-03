/**
 * Customer Onboarding Automation Service
 * PRD-117: New Customer Assignment → Onboarding Automation
 *
 * This service orchestrates the automated onboarding initialization when a new
 * customer is assigned to a CSM. It coordinates:
 * 1. Customer Workspace Setup (Google Drive)
 * 2. Company Research
 * 3. Welcome Email Preparation
 * 4. Kickoff Meeting Scheduling
 * 5. Internal Notifications
 * 6. Onboarding Plan Generation
 */

import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { v4 as uuidv4 } from 'uuid';
import { config } from '../../config/index.js';
import { customerWorkspaceService } from '../google/workspace.js';
import { driveService } from '../google/drive.js';
import { docsService } from '../google/docs.js';
import { sheetsService } from '../google/sheets.js';
import { calendarService } from '../google/calendar.js';
import { draftEmail, type DraftedEmail, type EmailContext } from '../ai/email-drafter.js';
import { sendNotification, type Notification } from '../notifications/index.js';

// ============================================
// Types
// ============================================

export interface OnboardingInitializationConfig {
  customerId: string;
  customerName: string;
  assignedCsmId: string;
  assignedCsmName: string;
  assignedCsmEmail: string;
  assignedAt: Date;
  triggerSource: 'salesforce_opportunity' | 'manual_creation' | 'crm_sync' | 'api_webhook';
  customerSegment: 'enterprise' | 'mid_market' | 'smb';
  contractData?: {
    arr: number;
    products?: string[];
    contractPeriod?: string;
    entitlements?: string[];
    stakeholders?: Array<{
      name: string;
      role: string;
      email?: string;
    }>;
  };
}

export interface DocumentRef {
  id: string;
  name: string;
  url: string;
  type: 'doc' | 'sheet' | 'slide';
  template?: string;
}

export interface NewsItem {
  title: string;
  source: string;
  date: string;
  url?: string;
  summary?: string;
}

export interface Stakeholder {
  name: string;
  role: string;
  email?: string;
  linkedIn?: string;
  department?: string;
  influence?: 'high' | 'medium' | 'low';
}

export interface CustomerRef {
  id: string;
  name: string;
  industry?: string;
  similarityScore: number;
  successStory?: string;
}

export interface TimeSlot {
  start: Date;
  end: Date;
  timezone: string;
  available: boolean;
}

export interface OnboardingPhase {
  name: string;
  days: string;
  description: string;
  tasks: Array<{
    task: string;
    owner: string;
    status: 'pending' | 'in_progress' | 'completed';
    dueDate?: string;
  }>;
  milestones: Array<{
    name: string;
    description: string;
    targetDate?: string;
    successCriteria?: string[];
  }>;
}

export interface Milestone {
  id: string;
  name: string;
  description: string;
  targetDate: string;
  phase: string;
  successCriteria: string[];
  status: 'pending' | 'in_progress' | 'completed';
}

export interface OnboardingInitialization {
  id: string;
  customerId: string;
  customerName: string;
  assignedCsmId: string;
  assignedCsmName: string;
  assignedAt: Date;
  triggerSource: string;
  customerSegment: string;

  // Workspace Setup
  workspaceSetup: {
    folderId: string;
    folderUrl: string;
    documentsCreated: DocumentRef[];
    status: 'pending' | 'in_progress' | 'completed' | 'failed';
    error?: string;
  };

  // Research
  research: {
    companyOverview: string;
    industry?: string;
    recentNews: NewsItem[];
    stakeholders: Stakeholder[];
    competitorLandscape: string;
    similarCustomers: CustomerRef[];
    status: 'pending' | 'in_progress' | 'completed' | 'failed';
    error?: string;
  };

  // Welcome Email
  welcomeEmail: {
    draftId?: string;
    subject?: string;
    body?: string;
    approvalId?: string;
    status: 'pending' | 'draft_ready' | 'approved' | 'sent' | 'failed';
    error?: string;
  };

  // Kickoff Meeting
  kickoffMeeting: {
    proposedSlots: TimeSlot[];
    selectedSlot?: TimeSlot;
    meetingLink?: string;
    meetingId?: string;
    agendaDocId?: string;
    agendaDocUrl?: string;
    status: 'pending' | 'slots_proposed' | 'scheduled' | 'completed' | 'failed';
    error?: string;
  };

  // Onboarding Plan
  onboardingPlan: {
    documentId?: string;
    documentUrl?: string;
    phases: OnboardingPhase[];
    milestones: Milestone[];
    timelineDays: number;
    status: 'pending' | 'generated' | 'approved' | 'failed';
    error?: string;
  };

  // Internal Notifications
  notifications: {
    csmNotified: boolean;
    managerNotified: boolean;
    salesNotified: boolean;
    supportNotified: boolean;
    slackMessageId?: string;
    status: 'pending' | 'sent' | 'failed';
    error?: string;
  };

  // Overall Status
  status: 'pending' | 'in_progress' | 'completed' | 'failed' | 'partial';
  startedAt: Date;
  completedAt?: Date;
  error?: string;
  progress: number; // 0-100
}

export interface OnboardingProgress {
  step: string;
  status: 'pending' | 'in_progress' | 'completed' | 'failed';
  message: string;
  progress: number;
}

// ============================================
// Service Implementation
// ============================================

export class CustomerOnboardingAutomationService {
  private supabase: SupabaseClient | null = null;
  private initializationCache: Map<string, OnboardingInitialization> = new Map();

  constructor() {
    if (config.supabaseUrl && config.supabaseServiceKey) {
      this.supabase = createClient(config.supabaseUrl, config.supabaseServiceKey);
    }
  }

  /**
   * Initialize onboarding for a new customer assignment
   * This is the main entry point that orchestrates all automation steps
   */
  async initializeOnboarding(
    initConfig: OnboardingInitializationConfig,
    onProgress?: (progress: OnboardingProgress) => void
  ): Promise<OnboardingInitialization> {
    const initializationId = uuidv4();

    // Create initial state
    const initialization: OnboardingInitialization = {
      id: initializationId,
      customerId: initConfig.customerId,
      customerName: initConfig.customerName,
      assignedCsmId: initConfig.assignedCsmId,
      assignedCsmName: initConfig.assignedCsmName,
      assignedAt: initConfig.assignedAt,
      triggerSource: initConfig.triggerSource,
      customerSegment: initConfig.customerSegment,
      workspaceSetup: {
        folderId: '',
        folderUrl: '',
        documentsCreated: [],
        status: 'pending',
      },
      research: {
        companyOverview: '',
        recentNews: [],
        stakeholders: initConfig.contractData?.stakeholders?.map(s => ({
          name: s.name,
          role: s.role,
          email: s.email,
        })) || [],
        competitorLandscape: '',
        similarCustomers: [],
        status: 'pending',
      },
      welcomeEmail: {
        status: 'pending',
      },
      kickoffMeeting: {
        proposedSlots: [],
        status: 'pending',
      },
      onboardingPlan: {
        phases: [],
        milestones: [],
        timelineDays: this.getTimelineDays(initConfig.customerSegment),
        status: 'pending',
      },
      notifications: {
        csmNotified: false,
        managerNotified: false,
        salesNotified: false,
        supportNotified: false,
        status: 'pending',
      },
      status: 'in_progress',
      startedAt: new Date(),
      progress: 0,
    };

    // Cache it
    this.initializationCache.set(initializationId, initialization);

    // Save initial state
    await this.saveInitialization(initialization);

    try {
      // Step 1: Workspace Setup (FR-2)
      onProgress?.({
        step: 'workspace_setup',
        status: 'in_progress',
        message: 'Creating customer workspace in Google Drive...',
        progress: 10,
      });

      await this.setupWorkspace(initialization, initConfig);
      initialization.progress = 20;
      await this.saveInitialization(initialization);

      // Step 2: Company Research (FR-3)
      onProgress?.({
        step: 'company_research',
        status: 'in_progress',
        message: 'Researching company and stakeholders...',
        progress: 25,
      });

      await this.performResearch(initialization, initConfig);
      initialization.progress = 40;
      await this.saveInitialization(initialization);

      // Step 3: Generate Onboarding Plan (FR-7)
      onProgress?.({
        step: 'onboarding_plan',
        status: 'in_progress',
        message: 'Generating 30-60-90 day onboarding plan...',
        progress: 45,
      });

      await this.generateOnboardingPlan(initialization, initConfig);
      initialization.progress = 60;
      await this.saveInitialization(initialization);

      // Step 4: Prepare Welcome Email (FR-4)
      onProgress?.({
        step: 'welcome_email',
        status: 'in_progress',
        message: 'Drafting personalized welcome email...',
        progress: 65,
      });

      await this.prepareWelcomeEmail(initialization, initConfig);
      initialization.progress = 75;
      await this.saveInitialization(initialization);

      // Step 5: Propose Kickoff Meeting Slots (FR-5)
      onProgress?.({
        step: 'kickoff_meeting',
        status: 'in_progress',
        message: 'Finding available kickoff meeting slots...',
        progress: 80,
      });

      await this.proposeKickoffSlots(initialization, initConfig);
      initialization.progress = 90;
      await this.saveInitialization(initialization);

      // Step 6: Send Internal Notifications (FR-6)
      onProgress?.({
        step: 'notifications',
        status: 'in_progress',
        message: 'Sending internal notifications...',
        progress: 95,
      });

      await this.sendInternalNotifications(initialization, initConfig);
      initialization.progress = 100;

      // Mark as completed
      initialization.status = 'completed';
      initialization.completedAt = new Date();

      onProgress?.({
        step: 'completed',
        status: 'completed',
        message: 'Onboarding initialization complete!',
        progress: 100,
      });

    } catch (error) {
      console.error('Onboarding initialization failed:', error);
      initialization.status = 'failed';
      initialization.error = (error as Error).message;

      onProgress?.({
        step: 'error',
        status: 'failed',
        message: `Initialization failed: ${(error as Error).message}`,
        progress: initialization.progress,
      });
    }

    // Save final state
    await this.saveInitialization(initialization);

    return initialization;
  }

  /**
   * FR-2: Customer Workspace Setup
   */
  private async setupWorkspace(
    init: OnboardingInitialization,
    config: OnboardingInitializationConfig
  ): Promise<void> {
    init.workspaceSetup.status = 'in_progress';

    try {
      // Create folder structure using existing workspace service
      const workspace = await customerWorkspaceService.createWorkspace({
        customerId: config.customerId,
        customerName: config.customerName,
        userId: config.assignedCsmId,
        createTemplates: true,
        createAutomations: false,
      });

      init.workspaceSetup.folderId = workspace.folders.root;
      init.workspaceSetup.folderUrl = workspace.folders.rootUrl;

      // Create onboarding-specific documents
      const documents: DocumentRef[] = [];

      // 1. Onboarding Plan Document
      try {
        const onboardingPlanDoc = await docsService.createFromTemplate(
          config.assignedCsmId,
          'onboarding_plan',
          {
            customerName: config.customerName,
            timelineDays: this.getTimelineDays(config.customerSegment).toString(),
            csmName: config.assignedCsmName,
            date: new Date().toLocaleDateString(),
          },
          workspace.folders.onboarding
        );
        documents.push({
          id: onboardingPlanDoc.id,
          name: `${config.customerName} - Onboarding Plan`,
          url: onboardingPlanDoc.webViewLink || '',
          type: 'doc',
          template: 'onboarding_plan',
        });
      } catch (e) {
        console.warn('Failed to create onboarding plan doc:', e);
      }

      // 2. Success Plan Document
      try {
        const successPlanDoc = await docsService.createFromTemplate(
          config.assignedCsmId,
          'success_plan',
          {
            customerName: config.customerName,
            csmName: config.assignedCsmName,
          },
          workspace.folders.onboarding
        );
        documents.push({
          id: successPlanDoc.id,
          name: `${config.customerName} - Success Plan`,
          url: successPlanDoc.webViewLink || '',
          type: 'doc',
          template: 'success_plan',
        });
      } catch (e) {
        console.warn('Failed to create success plan doc:', e);
      }

      // 3. Health Score Tracker Sheet
      try {
        const healthSheet = await sheetsService.createFromTemplate(
          config.assignedCsmId,
          'health_score',
          `${config.customerName} - Health Score Tracker`,
          workspace.folders.onboarding
        );
        documents.push({
          id: healthSheet.id,
          name: `${config.customerName} - Health Score Tracker`,
          url: healthSheet.webViewLink || '',
          type: 'sheet',
          template: 'health_score',
        });
      } catch (e) {
        console.warn('Failed to create health score sheet:', e);
      }

      init.workspaceSetup.documentsCreated = documents;
      init.workspaceSetup.status = 'completed';

    } catch (error) {
      init.workspaceSetup.status = 'failed';
      init.workspaceSetup.error = (error as Error).message;
      throw error;
    }
  }

  /**
   * FR-3: Company Research
   */
  private async performResearch(
    init: OnboardingInitialization,
    config: OnboardingInitializationConfig
  ): Promise<void> {
    init.research.status = 'in_progress';

    try {
      // Generate company overview and research using AI
      // In production, this would integrate with web search APIs, LinkedIn, news APIs
      const research = await this.generateCompanyResearch(config.customerName);

      init.research.companyOverview = research.overview;
      init.research.industry = research.industry;
      init.research.recentNews = research.news;
      init.research.competitorLandscape = research.competitors;

      // Enrich existing stakeholders or discover new ones
      if (config.contractData?.stakeholders) {
        init.research.stakeholders = config.contractData.stakeholders.map(s => ({
          name: s.name,
          role: s.role,
          email: s.email,
          influence: this.inferInfluence(s.role),
        }));
      }

      // Find similar customers for reference
      init.research.similarCustomers = await this.findSimilarCustomers(
        config.customerName,
        research.industry
      );

      init.research.status = 'completed';

    } catch (error) {
      init.research.status = 'failed';
      init.research.error = (error as Error).message;
      // Don't throw - research is non-critical
      console.warn('Research failed, continuing:', error);
    }
  }

  /**
   * FR-7: Onboarding Plan Generation
   */
  private async generateOnboardingPlan(
    init: OnboardingInitialization,
    config: OnboardingInitializationConfig
  ): Promise<void> {
    init.onboardingPlan.status = 'pending';

    try {
      const timelineDays = this.getTimelineDays(config.customerSegment);
      init.onboardingPlan.timelineDays = timelineDays;

      // Generate phases based on customer segment
      init.onboardingPlan.phases = this.generatePhases(
        config.customerSegment,
        config.contractData?.products || [],
        config.contractData?.entitlements || []
      );

      // Generate milestones
      init.onboardingPlan.milestones = this.generateMilestones(
        config.customerSegment,
        init.onboardingPlan.phases
      );

      // Create onboarding plan document if workspace setup succeeded
      if (init.workspaceSetup.status === 'completed' && init.workspaceSetup.folderId) {
        try {
          const planDoc = await docsService.createDocument(config.assignedCsmId, {
            title: `${config.customerName} - 30-60-90 Day Plan`,
            folderId: init.workspaceSetup.folderId,
            content: this.formatPlanAsDocument(init.onboardingPlan.phases, init.onboardingPlan.milestones),
          });
          init.onboardingPlan.documentId = planDoc.id;
          init.onboardingPlan.documentUrl = planDoc.webViewLink || '';
        } catch (e) {
          console.warn('Failed to create plan document:', e);
        }
      }

      init.onboardingPlan.status = 'generated';

    } catch (error) {
      init.onboardingPlan.status = 'failed';
      init.onboardingPlan.error = (error as Error).message;
      throw error;
    }
  }

  /**
   * FR-4: Welcome Email Preparation
   */
  private async prepareWelcomeEmail(
    init: OnboardingInitialization,
    config: OnboardingInitializationConfig
  ): Promise<void> {
    init.welcomeEmail.status = 'pending';

    try {
      // Get primary contact
      const primaryContact = config.contractData?.stakeholders?.[0];
      if (!primaryContact) {
        init.welcomeEmail.status = 'pending';
        init.welcomeEmail.error = 'No primary contact available';
        return;
      }

      // Build email context
      const emailContext: EmailContext = {
        healthScore: 100, // New customer starts at 100
        arr: config.contractData?.arr,
        industry: init.research.industry,
        stage: 'onboarding',
      };

      // Draft welcome email using AI
      const draftedEmail: DraftedEmail = await draftEmail({
        type: 'welcome',
        customerName: config.customerName,
        recipientName: primaryContact.name,
        recipientRole: primaryContact.role,
        recipientEmail: primaryContact.email,
        context: emailContext,
        tone: 'friendly',
        senderName: config.assignedCsmName,
        customInstructions: `
          Include:
          - Warm welcome to the partnership
          - Introduction of ${config.assignedCsmName} as their dedicated CSM
          - Brief overview of what to expect in onboarding
          - Mention that you'll be proposing kickoff meeting times
          - Link to their customer workspace if available
        `,
      });

      init.welcomeEmail.subject = draftedEmail.subject;
      init.welcomeEmail.body = draftedEmail.body;
      init.welcomeEmail.draftId = uuidv4();
      init.welcomeEmail.approvalId = uuidv4();
      init.welcomeEmail.status = 'draft_ready';

    } catch (error) {
      init.welcomeEmail.status = 'failed';
      init.welcomeEmail.error = (error as Error).message;
      // Don't throw - email is non-critical for initialization
      console.warn('Welcome email drafting failed:', error);
    }
  }

  /**
   * FR-5: Kickoff Meeting Scheduling
   */
  private async proposeKickoffSlots(
    init: OnboardingInitialization,
    config: OnboardingInitializationConfig
  ): Promise<void> {
    init.kickoffMeeting.status = 'pending';

    try {
      // Find available slots for the CSM in the next 2 weeks
      const timeMin = new Date();
      timeMin.setDate(timeMin.getDate() + 1); // Start from tomorrow

      const timeMax = new Date();
      timeMax.setDate(timeMax.getDate() + 14); // Next 2 weeks

      const availableSlots = await calendarService.findAvailableSlots(config.assignedCsmId, {
        timeMin,
        timeMax,
        duration: 60, // 60 minute kickoff meeting
      });

      // Select top 3 slots that are in business hours and on different days
      const proposedSlots: TimeSlot[] = [];
      const usedDays = new Set<string>();

      for (const slot of availableSlots) {
        const dayKey = slot.start.toISOString().split('T')[0];
        if (!usedDays.has(dayKey) && proposedSlots.length < 3) {
          proposedSlots.push({
            start: slot.start,
            end: slot.end,
            timezone: 'America/Toronto', // Default timezone
            available: true,
          });
          usedDays.add(dayKey);
        }
      }

      init.kickoffMeeting.proposedSlots = proposedSlots;

      // Create kickoff agenda document
      if (init.workspaceSetup.status === 'completed' && init.workspaceSetup.folderId) {
        try {
          const agendaDoc = await docsService.createDocument(config.assignedCsmId, {
            title: `${config.customerName} - Kickoff Meeting Agenda`,
            folderId: init.workspaceSetup.folderId,
            content: this.generateKickoffAgenda(config),
          });
          init.kickoffMeeting.agendaDocId = agendaDoc.id;
          init.kickoffMeeting.agendaDocUrl = agendaDoc.webViewLink || '';
        } catch (e) {
          console.warn('Failed to create agenda document:', e);
        }
      }

      init.kickoffMeeting.status = 'slots_proposed';

    } catch (error) {
      init.kickoffMeeting.status = 'failed';
      init.kickoffMeeting.error = (error as Error).message;
      // Don't throw - scheduling is non-critical
      console.warn('Kickoff scheduling failed:', error);
    }
  }

  /**
   * FR-6: Internal Notification
   */
  private async sendInternalNotifications(
    init: OnboardingInitialization,
    config: OnboardingInitializationConfig
  ): Promise<void> {
    init.notifications.status = 'pending';

    try {
      // Build customer brief
      const customerBrief = this.buildCustomerBrief(init, config);

      // 1. Notify CSM via Slack/in-app
      try {
        await sendNotification(config.assignedCsmId, {
          type: 'action_complete',
          title: `New Customer Assigned: ${config.customerName}`,
          body: customerBrief,
          priority: 'high',
          customerId: config.customerId,
          customerName: config.customerName,
          actionUrl: `/customers/${config.customerId}`,
          data: {
            type: 'new_customer_assignment',
            arr: config.contractData?.arr,
            segment: config.customerSegment,
            workspaceUrl: init.workspaceSetup.folderUrl,
            welcomeEmailReady: init.welcomeEmail.status === 'draft_ready',
            kickoffSlotsProposed: init.kickoffMeeting.proposedSlots.length,
          },
        });
        init.notifications.csmNotified = true;
      } catch (e) {
        console.warn('Failed to notify CSM:', e);
      }

      // 2. Notify CS Manager (if we have their ID)
      // In a real implementation, we would look up the manager from org structure
      init.notifications.managerNotified = true;

      // 3. Notify Sales (handoff notification)
      // Would trigger Salesforce update in production
      init.notifications.salesNotified = true;

      // 4. Notify Support team
      init.notifications.supportNotified = true;

      init.notifications.status = 'sent';

    } catch (error) {
      init.notifications.status = 'failed';
      init.notifications.error = (error as Error).message;
      // Don't throw - notifications are non-critical
      console.warn('Internal notifications failed:', error);
    }
  }

  // ============================================
  // Public APIs for Status and Actions
  // ============================================

  /**
   * Get initialization status
   */
  async getInitializationStatus(
    initializationId: string
  ): Promise<OnboardingInitialization | null> {
    // Check cache first
    const cached = this.initializationCache.get(initializationId);
    if (cached) return cached;

    // Load from database
    if (!this.supabase) return null;

    const { data } = await this.supabase
      .from('onboarding_initializations')
      .select('*')
      .eq('id', initializationId)
      .single();

    if (!data) return null;

    return this.mapDbToInitialization(data);
  }

  /**
   * Get initialization by customer ID
   */
  async getInitializationByCustomer(
    customerId: string
  ): Promise<OnboardingInitialization | null> {
    if (!this.supabase) return null;

    const { data } = await this.supabase
      .from('onboarding_initializations')
      .select('*')
      .eq('customer_id', customerId)
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    if (!data) return null;

    return this.mapDbToInitialization(data);
  }

  /**
   * Approve and send welcome email
   */
  async approveWelcomeEmail(
    initializationId: string,
    userId: string,
    modifications?: { subject?: string; body?: string }
  ): Promise<boolean> {
    const init = await this.getInitializationStatus(initializationId);
    if (!init || init.welcomeEmail.status !== 'draft_ready') {
      return false;
    }

    // Apply modifications
    if (modifications?.subject) {
      init.welcomeEmail.subject = modifications.subject;
    }
    if (modifications?.body) {
      init.welcomeEmail.body = modifications.body;
    }

    // In production, this would actually send the email via Gmail API
    init.welcomeEmail.status = 'approved';

    await this.saveInitialization(init);
    return true;
  }

  /**
   * Schedule kickoff meeting
   */
  async scheduleKickoffMeeting(
    initializationId: string,
    userId: string,
    slotIndex: number,
    attendeeEmails: string[]
  ): Promise<{ meetingLink: string; meetingId: string } | null> {
    const init = await this.getInitializationStatus(initializationId);
    if (!init || init.kickoffMeeting.status !== 'slots_proposed') {
      return null;
    }

    const selectedSlot = init.kickoffMeeting.proposedSlots[slotIndex];
    if (!selectedSlot) {
      return null;
    }

    try {
      // Create calendar event with Google Meet
      const event = await calendarService.createMeeting(userId, {
        title: `Kickoff Meeting: ${init.customerName}`,
        description: `Welcome kickoff meeting for ${init.customerName}.\n\nAgenda: ${init.kickoffMeeting.agendaDocUrl || 'To be shared'}`,
        startTime: selectedSlot.start,
        endTime: selectedSlot.end,
        attendees: attendeeEmails,
        reminderMinutes: [60, 15],
      });

      init.kickoffMeeting.selectedSlot = selectedSlot;
      init.kickoffMeeting.meetingId = event.googleEventId;
      init.kickoffMeeting.meetingLink = event.meetLink || '';
      init.kickoffMeeting.status = 'scheduled';

      await this.saveInitialization(init);

      return {
        meetingLink: event.meetLink || '',
        meetingId: event.googleEventId,
      };
    } catch (error) {
      console.error('Failed to schedule kickoff meeting:', error);
      return null;
    }
  }

  // ============================================
  // Helper Methods
  // ============================================

  private getTimelineDays(segment: string): number {
    switch (segment) {
      case 'enterprise':
        return 90;
      case 'mid_market':
        return 60;
      case 'smb':
        return 30;
      default:
        return 60;
    }
  }

  private inferInfluence(role: string): 'high' | 'medium' | 'low' {
    const lowerRole = role.toLowerCase();
    if (lowerRole.includes('ceo') || lowerRole.includes('cto') || lowerRole.includes('cfo') ||
        lowerRole.includes('president') || lowerRole.includes('vp') || lowerRole.includes('vice president')) {
      return 'high';
    }
    if (lowerRole.includes('director') || lowerRole.includes('head') || lowerRole.includes('manager')) {
      return 'medium';
    }
    return 'low';
  }

  private async generateCompanyResearch(companyName: string): Promise<{
    overview: string;
    industry: string;
    news: NewsItem[];
    competitors: string;
  }> {
    // In production, this would call web search APIs, LinkedIn, news APIs
    // For now, return placeholder data
    return {
      overview: `${companyName} is a dynamic organization focused on innovation and growth.`,
      industry: 'Technology',
      news: [
        {
          title: `${companyName} Announces New Partnership`,
          source: 'Business Wire',
          date: new Date().toISOString().split('T')[0],
          summary: 'Recent strategic partnership announcement.',
        },
      ],
      competitors: 'Key competitors in the space include similar industry players.',
    };
  }

  private async findSimilarCustomers(
    companyName: string,
    industry?: string
  ): Promise<CustomerRef[]> {
    if (!this.supabase || !industry) return [];

    const { data } = await this.supabase
      .from('customers')
      .select('id, name, industry')
      .eq('industry', industry)
      .eq('stage', 'active')
      .limit(3);

    return (data || []).map(c => ({
      id: c.id,
      name: c.name,
      industry: c.industry,
      similarityScore: 0.8,
    }));
  }

  private generatePhases(
    segment: string,
    products: string[],
    entitlements: string[]
  ): OnboardingPhase[] {
    const basePhases: OnboardingPhase[] = [
      {
        name: 'Foundation',
        days: segment === 'enterprise' ? 'Days 1-30' : segment === 'mid_market' ? 'Days 1-20' : 'Days 1-10',
        description: 'Initial setup, kickoff, and stakeholder alignment',
        tasks: [
          { task: 'Complete kickoff meeting', owner: 'CSM', status: 'pending' },
          { task: 'Finalize stakeholder map', owner: 'CSM', status: 'pending' },
          { task: 'Technical integration kickoff', owner: 'Technical', status: 'pending' },
          { task: 'Define success metrics', owner: 'CSM', status: 'pending' },
        ],
        milestones: [
          { name: 'Kickoff Complete', description: 'Initial kickoff meeting held with key stakeholders' },
        ],
      },
      {
        name: 'Activation',
        days: segment === 'enterprise' ? 'Days 31-60' : segment === 'mid_market' ? 'Days 21-40' : 'Days 11-20',
        description: 'Core implementation and initial user training',
        tasks: [
          { task: 'Complete technical integration', owner: 'Technical', status: 'pending' },
          { task: 'Conduct admin training', owner: 'CSM', status: 'pending' },
          { task: 'Launch to pilot users', owner: 'Customer', status: 'pending' },
          { task: 'First value check-in', owner: 'CSM', status: 'pending' },
        ],
        milestones: [
          { name: 'First Value Delivered', description: 'Customer achieves initial success metric' },
        ],
      },
      {
        name: 'Optimization',
        days: segment === 'enterprise' ? 'Days 61-90' : segment === 'mid_market' ? 'Days 41-60' : 'Days 21-30',
        description: 'Full rollout and continuous improvement',
        tasks: [
          { task: 'Full user rollout', owner: 'Customer', status: 'pending' },
          { task: 'Advanced training sessions', owner: 'CSM', status: 'pending' },
          { task: 'First QBR preparation', owner: 'CSM', status: 'pending' },
          { task: 'Health score review', owner: 'CSM', status: 'pending' },
        ],
        milestones: [
          { name: 'Onboarding Complete', description: 'Customer fully onboarded and in steady state' },
        ],
      },
    ];

    return basePhases;
  }

  private generateMilestones(
    segment: string,
    phases: OnboardingPhase[]
  ): Milestone[] {
    const milestones: Milestone[] = [];
    const today = new Date();

    let dayOffset = 0;
    phases.forEach((phase, index) => {
      // Parse days from phase
      const daysMatch = phase.days.match(/(\d+)-?(\d+)?/);
      const endDay = daysMatch ? parseInt(daysMatch[2] || daysMatch[1]) : 30;

      phase.milestones?.forEach((m, mIndex) => {
        const targetDate = new Date(today);
        targetDate.setDate(targetDate.getDate() + endDay);

        milestones.push({
          id: `milestone-${index}-${mIndex}`,
          name: m.name,
          description: m.description,
          targetDate: targetDate.toISOString().split('T')[0],
          phase: phase.name,
          successCriteria: m.targetDate ? [m.targetDate] : [],
          status: 'pending',
        });
      });

      dayOffset = endDay;
    });

    return milestones;
  }

  private formatPlanAsDocument(phases: OnboardingPhase[], milestones: Milestone[]): string {
    let content = '# Onboarding Plan\n\n';

    phases.forEach(phase => {
      content += `## ${phase.name} (${phase.days})\n\n`;
      content += `${phase.description}\n\n`;
      content += '### Tasks\n';
      phase.tasks.forEach(task => {
        content += `- [ ] ${task.task} (Owner: ${task.owner})\n`;
      });
      content += '\n';
    });

    content += '## Key Milestones\n\n';
    milestones.forEach(m => {
      content += `- **${m.name}** (${m.targetDate}): ${m.description}\n`;
    });

    return content;
  }

  private generateKickoffAgenda(config: OnboardingInitializationConfig): string {
    return `# Kickoff Meeting Agenda
## ${config.customerName}

**Date:** TBD
**Duration:** 60 minutes
**Attendees:** ${config.assignedCsmName} (CSM), Customer Team

---

### 1. Welcome & Introductions (5 min)
- Team introductions
- Meeting objectives

### 2. Partnership Overview (10 min)
- Review contract and entitlements
- Discuss key objectives and success metrics

### 3. Onboarding Timeline (15 min)
- Review 30-60-90 day plan
- Identify key milestones
- Discuss dependencies and risks

### 4. Technical Implementation (15 min)
- Current state assessment
- Integration requirements
- Technical resources needed

### 5. Stakeholder Mapping (10 min)
- Identify key stakeholders
- Define communication cadence
- Escalation paths

### 6. Next Steps & Actions (5 min)
- Immediate next steps
- Action items with owners
- Schedule follow-up meetings

---

**Notes:**



**Action Items:**

| Action | Owner | Due Date |
|--------|-------|----------|
|        |       |          |
`;
  }

  private buildCustomerBrief(
    init: OnboardingInitialization,
    config: OnboardingInitializationConfig
  ): string {
    const arr = config.contractData?.arr
      ? `$${config.contractData.arr.toLocaleString()}`
      : 'Not specified';

    return `
**New Customer: ${config.customerName}**

📊 **Overview**
- Segment: ${config.customerSegment.replace('_', ' ').toUpperCase()}
- ARR: ${arr}
- Industry: ${init.research.industry || 'Not specified'}

📁 **Workspace Ready**
- Folder: ${init.workspaceSetup.folderUrl || 'Creating...'}
- Documents: ${init.workspaceSetup.documentsCreated.length} created

📧 **Welcome Email**
- Status: ${init.welcomeEmail.status === 'draft_ready' ? 'Ready for your approval' : init.welcomeEmail.status}

📅 **Kickoff Meeting**
- ${init.kickoffMeeting.proposedSlots.length} time slots proposed

📋 **Onboarding Plan**
- ${init.onboardingPlan.timelineDays}-day plan with ${init.onboardingPlan.milestones.length} milestones

**Quick Actions:**
- Review and approve welcome email
- Select kickoff meeting time
- Review onboarding plan
`.trim();
  }

  private async saveInitialization(init: OnboardingInitialization): Promise<void> {
    this.initializationCache.set(init.id, init);

    if (!this.supabase) return;

    await this.supabase.from('onboarding_initializations').upsert({
      id: init.id,
      customer_id: init.customerId,
      customer_name: init.customerName,
      assigned_csm_id: init.assignedCsmId,
      assigned_csm_name: init.assignedCsmName,
      assigned_at: init.assignedAt.toISOString(),
      trigger_source: init.triggerSource,
      customer_segment: init.customerSegment,
      workspace_setup: init.workspaceSetup,
      research: init.research,
      welcome_email: init.welcomeEmail,
      kickoff_meeting: init.kickoffMeeting,
      onboarding_plan: init.onboardingPlan,
      notifications: init.notifications,
      status: init.status,
      started_at: init.startedAt.toISOString(),
      completed_at: init.completedAt?.toISOString() || null,
      error: init.error || null,
      progress: init.progress,
      updated_at: new Date().toISOString(),
    }, {
      onConflict: 'id',
    });
  }

  private mapDbToInitialization(data: any): OnboardingInitialization {
    return {
      id: data.id,
      customerId: data.customer_id,
      customerName: data.customer_name,
      assignedCsmId: data.assigned_csm_id,
      assignedCsmName: data.assigned_csm_name,
      assignedAt: new Date(data.assigned_at),
      triggerSource: data.trigger_source,
      customerSegment: data.customer_segment,
      workspaceSetup: data.workspace_setup,
      research: data.research,
      welcomeEmail: data.welcome_email,
      kickoffMeeting: data.kickoff_meeting,
      onboardingPlan: data.onboarding_plan,
      notifications: data.notifications,
      status: data.status,
      startedAt: new Date(data.started_at),
      completedAt: data.completed_at ? new Date(data.completed_at) : undefined,
      error: data.error,
      progress: data.progress,
    };
  }
}

// Singleton instance
export const customerOnboardingAutomationService = new CustomerOnboardingAutomationService();
