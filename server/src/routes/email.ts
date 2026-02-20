/**
 * Email Routes (PRD: Email Integration)
 *
 * API endpoints for email syncing, searching, and summarization.
 */

import { Router, Request, Response } from 'express';
import { Anthropic } from '@anthropic-ai/sdk';
import { emailService } from '../services/email/index.js';
import { createClient } from '@supabase/supabase-js';
import { config } from '../config/index.js';
import { applyOrgFilter } from '../middleware/orgFilter.js';

const router = Router();

// Initialize services
let supabase: ReturnType<typeof createClient> | null = null;
if (config.supabaseUrl && config.supabaseServiceKey) {
  supabase = createClient(config.supabaseUrl, config.supabaseServiceKey);
}

const anthropic = new Anthropic({
  apiKey: config.anthropicApiKey,
});

// Types
interface EmailSummaryResult {
  summary: string;
  key_points: string[];
  action_items: Array<{
    description: string;
    owner?: string;
    urgency: 'high' | 'medium' | 'low';
  }>;
  mentioned_customers: Array<{
    id?: string;
    name: string;
    mentions: number;
  }>;
  sentiment: 'positive' | 'neutral' | 'negative' | 'mixed';
  emailCount: number;
}

interface SummarizeByIdsRequest {
  emailIds: string[];
}

interface SummarizeByQueryRequest {
  query: string;
  limit?: number;
}

/**
 * POST /api/email/summarize
 * Summarize emails by IDs or by search query
 */
