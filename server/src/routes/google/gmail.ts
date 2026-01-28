/**
 * Gmail API Routes
 * Endpoints for email operations
 */

import { Router, Request, Response, NextFunction } from 'express';
import { gmailService } from '../../services/google/gmail.js';
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
 * GET /gmail/threads
 * List email threads
 */
router.get('/threads', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = requireAuth(req, res);
    if (!userId) return;
    const { maxResults, pageToken, labelIds, query } = req.query;

    const result = await gmailService.listThreads(userId, {
      maxResults: maxResults ? parseInt(maxResults as string) : undefined,
      pageToken: pageToken as string,
      labelIds: labelIds ? (labelIds as string).split(',') : undefined,
      query: query as string,
    });

    res.json(result);
  } catch (error) {
    next(error);
  }
});

/**
 * GET /gmail/threads/:threadId
 * Get a single thread with all messages
 */
router.get('/threads/:threadId', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = requireAuth(req, res);
    if (!userId) return;
    const { threadId } = req.params;

    const result = await gmailService.getThread(userId, threadId);
    res.json(result);
  } catch (error) {
    next(error);
  }
});

/**
 * POST /gmail/threads/:threadId/read
 * Mark thread as read
 */
router.post('/threads/:threadId/read', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = requireAuth(req, res);
    if (!userId) return;
    const { threadId } = req.params;

    await gmailService.markAsRead(userId, threadId);
    res.json({ success: true });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /gmail/threads/:threadId/unread
 * Mark thread as unread
 */
router.post('/threads/:threadId/unread', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = requireAuth(req, res);
    if (!userId) return;
    const { threadId } = req.params;

    await gmailService.markAsUnread(userId, threadId);
    res.json({ success: true });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /gmail/threads/:threadId/archive
 * Archive a thread
 */
router.post('/threads/:threadId/archive', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = requireAuth(req, res);
    if (!userId) return;
    const { threadId } = req.params;

    await gmailService.archiveThread(userId, threadId);
    res.json({ success: true });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /gmail/threads/:threadId/trash
 * Move thread to trash
 */
router.post('/threads/:threadId/trash', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = requireAuth(req, res);
    if (!userId) return;
    const { threadId } = req.params;

    await gmailService.trashThread(userId, threadId);
    res.json({ success: true });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /gmail/threads/:threadId/star
 * Star a thread
 */
router.post('/threads/:threadId/star', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = requireAuth(req, res);
    if (!userId) return;
    const { threadId } = req.params;

    await gmailService.starThread(userId, threadId);
    res.json({ success: true });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /gmail/threads/:threadId/unstar
 * Unstar a thread
 */
router.post('/threads/:threadId/unstar', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = requireAuth(req, res);
    if (!userId) return;
    const { threadId } = req.params;

    await gmailService.unstarThread(userId, threadId);
    res.json({ success: true });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /gmail/search
 * Search emails
 */
router.get('/search', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = requireAuth(req, res);
    if (!userId) return;
    const { q, maxResults } = req.query;

    if (!q) {
      return res.status(400).json({ error: 'Query parameter "q" is required' });
    }

    const threads = await gmailService.searchEmails(
      userId,
      q as string,
      maxResults ? parseInt(maxResults as string) : undefined
    );

    res.json({ threads });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /gmail/drafts
 * Create a draft email
 */
router.post('/drafts', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = requireAuth(req, res);
    if (!userId) return;
    const { to, cc, bcc, subject, bodyHtml, bodyText, threadId, inReplyTo } = req.body;

    if (!to || !to.length) {
      return res.status(400).json({ error: 'At least one recipient is required' });
    }

    const draftId = await gmailService.createDraft(userId, {
      to,
      cc,
      bcc,
      subject,
      bodyHtml: bodyHtml || '',
      bodyText,
      threadId,
      inReplyTo,
    });

    res.json({ draftId });
  } catch (error) {
    next(error);
  }
});

/**
 * PUT /gmail/drafts/:draftId
 * Update a draft email
 */
router.put('/drafts/:draftId', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = requireAuth(req, res);
    if (!userId) return;
    const { draftId } = req.params;
    const { to, cc, bcc, subject, bodyHtml, bodyText, threadId, inReplyTo } = req.body;

    await gmailService.updateDraft(userId, draftId, {
      to,
      cc,
      bcc,
      subject,
      bodyHtml: bodyHtml || '',
      bodyText,
      threadId,
      inReplyTo,
    });

    res.json({ draftId });
  } catch (error) {
    next(error);
  }
});

/**
 * DELETE /gmail/drafts/:draftId
 * Delete a draft
 */
router.delete('/drafts/:draftId', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = requireAuth(req, res);
    if (!userId) return;
    const { draftId } = req.params;

    await gmailService.deleteDraft(userId, draftId);
    res.json({ success: true });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /gmail/drafts/:draftId/send
 * Send a draft
 */
router.post('/drafts/:draftId/send', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = requireAuth(req, res);
    if (!userId) return;
    const { draftId } = req.params;

    const messageId = await gmailService.sendDraft(userId, draftId);
    res.json({ messageId });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /gmail/send
 * Send an email directly
 */
router.post('/send', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = requireAuth(req, res);
    if (!userId) return;
    const { to, cc, bcc, subject, bodyHtml, bodyText, threadId, inReplyTo, saveToDb, customerId } = req.body;

    if (!to || !to.length) {
      return res.status(400).json({ error: 'At least one recipient is required' });
    }

    const messageId = await gmailService.sendEmail(userId, {
      to,
      cc,
      bcc,
      subject,
      bodyHtml: bodyHtml || '',
      bodyText,
      threadId,
      inReplyTo,
      saveToDb,
      customerId,
    });

    res.json({ messageId });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /gmail/labels
 * Get all labels
 */
router.get('/labels', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = requireAuth(req, res);
    if (!userId) return;
    const labels = await gmailService.getLabels(userId);
    res.json({ labels });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /gmail/sync
 * Sync threads to database
 */
router.post('/sync', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = requireAuth(req, res);
    if (!userId) return;
    const { customerId, maxResults, query } = req.body;

    const synced = await gmailService.syncThreadsToDb(userId, customerId, {
      maxResults,
      query,
    });

    res.json({ synced });
  } catch (error) {
    next(error);
  }
});

export default router;
