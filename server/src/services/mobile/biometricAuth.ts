/**
 * Biometric Authentication Service
 * PRD-266: Apple Watch Integration
 *
 * Handles biometric authentication for mobile devices and Apple Watch.
 * Supports WebAuthn/passkey-based authentication for secure device pairing.
 */

import { createClient } from '@supabase/supabase-js';
import { randomBytes, createHash } from 'crypto';
import { config } from '../../config/index.js';
import { CircuitBreaker } from '../circuitBreaker.js';

// ============================================
// Types
// ============================================

export interface BiometricCredential {
  id: string;
  credentialId: string;
  publicKey: string;
  userId: string;
  deviceId: string;
  deviceName: string;
  deviceType: 'iphone' | 'apple_watch' | 'ipad' | 'android' | 'android_wear';
  authenticatorType: 'face_id' | 'touch_id' | 'passcode' | 'pin' | 'pattern';
  counter: number;
  createdAt: Date;
  lastUsedAt: Date | null;
  isActive: boolean;
}

export interface DeviceRegistration {
  id: string;
  userId: string;
  deviceId: string;
  deviceToken: string;
  deviceName: string;
  deviceType: 'iphone' | 'apple_watch' | 'ipad' | 'android' | 'android_wear';
  osVersion: string;
  appVersion: string;
  pushToken?: string;
  pairedWatchId?: string;
  biometricEnabled: boolean;
  lastActiveAt: Date;
  createdAt: Date;
}

export interface BiometricChallenge {
  challenge: string;
  userId: string;
  deviceId: string;
  expiresAt: Date;
  type: 'registration' | 'authentication';
}

export interface AuthenticationResult {
  success: boolean;
  token?: string;
  refreshToken?: string;
  expiresAt?: Date;
  deviceId?: string;
  error?: string;
}

export interface WatchPairingRequest {
  iPhoneDeviceId: string;
  watchDeviceId: string;
  watchName: string;
  watchOsVersion: string;
  pairingCode: string;
}

export interface WatchPairingResult {
  success: boolean;
  pairingId?: string;
  error?: string;
}

// ============================================
// Biometric Authentication Service
// ============================================

export class BiometricAuthService {
  private supabase: ReturnType<typeof createClient> | null = null;
  private circuitBreaker: CircuitBreaker;
  private challengeStore: Map<string, BiometricChallenge> = new Map();

  constructor() {
    if (config.supabaseUrl && config.supabaseServiceKey) {
      this.supabase = createClient(config.supabaseUrl, config.supabaseServiceKey);
    }
    this.circuitBreaker = new CircuitBreaker('biometric-auth', {
      failureThreshold: 5,
      successThreshold: 3,
      timeout: 30000,
    });

    // Clean up expired challenges periodically
    setInterval(() => this.cleanupExpiredChallenges(), 60000);
  }

  // ============================================
  // Device Registration
  // ============================================

  /**
   * Register a new device for biometric authentication
   */
  async registerDevice(
    userId: string,
    device: Omit<DeviceRegistration, 'id' | 'userId' | 'createdAt' | 'lastActiveAt'>
  ): Promise<DeviceRegistration> {
    const registration: DeviceRegistration = {
      id: randomBytes(16).toString('hex'),
      userId,
      ...device,
      createdAt: new Date(),
      lastActiveAt: new Date(),
    };

    if (this.supabase) {
      await this.circuitBreaker.execute(() =>
        this.supabase!.from('device_registrations').upsert({
          id: registration.id,
          user_id: registration.userId,
          device_id: registration.deviceId,
          device_token: registration.deviceToken,
          device_name: registration.deviceName,
          device_type: registration.deviceType,
          os_version: registration.osVersion,
          app_version: registration.appVersion,
          push_token: registration.pushToken,
          paired_watch_id: registration.pairedWatchId,
          biometric_enabled: registration.biometricEnabled,
          last_active_at: registration.lastActiveAt.toISOString(),
          created_at: registration.createdAt.toISOString(),
        }, { onConflict: 'user_id,device_id' })
      );
    }

    console.log(`[BiometricAuth] Device registered: ${device.deviceName} for user ${userId}`);
    return registration;
  }

