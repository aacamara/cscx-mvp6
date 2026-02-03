/**
 * Confluence Integration Component - PRD-204
 *
 * Settings panel for Confluence Knowledge Base integration:
 * - OAuth connection (Cloud) and API Token (Server/Data Center)
 * - Space configuration
 * - Sync status and history
 * - Search functionality
 * - Customer page linking
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
  Search,
  BookOpen,
  Clock,
  FolderOpen,
  FileText,
  ChevronDown,
  ChevronUp,
  ExternalLink,
  Plus,
} from 'lucide-react';

interface SyncStatus {
  configured: boolean;
  connected: boolean;
  lastSyncAt?: string;
  lastSyncStatus?: 'completed' | 'failed' | 'running';
  pagesSynced?: number;
  syncErrors?: string[];
  connection?: {
    baseUrl: string;
    authType: 'oauth' | 'api_token';
    config?: SyncConfig;
  };
  circuitBreaker?: {
    state: 'CLOSED' | 'OPEN' | 'HALF_OPEN';
    failures: number;
  };
}

interface SyncConfig {
  syncSchedule: 'hourly' | 'daily' | 'manual';
  generateEmbeddings: boolean;
  spaces: SpaceConfig[];
}

interface SpaceConfig {
  spaceKey: string;
  spaceName: string;
  enabled: boolean;
  syncFrequency: 'hourly' | 'daily' | 'weekly' | 'manual';
  lastSyncAt?: string;
  pageCount?: number;
}

interface ConfluenceSpace {
  id: string;
  key: string;
  name: string;
  type: 'global' | 'personal';
  description?: string;
  configured?: boolean;
  enabled?: boolean;
  lastSyncAt?: string;
}

interface SyncLog {
  id: string;
  sync_type: string;
  object_type: string;
  pages_processed: number;
  pages_created: number;
  pages_updated: number;
  pages_skipped: number;
  pages_failed: number;
  status: string;
  started_at: string;
  completed_at: string;
  error_details?: string[];
}

interface SearchResult {
  pageId: string;
  title: string;
  spaceKey: string;
  snippet: string;
  score: number;
  webUrl: string;
  labels: string[];
  lastModified: string;
}

interface ConfluenceConnectProps {
  onClose?: () => void;
}

export function ConfluenceConnect({ onClose }: ConfluenceConnectProps) {
  const { user, getAuthHeaders } = useAuth();
  const [status, setStatus] = useState<SyncStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [connecting, setConnecting] = useState(false);
  const [disconnecting, setDisconnecting] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'overview' | 'spaces' | 'search' | 'history' | 'settings'>(
    'overview'
  );
  const [syncHistory, setSyncHistory] = useState<SyncLog[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [spaces, setSpaces] = useState<ConfluenceSpace[]>([]);
  const [loadingSpaces, setLoadingSpaces] = useState(false);
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [searching, setSearching] = useState(false);

  // API Token auth state
  const [authType, setAuthType] = useState<'oauth' | 'api_token'>('oauth');
  const [baseUrl, setBaseUrl] = useState('');
  const [email, setEmail] = useState('');
  const [apiToken, setApiToken] = useState('');
  const [showAdvanced, setShowAdvanced] = useState(false);

  const API_URL = import.meta.env.VITE_API_URL || '';
  const userId = user?.id;

  // Fetch connection status
  const fetchStatus = useCallback(async () => {
    if (!userId) return;

    setLoading(true);
    setError(null);

    try {
      const response = await fetch(`${API_URL}/api/confluence/status?userId=${userId}`, {
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
      console.error('Error fetching Confluence status:', err);
      setError('Unable to check connection status');
      setStatus({ configured: false, connected: false });
    } finally {
      setLoading(false);
    }
  }, [API_URL, userId, getAuthHeaders]);

  // Fetch spaces
  const fetchSpaces = useCallback(async () => {
    if (!userId || !status?.connected) return;

    setLoadingSpaces(true);
    try {
      const response = await fetch(`${API_URL}/api/confluence/spaces?userId=${userId}&limit=50`, {
        headers: getAuthHeaders(),
      });

      if (response.ok) {
        const data = await response.json();
        setSpaces(data.spaces || []);
      }
    } catch (err) {
      console.error('Error fetching spaces:', err);
    } finally {
      setLoadingSpaces(false);
    }
  }, [API_URL, userId, status?.connected, getAuthHeaders]);

  // Fetch sync history
  const fetchHistory = useCallback(async () => {
    if (!userId || !status?.connected) return;

    setLoadingHistory(true);
    try {
      const response = await fetch(`${API_URL}/api/confluence/history?userId=${userId}&limit=10`, {
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
    if (activeTab === 'spaces' && status?.connected) {
      fetchSpaces();
    } else if (activeTab === 'history' && status?.connected) {
      fetchHistory();
    }
  }, [activeTab, status?.connected, fetchSpaces, fetchHistory]);

  // Check URL params for OAuth callback result
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const success = params.get('success');
    const errorParam = params.get('error');

    if (success === 'confluence_connected') {
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
      const response = await fetch(`${API_URL}/api/confluence/connect`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...getAuthHeaders(),
        },
        body: JSON.stringify({
          userId,
          authType,
          ...(authType === 'api_token' && { baseUrl, email, apiToken }),
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to initiate connection');
      }

      const data = await response.json();

      if (authType === 'api_token') {
        // API token auth - already connected
        await fetchStatus();
        setConnecting(false);
      } else if (data.authUrl) {
        // OAuth - redirect to Atlassian
        window.location.href = data.authUrl;
      } else {
        throw new Error('No OAuth URL returned');
      }
    } catch (err) {
      console.error('Error connecting Confluence:', err);
      setError(err instanceof Error ? err.message : 'Failed to connect');
      setConnecting(false);
    }
  };

  // Handle disconnect
  const handleDisconnect = async () => {
    if (!userId) return;

    if (
      !confirm(
        'Are you sure you want to disconnect Confluence? Synced pages will be removed from the knowledge base.'
      )
    ) {
      return;
    }

    setDisconnecting(true);
    setError(null);

    try {
      const response = await fetch(`${API_URL}/api/confluence/disconnect`, {
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
      console.error('Error disconnecting Confluence:', err);
      setError(err instanceof Error ? err.message : 'Failed to disconnect');
    } finally {
      setDisconnecting(false);
    }
  };

  // Handle sync
  const handleSync = async (incremental = false) => {
    if (!userId) return;

    setSyncing(true);
    setError(null);

    try {
      const response = await fetch(`${API_URL}/api/confluence/sync`, {
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

  // Handle space toggle
  const handleSpaceToggle = async (space: ConfluenceSpace, enabled: boolean) => {
    if (!userId) return;

    try {
      const response = await fetch(`${API_URL}/api/confluence/spaces/config`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          ...getAuthHeaders(),
        },
        body: JSON.stringify({
          userId,
          spaceConfig: {
            spaceKey: space.key,
            spaceName: space.name,
            enabled,
            syncFrequency: 'daily',
          },
        }),
      });

      if (response.ok) {
        setSpaces((prev) =>
          prev.map((s) => (s.key === space.key ? { ...s, enabled, configured: true } : s))
        );
      }
    } catch (err) {
      console.error('Error updating space config:', err);
    }
  };

  // Handle search
  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!userId || !searchQuery.trim()) return;

    setSearching(true);
    setError(null);

    try {
      const response = await fetch(
        `${API_URL}/api/confluence/search?userId=${userId}&q=${encodeURIComponent(searchQuery)}&limit=20`,
        {
          headers: getAuthHeaders(),
        }
      );

      if (response.ok) {
        const data = await response.json();
        setSearchResults(data.results || []);
      }
    } catch (err) {
      console.error('Search error:', err);
      setError('Search failed');
    } finally {
      setSearching(false);
    }
  };

  // Update config
  const handleUpdateConfig = async (config: Partial<SyncConfig>) => {
    if (!userId) return;

    try {
      const response = await fetch(`${API_URL}/api/confluence/config`, {
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

  const formatRelativeTime = (dateStr: string) => {
    const date = new Date(dateStr);
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    const hours = Math.floor(diff / (1000 * 60 * 60));
    const minutes = Math.floor(diff / (1000 * 60));

    if (days > 0) return `${days}d ago`;
    if (hours > 0) return `${hours}h ago`;
    if (minutes > 0) return `${minutes}m ago`;
    return 'Just now';
  };

  return (
    <div className="bg-cscx-gray-900 rounded-xl border border-cscx-gray-700 overflow-hidden max-h-[80vh] overflow-y-auto">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-cscx-gray-700 sticky top-0 bg-cscx-gray-900 z-10">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-[#0052CC] rounded-lg flex items-center justify-center">
            <svg className="w-6 h-6 text-white" viewBox="0 0 32 32" fill="currentColor">
              <path d="M5.8 25.6c-.3 0-.5-.1-.7-.3-.3-.4-.3-.9.1-1.2l10-9c.2-.2.5-.3.8-.3s.6.1.8.3l10 9c.4.3.4.9.1 1.2-.3.4-.9.4-1.2.1L16 17l-9.5 8.4c-.2.1-.5.2-.7.2zM5.8 17.1c-.3 0-.5-.1-.7-.3-.3-.4-.3-.9.1-1.2l10-9c.2-.2.5-.3.8-.3s.6.1.8.3l10 9c.4.3.4.9.1 1.2-.3.4-.9.4-1.2.1L16 8.5l-9.5 8.4c-.2.1-.5.2-.7.2z" />
            </svg>
          </div>
          <div>
            <h3 className="text-lg font-semibold text-white">Confluence Integration</h3>
            <p className="text-sm text-cscx-gray-400">Knowledge base sync and search</p>
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
                <Search className="w-5 h-5 text-blue-400" />
                <span className="text-cscx-gray-300">Search knowledge base from CSCX.AI</span>
              </div>
              <div className="flex items-center gap-3 p-2 bg-cscx-gray-800/50 rounded-lg">
                <BookOpen className="w-5 h-5 text-green-400" />
                <span className="text-cscx-gray-300">AI references documentation in answers</span>
              </div>
              <div className="flex items-center gap-3 p-2 bg-cscx-gray-800/50 rounded-lg">
                <FileText className="w-5 h-5 text-purple-400" />
                <span className="text-cscx-gray-300">Link pages to customer records</span>
              </div>
            </div>
          </div>

          {/* Auth Type Toggle */}
          <div className="flex gap-2 p-1 bg-cscx-gray-800 rounded-lg">
            <button
              onClick={() => setAuthType('oauth')}
              className={`flex-1 px-3 py-2 text-sm font-medium rounded-md transition-colors ${
                authType === 'oauth'
                  ? 'bg-cscx-accent text-white'
                  : 'text-cscx-gray-400 hover:text-white'
              }`}
            >
              Cloud (OAuth)
            </button>
            <button
              onClick={() => setAuthType('api_token')}
              className={`flex-1 px-3 py-2 text-sm font-medium rounded-md transition-colors ${
                authType === 'api_token'
                  ? 'bg-cscx-accent text-white'
                  : 'text-cscx-gray-400 hover:text-white'
              }`}
            >
              Server (API Token)
            </button>
          </div>

          {/* API Token Fields */}
          {authType === 'api_token' && (
            <div className="space-y-3">
              <div>
                <label className="block text-sm text-cscx-gray-400 mb-1">Confluence URL</label>
                <input
                  type="url"
                  value={baseUrl}
                  onChange={(e) => setBaseUrl(e.target.value)}
                  placeholder="https://your-company.atlassian.net"
                  className="w-full bg-cscx-gray-800 border border-cscx-gray-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:ring-2 focus:ring-cscx-accent"
                />
              </div>
              <div>
                <label className="block text-sm text-cscx-gray-400 mb-1">Email</label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="your-email@company.com"
                  className="w-full bg-cscx-gray-800 border border-cscx-gray-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:ring-2 focus:ring-cscx-accent"
                />
              </div>
              <div>
                <label className="block text-sm text-cscx-gray-400 mb-1">API Token</label>
                <input
                  type="password"
                  value={apiToken}
                  onChange={(e) => setApiToken(e.target.value)}
                  placeholder="Your API token"
                  className="w-full bg-cscx-gray-800 border border-cscx-gray-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:ring-2 focus:ring-cscx-accent"
                />
                <p className="text-xs text-cscx-gray-500 mt-1">
                  Generate at:{' '}
                  <a
                    href="https://id.atlassian.com/manage-profile/security/api-tokens"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-cscx-accent hover:underline"
                  >
                    Atlassian API Tokens
                  </a>
                </p>
              </div>
            </div>
          )}

          {/* Connect Button */}
          <button
            onClick={handleConnect}
            disabled={connecting || (authType === 'api_token' && (!baseUrl || !email || !apiToken))}
            className="w-full flex items-center justify-center gap-2 bg-[#0052CC] hover:bg-[#0747A6] text-white font-medium py-3 px-4 rounded-lg transition-colors disabled:opacity-50"
          >
            {connecting ? (
              <Loader2 className="w-5 h-5 animate-spin" />
            ) : (
              <>
                <Link className="w-5 h-5" />
                Connect Confluence
              </>
            )}
          </button>
        </div>
      )}

      {/* Connected State */}
      {!loading && status?.connected && (
        <>
          {/* Tabs */}
          <div className="flex border-b border-cscx-gray-700 overflow-x-auto">
            {(['overview', 'spaces', 'search', 'history', 'settings'] as const).map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`flex-shrink-0 px-4 py-3 text-sm font-medium capitalize transition-colors ${
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
                        {status.connection?.authType === 'oauth' ? 'Cloud' : 'Server'} -{' '}
                        {status.connection?.baseUrl}
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

                {/* Stats */}
                <div className="grid grid-cols-2 gap-4">
                  <div className="bg-cscx-gray-800/50 rounded-lg p-4">
                    <div className="flex items-center gap-2 text-cscx-gray-400 mb-1">
                      <FileText className="w-4 h-4" />
                      <span className="text-sm">Pages Indexed</span>
                    </div>
                    <p className="text-2xl font-bold text-white">{status.pagesSynced || 0}</p>
                  </div>
                  <div className="bg-cscx-gray-800/50 rounded-lg p-4">
                    <div className="flex items-center gap-2 text-cscx-gray-400 mb-1">
                      <Clock className="w-4 h-4" />
                      <span className="text-sm">Last Sync</span>
                    </div>
                    <p className="text-lg font-medium text-white">
                      {status.lastSyncAt ? formatRelativeTime(status.lastSyncAt) : 'Never'}
                    </p>
                  </div>
                </div>

                {/* Quick Actions */}
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
                        <RefreshCw className="w-4 h-4" />
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

            {/* Spaces Tab */}
            {activeTab === 'spaces' && (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <p className="text-sm text-cscx-gray-400 font-medium">Configure Spaces to Sync</p>
                  <button
                    onClick={fetchSpaces}
                    disabled={loadingSpaces}
                    className="text-sm text-cscx-accent hover:text-cscx-accent/80"
                  >
                    {loadingSpaces ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <RefreshCw className="w-4 h-4" />
                    )}
                  </button>
                </div>

                {loadingSpaces ? (
                  <div className="flex justify-center py-8">
                    <Loader2 className="w-6 h-6 text-cscx-accent animate-spin" />
                  </div>
                ) : spaces.length === 0 ? (
                  <p className="text-sm text-cscx-gray-500 text-center py-8">
                    No spaces found. Make sure you have access to Confluence spaces.
                  </p>
                ) : (
                  <div className="space-y-2">
                    {spaces.map((space) => (
                      <div
                        key={space.key}
                        className="flex items-center justify-between p-3 bg-cscx-gray-800/50 rounded-lg"
                      >
                        <div className="flex items-center gap-3">
                          <FolderOpen className="w-5 h-5 text-cscx-gray-400" />
                          <div>
                            <p className="text-white font-medium">{space.name}</p>
                            <p className="text-xs text-cscx-gray-500">
                              {space.key} - {space.type}
                            </p>
                          </div>
                        </div>
                        <label className="relative inline-flex items-center cursor-pointer">
                          <input
                            type="checkbox"
                            checked={space.enabled || false}
                            onChange={(e) => handleSpaceToggle(space, e.target.checked)}
                            className="sr-only peer"
                          />
                          <div className="w-11 h-6 bg-cscx-gray-700 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-cscx-accent rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-cscx-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-cscx-accent"></div>
                        </label>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Search Tab */}
            {activeTab === 'search' && (
              <div className="space-y-4">
                <form onSubmit={handleSearch} className="flex gap-2">
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Search knowledge base..."
                    className="flex-1 bg-cscx-gray-800 border border-cscx-gray-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:ring-2 focus:ring-cscx-accent"
                  />
                  <button
                    type="submit"
                    disabled={searching || !searchQuery.trim()}
                    className="px-4 py-2 bg-cscx-accent hover:bg-cscx-accent/80 text-white rounded-lg transition-colors disabled:opacity-50"
                  >
                    {searching ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <Search className="w-4 h-4" />
                    )}
                  </button>
                </form>

                {searchResults.length > 0 ? (
                  <div className="space-y-3">
                    {searchResults.map((result) => (
                      <a
                        key={result.pageId}
                        href={result.webUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="block p-3 bg-cscx-gray-800/50 hover:bg-cscx-gray-800 rounded-lg transition-colors"
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex-1 min-w-0">
                            <h4 className="text-white font-medium flex items-center gap-2">
                              {result.title}
                              <ExternalLink className="w-3 h-3 text-cscx-gray-500" />
                            </h4>
                            <p className="text-sm text-cscx-gray-400 mt-1 line-clamp-2">
                              {result.snippet}
                            </p>
                            <div className="flex items-center gap-2 mt-2">
                              <span className="text-xs text-cscx-gray-500">{result.spaceKey}</span>
                              {result.labels.slice(0, 3).map((label) => (
                                <span
                                  key={label}
                                  className="text-xs px-2 py-0.5 bg-cscx-gray-700 text-cscx-gray-300 rounded"
                                >
                                  {label}
                                </span>
                              ))}
                            </div>
                          </div>
                        </div>
                      </a>
                    ))}
                  </div>
                ) : searchQuery && !searching ? (
                  <p className="text-sm text-cscx-gray-500 text-center py-8">
                    No results found for "{searchQuery}"
                  </p>
                ) : (
                  <p className="text-sm text-cscx-gray-500 text-center py-8">
                    Search your Confluence knowledge base
                  </p>
                )}
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
                      <div key={log.id} className="p-3 bg-cscx-gray-800/50 rounded-lg space-y-2">
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
                          <span>Processed: {log.pages_processed}</span>
                          <span className="text-green-400">Created: {log.pages_created}</span>
                          <span className="text-blue-400">Updated: {log.pages_updated}</span>
                          {log.pages_failed > 0 && (
                            <span className="text-red-400">Failed: {log.pages_failed}</span>
                          )}
                        </div>
                        {log.error_details && log.error_details.length > 0 && (
                          <div className="text-xs text-red-400 bg-red-900/20 p-2 rounded">
                            {log.error_details.slice(0, 3).join(', ')}
                            {log.error_details.length > 3 &&
                              ` +${log.error_details.length - 3} more`}
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
                    value={status.connection?.config?.syncSchedule || 'daily'}
                    onChange={(e) =>
                      handleUpdateConfig({
                        syncSchedule: e.target.value as SyncConfig['syncSchedule'],
                      })
                    }
                    className="w-full bg-cscx-gray-800 border border-cscx-gray-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:ring-2 focus:ring-cscx-accent"
                  >
                    <option value="manual">Manual only</option>
                    <option value="hourly">Hourly</option>
                    <option value="daily">Daily</option>
                  </select>
                </div>

                {/* AI Embeddings Toggle */}
                <div className="flex items-center justify-between p-3 bg-cscx-gray-800/50 rounded-lg">
                  <div>
                    <p className="text-white font-medium">Generate AI Embeddings</p>
                    <p className="text-xs text-cscx-gray-500">
                      Enable semantic search and AI-powered answers
                    </p>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      checked={status.connection?.config?.generateEmbeddings ?? true}
                      onChange={(e) => handleUpdateConfig({ generateEmbeddings: e.target.checked })}
                      className="sr-only peer"
                    />
                    <div className="w-11 h-6 bg-cscx-gray-700 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-cscx-accent rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-cscx-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-cscx-accent"></div>
                  </label>
                </div>

                {/* Advanced Settings */}
                <button
                  onClick={() => setShowAdvanced(!showAdvanced)}
                  className="flex items-center gap-2 text-sm text-cscx-gray-400 hover:text-white"
                >
                  {showAdvanced ? (
                    <ChevronUp className="w-4 h-4" />
                  ) : (
                    <ChevronDown className="w-4 h-4" />
                  )}
                  Advanced Settings
                </button>

                {showAdvanced && (
                  <div className="space-y-4 p-4 bg-cscx-gray-800/50 rounded-lg">
                    <p className="text-xs text-cscx-gray-500">
                      Additional settings for Confluence integration can be configured via API.
                      Contact support for advanced requirements like custom label mappings or webhook
                      configuration.
                    </p>
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

export default ConfluenceConnect;
