/**
 * Customer Workspace Service
 * Manages per-customer Google Workspace isolation and context
 * All customer folders are created within the default CSCX folder
 */

import { createClient } from '@supabase/supabase-js';
import { config } from '../../config/index.js';
import { driveService } from './drive.js';
import { docsService } from './docs.js';
import { sheetsService } from './sheets.js';
import { slidesService } from './slides.js';
import { scriptsService, AUTOMATION_SCRIPTS } from './scripts.js';

// Default folder for all CSCX content
const DEFAULT_CSCX_FOLDER = config.google.defaultFolderId;

// Types
export interface CustomerWorkspace {
  id: string;
  customerId: string;
  customerName: string;
  userId: string; // CSM who owns this workspace
  folders: WorkspaceFolders;
  templates: WorkspaceTemplates;
  automations: WorkspaceAutomations;
  settings: WorkspaceSettings;
  createdAt: Date;
  updatedAt: Date;
}

export interface WorkspaceFolders {
  root: string;
  rootUrl: string;
  templates: string;
  onboarding: string;
  meetings: string;
  meetingNotes: string;
  transcripts: string;
  recordings: string;
  qbrs: string;
  health: string;
  success: string;
  renewals: string;
  risk: string;
}

export interface WorkspaceTemplates {
  onboardingPlan?: string; // Doc ID
  successPlan?: string;
  qbrDoc?: string;
  qbrSlides?: string;
  meetingNotes?: string;
  valueReport?: string;
  renewalProposal?: string;
  healthScoreSheet?: string;
  usageTrackerSheet?: string;
}

export interface WorkspaceAutomations {
  healthScoreCalculator?: string; // Script ID
  renewalAlerts?: string;
  usageTracker?: string;
  weeklyDigest?: string;
}

export interface WorkspaceSettings {
  autoSyncEnabled: boolean;
  notificationsEnabled: boolean;
  templateLanguage: string;
  timezone: string;
}

export interface CreateWorkspaceOptions {
  customerId: string;
  customerName: string;
  userId: string;
  parentFolderId?: string;
  createTemplates?: boolean;
  createAutomations?: boolean;
  settings?: Partial<WorkspaceSettings>;
}

export class CustomerWorkspaceService {
  private supabase: ReturnType<typeof createClient> | null = null;
  private workspaceCache: Map<string, CustomerWorkspace> = new Map();

  constructor() {
    if (config.supabaseUrl && config.supabaseServiceKey) {
      this.supabase = createClient(config.supabaseUrl, config.supabaseServiceKey);
    }
  }

