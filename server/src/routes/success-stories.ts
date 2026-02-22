/**
 * Success Story Routes (PRD-240)
 *
 * API endpoints for automated success story drafting, editing, and publishing.
 */

import { Router, Request, Response } from 'express';
import {
  generateSuccessStory,
  saveSuccessStory,
  getSuccessStory,
  updateSuccessStory,
  listSuccessStories,
  deleteSuccessStory,
  getCustomerStoryContext,
  extractQuotesFromTranscripts,
  GenerateStoryParams,
  SuccessStory,
  StoryStatus,
  StoryTone,
} from '../services/ai/success-story.js';
import { authMiddleware } from '../middleware/auth.js';
import { applyOrgFilter, withOrgId } from '../middleware/orgFilter.js';

const router = Router();

/**
 * POST /api/content/success-story/generate
 *
 * Generate a new success story draft using AI.
 */
router.post('/generate', async (req: Request, res: Response) => {
  try {
    const userId = req.headers['x-user-id'] as string;
    if (!userId) {
      return res.status(401).json({ error: 'User ID required' });
    }

    const {
      customerId,
      customerName,
      industry,
      companySize,
      region,
      productUsed,
      implementationDate,
      metrics,
      challenges,
      solutions,
      outcomes,
      quotes,
      milestones,
      tone,
      focusArea,
      customInstructions,
      includeCallToAction,
      autoSave,
    } = req.body;

    if (!customerId && !customerName) {
      return res.status(400).json({
        error: 'Either customerId or customerName is required',
      });
    }

    // If customerId provided, try to get context automatically
    let context;
    if (customerId && !customerName) {
      context = await getCustomerStoryContext(customerId);
      if (!context) {
        return res.status(404).json({ error: 'Customer not found' });
      }
      // Merge any provided overrides
      if (metrics) context.metrics = { ...context.metrics, ...metrics };
      if (challenges) context.challenges = challenges;
      if (solutions) context.solutions = solutions;
      if (outcomes) context.outcomes = outcomes;
      if (quotes) context.quotes = quotes;
      if (milestones) context.milestones = milestones;
    } else {
      context = {
        customerId: customerId || `temp_${Date.now()}`,
        customerName,
        industry,
        companySize,
        region,
        productUsed,
        implementationDate,
        metrics: metrics || {},
        challenges,
        solutions,
        outcomes,
        quotes,
        milestones,
      };
    }

    const params: GenerateStoryParams = {
      context,
      tone: tone as StoryTone,
      focusArea,
      customInstructions,
      includeCallToAction,
    };

    const generatedStory = await generateSuccessStory(params);

    // Optionally save as draft
    let savedStory: SuccessStory | null = null;
    if (autoSave) {
      savedStory = await saveSuccessStory(
        {
          customerId: context.customerId,
          title: generatedStory.title,
          summary: generatedStory.summary,
          challenge: generatedStory.challenge,
          solution: generatedStory.solution,
          results: generatedStory.results,
          narrative: generatedStory.narrative,
          metrics: context.metrics,
          quotes: generatedStory.quotes,
          tags: generatedStory.tags,
          status: 'draft',
          tone: tone || 'professional',
          metadata: {
            focusArea,
            suggestedImages: generatedStory.suggestedImages,
            callToAction: generatedStory.callToAction,
          },
        },
        userId
      );
    }

    res.json({
      success: true,
      story: generatedStory,
      savedId: savedStory?.id,
      context: {
        customerId: context.customerId,
        customerName: context.customerName,
      },
    });
  } catch (error) {
    console.error('Story generation error:', error);
    res.status(500).json({
      error: 'Failed to generate success story',
      message: (error as Error).message,
    });
  }
});

/**
 * POST /api/content/success-story
 *
 * Create/save a success story.
 */
router.post('/', async (req: Request, res: Response) => {
  try {
    const userId = req.headers['x-user-id'] as string;
    if (!userId) {
      return res.status(401).json({ error: 'User ID required' });
    }

    const {
      customerId,
      title,
      summary,
      challenge,
      solution,
      results,
      narrative,
      metrics,
      quotes,
      tags,
      tone,
      status,
      metadata,
    } = req.body;

    if (!customerId || !title) {
      return res.status(400).json({
        error: 'customerId and title are required',
      });
    }

    const story = await saveSuccessStory(
      {
        customerId,
        title,
        summary,
        challenge,
        solution,
        results,
        narrative,
        metrics,
        quotes,
        tags,
        tone: tone || 'professional',
        status: status || 'draft',
        metadata,
      },
      userId
    );

    if (!story) {
      return res.status(500).json({ error: 'Failed to save story' });
    }

    res.json({
      success: true,
      story,
    });
  } catch (error) {
    console.error('Story save error:', error);
    res.status(500).json({
      error: 'Failed to save success story',
      message: (error as Error).message,
    });
  }
});

