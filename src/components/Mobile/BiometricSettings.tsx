/**
 * BiometricSettings Component
 * PRD-266: Apple Watch Integration
 *
 * Settings panel for managing biometric authentication, device registration,
 * and Apple Watch pairing for the CSCX mobile experience.
 */

import React, { useState, useEffect, useCallback } from 'react';

// ============================================
// Types
// ============================================

interface Device {
  id: string;
  deviceId: string;
  deviceName: string;
  deviceType: 'iphone' | 'apple_watch' | 'ipad' | 'android' | 'android_wear';
  osVersion: string;
  appVersion: string;
  biometricEnabled: boolean;
  pairedWatchId?: string;
  lastActiveAt: string;
  createdAt: string;
}

interface BiometricCredential {
  id: string;
  credentialId: string;
  deviceName: string;
  authenticatorType: 'face_id' | 'touch_id' | 'passcode' | 'pin' | 'pattern';
  createdAt: string;
  lastUsedAt?: string;
}

interface WatchPairing {
  isPaired: boolean;
  pairedWith?: string;
  pairedAt?: string;
}

// ============================================
// API Functions
// ============================================

const API_BASE = '/api/mobile';

async function fetchWithAuth(url: string, options: RequestInit = {}) {
  const userId = localStorage.getItem('userId') || 'demo-user';
  return fetch(url, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      'x-user-id': userId,
      ...options.headers,
    },
  });
}

async function getDevices(): Promise<Device[]> {
  const res = await fetchWithAuth(`${API_BASE}/devices`);
  const data = await res.json();
  return data.devices || [];
}

async function removeDevice(deviceId: string): Promise<boolean> {
  const res = await fetchWithAuth(`${API_BASE}/devices/${deviceId}`, { method: 'DELETE' });
  return res.ok;
}

async function getWatchStatus(watchDeviceId: string): Promise<WatchPairing> {
  const res = await fetchWithAuth(`${API_BASE}/watch/${watchDeviceId}/status`);
  const data = await res.json();
  return data;
}

async function unpairWatch(watchDeviceId: string): Promise<boolean> {
  const res = await fetchWithAuth(`${API_BASE}/watch/${watchDeviceId}`, { method: 'DELETE' });
  return res.ok;
}

async function revokeCredential(credentialId: string): Promise<boolean> {
  const res = await fetchWithAuth(`${API_BASE}/auth/credential/${credentialId}`, { method: 'DELETE' });
  return res.ok;
}

// ============================================
// Component
// ============================================

