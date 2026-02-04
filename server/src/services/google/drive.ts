/**
 * Google Drive Service
 * Handles Drive API operations: files, folders, indexing for RAG
 */

import { google, drive_v3 } from 'googleapis';
import { Readable } from 'stream';
import { googleOAuth } from './oauth.js';
import { createClient } from '@supabase/supabase-js';
import { config } from '../../config/index.js';

// Types
export interface DriveFile {
  id: string;
  name: string;
  mimeType: string;
  webViewLink?: string;
  webContentLink?: string;
  iconLink?: string;
  thumbnailLink?: string;
  size?: number;
  createdTime?: Date;
  modifiedTime?: Date;
  parents?: string[];
  owners?: { email: string; displayName?: string }[];
  shared: boolean;
  starred: boolean;
  trashed: boolean;
}

export interface DriveFolder extends DriveFile {
  mimeType: 'application/vnd.google-apps.folder';
}

export interface FileContent {
  text: string;
  mimeType: string;
  title: string;
}

export interface SearchOptions {
  query?: string;
  mimeType?: string;
  folderId?: string;
  sharedWithMe?: boolean;
  starred?: boolean;
  trashed?: boolean;
  maxResults?: number;
  orderBy?: 'modifiedTime' | 'name' | 'createdTime' | 'folder';
  pageToken?: string;
}

// Enhanced customer folder structure for 10-document system
export interface CustomerFolderStructure {
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

// Document types for the 10-document system
export type CustomerDocumentType =
  | 'contract'
  | 'entitlements'
  | 'onboarding_plan'
  | 'onboarding_tracker'
  | 'stakeholder_map'
  | 'qbr_deck'
  | 'qbr_metrics'
  | 'qbr_summary'
  | 'health_tracker'
  | 'usage_metrics'
  | 'success_plan'
  | 'renewal_tracker'
  | 'renewal_proposal'
  | 'risk_dashboard'
  | 'save_play'
  | 'meeting_notes'
  | 'transcript';

// Document routing configuration
export const DOCUMENT_ROUTING: Record<CustomerDocumentType, { folder: keyof CustomerFolderStructure; fileType: 'doc' | 'sheet' | 'slide' | 'pdf' | 'txt' }> = {
  contract: { folder: 'onboarding', fileType: 'pdf' },
  entitlements: { folder: 'onboarding', fileType: 'sheet' },
  onboarding_plan: { folder: 'onboarding', fileType: 'doc' },
  onboarding_tracker: { folder: 'onboarding', fileType: 'sheet' },
  stakeholder_map: { folder: 'onboarding', fileType: 'doc' },
  qbr_deck: { folder: 'qbrs', fileType: 'slide' },
  qbr_metrics: { folder: 'qbrs', fileType: 'sheet' },
  qbr_summary: { folder: 'qbrs', fileType: 'doc' },
  health_tracker: { folder: 'health', fileType: 'sheet' },
  usage_metrics: { folder: 'health', fileType: 'sheet' },
  success_plan: { folder: 'success', fileType: 'doc' },
  renewal_tracker: { folder: 'renewals', fileType: 'sheet' },
  renewal_proposal: { folder: 'renewals', fileType: 'doc' },
  risk_dashboard: { folder: 'risk', fileType: 'sheet' },
  save_play: { folder: 'risk', fileType: 'doc' },
  meeting_notes: { folder: 'meetingNotes', fileType: 'doc' },
  transcript: { folder: 'transcripts', fileType: 'txt' },
};

// Google Workspace MIME types
export const GOOGLE_MIME_TYPES = {
  folder: 'application/vnd.google-apps.folder',
  document: 'application/vnd.google-apps.document',
  spreadsheet: 'application/vnd.google-apps.spreadsheet',
  presentation: 'application/vnd.google-apps.presentation',
  form: 'application/vnd.google-apps.form',
  drawing: 'application/vnd.google-apps.drawing',
  script: 'application/vnd.google-apps.script',
  site: 'application/vnd.google-apps.site',
  shortcut: 'application/vnd.google-apps.shortcut',
} as const;

// Export formats for Google Workspace files
const EXPORT_FORMATS: Record<string, string> = {
  'application/vnd.google-apps.document': 'text/plain',
  'application/vnd.google-apps.spreadsheet': 'text/csv',
  'application/vnd.google-apps.presentation': 'text/plain',
};

export class DriveService {
  private supabase: ReturnType<typeof createClient> | null = null;
  private defaultFolderId: string;

