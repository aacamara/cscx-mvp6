/**
 * Email Response Suggestions Routes
 * PRD-215: Smart Email Response Suggestions
 *
 * API endpoints for generating, sending, and providing feedback
 * on AI-powered email response suggestions.
 */

import { Router, Request, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import {
  generateEmailSuggestions,
  gatherEmailContext,
  getStakeholderByEmail,
  storeSuggestionFeedback,
  getFeedbackStats,
} from '../services/ai/email-response-suggestions.js';
import { gmailService } from '../services/google/gmail.js';
import { createClient } from '@supabase/supabase-js';
import { config } from '../config/index.js';
import { applyOrgFilter } from '../middleware/orgFilter.js';
import { authMiddleware } from '../middleware/auth.js';

const router = Router();

// Initialize Supabase client
let supabase: ReturnType<typeof createClient> | null = null;
if (config.supabaseUrl && config.supabaseServiceKey) {
  supabase = createClient(config.supabaseUrl, config.supabaseServiceKey);
}

// In-memory cache for suggestions (keyed by emailId)
const suggestionCache = new Map<string, {
  suggestions: any[];
  detectedIntent: string;
  urgency: string;
  recommendedAction: string;
  contextSummary: string;
  generatedAt: Date;
  expiresAt: Date;
}>();

// Clean up expired cache entries periodically
setInterval(() => {
  const now = new Date();
  for (const [key, value] of suggestionCache.entries()) {
    if (value.expiresAt < now) {
      suggestionCache.delete(key);
    }
  }
}, 60000); // Every minute

/**
 * POST /api/email/suggest-response
 * Generate email response suggestions for an incoming email
 */
router.post('/suggest-response', async (req: Request, res: Response) => {
  try {
    const userId = req.headers['x-user-id'] as string;
    const {
      emailId,
      threadId,
      customerId,
      stakeholderId,
      emailContent,
      forceRefresh = false,
    } = req.body;

    if (!customerId) {
      return res.status(400).json({
        success: false,
        error: 'customerId is required',
      });
    }

    // Check cache first (unless forceRefresh)
    const cacheKey = `${emailId || 'manual'}-${customerId}`;
    if (!forceRefresh && suggestionCache.has(cacheKey)) {
      const cached = suggestionCache.get(cacheKey)!;
      return res.json({
        success: true,
        ...cached,
        fromCache: true,
      });
    }

    // Get email content - either from request or from Gmail
    let email: any;
    if (emailContent) {
      // Use provided email content
      email = {
        from: emailContent.from,
        subject: emailContent.subject,
        bodyText: emailContent.bodyText,
        receivedAt: emailContent.receivedAt ? new Date(emailContent.receivedAt) : new Date(),
      };
    } else if (emailId && userId) {
      // Fetch from Gmail
      try {
        const { messages } = await gmailService.getThread(userId, threadId || emailId);
        const lastInboundMessage = messages.filter(m => m.isInbound).pop();
        if (!lastInboundMessage) {
          return res.status(400).json({
            success: false,
            error: 'No inbound email found in thread',
          });
        }
        email = {
          from: lastInboundMessage.from,
          subject: lastInboundMessage.subject,
          bodyText: lastInboundMessage.bodyText,
          receivedAt: lastInboundMessage.sentAt,
          threadHistory: messages.slice(-5).map(m => ({
            from: m.from.email,
            bodyText: m.bodyText.slice(0, 500),
            sentAt: m.sentAt,
            isInbound: m.isInbound,
          })),
        };
      } catch (gmailError) {
        console.error('Error fetching email from Gmail:', gmailError);
        return res.status(400).json({
          success: false,
          error: 'Could not fetch email from Gmail. Provide emailContent instead.',
        });
      }
    } else {
      return res.status(400).json({
        success: false,
        error: 'Either emailId with userId, or emailContent is required',
      });
    }

    // Gather customer context
    const context = await gatherEmailContext(customerId);
    if (!context) {
      return res.status(404).json({
        success: false,
        error: 'Customer not found',
      });
    }

    // Get stakeholder info if available
    let stakeholder = null;
    if (stakeholderId && supabase) {
      let stakeQuery = supabase.from('stakeholders').select('*');
      stakeQuery = applyOrgFilter(stakeQuery, req);
      const { data } = await stakeQuery
        .eq('id', stakeholderId)
        .single();
      if (data) {
        stakeholder = {
          name: data.name,
          email: data.email,
          role: data.role,
          title: data.title,
          isDecisionMaker: data.is_decision_maker,
        };
      }
    } else if (email.from?.email) {
      // Try to find stakeholder by email
      stakeholder = await getStakeholderByEmail(email.from.email, customerId);
    }

    // Get user's name for signing emails
    let senderName = 'Your CSM';
    if (userId && supabase) {
      const { data: user } = await supabase
        .from('users')
        .select('name, display_name')
        .eq('id', userId)
        .single();
      if (user) {
        senderName = user.display_name || user.name || 'Your CSM';
      }
    }

    // Generate suggestions
    const result = await generateEmailSuggestions(email, context, stakeholder, senderName);

    // Cache the result (expires in 15 minutes)
    const cacheEntry = {
      ...result,
      generatedAt: new Date(),
      expiresAt: new Date(Date.now() + 15 * 60 * 1000),
    };
    suggestionCache.set(cacheKey, cacheEntry);

    res.json({
      success: true,
      ...result,
      stakeholder,
      generatedAt: cacheEntry.generatedAt,
    });
  } catch (error) {
    console.error('Error generating email suggestions:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to generate email suggestions',
      details: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

/**
 * POST /api/email/send-suggestion
 * Send an email using a suggestion (with optional edits)
 */
router.post('/send-suggestion', async (req: Request, res: Response) => {
  try {
    const userId = req.headers['x-user-id'] as string;
    if (!userId) {
      return res.status(401).json({
        success: false,
        error: 'User authentication required',
      });
    }

    const {
      suggestionId,
      emailId,
      threadId,
      recipientEmail,
      edits,
      sendNow = true,
      scheduledTime,
      logActivity = true,
      createFollowUpTask = false,
      customerId,
    } = req.body;

    if (!recipientEmail) {
      return res.status(400).json({
        success: false,
        error: 'recipientEmail is required',
      });
    }

    // Get the suggestion from cache to get the original content
    const cacheKey = `${emailId || 'manual'}-${customerId}`;
    const cached = suggestionCache.get(cacheKey);
    const suggestion = cached?.suggestions.find((s: any) => s.id === suggestionId);

    // Build email content
    const subject = edits?.subject || suggestion?.subject || `Re: Email`;
    const body = edits?.body || suggestion?.fullText || '';

    if (!body) {
      return res.status(400).json({
        success: false,
        error: 'No email content available. Provide edits.body.',
      });
    }

    // Convert body to HTML (basic formatting)
    const bodyHtml = body
      .replace(/\n\n/g, '</p><p>')
      .replace(/\n/g, '<br>')
      .replace(/^/, '<p>')
      .replace(/$/, '</p>');

    if (sendNow) {
      // Send immediately via Gmail
      try {
        const messageId = await gmailService.sendEmail(userId, {
          to: [recipientEmail],
          subject,
          bodyHtml,
          bodyText: body,
          threadId: threadId || undefined,
          saveToDb: true,
          customerId,
        });

        // Store feedback as "used"
        await storeSuggestionFeedback(
          userId,
          suggestionId,
          emailId || 'manual',
          edits ? 'edited' : 'used',
          undefined,
          undefined,
          suggestion?.fullText,
          body
        );

        // Log activity if requested
        let activityId = null;
        if (logActivity && supabase && customerId) {
          const { data: activity } = await supabase
            .from('activity_feed')
            .insert({
              customer_id: customerId,
              user_id: userId,
              action_type: 'email_sent',
              action_data: {
                subject,
                recipient: recipientEmail,
                messageId,
                usedSuggestion: true,
                suggestionId,
              },
            })
            .select('id')
            .single();
          activityId = activity?.id;
        }

        // Create follow-up task if requested
        let followUpTaskId = null;
        if (createFollowUpTask && supabase && customerId) {
          const followUpDate = new Date(Date.now() + 3 * 24 * 60 * 60 * 1000); // 3 days from now
          const { data: task } = await supabase
            .from('tasks')
            .insert({
              customer_id: customerId,
              user_id: userId,
              title: `Follow up on: ${subject}`,
              description: `Follow up with ${recipientEmail} regarding email sent on ${new Date().toLocaleDateString()}`,
              due_date: followUpDate.toISOString(),
              status: 'pending',
              priority: 'medium',
              organization_id: (req as any).organizationId || null,
            })
            .select('id')
            .single();
          followUpTaskId = task?.id;
        }

        res.json({
          success: true,
          messageId,
          activityLogged: !!activityId,
          activityId,
          followUpTaskId,
        });
      } catch (sendError) {
        console.error('Error sending email:', sendError);
        res.status(500).json({
          success: false,
          error: 'Failed to send email via Gmail',
          details: sendError instanceof Error ? sendError.message : 'Unknown error',
        });
      }
    } else {
      // Create as draft
      try {
        const draftId = await gmailService.createDraft(userId, {
          to: [recipientEmail],
          subject,
          bodyHtml,
          bodyText: body,
          threadId: threadId || undefined,
        });

        res.json({
          success: true,
          draftId,
          scheduledTime: scheduledTime || null,
        });
      } catch (draftError) {
        console.error('Error creating draft:', draftError);
        res.status(500).json({
          success: false,
          error: 'Failed to create email draft',
          details: draftError instanceof Error ? draftError.message : 'Unknown error',
        });
      }
    }
  } catch (error) {
    console.error('Error in send-suggestion:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to process send request',
      details: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

/**
 * POST /api/email/feedback
 * Provide feedback on a suggestion (for learning)
 */
router.post('/feedback', async (req: Request, res: Response) => {
  try {
    const userId = req.headers['x-user-id'] as string;
    if (!userId) {
      return res.status(401).json({
        success: false,
        error: 'User authentication required',
      });
    }

    const {
      suggestionId,
      emailId,
      feedback,
      rating,
      notes,
      originalText,
      finalText,
    } = req.body;

    if (!suggestionId || !feedback) {
      return res.status(400).json({
        success: false,
        error: 'suggestionId and feedback are required',
      });
    }

    if (!['used', 'edited', 'rejected'].includes(feedback)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid feedback value. Must be: used, edited, or rejected',
      });
    }

    if (rating !== undefined && (rating < 1 || rating > 5)) {
      return res.status(400).json({
        success: false,
        error: 'Rating must be between 1 and 5',
      });
    }

    const feedbackId = await storeSuggestionFeedback(
      userId,
      suggestionId,
      emailId || 'unknown',
      feedback,
      rating,
      notes,
      originalText,
      finalText
    );

    res.json({
      success: true,
      feedbackId,
    });
  } catch (error) {
    console.error('Error storing feedback:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to store feedback',
    });
  }
});

/**
 * GET /api/email/feedback/stats
 * Get feedback statistics (for admin/analytics)
 */
router.get('/feedback/stats', async (req: Request, res: Response) => {
  try {
    const userId = req.headers['x-user-id'] as string;
    const includeGlobal = req.query.global === 'true';

    // Get user-specific stats
    const userStats = userId ? await getFeedbackStats(userId) : null;

    // Get global stats if requested
    const globalStats = includeGlobal ? await getFeedbackStats() : null;

    res.json({
      success: true,
      userStats,
      globalStats,
    });
  } catch (error) {
    console.error('Error fetching feedback stats:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch feedback statistics',
    });
  }
});

/**
 * GET /api/email/context/:customerId
 * Get email context for a customer (useful for debugging/previewing)
 */
router.get('/context/:customerId', async (req: Request, res: Response) => {
  try {
    const { customerId } = req.params;

    const context = await gatherEmailContext(customerId);

    if (!context) {
      return res.status(404).json({
        success: false,
        error: 'Customer not found',
      });
    }

    res.json({
      success: true,
      context,
    });
  } catch (error) {
    console.error('Error fetching email context:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch email context',
    });
  }
});

/**
 * GET /api/email/stakeholder
 * Look up stakeholder by email address
 */
router.get('/stakeholder', async (req: Request, res: Response) => {
  try {
    const { email, customerId } = req.query;

    if (!email || typeof email !== 'string') {
      return res.status(400).json({
        success: false,
        error: 'email query parameter is required',
      });
    }

    const stakeholder = await getStakeholderByEmail(
      email,
      typeof customerId === 'string' ? customerId : undefined
    );

    if (!stakeholder) {
      return res.status(404).json({
        success: false,
        error: 'Stakeholder not found',
      });
    }

    res.json({
      success: true,
      stakeholder,
    });
  } catch (error) {
    console.error('Error looking up stakeholder:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to look up stakeholder',
    });
  }
});

export default router;
