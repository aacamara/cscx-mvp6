/**
 * Mobile Routes
 * PRD-266: Apple Watch Integration
 *
 * API endpoints for mobile device management, biometric authentication,
 * and Apple Watch data synchronization.
 */

import { Router, Request, Response } from 'express';
import { biometricAuthService, watchSyncService } from '../services/mobile/index.js';
import { authMiddleware } from '../middleware/auth.js';
import { applyOrgFilter, withOrgId } from '../middleware/orgFilter.js';

const router = Router();

// ============================================
// Device Registration
// ============================================

/**
 * POST /api/mobile/devices/register
 * Register a new mobile device
 */
router.post('/devices/register', async (req: Request, res: Response) => {
  try {
    const userId = req.headers['x-user-id'] as string;
    if (!userId) {
      return res.status(401).json({ error: 'User ID required' });
    }

    const {
      deviceId,
      deviceToken,
      deviceName,
      deviceType,
      osVersion,
      appVersion,
      pushToken,
      biometricEnabled,
    } = req.body;

    if (!deviceId || !deviceName || !deviceType) {
      return res.status(400).json({ error: 'Device ID, name, and type are required' });
    }

    const registration = await biometricAuthService.registerDevice(userId, {
      deviceId,
      deviceToken: deviceToken || '',
      deviceName,
      deviceType,
      osVersion: osVersion || 'unknown',
      appVersion: appVersion || '1.0.0',
      pushToken,
      biometricEnabled: biometricEnabled ?? false,
    });

    res.json({
      success: true,
      device: registration,
    });
  } catch (error) {
    console.error('[Mobile Routes] Device registration error:', error);
    res.status(500).json({ error: 'Failed to register device' });
  }
});

/**
 * GET /api/mobile/devices
 * List all registered devices for user
 */
router.get('/devices', async (req: Request, res: Response) => {
  try {
    const userId = req.headers['x-user-id'] as string;
    if (!userId) {
      return res.status(401).json({ error: 'User ID required' });
    }

    const devices = await biometricAuthService.listDevices(userId);

    res.json({
      success: true,
      devices,
    });
  } catch (error) {
    console.error('[Mobile Routes] List devices error:', error);
    res.status(500).json({ error: 'Failed to list devices' });
  }
});

/**
 * GET /api/mobile/devices/:deviceId
 * Get specific device details
 */
router.get('/devices/:deviceId', async (req: Request, res: Response) => {
  try {
    const userId = req.headers['x-user-id'] as string;
    if (!userId) {
      return res.status(401).json({ error: 'User ID required' });
    }

    const device = await biometricAuthService.getDevice(userId, req.params.deviceId);

    if (!device) {
      return res.status(404).json({ error: 'Device not found' });
    }

    res.json({
      success: true,
      device,
    });
  } catch (error) {
    console.error('[Mobile Routes] Get device error:', error);
    res.status(500).json({ error: 'Failed to get device' });
  }
});

/**
 * DELETE /api/mobile/devices/:deviceId
 * Remove a device registration
 */
router.delete('/devices/:deviceId', async (req: Request, res: Response) => {
  try {
    const userId = req.headers['x-user-id'] as string;
    if (!userId) {
      return res.status(401).json({ error: 'User ID required' });
    }

    const success = await biometricAuthService.removeDevice(userId, req.params.deviceId);

    if (!success) {
      return res.status(404).json({ error: 'Device not found or already removed' });
    }

    res.json({ success: true });
  } catch (error) {
    console.error('[Mobile Routes] Remove device error:', error);
    res.status(500).json({ error: 'Failed to remove device' });
  }
});

// ============================================
// Biometric Authentication
// ============================================

/**
 * POST /api/mobile/auth/challenge
 * Generate authentication challenge for biometric auth
 */
router.post('/auth/challenge', async (req: Request, res: Response) => {
  try {
    const userId = req.headers['x-user-id'] as string;
    if (!userId) {
      return res.status(401).json({ error: 'User ID required' });
    }

    const { deviceId, type } = req.body;

    if (!deviceId) {
      return res.status(400).json({ error: 'Device ID required' });
    }

    const challenge = type === 'registration'
      ? biometricAuthService.generateRegistrationChallenge(userId, deviceId)
      : biometricAuthService.generateAuthenticationChallenge(userId, deviceId);

    res.json({
      success: true,
      challenge: challenge.challenge,
      expiresAt: challenge.expiresAt.toISOString(),
      type: challenge.type,
    });
  } catch (error) {
    console.error('[Mobile Routes] Challenge generation error:', error);
    res.status(500).json({ error: 'Failed to generate challenge' });
  }
});

