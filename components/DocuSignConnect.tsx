/**
 * DocuSign Contract Management Component - PRD-205
 *
 * Settings panel for DocuSign integration:
 * - OAuth connection (Demo + Production)
 * - Sync status and history
 * - Configuration settings
 * - Manual sync triggers
 * - Stalled contract alerts
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
  FileText,
  Clock,
  Mail,
  Users,
  AlertTriangle,
  ChevronDown,
  ChevronUp,
  Download,
  Bell,
  CheckCheck,
  ExternalLink,
} from 'lucide-react';

interface SyncStatus {
  configured: boolean;
  connected: boolean;
  lastSyncAt?: string;
  lastSyncStatus?: 'completed' | 'failed' | 'running';
  envelopesSynced?: number;
  syncErrors?: string[];
  connection?: {
    baseUri: string;
    accountId: string;
    isDemo: boolean;
    tokenValid: boolean;
    config?: SyncConfig;
  };
  circuitBreaker?: {
    state: 'CLOSED' | 'OPEN' | 'HALF_OPEN';
    failures: number;
  };
}

interface SyncConfig {
  syncSchedule: 'realtime' | 'hourly' | 'daily' | 'manual';
  matchByEmailDomain: boolean;
  matchByCustomField?: string;
  notifyOnComplete: boolean;
  notifyOnStalled: boolean;
  stalledThresholdDays: number;
}

interface SyncLog {
  id: string;
  sync_type: string;
  object_type: string;
  records_processed: number;
  records_created: number;
  records_updated: number;
  records_failed: number;
  status: string;
  started_at: string;
  completed_at: string;
  error_details?: string[];
}

interface StalledContract {
  id: string;
  envelope_id: string;
  subject: string;
  status: string;
  sent_at: string;
  customer_id: string;
  customers?: { name: string };
  recipients: Array<{
    name: string;
    email: string;
    status: string;
  }>;
}

interface DocuSignConnectProps {
  onClose?: () => void;
}

export function DocuSignConnect({ onClose }: DocuSignConnectProps) {
  const { user, getAuthHeaders } = useAuth();
  const [status, setStatus] = useState<SyncStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [connecting, setConnecting] = useState(false);
  const [disconnecting, setDisconnecting] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'overview' | 'settings' | 'history' | 'alerts'>('overview');
  const [syncHistory, setSyncHistory] = useState<SyncLog[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [stalledContracts, setStalledContracts] = useState<StalledContract[]>([]);
  const [loadingStalled, setLoadingStalled] = useState(false);
  const [useDemo, setUseDemo] = useState(false);
  const [showAdvanced, setShowAdvanced] = useState(false);

  // Config state
  const [configForm, setConfigForm] = useState<Partial<SyncConfig>>({
    syncSchedule: 'hourly',
    matchByEmailDomain: true,
    notifyOnComplete: true,
    notifyOnStalled: true,
    stalledThresholdDays: 3,
  });
  const [savingConfig, setSavingConfig] = useState(false);

  const API_URL = import.meta.env.VITE_API_URL || '';
  const userId = user?.id;

  // Fetch connection status
  const fetchStatus = useCallback(async () => {
    if (!userId) return;

    setLoading(true);
    setError(null);

    try {
      const response = await fetch(`${API_URL}/api/integrations/docusign/status?userId=${userId}`, {
        headers: getAuthHeaders(),
      });

      if (response.ok) {
        const data = await response.json();
        setStatus(data);
        if (data.connection?.config) {
          setConfigForm(data.connection.config);
        }
      } else {
        const errorData = await response.json();
        setError(errorData.error || 'Failed to check connection status');
        setStatus({ configured: false, connected: false });
      }
    } catch (err) {
      console.error('Error fetching DocuSign status:', err);
      setError('Unable to check connection status');
      setStatus({ configured: false, connected: false });
    } finally {
      setLoading(false);
    }
  }, [API_URL, userId, getAuthHeaders]);

  // Fetch sync history
  const fetchHistory = useCallback(async () => {
    if (!userId || !status?.connected) return;

    setLoadingHistory(true);
    try {
      const response = await fetch(`${API_URL}/api/integrations/docusign/history?userId=${userId}&limit=10`, {
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

  // Fetch stalled contracts
  const fetchStalledContracts = useCallback(async () => {
    if (!userId || !status?.connected) return;

    setLoadingStalled(true);
    try {
      const response = await fetch(
        `${API_URL}/api/docusign/stalled?userId=${userId}&thresholdDays=${configForm.stalledThresholdDays || 3}`,
        { headers: getAuthHeaders() }
      );

      if (response.ok) {
        const data = await response.json();
        setStalledContracts(data.stalledContracts || []);
      }
    } catch (err) {
      console.error('Error fetching stalled contracts:', err);
    } finally {
      setLoadingStalled(false);
    }
  }, [API_URL, userId, status?.connected, configForm.stalledThresholdDays, getAuthHeaders]);

  useEffect(() => {
    fetchStatus();
  }, [fetchStatus]);

  useEffect(() => {
    if (activeTab === 'history' && status?.connected) {
      fetchHistory();
    }
    if (activeTab === 'alerts' && status?.connected) {
      fetchStalledContracts();
    }
  }, [activeTab, status?.connected, fetchHistory, fetchStalledContracts]);

  // Check URL params for OAuth callback result
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const success = params.get('success');
    const errorParam = params.get('error');

    if (success === 'docusign_connected') {
      fetchStatus();
      window.history.replaceState({}, '', window.location.pathname);
    } else if (errorParam) {
      setError(`Connection failed: ${errorParam}`);
      window.history.replaceState({}, '', window.location.pathname);
    }
  }, [fetchStatus]);

  // Handle connect
  const handleConnect = async () => {
    if (!userId) return;

    setConnecting(true);
    setError(null);

    try {
      const response = await fetch(`${API_URL}/api/integrations/docusign/connect`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...getAuthHeaders(),
        },
        body: JSON.stringify({ userId, isDemo: useDemo }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to initiate connection');
      }

      const data = await response.json();
      // Redirect to DocuSign OAuth
      window.location.href = data.authUrl;
    } catch (err) {
      console.error('Error connecting to DocuSign:', err);
      setError((err as Error).message);
      setConnecting(false);
    }
  };

  // Handle disconnect
  const handleDisconnect = async () => {
    if (!userId || !confirm('Are you sure you want to disconnect DocuSign?')) return;

    setDisconnecting(true);
    setError(null);

    try {
      const response = await fetch(`${API_URL}/api/integrations/docusign/disconnect`, {
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
      console.error('Error disconnecting from DocuSign:', err);
      setError((err as Error).message);
    } finally {
      setDisconnecting(false);
    }
  };

  // Handle manual sync
  const handleSync = async (incremental: boolean = false) => {
    if (!userId) return;

    setSyncing(true);
    setError(null);

    try {
      const response = await fetch(`${API_URL}/api/integrations/docusign/sync`, {
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
      await fetchStatus();
      if (activeTab === 'history') {
        await fetchHistory();
      }
    } catch (err) {
      console.error('Error syncing:', err);
      setError((err as Error).message);
    } finally {
      setSyncing(false);
    }
  };

  // Handle config save
  const handleSaveConfig = async () => {
    if (!userId) return;

    setSavingConfig(true);
    setError(null);

    try {
      const response = await fetch(`${API_URL}/api/integrations/docusign/config`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          ...getAuthHeaders(),
        },
        body: JSON.stringify({ userId, config: configForm }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to save configuration');
      }

      await fetchStatus();
    } catch (err) {
      console.error('Error saving config:', err);
      setError((err as Error).message);
    } finally {
      setSavingConfig(false);
    }
  };

  // Handle send reminder
  const handleSendReminder = async (envelopeId: string) => {
    if (!userId) return;

    try {
      const response = await fetch(`${API_URL}/api/docusign/remind/${envelopeId}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...getAuthHeaders(),
        },
        body: JSON.stringify({ userId }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to send reminder');
      }

      // Show success feedback
      alert('Reminder sent successfully');
    } catch (err) {
      console.error('Error sending reminder:', err);
      setError((err as Error).message);
    }
  };

  // Format date
  const formatDate = (dateString: string | undefined) => {
    if (!dateString) return 'Never';
    return new Date(dateString).toLocaleString();
  };

  // Format relative time
  const formatRelativeTime = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffDays = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24));
    if (diffDays === 0) return 'Today';
    if (diffDays === 1) return 'Yesterday';
    return `${diffDays} days ago`;
  };

  // Render loading state
  if (loading) {
    return (
      <div className="bg-cscx-gray-900 rounded-xl p-6 border border-white/10">
        <div className="flex items-center justify-center gap-3 py-8">
          <Loader2 className="w-5 h-5 animate-spin text-cscx-accent" />
          <span className="text-gray-400">Loading DocuSign integration...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-cscx-gray-900 rounded-xl border border-white/10 overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-white/10">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-yellow-500/10 rounded-lg">
            <FileText className="w-5 h-5 text-yellow-500" />
          </div>
          <div>
            <h3 className="font-semibold text-white">DocuSign</h3>
            <p className="text-sm text-gray-400">Contract management and e-signatures</p>
          </div>
        </div>
        {onClose && (
          <button onClick={onClose} className="text-gray-400 hover:text-white">
            <X className="w-5 h-5" />
          </button>
        )}
      </div>

      {/* Error display */}
      {error && (
        <div className="mx-4 mt-4 p-3 bg-red-500/10 border border-red-500/30 rounded-lg flex items-start gap-2">
          <AlertCircle className="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5" />
          <p className="text-sm text-red-400">{error}</p>
        </div>
      )}

      {/* Not configured state */}
      {!status?.configured && (
        <div className="p-6">
          <div className="text-center py-8">
            <AlertTriangle className="w-12 h-12 text-yellow-500 mx-auto mb-4" />
            <h4 className="text-lg font-medium text-white mb-2">Integration Not Configured</h4>
            <p className="text-gray-400 mb-4">
              DocuSign integration requires environment variables to be set.
            </p>
            <code className="text-sm text-gray-500 bg-cscx-gray-800 px-3 py-1 rounded">
              DOCUSIGN_CLIENT_ID, DOCUSIGN_CLIENT_SECRET
            </code>
          </div>
        </div>
      )}

      {/* Configured but not connected */}
      {status?.configured && !status?.connected && (
        <div className="p-6">
          <div className="text-center py-6">
            <div className="p-3 bg-cscx-gray-800 rounded-full w-fit mx-auto mb-4">
              <Link className="w-8 h-8 text-gray-400" />
            </div>
            <h4 className="text-lg font-medium text-white mb-2">Connect DocuSign</h4>
            <p className="text-gray-400 mb-6 max-w-md mx-auto">
              Connect your DocuSign account to track contract status, receive alerts when contracts are signed, and send signature reminders.
            </p>

            {/* Environment toggle */}
            <div className="flex items-center justify-center gap-3 mb-6">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={useDemo}
                  onChange={(e) => setUseDemo(e.target.checked)}
                  className="rounded border-gray-600 bg-cscx-gray-800 text-cscx-accent focus:ring-cscx-accent"
                />
                <span className="text-sm text-gray-400">Use Demo Environment</span>
              </label>
            </div>

            <button
              onClick={handleConnect}
              disabled={connecting}
              className="px-6 py-2.5 bg-cscx-accent text-white rounded-lg hover:bg-cscx-accent/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 mx-auto"
            >
              {connecting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Connecting...
                </>
              ) : (
                <>
                  <Link className="w-4 h-4" />
                  Connect DocuSign
                </>
              )}
            </button>
          </div>
        </div>
      )}

      {/* Connected state */}
      {status?.configured && status?.connected && (
        <>
          {/* Tabs */}
          <div className="flex border-b border-white/10">
            {(['overview', 'settings', 'history', 'alerts'] as const).map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`px-4 py-3 text-sm font-medium capitalize transition-colors relative ${
                  activeTab === tab
                    ? 'text-cscx-accent'
                    : 'text-gray-400 hover:text-white'
                }`}
              >
                {tab}
                {activeTab === tab && (
                  <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-cscx-accent" />
                )}
                {tab === 'alerts' && stalledContracts.length > 0 && (
                  <span className="ml-1.5 px-1.5 py-0.5 text-xs bg-yellow-500/20 text-yellow-400 rounded-full">
                    {stalledContracts.length}
                  </span>
                )}
              </button>
            ))}
          </div>

          {/* Tab content */}
          <div className="p-4">
            {/* Overview Tab */}
            {activeTab === 'overview' && (
              <div className="space-y-4">
                {/* Connection status */}
                <div className="bg-cscx-gray-800 rounded-lg p-4">
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-2">
                      <CheckCircle className="w-5 h-5 text-green-500" />
                      <span className="text-white font-medium">Connected</span>
                      {status.connection?.isDemo && (
                        <span className="text-xs bg-yellow-500/20 text-yellow-400 px-2 py-0.5 rounded">
                          Demo
                        </span>
                      )}
                    </div>
                    <button
                      onClick={handleDisconnect}
                      disabled={disconnecting}
                      className="text-sm text-red-400 hover:text-red-300 flex items-center gap-1"
                    >
                      {disconnecting ? (
                        <Loader2 className="w-3 h-3 animate-spin" />
                      ) : (
                        <Unlink className="w-3 h-3" />
                      )}
                      Disconnect
                    </button>
                  </div>

                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <span className="text-gray-500">Account ID</span>
                      <p className="text-gray-300 font-mono text-xs mt-1">
                        {status.connection?.accountId}
                      </p>
                    </div>
                    <div>
                      <span className="text-gray-500">Token Status</span>
                      <p className={`mt-1 ${status.connection?.tokenValid ? 'text-green-400' : 'text-red-400'}`}>
                        {status.connection?.tokenValid ? 'Valid' : 'Expired'}
                      </p>
                    </div>
                  </div>
                </div>

                {/* Sync status */}
                <div className="bg-cscx-gray-800 rounded-lg p-4">
                  <div className="flex items-center justify-between mb-4">
                    <h4 className="text-white font-medium">Sync Status</h4>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => handleSync(true)}
                        disabled={syncing}
                        className="text-sm text-cscx-accent hover:text-cscx-accent/80 flex items-center gap-1"
                      >
                        {syncing ? (
                          <Loader2 className="w-3 h-3 animate-spin" />
                        ) : (
                          <RefreshCw className="w-3 h-3" />
                        )}
                        Sync Now
                      </button>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <span className="text-gray-500">Last Sync</span>
                      <p className="text-gray-300 mt-1">{formatDate(status.lastSyncAt)}</p>
                    </div>
                    <div>
                      <span className="text-gray-500">Last Status</span>
                      <p className={`mt-1 capitalize ${
                        status.lastSyncStatus === 'completed' ? 'text-green-400' :
                        status.lastSyncStatus === 'failed' ? 'text-red-400' :
                        'text-yellow-400'
                      }`}>
                        {status.lastSyncStatus || 'Never synced'}
                      </p>
                    </div>
                    <div>
                      <span className="text-gray-500">Envelopes Synced</span>
                      <p className="text-gray-300 mt-1">{status.envelopesSynced || 0}</p>
                    </div>
                    <div>
                      <span className="text-gray-500">Sync Schedule</span>
                      <p className="text-gray-300 mt-1 capitalize">
                        {status.connection?.config?.syncSchedule || 'Hourly'}
                      </p>
                    </div>
                  </div>
                </div>

                {/* Circuit breaker status */}
                {status.circuitBreaker && (
                  <div className="bg-cscx-gray-800 rounded-lg p-4">
                    <div className="flex items-center justify-between">
                      <span className="text-gray-500 text-sm">API Health</span>
                      <span className={`text-sm ${
                        status.circuitBreaker.state === 'CLOSED' ? 'text-green-400' :
                        status.circuitBreaker.state === 'OPEN' ? 'text-red-400' :
                        'text-yellow-400'
                      }`}>
                        {status.circuitBreaker.state}
                      </span>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Settings Tab */}
            {activeTab === 'settings' && (
              <div className="space-y-4">
                {/* Sync schedule */}
                <div className="bg-cscx-gray-800 rounded-lg p-4">
                  <h4 className="text-white font-medium mb-3">Sync Schedule</h4>
                  <select
                    value={configForm.syncSchedule}
                    onChange={(e) => setConfigForm({ ...configForm, syncSchedule: e.target.value as SyncConfig['syncSchedule'] })}
                    className="w-full bg-cscx-gray-900 border border-white/10 rounded-lg px-3 py-2 text-white text-sm"
                  >
                    <option value="realtime">Real-time (via webhooks)</option>
                    <option value="hourly">Hourly</option>
                    <option value="daily">Daily</option>
                    <option value="manual">Manual only</option>
                  </select>
                </div>

                {/* Customer matching */}
                <div className="bg-cscx-gray-800 rounded-lg p-4">
                  <h4 className="text-white font-medium mb-3">Customer Matching</h4>
                  <label className="flex items-center gap-2 cursor-pointer mb-3">
                    <input
                      type="checkbox"
                      checked={configForm.matchByEmailDomain}
                      onChange={(e) => setConfigForm({ ...configForm, matchByEmailDomain: e.target.checked })}
                      className="rounded border-gray-600 bg-cscx-gray-900 text-cscx-accent focus:ring-cscx-accent"
                    />
                    <span className="text-sm text-gray-300">Match by recipient email domain</span>
                  </label>
                  <div>
                    <label className="text-sm text-gray-500 block mb-1">Custom Field Name (optional)</label>
                    <input
                      type="text"
                      value={configForm.matchByCustomField || ''}
                      onChange={(e) => setConfigForm({ ...configForm, matchByCustomField: e.target.value })}
                      placeholder="e.g., CustomerId"
                      className="w-full bg-cscx-gray-900 border border-white/10 rounded-lg px-3 py-2 text-white text-sm"
                    />
                  </div>
                </div>

                {/* Notifications */}
                <div className="bg-cscx-gray-800 rounded-lg p-4">
                  <h4 className="text-white font-medium mb-3">Notifications</h4>
                  <div className="space-y-3">
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={configForm.notifyOnComplete}
                        onChange={(e) => setConfigForm({ ...configForm, notifyOnComplete: e.target.checked })}
                        className="rounded border-gray-600 bg-cscx-gray-900 text-cscx-accent focus:ring-cscx-accent"
                      />
                      <span className="text-sm text-gray-300">Notify when contracts are completed</span>
                    </label>
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={configForm.notifyOnStalled}
                        onChange={(e) => setConfigForm({ ...configForm, notifyOnStalled: e.target.checked })}
                        className="rounded border-gray-600 bg-cscx-gray-900 text-cscx-accent focus:ring-cscx-accent"
                      />
                      <span className="text-sm text-gray-300">Notify when contracts are stalled</span>
                    </label>
                    <div className="flex items-center gap-2">
                      <label className="text-sm text-gray-500">Stalled threshold:</label>
                      <input
                        type="number"
                        min="1"
                        max="30"
                        value={configForm.stalledThresholdDays}
                        onChange={(e) => setConfigForm({ ...configForm, stalledThresholdDays: parseInt(e.target.value) })}
                        className="w-16 bg-cscx-gray-900 border border-white/10 rounded px-2 py-1 text-white text-sm"
                      />
                      <span className="text-sm text-gray-500">days</span>
                    </div>
                  </div>
                </div>

                {/* Save button */}
                <button
                  onClick={handleSaveConfig}
                  disabled={savingConfig}
                  className="w-full py-2 bg-cscx-accent text-white rounded-lg hover:bg-cscx-accent/90 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {savingConfig ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Saving...
                    </>
                  ) : (
                    <>
                      <Settings className="w-4 h-4" />
                      Save Configuration
                    </>
                  )}
                </button>
              </div>
            )}

            {/* History Tab */}
            {activeTab === 'history' && (
              <div className="space-y-3">
                {loadingHistory ? (
                  <div className="flex items-center justify-center py-8">
                    <Loader2 className="w-5 h-5 animate-spin text-cscx-accent" />
                  </div>
                ) : syncHistory.length === 0 ? (
                  <div className="text-center py-8">
                    <History className="w-8 h-8 text-gray-600 mx-auto mb-2" />
                    <p className="text-gray-500">No sync history yet</p>
                  </div>
                ) : (
                  syncHistory.map((log) => (
                    <div key={log.id} className="bg-cscx-gray-800 rounded-lg p-3">
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2">
                          {log.status === 'completed' ? (
                            <CheckCircle className="w-4 h-4 text-green-500" />
                          ) : log.status === 'failed' ? (
                            <AlertCircle className="w-4 h-4 text-red-500" />
                          ) : (
                            <Loader2 className="w-4 h-4 text-yellow-500 animate-spin" />
                          )}
                          <span className="text-sm text-white capitalize">{log.sync_type} Sync</span>
                        </div>
                        <span className="text-xs text-gray-500">{formatDate(log.started_at)}</span>
                      </div>
                      <div className="grid grid-cols-4 gap-2 text-xs">
                        <div>
                          <span className="text-gray-500">Processed</span>
                          <p className="text-gray-300">{log.records_processed}</p>
                        </div>
                        <div>
                          <span className="text-gray-500">Created</span>
                          <p className="text-green-400">{log.records_created}</p>
                        </div>
                        <div>
                          <span className="text-gray-500">Updated</span>
                          <p className="text-blue-400">{log.records_updated}</p>
                        </div>
                        <div>
                          <span className="text-gray-500">Failed</span>
                          <p className={log.records_failed > 0 ? 'text-red-400' : 'text-gray-400'}>
                            {log.records_failed}
                          </p>
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            )}

            {/* Alerts Tab */}
            {activeTab === 'alerts' && (
              <div className="space-y-3">
                {loadingStalled ? (
                  <div className="flex items-center justify-center py-8">
                    <Loader2 className="w-5 h-5 animate-spin text-cscx-accent" />
                  </div>
                ) : stalledContracts.length === 0 ? (
                  <div className="text-center py-8">
                    <CheckCheck className="w-8 h-8 text-green-500 mx-auto mb-2" />
                    <p className="text-gray-400">No stalled contracts</p>
                    <p className="text-sm text-gray-500 mt-1">All contracts are progressing normally</p>
                  </div>
                ) : (
                  stalledContracts.map((contract) => (
                    <div key={contract.id} className="bg-cscx-gray-800 rounded-lg p-4">
                      <div className="flex items-start justify-between mb-3">
                        <div>
                          <h5 className="text-white font-medium">{contract.subject}</h5>
                          <p className="text-sm text-gray-500">
                            {contract.customers?.name || 'Unknown Customer'}
                          </p>
                        </div>
                        <span className="text-xs bg-yellow-500/20 text-yellow-400 px-2 py-1 rounded">
                          {formatRelativeTime(contract.sent_at)}
                        </span>
                      </div>

                      {/* Recipients */}
                      <div className="mb-3">
                        <span className="text-xs text-gray-500">Recipients:</span>
                        <div className="flex flex-wrap gap-2 mt-1">
                          {contract.recipients?.map((r, i) => (
                            <span
                              key={i}
                              className={`text-xs px-2 py-1 rounded ${
                                r.status === 'signed' ? 'bg-green-500/20 text-green-400' :
                                r.status === 'delivered' ? 'bg-blue-500/20 text-blue-400' :
                                'bg-gray-500/20 text-gray-400'
                              }`}
                            >
                              {r.name} ({r.status})
                            </span>
                          ))}
                        </div>
                      </div>

                      {/* Actions */}
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => handleSendReminder(contract.envelope_id)}
                          className="text-xs text-cscx-accent hover:text-cscx-accent/80 flex items-center gap-1"
                        >
                          <Mail className="w-3 h-3" />
                          Send Reminder
                        </button>
                        <a
                          href={`https://app.docusign.com/documents/details/${contract.envelope_id}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-xs text-gray-400 hover:text-white flex items-center gap-1"
                        >
                          <ExternalLink className="w-3 h-3" />
                          View in DocuSign
                        </a>
                      </div>
                    </div>
                  ))
                )}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}

export default DocuSignConnect;