router.post('/summarize', async (req: Request, res: Response) => {
  try {
    const userId = req.headers['x-user-id'] as string;
    if (!userId) {
      return res.status(401).json({ error: 'User ID required' });
    }

    if (!supabase) {
      return res.status(503).json({ error: 'Database not configured' });
    }

    const body = req.body as SummarizeByIdsRequest | SummarizeByQueryRequest;

    let emails: any[] = [];

    // Fetch emails by IDs or query
    if ('emailIds' in body && Array.isArray(body.emailIds)) {
      // Fetch specific emails by ID
      const { data, error } = await supabase
        .from('emails')
        .select('*')
        .eq('user_id', userId)
        .in('id', body.emailIds)
        .order('date', { ascending: true });

      if (error) {
        return res.status(500).json({ error: 'Failed to fetch emails', message: error.message });
      }

      emails = data || [];
    } else if ('query' in body && typeof body.query === 'string') {
      // Search emails by query using full-text search
      const limit = body.limit || 20;
      const { data, error } = await (supabase as any).rpc('search_emails', {
        p_user_id: userId,
        p_query: body.query,
        p_limit: limit,
      }) as { data: Array<{ id: string }> | null; error: any };

      if (error) {
        // Fallback to simple ILIKE search if function doesn't exist
        const { data: fallbackData, error: fallbackError } = await supabase
          .from('emails')
          .select('*')
          .eq('user_id', userId)
          .or(`subject.ilike.%${body.query}%,body_text.ilike.%${body.query}%`)
          .order('date', { ascending: false })
          .limit(limit);

        if (fallbackError) {
          return res.status(500).json({ error: 'Failed to search emails', message: fallbackError.message });
        }

        emails = fallbackData || [];
      } else {
        // Fetch full email records for search results
        if (data && data.length > 0) {
          const { data: fullEmails, error: fetchError } = await supabase
            .from('emails')
            .select('*')
            .eq('user_id', userId)
            .in('id', data.map((r: { id: string }) => r.id))
            .order('date', { ascending: true });

          if (fetchError) {
            return res.status(500).json({ error: 'Failed to fetch email details', message: fetchError.message });
          }

          emails = fullEmails || [];
        }
      }
    } else {
      return res.status(400).json({
        error: 'Invalid request',
        message: 'Provide either { emailIds: string[] } or { query: string, limit?: number }',
      });
    }

    if (emails.length === 0) {
      return res.json({
        summary: 'No emails found to summarize.',
        key_points: [],
        action_items: [],
        mentioned_customers: [],
        sentiment: 'neutral',
        emailCount: 0,
      } as EmailSummaryResult);
    }

    // Build email content for summarization
    const emailContent = emails
      .map((email, idx) => {
        const date = new Date(email.date).toLocaleString();
        return `--- Email ${idx + 1} of ${emails.length} ---
From: ${email.from_name ? `${email.from_name} <${email.from_email}>` : email.from_email}
To: ${(email.to_emails || []).join(', ')}
Date: ${date}
Subject: ${email.subject || '(No Subject)'}

${email.body_text || '(No content)'}`;
      })
      .join('\n\n');

    // Get customer names for context
    const customerIds = [...new Set(emails.filter(e => e.customer_id).map(e => e.customer_id))];
    let customerContext = '';
    if (customerIds.length > 0) {
      let custQuery = supabase
        .from('customers')
        .select('id, name');
      custQuery = applyOrgFilter(custQuery, req);
      const { data: customers } = await custQuery
        .in('id', customerIds) as { data: Array<{ id: string; name: string }> | null };

      if (customers && customers.length > 0) {
        customerContext = `\n\nLinked Customers: ${customers.map(c => c.name).join(', ')}`;
      }
    }

    // Call Claude for summarization
    const prompt = `You are a Customer Success analyst. Analyze and summarize the following email thread(s).${customerContext}

## EMAILS

${emailContent}

## ANALYSIS REQUIREMENTS

Provide a comprehensive summary in the following JSON format:

{
  "summary": "A 2-4 sentence executive summary of the key points across all emails",
  "key_points": [
    "Key point 1",
    "Key point 2",
    "Key point 3"
  ],
  "action_items": [
    {
      "description": "What needs to be done",
      "owner": "Person responsible (if mentioned)",
      "urgency": "high|medium|low"
    }
  ],
  "mentioned_customers": [
    {
      "name": "Customer/company name mentioned",
      "mentions": 2
    }
  ],
  "sentiment": "positive|neutral|negative|mixed"
}

Guidelines:
- Focus on actionable insights and decisions made
- Identify all action items with clear ownership
- Extract any company/customer names mentioned
- Assess overall sentiment of the communication
- Keep the summary concise but comprehensive

Return ONLY valid JSON.`;

    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 4000,
      messages: [{ role: 'user', content: prompt }],
    });

    const responseText = response.content[0].type === 'text' ? response.content[0].text : '';

    // Parse the response
    let result: EmailSummaryResult;
    try {
      const jsonMatch = responseText.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        throw new Error('No JSON found in response');
      }

      const parsed = JSON.parse(jsonMatch[0]);
      result = {
        summary: parsed.summary || 'Unable to generate summary.',
        key_points: parsed.key_points || [],
        action_items: parsed.action_items || [],
        mentioned_customers: parsed.mentioned_customers || [],
        sentiment: parsed.sentiment || 'neutral',
        emailCount: emails.length,
      };

      // Match mentioned customers to actual customer IDs if possible
      if (result.mentioned_customers.length > 0 && customerIds.length > 0) {
        let allCustQuery = supabase
          .from('customers')
          .select('id, name');
        allCustQuery = applyOrgFilter(allCustQuery, req);
        const { data: allCustomers } = await allCustQuery
          .eq('csm_id', userId) as { data: Array<{ id: string; name: string }> | null };

        if (allCustomers) {
          result.mentioned_customers = result.mentioned_customers.map(mc => {
            const matchedCustomer = allCustomers.find(
              c => c.name.toLowerCase().includes(mc.name.toLowerCase()) ||
                   mc.name.toLowerCase().includes(c.name.toLowerCase())
            );
            return {
              ...mc,
              id: matchedCustomer?.id,
            };
          });
        }
      }
    } catch (parseError) {
      console.error('[Email] Failed to parse summary response:', parseError);
      result = {
        summary: `Summary of ${emails.length} email(s): Unable to parse AI response.`,
        key_points: [],
        action_items: [],
        mentioned_customers: [],
        sentiment: 'neutral',
        emailCount: emails.length,
      };
    }

    // Store summary on the emails if requested
    if ('emailIds' in body && body.emailIds.length === 1) {
      // Update single email with its summary
      await (supabase as any)
        .from('emails')
        .update({
          summary: result.summary,
          key_points: result.key_points,
          action_items: result.action_items,
        })
        .eq('id', body.emailIds[0]);
    }

    res.json(result);
  } catch (error) {
    console.error('[Email] Summarization error:', error);
    res.status(500).json({
      error: 'Failed to summarize emails',
      message: error instanceof Error ? error.message : String(error),
    });
  }
});