  /**
   * Get registered device by ID
   */
  async getDevice(userId: string, deviceId: string): Promise<DeviceRegistration | null> {
    if (!this.supabase) return null;

    const { data, error } = await this.circuitBreaker.execute(() =>
      this.supabase!.from('device_registrations')
        .select('*')
        .eq('user_id', userId)
        .eq('device_id', deviceId)
        .single()
    );

    if (error || !data) return null;

    return {
      id: data.id,
      userId: data.user_id,
      deviceId: data.device_id,
      deviceToken: data.device_token,
      deviceName: data.device_name,
      deviceType: data.device_type,
      osVersion: data.os_version,
      appVersion: data.app_version,
      pushToken: data.push_token,
      pairedWatchId: data.paired_watch_id,
      biometricEnabled: data.biometric_enabled,
      lastActiveAt: new Date(data.last_active_at),
      createdAt: new Date(data.created_at),
    };
  }

  /**
   * List all devices for a user
   */
  async listDevices(userId: string): Promise<DeviceRegistration[]> {
    if (!this.supabase) return [];

    const { data, error } = await this.circuitBreaker.execute(() =>
      this.supabase!.from('device_registrations')
        .select('*')
        .eq('user_id', userId)
        .order('last_active_at', { ascending: false })
    );

    if (error || !data) return [];

    return data.map((d: any) => ({
      id: d.id,
      userId: d.user_id,
      deviceId: d.device_id,
      deviceToken: d.device_token,
      deviceName: d.device_name,
      deviceType: d.device_type,
      osVersion: d.os_version,
      appVersion: d.app_version,
      pushToken: d.push_token,
      pairedWatchId: d.paired_watch_id,
      biometricEnabled: d.biometric_enabled,
      lastActiveAt: new Date(d.last_active_at),
      createdAt: new Date(d.created_at),
    }));
  }

  /**
   * Remove a device registration
   */
  async removeDevice(userId: string, deviceId: string): Promise<boolean> {
    if (!this.supabase) return false;

    // Also remove any biometric credentials for this device
    await this.supabase.from('biometric_credentials')
      .delete()
      .eq('user_id', userId)
      .eq('device_id', deviceId);

    const { error } = await this.supabase.from('device_registrations')
      .delete()
      .eq('user_id', userId)
      .eq('device_id', deviceId);

    if (error) {
      console.error('[BiometricAuth] Failed to remove device:', error);
      return false;
    }

    console.log(`[BiometricAuth] Device removed: ${deviceId} for user ${userId}`);
    return true;
  }

  // ============================================
  // Biometric Credential Management
  // ============================================

  /**
   * Generate a registration challenge for biometric credential enrollment
   */
  generateRegistrationChallenge(userId: string, deviceId: string): BiometricChallenge {
    const challenge: BiometricChallenge = {
      challenge: randomBytes(32).toString('base64url'),
      userId,
      deviceId,
      expiresAt: new Date(Date.now() + 5 * 60 * 1000), // 5 minutes
      type: 'registration',
    };

    const key = `${userId}:${deviceId}:registration`;
    this.challengeStore.set(key, challenge);

    return challenge;
  }

  /**
   * Generate an authentication challenge
   */
  generateAuthenticationChallenge(userId: string, deviceId: string): BiometricChallenge {
    const challenge: BiometricChallenge = {
      challenge: randomBytes(32).toString('base64url'),
      userId,
      deviceId,
      expiresAt: new Date(Date.now() + 2 * 60 * 1000), // 2 minutes
      type: 'authentication',
    };

    const key = `${userId}:${deviceId}:authentication`;
    this.challengeStore.set(key, challenge);

    return challenge;
  }

