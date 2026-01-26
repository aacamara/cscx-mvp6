/**
 * Customer Documents Service
 * Manages the 10-document system per customer with Google Drive integration
 * Handles document creation, tracking, and retrieval
 */

import { createClient } from '@supabase/supabase-js';
import { config } from '../../config/index.js';
import { driveService, CustomerFolderStructure, CustomerDocumentType, DOCUMENT_ROUTING } from './drive.js';
import { docsService } from './docs.js';
import { sheetsService } from './sheets.js';
import { slidesService } from './slides.js';

// Types
export interface CustomerDocument {
  id: string;
  customerId: string;
  userId: string;
  documentType: CustomerDocumentType;
  googleFileId: string;
  googleFolderId: string;
  name: string;
  mimeType: string;
  fileType: string;
  status: 'draft' | 'active' | 'archived';
  version: number;
  period?: string;
  webViewUrl: string;
  webEditUrl: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateDocumentOptions {
  customerId: string;
  customerName: string;
  userId: string;
  documentType: CustomerDocumentType;
  period?: string;  // For QBRs: "Q1 2026"
  variables?: Record<string, string>;  // Template variables
}

export interface DocumentCreationResult {
  success: boolean;
  document?: CustomerDocument;
  error?: string;
}

// Core 10 document types that should be created per customer
export const CORE_DOCUMENT_TYPES: CustomerDocumentType[] = [
  'contract',
  'entitlements',
  'onboarding_plan',
  'onboarding_tracker',
  'stakeholder_map',
  'qbr_deck',
  'health_tracker',
  'usage_metrics',
  'success_plan',
  'renewal_tracker',
];

class CustomerDocumentsService {
  private supabase: ReturnType<typeof createClient> | null = null;

  constructor() {
    if (config.supabaseUrl && config.supabaseServiceKey) {
      this.supabase = createClient(config.supabaseUrl, config.supabaseServiceKey);
    }
  }

  /**
   * Get or create folder structure for a customer
   */
  async getOrCreateFolders(
    userId: string,
    customerId: string,
    customerName: string
  ): Promise<CustomerFolderStructure | null> {
    if (!this.supabase) return null;

    // Check if folders already exist (cast to any for new table)
    const { data: existing } = await this.supabase
      .from('customer_workspace_folders' as any)
      .select('*')
      .eq('customer_id', customerId)
      .single();

    if (existing) {
      const row = existing as any;
      return {
        root: row.root_folder_id,
        rootUrl: row.root_folder_url,
        templates: row.templates_folder_id,
        onboarding: row.onboarding_folder_id,
        meetings: row.meetings_folder_id,
        meetingNotes: row.meetings_notes_folder_id,
        transcripts: row.meetings_transcripts_folder_id,
        recordings: row.meetings_recordings_folder_id,
        qbrs: row.qbrs_folder_id,
        health: row.health_folder_id,
        success: row.success_folder_id,
        renewals: row.renewals_folder_id,
        risk: row.risk_folder_id,
      };
    }

    // Create new folder structure
    const folders = await driveService.createCustomerFolderStructure(userId, customerName);

    // Save to database (cast to any for new table)
    await this.supabase.from('customer_workspace_folders' as any).insert({
      customer_id: customerId,
      user_id: userId,
      root_folder_id: folders.root,
      root_folder_url: folders.rootUrl,
      templates_folder_id: folders.templates,
      onboarding_folder_id: folders.onboarding,
      meetings_folder_id: folders.meetings,
      meetings_notes_folder_id: folders.meetingNotes,
      meetings_transcripts_folder_id: folders.transcripts,
      meetings_recordings_folder_id: folders.recordings,
      qbrs_folder_id: folders.qbrs,
      health_folder_id: folders.health,
      success_folder_id: folders.success,
      renewals_folder_id: folders.renewals,
      risk_folder_id: folders.risk,
    } as any);

    return folders;
  }