/**
 * POST /api/mobile/auth/register-credential
 * Register a biometric credential after successful enrollment
 */
router.post('/auth/register-credential', async (req: Request, res: Response) => {
  try {
    const userId = req.headers['x-user-id'] as string;
    if (!userId) {
      return res.status(401).json({ error: 'User ID required' });
    }

    const {
      deviceId,
      credentialId,
      publicKey,
      deviceName,
      deviceType,
      authenticatorType,
      challengeResponse,
    } = req.body;

    if (!deviceId || !credentialId || !publicKey || !challengeResponse) {
      return res.status(400).json({ error: 'Missing required credential fields' });
    }

    const credential = await biometricAuthService.registerCredential(
      userId,
      deviceId,
      {
        credentialId,
        publicKey,
        deviceName: deviceName || 'Unknown Device',
        deviceType: deviceType || 'iphone',
        authenticatorType: authenticatorType || 'face_id',
        challengeResponse,
      }
    );

    if (!credential) {
      return res.status(400).json({ error: 'Invalid or expired challenge' });
    }

    res.json({
      success: true,
      credential: {
        id: credential.id,
        credentialId: credential.credentialId,
        deviceName: credential.deviceName,
        authenticatorType: credential.authenticatorType,
        createdAt: credential.createdAt.toISOString(),
      },
    });
  } catch (error) {
    console.error('[Mobile Routes] Credential registration error:', error);
    res.status(500).json({ error: 'Failed to register credential' });
  }
});

/**
 * POST /api/mobile/auth/authenticate
 * Authenticate using biometric credential
 */
router.post('/auth/authenticate', async (req: Request, res: Response) => {
  try {
    const userId = req.headers['x-user-id'] as string;
    if (!userId) {
      return res.status(401).json({ error: 'User ID required' });
    }

    const {
      deviceId,
      credentialId,
      challengeResponse,
      counter,
    } = req.body;

    if (!deviceId || !credentialId || !challengeResponse || counter === undefined) {
      return res.status(400).json({ error: 'Missing required authentication fields' });
    }

    const result = await biometricAuthService.authenticate(
      userId,
      deviceId,
      credentialId,
      challengeResponse,
      counter
    );

    if (!result.success) {
      return res.status(401).json({
        success: false,
        error: result.error,
      });
    }

    res.json({
      success: true,
      token: result.token,
      refreshToken: result.refreshToken,
      expiresAt: result.expiresAt?.toISOString(),
      deviceId: result.deviceId,
    });
  } catch (error) {
    console.error('[Mobile Routes] Authentication error:', error);
    res.status(500).json({ error: 'Authentication failed' });
  }
});

/**
 * POST /api/mobile/auth/refresh
 * Refresh session token
 */
router.post('/auth/refresh', async (req: Request, res: Response) => {
  try {
    const { refreshToken } = req.body;

    if (!refreshToken) {
      return res.status(400).json({ error: 'Refresh token required' });
    }

    const result = await biometricAuthService.refreshSession(refreshToken);

    if (!result.success) {
      return res.status(401).json({
        success: false,
        error: result.error,
      });
    }

    res.json({
      success: true,
      token: result.token,
      refreshToken: result.refreshToken,
      expiresAt: result.expiresAt?.toISOString(),
    });
  } catch (error) {
    console.error('[Mobile Routes] Token refresh error:', error);
    res.status(500).json({ error: 'Token refresh failed' });
  }
});

/**
 * POST /api/mobile/auth/validate
 * Validate a session token
 */
router.post('/auth/validate', async (req: Request, res: Response) => {
  try {
    const { token } = req.body;

    if (!token) {
      return res.status(400).json({ error: 'Token required' });
    }

    const result = await biometricAuthService.validateSession(token);

    res.json({
      valid: result.valid,
      userId: result.userId,
      deviceId: result.deviceId,
    });
  } catch (error) {
    console.error('[Mobile Routes] Token validation error:', error);
    res.status(500).json({ error: 'Token validation failed' });
  }
});

/**
 * DELETE /api/mobile/auth/credential/:credentialId
 * Revoke a biometric credential
 */
router.delete('/auth/credential/:credentialId', async (req: Request, res: Response) => {
  try {
    const userId = req.headers['x-user-id'] as string;
    if (!userId) {
      return res.status(401).json({ error: 'User ID required' });
    }

    const success = await biometricAuthService.revokeCredential(userId, req.params.credentialId);

    if (!success) {
      return res.status(404).json({ error: 'Credential not found' });
    }

    res.json({ success: true });
  } catch (error) {
    console.error('[Mobile Routes] Credential revocation error:', error);
    res.status(500).json({ error: 'Failed to revoke credential' });
  }
});

