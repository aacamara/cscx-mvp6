/**
 * Drive MCP Tool Wrappers
 * Wraps existing DriveService methods as MCP tools
 */

import { z } from 'zod';
import { driveService, DriveFile, DriveFolder } from '../../services/google/drive.js';
import { MCPTool, MCPContext, MCPResult, createMCPTool } from '../index.js';

// ============================================
// Input Schemas
// ============================================

const listFilesSchema = z.object({
  folderId: z.string().optional().describe('Parent folder ID (default: root)'),
  query: z.string().optional().describe('Search query for file names'),
  mimeType: z.string().optional().describe('Filter by MIME type'),
  maxResults: z.number().int().min(1).max(100).optional().default(50),
  pageToken: z.string().optional(),
});

const getFileSchema = z.object({
  fileId: z.string().min(1).describe('Google Drive file ID'),
});

const createFolderSchema = z.object({
  name: z.string().min(1).max(255).describe('Folder name'),
  parentFolderId: z.string().optional().describe('Parent folder ID'),
  description: z.string().optional(),
});

const uploadFileSchema = z.object({
  name: z.string().min(1).max(255).describe('File name'),
  content: z.string().describe('File content (text or base64 encoded)'),
  mimeType: z.string().describe('MIME type of the file'),
  folderId: z.string().optional().describe('Parent folder ID'),
  isBase64: z.boolean().optional().default(false),
});

const shareFileSchema = z.object({
  fileId: z.string().min(1).describe('Google Drive file ID'),
  email: z.string().email().describe('Email address to share with'),
  role: z.enum(['reader', 'commenter', 'writer']).describe('Permission role'),
  sendNotification: z.boolean().optional().default(true),
  message: z.string().optional().describe('Notification message'),
});

const deleteFileSchema = z.object({
  fileId: z.string().min(1).describe('Google Drive file ID'),
});

const copyFileSchema = z.object({
  fileId: z.string().min(1).describe('Source file ID to copy'),
  name: z.string().min(1).max(255).describe('Name for the copy'),
  folderId: z.string().optional().describe('Destination folder ID'),
});

const moveFileSchema = z.object({
  fileId: z.string().min(1).describe('File ID to move'),
  newFolderId: z.string().min(1).describe('Destination folder ID'),
});

const searchFilesSchema = z.object({
  query: z.string().min(1).describe('Search query'),
  maxResults: z.number().int().min(1).max(100).optional().default(20),
});

// ============================================
// Tool Implementations
// ============================================

export const driveListFiles: MCPTool = createMCPTool({
  name: 'drive.list_files',
  description: 'List files and folders in Google Drive. Supports filtering by folder, query, and MIME type.',
  category: 'documents',
  provider: 'google',
  inputSchema: listFilesSchema,
  requiresAuth: true,
  requiresApproval: false,
  approvalPolicy: 'auto_approve',

  execute: async (input: unknown, context: MCPContext): Promise<MCPResult<{
    files: DriveFile[];
    nextPageToken?: string;
  }>> => {
    try {
      const params = listFilesSchema.parse(input);
      const result = await driveService.listFiles(context.userId, params);

      return {
        success: true,
        data: result,
        metadata: {
          count: result.files.length,
          hasMore: !!result.nextPageToken,
        },
      };
    } catch (error) {
      return {
        success: false,
        error: (error as Error).message,
        retryable: true,
      };
    }
  },
});

export const driveGetFile: MCPTool = createMCPTool({
  name: 'drive.get_file',
  description: 'Get metadata for a specific file in Google Drive.',
  category: 'documents',
  provider: 'google',
  inputSchema: getFileSchema,
  requiresAuth: true,
  requiresApproval: false,
  approvalPolicy: 'auto_approve',

  execute: async (input: unknown, context: MCPContext): Promise<MCPResult<{ file: DriveFile }>> => {
    try {
      const { fileId } = getFileSchema.parse(input);
      const file = await driveService.getFile(context.userId, fileId);

      return {
        success: true,
        data: { file },
      };
    } catch (error) {
      return {
        success: false,
        error: (error as Error).message,
        retryable: false,
      };
    }
  },
});