  /**
   * Create a document and track it in the database
   */
  async createDocument(options: CreateDocumentOptions): Promise<DocumentCreationResult> {
    const { customerId, customerName, userId, documentType, period, variables } = options;

    try {
      // Get folder structure
      const folders = await this.getOrCreateFolders(userId, customerId, customerName);
      if (!folders) {
        return { success: false, error: 'Failed to get/create folder structure' };
      }

      // Get routing info
      const routing = DOCUMENT_ROUTING[documentType];
      const folderId = folders[routing.folder];

      // Build document name
      const docName = this.buildDocumentName(customerName, documentType, period);

      // Build template variables
      const templateVars = {
        customer_name: customerName,
        date: new Date().toLocaleDateString(),
        quarter: period || this.getCurrentQuarter(),
        ...variables,
      };

      let result: { id: string; url: string; editUrl?: string } | null = null;

      // Create document based on type
      switch (routing.fileType) {
        case 'doc':
          result = await this.createGoogleDoc(userId, docName, documentType, folderId, templateVars);
          break;
        case 'sheet':
          result = await this.createGoogleSheet(userId, docName, documentType, folderId, templateVars);
          break;
        case 'slide':
          result = await this.createGoogleSlide(userId, docName, documentType, folderId, templateVars);
          break;
        case 'txt':
          // Text files are created differently (usually from transcript data)
          return { success: false, error: 'Text files should be created via uploadTranscript()' };
        case 'pdf':
          // PDFs are uploaded, not created
          return { success: false, error: 'PDFs should be uploaded via uploadContract()' };
      }

      if (!result) {
        return { success: false, error: 'Failed to create document' };
      }

      // Save to database
      const document = await this.saveDocumentRecord({
        customerId,
        userId,
        documentType,
        googleFileId: result.id,
        googleFolderId: folderId,
        name: docName,
        fileType: routing.fileType,
        period,
        webViewUrl: result.url,
        webEditUrl: result.editUrl || result.url,
      });

      return { success: true, document };
    } catch (error) {
      console.error(`Error creating document ${documentType}:`, error);
      return { success: false, error: (error as Error).message };
    }
  }

  /**
   * Create Google Doc from template
   */
  private async createGoogleDoc(
    userId: string,
    name: string,
    documentType: CustomerDocumentType,
    folderId: string,
    _variables: Record<string, string>  // Variables for future template substitution
  ): Promise<{ id: string; url: string; editUrl: string } | null> {
    // Map document type to template
    const templateMap: Record<string, string> = {
      onboarding_plan: 'onboarding_plan',
      stakeholder_map: 'meeting_notes',  // Use meeting notes as base
      success_plan: 'success_plan',
      qbr_summary: 'qbr',
      renewal_proposal: 'renewal_proposal',
      save_play: 'save_play',
      meeting_notes: 'meeting_notes',
    };

    const template = templateMap[documentType] || 'blank';

    const doc = await docsService.createDocument(userId, {
      title: name,
      template: template as any,
      folderId,
      // TODO: Add variable substitution when template system supports it
    });

    if (!doc) return null;

    return {
      id: doc.id,
      url: `https://docs.google.com/document/d/${doc.id}/view`,
      editUrl: `https://docs.google.com/document/d/${doc.id}/edit`,
    };
  }

  /**
   * Create Google Sheet from template
   */
  private async createGoogleSheet(
    userId: string,
    name: string,
    documentType: CustomerDocumentType,
    folderId: string,
    _variables: Record<string, string>  // Variables for future use
  ): Promise<{ id: string; url: string; editUrl: string } | null> {
    // Map document type to template
    const templateMap: Record<string, string> = {
      entitlements: 'customer_scorecard',  // Use scorecard template
      onboarding_tracker: 'onboarding_tracker',
      health_tracker: 'health_score',
      usage_metrics: 'usage_metrics',
      qbr_metrics: 'qbr_metrics',
      renewal_tracker: 'renewal_tracker',
      risk_dashboard: 'risk_dashboard',
    };

    const template = templateMap[documentType] || 'blank';

    // Use createFromTemplate which is the correct method
    const sheet = await sheetsService.createFromTemplate(
      userId,
      template as any,
      name,
      folderId
    );

    if (!sheet) return null;

    return {
      id: sheet.id,
      url: `https://docs.google.com/spreadsheets/d/${sheet.id}/view`,
      editUrl: `https://docs.google.com/spreadsheets/d/${sheet.id}/edit`,
    };
  }

