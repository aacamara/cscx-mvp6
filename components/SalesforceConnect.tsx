/**
 * Salesforce Integration Component - PRD-181
 *
 * Settings panel for Salesforce bi-directional sync:
 * - OAuth connection (Production + Sandbox)
 * - Sync status and history
 * - Field mapping configuration
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
  ArrowRight,
  ArrowLeft,
  ArrowLeftRight,
  Clock,
  Database,
  Users,
  Activity,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';

interface SyncStatus {
  configured: boolean;
  connected: boolean;
  lastSyncAt?: string;
  lastSyncStatus?: 'completed' | 'failed' | 'running';
  recordsSynced?: number;
  syncErrors?: string[];
  connection?: {
    instanceUrl: string;
    isSandbox: boolean;
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
  conflictResolution: 'salesforce_wins' | 'cscx_wins' | 'most_recent' | 'manual_review';
  healthScoreField: string;
  healthTrendField: string;
  fieldMappings: FieldMapping[];
}

interface FieldMapping {
  salesforceField: string;
  cscxField: string;
  direction: 'salesforce_to_cscx' | 'cscx_to_salesforce' | 'bidirectional';
  transform?: string;
}

interface SyncLog {
  id: string;
  sync_type: string;
  direction: string;
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

interface SalesforceConnectProps {
  onClose?: () => void;
}

export function SalesforceConnect({ onClose }: SalesforceConnectProps) {
  const { user, getAuthHeaders } = useAuth();
  const [status, setStatus] = useState<SyncStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [connecting, setConnecting] = useState(false);
  const [disconnecting, setDisconnecting] = useState(false);
  const [syncing, setSyncing] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'overview' | 'mappings' | 'history' | 'settings'>('overview');
  const [syncHistory, setSyncHistory] = useState<SyncLog[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [useSandbox, setUseSandbox] = useState(false);
  const [showAdvanced, setShowAdvanced] = useState(false);

  const API_URL = import.meta.env.VITE_API_URL || '';
  const userId = user?.id;

  // Fetch connection status
  const fetchStatus = useCallback(async () => {
    if (!userId) return;

    setLoading(true);
    setError(null);

    try {
      const response = await fetch(`${API_URL}/api/integrations/salesforce/status?userId=${userId}`, {
        headers: getAuthHeaders(),
      });

      if (response.ok) {
        const data = await response.json();
        setStatus(data);
      } else {
        const errorData = await response.json();
        setError(errorData.error || 'Failed to check connection status');
        setStatus({ configured: false, connected: false });
      }
    } catch (err) {
      console.error('Error fetching Salesforce status:', err);
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
      const response = await fetch(`${API_URL}/api/integrations/salesforce/history?userId=${userId}&limit=10`, {
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

    if (success === 'salesforce_connected') {
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
      const response = await fetch(`${API_URL}/api/integrations/salesforce/connect`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...getAuthHeaders(),
        },
        body: JSON.stringify({ userId, isSandbox: useSandbox }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to initiate connection');
      }

      const data = await response.json();

      if (data.authUrl) {
        window.location.href = data.authUrl;
      } else {
        throw new Error('No OAuth URL returned');
      }
    } catch (err) {
      console.error('Error connecting Salesforce:', err);
      setError(err instanceof Error ? err.message : 'Failed to connect');
      setConnecting(false);
    }
  };

  // Handle disconnect
  const handleDisconnect = async () => {
    if (!userId) return;

    if (!confirm('Are you sure you want to disconnect Salesforce? Synced data will remain but no new syncs will occur.')) {
      return;
    }

    setDisconnecting(true);
    setError(null);

    try {
      const response = await fetch(`${API_URL}/api/integrations/salesforce/disconnect`, {
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
      console.error('Error disconnecting Salesforce:', err);
      setError(err instanceof Error ? err.message : 'Failed to disconnect');
    } finally {
      setDisconnecting(false);
    }
  };

  // Handle sync
  const handleSync = async (syncType: 'full' | 'accounts' | 'contacts' | 'health_scores') => {
    if (!userId) return;

    setSyncing(syncType);
    setError(null);

    try {
      const response = await fetch(`${API_URL}/api/integrations/salesforce/sync`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...getAuthHeaders(),
        },
        body: JSON.stringify({ userId, syncType }),
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
      setSyncing(null);
    }
  };

  // Update config
  const handleUpdateConfig = async (config: Partial<SyncConfig>) => {
    if (!userId) return;

    try {
      const response = await fetch(`${API_URL}/api/integrations/salesforce/config`, {
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

  const getDirectionIcon = (direction: string) => {
    switch (direction) {
      case 'salesforce_to_cscx':
        return <ArrowRight className="w-4 h-4 text-blue-400" />;
      case 'cscx_to_salesforce':
        return <ArrowLeft className="w-4 h-4 text-green-400" />;
      case 'bidirectional':
        return <ArrowLeftRight className="w-4 h-4 text-purple-400" />;
      default:
        return null;
    }
  };

  return (
    <div className="bg-cscx-gray-900 rounded-xl border border-cscx-gray-700 overflow-hidden max-h-[80vh] overflow-y-auto">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-cscx-gray-700 sticky top-0 bg-cscx-gray-900 z-10">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-[#00A1E0] rounded-lg flex items-center justify-center">
            <svg className="w-6 h-6 text-white" viewBox="0 0 24 24" fill="currentColor">
              <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 17.93c-3.95-.49-7-3.85-7-7.93 0-.62.08-1.21.21-1.79L9 15v1c0 1.1.9 2 2 2v1.93zm6.9-2.54c-.26-.81-1-1.39-1.9-1.39h-1v-3c0-.55-.45-1-1-1H8v-2h2c.55 0 1-.45 1-1V7h2c1.1 0 2-.9 2-2v-.41c2.93 1.19 5 4.06 5 7.41 0 2.08-.8 3.97-2.1 5.39z"/>
            </svg>
          </div>
          <div>
            <h3 className="text-lg font-semibold text-white">Salesforce Integration</h3>
            <p className="text-sm text-cscx-gray-400">Bi-directional sync with your CRM</p>
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

      {/* Not Configured State */}
      {!loading && !status?.configured && (
        <div className="p-6 text-center">
          <AlertCircle className="w-12 h-12 text-yellow-500 mx-auto mb-4" />
          <h4 className="text-lg font-medium text-white mb-2">Not Configured</h4>
          <p className="text-cscx-gray-400 text-sm">
            Salesforce integration requires SALESFORCE_CLIENT_ID and SALESFORCE_CLIENT_SECRET environment variables.
          </p>
        </div>
      )}

      {/* Disconnected State */}
      {!loading && status?.configured && !status.connected && (
        <div className="p-4 space-y-4">
          {/* Benefits */}
          <div className="space-y-2">
            <p className="text-sm text-cscx-gray-400 font-medium">Connect to enable:</p>
            <div className="grid gap-2">
              <div className="flex items-center gap-3 p-2 bg-cscx-gray-800/50 rounded-lg">
                <Database className="w-5 h-5 text-blue-400" />
                <span className="text-cscx-gray-300">Pull Account data to CSCX.AI</span>
              </div>
              <div className="flex items-center gap-3 p-2 bg-cscx-gray-800/50 rounded-lg">
                <Users className="w-5 h-5 text-green-400" />
                <span className="text-cscx-gray-300">Sync Contacts as Stakeholders</span>
              </div>
              <div className="flex items-center gap-3 p-2 bg-cscx-gray-800/50 rounded-lg">
                <Activity className="w-5 h-5 text-purple-400" />
                <span className="text-cscx-gray-300">Push Health Scores to Salesforce</span>
              </div>
            </div>
          </div>

          {/* Environment Toggle */}
          <div className="flex items-center gap-3 p-3 bg-cscx-gray-800/50 rounded-lg">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={useSandbox}
                onChange={(e) => setUseSandbox(e.target.checked)}
                className="w-4 h-4 rounded border-cscx-gray-600 bg-cscx-gray-800 text-cscx-accent focus:ring-cscx-accent"
              />
              <span className="text-sm text-cscx-gray-300">Connect to Sandbox environment</span>
            </label>
          </div>

          {/* Connect Button */}
          <button
            onClick={handleConnect}
            disabled={connecting}
            className="w-full flex items-center justify-center gap-2 bg-[#00A1E0] hover:bg-[#0085BC] text-white font-medium py-3 px-4 rounded-lg transition-colors disabled:opacity-50"
          >
            {connecting ? (
              <Loader2 className="w-5 h-5 animate-spin" />
            ) : (
              <>
                <Link className="w-5 h-5" />
                Connect Salesforce
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
            {(['overview', 'mappings', 'history', 'settings'] as const).map((tab) => (
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
                        {status.connection?.isSandbox ? 'Sandbox' : 'Production'} - {status.connection?.instanceUrl}
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
                        {status.recordsSynced} records synced
                      </p>
                    )}
                  </div>
                )}

                {/* Quick Sync Actions */}
                <div className="space-y-2">
                  <p className="text-sm text-cscx-gray-400 font-medium">Quick Actions</p>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      onClick={() => handleSync('full')}
                      disabled={syncing !== null}
                      className="flex items-center justify-center gap-2 p-3 bg-cscx-gray-800 hover:bg-cscx-gray-700 rounded-lg transition-colors disabled:opacity-50"
                    >
                      {syncing === 'full' ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <RefreshCw className="w-4 h-4" />
                      )}
                      <span className="text-sm text-white">Full Sync</span>
                    </button>
                    <button
                      onClick={() => handleSync('accounts')}
                      disabled={syncing !== null}
                      className="flex items-center justify-center gap-2 p-3 bg-cscx-gray-800 hover:bg-cscx-gray-700 rounded-lg transition-colors disabled:opacity-50"
                    >
                      {syncing === 'accounts' ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <Database className="w-4 h-4" />
                      )}
                      <span className="text-sm text-white">Sync Accounts</span>
                    </button>
                    <button
                      onClick={() => handleSync('contacts')}
                      disabled={syncing !== null}
                      className="flex items-center justify-center gap-2 p-3 bg-cscx-gray-800 hover:bg-cscx-gray-700 rounded-lg transition-colors disabled:opacity-50"
                    >
                      {syncing === 'contacts' ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <Users className="w-4 h-4" />
                      )}
                      <span className="text-sm text-white">Sync Contacts</span>
                    </button>
                    <button
                      onClick={() => handleSync('health_scores')}
                      disabled={syncing !== null}
                      className="flex items-center justify-center gap-2 p-3 bg-cscx-gray-800 hover:bg-cscx-gray-700 rounded-lg transition-colors disabled:opacity-50"
                    >
                      {syncing === 'health_scores' ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <Activity className="w-4 h-4" />
                      )}
                      <span className="text-sm text-white">Push Health Scores</span>
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

            {/* Mappings Tab */}
            {activeTab === 'mappings' && (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <p className="text-sm text-cscx-gray-400 font-medium">Field Mappings</p>
                  <div className="flex gap-2 text-xs">
                    <span className="flex items-center gap-1 text-blue-400">
                      <ArrowRight className="w-3 h-3" /> Pull
                    </span>
                    <span className="flex items-center gap-1 text-green-400">
                      <ArrowLeft className="w-3 h-3" /> Push
                    </span>
                    <span className="flex items-center gap-1 text-purple-400">
                      <ArrowLeftRight className="w-3 h-3" /> Bi-dir
                    </span>
                  </div>
                </div>

                <div className="space-y-2">
                  {status.connection?.config?.fieldMappings?.map((mapping, index) => (
                    <div
                      key={index}
                      className="flex items-center justify-between p-3 bg-cscx-gray-800/50 rounded-lg"
                    >
                      <div className="flex items-center gap-3">
                        <span className="text-sm text-cscx-gray-300 font-mono">
                          {mapping.salesforceField}
                        </span>
                        {getDirectionIcon(mapping.direction)}
                        <span className="text-sm text-cscx-gray-300 font-mono">
                          {mapping.cscxField}
                        </span>
                      </div>
                      {mapping.transform && mapping.transform !== 'none' && (
                        <span className="text-xs text-cscx-gray-500 bg-cscx-gray-700 px-2 py-1 rounded">
                          {mapping.transform}
                        </span>
                      )}
                    </div>
                  ))}
                </div>

                <p className="text-xs text-cscx-gray-500">
                  Custom field mappings can be configured via API. Contact support for advanced mapping requirements.
                </p>
              </div>
            )}

            {/* History Tab */}
            {activeTab === 'history' && (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <p className="text-sm text-cscx-gray-400 font-medium">Sync History</p>
                  <button
                    onClick={fetchHistory}
                    disabled={loadingHistory}
                    className="text-sm text-cscx-accent hover:text-cscx-accent/80"
                  >
                    {loadingHistory ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <RefreshCw className="w-4 h-4" />
                    )}
                  </button>
                </div>

                {loadingHistory ? (
                  <div className="flex justify-center py-8">
                    <Loader2 className="w-6 h-6 text-cscx-accent animate-spin" />
                  </div>
                ) : syncHistory.length === 0 ? (
                  <p className="text-sm text-cscx-gray-500 text-center py-8">
                    No sync history yet. Trigger a sync to see results here.
                  </p>
                ) : (
                  <div className="space-y-2">
                    {syncHistory.map((log) => (
                      <div
                        key={log.id}
                        className="p-3 bg-cscx-gray-800/50 rounded-lg space-y-2"
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <span
                              className={`w-2 h-2 rounded-full ${
                                log.status === 'completed'
                                  ? 'bg-green-500'
                                  : log.status === 'failed'
                                  ? 'bg-red-500'
                                  : 'bg-yellow-500'
                              }`}
                            />
                            <span className="text-sm text-white capitalize">
                              {log.sync_type} - {log.object_type}
                            </span>
                          </div>
                          <span className="text-xs text-cscx-gray-500">
                            {formatDate(log.started_at)}
                          </span>
                        </div>
                        <div className="flex gap-4 text-xs text-cscx-gray-400">
                          <span>Processed: {log.records_processed}</span>
                          <span className="text-green-400">Created: {log.records_created}</span>
                          <span className="text-blue-400">Updated: {log.records_updated}</span>
                          {log.records_failed > 0 && (
                            <span className="text-red-400">Failed: {log.records_failed}</span>
                          )}
                        </div>
                        {log.error_details && log.error_details.length > 0 && (
                          <div className="text-xs text-red-400 bg-red-900/20 p-2 rounded">
                            {log.error_details.slice(0, 3).join(', ')}
                            {log.error_details.length > 3 && ` +${log.error_details.length - 3} more`}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Settings Tab */}
            {activeTab === 'settings' && (
              <div className="space-y-4">
                {/* Sync Schedule */}
                <div className="space-y-2">
                  <label className="text-sm text-cscx-gray-400 font-medium">Sync Schedule</label>
                  <select
                    value={status.connection?.config?.syncSchedule || 'hourly'}
                    onChange={(e) => handleUpdateConfig({ syncSchedule: e.target.value as SyncConfig['syncSchedule'] })}
                    className="w-full bg-cscx-gray-800 border border-cscx-gray-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:ring-2 focus:ring-cscx-accent"
                  >
                    <option value="manual">Manual only</option>
                    <option value="hourly">Hourly</option>
                    <option value="daily">Daily</option>
                    <option value="realtime">Real-time (webhook)</option>
                  </select>
                </div>

                {/* Conflict Resolution */}
                <div className="space-y-2">
                  <label className="text-sm text-cscx-gray-400 font-medium">Conflict Resolution</label>
                  <select
                    value={status.connection?.config?.conflictResolution || 'salesforce_wins'}
                    onChange={(e) => handleUpdateConfig({ conflictResolution: e.target.value as SyncConfig['conflictResolution'] })}
                    className="w-full bg-cscx-gray-800 border border-cscx-gray-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:ring-2 focus:ring-cscx-accent"
                  >
                    <option value="salesforce_wins">Salesforce wins (default)</option>
                    <option value="cscx_wins">CSCX.AI wins</option>
                    <option value="most_recent">Most recent wins</option>
                    <option value="manual_review">Manual review required</option>
                  </select>
                </div>

                {/* Advanced Settings */}
                <button
                  onClick={() => setShowAdvanced(!showAdvanced)}
                  className="flex items-center gap-2 text-sm text-cscx-gray-400 hover:text-white"
                >
                  {showAdvanced ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                  Advanced Settings
                </button>

                {showAdvanced && (
                  <div className="space-y-4 p-4 bg-cscx-gray-800/50 rounded-lg">
                    {/* Health Score Field */}
                    <div className="space-y-2">
                      <label className="text-sm text-cscx-gray-400">Health Score Field (Salesforce)</label>
                      <input
                        type="text"
                        value={status.connection?.config?.healthScoreField || 'Health_Score__c'}
                        onChange={(e) => handleUpdateConfig({ healthScoreField: e.target.value })}
                        className="w-full bg-cscx-gray-800 border border-cscx-gray-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:ring-2 focus:ring-cscx-accent font-mono"
                        placeholder="Health_Score__c"
                      />
                    </div>

                    {/* Health Trend Field */}
                    <div className="space-y-2">
                      <label className="text-sm text-cscx-gray-400">Health Trend Field (Salesforce)</label>
                      <input
                        type="text"
                        value={status.connection?.config?.healthTrendField || 'Health_Trend__c'}
                        onChange={(e) => handleUpdateConfig({ healthTrendField: e.target.value })}
                        className="w-full bg-cscx-gray-800 border border-cscx-gray-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:ring-2 focus:ring-cscx-accent font-mono"
                        placeholder="Health_Trend__c"
                      />
                    </div>
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

export default SalesforceConnect;