  /**
   * Verify and store a biometric credential after successful enrollment
   */
  async registerCredential(
    userId: string,
    deviceId: string,
    credential: {
      credentialId: string;
      publicKey: string;
      deviceName: string;
      deviceType: BiometricCredential['deviceType'];
      authenticatorType: BiometricCredential['authenticatorType'];
      challengeResponse: string;
    }
  ): Promise<BiometricCredential | null> {
    // Verify challenge was issued
    const key = `${userId}:${deviceId}:registration`;
    const challenge = this.challengeStore.get(key);

    if (!challenge || challenge.expiresAt < new Date()) {
      console.error('[BiometricAuth] Invalid or expired registration challenge');
      return null;
    }

    // Verify challenge response (in production, verify the signature against publicKey)
    const expectedResponse = createHash('sha256')
      .update(challenge.challenge + credential.publicKey)
      .digest('base64url');

    if (credential.challengeResponse !== expectedResponse) {
      // For development, allow bypass
      if (config.nodeEnv === 'production') {
        console.error('[BiometricAuth] Invalid challenge response');
        return null;
      }
    }

    // Clear the challenge
    this.challengeStore.delete(key);

    const biometricCred: BiometricCredential = {
      id: randomBytes(16).toString('hex'),
      credentialId: credential.credentialId,
      publicKey: credential.publicKey,
      userId,
      deviceId,
      deviceName: credential.deviceName,
      deviceType: credential.deviceType,
      authenticatorType: credential.authenticatorType,
      counter: 0,
      createdAt: new Date(),
      lastUsedAt: null,
      isActive: true,
    };

    if (this.supabase) {
      await this.circuitBreaker.execute(() =>
        this.supabase!.from('biometric_credentials').insert({
          id: biometricCred.id,
          credential_id: biometricCred.credentialId,
          public_key: biometricCred.publicKey,
          user_id: biometricCred.userId,
          device_id: biometricCred.deviceId,
          device_name: biometricCred.deviceName,
          device_type: biometricCred.deviceType,
          authenticator_type: biometricCred.authenticatorType,
          counter: biometricCred.counter,
          created_at: biometricCred.createdAt.toISOString(),
          last_used_at: null,
          is_active: biometricCred.isActive,
        })
      );
    }

    console.log(`[BiometricAuth] Credential registered: ${credential.authenticatorType} on ${credential.deviceName}`);
    return biometricCred;
  }

  /**
   * Authenticate using biometric credential
   */
  async authenticate(
    userId: string,
    deviceId: string,
    credentialId: string,
    challengeResponse: string,
    counter: number
  ): Promise<AuthenticationResult> {
    // Verify challenge was issued
    const key = `${userId}:${deviceId}:authentication`;
    const challenge = this.challengeStore.get(key);

    if (!challenge || challenge.expiresAt < new Date()) {
      return { success: false, error: 'Invalid or expired challenge' };
    }

    // Get stored credential
    let credential: BiometricCredential | null = null;

    if (this.supabase) {
      const { data } = await this.circuitBreaker.execute(() =>
        this.supabase!.from('biometric_credentials')
          .select('*')
          .eq('user_id', userId)
          .eq('device_id', deviceId)
          .eq('credential_id', credentialId)
          .eq('is_active', true)
          .single()
      );

      if (data) {
        credential = {
          id: data.id,
          credentialId: data.credential_id,
          publicKey: data.public_key,
          userId: data.user_id,
          deviceId: data.device_id,
          deviceName: data.device_name,
          deviceType: data.device_type,
          authenticatorType: data.authenticator_type,
          counter: data.counter,
          createdAt: new Date(data.created_at),
          lastUsedAt: data.last_used_at ? new Date(data.last_used_at) : null,
          isActive: data.is_active,
        };
      }
    }

    if (!credential) {
      return { success: false, error: 'Credential not found' };
    }

    // Verify counter is incrementing (replay attack protection)
    if (counter <= credential.counter) {
      console.error('[BiometricAuth] Possible replay attack detected');
      return { success: false, error: 'Invalid counter' };
    }

    // Verify challenge response (in production, verify signature with publicKey)
    const expectedResponse = createHash('sha256')
      .update(challenge.challenge + credential.publicKey)
      .digest('base64url');

    if (challengeResponse !== expectedResponse && config.nodeEnv === 'production') {
      return { success: false, error: 'Invalid authentication' };
    }

    // Clear the challenge
    this.challengeStore.delete(key);

    // Update credential usage
    if (this.supabase) {
      await this.supabase.from('biometric_credentials')
        .update({
          counter,
          last_used_at: new Date().toISOString(),
        })
        .eq('id', credential.id);

      // Update device last active
      await this.supabase.from('device_registrations')
        .update({ last_active_at: new Date().toISOString() })
        .eq('user_id', userId)
        .eq('device_id', deviceId);
    }

    // Generate session tokens
    const token = this.generateSessionToken(userId, deviceId);
    const refreshToken = randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours

    // Store session
    if (this.supabase) {
      await this.supabase.from('mobile_sessions').insert({
        token_hash: createHash('sha256').update(token).digest('hex'),
        refresh_token_hash: createHash('sha256').update(refreshToken).digest('hex'),
        user_id: userId,
        device_id: deviceId,
        expires_at: expiresAt.toISOString(),
        created_at: new Date().toISOString(),
      });
    }

    console.log(`[BiometricAuth] Authentication successful for user ${userId} on device ${deviceId}`);

    return {
      success: true,
      token,
      refreshToken,
      expiresAt,
      deviceId,
    };
  }

