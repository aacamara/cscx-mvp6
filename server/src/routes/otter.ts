/**
 * Otter AI Integration Routes
 * Webhook endpoint for receiving transcripts from Otter.ai
 * API endpoints for managing transcripts and meeting notes
 */

import { Router, Request, Response } from 'express';
import { createClient } from '@supabase/supabase-js';
import { config } from '../config/index.js';
import { otterService, OtterWebhookPayload } from '../services/otter.js';
import crypto from 'crypto';

const router = Router();

// Demo user ID - ONLY used in development mode
const DEMO_USER_ID = 'df2dc7be-ece0-40b2-a9d7-0f6c45b75131';

/**
 * Get user ID from request.
 * SECURITY: Demo user fallback ONLY allowed in development mode.
 * Production mode requires authenticated user (set by authMiddleware).
 */
function getUserId(req: Request): string | null {
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
}

// Supabase client
const supabase = config.supabaseUrl && config.supabaseServiceKey
  ? createClient(config.supabaseUrl, config.supabaseServiceKey)
  : null;

/**
 * POST /api/otter/webhook
 * Receive transcript webhooks from Otter.ai
 */
router.post('/webhook', async (req: Request, res: Response) => {
  try {
    const payload = req.body as OtterWebhookPayload;

    // Verify webhook signature if configured
    const webhookSecret = req.headers['x-otter-signature'] as string;
    if (config.otterWebhookSecret && webhookSecret) {
      const expectedSignature = crypto
        .createHmac('sha256', config.otterWebhookSecret)
        .update(JSON.stringify(req.body))
        .digest('hex');

      if (webhookSecret !== expectedSignature) {
        console.warn('Invalid Otter webhook signature');
        return res.status(401).json({ error: 'Invalid signature' });
      }
    }

    // Get user ID with security check
    const userId = getUserId(req);
    if (!userId) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    // Optional: Get customer ID if provided
    const customerId = req.headers['x-customer-id'] as string | undefined;

    console.log(`Received Otter webhook: ${payload.event} for meeting "${payload.title}"`);

    const result = await otterService.processWebhook(payload, userId, customerId);

    if (result.success) {
      res.json({
        success: true,
        message: 'Webhook processed successfully',
        transcriptId: result.transcript?.id,
        notesDocId: result.transcript?.notesDocId,
      });
    } else {
      res.status(400).json({
        success: false,
        error: result.error,
      });
    }
  } catch (error) {
    console.error('Error processing Otter webhook:', error);
    res.status(500).json({ error: (error as Error).message });
  }
});

/**
 * GET /api/otter/transcripts
 * Get all transcripts for a user
 */
router.get('/transcripts', async (req: Request, res: Response) => {
  try {
    const userId = req.headers['x-user-id'] as string;
    if (!userId) {
      return res.status(401).json({ error: 'User ID required' });
    }

    if (!supabase) {
      return res.status(503).json({ error: 'Database not configured' });
    }

    const { customerId, limit = '50', offset = '0' } = req.query;

    let query = supabase
      .from('meeting_transcripts')
      .select('*')
      .eq('user_id', userId)
      .order('meeting_date', { ascending: false })
      .range(parseInt(offset as string), parseInt(offset as string) + parseInt(limit as string) - 1);

    if (customerId) {
      query = query.eq('customer_id', customerId);
    }

    const { data, error } = await query;

    if (error) throw error;

    res.json({
      transcripts: data || [],
      count: data?.length || 0,
    });
  } catch (error) {
    console.error('Error fetching transcripts:', error);
    res.status(500).json({ error: (error as Error).message });
  }
});

/**
 * GET /api/otter/transcripts/:id
 * Get a specific transcript
 */
router.get('/transcripts/:id', async (req: Request, res: Response) => {
  try {
    const userId = req.headers['x-user-id'] as string;
    if (!userId) {
      return res.status(401).json({ error: 'User ID required' });
    }

    const transcript = await otterService.getTranscript(req.params.id);

    if (!transcript) {
      return res.status(404).json({ error: 'Transcript not found' });
    }

    // Verify ownership
    if (transcript.userId !== userId) {
      return res.status(403).json({ error: 'Access denied' });
    }

    res.json(transcript);
  } catch (error) {
    console.error('Error fetching transcript:', error);
    res.status(500).json({ error: (error as Error).message });
  }
});

/**
 * GET /api/otter/customer/:customerId/transcripts
 * Get all transcripts for a customer
 */
router.get('/customer/:customerId/transcripts', async (req: Request, res: Response) => {
  try {
    const userId = req.headers['x-user-id'] as string;
    if (!userId) {
      return res.status(401).json({ error: 'User ID required' });
    }

    const { customerId } = req.params;
    const transcripts = await otterService.getCustomerTranscripts(customerId);

    res.json({
      customerId,
      transcripts,
      count: transcripts.length,
    });
  } catch (error) {
    console.error('Error fetching customer transcripts:', error);
    res.status(500).json({ error: (error as Error).message });
  }
});

/**
 * POST /api/otter/transcripts/manual
 * Manually upload a transcript (for pasting from Otter web)
 */