export const driveCreateFolder: MCPTool = createMCPTool({
  name: 'drive.create_folder',
  description: 'Create a new folder in Google Drive.',
  category: 'documents',
  provider: 'google',
  inputSchema: createFolderSchema,
  requiresAuth: true,
  requiresApproval: false,
  approvalPolicy: 'auto_approve',

  execute: async (input: unknown, context: MCPContext): Promise<MCPResult<{ folder: DriveFolder }>> => {
    try {
      const params = createFolderSchema.parse(input);
      const folder = await driveService.createFolder(context.userId, params.name, params.parentFolderId);

      return {
        success: true,
        data: { folder },
        metadata: {
          folderId: folder.id,
        },
      };
    } catch (error) {
      return {
        success: false,
        error: (error as Error).message,
        retryable: false,
      };
    }
  },
});

export const driveUploadFile: MCPTool = createMCPTool({
  name: 'drive.upload_file',
  description: 'Upload a file to Google Drive.',
  category: 'documents',
  provider: 'google',
  inputSchema: uploadFileSchema,
  requiresAuth: true,
  requiresApproval: false,
  approvalPolicy: 'auto_approve',

  execute: async (input: unknown, context: MCPContext): Promise<MCPResult<{ file: DriveFile }>> => {
    try {
      const params = uploadFileSchema.parse(input);

      const content = params.isBase64
        ? Buffer.from(params.content, 'base64')
        : Buffer.from(params.content, 'utf-8');

      const file = await driveService.uploadFile(
        context.userId,
        params.name,
        content,
        params.mimeType,
        params.folderId
      );

      return {
        success: true,
        data: { file },
        metadata: {
          fileId: file.id,
          size: content.length,
        },
      };
    } catch (error) {
      return {
        success: false,
        error: (error as Error).message,
        retryable: false,
      };
    }
  },
});

export const driveShareFile: MCPTool = createMCPTool({
  name: 'drive.share_file',
  description: 'Share a file with someone via email. Requires human approval.',
  category: 'documents',
  provider: 'google',
  inputSchema: shareFileSchema,
  requiresAuth: true,
  requiresApproval: true,
  approvalPolicy: 'require_approval',

  execute: async (input: unknown, context: MCPContext): Promise<MCPResult<{ shared: boolean; permissionId?: string }>> => {
    try {
      const params = shareFileSchema.parse(input);
      const permissionId = await driveService.shareFile(
        context.userId,
        params.fileId,
        params.email,
        params.role,
        params.sendNotification,
        params.message
      );

      return {
        success: true,
        data: {
          shared: true,
          permissionId,
        },
      };
    } catch (error) {
      return {
        success: false,
        error: (error as Error).message,
        retryable: false,
      };
    }
  },

  getApprovalDescription: (input: unknown): string => {
    try {
      const params = shareFileSchema.parse(input);
      return `Share file with ${params.email} (${params.role} access)`;
    } catch {
      return 'Share file';
    }
  },
});

export const driveDeleteFile: MCPTool = createMCPTool({
  name: 'drive.delete_file',
  description: 'Move a file to trash in Google Drive.',
  category: 'documents',
  provider: 'google',
  inputSchema: deleteFileSchema,
  requiresAuth: true,
  requiresApproval: true,
  approvalPolicy: 'require_approval',

  execute: async (input: unknown, context: MCPContext): Promise<MCPResult<{ deleted: boolean }>> => {
    try {
      const { fileId } = deleteFileSchema.parse(input);
      await driveService.deleteFile(context.userId, fileId);

      return {
        success: true,
        data: { deleted: true },
      };
    } catch (error) {
      return {
        success: false,
        error: (error as Error).message,
        retryable: false,
      };
    }
  },

  getApprovalDescription: (input: unknown): string => {
    return 'Delete file from Google Drive';
  },
});

export const driveCopyFile: MCPTool = createMCPTool({
  name: 'drive.copy_file',
  description: 'Create a copy of a file in Google Drive.',
  category: 'documents',
  provider: 'google',
  inputSchema: copyFileSchema,
  requiresAuth: true,
  requiresApproval: false,
  approvalPolicy: 'auto_approve',

  execute: async (input: unknown, context: MCPContext): Promise<MCPResult<{ file: DriveFile }>> => {
    try {
      const params = copyFileSchema.parse(input);
      const file = await driveService.copyFile(
        context.userId,
        params.fileId,
        params.name,
        params.folderId
      );

      return {
        success: true,
        data: { file },
        metadata: {
          sourceFileId: params.fileId,
          copyFileId: file.id,
        },
      };
    } catch (error) {
      return {
        success: false,
        error: (error as Error).message,
        retryable: false,
      };
    }
  },
});