  /**
   * Create Google Slides presentation from template
   */
  private async createGoogleSlide(
    userId: string,
    name: string,
    documentType: CustomerDocumentType,
    folderId: string,
    _variables: Record<string, string>  // Variables for future use
  ): Promise<{ id: string; url: string; editUrl: string } | null> {
    // Map document type to template
    const templateMap: Record<string, string> = {
      qbr_deck: 'qbr',
    };

    const template = templateMap[documentType] || 'qbr';

    const presentation = await slidesService.createPresentation(userId, {
      title: name,
      template: template as any,
      folderId,
    });

    if (!presentation) return null;

    return {
      id: presentation.id,
      url: `https://docs.google.com/presentation/d/${presentation.id}/view`,
      editUrl: `https://docs.google.com/presentation/d/${presentation.id}/edit`,
    };
  }

  /**
   * Save document record to database
   */
  private async saveDocumentRecord(data: {
    customerId: string;
    userId: string;
    documentType: CustomerDocumentType;
    googleFileId: string;
    googleFolderId: string;
    name: string;
    fileType: string;
    period?: string;
    webViewUrl: string;
    webEditUrl: string;
  }): Promise<CustomerDocument | null> {
    if (!this.supabase) return null;

    const mimeTypeMap: Record<string, string> = {
      doc: 'application/vnd.google-apps.document',
      sheet: 'application/vnd.google-apps.spreadsheet',
      slide: 'application/vnd.google-apps.presentation',
      pdf: 'application/pdf',
      txt: 'text/plain',
    };

    const { data: doc, error } = await this.supabase
      .from('customer_documents' as any)
      .upsert({
        customer_id: data.customerId,
        user_id: data.userId,
        document_type: data.documentType,
        google_file_id: data.googleFileId,
        google_folder_id: data.googleFolderId,
        name: data.name,
        mime_type: mimeTypeMap[data.fileType] || 'application/octet-stream',
        file_type: data.fileType,
        status: 'active',
        version: 1,
        period: data.period,
        web_view_url: data.webViewUrl,
        web_edit_url: data.webEditUrl,
        updated_at: new Date().toISOString(),
      } as any, {
        onConflict: 'customer_id,document_type,COALESCE(period,\'\')',
      })
      .select()
      .single();

    if (error) {
      console.error('Error saving document record:', error);
      return null;
    }

    return this.mapToCustomerDocument(doc);
  }

  /**
   * Get all documents for a customer
   */
  async getCustomerDocuments(customerId: string): Promise<CustomerDocument[]> {
    if (!this.supabase) return [];

    const { data, error } = await this.supabase
      .from('customer_documents')
      .select('*')
      .eq('customer_id', customerId)
      .order('document_type');

    if (error) {
      console.error('Error fetching customer documents:', error);
      return [];
    }

    return data.map(this.mapToCustomerDocument);
  }

  /**
   * Get a specific document by type
   */
  async getDocumentByType(
    customerId: string,
    documentType: CustomerDocumentType,
    period?: string
  ): Promise<CustomerDocument | null> {
    if (!this.supabase) return null;

    let query = this.supabase
      .from('customer_documents')
      .select('*')
      .eq('customer_id', customerId)
      .eq('document_type', documentType);

    if (period) {
      query = query.eq('period', period);
    }

    const { data, error } = await query.single();

    if (error || !data) return null;

    return this.mapToCustomerDocument(data);
  }

  /**
   * Get document completeness for a customer
   */
  async getDocumentCompleteness(customerId: string): Promise<{
    created: number;
    expected: number;
    percentage: number;
    missing: CustomerDocumentType[];
    present: CustomerDocumentType[];
  }> {
    const documents = await this.getCustomerDocuments(customerId);
    const presentTypes = documents.map(d => d.documentType);
    const missingTypes = CORE_DOCUMENT_TYPES.filter(t => !presentTypes.includes(t));

    return {
      created: presentTypes.length,
      expected: CORE_DOCUMENT_TYPES.length,
      percentage: Math.round((presentTypes.length / CORE_DOCUMENT_TYPES.length) * 100),
      missing: missingTypes,
      present: presentTypes as CustomerDocumentType[],
    };
  }