  /**
   * Revoke a biometric credential
   */
  async revokeCredential(userId: string, credentialId: string): Promise<boolean> {
    if (!this.supabase) return false;

    const { error } = await this.supabase.from('biometric_credentials')
      .update({ is_active: false })
      .eq('user_id', userId)
      .eq('credential_id', credentialId);

    if (error) {
      console.error('[BiometricAuth] Failed to revoke credential:', error);
      return false;
    }

    return true;
  }

  // ============================================
  // Apple Watch Pairing
  // ============================================

  /**
   * Initiate Apple Watch pairing with iPhone
   */
  async pairAppleWatch(
    userId: string,
    request: WatchPairingRequest
  ): Promise<WatchPairingResult> {
    // Verify the iPhone is registered
    const iphone = await this.getDevice(userId, request.iPhoneDeviceId);
    if (!iphone) {
      return { success: false, error: 'iPhone not registered' };
    }

    // Generate pairing verification
    const expectedCode = createHash('sha256')
      .update(`${userId}:${request.iPhoneDeviceId}:${request.watchDeviceId}`)
      .digest('hex')
      .substring(0, 6)
      .toUpperCase();

    // Verify pairing code
    if (request.pairingCode !== expectedCode && config.nodeEnv === 'production') {
      return { success: false, error: 'Invalid pairing code' };
    }

    // Register the watch
    const watchRegistration = await this.registerDevice(userId, {
      deviceId: request.watchDeviceId,
      deviceToken: randomBytes(32).toString('hex'),
      deviceName: request.watchName,
      deviceType: 'apple_watch',
      osVersion: request.watchOsVersion,
      appVersion: iphone.appVersion,
      biometricEnabled: true,
    });

    // Update iPhone with paired watch
    if (this.supabase) {
      await this.supabase.from('device_registrations')
        .update({ paired_watch_id: request.watchDeviceId })
        .eq('user_id', userId)
        .eq('device_id', request.iPhoneDeviceId);
    }

    // Create pairing record
    const pairingId = randomBytes(16).toString('hex');
    if (this.supabase) {
      await this.supabase.from('watch_pairings').insert({
        id: pairingId,
        user_id: userId,
        iphone_device_id: request.iPhoneDeviceId,
        watch_device_id: request.watchDeviceId,
        watch_name: request.watchName,
        watch_os_version: request.watchOsVersion,
        paired_at: new Date().toISOString(),
        is_active: true,
      });
    }

    console.log(`[BiometricAuth] Apple Watch paired: ${request.watchName} with ${iphone.deviceName}`);

    return { success: true, pairingId };
  }

  /**
   * Unpair Apple Watch
   */
  async unpairAppleWatch(userId: string, watchDeviceId: string): Promise<boolean> {
    if (!this.supabase) return false;

    // Deactivate pairing
    await this.supabase.from('watch_pairings')
      .update({ is_active: false, unpaired_at: new Date().toISOString() })
      .eq('user_id', userId)
      .eq('watch_device_id', watchDeviceId);

    // Update iPhone to remove paired watch reference
    await this.supabase.from('device_registrations')
      .update({ paired_watch_id: null })
      .eq('user_id', userId)
      .eq('paired_watch_id', watchDeviceId);

    // Remove watch device
    await this.removeDevice(userId, watchDeviceId);

    console.log(`[BiometricAuth] Apple Watch unpaired: ${watchDeviceId}`);
    return true;
  }