  constructor() {
    if (config.supabaseUrl && config.supabaseServiceKey) {
      this.supabase = createClient(config.supabaseUrl, config.supabaseServiceKey);
    }
    // Default folder for all generated documents
    this.defaultFolderId = config.google.defaultFolderId;
  }

  /**
   * Get Drive API client for a user
   */
  private async getDriveClient(userId: string): Promise<drive_v3.Drive> {
    const auth = await googleOAuth.getAuthenticatedClient(userId);
    return google.drive({ version: 'v3', auth });
  }

  /**
   * List files in a folder or root
   */
  async listFiles(
    userId: string,
    options: SearchOptions = {}
  ): Promise<{ files: DriveFile[]; nextPageToken?: string }> {
    const drive = await this.getDriveClient(userId);

    // Build query
    const queryParts: string[] = [];

    if (options.folderId) {
      queryParts.push(`'${options.folderId}' in parents`);
    }

    if (options.mimeType) {
      queryParts.push(`mimeType = '${options.mimeType}'`);
    }

    if (options.query) {
      queryParts.push(`fullText contains '${options.query}'`);
    }

    if (options.sharedWithMe) {
      queryParts.push('sharedWithMe = true');
    }

    if (options.starred) {
      queryParts.push('starred = true');
    }

    if (options.trashed !== undefined) {
      queryParts.push(`trashed = ${options.trashed}`);
    } else {
      queryParts.push('trashed = false');
    }

    const response = await drive.files.list({
      q: queryParts.length > 0 ? queryParts.join(' and ') : undefined,
      pageSize: options.maxResults || 50,
      pageToken: options.pageToken,
      orderBy: options.orderBy === 'folder'
        ? 'folder,modifiedTime desc'
        : `${options.orderBy || 'modifiedTime'} desc`,
      fields: 'nextPageToken, files(id, name, mimeType, webViewLink, webContentLink, iconLink, thumbnailLink, size, createdTime, modifiedTime, parents, owners, shared, starred, trashed)',
    });

    const files = (response.data.files || []).map(file => this.mapGoogleFileToDriveFile(file));

    return {
      files,
      nextPageToken: response.data.nextPageToken || undefined,
    };
  }

  /**
   * Get file metadata
   */
  async getFile(userId: string, fileId: string): Promise<DriveFile> {
    const drive = await this.getDriveClient(userId);

    const response = await drive.files.get({
      fileId,
      fields: 'id, name, mimeType, webViewLink, webContentLink, iconLink, thumbnailLink, size, createdTime, modifiedTime, parents, owners, shared, starred, trashed',
    });

    return this.mapGoogleFileToDriveFile(response.data);
  }

  /**
   * Get file content (for text-based files)
   */
  async getFileContent(userId: string, fileId: string): Promise<FileContent> {
    const drive = await this.getDriveClient(userId);

    // First get file metadata
    const metadata = await this.getFile(userId, fileId);

    // Check if it's a Google Workspace file that needs exporting
    const exportMimeType = EXPORT_FORMATS[metadata.mimeType];

    let text: string;

    if (exportMimeType) {
      // Export Google Workspace file
      const response = await drive.files.export({
        fileId,
        mimeType: exportMimeType,
      }, {
        responseType: 'text',
      });
      text = response.data as string;
    } else {
      // Download regular file
      const response = await drive.files.get({
        fileId,
        alt: 'media',
      }, {
        responseType: 'text',
      });
      text = response.data as string;
    }

    return {
      text,
      mimeType: metadata.mimeType,
      title: metadata.name,
    };
  }