  /**
   * Create all core documents for a customer
   */
  async createAllCoreDocuments(
    customerId: string,
    customerName: string,
    userId: string,
    variables?: Record<string, string>
  ): Promise<{
    success: boolean;
    created: CustomerDocument[];
    failed: { type: CustomerDocumentType; error: string }[];
  }> {
    const created: CustomerDocument[] = [];
    const failed: { type: CustomerDocumentType; error: string }[] = [];

    // Skip contract and entitlements (these come from contract upload)
    const typesToCreate = CORE_DOCUMENT_TYPES.filter(
      t => t !== 'contract' && t !== 'entitlements'
    );

    for (const documentType of typesToCreate) {
      const result = await this.createDocument({
        customerId,
        customerName,
        userId,
        documentType,
        variables,
      });

      if (result.success && result.document) {
        created.push(result.document);
      } else {
        failed.push({ type: documentType, error: result.error || 'Unknown error' });
      }
    }

    return {
      success: failed.length === 0,
      created,
      failed,
    };
  }

  /**
   * Upload a contract PDF
   */
  async uploadContract(
    userId: string,
    customerId: string,
    customerName: string,
    fileBuffer: Buffer,
    fileName: string
  ): Promise<DocumentCreationResult> {
    try {
      const folders = await this.getOrCreateFolders(userId, customerId, customerName);
      if (!folders) {
        return { success: false, error: 'Failed to get folder structure' };
      }

      const file = await driveService.uploadFile(userId, {
        name: fileName,
        mimeType: 'application/pdf',
        content: fileBuffer,
        folderId: folders.onboarding,
      });

      if (!file) {
        return { success: false, error: 'Failed to upload file' };
      }

      const document = await this.saveDocumentRecord({
        customerId,
        userId,
        documentType: 'contract',
        googleFileId: file.id,
        googleFolderId: folders.onboarding,
        name: fileName,
        fileType: 'pdf',
        webViewUrl: file.webViewLink || `https://drive.google.com/file/d/${file.id}/view`,
        webEditUrl: file.webViewLink || `https://drive.google.com/file/d/${file.id}/view`,
      });

      return { success: true, document: document || undefined };
    } catch (error) {
      return { success: false, error: (error as Error).message };
    }
  }

  /**
   * Helper: Build document name
   */
  private buildDocumentName(
    customerName: string,
    documentType: CustomerDocumentType,
    period?: string
  ): string {
    const typeNames: Record<CustomerDocumentType, string> = {
      contract: 'Contract',
      entitlements: 'Entitlements & SKUs',
      onboarding_plan: 'Onboarding Plan',
      onboarding_tracker: 'Onboarding Tracker',
      stakeholder_map: 'Stakeholder Map',
      qbr_deck: 'QBR Presentation',
      qbr_metrics: 'QBR Metrics',
      qbr_summary: 'QBR Summary',
      health_tracker: 'Health Score Tracker',
      usage_metrics: 'Usage Metrics',
      success_plan: 'Success Plan',
      renewal_tracker: 'Renewal Tracker',
      renewal_proposal: 'Renewal Proposal',
      risk_dashboard: 'Risk Dashboard',
      save_play: 'Save Play',
      meeting_notes: 'Meeting Notes',
      transcript: 'Transcript',
    };

    const baseName = `${customerName} - ${typeNames[documentType]}`;
    return period ? `${baseName} - ${period}` : baseName;
  }

  /**
   * Helper: Get current quarter
   */
  private getCurrentQuarter(): string {
    const now = new Date();
    const quarter = Math.ceil((now.getMonth() + 1) / 3);
    return `Q${quarter} ${now.getFullYear()}`;
  }

  /**
   * Helper: Map DB record to CustomerDocument
   */
  private mapToCustomerDocument(record: any): CustomerDocument {
    return {
      id: record.id,
      customerId: record.customer_id,
      userId: record.user_id,
      documentType: record.document_type,
      googleFileId: record.google_file_id,
      googleFolderId: record.google_folder_id,
      name: record.name,
      mimeType: record.mime_type,
      fileType: record.file_type,
      status: record.status,
      version: record.version,
      period: record.period,
      webViewUrl: record.web_view_url,
      webEditUrl: record.web_edit_url,
      createdAt: new Date(record.created_at),
      updatedAt: new Date(record.updated_at),
    };
  }
}

export const customerDocumentsService = new CustomerDocumentsService();
export default customerDocumentsService;