export const BiometricSettings: React.FC = () => {
  const [devices, setDevices] = useState<Device[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedDevice, setSelectedDevice] = useState<Device | null>(null);
  const [showPairingDialog, setShowPairingDialog] = useState(false);

  // Load devices on mount
  const loadDevices = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const deviceList = await getDevices();
      setDevices(deviceList);
    } catch (err) {
      setError('Failed to load devices');
      console.error('Error loading devices:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadDevices();
  }, [loadDevices]);

  // Handle device removal
  const handleRemoveDevice = async (device: Device) => {
    if (!confirm(`Remove ${device.deviceName}? This will sign out this device.`)) {
      return;
    }

    try {
      const success = await removeDevice(device.deviceId);
      if (success) {
        setDevices(devices.filter(d => d.id !== device.id));
      } else {
        setError('Failed to remove device');
      }
    } catch (err) {
      setError('Failed to remove device');
      console.error('Error removing device:', err);
    }
  };

  // Handle watch unpairing
  const handleUnpairWatch = async (watchDeviceId: string) => {
    if (!confirm('Unpair this Apple Watch? You will need to pair it again to use the watch app.')) {
      return;
    }

    try {
      const success = await unpairWatch(watchDeviceId);
      if (success) {
        loadDevices();
      } else {
        setError('Failed to unpair watch');
      }
    } catch (err) {
      setError('Failed to unpair watch');
      console.error('Error unpairing watch:', err);
    }
  };

  // Get device icon based on type
  const getDeviceIcon = (deviceType: Device['deviceType']) => {
    switch (deviceType) {
      case 'iphone':
        return (
          <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 18h.01M8 21h8a2 2 0 002-2V5a2 2 0 00-2-2H8a2 2 0 00-2 2v14a2 2 0 002 2z" />
          </svg>
        );
      case 'apple_watch':
        return (
          <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        );
      case 'ipad':
        return (
          <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 18h.01M7 21h10a2 2 0 002-2V5a2 2 0 00-2-2H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
          </svg>
        );
      default:
        return (
          <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
          </svg>
        );
    }
  };

  // Get authenticator type display name
  const getAuthenticatorName = (type: BiometricCredential['authenticatorType']) => {
    switch (type) {
      case 'face_id':
        return 'Face ID';
      case 'touch_id':
        return 'Touch ID';
      case 'passcode':
        return 'Passcode';
      case 'pin':
        return 'PIN';
      case 'pattern':
        return 'Pattern';
      default:
        return 'Biometric';
    }
  };

  // Format relative time
  const formatRelativeTime = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMins / 60);
    const diffDays = Math.floor(diffHours / 24);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    return date.toLocaleDateString();
  };

  // Separate devices by type
  const phones = devices.filter(d => d.deviceType === 'iphone' || d.deviceType === 'android');
  const watches = devices.filter(d => d.deviceType === 'apple_watch' || d.deviceType === 'android_wear');
  const tablets = devices.filter(d => d.deviceType === 'ipad');

  return (
    <div className="max-w-4xl mx-auto p-6 space-y-8">
      {/* Header */}
      <div className="border-b border-gray-800 pb-4">
        <h1 className="text-2xl font-semibold text-white">Biometric & Device Settings</h1>
        <p className="text-gray-400 mt-1">
          Manage your registered devices, biometric authentication, and Apple Watch pairing.
        </p>
      </div>

      {/* Error Alert */}
      {error && (
        <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-4 flex items-center gap-3">
          <svg className="w-5 h-5 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <span className="text-red-400">{error}</span>
          <button
            onClick={() => setError(null)}
            className="ml-auto text-red-400 hover:text-red-300"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      )}

      {/* Loading State */}
      {loading ? (
        <div className="flex items-center justify-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-cscx-accent"></div>
        </div>
      ) : (
        <>
          {/* Mobile Phones Section */}
          <section>
            <h2 className="text-lg font-medium text-white mb-4 flex items-center gap-2">
              <svg className="w-5 h-5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 18h.01M8 21h8a2 2 0 002-2V5a2 2 0 00-2-2H8a2 2 0 00-2 2v14a2 2 0 002 2z" />
              </svg>
              Mobile Phones
            </h2>
            {phones.length === 0 ? (
              <div className="bg-gray-900 rounded-lg p-6 text-center">
                <p className="text-gray-500">No phones registered</p>
                <p className="text-gray-600 text-sm mt-1">
                  Download the CSCX mobile app to get started
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {phones.map(device => (
                  <DeviceCard
                    key={device.id}
                    device={device}
                    icon={getDeviceIcon(device.deviceType)}
                    formatTime={formatRelativeTime}
                    onRemove={() => handleRemoveDevice(device)}
                    onSelect={() => setSelectedDevice(device)}
                  />
                ))}
              </div>
            )}
          </section>

          {/* Apple Watch Section */}
          <section>
            <h2 className="text-lg font-medium text-white mb-4 flex items-center gap-2">
              <svg className="w-5 h-5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              Apple Watch
            </h2>
            {watches.length === 0 ? (
              <div className="bg-gray-900 rounded-lg p-6 text-center">
                <p className="text-gray-500">No watches paired</p>
                <p className="text-gray-600 text-sm mt-1">
                  Pair your Apple Watch from the CSCX iOS app
                </p>
                <button
                  onClick={() => setShowPairingDialog(true)}
                  className="mt-4 px-4 py-2 bg-cscx-accent text-white rounded-lg hover:bg-cscx-accent/90 transition-colors"
                >
                  Learn How to Pair
                </button>
              </div>
            ) : (
              <div className="space-y-3">
                {watches.map(device => (
                  <div
                    key={device.id}
                    className="bg-gray-900 rounded-lg p-4 border border-gray-800 hover:border-gray-700 transition-colors"
                  >
                    <div className="flex items-center gap-4">
                      <div className="text-gray-400">
                        {getDeviceIcon(device.deviceType)}
                      </div>
                      <div className="flex-1">
                        <h3 className="text-white font-medium">{device.deviceName}</h3>
                        <p className="text-gray-500 text-sm">
                          watchOS {device.osVersion} • Last active {formatRelativeTime(device.lastActiveAt)}
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="px-2 py-1 bg-green-500/10 text-green-400 text-xs rounded-full">
                          Paired
                        </span>
                        <button
                          onClick={() => handleUnpairWatch(device.deviceId)}
                          className="p-2 text-gray-500 hover:text-red-400 transition-colors"
                          title="Unpair Watch"
                        >
                          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
                          </svg>
                        </button>
                      </div>
                    </div>

                    {/* Watch Features */}
                    <div className="mt-4 pt-4 border-t border-gray-800 grid grid-cols-2 gap-4 text-sm">
                      <div className="flex items-center gap-2 text-gray-400">
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
                        </svg>
                        Notifications enabled
                      </div>
                      <div className="flex items-center gap-2 text-gray-400">
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                        </svg>
                        Complications active
                      </div>
                      <div className="flex items-center gap-2 text-gray-400">
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
                        </svg>
                        Siri shortcuts
                      </div>
                      <div className="flex items-center gap-2 text-gray-400">
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                        </svg>
                        Biometric auth
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>

          {/* Tablets Section */}
          {tablets.length > 0 && (
            <section>
              <h2 className="text-lg font-medium text-white mb-4 flex items-center gap-2">
                <svg className="w-5 h-5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 18h.01M7 21h10a2 2 0 002-2V5a2 2 0 00-2-2H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
                </svg>
                Tablets
              </h2>
              <div className="space-y-3">
                {tablets.map(device => (
                  <DeviceCard
                    key={device.id}
                    device={device}
                    icon={getDeviceIcon(device.deviceType)}
                    formatTime={formatRelativeTime}
                    onRemove={() => handleRemoveDevice(device)}
                    onSelect={() => setSelectedDevice(device)}
                  />
                ))}
              </div>
            </section>
          )}

          {/* Biometric Security Info */}
          <section className="bg-gray-900 rounded-lg p-6 border border-gray-800">
            <h2 className="text-lg font-medium text-white mb-4 flex items-center gap-2">
              <svg className="w-5 h-5 text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
              </svg>
              Biometric Security
            </h2>
            <div className="space-y-4 text-gray-400 text-sm">
              <p>
                Your biometric credentials (Face ID, Touch ID) are stored securely on your device
                and never leave your phone. CSCX uses the WebAuthn standard for passwordless
                authentication.
              </p>
              <div className="flex items-start gap-3">
                <svg className="w-5 h-5 text-green-400 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
                <span>Biometric data never leaves your device</span>
              </div>
              <div className="flex items-start gap-3">
                <svg className="w-5 h-5 text-green-400 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
                <span>Replay attack protection with incrementing counters</span>
              </div>
              <div className="flex items-start gap-3">
                <svg className="w-5 h-5 text-green-400 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
                <span>Secure session tokens with automatic refresh</span>
              </div>
            </div>
          </section>
        </>
      )}

      {/* Pairing Instructions Dialog */}
      {showPairingDialog && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
          <div className="bg-gray-900 rounded-xl max-w-md w-full p-6 border border-gray-800">
            <h3 className="text-lg font-medium text-white mb-4">
              Pair Your Apple Watch
            </h3>
            <ol className="space-y-4 text-gray-400 text-sm">
              <li className="flex gap-3">
                <span className="flex-shrink-0 w-6 h-6 bg-cscx-accent text-white rounded-full flex items-center justify-center text-xs font-medium">1</span>
                <span>Open the CSCX app on your iPhone</span>
              </li>
              <li className="flex gap-3">
                <span className="flex-shrink-0 w-6 h-6 bg-cscx-accent text-white rounded-full flex items-center justify-center text-xs font-medium">2</span>
                <span>Go to Settings → Apple Watch</span>
              </li>
              <li className="flex gap-3">
                <span className="flex-shrink-0 w-6 h-6 bg-cscx-accent text-white rounded-full flex items-center justify-center text-xs font-medium">3</span>
                <span>Tap "Pair Apple Watch" and follow the prompts</span>
              </li>
              <li className="flex gap-3">
                <span className="flex-shrink-0 w-6 h-6 bg-cscx-accent text-white rounded-full flex items-center justify-center text-xs font-medium">4</span>
                <span>Enter the pairing code shown on your watch</span>
              </li>
            </ol>
            <button
              onClick={() => setShowPairingDialog(false)}
              className="mt-6 w-full py-2 bg-gray-800 text-white rounded-lg hover:bg-gray-700 transition-colors"
            >
              Got it
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

// ============================================
// Device Card Component
// ============================================

interface DeviceCardProps {
  device: Device;
  icon: React.ReactNode;
  formatTime: (date: string) => string;
  onRemove: () => void;
  onSelect: () => void;
}

const DeviceCard: React.FC<DeviceCardProps> = ({
  device,
  icon,
  formatTime,
  onRemove,
  onSelect,
}) => (
  <div className="bg-gray-900 rounded-lg p-4 border border-gray-800 hover:border-gray-700 transition-colors">
    <div className="flex items-center gap-4">
      <div className="text-gray-400">{icon}</div>
      <div className="flex-1 cursor-pointer" onClick={onSelect}>
        <h3 className="text-white font-medium">{device.deviceName}</h3>
        <p className="text-gray-500 text-sm">
          {device.deviceType === 'iphone' ? 'iOS' : device.deviceType === 'android' ? 'Android' : device.deviceType}{' '}
          {device.osVersion} • v{device.appVersion}
        </p>
        <p className="text-gray-600 text-xs mt-1">
          Last active {formatTime(device.lastActiveAt)}
        </p>
      </div>
      <div className="flex items-center gap-3">
        {device.biometricEnabled && (
          <span className="px-2 py-1 bg-green-500/10 text-green-400 text-xs rounded-full flex items-center gap-1">
            <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
            </svg>
            Biometric
          </span>
        )}
        {device.pairedWatchId && (
          <span className="px-2 py-1 bg-blue-500/10 text-blue-400 text-xs rounded-full">
            Watch paired
          </span>
        )}
        <button
          onClick={onRemove}
          className="p-2 text-gray-500 hover:text-red-400 transition-colors"
          title="Remove device"
        >
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
          </svg>
        </button>
      </div>
    </div>
  </div>
);

export default BiometricSettings;