  /**
   * Search files across Drive
   */
  async searchFiles(
    userId: string,
    query: string,
    options: Omit<SearchOptions, 'query'> = {}
  ): Promise<{ files: DriveFile[]; nextPageToken?: string }> {
    return this.listFiles(userId, { ...options, query });
  }

  /**
   * List folders
   */
  async listFolders(
    userId: string,
    parentId?: string
  ): Promise<DriveFolder[]> {
    const { files } = await this.listFiles(userId, {
      folderId: parentId,
      mimeType: GOOGLE_MIME_TYPES.folder,
      maxResults: 100,
    });

    return files as DriveFolder[];
  }

  /**
   * Get folder tree (for navigation)
   */
  async getFolderTree(
    userId: string,
    folderId: string = 'root',
    depth: number = 2
  ): Promise<{ folder: DriveFile; children: DriveFile[] }> {
    const [folder, children] = await Promise.all([
      folderId === 'root'
        ? Promise.resolve({ id: 'root', name: 'My Drive', mimeType: GOOGLE_MIME_TYPES.folder } as DriveFile)
        : this.getFile(userId, folderId),
      this.listFiles(userId, { folderId, orderBy: 'folder' }).then(r => r.files),
    ]);

    return { folder, children };
  }

  /**
   * Get recent files
   */
  async getRecentFiles(userId: string, maxResults: number = 20): Promise<DriveFile[]> {
    const { files } = await this.listFiles(userId, {
      maxResults,
      orderBy: 'modifiedTime',
    });
    return files;
  }

  /**
   * Get starred files
   */
  async getStarredFiles(userId: string): Promise<DriveFile[]> {
    const { files } = await this.listFiles(userId, {
      starred: true,
      maxResults: 50,
    });
    return files;
  }

  /**
   * Get shared files
   */
  async getSharedFiles(userId: string): Promise<DriveFile[]> {
    const { files } = await this.listFiles(userId, {
      sharedWithMe: true,
      maxResults: 50,
    });
    return files;
  }

  /**
   * Get all Google Docs
   */
  async getDocuments(userId: string, maxResults: number = 50): Promise<DriveFile[]> {
    const { files } = await this.listFiles(userId, {
      mimeType: GOOGLE_MIME_TYPES.document,
      maxResults,
    });
    return files;
  }

  /**
   * Get all Google Sheets
   */
  async getSpreadsheets(userId: string, maxResults: number = 50): Promise<DriveFile[]> {
    const { files } = await this.listFiles(userId, {
      mimeType: GOOGLE_MIME_TYPES.spreadsheet,
      maxResults,
    });
    return files;
  }

  /**
   * Get all Google Slides
   */
  async getPresentations(userId: string, maxResults: number = 50): Promise<DriveFile[]> {
    const { files } = await this.listFiles(userId, {
      mimeType: GOOGLE_MIME_TYPES.presentation,
      maxResults,
    });
    return files;
  }

  /**
   * Create a folder
   * If no parentId is specified, uses the default CSCX folder
   */
  async createFolder(
    userId: string,
    name: string,
    parentId?: string
  ): Promise<DriveFile> {
    const drive = await this.getDriveClient(userId);

    // Use default folder if no parent specified
    const effectiveParentId = parentId || this.defaultFolderId;

    const response = await drive.files.create({
      requestBody: {
        name,
        mimeType: GOOGLE_MIME_TYPES.folder,
        parents: effectiveParentId ? [effectiveParentId] : undefined,
      },
      fields: 'id, name, mimeType, webViewLink, createdTime, modifiedTime, parents',
    });

    return this.mapGoogleFileToDriveFile(response.data);
  }