  /**
   * Create a new customer workspace
   */
  async createWorkspace(options: CreateWorkspaceOptions): Promise<CustomerWorkspace> {
    const {
      customerId,
      customerName,
      userId,
      parentFolderId,
      createTemplates = true,
      createAutomations = false,
      settings = {},
    } = options;

    // Create folder structure within default CSCX folder (or specified parent)
    const effectiveParentFolder = parentFolderId || DEFAULT_CSCX_FOLDER;
    const folders = await driveService.createCustomerFolderStructure(
      userId,
      customerName,
      effectiveParentFolder
    );

    const workspaceFolders: WorkspaceFolders = folders;

    // Create templates if requested
    let templates: WorkspaceTemplates = {};
    if (createTemplates) {
      templates = await this.createWorkspaceTemplates(userId, customerName, workspaceFolders);
    }

    // Create automations if requested
    let automations: WorkspaceAutomations = {};
    if (createAutomations && templates.healthScoreSheet) {
      automations = await this.createWorkspaceAutomations(userId, customerName, templates);
    }

    const defaultSettings: WorkspaceSettings = {
      autoSyncEnabled: true,
      notificationsEnabled: true,
      templateLanguage: 'en',
      timezone: 'America/New_York',
      ...settings,
    };

    const workspace: CustomerWorkspace = {
      id: `workspace_${customerId}_${Date.now()}`,
      customerId,
      customerName,
      userId,
      folders: workspaceFolders,
      templates,
      automations,
      settings: defaultSettings,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    // Save to database
    await this.saveWorkspace(workspace);

    // Cache it
    this.workspaceCache.set(customerId, workspace);

    return workspace;
  }

  /**
   * Get workspace for a customer
   */
  async getWorkspace(customerId: string, userId: string): Promise<CustomerWorkspace | null> {
    // Check cache first
    const cached = this.workspaceCache.get(customerId);
    if (cached && cached.userId === userId) {
      return cached;
    }

    // Load from database
    if (!this.supabase) return null;

    const { data, error } = await (this.supabase as any)
      .from('customer_workspaces')
      .select('*')
      .eq('customer_id', customerId)
      .eq('user_id', userId)
      .single();

    if (error || !data) return null;

    const workspace = this.mapDbToWorkspace(data);
    this.workspaceCache.set(customerId, workspace);

    return workspace;
  }

  /**
   * Get or create workspace
   */
  async getOrCreateWorkspace(
    customerId: string,
    customerName: string,
    userId: string
  ): Promise<CustomerWorkspace> {
    let workspace = await this.getWorkspace(customerId, userId);

    if (!workspace) {
      workspace = await this.createWorkspace({
        customerId,
        customerName,
        userId,
        createTemplates: true,
        createAutomations: false,
      });
    }

    return workspace;
  }

  /**
   * Update workspace settings
   */
  async updateSettings(
    customerId: string,
    userId: string,
    settings: Partial<WorkspaceSettings>
  ): Promise<CustomerWorkspace | null> {
    const workspace = await this.getWorkspace(customerId, userId);
    if (!workspace) return null;

    workspace.settings = { ...workspace.settings, ...settings };
    workspace.updatedAt = new Date();

    await this.saveWorkspace(workspace);
    this.workspaceCache.set(customerId, workspace);

    return workspace;
  }

  /**
   * Add a template to workspace
   */
  async addTemplate(
    customerId: string,
    userId: string,
    templateType: keyof WorkspaceTemplates,
    fileId: string
  ): Promise<CustomerWorkspace | null> {
    const workspace = await this.getWorkspace(customerId, userId);
    if (!workspace) return null;

    workspace.templates[templateType] = fileId;
    workspace.updatedAt = new Date();

    await this.saveWorkspace(workspace);
    this.workspaceCache.set(customerId, workspace);

    return workspace;
  }

  /**
   * Create documents from workspace templates
   */
  async createDocumentFromTemplate(
    customerId: string,
    userId: string,
    templateType: keyof WorkspaceTemplates,
    variables: Record<string, string>
  ): Promise<{ id: string; url: string } | null> {
    const workspace = await this.getWorkspace(customerId, userId);
    if (!workspace) return null;

    const templateId = workspace.templates[templateType];

    // If no template exists, create from system template
    if (!templateId) {
      return this.createFromSystemTemplate(userId, workspace, templateType, variables);
    }

    // Copy from existing template
    const title = this.generateDocumentTitle(templateType, variables);
    const targetFolder = this.getTargetFolder(workspace, templateType);

    const newFileId = await driveService.copyFile(userId, templateId, title, targetFolder);
    const file = await driveService.getFile(userId, newFileId);

    // Replace variables in the document
    if (templateType.includes('Doc') || templateType.includes('Plan') || templateType.includes('Report')) {
      for (const [key, value] of Object.entries(variables)) {
        await docsService.findAndReplace(userId, newFileId, `{{${key}}}`, value);
      }
    }

    return {
      id: newFileId,
      url: file.webViewLink || `https://docs.google.com/document/d/${newFileId}`,
    };
  }

  /**
   * Generate QBR package (doc + slides)
   */
  async generateQBRPackage(
    customerId: string,
    userId: string,
    variables: Record<string, string>
  ): Promise<{
    document: { id: string; url: string };
    presentation: { id: string; url: string };
  } | null> {
    const workspace = await this.getWorkspace(customerId, userId);
    if (!workspace) return null;

    const docVariables = {
      ...variables,
      customerName: workspace.customerName,
    };

    // Create QBR document
    const qbrDoc = await docsService.createFromTemplate(
      userId,
      'qbr',
      docVariables,
      workspace.folders.qbrs
    );

    // Create QBR slides
    const qbrSlides = await slidesService.createFromTemplate(
      userId,
      'qbr',
      docVariables,
      workspace.folders.qbrs
    );

    return {
      document: {
        id: qbrDoc.id,
        url: qbrDoc.webViewLink || '',
      },
      presentation: {
        id: qbrSlides.id,
        url: qbrSlides.webViewLink || '',
      },
    };
  }

  /**
   * Create health score tracker
   */
  async createHealthScoreTracker(
    customerId: string,
    userId: string
  ): Promise<{ id: string; url: string } | null> {
    const workspace = await this.getWorkspace(customerId, userId);
    if (!workspace) return null;

    const sheet = await sheetsService.createFromTemplate(
      userId,
      'health_score',
      `${workspace.customerName} - Health Score Tracker`,
      workspace.folders.health
    );

    // Update workspace
    workspace.templates.healthScoreSheet = sheet.id;
    await this.saveWorkspace(workspace);

    return {
      id: sheet.id,
      url: sheet.webViewLink || '',
    };
  }

  /**
   * Create renewal tracker
   */
  async createRenewalTracker(
    customerId: string,
    userId: string
  ): Promise<{ id: string; url: string } | null> {
    const workspace = await this.getWorkspace(customerId, userId);
    if (!workspace) return null;

    const sheet = await sheetsService.createFromTemplate(
      userId,
      'renewal_tracker',
      `${workspace.customerName} - Renewal Tracker`,
      workspace.folders.renewals
    );

    return {
      id: sheet.id,
      url: sheet.webViewLink || '',
    };
  }

  /**
   * Enable automations for workspace
   */
  async enableAutomations(
    customerId: string,
    userId: string,
    automationTypes: (keyof typeof AUTOMATION_SCRIPTS)[]
  ): Promise<WorkspaceAutomations> {
    const workspace = await this.getWorkspace(customerId, userId);
    if (!workspace) {
      throw new Error('Workspace not found');
    }

    const automations: WorkspaceAutomations = { ...workspace.automations };

    for (const type of automationTypes) {
      // Check if we have the required sheet
      let parentId: string | undefined;

      if (type === 'healthScoreCalculator' && workspace.templates.healthScoreSheet) {
        parentId = workspace.templates.healthScoreSheet;
      } else if (type === 'renewalAlerts' && workspace.templates.usageTrackerSheet) {
        parentId = workspace.templates.usageTrackerSheet;
      }

      const script = await scriptsService.createAutomation(
        userId,
        type,
        `${workspace.customerName} - ${type}`,
        parentId
      );

      automations[type as keyof WorkspaceAutomations] = script.id;
    }

    workspace.automations = automations;
    workspace.updatedAt = new Date();
    await this.saveWorkspace(workspace);

    return automations;
  }

  /**
   * List all workspaces for a user
   */
  async listWorkspaces(userId: string): Promise<CustomerWorkspace[]> {
    if (!this.supabase) return [];

    const { data, error } = await (this.supabase as any)
      .from('customer_workspaces')
      .select('*')
      .eq('user_id', userId)
      .order('updated_at', { ascending: false });

    if (error || !data) return [];

    return data.map(this.mapDbToWorkspace);
  }

  /**
   * Delete workspace
   */
  async deleteWorkspace(customerId: string, userId: string): Promise<boolean> {
    if (!this.supabase) return false;

    const { error } = await (this.supabase as any)
      .from('customer_workspaces')
      .delete()
      .eq('customer_id', customerId)
      .eq('user_id', userId);

    if (!error) {
      this.workspaceCache.delete(customerId);
    }

    return !error;
  }

  // ==================== Helper Methods ====================

  /**
   * Create workspace templates
   */
  private async createWorkspaceTemplates(
    userId: string,
    customerName: string,
    folders: WorkspaceFolders
  ): Promise<WorkspaceTemplates> {
    const templates: WorkspaceTemplates = {};

    // Create onboarding plan document
    const onboardingPlan = await docsService.createFromTemplate(
      userId,
      'onboarding_plan',
      { customerName, timelineDays: '90' },
      folders.templates
    );
    templates.onboardingPlan = onboardingPlan.id;

    // Create success plan document
    const successPlan = await docsService.createFromTemplate(
      userId,
      'success_plan',
      { customerName },
      folders.templates
    );
    templates.successPlan = successPlan.id;

    // Create health score tracker sheet
    const healthSheet = await sheetsService.createFromTemplate(
      userId,
      'health_score',
      `${customerName} - Health Score Tracker`,
      folders.templates
    );
    templates.healthScoreSheet = healthSheet.id;

    return templates;
  }

  /**
   * Create workspace automations
   */
  private async createWorkspaceAutomations(
    userId: string,
    customerName: string,
    templates: WorkspaceTemplates
  ): Promise<WorkspaceAutomations> {
    const automations: WorkspaceAutomations = {};

    // Only create automations if we have the required templates
    if (templates.healthScoreSheet) {
      const healthScript = await scriptsService.createAutomation(
        userId,
        'healthScoreCalculator',
        `${customerName} - Health Score Calculator`,
        templates.healthScoreSheet
      );
      automations.healthScoreCalculator = healthScript.id;
    }

    return automations;
  }

  /**
   * Create document from system template
   */
  private async createFromSystemTemplate(
    userId: string,
    workspace: CustomerWorkspace,
    templateType: keyof WorkspaceTemplates,
    variables: Record<string, string>
  ): Promise<{ id: string; url: string } | null> {
    const targetFolder = this.getTargetFolder(workspace, templateType);
    const docVariables = { ...variables, customerName: workspace.customerName };

    // Map template types to system templates
    const templateMap: Record<string, string> = {
      onboardingPlan: 'onboarding_plan',
      successPlan: 'success_plan',
      qbrDoc: 'qbr',
      valueReport: 'value_summary',
      renewalProposal: 'renewal_proposal',
      meetingNotes: 'meeting_notes',
    };

    const systemTemplate = templateMap[templateType];
    if (!systemTemplate) return null;

    // Check if it's a doc or slides template
    if (templateType === 'qbrSlides') {
      const slides = await slidesService.createFromTemplate(
        userId,
        'qbr' as any,
        docVariables,
        targetFolder
      );
      return { id: slides.id, url: slides.webViewLink || '' };
    }

    const doc = await docsService.createFromTemplate(
      userId,
      systemTemplate as any,
      docVariables,
      targetFolder
    );

    // Store as template for future use
    workspace.templates[templateType] = doc.id;
    await this.saveWorkspace(workspace);

    return { id: doc.id, url: doc.webViewLink || '' };
  }

  /**
   * Get target folder for template type
   */
  private getTargetFolder(workspace: CustomerWorkspace, templateType: string): string {
    const type = templateType.toLowerCase();
    if (type.includes('onboarding') || type.includes('contract')) {
      return workspace.folders.onboarding;
    }
    if (type.includes('qbr')) {
      return workspace.folders.qbrs;
    }
    if (type.includes('meeting')) {
      return workspace.folders.meetings;
    }
    if (type.includes('renewal')) {
      return workspace.folders.renewals;
    }
    if (type.includes('health') || type.includes('risk')) {
      return workspace.folders.health;
    }
    if (type.includes('success') || type.includes('value')) {
      return workspace.folders.success;
    }
    return workspace.folders.root;
  }

  /**
   * Generate document title
   */
  private generateDocumentTitle(templateType: string, variables: Record<string, string>): string {
    const customerName = variables.customerName || 'Customer';
    const date = new Date().toISOString().split('T')[0];

    const titleMap: Record<string, string> = {
      onboardingPlan: `${customerName} - Onboarding Plan`,
      successPlan: `${customerName} - Success Plan`,
      qbrDoc: `${customerName} - QBR ${variables.quarter || 'Q1'} ${variables.year || new Date().getFullYear()}`,
      qbrSlides: `${customerName} - QBR Presentation ${variables.quarter || 'Q1'} ${variables.year || new Date().getFullYear()}`,
      meetingNotes: `${customerName} - Meeting Notes ${date}`,
      valueReport: `${customerName} - Value Summary`,
      renewalProposal: `${customerName} - Renewal Proposal`,
    };

    return titleMap[templateType] || `${customerName} - ${templateType} ${date}`;
  }

  /**
   * Save workspace to database
   */
  private async saveWorkspace(workspace: CustomerWorkspace): Promise<void> {
    if (!this.supabase) return;

    await (this.supabase as any).from('customer_workspaces').upsert({
      id: workspace.id,
      customer_id: workspace.customerId,
      customer_name: workspace.customerName,
      user_id: workspace.userId,
      folders: workspace.folders,
      templates: workspace.templates,
      automations: workspace.automations,
      settings: workspace.settings,
      created_at: workspace.createdAt.toISOString(),
      updated_at: workspace.updatedAt.toISOString(),
    }, {
      onConflict: 'customer_id,user_id',
    });
  }

  /**
   * Map database row to CustomerWorkspace
   */
  private mapDbToWorkspace(data: any): CustomerWorkspace {
    return {
      id: data.id,
      customerId: data.customer_id,
      customerName: data.customer_name,
      userId: data.user_id,
      folders: data.folders,
      templates: data.templates || {},
      automations: data.automations || {},
      settings: data.settings || {
        autoSyncEnabled: true,
        notificationsEnabled: true,
        templateLanguage: 'en',
        timezone: 'America/New_York',
      },
      createdAt: new Date(data.created_at),
      updatedAt: new Date(data.updated_at),
    };
  }
}

// Singleton instance
export const customerWorkspaceService = new CustomerWorkspaceService();
