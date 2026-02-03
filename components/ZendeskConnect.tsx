/**
 * Zendesk Integration Component - PRD-184
 *
 * Settings panel for Zendesk ticket integration:
 * - OAuth/API token connection
 * - Sync status and history
 * - Customer mapping configuration
 * - Alert configuration
 * - Manual sync triggers
 */

import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../context/AuthContext';
import {
  CheckCircle,
  AlertCircle,
  X,
  Loader2,
  Link,
  Unlink,
  RefreshCw,
  Settings,
  History,
  Clock,
  TicketIcon,
  Users,
  Activity,
  AlertTriangle,
  Bell,
  ChevronDown,
  ChevronUp,
  Key,
} from 'lucide-react';

interface SyncStatus {
  configured: boolean;
  connected: boolean;
  lastSyncAt?: string;
  lastSyncStatus?: 'completed' | 'failed' | 'running';
  recordsSynced?: number;
  syncErrors?: string[];
  connection?: {
    subdomain: string;
    authType: 'oauth' | 'api_token';
    config?: SyncConfig;
  };
  circuitBreaker?: {
    state: 'CLOSED' | 'OPEN' | 'HALF_OPEN';
    failures: number;
  };
}

interface SyncConfig {
  syncSchedule: 'realtime' | 'hourly' | 'daily' | 'manual';
  syncOpenOnly: boolean;
  healthScoreWeight: number;
  alertConfig: AlertConfig;
}

interface AlertConfig {
  escalationAlert: boolean;
  slaBreachAlert: boolean;
  ticketSpikeThreshold: number;
  negativeCsatAlert: boolean;
}

interface SyncLog {
  id: string;
  sync_type: string;
  object_type: string;
  records_processed: number;
  records_created: number;
  records_updated: number;
  records_failed: number;
  records_skipped: number;
  status: string;
  started_at: string;
  completed_at: string;
  error_details?: string[];
}

interface ZendeskConnectProps {
  onClose?: () => void;
}