  /**
   * Move file to folder
   */
  async moveFile(
    userId: string,
    fileId: string,
    newParentId: string
  ): Promise<DriveFile> {
    const drive = await this.getDriveClient(userId);

    // Get current parents
    const file = await drive.files.get({
      fileId,
      fields: 'parents',
    });

    const previousParents = file.data.parents?.join(',') || '';

    const response = await drive.files.update({
      fileId,
      addParents: newParentId,
      removeParents: previousParents,
      fields: 'id, name, mimeType, webViewLink, parents',
    });

    return this.mapGoogleFileToDriveFile(response.data);
  }

  /**
   * Star/unstar a file
   */
  async setStarred(userId: string, fileId: string, starred: boolean): Promise<void> {
    const drive = await this.getDriveClient(userId);

    await drive.files.update({
      fileId,
      requestBody: { starred },
    });
  }

  /**
   * Trash/restore a file
   */
  async setTrashed(userId: string, fileId: string, trashed: boolean): Promise<void> {
    const drive = await this.getDriveClient(userId);

    await drive.files.update({
      fileId,
      requestBody: { trashed },
    });
  }

  /**
   * Permanently delete a file (must be in trash)
   */
  async deleteFile(userId: string, fileId: string): Promise<void> {
    const drive = await this.getDriveClient(userId);

    await drive.files.delete({ fileId });
  }

  /**
   * Get files modified since a given time (for sync)
   */
  async getModifiedSince(userId: string, since: Date): Promise<DriveFile[]> {
    const drive = await this.getDriveClient(userId);

    const response = await drive.files.list({
      q: `modifiedTime > '${since.toISOString()}' and trashed = false`,
      pageSize: 100,
      orderBy: 'modifiedTime desc',
      fields: 'files(id, name, mimeType, webViewLink, webContentLink, size, createdTime, modifiedTime, parents, owners, shared, starred, trashed)',
    });

    return (response.data.files || []).map(file => this.mapGoogleFileToDriveFile(file));
  }

  // ==================== Knowledge Base / RAG Methods ====================

  /**
   * Index a file for RAG (extract content and store)
   */
  async indexFileForRAG(
    userId: string,
    fileId: string,
    customerId?: string
  ): Promise<{ success: boolean; chunksCreated: number }> {
    if (!this.supabase) {
      return { success: false, chunksCreated: 0 };
    }

    try {
      // Get file content
      const content = await this.getFileContent(userId, fileId);
      const metadata = await this.getFile(userId, fileId);

      // Determine document type
      let docType = 'other';
      if (metadata.mimeType === GOOGLE_MIME_TYPES.document) docType = 'google_doc';
      else if (metadata.mimeType === GOOGLE_MIME_TYPES.spreadsheet) docType = 'google_sheet';
      else if (metadata.mimeType === GOOGLE_MIME_TYPES.presentation) docType = 'google_slides';

      // Store document metadata (type assertion needed until Supabase types are regenerated)
      const { data: doc, error: docError } = await (this.supabase as any)
        .from('knowledge_base')
        .upsert({
          user_id: userId,
          customer_id: customerId,
          source_type: 'google_drive',
          source_id: fileId,
          title: content.title,
          content_type: docType,
          raw_content: content.text.substring(0, 50000), // Limit raw content
          indexed_at: new Date().toISOString(),
          source_url: metadata.webViewLink,
        }, {
          onConflict: 'user_id,source_type,source_id',
        })
        .select('id')
        .single();

      if (docError || !doc) {
        console.error('Error storing document:', docError);
        return { success: false, chunksCreated: 0 };
      }

      // Chunk the content
      const chunks = this.chunkText(content.text, 1000, 200);

      // Delete existing chunks for this document
      await (this.supabase as any)
        .from('knowledge_chunks')
        .delete()
        .eq('document_id', doc.id);

      // Store chunks (embedding generation would happen separately)
      let chunksCreated = 0;
      for (let i = 0; i < chunks.length; i++) {
        const { error } = await (this.supabase as any)
          .from('knowledge_chunks')
          .insert({
            document_id: doc.id,
            chunk_index: i,
            content: chunks[i],
            // embedding would be added later via embedding service
          });

        if (!error) chunksCreated++;
      }

      return { success: true, chunksCreated };
    } catch (error) {
      console.error('Error indexing file for RAG:', error);
      return { success: false, chunksCreated: 0 };
    }
  }