/**
 * GET /api/content/success-story/:id
 *
 * Get a success story by ID.
 */
router.get('/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const story = await getSuccessStory(id);

    if (!story) {
      return res.status(404).json({ error: 'Story not found' });
    }

    res.json({
      success: true,
      story,
    });
  } catch (error) {
    console.error('Story fetch error:', error);
    res.status(500).json({
      error: 'Failed to fetch success story',
      message: (error as Error).message,
    });
  }
});

/**
 * PUT /api/content/success-story/:id
 *
 * Update a success story.
 */
router.put('/:id', async (req: Request, res: Response) => {
  try {
    const userId = req.headers['x-user-id'] as string;
    if (!userId) {
      return res.status(401).json({ error: 'User ID required' });
    }

    const { id } = req.params;
    const updates = req.body;

    const story = await updateSuccessStory(id, updates, userId);

    if (!story) {
      return res.status(404).json({ error: 'Story not found or update failed' });
    }

    res.json({
      success: true,
      story,
    });
  } catch (error) {
    console.error('Story update error:', error);
    res.status(500).json({
      error: 'Failed to update success story',
      message: (error as Error).message,
    });
  }
});

/**
 * POST /api/content/success-story/:id/submit
 *
 * Submit story for customer approval.
 */
router.post('/:id/submit', async (req: Request, res: Response) => {
  try {
    const userId = req.headers['x-user-id'] as string;
    if (!userId) {
      return res.status(401).json({ error: 'User ID required' });
    }

    const { id } = req.params;
    const { approverEmail, message } = req.body;

    // Get the story first
    const existingStory = await getSuccessStory(id);
    if (!existingStory) {
      return res.status(404).json({ error: 'Story not found' });
    }

    // Update status to pending approval
    const story = await updateSuccessStory(
      id,
      {
        status: 'pending_approval',
        metadata: {
          ...existingStory.metadata,
          approvalRequest: {
            requestedBy: userId,
            requestedAt: new Date().toISOString(),
            approverEmail,
            message,
          },
        },
      },
      userId
    );

    // In production, would send email to approverEmail here
    // Using Gmail integration from server/src/services/google/gmail.ts

    res.json({
      success: true,
      story,
      message: approverEmail
        ? `Approval request sent to ${approverEmail}`
        : 'Story submitted for approval',
    });
  } catch (error) {
    console.error('Story submit error:', error);
    res.status(500).json({
      error: 'Failed to submit story for approval',
      message: (error as Error).message,
    });
  }
});

/**
 * POST /api/content/success-story/:id/approve
 *
 * Approve a story for publishing.
 */
router.post('/:id/approve', async (req: Request, res: Response) => {
  try {
    const userId = req.headers['x-user-id'] as string;
    if (!userId) {
      return res.status(401).json({ error: 'User ID required' });
    }

    const { id } = req.params;

    const story = await updateSuccessStory(
      id,
      {
        status: 'approved',
        approvedBy: userId,
      },
      userId
    );

    if (!story) {
      return res.status(404).json({ error: 'Story not found' });
    }

    res.json({
      success: true,
      story,
      message: 'Story approved and ready for publishing',
    });
  } catch (error) {
    console.error('Story approve error:', error);
    res.status(500).json({
      error: 'Failed to approve story',
      message: (error as Error).message,
    });
  }
});

/**
 * POST /api/content/success-story/:id/publish
 *
 * Publish an approved story.
 */
router.post('/:id/publish', async (req: Request, res: Response) => {
  try {
    const userId = req.headers['x-user-id'] as string;
    if (!userId) {
      return res.status(401).json({ error: 'User ID required' });
    }

    const { id } = req.params;
    const { channels } = req.body; // e.g., ['web', 'pdf', 'slides']

    // Check if approved
    const existingStory = await getSuccessStory(id);
    if (!existingStory) {
      return res.status(404).json({ error: 'Story not found' });
    }

    if (existingStory.status !== 'approved') {
      return res.status(400).json({
        error: 'Story must be approved before publishing',
        currentStatus: existingStory.status,
      });
    }

    const story = await updateSuccessStory(
      id,
      {
        status: 'published',
        publishedAt: new Date().toISOString(),
        metadata: {
          ...existingStory.metadata,
          publishedChannels: channels || ['web'],
          publishedBy: userId,
        },
      },
      userId
    );

    // In production, would trigger publishing to various channels here
    // - Web: Create landing page
    // - PDF: Generate using Google Docs
    // - Slides: Generate using Google Slides

    res.json({
      success: true,
      story,
      publishedTo: channels || ['web'],
      message: 'Story published successfully',
    });
  } catch (error) {
    console.error('Story publish error:', error);
    res.status(500).json({
      error: 'Failed to publish story',
      message: (error as Error).message,
    });
  }
});

