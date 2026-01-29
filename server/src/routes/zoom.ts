/**
 * Zoom Routes
 * OAuth flow and Zoom API endpoints
 */

import { Router, Request, Response } from 'express';
import { config } from '../config/index.js';
import { zoomService } from '../services/zoom/index.js';
import { zoomOAuthService } from '../services/zoom/oauth.js';
import { meetingIntelligenceService } from '../services/meeting-intelligence/index.js';
import { parseVTT } from '../services/meeting-intelligence/processors.js';

const router = Router();

// ============================================
// OAuth Routes
// ============================================

/**
 * GET /api/zoom/auth
 * Initiate Zoom OAuth flow
 */
router.get('/auth', (req: Request, res: Response) => {
  const userId = (req as any).userId;
  if (!userId) {
    return res.status(401).json({ error: 'Authentication required' });
  }

  const redirectUri = `${config.serverUrl}/api/zoom/callback`;
  const authUrl = zoomOAuthService.getAuthorizationUrl(userId, redirectUri);

  res.json({ authUrl });
});

/**
 * GET /api/zoom/callback
 * Handle Zoom OAuth callback
 */
router.get('/callback', async (req: Request, res: Response) => {
  try {
    const { code, state } = req.query;

    if (!code || !state) {
      return res.redirect(`${config.clientUrl}/settings?error=zoom_auth_failed`);
    }

    // Decode state to get user ID
    const stateData = JSON.parse(Buffer.from(state as string, 'base64').toString());
    const userId = stateData.userId;

    if (!userId) {
      return res.redirect(`${config.clientUrl}/settings?error=invalid_state`);
    }

    const redirectUri = `${config.serverUrl}/api/zoom/callback`;
    const result = await zoomOAuthService.completeOAuth(userId, code as string, redirectUri);

    if (result.success) {
      res.redirect(`${config.clientUrl}/settings?zoom_connected=true`);
    } else {
      res.redirect(`${config.clientUrl}/settings?error=${encodeURIComponent(result.error || 'unknown')}`);
    }
  } catch (error) {
    console.error('Zoom OAuth callback error:', error);
    res.redirect(`${config.clientUrl}/settings?error=callback_error`);
  }
});

/**
 * GET /api/zoom/status
 * Get Zoom connection status
 */
router.get('/status', async (req: Request, res: Response) => {
  try {
    const userId = (req as any).userId;
    if (!userId) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const status = await zoomOAuthService.getConnectionStatus(userId);
    res.json(status);
  } catch (error) {
    console.error('Error getting Zoom status:', error);
    res.status(500).json({ error: 'Failed to get Zoom status' });
  }
});

/**
 * POST /api/zoom/disconnect
 * Disconnect Zoom integration
 */
router.post('/disconnect', async (req: Request, res: Response) => {
  try {
    const userId = (req as any).userId;
    if (!userId) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const success = await zoomOAuthService.disconnect(userId);
    res.json({ success });
  } catch (error) {
    console.error('Error disconnecting Zoom:', error);
    res.status(500).json({ error: 'Failed to disconnect Zoom' });
  }
});

// ============================================
// Meeting Routes
// ============================================

/**
 * GET /api/zoom/meetings
 * List user's Zoom meetings
 */
router.get('/meetings', async (req: Request, res: Response) => {
  try {
    const userId = (req as any).userId;
    if (!userId) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const { type = 'upcoming', pageSize = '30' } = req.query;

    const connected = await zoomOAuthService.isConnected(userId);
    if (!connected) {
      return res.status(400).json({ error: 'Zoom not connected' });
    }

    await zoomOAuthService.loadConnection(userId);
    const meetings = await zoomService.listMeetings(
      userId,
      type as any,
      parseInt(pageSize as string)
    );

    res.json(meetings);
  } catch (error) {
    console.error('Error listing Zoom meetings:', error);
    res.status(500).json({ error: 'Failed to list meetings' });
  }
});

/**
 * GET /api/zoom/meetings/:meetingId
 * Get meeting details
 */
router.get('/meetings/:meetingId', async (req: Request, res: Response) => {
  try {
    const userId = (req as any).userId;
    const { meetingId } = req.params;

    await zoomOAuthService.loadConnection(userId);
    const meeting = await zoomService.getMeeting(userId, meetingId);

    res.json(meeting);
  } catch (error) {
    console.error('Error getting Zoom meeting:', error);
    res.status(500).json({ error: 'Failed to get meeting' });
  }
});

/**
 * POST /api/zoom/meetings
 * Create a new meeting
 */
router.post('/meetings', async (req: Request, res: Response) => {
  try {
    const userId = (req as any).userId;
    const { topic, startTime, duration, agenda, settings } = req.body;

    if (!topic) {
      return res.status(400).json({ error: 'Topic is required' });
    }

    await zoomOAuthService.loadConnection(userId);
    const meeting = await zoomService.createMeeting(userId, {
      topic,
      start_time: startTime,
      duration,
      agenda,
      settings,
    });

    res.status(201).json(meeting);
  } catch (error) {
    console.error('Error creating Zoom meeting:', error);
    res.status(500).json({ error: 'Failed to create meeting' });
  }
});

/**
 * DELETE /api/zoom/meetings/:meetingId
 * Delete a meeting
 */