  /**
   * Bulk index files from a folder
   */
  async indexFolderForRAG(
    userId: string,
    folderId: string,
    customerId?: string,
    options: { recursive?: boolean; maxFiles?: number } = {}
  ): Promise<{ filesIndexed: number; totalChunks: number }> {
    const { files } = await this.listFiles(userId, {
      folderId,
      maxResults: options.maxFiles || 50,
    });

    let filesIndexed = 0;
    let totalChunks = 0;

    for (const file of files) {
      // Skip folders
      if (file.mimeType === GOOGLE_MIME_TYPES.folder) {
        if (options.recursive) {
          const subResult = await this.indexFolderForRAG(userId, file.id, customerId, options);
          filesIndexed += subResult.filesIndexed;
          totalChunks += subResult.totalChunks;
        }
        continue;
      }

      // Only index text-based files
      if (this.isIndexableFile(file.mimeType)) {
        const result = await this.indexFileForRAG(userId, file.id, customerId);
        if (result.success) {
          filesIndexed++;
          totalChunks += result.chunksCreated;
        }
      }
    }

    return { filesIndexed, totalChunks };
  }

  /**
   * Sync files to database (for tracking/search)
   */
  async syncFilesToDb(
    userId: string,
    customerId?: string,
    options: { folderId?: string; maxFiles?: number } = {}
  ): Promise<number> {
    if (!this.supabase) return 0;

    const { files } = await this.listFiles(userId, {
      folderId: options.folderId,
      maxResults: options.maxFiles || 100,
    });

    let synced = 0;

    for (const file of files) {
      // Type assertion needed until Supabase types are regenerated
      const { error } = await (this.supabase as any)
        .from('drive_files')
        .upsert({
          user_id: userId,
          customer_id: customerId,
          google_file_id: file.id,
          name: file.name,
          mime_type: file.mimeType,
          size_bytes: file.size,
          web_view_link: file.webViewLink,
          web_content_link: file.webContentLink,
          icon_link: file.iconLink,
          thumbnail_link: file.thumbnailLink,
          parent_folder_id: file.parents?.[0],
          is_shared: file.shared,
          is_starred: file.starred,
          is_trashed: file.trashed,
          owner_email: file.owners?.[0]?.email,
          google_created_at: file.createdTime?.toISOString(),
          google_modified_at: file.modifiedTime?.toISOString(),
          last_synced_at: new Date().toISOString(),
        }, {
          onConflict: 'user_id,google_file_id',
        });

      if (!error) synced++;
    }

    return synced;
  }

  // ==================== Helper Methods ====================

  /**
   * Copy a file
   */
  async copyFile(
    userId: string,
    fileId: string,
    newTitle: string,
    folderId?: string
  ): Promise<string> {
    const drive = await this.getDriveClient(userId);

    const response = await drive.files.copy({
      fileId,
      requestBody: {
        name: newTitle,
        parents: folderId ? [folderId] : undefined,
      },
      fields: 'id',
    });

    return response.data.id || '';
  }

  /**
   * Share a file with someone
   */
  async shareFile(
    userId: string,
    fileId: string,
    email: string,
    role: 'reader' | 'writer' | 'commenter' = 'reader'
  ): Promise<void> {
    const drive = await this.getDriveClient(userId);

    await drive.permissions.create({
      fileId,
      requestBody: {
        type: 'user',
        role,
        emailAddress: email,
      },
      sendNotificationEmail: true,
    });
  }