router.post('/transcripts/manual', async (req: Request, res: Response) => {
  try {
    const userId = req.headers['x-user-id'] as string;
    if (!userId) {
      return res.status(401).json({ error: 'User ID required' });
    }

    const {
      title,
      transcript,
      customerId,
      participants,
      meetingDate,
      durationMinutes,
      meetingType,
    } = req.body;

    if (!title || !transcript) {
      return res.status(400).json({
        error: 'Missing required fields',
        required: ['title', 'transcript'],
      });
    }

    // Process as if it came from webhook
    const payload: OtterWebhookPayload = {
      event: 'transcript_ready',
      meeting_id: `manual_${Date.now()}`,
      title,
      transcript,
      participants: participants || [],
      duration_minutes: durationMinutes,
      start_time: meetingDate || new Date().toISOString(),
    };

    const result = await otterService.processWebhook(payload, userId, customerId);

    if (result.success) {
      res.status(201).json({
        success: true,
        transcript: result.transcript,
      });
    } else {
      res.status(400).json({
        success: false,
        error: result.error,
      });
    }
  } catch (error) {
    console.error('Error creating manual transcript:', error);
    res.status(500).json({ error: (error as Error).message });
  }
});

/**
 * POST /api/otter/transcripts/:id/analyze
 * Re-analyze an existing transcript
 */
router.post('/transcripts/:id/analyze', async (req: Request, res: Response) => {
  try {
    const userId = req.headers['x-user-id'] as string;
    if (!userId) {
      return res.status(401).json({ error: 'User ID required' });
    }

    if (!supabase) {
      return res.status(503).json({ error: 'Database not configured' });
    }

    const transcript = await otterService.getTranscript(req.params.id);

    if (!transcript) {
      return res.status(404).json({ error: 'Transcript not found' });
    }

    // Re-analyze
    const analysis = await otterService.analyzeTranscript(
      transcript.transcriptText,
      transcript.meetingTitle
    );

    // Update database
    const { error } = await supabase
      .from('meeting_transcripts')
      .update({
        summary: analysis.summary,
        key_topics: analysis.keyTopics,
        action_items: analysis.actionItems,
        decisions: analysis.decisions,
        sentiment: analysis.sentiment,
        sentiment_score: analysis.sentimentScore,
        processed_at: new Date().toISOString(),
      })
      .eq('id', req.params.id);

    if (error) throw error;

    res.json({
      success: true,
      analysis,
    });
  } catch (error) {
    console.error('Error re-analyzing transcript:', error);
    res.status(500).json({ error: (error as Error).message });
  }
});

/**
 * GET /api/otter/integration/status
 * Get Otter integration status for user
 */
router.get('/integration/status', async (req: Request, res: Response) => {
  try {
    const userId = req.headers['x-user-id'] as string;
    if (!userId) {
      return res.status(401).json({ error: 'User ID required' });
    }

    if (!supabase) {
      return res.status(503).json({ error: 'Database not configured' });
    }

    const { data: integration } = await supabase
      .from('otter_integrations')
      .select('*')
      .eq('user_id', userId)
      .single();

    if (!integration) {
      return res.json({
        connected: false,
        message: 'Otter.ai not connected. Configure in settings.',
      });
    }

    res.json({
      connected: integration.status === 'active',
      status: integration.status,
      autoJoinMeetings: integration.auto_join_meetings,
      autoTranscribe: integration.auto_transcribe,
      autoGenerateNotes: integration.auto_generate_notes,
      lastWebhookAt: integration.last_webhook_at,
    });
  } catch (error) {
    console.error('Error checking Otter integration:', error);
    res.status(500).json({ error: (error as Error).message });
  }
});

/**
 * POST /api/otter/integration/configure
 * Configure Otter integration settings
 */
router.post('/integration/configure', async (req: Request, res: Response) => {
  try {
    const userId = req.headers['x-user-id'] as string;
    if (!userId) {
      return res.status(401).json({ error: 'User ID required' });
    }

    if (!supabase) {
      return res.status(503).json({ error: 'Database not configured' });
    }

    const {
      otterApiKey,
      otterUserId,
      autoJoinMeetings = true,
      autoTranscribe = true,
      autoGenerateNotes = true,
    } = req.body;

    const { data, error } = await supabase
      .from('otter_integrations')
      .upsert({
        user_id: userId,
        otter_api_key: otterApiKey,
        otter_user_id: otterUserId,
        auto_join_meetings: autoJoinMeetings,
        auto_transcribe: autoTranscribe,
        auto_generate_notes: autoGenerateNotes,
        status: 'active',
        updated_at: new Date().toISOString(),
      }, {
        onConflict: 'user_id',
      })
      .select()
      .single();

    if (error) throw error;

    res.json({
      success: true,
      message: 'Otter integration configured successfully',
      webhookUrl: `${req.protocol}://${req.get('host')}/api/otter/webhook`,
    });
  } catch (error) {
    console.error('Error configuring Otter integration:', error);
    res.status(500).json({ error: (error as Error).message });
  }
});

/**
 * DELETE /api/otter/integration
 * Disconnect Otter integration
 */
router.delete('/integration', async (req: Request, res: Response) => {
  try {
    const userId = req.headers['x-user-id'] as string;
    if (!userId) {
      return res.status(401).json({ error: 'User ID required' });
    }

    if (!supabase) {
      return res.status(503).json({ error: 'Database not configured' });
    }

    const { error } = await supabase
      .from('otter_integrations')
      .update({ status: 'disconnected' })
      .eq('user_id', userId);

    if (error) throw error;

    res.json({
      success: true,
      message: 'Otter integration disconnected',
    });
  } catch (error) {
    console.error('Error disconnecting Otter:', error);
    res.status(500).json({ error: (error as Error).message });
  }
});

export default router;