router.delete('/meetings/:meetingId', async (req: Request, res: Response) => {
  try {
    const userId = (req as any).userId;
    const { meetingId } = req.params;

    await zoomOAuthService.loadConnection(userId);
    await zoomService.deleteMeeting(userId, meetingId);

    res.json({ success: true });
  } catch (error) {
    console.error('Error deleting Zoom meeting:', error);
    res.status(500).json({ error: 'Failed to delete meeting' });
  }
});

// ============================================
// Recording Routes
// ============================================

/**
 * GET /api/zoom/recordings
 * List recordings
 */
router.get('/recordings', async (req: Request, res: Response) => {
  try {
    const userId = (req as any).userId;
    const { from, to } = req.query;

    await zoomOAuthService.loadConnection(userId);
    const recordings = await zoomService.listRecordings(
      userId,
      from as string,
      to as string
    );

    res.json(recordings);
  } catch (error) {
    console.error('Error listing Zoom recordings:', error);
    res.status(500).json({ error: 'Failed to list recordings' });
  }
});

/**
 * GET /api/zoom/recordings/:meetingId
 * Get recording details
 */
router.get('/recordings/:meetingId', async (req: Request, res: Response) => {
  try {
    const userId = (req as any).userId;
    const { meetingId } = req.params;

    await zoomOAuthService.loadConnection(userId);
    const recording = await zoomService.getRecording(userId, meetingId);

    res.json(recording);
  } catch (error) {
    console.error('Error getting Zoom recording:', error);
    res.status(500).json({ error: 'Failed to get recording' });
  }
});

/**
 * GET /api/zoom/recordings/:meetingId/transcript
 * Get recording transcript
 */
router.get('/recordings/:meetingId/transcript', async (req: Request, res: Response) => {
  try {
    const userId = (req as any).userId;
    const { meetingId } = req.params;
    const { recordingId } = req.query;

    await zoomOAuthService.loadConnection(userId);
    const transcript = await zoomService.getTranscript(
      userId,
      meetingId,
      recordingId as string
    );

    res.json(transcript);
  } catch (error) {
    console.error('Error getting Zoom transcript:', error);
    res.status(500).json({ error: 'Failed to get transcript' });
  }
});

// ============================================
// Meeting Intelligence Routes
// ============================================

/**
 * POST /api/zoom/recordings/:meetingId/analyze
 * Analyze a recording with AI
 */
router.post('/recordings/:meetingId/analyze', async (req: Request, res: Response) => {
  try {
    const userId = (req as any).userId;
    const { meetingId } = req.params;
    const { customerId, customerName } = req.body;

    await zoomOAuthService.loadConnection(userId);

    // Get meeting details
    const meeting = await zoomService.getMeeting(userId, meetingId);

    // Get recording
    const recording = await zoomService.getRecording(userId, meetingId);

    // Find transcript file
    const transcriptFile = recording.recording_files?.find(
      (f: any) => f.recording_type === 'audio_transcript'
    );

    if (!transcriptFile) {
      return res.status(400).json({ error: 'No transcript available for this recording' });
    }

    // Get transcript content
    const transcript = await zoomService.getTranscript(userId, meetingId, transcriptFile.id);

    // Parse and analyze
    const parsedTranscript = parseVTT(
      transcript.vtt_content || '',
      meetingId,
      meeting.topic
    );

    const analysis = await meetingIntelligenceService.analyzeMeeting(
      parsedTranscript,
      { customerId, customerName }
    );

    res.json(analysis);
  } catch (error) {
    console.error('Error analyzing Zoom recording:', error);
    res.status(500).json({ error: 'Failed to analyze recording' });
  }
});

// ============================================
// Webhook Routes
// ============================================

/**
 * POST /api/zoom/webhook
 * Handle Zoom webhook events
 */
router.post('/webhook', async (req: Request, res: Response) => {
  try {
    const { event, payload } = req.body;

    // Verify webhook signature in production
    // const signature = req.headers['x-zm-signature'];
    // const timestamp = req.headers['x-zm-request-timestamp'];
    // if (!verifyWebhookSignature(signature, timestamp, req.body)) {
    //   return res.status(401).json({ error: 'Invalid signature' });
    // }

    console.log('Zoom webhook received:', event);

    switch (event) {
      case 'recording.completed':
        // Auto-analyze completed recordings if configured
        // This would be a background job in production
        console.log('Recording completed:', payload.object.uuid);
        break;

      case 'meeting.ended':
        console.log('Meeting ended:', payload.object.uuid);
        break;

      case 'meeting.participant_joined':
        console.log('Participant joined:', payload.object.participant);
        break;

      default:
        console.log('Unhandled webhook event:', event);
    }

    res.json({ received: true });
  } catch (error) {
    console.error('Error processing Zoom webhook:', error);
    res.status(500).json({ error: 'Webhook processing failed' });
  }
});

/**
 * GET /api/zoom/webhook/validate
 * Zoom webhook URL validation endpoint
 */
router.get('/webhook/validate', (req: Request, res: Response) => {
  // Zoom sends a challenge for URL validation
  const { plainToken } = req.query;

  if (plainToken) {
    res.json({ plainToken });
  } else {
    res.json({ status: 'ok' });
  }
});

export default router;
