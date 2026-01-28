/**
 * Drive API Routes
 * Endpoints for file operations and knowledge base indexing
 */

import { Router, Request, Response, NextFunction } from 'express';
import { driveService, GOOGLE_MIME_TYPES } from '../../services/google/drive.js';
import { docsService } from '../../services/google/docs.js';
import { config } from '../../config/index.js';

const router = Router();

// Demo user ID - ONLY used in development mode
const DEMO_USER_ID = 'df2dc7be-ece0-40b2-a9d7-0f6c45b75131';

/**
 * Get user ID from request.
 * SECURITY: Demo user fallback ONLY allowed in development mode.
 * Production mode requires authenticated user (set by authMiddleware).
 */
const getUserId = (req: Request): string | null => {
  // Prefer userId from auth middleware (set by JWT verification)
  if ((req as any).userId) {
    return (req as any).userId;
  }

  // Development only: allow demo user for local testing
  if (config.nodeEnv === 'development') {
    return DEMO_USER_ID;
  }

  // Production: no fallback - must be authenticated
  return null;
};

/**
 * Helper to require authentication.
 * Returns 401 if not authenticated in production.
 */
const requireAuth = (req: Request, res: Response): string | null => {
  const userId = requireAuth(req, res);
    if (!userId) return;
  if (!userId) {
    res.status(401).json({
      error: 'Unauthorized',
      message: 'Authentication required'
    });
    return null;
  }
  return userId;
};

/**
 * GET /drive/files
 * List files in a folder
 */
router.get('/files', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = requireAuth(req, res);
    if (!userId) return;
    const { folderId, mimeType, query, maxResults, pageToken, orderBy } = req.query;

    const result = await driveService.listFiles(userId, {
      folderId: folderId as string,
      mimeType: mimeType as string,
      query: query as string,
      maxResults: maxResults ? parseInt(maxResults as string) : undefined,
      pageToken: pageToken as string,
      orderBy: orderBy as 'modifiedTime' | 'name' | 'createdTime' | 'folder',
    });

    res.json(result);
  } catch (error) {
    next(error);
  }
});

/**
 * GET /drive/files/recent
 * Get recently modified files
 */
