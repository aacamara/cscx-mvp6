/**
 * PandaDoc Integration Component - PRD-206
 *
 * Settings panel for PandaDoc document management:
 * - OAuth connection
 * - Sync status and history
 * - Document overview
 * - Template browser
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
  FileText,
  Send,
  Eye,
  Clock,
  DollarSign,
  ChevronDown,
  ChevronUp,
  Users,
  FileCheck,
  AlertTriangle,
  LayoutTemplate,
} from 'lucide-react';

interface SyncStatus {
  configured: boolean;
  connected: boolean;
  lastSyncAt?: string;
  lastSyncStatus?: 'completed' | 'failed' | 'running';
  recordsSynced?: number;
  syncErrors?: string[];
  connection?: {
    tokenValid: boolean;
    workspaceId?: string;
    config?: SyncConfig;
  };
  circuitBreaker?: {
    state: 'CLOSED' | 'OPEN' | 'HALF_OPEN';
    failures: number;
  };
}

interface SyncConfig {
  syncSchedule: 'realtime' | 'hourly' | 'daily' | 'manual';
  customerMatchingField: 'recipient_email' | 'metadata_field';
  notifyOnEvents: string[];
  requireApprovalForSend: boolean;
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

interface DocumentSummary {
  total: number;
  pending: number;
  completed: number;
  declined: number;
}

interface PandaDocConnectProps {
  onClose?: () => void;
}

export function PandaDocConnect({ onClose }: PandaDocConnectProps) {
  const { user, getAuthHeaders } = useAuth();
  const [status, setStatus] = useState<SyncStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [connecting, setConnecting] = useState(false);
  const [disconnecting, setDisconnecting] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'overview' | 'documents' | 'history' | 'settings'>('overview');
  const [syncHistory, setSyncHistory] = useState<SyncLog[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [documentSummary, setDocumentSummary] = useState<DocumentSummary | null>(null);

  const API_URL = import.meta.env.VITE_API_URL || '';
  const userId = user?.id;

  // Fetch connection status
  const fetchStatus = useCallback(async () => {
    if (!userId) return;

    setLoading(true);
    setError(null);

    try {
      const response = await fetch(`${API_URL}/api/integrations/pandadoc/status?userId=${userId}`, {
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
      console.error('Error fetching PandaDoc status:', err);
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
      const response = await fetch(`${API_URL}/api/integrations/pandadoc/history?userId=${userId}&limit=10`, {
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

  // Initial load
  useEffect(() => {
    fetchStatus();
  }, [fetchStatus]);

  // Load history when tab changes
  useEffect(() => {
    if (activeTab === 'history') {
      fetchHistory();
    }
  }, [activeTab, fetchHistory]);

  // Initiate OAuth connection
  const handleConnect = async () => {
    if (!userId) return;

    setConnecting(true);
    setError(null);

    try {
      const response = await fetch(`${API_URL}/api/integrations/pandadoc/connect`, {
        method: 'POST',
        headers: {
          ...getAuthHeaders(),
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ userId }),
      });

      if (response.ok) {
        const data = await response.json();
        // Redirect to PandaDoc OAuth
        window.location.href = data.authUrl;
      } else {
        const errorData = await response.json();
        setError(errorData.error || 'Failed to initiate connection');
      }
    } catch (err) {
      console.error('Error connecting to PandaDoc:', err);
      setError('Failed to connect to PandaDoc');
    } finally {
      setConnecting(false);
    }
  };

  // Disconnect integration
  const handleDisconnect = async () => {
    if (!userId) return;

    if (!confirm('Are you sure you want to disconnect PandaDoc? Document data will remain in CSCX.AI but will no longer sync.')) {
      return;
    }

    setDisconnecting(true);
    setError(null);

    try {
      const response = await fetch(`${API_URL}/api/integrations/pandadoc/disconnect`, {
        method: 'DELETE',
        headers: {
          ...getAuthHeaders(),
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ userId }),
      });

      if (response.ok) {
        setStatus({ configured: true, connected: false });
      } else {
        const errorData = await response.json();
        setError(errorData.error || 'Failed to disconnect');
      }
    } catch (err) {
      console.error('Error disconnecting PandaDoc:', err);
      setError('Failed to disconnect');
    } finally {
      setDisconnecting(false);
    }
  };

  // Trigger manual sync
  const handleSync = async (incremental: boolean = false) => {
    if (!userId) return;

    setSyncing(true);
    setError(null);

    try {
      const response = await fetch(`${API_URL}/api/integrations/pandadoc/sync`, {
        method: 'POST',
        headers: {
          ...getAuthHeaders(),
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ userId, incremental }),
      });

      if (response.ok) {
        const data = await response.json();
        // Refresh status after sync
        await fetchStatus();
        // Refresh history if on that tab
        if (activeTab === 'history') {
          await fetchHistory();
        }
      } else {
        const errorData = await response.json();
        setError(errorData.error || 'Sync failed');
      }
    } catch (err) {
      console.error('Error syncing PandaDoc:', err);
      setError('Sync failed');
    } finally {
      setSyncing(false);
    }
  };

  // Format date
  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString();
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
    return `${diffDays}d ago`;
  };

  // Get status badge color
  const getStatusColor = (syncStatus: string) => {
    switch (syncStatus) {
      case 'completed':
        return 'bg-green-500/20 text-green-400';
      case 'failed':
        return 'bg-red-500/20 text-red-400';
      case 'running':
        return 'bg-yellow-500/20 text-yellow-400';
      default:
        return 'bg-gray-500/20 text-gray-400';
    }
  };

  if (loading) {
    return (
      <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
        <div className="bg-cscx-gray-900 rounded-lg p-8 max-w-2xl w-full mx-4">
          <div className="flex items-center justify-center">
            <Loader2 className="w-8 h-8 text-cscx-accent animate-spin" />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-cscx-gray-900 rounded-lg max-w-3xl w-full mx-4 max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-white/10">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-blue-600/20 flex items-center justify-center">
              <FileText className="w-5 h-5 text-blue-400" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-white">PandaDoc Integration</h2>
              <p className="text-sm text-gray-400">Document management and e-signatures</p>
            </div>
          </div>
          {onClose && (
            <button
              onClick={onClose}
              className="p-2 text-gray-400 hover:text-white hover:bg-white/10 rounded-lg transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          )}
        </div>

        {/* Connection Status */}
        <div className="p-4 border-b border-white/10">
          {status?.connected ? (
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <CheckCircle className="w-5 h-5 text-green-400" />
                <div>
                  <span className="text-green-400 font-medium">Connected</span>
                  {status.lastSyncAt && (
                    <span className="text-gray-400 text-sm ml-2">
                      Last synced {formatRelativeTime(status.lastSyncAt)}
                    </span>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => handleSync(true)}
                  disabled={syncing}
                  className="flex items-center gap-2 px-3 py-1.5 bg-white/5 hover:bg-white/10 text-white rounded-lg text-sm transition-colors disabled:opacity-50"
                >
                  {syncing ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <RefreshCw className="w-4 h-4" />
                  )}
                  Sync Now
                </button>
                <button
                  onClick={handleDisconnect}
                  disabled={disconnecting}
                  className="flex items-center gap-2 px-3 py-1.5 bg-red-500/10 hover:bg-red-500/20 text-red-400 rounded-lg text-sm transition-colors disabled:opacity-50"
                >
                  {disconnecting ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Unlink className="w-4 h-4" />
                  )}
                  Disconnect
                </button>
              </div>
            </div>
          ) : status?.configured ? (
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <AlertCircle className="w-5 h-5 text-yellow-400" />
                <span className="text-yellow-400">Not connected</span>
              </div>
              <button
                onClick={handleConnect}
                disabled={connecting}
                className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg transition-colors disabled:opacity-50"
              >
                {connecting ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Link className="w-4 h-4" />
                )}
                Connect PandaDoc
              </button>
            </div>
          ) : (
            <div className="flex items-center gap-3 text-gray-400">
              <AlertCircle className="w-5 h-5" />
              <span>PandaDoc integration not configured. Contact your administrator.</span>
            </div>
          )}
        </div>

        {/* Error Message */}
        {error && (
          <div className="mx-4 mt-4 p-3 bg-red-500/10 border border-red-500/20 rounded-lg flex items-center gap-2 text-red-400">
            <AlertCircle className="w-4 h-4 flex-shrink-0" />
            <span className="text-sm">{error}</span>
          </div>
        )}

        {/* Tabs */}
        {status?.connected && (
          <>
            <div className="flex border-b border-white/10">
              {(['overview', 'documents', 'history', 'settings'] as const).map((tab) => (
                <button
                  key={tab}
                  onClick={() => setActiveTab(tab)}
                  className={`px-4 py-3 text-sm font-medium transition-colors ${
                    activeTab === tab
                      ? 'text-white border-b-2 border-cscx-accent'
                      : 'text-gray-400 hover:text-white'
                  }`}
                >
                  {tab.charAt(0).toUpperCase() + tab.slice(1)}
                </button>
              ))}
            </div>

            {/* Tab Content */}
            <div className="flex-1 overflow-y-auto p-4">
              {/* Overview Tab */}
              {activeTab === 'overview' && (
                <div className="space-y-4">
                  {/* Quick Stats */}
                  <div className="grid grid-cols-4 gap-4">
                    <div className="bg-white/5 rounded-lg p-4">
                      <div className="flex items-center gap-2 text-gray-400 text-sm mb-1">
                        <FileText className="w-4 h-4" />
                        Total Documents
                      </div>
                      <div className="text-2xl font-bold text-white">
                        {status.recordsSynced || 0}
                      </div>
                    </div>
                    <div className="bg-white/5 rounded-lg p-4">
                      <div className="flex items-center gap-2 text-gray-400 text-sm mb-1">
                        <Send className="w-4 h-4" />
                        Sent/Pending
                      </div>
                      <div className="text-2xl font-bold text-yellow-400">-</div>
                    </div>
                    <div className="bg-white/5 rounded-lg p-4">
                      <div className="flex items-center gap-2 text-gray-400 text-sm mb-1">
                        <FileCheck className="w-4 h-4" />
                        Completed
                      </div>
                      <div className="text-2xl font-bold text-green-400">-</div>
                    </div>
                    <div className="bg-white/5 rounded-lg p-4">
                      <div className="flex items-center gap-2 text-gray-400 text-sm mb-1">
                        <Eye className="w-4 h-4" />
                        Viewed Today
                      </div>
                      <div className="text-2xl font-bold text-blue-400">-</div>
                    </div>
                  </div>

                  {/* Connection Details */}
                  <div className="bg-white/5 rounded-lg p-4">
                    <h3 className="text-white font-medium mb-3">Connection Details</h3>
                    <div className="space-y-2 text-sm">
                      <div className="flex justify-between">
                        <span className="text-gray-400">Token Status</span>
                        <span className={status.connection?.tokenValid ? 'text-green-400' : 'text-red-400'}>
                          {status.connection?.tokenValid ? 'Valid' : 'Expired'}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-400">Last Sync Status</span>
                        <span className={getStatusColor(status.lastSyncStatus || 'unknown')}>
                          {status.lastSyncStatus || 'Never synced'}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-400">Circuit Breaker</span>
                        <span className={
                          status.circuitBreaker?.state === 'CLOSED' ? 'text-green-400' :
                          status.circuitBreaker?.state === 'OPEN' ? 'text-red-400' : 'text-yellow-400'
                        }>
                          {status.circuitBreaker?.state || 'Unknown'}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Sync Actions */}
                  <div className="bg-white/5 rounded-lg p-4">
                    <h3 className="text-white font-medium mb-3">Sync Actions</h3>
                    <div className="flex gap-3">
                      <button
                        onClick={() => handleSync(true)}
                        disabled={syncing}
                        className="flex items-center gap-2 px-4 py-2 bg-white/10 hover:bg-white/20 text-white rounded-lg text-sm transition-colors disabled:opacity-50"
                      >
                        {syncing ? (
                          <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                          <RefreshCw className="w-4 h-4" />
                        )}
                        Incremental Sync
                      </button>
                      <button
                        onClick={() => handleSync(false)}
                        disabled={syncing}
                        className="flex items-center gap-2 px-4 py-2 bg-cscx-accent/20 hover:bg-cscx-accent/30 text-cscx-accent rounded-lg text-sm transition-colors disabled:opacity-50"
                      >
                        {syncing ? (
                          <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                          <RefreshCw className="w-4 h-4" />
                        )}
                        Full Sync
                      </button>
                    </div>
                    <p className="text-gray-500 text-xs mt-2">
                      Incremental sync fetches only documents modified since last sync. Full sync refreshes all documents.
                    </p>
                  </div>
                </div>
              )}

              {/* Documents Tab */}
              {activeTab === 'documents' && (
                <div className="space-y-4">
                  <div className="bg-white/5 rounded-lg p-6 text-center">
                    <FileText className="w-12 h-12 text-gray-600 mx-auto mb-3" />
                    <p className="text-gray-400">
                      Document details are shown in customer profiles.
                    </p>
                    <p className="text-gray-500 text-sm mt-1">
                      Navigate to a customer to see their PandaDoc documents and proposals.
                    </p>
                  </div>

                  {/* Document Status Legend */}
                  <div className="bg-white/5 rounded-lg p-4">
                    <h3 className="text-white font-medium mb-3">Document Status Legend</h3>
                    <div className="grid grid-cols-2 gap-3 text-sm">
                      <div className="flex items-center gap-2">
                        <span className="w-2 h-2 rounded-full bg-gray-400"></span>
                        <span className="text-gray-400">Draft</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="w-2 h-2 rounded-full bg-blue-400"></span>
                        <span className="text-gray-400">Sent</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="w-2 h-2 rounded-full bg-yellow-400"></span>
                        <span className="text-gray-400">Viewed</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="w-2 h-2 rounded-full bg-green-400"></span>
                        <span className="text-gray-400">Completed</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="w-2 h-2 rounded-full bg-purple-400"></span>
                        <span className="text-gray-400">Paid</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="w-2 h-2 rounded-full bg-red-400"></span>
                        <span className="text-gray-400">Declined</span>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* History Tab */}
              {activeTab === 'history' && (
                <div className="space-y-4">
                  {loadingHistory ? (
                    <div className="flex justify-center py-8">
                      <Loader2 className="w-6 h-6 text-cscx-accent animate-spin" />
                    </div>
                  ) : syncHistory.length === 0 ? (
                    <div className="text-center py-8 text-gray-400">
                      No sync history available
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {syncHistory.map((log) => (
                        <div
                          key={log.id}
                          className="bg-white/5 rounded-lg p-3 flex items-center justify-between"
                        >
                          <div className="flex items-center gap-3">
                            <div
                              className={`w-2 h-2 rounded-full ${
                                log.status === 'completed'
                                  ? 'bg-green-400'
                                  : log.status === 'failed'
                                  ? 'bg-red-400'
                                  : 'bg-yellow-400'
                              }`}
                            />
                            <div>
                              <div className="text-white text-sm">
                                {log.sync_type.charAt(0).toUpperCase() + log.sync_type.slice(1)} Sync
                              </div>
                              <div className="text-gray-500 text-xs">
                                {formatDate(log.started_at)}
                              </div>
                            </div>
                          </div>
                          <div className="text-right">
                            <div className="text-white text-sm">
                              {log.records_created + log.records_updated} synced
                            </div>
                            <div className="text-gray-500 text-xs">
                              {log.records_created} new, {log.records_updated} updated
                              {log.records_skipped > 0 && `, ${log.records_skipped} skipped`}
                            </div>
                          </div>
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
                  <div className="bg-white/5 rounded-lg p-4">
                    <h3 className="text-white font-medium mb-3">Sync Schedule</h3>
                    <select
                      value={status.connection?.config?.syncSchedule || 'hourly'}
                      onChange={() => {}}
                      className="w-full bg-white/10 border border-white/10 rounded-lg px-3 py-2 text-white text-sm"
                    >
                      <option value="realtime">Real-time (via webhooks)</option>
                      <option value="hourly">Hourly</option>
                      <option value="daily">Daily</option>
                      <option value="manual">Manual only</option>
                    </select>
                    <p className="text-gray-500 text-xs mt-2">
                      Documents are also updated in real-time via PandaDoc webhooks when configured.
                    </p>
                  </div>

                  {/* Customer Matching */}
                  <div className="bg-white/5 rounded-lg p-4">
                    <h3 className="text-white font-medium mb-3">Customer Matching</h3>
                    <select
                      value={status.connection?.config?.customerMatchingField || 'recipient_email'}
                      onChange={() => {}}
                      className="w-full bg-white/10 border border-white/10 rounded-lg px-3 py-2 text-white text-sm"
                    >
                      <option value="recipient_email">Match by recipient email domain</option>
                      <option value="metadata_field">Match by document metadata field</option>
                    </select>
                    <p className="text-gray-500 text-xs mt-2">
                      Documents are matched to customers based on recipient email domains registered in CSCX.AI.
                    </p>
                  </div>

                  {/* Notifications */}
                  <div className="bg-white/5 rounded-lg p-4">
                    <h3 className="text-white font-medium mb-3">Event Notifications</h3>
                    <div className="space-y-2">
                      {[
                        { id: 'document_sent', label: 'Document Sent' },
                        { id: 'document_viewed', label: 'Document Viewed' },
                        { id: 'document_completed', label: 'Document Completed/Signed' },
                        { id: 'document_paid', label: 'Payment Received' },
                        { id: 'document_declined', label: 'Document Declined' },
                      ].map((event) => (
                        <label key={event.id} className="flex items-center gap-3 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={status.connection?.config?.notifyOnEvents?.includes(event.id) ?? true}
                            onChange={() => {}}
                            className="w-4 h-4 rounded border-white/20 bg-white/10 text-cscx-accent"
                          />
                          <span className="text-gray-300 text-sm">{event.label}</span>
                        </label>
                      ))}
                    </div>
                  </div>

                  {/* Approval Settings */}
                  <div className="bg-white/5 rounded-lg p-4">
                    <h3 className="text-white font-medium mb-3">Approval Settings</h3>
                    <label className="flex items-center gap-3 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={status.connection?.config?.requireApprovalForSend ?? true}
                        onChange={() => {}}
                        className="w-4 h-4 rounded border-white/20 bg-white/10 text-cscx-accent"
                      />
                      <span className="text-gray-300 text-sm">
                        Require approval before sending documents
                      </span>
                    </label>
                    <p className="text-gray-500 text-xs mt-2">
                      When enabled, documents created by agents require human approval before sending.
                    </p>
                  </div>

                  {/* Advanced Settings */}
                  <button
                    onClick={() => setShowAdvanced(!showAdvanced)}
                    className="flex items-center gap-2 text-gray-400 hover:text-white text-sm transition-colors"
                  >
                    {showAdvanced ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                    Advanced Settings
                  </button>

                  {showAdvanced && (
                    <div className="bg-white/5 rounded-lg p-4 space-y-3">
                      <div>
                        <label className="block text-gray-400 text-sm mb-1">Webhook Secret</label>
                        <input
                          type="password"
                          value="••••••••••••••••"
                          readOnly
                          className="w-full bg-white/10 border border-white/10 rounded-lg px-3 py-2 text-gray-500 text-sm"
                        />
                        <p className="text-gray-500 text-xs mt-1">
                          Configure this secret in PandaDoc webhook settings for signature verification.
                        </p>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}

export default PandaDocConnect;
