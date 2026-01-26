/**
 * Google Connection Widget
 * Displays Google Workspace connection status and allows connecting/disconnecting
 */

import React, { useState, useEffect, useCallback } from 'react';

interface GoogleConnectionStatus {
  connected: boolean;
  email?: string;
  scopes?: string[];
  expiresAt?: string;
  lastRefreshed?: string;
}

// Demo user ID with connected Google account
const DEMO_USER_ID = 'df2dc7be-ece0-40b2-a9d7-0f6c45b75131';

interface GoogleConnectionWidgetProps {
  userId?: string;
  compact?: boolean;
  onStatusChange?: (connected: boolean) => void;
}

export function GoogleConnectionWidget({
  userId: providedUserId,
  compact = false,
  onStatusChange
}: GoogleConnectionWidgetProps) {
  // Use provided userId or fall back to demo user
  const userId = providedUserId || DEMO_USER_ID;
  const [status, setStatus] = useState<GoogleConnectionStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [connecting, setConnecting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const API_URL = import.meta.env.VITE_API_URL || '';

  // Check connection status
  const checkStatus = useCallback(async () => {
    try {
      const response = await fetch(`${API_URL}/api/google/auth/status`, {
        headers: {
          'x-user-id': userId
        }
      });

      if (response.ok) {
        const data = await response.json();
        setStatus(data);
        onStatusChange?.(data.connected);
      } else {
        setStatus({ connected: false });
        onStatusChange?.(false);
      }
    } catch (err) {
      console.error('Failed to check Google status:', err);
      setStatus({ connected: false });
    } finally {
      setLoading(false);
    }
  }, [userId, API_URL, onStatusChange]);

  useEffect(() => {
    checkStatus();

    // Check URL params for OAuth callback result
    const params = new URLSearchParams(window.location.search);
    if (params.get('google_connected') === 'true') {
      setStatus({ connected: true, email: params.get('email') || undefined });
      onStatusChange?.(true);
      // Clean up URL
      window.history.replaceState({}, '', window.location.pathname);
    } else if (params.get('error')) {
      setError(params.get('message') || 'Failed to connect Google account');
      window.history.replaceState({}, '', window.location.pathname);
    }
  }, [checkStatus, onStatusChange]);

  // Initiate Google connection
  const handleConnect = async () => {
    setConnecting(true);
    setError(null);

    try {
      const response = await fetch(`${API_URL}/api/google/auth/connect?userId=${userId}`, {
        headers: {
          'x-user-id': userId || ''
        }
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.message || 'Failed to initiate Google connection');
      }

      const { url } = await response.json();

      // Redirect to Google OAuth
      window.location.href = url;
    } catch (err) {
      setError((err as Error).message);
      setConnecting(false);
    }
  };

  // Disconnect Google account
  const handleDisconnect = async () => {
    if (!confirm('Are you sure you want to disconnect your Google account? Agents will no longer be able to send emails or schedule meetings.')) {
      return;
    }

    try {
      const response = await fetch(`${API_URL}/api/google/auth/disconnect`, {
        method: 'DELETE',
        headers: {
          'x-user-id': userId || ''
        }
      });

      if (response.ok) {
        setStatus({ connected: false });
        onStatusChange?.(false);
      } else {
        const data = await response.json();
        throw new Error(data.message || 'Failed to disconnect');
      }
    } catch (err) {
      setError((err as Error).message);
    }
  };

  // Compact view (just an indicator)
  if (compact) {
    return (
      <div className="flex items-center gap-2">
        {loading ? (
          <div className="w-3 h-3 rounded-full bg-gray-400 animate-pulse" />
        ) : status?.connected ? (
          <>
            <div className="w-3 h-3 rounded-full bg-green-500" />
            <span className="text-xs text-gray-400">Google connected</span>
          </>
        ) : (
          <button
            onClick={handleConnect}
            disabled={connecting}
            className="text-xs text-blue-400 hover:text-blue-300 underline"
          >
            {connecting ? 'Connecting...' : 'Connect Google'}
          </button>
        )}
      </div>
    );
  }

  // Full view
  return (
    <div className="bg-cscx-gray-800 rounded-lg p-4 border border-cscx-gray-700">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <svg className="w-5 h-5 text-white" viewBox="0 0 24 24">
            <path fill="currentColor" d="M12.545,10.239v3.821h5.445c-0.712,2.315-2.647,3.972-5.445,3.972c-3.332,0-6.033-2.701-6.033-6.032s2.701-6.032,6.033-6.032c1.498,0,2.866,0.549,3.921,1.453l2.814-2.814C17.503,2.988,15.139,2,12.545,2C7.021,2,2.543,6.477,2.543,12s4.478,10,10.002,10c8.396,0,10.249-7.85,9.426-11.748L12.545,10.239z"/>
          </svg>
          <span className="font-medium text-white">Google Workspace</span>
        </div>

        {loading ? (
          <span className="text-sm text-gray-400">Checking...</span>
        ) : status?.connected ? (
          <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs bg-green-900/50 text-green-400">
            <span className="w-2 h-2 rounded-full bg-green-500" />
            Connected
          </span>
        ) : (
          <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs bg-yellow-900/50 text-yellow-400">
            <span className="w-2 h-2 rounded-full bg-yellow-500" />
            Not Connected
          </span>
        )}
      </div>

      {error && (
        <div className="mb-3 p-2 rounded bg-red-900/30 border border-red-800 text-red-400 text-sm">
          {error}
        </div>
      )}

      {status?.connected ? (
        <div className="space-y-2">
          <div className="flex items-center gap-2 text-sm text-gray-300">
            <svg className="w-4 h-4 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
            </svg>
            <span>{status.email}</span>
          </div>

          <p className="text-xs text-gray-500">
            Agents can send emails and schedule meetings on your behalf.
          </p>

          <div className="flex gap-2 mt-3">
            <button
              onClick={checkStatus}
              className="px-3 py-1.5 text-xs text-gray-400 hover:text-white border border-gray-600 rounded transition-colors"
            >
              Refresh Status
            </button>
            <button
              onClick={handleDisconnect}
              className="px-3 py-1.5 text-xs text-red-400 hover:text-red-300 border border-red-800 rounded transition-colors"
            >
              Disconnect
            </button>
          </div>
        </div>
      ) : (
        <div className="space-y-3">
          <p className="text-sm text-gray-400">
            Connect your Google account to enable agents to:
          </p>
          <ul className="text-sm text-gray-500 space-y-1 ml-4">
            <li className="flex items-center gap-2">
              <span className="w-1.5 h-1.5 rounded-full bg-gray-600" />
              Send emails on your behalf
            </li>
            <li className="flex items-center gap-2">
              <span className="w-1.5 h-1.5 rounded-full bg-gray-600" />
              Schedule meetings and sync calendar
            </li>
            <li className="flex items-center gap-2">
              <span className="w-1.5 h-1.5 rounded-full bg-gray-600" />
              Access Google Drive documents
            </li>
          </ul>

          <button
            onClick={handleConnect}
            disabled={connecting}
            className="w-full mt-2 flex items-center justify-center gap-2 px-4 py-2 bg-white text-gray-900 rounded-lg font-medium hover:bg-gray-100 transition-colors disabled:opacity-50"
          >
            {connecting ? (
              <>
                <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                </svg>
                Connecting...
              </>
            ) : (
              <>
                <svg className="w-5 h-5" viewBox="0 0 24 24">
                  <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                  <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                  <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                  <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                </svg>
                Connect Google Account
              </>
            )}
          </button>
        </div>
      )}
    </div>
  );
}

export default GoogleConnectionWidget;