/**
 * POST /api/email/sync
 * Trigger email sync for a user
 */
router.post('/sync', async (req: Request, res: Response) => {
  try {
    const userId = req.headers['x-user-id'] as string;
    if (!userId) {
      return res.status(401).json({ error: 'User ID required' });
    }

    const { days = 30 } = req.body;

    const result = await emailService.fetchRecentEmails(userId, days, (req as any).organizationId);

    res.json({
      success: result.success,
      syncedCount: result.syncedCount,
      errors: result.errors.length > 0 ? result.errors.slice(0, 5) : undefined,
      lastSyncAt: result.lastSyncAt,
    });
  } catch (error) {
    console.error('[Email] Sync error:', error);
    res.status(500).json({
      error: 'Failed to sync emails',
      message: error instanceof Error ? error.message : String(error),
    });
  }
});

/**
 * GET /api/email/status
 * Get sync status for a user
 */
router.get('/status', async (req: Request, res: Response) => {
  try {
    const userId = req.headers['x-user-id'] as string;
    if (!userId) {
      return res.status(401).json({ error: 'User ID required' });
    }

    const status = await emailService.getSyncStatus(userId, (req as any).organizationId);

    res.json(status || { connected: false, emailsSynced: 0 });
  } catch (error) {
    console.error('[Email] Status error:', error);
    res.status(500).json({
      error: 'Failed to get sync status',
      message: error instanceof Error ? error.message : String(error),
    });
  }
});

/**
 * GET /api/email/list
 * Get emails for a user
 */
router.get('/list', async (req: Request, res: Response) => {
  try {
    const userId = req.headers['x-user-id'] as string;
    if (!userId) {
      return res.status(401).json({ error: 'User ID required' });
    }

    const {
      limit = '20',
      offset = '0',
      customerId,
      unreadOnly,
      importantOnly,
    } = req.query;

    const emails = await emailService.getEmails(userId, {
      limit: parseInt(limit as string, 10),
      offset: parseInt(offset as string, 10),
      customerId: customerId as string,
      unreadOnly: unreadOnly === 'true',
      importantOnly: importantOnly === 'true',
    }, (req as any).organizationId);

    res.json({
      emails,
      count: emails.length,
    });
  } catch (error) {
    console.error('[Email] List error:', error);
    res.status(500).json({
      error: 'Failed to list emails',
      message: error instanceof Error ? error.message : String(error),
    });
  }
});

/**
 * POST /api/email/link-customers
 * Link unmatched emails to customers
 */
router.post('/link-customers', async (req: Request, res: Response) => {
  try {
    const userId = req.headers['x-user-id'] as string;
    if (!userId) {
      return res.status(401).json({ error: 'User ID required' });
    }

    const result = await emailService.linkEmailsToCustomers(userId, (req as any).organizationId);

    res.json(result);
  } catch (error) {
    console.error('[Email] Link customers error:', error);
    res.status(500).json({
      error: 'Failed to link emails to customers',
      message: error instanceof Error ? error.message : String(error),
    });
  }
});

export default router;