export const driveMoveFile: MCPTool = createMCPTool({
  name: 'drive.move_file',
  description: 'Move a file to a different folder in Google Drive.',
  category: 'documents',
  provider: 'google',
  inputSchema: moveFileSchema,
  requiresAuth: true,
  requiresApproval: false,
  approvalPolicy: 'auto_approve',

  execute: async (input: unknown, context: MCPContext): Promise<MCPResult<{ moved: boolean }>> => {
    try {
      const params = moveFileSchema.parse(input);
      await driveService.moveFile(context.userId, params.fileId, params.newFolderId);

      return {
        success: true,
        data: { moved: true },
      };
    } catch (error) {
      return {
        success: false,
        error: (error as Error).message,
        retryable: false,
      };
    }
  },
});

export const driveSearch: MCPTool = createMCPTool({
  name: 'drive.search',
  description: 'Search for files in Google Drive by name or content.',
  category: 'documents',
  provider: 'google',
  inputSchema: searchFilesSchema,
  requiresAuth: true,
  requiresApproval: false,
  approvalPolicy: 'auto_approve',

  execute: async (input: unknown, context: MCPContext): Promise<MCPResult<{ files: DriveFile[] }>> => {
    try {
      const params = searchFilesSchema.parse(input);
      const { files } = await driveService.listFiles(context.userId, {
        query: params.query,
        maxResults: params.maxResults,
      });

      return {
        success: true,
        data: { files },
        metadata: {
          query: params.query,
          count: files.length,
        },
      };
    } catch (error) {
      return {
        success: false,
        error: (error as Error).message,
        retryable: true,
      };
    }
  },
});

export const driveGetCustomerFolder: MCPTool = createMCPTool({
  name: 'drive.get_customer_folder',
  description: 'Get or create the dedicated folder for a customer.',
  category: 'documents',
  provider: 'google',
  inputSchema: z.object({
    customerName: z.string().min(1).describe('Customer name for folder'),
    createIfMissing: z.boolean().optional().default(true),
  }),
  requiresAuth: true,
  requiresApproval: false,
  approvalPolicy: 'auto_approve',

  execute: async (input: unknown, context: MCPContext): Promise<MCPResult<{ folder: DriveFolder }>> => {
    try {
      const params = z.object({
        customerName: z.string(),
        createIfMissing: z.boolean().default(true),
      }).parse(input);

      // Try to find existing customer folder
      const folderName = `CSCX - ${params.customerName}`;
      const { files } = await driveService.listFiles(context.userId, {
        query: folderName,
        mimeType: 'application/vnd.google-apps.folder',
        maxResults: 1,
      });

      if (files.length > 0) {
        return {
          success: true,
          data: {
            folder: {
              id: files[0].id,
              name: files[0].name,
              mimeType: files[0].mimeType,
              webViewLink: files[0].webViewLink,
            } as DriveFolder,
          },
          metadata: { created: false },
        };
      }

      if (!params.createIfMissing) {
        return {
          success: false,
          error: 'Customer folder not found',
        };
      }

      // Create folder structure
      const folder = await driveService.createFolder(context.userId, folderName);

      // Create subfolders
      const subfolders = [
        '01 - Onboarding',
        '02 - Meetings',
        '03 - QBRs',
        '04 - Contracts',
        '05 - Reports',
      ];

      for (const subfolder of subfolders) {
        await driveService.createFolder(context.userId, subfolder, folder.id);
      }

      return {
        success: true,
        data: { folder },
        metadata: { created: true, subfolders: subfolders.length },
      };
    } catch (error) {
      return {
        success: false,
        error: (error as Error).message,
        retryable: false,
      };
    }
  },
});

// ============================================
// Export all Drive tools
// ============================================

export const driveTools: MCPTool[] = [
  driveListFiles,
  driveGetFile,
  driveCreateFolder,
  driveUploadFile,
  driveShareFile,
  driveDeleteFile,
  driveCopyFile,
  driveMoveFile,
  driveSearch,
  driveGetCustomerFolder,
];