  /**
   * Export a Google Workspace file to a specific format
   */
  async exportFile(
    userId: string,
    fileId: string,
    mimeType: string
  ): Promise<Buffer> {
    const drive = await this.getDriveClient(userId);

    const response = await drive.files.export({
      fileId,
      mimeType,
    }, {
      responseType: 'arraybuffer',
    });

    return Buffer.from(response.data as ArrayBuffer);
  }

  /**
   * Upload a file to Drive
   * If no folderId is specified, uses the default CSCX folder
   */
  async uploadFile(
    userId: string,
    options: {
      name: string;
      mimeType: string;
      content: Buffer | string;
      folderId?: string;
    }
  ): Promise<DriveFile> {
    const drive = await this.getDriveClient(userId);

    // Convert Buffer/string to a Readable stream for Google Drive API
    let bodyStream: Readable;
    if (Buffer.isBuffer(options.content)) {
      bodyStream = Readable.from(options.content);
    } else if (typeof options.content === 'string') {
      bodyStream = Readable.from(Buffer.from(options.content));
    } else {
      bodyStream = Readable.from(options.content as any);
    }

    // Use default folder if no parent specified
    const effectiveFolderId = options.folderId || this.defaultFolderId;

    const response = await drive.files.create({
      requestBody: {
        name: options.name,
        mimeType: options.mimeType,
        parents: effectiveFolderId ? [effectiveFolderId] : undefined,
      },
      media: {
        mimeType: options.mimeType,
        body: bodyStream,
      },
      fields: 'id, name, mimeType, webViewLink, webContentLink, createdTime, modifiedTime',
    });

    return this.mapGoogleFileToDriveFile(response.data);
  }

  /**
   * Rename a file
   */
  async renameFile(userId: string, fileId: string, newName: string): Promise<DriveFile> {
    const drive = await this.getDriveClient(userId);

    const response = await drive.files.update({
      fileId,
      requestBody: {
        name: newName,
      },
      fields: 'id, name, mimeType, webViewLink, modifiedTime',
    });

    return this.mapGoogleFileToDriveFile(response.data);
  }

  /**
   * Get file permissions
   */
  async getFilePermissions(userId: string, fileId: string): Promise<{
    id: string;
    type: string;
    role: string;
    email?: string;
    displayName?: string;
  }[]> {
    const drive = await this.getDriveClient(userId);

    const response = await drive.permissions.list({
      fileId,
      fields: 'permissions(id, type, role, emailAddress, displayName)',
    });

    return (response.data.permissions || []).map(p => ({
      id: p.id || '',
      type: p.type || '',
      role: p.role || '',
      email: p.emailAddress,
      displayName: p.displayName,
    }));
  }

  /**
   * Remove file permission
   */
  async removeFilePermission(userId: string, fileId: string, permissionId: string): Promise<void> {
    const drive = await this.getDriveClient(userId);

    await drive.permissions.delete({
      fileId,
      permissionId,
    });
  }

  /**
   * Enhanced customer folder structure with 10-document system
   */
  async createCustomerFolderStructure(
    userId: string,
    customerName: string,
    parentFolderId?: string
  ): Promise<CustomerFolderStructure> {
    // Create root folder
    const rootFolder = await this.createFolder(
      userId,
      `CSCX - ${customerName}`,
      parentFolderId
    );

    // Create main folders (7 top-level)
    const [templates, onboarding, meetings, qbrs, health, success, renewals, risk] = await Promise.all([
      this.createFolder(userId, '00 - Templates', rootFolder.id),
      this.createFolder(userId, '01 - Onboarding', rootFolder.id),
      this.createFolder(userId, '02 - Meetings', rootFolder.id),
      this.createFolder(userId, '03 - QBRs', rootFolder.id),
      this.createFolder(userId, '04 - Health & Metrics', rootFolder.id),
      this.createFolder(userId, '05 - Success & Value', rootFolder.id),
      this.createFolder(userId, '06 - Renewals', rootFolder.id),
      this.createFolder(userId, '07 - Risk & Escalations', rootFolder.id),
    ]);

    // Create meeting subfolders
    const [meetingNotes, transcripts, recordings] = await Promise.all([
      this.createFolder(userId, 'Meeting Notes', meetings.id),
      this.createFolder(userId, 'Transcripts', meetings.id),
      this.createFolder(userId, 'Recordings', meetings.id),
    ]);

    return {
      root: rootFolder.id,
      rootUrl: rootFolder.webViewLink || `https://drive.google.com/drive/folders/${rootFolder.id}`,
      templates: templates.id,
      onboarding: onboarding.id,
      meetings: meetings.id,
      meetingNotes: meetingNotes.id,
      transcripts: transcripts.id,
      recordings: recordings.id,
      qbrs: qbrs.id,
      health: health.id,
      success: success.id,
      renewals: renewals.id,
      risk: risk.id,
    };
  }