  /**
   * Get watch pairing status
   */
  async getWatchPairing(userId: string, watchDeviceId: string): Promise<{
    isPaired: boolean;
    pairedWith?: string;
    pairedAt?: Date;
  }> {
    if (!this.supabase) {
      return { isPaired: false };
    }

    const { data } = await this.supabase.from('watch_pairings')
      .select('*')
      .eq('user_id', userId)
      .eq('watch_device_id', watchDeviceId)
      .eq('is_active', true)
      .single();

    if (!data) {
      return { isPaired: false };
    }

    return {
      isPaired: true,
      pairedWith: data.iphone_device_id,
      pairedAt: new Date(data.paired_at),
    };
  }

  // ============================================
  // Session Management
  // ============================================

  /**
   * Validate a session token
   */
  async validateSession(token: string): Promise<{ valid: boolean; userId?: string; deviceId?: string }> {
    if (!this.supabase) {
      return { valid: false };
    }

    const tokenHash = createHash('sha256').update(token).digest('hex');

    const { data } = await this.supabase.from('mobile_sessions')
      .select('*')
      .eq('token_hash', tokenHash)
      .gt('expires_at', new Date().toISOString())
      .single();

    if (!data) {
      return { valid: false };
    }

    return {
      valid: true,
      userId: data.user_id,
      deviceId: data.device_id,
    };
  }

  /**
   * Refresh a session token
   */
  async refreshSession(refreshToken: string): Promise<AuthenticationResult> {
    if (!this.supabase) {
      return { success: false, error: 'Database not configured' };
    }

    const refreshTokenHash = createHash('sha256').update(refreshToken).digest('hex');

    const { data } = await this.supabase.from('mobile_sessions')
      .select('*')
      .eq('refresh_token_hash', refreshTokenHash)
      .single();

    if (!data) {
      return { success: false, error: 'Invalid refresh token' };
    }

    // Generate new tokens
    const newToken = this.generateSessionToken(data.user_id, data.device_id);
    const newRefreshToken = randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);

    // Update session
    await this.supabase.from('mobile_sessions')
      .update({
        token_hash: createHash('sha256').update(newToken).digest('hex'),
        refresh_token_hash: createHash('sha256').update(newRefreshToken).digest('hex'),
        expires_at: expiresAt.toISOString(),
      })
      .eq('id', data.id);

    return {
      success: true,
      token: newToken,
      refreshToken: newRefreshToken,
      expiresAt,
      deviceId: data.device_id,
    };
  }

  /**
   * Revoke all sessions for a device
   */
  async revokeDeviceSessions(userId: string, deviceId: string): Promise<boolean> {
    if (!this.supabase) return false;

    await this.supabase.from('mobile_sessions')
      .delete()
      .eq('user_id', userId)
      .eq('device_id', deviceId);

    return true;
  }

  // ============================================
  // Helpers
  // ============================================

  private generateSessionToken(userId: string, deviceId: string): string {
    const payload = {
      userId,
      deviceId,
      iat: Date.now(),
      nonce: randomBytes(16).toString('hex'),
    };
    const token = Buffer.from(JSON.stringify(payload)).toString('base64url');
    const signature = createHash('sha256')
      .update(token + (config.supabaseServiceKey || 'dev-secret'))
      .digest('base64url');
    return `${token}.${signature}`;
  }

  private cleanupExpiredChallenges(): void {
    const now = new Date();
    for (const [key, challenge] of this.challengeStore.entries()) {
      if (challenge.expiresAt < now) {
        this.challengeStore.delete(key);
      }
    }
  }

  /**
   * Get circuit breaker stats
   */
  getCircuitBreakerStats() {
    return this.circuitBreaker.getStats();
  }
}

// Singleton instance
export const biometricAuthService = new BiometricAuthService();
