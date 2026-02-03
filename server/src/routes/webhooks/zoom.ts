/**
 * Zoom Webhook Handler
 * PRD-116: Process Zoom meeting ended and transcript ready webhooks
 *
 * Endpoints:
 * - POST /api/webhooks/zoom/meeting-ended - Meeting completion webhook
 * - POST /api/webhooks/zoom/transcript-ready - Transcript ready webhook (from recording)
 */

import { Router, Request, Response } from 'express';
import crypto from 'crypto';
import { config } from '../../config/index.js';
import {
  postCallProcessingService,
  type ZoomMeetingEndedWebhook,
  type ZoomTranscriptCompletedWebhook,
} from '../../services/post-call-processing/index.js';

const router = Router();

// ============================================
// Zoom Webhook Verification
// ============================================

/**
 * Verify Zoom webhook signature
 * See: https://developers.zoom.us/docs/api/rest/webhook-reference/
 */
function verifyZoomSignature(req: Request): boolean {
  const signature = req.headers['x-zm-signature'] as string;
  const timestamp = req.headers['x-zm-request-timestamp'] as string;

  if (!signature || !timestamp) {
    return false;
  }

  const secretToken = config.zoom?.webhookSecretToken;
  if (!secretToken) {
    console.warn('Zoom webhook secret token not configured');
    return true; // Allow in development without verification
  }

  const message = `v0:${timestamp}:${JSON.stringify(req.body)}`;
  const hash = crypto
    .createHmac('sha256', secretToken)
    .update(message)
    .digest('hex');

  const expectedSignature = `v0=${hash}`;

  return crypto.timingSafeEqual(
    Buffer.from(signature),
    Buffer.from(expectedSignature)
  );
}

/**
 * Handle Zoom URL validation challenge
 */
function handleZoomChallenge(req: Request, res: Response): boolean {
  const { event, payload } = req.body;

  if (event === 'endpoint.url_validation' && payload?.plainToken) {
    const secretToken = config.zoom?.webhookSecretToken || '';
    const hash = crypto
      .createHmac('sha256', secretToken)
      .update(payload.plainToken)
      .digest('hex');

    res.json({
      plainToken: payload.plainToken,
      encryptedToken: hash,
    });
    return true;
  }

  return false;
}

// ============================================
// POST /api/webhooks/zoom/meeting-ended
// Zoom meeting completion webhook
// ============================================
router.post('/meeting-ended', async (req: Request, res: Response) => {
  try {
    // Handle URL validation challenge
    if (handleZoomChallenge(req, res)) {
      return;
    }

    // Verify signature
    if (!verifyZoomSignature(req)) {
      console.warn('Invalid Zoom webhook signature');
      return res.status(401).json({ error: 'Invalid signature' });
    }

    const webhook = req.body as ZoomMeetingEndedWebhook;

    // Log webhook for audit
    const logId = await postCallProcessingService.logWebhook(
      'zoom',
      webhook.event,
      webhook.payload?.object?.id,
      webhook
    );

    // Only process meeting.ended events
    if (webhook.event !== 'meeting.ended') {
      console.log(`Ignoring Zoom event: ${webhook.event}`);
      return res.status(200).json({ received: true, ignored: true });
    }

    const meeting = webhook.payload?.object;
    if (!meeting) {
      return res.status(400).json({ error: 'Invalid webhook payload' });
    }

    console.log(`Zoom meeting ended: ${meeting.topic} (${meeting.id})`);

    // Look up user by Zoom host ID
    const userId = await lookupUserByZoomId(meeting.host_id);
    if (!userId) {
      console.warn(`No user found for Zoom host ID: ${meeting.host_id}`);
      await postCallProcessingService.markWebhookProcessed(
        logId!,
        undefined,
        'No user found for Zoom host ID'
      );
      return res.status(200).json({ received: true, noUser: true });
    }

    // Try to resolve customer from meeting topic
    const customerId = await resolveCustomerFromMeetingTopic(meeting.topic);

    // Trigger post-call processing
    // Note: We'll wait for transcript_completed webhook for the actual transcript
    // For now, just queue the meeting for processing
    const result = await postCallProcessingService.triggerProcessing(
      userId,
      {
        meetingId: meeting.id,
        customerId: customerId || undefined,
        meetingTitle: meeting.topic,
        meetingDate: meeting.start_time,
        durationMinutes: meeting.duration,
        source: 'zoom',
        // Transcript will be added when transcript_completed webhook arrives
      },
      'zoom_webhook'
    );

    await postCallProcessingService.markWebhookProcessed(logId!, result.resultId);

    res.status(200).json({
      received: true,
      resultId: result.resultId,
    });
  } catch (error) {
    console.error('Zoom meeting-ended webhook error:', error);
    res.status(500).json({ error: 'Webhook processing failed' });
  }
});