// ============================================
// Apple Watch Pairing
// ============================================

/**
 * POST /api/mobile/watch/pair
 * Pair Apple Watch with iPhone
 */
router.post('/watch/pair', async (req: Request, res: Response) => {
  try {
    const userId = req.headers['x-user-id'] as string;
    if (!userId) {
      return res.status(401).json({ error: 'User ID required' });
    }

    const {
      iPhoneDeviceId,
      watchDeviceId,
      watchName,
      watchOsVersion,
      pairingCode,
    } = req.body;

    if (!iPhoneDeviceId || !watchDeviceId || !watchName || !pairingCode) {
      return res.status(400).json({ error: 'Missing required pairing fields' });
    }

    const result = await biometricAuthService.pairAppleWatch(userId, {
      iPhoneDeviceId,
      watchDeviceId,
      watchName,
      watchOsVersion: watchOsVersion || 'unknown',
      pairingCode,
    });

    if (!result.success) {
      return res.status(400).json({
        success: false,
        error: result.error,
      });
    }

    res.json({
      success: true,
      pairingId: result.pairingId,
    });
  } catch (error) {
    console.error('[Mobile Routes] Watch pairing error:', error);
    res.status(500).json({ error: 'Watch pairing failed' });
  }
});

/**
 * DELETE /api/mobile/watch/:watchDeviceId
 * Unpair Apple Watch
 */
router.delete('/watch/:watchDeviceId', async (req: Request, res: Response) => {
  try {
    const userId = req.headers['x-user-id'] as string;
    if (!userId) {
      return res.status(401).json({ error: 'User ID required' });
    }

    const success = await biometricAuthService.unpairAppleWatch(userId, req.params.watchDeviceId);

    if (!success) {
      return res.status(404).json({ error: 'Watch not found or already unpaired' });
    }

    res.json({ success: true });
  } catch (error) {
    console.error('[Mobile Routes] Watch unpair error:', error);
    res.status(500).json({ error: 'Failed to unpair watch' });
  }
});

/**
 * GET /api/mobile/watch/:watchDeviceId/status
 * Get watch pairing status
 */
router.get('/watch/:watchDeviceId/status', async (req: Request, res: Response) => {
  try {
    const userId = req.headers['x-user-id'] as string;
    if (!userId) {
      return res.status(401).json({ error: 'User ID required' });
    }

    const status = await biometricAuthService.getWatchPairing(userId, req.params.watchDeviceId);

    res.json({
      success: true,
      ...status,
    });
  } catch (error) {
    console.error('[Mobile Routes] Watch status error:', error);
    res.status(500).json({ error: 'Failed to get watch status' });
  }
});

// ============================================
// Watch Data Sync
// ============================================

/**
 * GET /api/mobile/watch/complications
 * Get all complication data for Apple Watch
 */
router.get('/watch/complications', async (req: Request, res: Response) => {
  try {
    const userId = req.headers['x-user-id'] as string;
    if (!userId) {
      return res.status(401).json({ error: 'User ID required' });
    }

    const complications = await watchSyncService.getAllComplicationData(userId);

    res.json({
      success: true,
      complications,
    });
  } catch (error) {
    console.error('[Mobile Routes] Complications error:', error);
    res.status(500).json({ error: 'Failed to get complications' });
  }
});

/**
 * GET /api/mobile/watch/complications/:type
 * Get specific complication data
 */
router.get('/watch/complications/:type', async (req: Request, res: Response) => {
  try {
    const userId = req.headers['x-user-id'] as string;
    if (!userId) {
      return res.status(401).json({ error: 'User ID required' });
    }

    const validTypes = ['circular', 'rectangular', 'corner', 'inline', 'graphic'];
    const type = req.params.type as any;

    if (!validTypes.includes(type)) {
      return res.status(400).json({ error: 'Invalid complication type' });
    }

    const complication = await watchSyncService.getComplicationData(userId, type);

    res.json({
      success: true,
      complication,
    });
  } catch (error) {
    console.error('[Mobile Routes] Complication error:', error);
    res.status(500).json({ error: 'Failed to get complication' });
  }
});

/**
 * GET /api/mobile/watch/dashboard
 * Get full dashboard data for Apple Watch app
 */
router.get('/watch/dashboard', async (req: Request, res: Response) => {
  try {
    const userId = req.headers['x-user-id'] as string;
    if (!userId) {
      return res.status(401).json({ error: 'User ID required' });
    }

    const dashboard = await watchSyncService.getDashboardData(userId);

    res.json({
      success: true,
      dashboard,
    });
  } catch (error) {
    console.error('[Mobile Routes] Dashboard error:', error);
    res.status(500).json({ error: 'Failed to get dashboard' });
  }
});