  /**
   * Legacy folder structure for backward compatibility
   */
  async createLegacyFolderStructure(
    userId: string,
    customerName: string,
    parentFolderId?: string
  ): Promise<{
    root: string;
    onboarding: string;
    meetings: string;
    qbrs: string;
    contracts: string;
    reports: string;
  }> {
    const fullStructure = await this.createCustomerFolderStructure(userId, customerName, parentFolderId);
    return {
      root: fullStructure.root,
      onboarding: fullStructure.onboarding,
      meetings: fullStructure.meetings,
      qbrs: fullStructure.qbrs,
      contracts: fullStructure.onboarding, // Map to onboarding for contracts
      reports: fullStructure.health, // Map to health for reports
    };
  }

  /**
   * Get or create user's CSCX Templates folder for template mode
   */
  async getOrCreateUserTemplatesFolder(userId: string): Promise<DriveFile> {
    const drive = await this.getDriveClient(userId);

    // Search for existing templates folder
    const searchResponse = await drive.files.list({
      q: "name = 'CSCX Templates' and mimeType = 'application/vnd.google-apps.folder' and trashed = false",
      fields: 'files(id, name, webViewLink)',
      spaces: 'drive',
    });

    if (searchResponse.data.files && searchResponse.data.files.length > 0) {
      const folder = searchResponse.data.files[0];
      return {
        id: folder.id || '',
        name: folder.name || '',
        mimeType: 'application/vnd.google-apps.folder',
        webViewLink: folder.webViewLink || undefined,
      };
    }

    // Create templates folder if it doesn't exist
    return this.createFolder(userId, 'CSCX Templates');
  }

  /**
   * Get or create a subfolder for a specific task type within templates
   */
  async getOrCreateTaskTypeSubfolder(
    userId: string,
    parentFolderId: string,
    taskType: string
  ): Promise<DriveFile> {
    const drive = await this.getDriveClient(userId);
    const folderName = this.getTaskTypeFolderName(taskType);

    // Search for existing subfolder
    const searchResponse = await drive.files.list({
      q: `name = '${folderName}' and '${parentFolderId}' in parents and mimeType = 'application/vnd.google-apps.folder' and trashed = false`,
      fields: 'files(id, name, webViewLink)',
      spaces: 'drive',
    });

    if (searchResponse.data.files && searchResponse.data.files.length > 0) {
      const folder = searchResponse.data.files[0];
      return {
        id: folder.id || '',
        name: folder.name || '',
        mimeType: 'application/vnd.google-apps.folder',
        webViewLink: folder.webViewLink || undefined,
      };
    }

    // Create subfolder if it doesn't exist
    return this.createFolder(userId, folderName, parentFolderId);
  }

