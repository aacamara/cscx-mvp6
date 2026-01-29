/**
 * Google Workspace Connection Component
 * Settings panel for connecting/disconnecting Google Workspace
 */

import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../context/AuthContext';
import { CheckCircle, AlertCircle, X, Loader2, Mail, Calendar, HardDrive, Link, Unlink } from 'lucide-react';

interface GoogleConnectionStatus {
  connected: boolean;
  email?: string;
  google_email?: string;
  scopes?: string[];
  expires_at?: string;
}

interface GoogleConnectProps {
  onClose?: () => void;
}

export function GoogleConnect({ onClose }: GoogleConnectProps) {
  const { getAuthHeaders, hasGoogleAccess } = useAuth();
  const [status, setStatus] = useState<GoogleConnectionStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [connecting, setConnecting] = useState(false);
  const [disconnecting, setDisconnecting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const API_URL = import.meta.env.VITE_API_URL || '';

  // Fetch connection status from backend
  const fetchStatus = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch(`${API_URL}/api/google/auth/status`, {
        headers: getAuthHeaders()
      });

      if (response.ok) {
        const data = await response.json();
        setStatus(data);
      } else if (response.status === 401) {
        setStatus({ connected: false });
      } else {
        const errorData = await response.json();
        setError(errorData.message || 'Failed to check connection status');
        setStatus({ connected: false });
      }
    } catch (err) {
      console.error('Error fetching Google status:', err);
      setError('Unable to check connection status');
      setStatus({ connected: false });
    } finally {
      setLoading(false);
    }
  }, [API_URL, getAuthHeaders]);

  useEffect(() => {
    fetchStatus();
  }, [fetchStatus]);

  // Check URL params for OAuth callback result
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const googleConnected = params.get('google_connected');
    const email = params.get('email');
    const errorParam = params.get('error');

    if (googleConnected === 'true') {
      // Successfully connected - refresh status
      fetchStatus();
      // Clear URL params
      window.history.replaceState({}, '', window.location.pathname);
    } else if (errorParam) {
      setError(`Connection failed: ${errorParam}`);
      // Clear URL params
      window.history.replaceState({}, '', window.location.pathname);
    }
  }, [fetchStatus]);

  // Handle connect button click
  const handleConnect = async () => {
    setConnecting(true);
    setError(null);

    try {
      const response = await fetch(`${API_URL}/api/google/auth/connect`, {
        headers: getAuthHeaders()
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Failed to initiate connection');
      }

      const data = await response.json();

      // Redirect to Google OAuth URL
      if (data.url) {
        window.location.href = data.url;
      } else {
        throw new Error('No OAuth URL returned');
      }
    } catch (err) {
      console.error('Error connecting Google:', err);
      setError(err instanceof Error ? err.message : 'Failed to connect');
      setConnecting(false);
    }
  };

  // Handle disconnect button click
  const handleDisconnect = async () => {
    if (!confirm('Are you sure you want to disconnect Google Workspace? This will disable Gmail, Calendar, and Drive integrations.')) {
      return;
    }

    setDisconnecting(true);
    setError(null);

    try {
      const response = await fetch(`${API_URL}/api/google/auth/disconnect`, {
        method: 'DELETE',
        headers: getAuthHeaders()
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Failed to disconnect');
      }

      // Update status
      setStatus({ connected: false });
    } catch (err) {
      console.error('Error disconnecting Google:', err);
      setError(err instanceof Error ? err.message : 'Failed to disconnect');
    } finally {
      setDisconnecting(false);
    }
  };

  const connectedEmail = status?.google_email || status?.email;
  const isConnected = status?.connected || hasGoogleAccess;

  return (
    <div className="bg-cscx-gray-900 rounded-xl border border-cscx-gray-700 overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-cscx-gray-700">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-white rounded-lg flex items-center justify-center">
            <svg className="w-6 h-6" viewBox="0 0 24 24">
              <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
              <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
              <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
              <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
            </svg>
          </div>
          <div>
            <h3 className="text-lg font-semibold text-white">Google Workspace</h3>
            <p className="text-sm text-cscx-gray-400">Connect to enable Gmail, Calendar, and Drive</p>
          </div>
        </div>
        {onClose && (
          <button
            onClick={onClose}
            className="p-2 text-cscx-gray-400 hover:text-white hover:bg-cscx-gray-800 rounded-lg transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        )}
      </div>

      {/* Content */}
      <div className="p-4">
        {/* Error Message */}
        {error && (
          <div className="mb-4 p-3 bg-red-900/20 border border-red-500/30 rounded-lg flex items-center gap-2 text-red-400 text-sm">
            <AlertCircle className="w-4 h-4 flex-shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {/* Loading State */}
        {loading && (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="w-6 h-6 text-cscx-accent animate-spin" />
          </div>
        )}

        {/* Connected State */}
        {!loading && isConnected && (
          <div className="space-y-4">
            {/* Connection Status */}
            <div className="flex items-center justify-between p-3 bg-green-900/20 border border-green-500/30 rounded-lg">
              <div className="flex items-center gap-3">
                <CheckCircle className="w-5 h-5 text-green-500" />
                <div>
                  <p className="text-white font-medium">Connected</p>
                  {connectedEmail && (
                    <p className="text-sm text-cscx-gray-400">{connectedEmail}</p>
                  )}
                </div>
              </div>
              <button
                onClick={handleDisconnect}
                disabled={disconnecting}
                className="flex items-center gap-2 px-3 py-1.5 text-sm text-red-400 hover:text-red-300 hover:bg-red-900/20 rounded-lg transition-colors disabled:opacity-50"
              >
                {disconnecting ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Unlink className="w-4 h-4" />
                )}
                Disconnect
              </button>
            </div>

            {/* Enabled Features */}
            <div className="space-y-2">
              <p className="text-sm text-cscx-gray-400 font-medium">Enabled Features</p>
              <div className="grid gap-2">
                <div className="flex items-center gap-3 p-2 bg-cscx-gray-800/50 rounded-lg">
                  <Mail className="w-5 h-5 text-blue-400" />
                  <span className="text-white">Gmail Integration</span>
                  <CheckCircle className="w-4 h-4 text-green-500 ml-auto" />
                </div>
                <div className="flex items-center gap-3 p-2 bg-cscx-gray-800/50 rounded-lg">
                  <Calendar className="w-5 h-5 text-green-400" />
                  <span className="text-white">Calendar Sync</span>
                  <CheckCircle className="w-4 h-4 text-green-500 ml-auto" />
                </div>
                <div className="flex items-center gap-3 p-2 bg-cscx-gray-800/50 rounded-lg">
                  <HardDrive className="w-5 h-5 text-yellow-400" />
                  <span className="text-white">Drive Access</span>
                  <CheckCircle className="w-4 h-4 text-green-500 ml-auto" />
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Disconnected State */}
        {!loading && !isConnected && (
          <div className="space-y-4">
            {/* Benefits List */}
            <div className="space-y-2">
              <p className="text-sm text-cscx-gray-400 font-medium">Connect to unlock:</p>
              <div className="grid gap-2">
                <div className="flex items-center gap-3 p-2 bg-cscx-gray-800/50 rounded-lg">
                  <Mail className="w-5 h-5 text-blue-400" />
                  <span className="text-cscx-gray-300">Send emails directly from CSCX.AI</span>
                </div>
                <div className="flex items-center gap-3 p-2 bg-cscx-gray-800/50 rounded-lg">
                  <Calendar className="w-5 h-5 text-green-400" />
                  <span className="text-cscx-gray-300">Schedule meetings with customers</span>
                </div>
                <div className="flex items-center gap-3 p-2 bg-cscx-gray-800/50 rounded-lg">
                  <HardDrive className="w-5 h-5 text-yellow-400" />
                  <span className="text-cscx-gray-300">Access documents in customer folders</span>
                </div>
              </div>
            </div>

            {/* Connect Button */}
            <button
              onClick={handleConnect}
              disabled={connecting}
              className="w-full flex items-center justify-center gap-2 bg-white hover:bg-gray-100 text-gray-900 font-medium py-3 px-4 rounded-lg transition-colors disabled:opacity-50"
            >
              {connecting ? (
                <Loader2 className="w-5 h-5 animate-spin" />
              ) : (
                <>
                  <Link className="w-5 h-5" />
                  Connect Google Workspace
                </>
              )}
            </button>

            <p className="text-xs text-cscx-gray-500 text-center">
              By connecting, you authorize CSCX.AI to access your Gmail, Calendar, and Drive on your behalf.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

export default GoogleConnect;