// ============================================
// Watch Quick Actions
// ============================================

/**
 * POST /api/mobile/watch/actions/note
 * Create a quick note from Apple Watch
 */
router.post('/watch/actions/note', async (req: Request, res: Response) => {
  try {
    const userId = req.headers['x-user-id'] as string;
    if (!userId) {
      return res.status(401).json({ error: 'User ID required' });
    }

    const { customerId, content, voiceTranscribed, recordingDuration } = req.body;

    if (!content) {
      return res.status(400).json({ error: 'Note content required' });
    }

    const result = await watchSyncService.createQuickNote(userId, {
      customerId,
      content,
      voiceTranscribed: voiceTranscribed ?? false,
      recordingDuration,
    });

    res.json(result);
  } catch (error) {
    console.error('[Mobile Routes] Quick note error:', error);
    res.status(500).json({ error: 'Failed to create note' });
  }
});

/**
 * POST /api/mobile/watch/actions/approve/:approvalId
 * Approve a pending item from Apple Watch
 */
router.post('/watch/actions/approve/:approvalId', async (req: Request, res: Response) => {
  try {
    const userId = req.headers['x-user-id'] as string;
    if (!userId) {
      return res.status(401).json({ error: 'User ID required' });
    }

    const result = await watchSyncService.approveItem(userId, req.params.approvalId);

    res.json(result);
  } catch (error) {
    console.error('[Mobile Routes] Approve error:', error);
    res.status(500).json({ error: 'Failed to approve item' });
  }
});

/**
 * POST /api/mobile/watch/actions/reject/:approvalId
 * Reject a pending item from Apple Watch
 */
router.post('/watch/actions/reject/:approvalId', async (req: Request, res: Response) => {
  try {
    const userId = req.headers['x-user-id'] as string;
    if (!userId) {
      return res.status(401).json({ error: 'User ID required' });
    }

    const { reason } = req.body;
    const result = await watchSyncService.rejectItem(userId, req.params.approvalId, reason);

    res.json(result);
  } catch (error) {
    console.error('[Mobile Routes] Reject error:', error);
    res.status(500).json({ error: 'Failed to reject item' });
  }
});

/**
 * POST /api/mobile/watch/actions/complete-task/:taskId
 * Mark a task as complete from Apple Watch
 */
router.post('/watch/actions/complete-task/:taskId', async (req: Request, res: Response) => {
  try {
    const userId = req.headers['x-user-id'] as string;
    if (!userId) {
      return res.status(401).json({ error: 'User ID required' });
    }

    const result = await watchSyncService.completeTask(userId, req.params.taskId);

    res.json(result);
  } catch (error) {
    console.error('[Mobile Routes] Complete task error:', error);
    res.status(500).json({ error: 'Failed to complete task' });
  }
});

/**
 * POST /api/mobile/watch/actions/snooze/:reminderId
 * Snooze a reminder from Apple Watch
 */
router.post('/watch/actions/snooze/:reminderId', async (req: Request, res: Response) => {
  try {
    const userId = req.headers['x-user-id'] as string;
    if (!userId) {
      return res.status(401).json({ error: 'User ID required' });
    }

    const { duration } = req.body;
    const validDurations = ['15min', '1hour', '4hours', 'tomorrow'];

    if (!duration || !validDurations.includes(duration)) {
      return res.status(400).json({ error: 'Valid snooze duration required (15min, 1hour, 4hours, tomorrow)' });
    }

    const result = await watchSyncService.snoozeReminder(userId, req.params.reminderId, duration);

    res.json(result);
  } catch (error) {
    console.error('[Mobile Routes] Snooze error:', error);
    res.status(500).json({ error: 'Failed to snooze reminder' });
  }
});

// ============================================
// Health Check
// ============================================

/**
 * GET /api/mobile/health
 * Health check for mobile services
 */
router.get('/health', async (req: Request, res: Response) => {
  try {
    const biometricStats = biometricAuthService.getCircuitBreakerStats();
    const watchSyncStats = watchSyncService.getCircuitBreakerStats();

    res.json({
      status: 'healthy',
      services: {
        biometricAuth: {
          status: biometricStats.state === 'open' ? 'degraded' : 'healthy',
          circuitBreaker: biometricStats,
        },
        watchSync: {
          status: watchSyncStats.state === 'open' ? 'degraded' : 'healthy',
          circuitBreaker: watchSyncStats,
        },
      },
    });
  } catch (error) {
    console.error('[Mobile Routes] Health check error:', error);
    res.status(500).json({
      status: 'unhealthy',
      error: (error as Error).message,
    });
  }
});

export default router;