// ============================================
// POST /api/webhooks/zoom/transcript-ready
// Zoom recording transcript completed webhook
// ============================================
router.post('/transcript-ready', async (req: Request, res: Response) => {
  try {
    // Handle URL validation challenge
    if (handleZoomChallenge(req, res)) {
      return;
    }

    // Verify signature
    if (!verifyZoomSignature(req)) {
      console.warn('Invalid Zoom webhook signature');
      return res.status(401).json({ error: 'Invalid signature' });
    }

    const webhook = req.body as ZoomTranscriptCompletedWebhook;

    // Log webhook for audit
    const logId = await postCallProcessingService.logWebhook(
      'zoom',
      webhook.event,
      webhook.payload?.object?.id,
      webhook
    );

    // Only process transcript_completed events
    if (webhook.event !== 'recording.transcript_completed') {
      console.log(`Ignoring Zoom event: ${webhook.event}`);
      return res.status(200).json({ received: true, ignored: true });
    }

    const recording = webhook.payload?.object;
    if (!recording) {
      return res.status(400).json({ error: 'Invalid webhook payload' });
    }

    console.log(`Zoom transcript ready: ${recording.topic} (${recording.id})`);

    // Look up user by Zoom host ID
    const userId = await lookupUserByZoomId(recording.host_id);
    if (!userId) {
      console.warn(`No user found for Zoom host ID: ${recording.host_id}`);
      await postCallProcessingService.markWebhookProcessed(
        logId!,
        undefined,
        'No user found for Zoom host ID'
      );
      return res.status(200).json({ received: true, noUser: true });
    }

    // Get transcript download URL
    const transcriptFile = recording.transcript_files?.find(
      (f) => f.file_type === 'VTT' || f.file_type === 'TRANSCRIPT'
    );

    if (!transcriptFile?.download_url) {
      console.warn('No transcript file found in webhook');
      await postCallProcessingService.markWebhookProcessed(
        logId!,
        undefined,
        'No transcript file in webhook'
      );
      return res.status(200).json({ received: true, noTranscript: true });
    }

    // Try to resolve customer from meeting topic
    const customerId = await resolveCustomerFromMeetingTopic(recording.topic);

    // Trigger post-call processing with transcript URL
    const result = await postCallProcessingService.triggerProcessing(
      userId,
      {
        meetingId: recording.meeting_id || recording.id,
        customerId: customerId || undefined,
        meetingTitle: recording.topic,
        transcriptUrl: transcriptFile.download_url,
        source: 'zoom',
      },
      'zoom_webhook'
    );

    await postCallProcessingService.markWebhookProcessed(logId!, result.resultId);

    res.status(200).json({
      received: true,
      resultId: result.resultId,
    });
  } catch (error) {
    console.error('Zoom transcript-ready webhook error:', error);
    res.status(500).json({ error: 'Webhook processing failed' });
  }
});

// ============================================
// Helper Functions
// ============================================

/**
 * Look up CSCX user by Zoom account ID
 */
async function lookupUserByZoomId(zoomHostId: string): Promise<string | null> {
  // TODO: Implement lookup from integrations table
  // For now, return null (would need Zoom integration setup)
  console.log(`Looking up user for Zoom host ID: ${zoomHostId}`);
  return null;
}

/**
 * Try to resolve customer from meeting topic
 */
async function resolveCustomerFromMeetingTopic(topic: string): Promise<string | null> {
  // TODO: Implement customer resolution
  // Could match against customer names or use AI to extract
  console.log(`Resolving customer from topic: ${topic}`);
  return null;
}

export default router;