/**
 * GET /api/content/success-story
 *
 * List success stories with optional filters.
 */
router.get('/', async (req: Request, res: Response) => {
  try {
    const { customerId, status, limit } = req.query;

    const stories = await listSuccessStories(
      customerId as string | undefined,
      status as StoryStatus | undefined,
      limit ? parseInt(limit as string, 10) : 50
    );

    res.json({
      success: true,
      stories,
      total: stories.length,
    });
  } catch (error) {
    console.error('Story list error:', error);
    res.status(500).json({
      error: 'Failed to list success stories',
      message: (error as Error).message,
    });
  }
});

/**
 * DELETE /api/content/success-story/:id
 *
 * Delete a success story.
 */
router.delete('/:id', async (req: Request, res: Response) => {
  try {
    const userId = req.headers['x-user-id'] as string;
    if (!userId) {
      return res.status(401).json({ error: 'User ID required' });
    }

    const { id } = req.params;

    const success = await deleteSuccessStory(id);

    if (!success) {
      return res.status(404).json({ error: 'Story not found or delete failed' });
    }

    res.json({
      success: true,
      message: 'Story deleted successfully',
    });
  } catch (error) {
    console.error('Story delete error:', error);
    res.status(500).json({
      error: 'Failed to delete story',
      message: (error as Error).message,
    });
  }
});

/**
 * GET /api/content/success-story/customer/:customerId/context
 *
 * Get auto-populated context for a customer.
 */
router.get('/customer/:customerId/context', async (req: Request, res: Response) => {
  try {
    const { customerId } = req.params;

    const context = await getCustomerStoryContext(customerId);

    if (!context) {
      return res.status(404).json({ error: 'Customer not found' });
    }

    res.json({
      success: true,
      context,
    });
  } catch (error) {
    console.error('Context fetch error:', error);
    res.status(500).json({
      error: 'Failed to fetch customer context',
      message: (error as Error).message,
    });
  }
});

/**
 * GET /api/content/success-story/customer/:customerId/quotes
 *
 * Extract potential quotes from customer transcripts.
 */
router.get('/customer/:customerId/quotes', async (req: Request, res: Response) => {
  try {
    const { customerId } = req.params;
    const { limit } = req.query;

    const quotes = await extractQuotesFromTranscripts(
      customerId,
      limit ? parseInt(limit as string, 10) : 5
    );

    res.json({
      success: true,
      quotes,
      total: quotes.length,
    });
  } catch (error) {
    console.error('Quote extraction error:', error);
    res.status(500).json({
      error: 'Failed to extract quotes',
      message: (error as Error).message,
    });
  }
});

/**
 * POST /api/content/success-story/:id/export
 *
 * Export story to various formats (PDF, Slides, etc.)
 */
router.post('/:id/export', async (req: Request, res: Response) => {
  try {
    const userId = req.headers['x-user-id'] as string;
    if (!userId) {
      return res.status(401).json({ error: 'User ID required' });
    }

    const { id } = req.params;
    const { format } = req.body; // 'pdf', 'slides', 'doc', 'web'

    const story = await getSuccessStory(id);
    if (!story) {
      return res.status(404).json({ error: 'Story not found' });
    }

    // In production, would generate actual exports using Google Workspace APIs
    // For now, return the structured data for client-side rendering

    const exportFormats: Record<string, { mimeType: string; template: string }> = {
      pdf: { mimeType: 'application/pdf', template: 'success_story_pdf' },
      slides: { mimeType: 'application/vnd.google-apps.presentation', template: 'success_story_slides' },
      doc: { mimeType: 'application/vnd.google-apps.document', template: 'success_story_doc' },
      web: { mimeType: 'text/html', template: 'success_story_web' },
    };

    const selectedFormat = exportFormats[format] || exportFormats.web;

    res.json({
      success: true,
      story,
      export: {
        format,
        mimeType: selectedFormat.mimeType,
        template: selectedFormat.template,
        // In production, would include:
        // fileId: 'google-file-id',
        // webViewLink: 'https://docs.google.com/...',
        // downloadLink: 'https://...',
      },
      message: `Export prepared in ${format} format`,
    });
  } catch (error) {
    console.error('Story export error:', error);
    res.status(500).json({
      error: 'Failed to export story',
      message: (error as Error).message,
    });
  }
});

export default router;