export function ZendeskConnect({ onClose }: ZendeskConnectProps) {
  const { user, getAuthHeaders } = useAuth();
  const [status, setStatus] = useState<SyncStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [connecting, setConnecting] = useState(false);
  const [disconnecting, setDisconnecting] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'overview' | 'alerts' | 'history' | 'settings'>('overview');
  const [syncHistory, setSyncHistory] = useState<SyncLog[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [showAdvanced, setShowAdvanced] = useState(false);

  // Connection form state
  const [authType, setAuthType] = useState<'oauth' | 'api_token'>('api_token');
  const [subdomain, setSubdomain] = useState('');
  const [email, setEmail] = useState('');
  const [apiToken, setApiToken] = useState('');

  const API_URL = import.meta.env.VITE_API_URL || '';
  const userId = user?.id;

  // Fetch connection status
  const fetchStatus = useCallback(async () => {
    if (!userId) return;

    setLoading(true);
    setError(null);

    try {
      const response = await fetch(`${API_URL}/api/integrations/zendesk/status?userId=${userId}`, {
        headers: getAuthHeaders(),
      });

      if (response.ok) {
        const data = await response.json();
        setStatus(data);
      } else {
        const errorData = await response.json();
        setError(errorData.error || 'Failed to check connection status');
        setStatus({ configured: true, connected: false });
      }
    } catch (err) {
      console.error('Error fetching Zendesk status:', err);
      setError('Unable to check connection status');
      setStatus({ configured: true, connected: false });
    } finally {
      setLoading(false);
    }
  }, [API_URL, userId, getAuthHeaders]);

  // Fetch sync history
  const fetchHistory = useCallback(async () => {
    if (!userId || !status?.connected) return;

    setLoadingHistory(true);
    try {
      const response = await fetch(`${API_URL}/api/integrations/zendesk/history?userId=${userId}&limit=10`, {
        headers: getAuthHeaders(),
      });

      if (response.ok) {
        const data = await response.json();
        setSyncHistory(data.logs || []);
      }
    } catch (err) {
      console.error('Error fetching sync history:', err);
    } finally {
      setLoadingHistory(false);
    }
  }, [API_URL, userId, status?.connected, getAuthHeaders]);

  useEffect(() => {
    fetchStatus();
  }, [fetchStatus]);

  useEffect(() => {
    if (activeTab === 'history' && status?.connected) {
      fetchHistory();
    }
  }, [activeTab, status?.connected, fetchHistory]);

  // Check URL params for OAuth callback result
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const success = params.get('success');
    const errorParam = params.get('error');

    if (success === 'zendesk_connected') {
      fetchStatus();
      window.history.replaceState({}, '', window.location.pathname);
    } else if (errorParam) {
      setError(`Connection failed: ${errorParam}`);
      window.history.replaceState({}, '', window.location.pathname);
    }
  }, [fetchStatus]);

  // Handle connect
  const handleConnect = async () => {
    if (!userId || !subdomain) return;

    setConnecting(true);
    setError(null);

    try {
      const body: Record<string, unknown> = {
        userId,
        subdomain,
        authType,
      };

      if (authType === 'api_token') {
        if (!email || !apiToken) {
          setError('Email and API token are required');
          setConnecting(false);
          return;
        }
        body.email = email;
        body.apiToken = apiToken;
      }

      const response = await fetch(`${API_URL}/api/integrations/zendesk/connect`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...getAuthHeaders(),
        },
        body: JSON.stringify(body),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to initiate connection');
      }

      const data = await response.json();

      if (data.authUrl) {
        // OAuth flow - redirect to Zendesk
        window.location.href = data.authUrl;
      } else if (data.success) {
        // API token - already connected
        await fetchStatus();
        setSubdomain('');
        setEmail('');
        setApiToken('');
      }
    } catch (err) {
      console.error('Error connecting Zendesk:', err);
      setError(err instanceof Error ? err.message : 'Failed to connect');
    } finally {
      setConnecting(false);
    }
  };

  // Handle disconnect
  const handleDisconnect = async () => {
    if (!userId) return;

    if (!confirm('Are you sure you want to disconnect Zendesk? Synced tickets will remain but no new syncs will occur.')) {
      return;
    }

    setDisconnecting(true);
    setError(null);

    try {
      const response = await fetch(`${API_URL}/api/integrations/zendesk/disconnect`, {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
          ...getAuthHeaders(),
        },
        body: JSON.stringify({ userId }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to disconnect');
      }

      setStatus({ configured: true, connected: false });
    } catch (err) {
      console.error('Error disconnecting Zendesk:', err);
      setError(err instanceof Error ? err.message : 'Failed to disconnect');
    } finally {
      setDisconnecting(false);
    }
  };

  // Handle sync
  const handleSync = async (incremental: boolean = false) => {
    if (!userId) return;

    setSyncing(true);
    setError(null);

    try {
      const response = await fetch(`${API_URL}/api/integrations/zendesk/sync`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...getAuthHeaders(),
        },
        body: JSON.stringify({ userId, incremental }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Sync failed');
      }

      const data = await response.json();
      console.log('Sync result:', data);

      // Refresh status after sync
      await fetchStatus();
      if (activeTab === 'history') {
        await fetchHistory();
      }
    } catch (err) {
      console.error('Sync error:', err);
      setError(err instanceof Error ? err.message : 'Sync failed');
    } finally {
      setSyncing(false);
    }
  };

  // Update config
  const handleUpdateConfig = async (config: Partial<SyncConfig>) => {
    if (!userId) return;

    try {
      const response = await fetch(`${API_URL}/api/integrations/zendesk/config`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          ...getAuthHeaders(),
        },
        body: JSON.stringify({ userId, config }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to update config');
      }

      await fetchStatus();
    } catch (err) {
      console.error('Config update error:', err);
      setError(err instanceof Error ? err.message : 'Failed to update config');
    }
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleString();
  };

  return (
    <div className="bg-cscx-gray-900 rounded-xl border border-cscx-gray-700 overflow-hidden max-h-[80vh] overflow-y-auto">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-cscx-gray-700 sticky top-0 bg-cscx-gray-900 z-10">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-[#03363D] rounded-lg flex items-center justify-center">
            <svg className="w-6 h-6 text-white" viewBox="0 0 24 24" fill="currentColor">
              <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 3c1.66 0 3 1.34 3 3s-1.34 3-3 3-3-1.34-3-3 1.34-3 3-3zm0 14.2c-2.5 0-4.71-1.28-6-3.22.03-1.99 4-3.08 6-3.08 1.99 0 5.97 1.09 6 3.08-1.29 1.94-3.5 3.22-6 3.22z"/>
            </svg>
          </div>
          <div>
            <h3 className="text-lg font-semibold text-white">Zendesk Integration</h3>
            <p className="text-sm text-cscx-gray-400">Sync support tickets and metrics</p>
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

      {/* Error Message */}
      {error && (
        <div className="mx-4 mt-4 p-3 bg-red-900/20 border border-red-500/30 rounded-lg flex items-center gap-2 text-red-400 text-sm">
          <AlertCircle className="w-4 h-4 flex-shrink-0" />
          <span>{error}</span>
          <button onClick={() => setError(null)} className="ml-auto hover:text-red-300">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Loading State */}
      {loading && (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-8 h-8 text-cscx-accent animate-spin" />
        </div>
      )}

      {/* Disconnected State */}
      {!loading && !status?.connected && (
        <div className="p-4 space-y-4">
          {/* Benefits */}
          <div className="space-y-2">
            <p className="text-sm text-cscx-gray-400 font-medium">Connect to enable:</p>
            <div className="grid gap-2">
              <div className="flex items-center gap-3 p-2 bg-cscx-gray-800/50 rounded-lg">
                <TicketIcon className="w-5 h-5 text-blue-400" />
                <span className="text-cscx-gray-300">Sync support tickets to customer profiles</span>
              </div>
              <div className="flex items-center gap-3 p-2 bg-cscx-gray-800/50 rounded-lg">
                <Activity className="w-5 h-5 text-green-400" />
                <span className="text-cscx-gray-300">Track CSAT scores and resolution times</span>
              </div>
              <div className="flex items-center gap-3 p-2 bg-cscx-gray-800/50 rounded-lg">
                <AlertTriangle className="w-5 h-5 text-yellow-400" />
                <span className="text-cscx-gray-300">Get alerts on escalations and SLA breaches</span>
              </div>
              <div className="flex items-center gap-3 p-2 bg-cscx-gray-800/50 rounded-lg">
                <Users className="w-5 h-5 text-purple-400" />
                <span className="text-cscx-gray-300">Include support metrics in health scores</span>
              </div>
            </div>
          </div>

          {/* Auth Type Toggle */}
          <div className="flex gap-2">
            <button
              onClick={() => setAuthType('api_token')}
              className={`flex-1 py-2 px-3 rounded-lg text-sm font-medium transition-colors ${
                authType === 'api_token'
                  ? 'bg-cscx-accent text-white'
                  : 'bg-cscx-gray-800 text-cscx-gray-400 hover:text-white'
              }`}
            >
              <Key className="w-4 h-4 inline mr-2" />
              API Token
            </button>
            <button
              onClick={() => setAuthType('oauth')}
              className={`flex-1 py-2 px-3 rounded-lg text-sm font-medium transition-colors ${
                authType === 'oauth'
                  ? 'bg-cscx-accent text-white'
                  : 'bg-cscx-gray-800 text-cscx-gray-400 hover:text-white'
              }`}
            >
              <Link className="w-4 h-4 inline mr-2" />
              OAuth 2.0
            </button>
          </div>

          {/* Connection Form */}
          <div className="space-y-3">
            <div>
              <label className="block text-sm text-cscx-gray-400 mb-1">Zendesk Subdomain</label>
              <div className="flex items-center">
                <input
                  type="text"
                  value={subdomain}
                  onChange={(e) => setSubdomain(e.target.value)}
                  placeholder="yourcompany"
                  className="flex-1 bg-cscx-gray-800 border border-cscx-gray-700 rounded-l-lg px-3 py-2 text-white placeholder-cscx-gray-500 focus:outline-none focus:border-cscx-accent"
                />
                <span className="bg-cscx-gray-700 border border-cscx-gray-600 border-l-0 rounded-r-lg px-3 py-2 text-cscx-gray-400 text-sm">
                  .zendesk.com
                </span>
              </div>
            </div>

            {authType === 'api_token' && (
              <>
                <div>
                  <label className="block text-sm text-cscx-gray-400 mb-1">Admin Email</label>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="admin@yourcompany.com"
                    className="w-full bg-cscx-gray-800 border border-cscx-gray-700 rounded-lg px-3 py-2 text-white placeholder-cscx-gray-500 focus:outline-none focus:border-cscx-accent"
                  />
                </div>
                <div>
                  <label className="block text-sm text-cscx-gray-400 mb-1">API Token</label>
                  <input
                    type="password"
                    value={apiToken}
                    onChange={(e) => setApiToken(e.target.value)}
                    placeholder="Enter your Zendesk API token"
                    className="w-full bg-cscx-gray-800 border border-cscx-gray-700 rounded-lg px-3 py-2 text-white placeholder-cscx-gray-500 focus:outline-none focus:border-cscx-accent"
                  />
                  <p className="text-xs text-cscx-gray-500 mt-1">
                    Find your API token in Zendesk Admin &gt; Apps and Integrations &gt; Zendesk API
                  </p>
                </div>
              </>
            )}
          </div>

          {/* Connect Button */}
          <button
            onClick={handleConnect}
            disabled={connecting || !subdomain || (authType === 'api_token' && (!email || !apiToken))}
            className="w-full flex items-center justify-center gap-2 bg-[#03363D] hover:bg-[#024854] text-white font-medium py-3 px-4 rounded-lg transition-colors disabled:opacity-50"
          >
            {connecting ? (
              <Loader2 className="w-5 h-5 animate-spin" />
            ) : (
              <>
                <Link className="w-5 h-5" />
                Connect Zendesk
              </>
            )}
          </button>
        </div>
      )}

      {/* Connected State */}
      {!loading && status?.connected && (
        <>
          {/* Tabs */}
          <div className="flex border-b border-cscx-gray-700">
            {(['overview', 'alerts', 'history', 'settings'] as const).map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`flex-1 px-4 py-3 text-sm font-medium capitalize transition-colors ${
                  activeTab === tab
                    ? 'text-cscx-accent border-b-2 border-cscx-accent'
                    : 'text-cscx-gray-400 hover:text-white'
                }`}
              >
                {tab}
              </button>
            ))}
          </div>

          {/* Tab Content */}
          <div className="p-4">
            {/* Overview Tab */}
            {activeTab === 'overview' && (
              <div className="space-y-4">
                {/* Connection Status */}
                <div className="flex items-center justify-between p-3 bg-green-900/20 border border-green-500/30 rounded-lg">
                  <div className="flex items-center gap-3">
                    <CheckCircle className="w-5 h-5 text-green-500" />
                    <div>
                      <p className="text-white font-medium">Connected</p>
                      <p className="text-sm text-cscx-gray-400">
                        {status.connection?.subdomain}.zendesk.com ({status.connection?.authType === 'api_token' ? 'API Token' : 'OAuth'})
                      </p>
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

                {/* Last Sync Status */}
                {status.lastSyncAt && (
                  <div className="p-3 bg-cscx-gray-800/50 rounded-lg">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Clock className="w-4 h-4 text-cscx-gray-400" />
                        <span className="text-sm text-cscx-gray-400">Last sync:</span>
                      </div>
                      <span className="text-sm text-white">{formatDate(status.lastSyncAt)}</span>
                    </div>
                    {status.recordsSynced !== undefined && (
                      <p className="text-sm text-cscx-gray-400 mt-1">
                        {status.recordsSynced} tickets synced
                      </p>
                    )}
                  </div>
                )}

                {/* Quick Sync Actions */}
                <div className="space-y-2">
                  <p className="text-sm text-cscx-gray-400 font-medium">Quick Actions</p>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      onClick={() => handleSync(false)}
                      disabled={syncing}
                      className="flex items-center justify-center gap-2 p-3 bg-cscx-gray-800 hover:bg-cscx-gray-700 rounded-lg transition-colors disabled:opacity-50"
                    >
                      {syncing ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <RefreshCw className="w-4 h-4" />
                      )}
                      <span className="text-sm text-white">Full Sync</span>
                    </button>
                    <button
                      onClick={() => handleSync(true)}
                      disabled={syncing}
                      className="flex items-center justify-center gap-2 p-3 bg-cscx-gray-800 hover:bg-cscx-gray-700 rounded-lg transition-colors disabled:opacity-50"
                    >
                      {syncing ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <TicketIcon className="w-4 h-4" />
                      )}
                      <span className="text-sm text-white">Incremental Sync</span>
                    </button>
                  </div>
                </div>

                {/* Circuit Breaker Status */}
                {status.circuitBreaker && (
                  <div className="p-3 bg-cscx-gray-800/50 rounded-lg">
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-cscx-gray-400">API Status:</span>
                      <span
                        className={`text-sm font-medium ${
                          status.circuitBreaker.state === 'CLOSED'
                            ? 'text-green-400'
                            : status.circuitBreaker.state === 'OPEN'
                            ? 'text-red-400'
                            : 'text-yellow-400'
                        }`}
                      >
                        {status.circuitBreaker.state}
                      </span>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Alerts Tab */}
            {activeTab === 'alerts' && (
              <div className="space-y-4">
                <p className="text-sm text-cscx-gray-400">Configure which support events trigger CSM alerts:</p>

                <div className="space-y-3">
                  <label className="flex items-center justify-between p-3 bg-cscx-gray-800/50 rounded-lg cursor-pointer hover:bg-cscx-gray-800/70">
                    <div className="flex items-center gap-3">
                      <AlertTriangle className="w-5 h-5 text-red-400" />
                      <div>
                        <p className="text-white text-sm">Escalation Alerts</p>
                        <p className="text-xs text-cscx-gray-500">Alert on urgent/high priority tickets</p>
                      </div>
                    </div>
                    <input
                      type="checkbox"
                      checked={status.connection?.config?.alertConfig?.escalationAlert ?? true}
                      onChange={(e) =>
                        handleUpdateConfig({
                          alertConfig: {
                            ...status.connection?.config?.alertConfig!,
                            escalationAlert: e.target.checked,
                          },
                        })
                      }
                      className="w-5 h-5 rounded border-cscx-gray-600 bg-cscx-gray-800 text-cscx-accent focus:ring-cscx-accent"
                    />
                  </label>

                  <label className="flex items-center justify-between p-3 bg-cscx-gray-800/50 rounded-lg cursor-pointer hover:bg-cscx-gray-800/70">
                    <div className="flex items-center gap-3">
                      <Clock className="w-5 h-5 text-yellow-400" />
                      <div>
                        <p className="text-white text-sm">SLA Breach Alerts</p>
                        <p className="text-xs text-cscx-gray-500">Alert when SLA targets are missed</p>
                      </div>
                    </div>
                    <input
                      type="checkbox"
                      checked={status.connection?.config?.alertConfig?.slaBreachAlert ?? true}
                      onChange={(e) =>
                        handleUpdateConfig({
                          alertConfig: {
                            ...status.connection?.config?.alertConfig!,
                            slaBreachAlert: e.target.checked,
                          },
                        })
                      }
                      className="w-5 h-5 rounded border-cscx-gray-600 bg-cscx-gray-800 text-cscx-accent focus:ring-cscx-accent"
                    />
                  </label>

                  <label className="flex items-center justify-between p-3 bg-cscx-gray-800/50 rounded-lg cursor-pointer hover:bg-cscx-gray-800/70">
                    <div className="flex items-center gap-3">
                      <Activity className="w-5 h-5 text-orange-400" />
                      <div>
                        <p className="text-white text-sm">Ticket Spike Alerts</p>
                        <p className="text-xs text-cscx-gray-500">
                          Alert when {status.connection?.config?.alertConfig?.ticketSpikeThreshold || 3}+ tickets in 24 hours
                        </p>
                      </div>
                    </div>
                    <input
                      type="number"
                      min="1"
                      max="20"
                      value={status.connection?.config?.alertConfig?.ticketSpikeThreshold || 3}
                      onChange={(e) =>
                        handleUpdateConfig({
                          alertConfig: {
                            ...status.connection?.config?.alertConfig!,
                            ticketSpikeThreshold: parseInt(e.target.value) || 3,
                          },
                        })
                      }
                      className="w-16 bg-cscx-gray-800 border border-cscx-gray-700 rounded px-2 py-1 text-white text-center"
                    />
                  </label>

                  <label className="flex items-center justify-between p-3 bg-cscx-gray-800/50 rounded-lg cursor-pointer hover:bg-cscx-gray-800/70">
                    <div className="flex items-center gap-3">
                      <Bell className="w-5 h-5 text-blue-400" />
                      <div>
                        <p className="text-white text-sm">Negative CSAT Alerts</p>
                        <p className="text-xs text-cscx-gray-500">Alert on bad satisfaction ratings</p>
                      </div>
                    </div>
                    <input
                      type="checkbox"
                      checked={status.connection?.config?.alertConfig?.negativeCsatAlert ?? true}
                      onChange={(e) =>
                        handleUpdateConfig({
                          alertConfig: {
                            ...status.connection?.config?.alertConfig!,
                            negativeCsatAlert: e.target.checked,
                          },
                        })
                      }
                      className="w-5 h-5 rounded border-cscx-gray-600 bg-cscx-gray-800 text-cscx-accent focus:ring-cscx-accent"
                    />
                  </label>
                </div>
              </div>
            )}

            {/* History Tab */}
            {activeTab === 'history' && (
              <div className="space-y-3">
                {loadingHistory ? (
                  <div className="flex items-center justify-center py-8">
                    <Loader2 className="w-6 h-6 text-cscx-accent animate-spin" />
                  </div>
                ) : syncHistory.length === 0 ? (
                  <div className="text-center py-8 text-cscx-gray-400">
                    <History className="w-8 h-8 mx-auto mb-2 opacity-50" />
                    <p>No sync history yet</p>
                  </div>
                ) : (
                  syncHistory.map((log) => (
                    <div
                      key={log.id}
                      className="p-3 bg-cscx-gray-800/50 rounded-lg border border-cscx-gray-700"
                    >
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2">
                          {log.status === 'completed' ? (
                            <CheckCircle className="w-4 h-4 text-green-500" />
                          ) : log.status === 'failed' ? (
                            <AlertCircle className="w-4 h-4 text-red-500" />
                          ) : (
                            <Loader2 className="w-4 h-4 text-yellow-500 animate-spin" />
                          )}
                          <span className="text-sm font-medium text-white capitalize">
                            {log.sync_type} Sync
                          </span>
                        </div>
                        <span className="text-xs text-cscx-gray-400">
                          {formatDate(log.started_at)}
                        </span>
                      </div>
                      <div className="grid grid-cols-4 gap-2 text-xs">
                        <div className="text-center">
                          <p className="text-cscx-gray-400">Processed</p>
                          <p className="text-white font-medium">{log.records_processed}</p>
                        </div>
                        <div className="text-center">
                          <p className="text-cscx-gray-400">Created</p>
                          <p className="text-green-400 font-medium">{log.records_created}</p>
                        </div>
                        <div className="text-center">
                          <p className="text-cscx-gray-400">Updated</p>
                          <p className="text-blue-400 font-medium">{log.records_updated}</p>
                        </div>
                        <div className="text-center">
                          <p className="text-cscx-gray-400">Skipped</p>
                          <p className="text-cscx-gray-400 font-medium">{log.records_skipped}</p>
                        </div>
                      </div>
                      {log.error_details && log.error_details.length > 0 && (
                        <div className="mt-2 p-2 bg-red-900/20 rounded text-xs text-red-400">
                          {log.error_details.slice(0, 2).join(', ')}
                          {log.error_details.length > 2 && ` +${log.error_details.length - 2} more`}
                        </div>
                      )}
                    </div>
                  ))
                )}
              </div>
            )}

            {/* Settings Tab */}
            {activeTab === 'settings' && (
              <div className="space-y-4">
                {/* Sync Schedule */}
                <div>
                  <label className="block text-sm text-cscx-gray-400 mb-2">Sync Schedule</label>
                  <select
                    value={status.connection?.config?.syncSchedule || 'hourly'}
                    onChange={(e) =>
                      handleUpdateConfig({ syncSchedule: e.target.value as SyncConfig['syncSchedule'] })
                    }
                    className="w-full bg-cscx-gray-800 border border-cscx-gray-700 rounded-lg px-3 py-2 text-white"
                  >
                    <option value="realtime">Real-time (webhooks)</option>
                    <option value="hourly">Hourly</option>
                    <option value="daily">Daily</option>
                    <option value="manual">Manual only</option>
                  </select>
                </div>

                {/* Health Score Weight */}
                <div>
                  <label className="block text-sm text-cscx-gray-400 mb-2">
                    Health Score Weight: {status.connection?.config?.healthScoreWeight || 15}%
                  </label>
                  <input
                    type="range"
                    min="0"
                    max="50"
                    value={status.connection?.config?.healthScoreWeight || 15}
                    onChange={(e) =>
                      handleUpdateConfig({ healthScoreWeight: parseInt(e.target.value) })
                    }
                    className="w-full"
                  />
                  <p className="text-xs text-cscx-gray-500 mt-1">
                    How much support metrics affect customer health score
                  </p>
                </div>

                {/* Advanced Settings */}
                <button
                  onClick={() => setShowAdvanced(!showAdvanced)}
                  className="flex items-center gap-2 text-sm text-cscx-gray-400 hover:text-white transition-colors"
                >
                  {showAdvanced ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                  Advanced Settings
                </button>

                {showAdvanced && (
                  <div className="space-y-3 p-3 bg-cscx-gray-800/30 rounded-lg">
                    <label className="flex items-center justify-between">
                      <div>
                        <p className="text-white text-sm">Sync Open Tickets Only</p>
                        <p className="text-xs text-cscx-gray-500">Skip closed/solved tickets</p>
                      </div>
                      <input
                        type="checkbox"
                        checked={status.connection?.config?.syncOpenOnly ?? false}
                        onChange={(e) =>
                          handleUpdateConfig({ syncOpenOnly: e.target.checked })
                        }
                        className="w-5 h-5 rounded border-cscx-gray-600 bg-cscx-gray-800 text-cscx-accent focus:ring-cscx-accent"
                      />
                    </label>
                  </div>
                )}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}

export default ZendeskConnect;