router.get('/files/recent', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = requireAuth(req, res);
    if (!userId) return;
    const { maxResults } = req.query;

    const files = await driveService.getRecentFiles(
      userId,
      maxResults ? parseInt(maxResults as string) : 20
    );

    res.json({ files });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /drive/files/starred
 * Get starred files
 */
router.get('/files/starred', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = requireAuth(req, res);
    if (!userId) return;
    const files = await driveService.getStarredFiles(userId);
    res.json({ files });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /drive/files/shared
 * Get files shared with me
 */
router.get('/files/shared', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = requireAuth(req, res);
    if (!userId) return;
    const files = await driveService.getSharedFiles(userId);
    res.json({ files });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /drive/files/:fileId
 * Get file metadata
 */
router.get('/files/:fileId', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = requireAuth(req, res);
    if (!userId) return;
    const { fileId } = req.params;

    const file = await driveService.getFile(userId, fileId);
    res.json({ file });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /drive/files/:fileId/content
 * Get file content (for text-based files)
 */
router.get('/files/:fileId/content', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = requireAuth(req, res);
    if (!userId) return;
    const { fileId } = req.params;

    const content = await driveService.getFileContent(userId, fileId);
    res.json(content);
  } catch (error) {
    next(error);
  }
});

/**
 * POST /drive/files/:fileId/star
 * Star a file
 */
router.post('/files/:fileId/star', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = requireAuth(req, res);
    if (!userId) return;
    const { fileId } = req.params;

    await driveService.setStarred(userId, fileId, true);
    res.json({ success: true });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /drive/files/:fileId/unstar
 * Unstar a file
 */
router.post('/files/:fileId/unstar', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = requireAuth(req, res);
    if (!userId) return;
    const { fileId } = req.params;

    await driveService.setStarred(userId, fileId, false);
    res.json({ success: true });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /drive/files/:fileId/trash
 * Move file to trash
 */
router.post('/files/:fileId/trash', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = requireAuth(req, res);
    if (!userId) return;
    const { fileId } = req.params;

    await driveService.setTrashed(userId, fileId, true);
    res.json({ success: true });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /drive/files/:fileId/restore
 * Restore file from trash
 */
router.post('/files/:fileId/restore', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = requireAuth(req, res);
    if (!userId) return;
    const { fileId } = req.params;

    await driveService.setTrashed(userId, fileId, false);
    res.json({ success: true });
  } catch (error) {
    next(error);
  }
});

/**
 * DELETE /drive/files/:fileId
 * Permanently delete a file (must be in trash)
 */
router.delete('/files/:fileId', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = requireAuth(req, res);
    if (!userId) return;
    const { fileId } = req.params;

    await driveService.deleteFile(userId, fileId);
    res.json({ success: true });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /drive/files/:fileId/move
 * Move file to a different folder
 */
router.post('/files/:fileId/move', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = requireAuth(req, res);
    if (!userId) return;
    const { fileId } = req.params;
    const { folderId } = req.body;

    if (!folderId) {
      return res.status(400).json({ error: 'folderId is required' });
    }

    const file = await driveService.moveFile(userId, fileId, folderId);
    res.json({ file });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /drive/search
 * Search files
 */
router.get('/search', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = requireAuth(req, res);
    if (!userId) return;
    const { q, mimeType, maxResults, pageToken } = req.query;

    if (!q) {
      return res.status(400).json({ error: 'Query parameter "q" is required' });
    }

    const result = await driveService.searchFiles(userId, q as string, {
      mimeType: mimeType as string,
      maxResults: maxResults ? parseInt(maxResults as string) : undefined,
      pageToken: pageToken as string,
    });

    res.json(result);
  } catch (error) {
    next(error);
  }
});

/**
 * GET /drive/folders
 * List folders
 */
router.get('/folders', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = requireAuth(req, res);
    if (!userId) return;
    const { parentId } = req.query;

    const folders = await driveService.listFolders(userId, parentId as string);
    res.json({ folders });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /drive/folders/:folderId/tree
 * Get folder tree (for navigation)
 */
router.get('/folders/:folderId/tree', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = requireAuth(req, res);
    if (!userId) return;
    const { folderId } = req.params;

    const tree = await driveService.getFolderTree(userId, folderId);
    res.json(tree);
  } catch (error) {
    next(error);
  }
});

/**
 * POST /drive/folders
 * Create a new folder
 */
router.post('/folders', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = requireAuth(req, res);
    if (!userId) return;
    const { name, parentId } = req.body;

    if (!name) {
      return res.status(400).json({ error: 'name is required' });
    }

    const folder = await driveService.createFolder(userId, name, parentId);
    res.status(201).json({ folder });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /drive/documents
 * List Google Docs
 */
router.get('/documents', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = requireAuth(req, res);
    if (!userId) return;
    const { maxResults } = req.query;

    const files = await driveService.getDocuments(
      userId,
      maxResults ? parseInt(maxResults as string) : 50
    );

    res.json({ files });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /drive/spreadsheets
 * List Google Sheets
 */
router.get('/spreadsheets', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = requireAuth(req, res);
    if (!userId) return;
    const { maxResults } = req.query;

    const files = await driveService.getSpreadsheets(
      userId,
      maxResults ? parseInt(maxResults as string) : 50
    );

    res.json({ files });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /drive/presentations
 * List Google Slides
 */
router.get('/presentations', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = requireAuth(req, res);
    if (!userId) return;
    const { maxResults } = req.query;

    const files = await driveService.getPresentations(
      userId,
      maxResults ? parseInt(maxResults as string) : 50
    );

    res.json({ files });
  } catch (error) {
    next(error);
  }
});

// ==================== Knowledge Base / RAG Endpoints ====================

/**
 * POST /drive/index/:fileId
 * Index a file for RAG
 */
router.post('/index/:fileId', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = requireAuth(req, res);
    if (!userId) return;
    const { fileId } = req.params;
    const { customerId } = req.body;

    const result = await driveService.indexFileForRAG(userId, fileId, customerId);
    res.json(result);
  } catch (error) {
    next(error);
  }
});

/**
 * POST /drive/index-folder/:folderId
 * Index all files in a folder for RAG
 */
router.post('/index-folder/:folderId', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = requireAuth(req, res);
    if (!userId) return;
    const { folderId } = req.params;
    const { customerId, recursive, maxFiles } = req.body;

    const result = await driveService.indexFolderForRAG(userId, folderId, customerId, {
      recursive,
      maxFiles,
    });

    res.json(result);
  } catch (error) {
    next(error);
  }
});

/**
 * POST /drive/sync
 * Sync files to database
 */
router.post('/sync', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = requireAuth(req, res);
    if (!userId) return;
    const { customerId, folderId, maxFiles } = req.body;

    const synced = await driveService.syncFilesToDb(userId, customerId, {
      folderId,
      maxFiles,
    });

    res.json({ synced });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /drive/mime-types
 * Get available Google MIME types
 */
router.get('/mime-types', (req: Request, res: Response) => {
  res.json({ mimeTypes: GOOGLE_MIME_TYPES });
});

/**
 * POST /drive/create-doc
 * Create a Google Doc with HTML content (for analysis reports)
 */
router.post('/create-doc', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = requireAuth(req, res);
    if (!userId) return;
    const { title, content, folderId } = req.body;

    if (!title) {
      return res.status(400).json({ error: 'Title is required' });
    }

    // Create the document
    const doc = await docsService.createDocument(userId, {
      title,
      folderId,
    });

    // If HTML content provided, we'll need to convert and insert
    // For now, create doc and add content as text
    if (content && doc.documentId) {
      // Extract text from HTML for the document body
      const textContent = content
        .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
        .replace(/<[^>]+>/g, '\n')
        .replace(/\n{3,}/g, '\n\n')
        .trim();

      // Insert the content
      try {
        await docsService.insertText(userId, doc.documentId, textContent, 1);
      } catch (insertError) {
        console.warn('Could not insert content:', insertError);
        // Document was still created, just without content
      }
    }

    res.json({
      success: true,
      documentId: doc.documentId,
      title: doc.title,
      webViewLink: `https://docs.google.com/document/d/${doc.documentId}/edit`,
    });
  } catch (error) {
    console.error('Create doc error:', error);
    next(error);
  }
});

export default router;