  /**
   * Get or create customer folder
   */
  async getOrCreateCustomerFolder(
    userId: string,
    customerId: string,
    customerName: string
  ): Promise<DriveFile> {
    const drive = await this.getDriveClient(userId);
    const folderName = `CSCX - ${customerName}`;

    // Search for existing customer folder
    const searchResponse = await drive.files.list({
      q: `name = '${folderName}' and mimeType = 'application/vnd.google-apps.folder' and trashed = false`,
      fields: 'files(id, name, webViewLink)',
      spaces: 'drive',
    });

    if (searchResponse.data.files && searchResponse.data.files.length > 0) {
      const folder = searchResponse.data.files[0];
      return {
        id: folder.id || '',
        name: folder.name || '',
        mimeType: 'application/vnd.google-apps.folder',
        webViewLink: folder.webViewLink || undefined,
      };
    }

    // Create customer folder structure if it doesn't exist
    const structure = await this.createCustomerFolderStructure(userId, customerName);
    return {
      id: structure.root,
      name: folderName,
      mimeType: 'application/vnd.google-apps.folder',
      webViewLink: structure.rootUrl,
    };
  }

  /**
   * Map task type to folder name
   */
  private getTaskTypeFolderName(taskType: string): string {
    const folderNames: Record<string, string> = {
      qbr_generation: 'QBRs',
      document_creation: 'Documents',
      email_drafting: 'Emails',
      meeting_prep: 'Meeting Prep',
      presentation_creation: 'Presentations',
      data_analysis: 'Analysis',
      health_analysis: 'Health Reports',
      renewal_planning: 'Renewals',
      risk_assessment: 'Risk Assessments',
      expansion_planning: 'Expansion Plans',
    };
    return folderNames[taskType] || 'Other';
  }

  /**
   * Map Google Drive file to our type
   */
  private mapGoogleFileToDriveFile(file: drive_v3.Schema$File): DriveFile & { createdAt?: Date; modifiedAt?: Date } {
    return {
      id: file.id || '',
      name: file.name || '',
      mimeType: file.mimeType || '',
      webViewLink: file.webViewLink || undefined,
      webContentLink: file.webContentLink || undefined,
      iconLink: file.iconLink || undefined,
      thumbnailLink: file.thumbnailLink || undefined,
      size: file.size ? parseInt(file.size) : undefined,
      createdTime: file.createdTime ? new Date(file.createdTime) : undefined,
      modifiedTime: file.modifiedTime ? new Date(file.modifiedTime) : undefined,
      createdAt: file.createdTime ? new Date(file.createdTime) : undefined,
      modifiedAt: file.modifiedTime ? new Date(file.modifiedTime) : undefined,
      parents: file.parents || undefined,
      owners: file.owners?.map(o => ({
        email: o.emailAddress || '',
        displayName: o.displayName || undefined,
      })),
      shared: file.shared || false,
      starred: file.starred || false,
      trashed: file.trashed || false,
    };
  }

  /**
   * Check if file type can be indexed for RAG
   */
  private isIndexableFile(mimeType: string): boolean {
    const indexableTypes = [
      GOOGLE_MIME_TYPES.document,
      GOOGLE_MIME_TYPES.spreadsheet,
      GOOGLE_MIME_TYPES.presentation,
      'text/plain',
      'text/markdown',
      'text/csv',
      'application/json',
      'text/html',
    ];
    return indexableTypes.includes(mimeType);
  }

  /**
   * Chunk text for RAG with overlap
   */
  private chunkText(text: string, chunkSize: number, overlap: number): string[] {
    const chunks: string[] = [];

    if (text.length <= chunkSize) {
      return [text.trim()];
    }

    let start = 0;
    while (start < text.length) {
      let end = start + chunkSize;

      // Try to break at sentence boundary
      if (end < text.length) {
        const lastPeriod = text.lastIndexOf('.', end);
        const lastNewline = text.lastIndexOf('\n', end);
        const breakPoint = Math.max(lastPeriod, lastNewline);

        if (breakPoint > start + chunkSize / 2) {
          end = breakPoint + 1;
        }
      }

      const chunk = text.slice(start, end).trim();
      if (chunk) {
        chunks.push(chunk);
      }

      start = end - overlap;

      // Safety check to prevent infinite loop
      if (start <= 0 && chunks.length > 0) break;
    }

    return chunks;
  }
}

// Singleton instance
export const driveService = new DriveService();
