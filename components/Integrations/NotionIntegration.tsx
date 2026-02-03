/**
 * Notion Integration Component - PRD-203
 *
 * Provides UI for:
 * - OAuth connection to Notion
 * - Page browsing and search
 * - Customer page linking
 * - Page creation from templates
 * - Sync status and history
 */

import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../../context/AuthContext';

const API_URL = import.meta.env.VITE_API_URL || '';

// ============================================
// Types
// ============================================

interface NotionPage {
  id: string;
  notionPageId: string;
  title: string;
  url: string;
  icon?: string;
  cover?: string;
  parentType: 'database' | 'page' | 'workspace';
  parentId?: string;
  lastEditedAt: string;
  contentMarkdown?: string;
}

interface NotionDatabase {
  id: string;
  title: string;
  description?: string;
  icon?: string;
  url: string;
  properties: Array<{
    id: string;
    name: string;
    type: string;
  }>;
}

interface NotionTemplate {
  id: string;
  name: string;
  type: 'success_plan' | 'meeting_notes' | 'project_brief' | 'custom';
}

interface SyncStatus {
  connected: boolean;
  workspaceName?: string;
  lastSyncAt?: string;
  lastSyncStatus?: 'completed' | 'failed' | 'running';
  pagesSynced?: number;
  syncErrors?: string[];
}

interface NotionIntegrationProps {
  customerId?: string;
  customerName?: string;
  onPageSelect?: (page: NotionPage) => void;
  compact?: boolean;
}

// ============================================
// Component
// ============================================

export function NotionIntegration({
  customerId,
  customerName,
  onPageSelect,
  compact = false,
}: NotionIntegrationProps) {
  const { getAuthHeaders } = useAuth();

  // Connection state
  const [status, setStatus] = useState<SyncStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [connecting, setConnecting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Data state
  const [pages, setPages] = useState<NotionPage[]>([]);
  const [databases, setDatabases] = useState<NotionDatabase[]>([]);
  const [templates, setTemplates] = useState<NotionTemplate[]>([]);
  const [searchResults, setSearchResults] = useState<NotionPage[]>([]);

  // UI state
  const [activeTab, setActiveTab] = useState<'pages' | 'databases' | 'create'>('pages');
  const [searchQuery, setSearchQuery] = useState('');
  const [searching, setSearching] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [selectedPage, setSelectedPage] = useState<NotionPage | null>(null);

  // Create page state
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [createTitle, setCreateTitle] = useState('');
  const [selectedTemplate, setSelectedTemplate] = useState<string>('');
  const [selectedDatabase, setSelectedDatabase] = useState<string>('');
  const [creating, setCreating] = useState(false);

  // ============================================
  // Data fetching
  // ============================================

  const checkStatus = useCallback(async () => {
    setLoading(true);
    try {
      const response = await fetch(`${API_URL}/api/notion/status`, {
        headers: getAuthHeaders(),
      });
      if (response.ok) {
        const data = await response.json();
        setStatus(data);
      } else {
        setStatus({ connected: false });
      }
    } catch (err) {
      console.error('Failed to check Notion status:', err);
      setStatus({ connected: false });
    } finally {
      setLoading(false);
    }
  }, [getAuthHeaders]);

  const loadCustomerPages = useCallback(async () => {
    if (!customerId || !status?.connected) return;

    try {
      const response = await fetch(`${API_URL}/api/notion/pages/${customerId}`, {
        headers: getAuthHeaders(),
      });
      if (response.ok) {
        const data = await response.json();
        setPages(data.pages || []);
      }
    } catch (err) {
      console.error('Failed to load pages:', err);
    }
  }, [customerId, status?.connected, getAuthHeaders]);

  const loadDatabases = useCallback(async () => {
    if (!status?.connected) return;

    try {
      const response = await fetch(`${API_URL}/api/notion/databases`, {
        headers: getAuthHeaders(),
      });
      if (response.ok) {
        const data = await response.json();
        setDatabases(data.databases || []);
      }
    } catch (err) {
      console.error('Failed to load databases:', err);
    }
  }, [status?.connected, getAuthHeaders]);

  const loadTemplates = useCallback(async () => {
    try {
      const response = await fetch(`${API_URL}/api/notion/templates`, {
        headers: getAuthHeaders(),
      });
      if (response.ok) {
        const data = await response.json();
        setTemplates(data.templates || []);
      }
    } catch (err) {
      console.error('Failed to load templates:', err);
    }
  }, [getAuthHeaders]);

  // Load data on mount and when connection status changes
  useEffect(() => {
    checkStatus();
  }, [checkStatus]);

  useEffect(() => {
    if (status?.connected) {
      loadCustomerPages();
      loadDatabases();
      loadTemplates();
    }
  }, [status?.connected, loadCustomerPages, loadDatabases, loadTemplates]);

  // ============================================
  // Actions
  // ============================================

  const handleConnect = async () => {
    setConnecting(true);
    setError(null);

    try {
      const response = await fetch(`${API_URL}/api/notion/auth`, {
        headers: getAuthHeaders(),
      });

      if (response.ok) {
        const data = await response.json();
        // Redirect to Notion OAuth
        window.location.href = data.authUrl;
      } else {
        setError('Failed to initiate connection');
      }
    } catch (err) {
      setError('Failed to connect to Notion');
    } finally {
      setConnecting(false);
    }
  };

  const handleDisconnect = async () => {
    if (!confirm('Are you sure you want to disconnect Notion?')) return;

    try {
      await fetch(`${API_URL}/api/notion/disconnect`, {
        method: 'DELETE',
        headers: getAuthHeaders(),
      });
      setStatus({ connected: false });
      setPages([]);
      setDatabases([]);
    } catch (err) {
      setError('Failed to disconnect');
    }
  };

  const handleSearch = async () => {
    if (!searchQuery.trim()) {
      setSearchResults([]);
      return;
    }

    setSearching(true);
    try {
      const response = await fetch(`${API_URL}/api/notion/search`, {
        method: 'POST',
        headers: {
          ...getAuthHeaders(),
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          query: searchQuery,
          filter: 'page',
          pageSize: 20,
        }),
      });

      if (response.ok) {
        const data = await response.json();
        setSearchResults(data.pages || []);
      }
    } catch (err) {
      console.error('Search failed:', err);
    } finally {
      setSearching(false);
    }
  };

  const handleSync = async () => {
    if (!customerId || !customerName) return;

    setSyncing(true);
    try {
      const response = await fetch(`${API_URL}/api/notion/sync/${customerId}`, {
        method: 'POST',
        headers: {
          ...getAuthHeaders(),
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ customerName }),
      });

      if (response.ok) {
        await loadCustomerPages();
        await checkStatus();
      }
    } catch (err) {
      setError('Sync failed');
    } finally {
      setSyncing(false);
    }
  };

  const handleCreatePage = async () => {
    if (!createTitle.trim() || !selectedDatabase) return;

    setCreating(true);
    try {
      const response = await fetch(`${API_URL}/api/notion/pages`, {
        method: 'POST',
        headers: {
          ...getAuthHeaders(),
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          parentType: 'database',
          parentId: selectedDatabase,
          title: createTitle,
          templateId: selectedTemplate || undefined,
          customerId,
          customerName,
        }),
      });

      if (response.ok) {
        const data = await response.json();
        setShowCreateModal(false);
        setCreateTitle('');
        setSelectedTemplate('');

        // Refresh pages
        await loadCustomerPages();

        // Open the new page
        if (data.page?.url) {
          window.open(data.page.url, '_blank');
        }
      } else {
        setError('Failed to create page');
      }
    } catch (err) {
      setError('Failed to create page');
    } finally {
      setCreating(false);
    }
  };

  const handlePageClick = (page: NotionPage) => {
    setSelectedPage(page);
    onPageSelect?.(page);
  };

  // ============================================
  // Render helpers
  // ============================================

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  };

  // ============================================
  // Loading state
  // ============================================

  if (loading) {
    return (
      <div className="flex items-center justify-center h-48">
        <div className="animate-spin rounded-full h-8 w-8 border-2 border-cscx-accent border-t-transparent" />
      </div>
    );
  }

  // ============================================
  // Not connected state
  // ============================================

  if (!status?.connected) {
    return (
      <div className={`bg-cscx-gray-900 rounded-xl border border-cscx-gray-800 ${compact ? 'p-4' : 'p-8'}`}>
        <div className="text-center max-w-md mx-auto">
          {!compact && (
            <>
              <div className="w-16 h-16 mx-auto mb-4 bg-cscx-gray-800 rounded-lg flex items-center justify-center">
                <svg className="w-8 h-8 text-white" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M4.459 4.208c.746.606 1.026.56 2.428.466l13.215-.793c.28 0 .047-.28-.046-.326L17.86 1.968c-.42-.326-.98-.7-2.055-.607L3.01 2.295c-.466.046-.56.28-.374.466l1.823 1.447zm.793 3.08v13.904c0 .747.373 1.027 1.214.98l14.523-.84c.841-.046.935-.56.935-1.167V6.354c0-.606-.233-.933-.748-.887l-15.177.887c-.56.047-.747.327-.747.933zm14.337.745c.093.42 0 .84-.42.888l-.7.14v10.264c-.608.327-1.168.514-1.635.514-.748 0-.935-.234-1.495-.933l-4.577-7.186v6.952l1.448.327s0 .84-1.168.84l-3.22.186c-.094-.186 0-.653.327-.746l.84-.233V9.854L7.822 9.76c-.094-.42.14-1.026.793-1.073l3.454-.233 4.763 7.279v-6.44l-1.215-.14c-.093-.513.28-.886.747-.933l3.223-.186z" />
                </svg>
              </div>
              <h2 className="text-xl font-bold text-white mb-2">Connect Notion</h2>
              <p className="text-cscx-gray-400 mb-6 text-sm">
                Link your Notion workspace to access customer documentation, meeting notes, and success plans directly in CSCX.AI.
              </p>
            </>
          )}

          <button
            onClick={handleConnect}
            disabled={connecting}
            className="w-full flex items-center justify-center gap-3 bg-white hover:bg-gray-100 text-gray-900 font-medium py-3 px-4 rounded-lg transition-colors disabled:opacity-50"
          >
            {connecting ? (
              <div className="animate-spin rounded-full h-5 w-5 border-2 border-gray-900 border-t-transparent" />
            ) : (
              <>
                <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M4.459 4.208c.746.606 1.026.56 2.428.466l13.215-.793c.28 0 .047-.28-.046-.326L17.86 1.968c-.42-.326-.98-.7-2.055-.607L3.01 2.295c-.466.046-.56.28-.374.466l1.823 1.447zm.793 3.08v13.904c0 .747.373 1.027 1.214.98l14.523-.84c.841-.046.935-.56.935-1.167V6.354c0-.606-.233-.933-.748-.887l-15.177.887c-.56.047-.747.327-.747.933zm14.337.745c.093.42 0 .84-.42.888l-.7.14v10.264c-.608.327-1.168.514-1.635.514-.748 0-.935-.234-1.495-.933l-4.577-7.186v6.952l1.448.327s0 .84-1.168.84l-3.22.186c-.094-.186 0-.653.327-.746l.84-.233V9.854L7.822 9.76c-.094-.42.14-1.026.793-1.073l3.454-.233 4.763 7.279v-6.44l-1.215-.14c-.093-.513.28-.886.747-.933l3.223-.186z" />
                </svg>
                Connect Notion
              </>
            )}
          </button>

          {error && <p className="mt-4 text-sm text-red-400">{error}</p>}
        </div>
      </div>
    );
  }

  // ============================================
  // Compact view (for embedding)
  // ============================================

  if (compact) {
    return (
      <div className="bg-cscx-gray-900 rounded-xl border border-cscx-gray-800 p-4">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <svg className="w-5 h-5 text-white" viewBox="0 0 24 24" fill="currentColor">
              <path d="M4.459 4.208c.746.606 1.026.56 2.428.466l13.215-.793c.28 0 .047-.28-.046-.326L17.86 1.968c-.42-.326-.98-.7-2.055-.607L3.01 2.295c-.466.046-.56.28-.374.466l1.823 1.447zm.793 3.08v13.904c0 .747.373 1.027 1.214.98l14.523-.84c.841-.046.935-.56.935-1.167V6.354c0-.606-.233-.933-.748-.887l-15.177.887c-.56.047-.747.327-.747.933zm14.337.745c.093.42 0 .84-.42.888l-.7.14v10.264c-.608.327-1.168.514-1.635.514-.748 0-.935-.234-1.495-.933l-4.577-7.186v6.952l1.448.327s0 .84-1.168.84l-3.22.186c-.094-.186 0-.653.327-.746l.84-.233V9.854L7.822 9.76c-.094-.42.14-1.026.793-1.073l3.454-.233 4.763 7.279v-6.44l-1.215-.14c-.093-.513.28-.886.747-.933l3.223-.186z" />
            </svg>
            <span className="text-white font-medium text-sm">Notion Docs</span>
          </div>
          <button
            onClick={handleSync}
            disabled={syncing}
            className="text-xs text-cscx-gray-400 hover:text-white"
          >
            {syncing ? 'Syncing...' : 'Sync'}
          </button>
        </div>

        {pages.length === 0 ? (
          <p className="text-cscx-gray-500 text-sm">No linked pages</p>
        ) : (
          <div className="space-y-2 max-h-48 overflow-y-auto">
            {pages.slice(0, 5).map((page) => (
              <a
                key={page.id}
                href={page.url}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2 p-2 bg-cscx-gray-800 rounded-lg hover:bg-cscx-gray-700 transition-colors"
              >
                <span className="text-sm">{page.icon || '📄'}</span>
                <span className="text-white text-sm truncate flex-1">{page.title}</span>
              </a>
            ))}
          </div>
        )}

        <button
          onClick={() => setShowCreateModal(true)}
          className="w-full mt-3 py-2 text-sm text-cscx-accent hover:text-white border border-cscx-gray-700 rounded-lg transition-colors"
        >
          + Create Page
        </button>
      </div>
    );
  }

  // ============================================
  // Full view
  // ============================================

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-cscx-gray-900 rounded-xl border border-cscx-gray-800 p-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-full bg-white flex items-center justify-center">
              <svg className="w-7 h-7" viewBox="0 0 24 24" fill="black">
                <path d="M4.459 4.208c.746.606 1.026.56 2.428.466l13.215-.793c.28 0 .047-.28-.046-.326L17.86 1.968c-.42-.326-.98-.7-2.055-.607L3.01 2.295c-.466.046-.56.28-.374.466l1.823 1.447zm.793 3.08v13.904c0 .747.373 1.027 1.214.98l14.523-.84c.841-.046.935-.56.935-1.167V6.354c0-.606-.233-.933-.748-.887l-15.177.887c-.56.047-.747.327-.747.933zm14.337.745c.093.42 0 .84-.42.888l-.7.14v10.264c-.608.327-1.168.514-1.635.514-.748 0-.935-.234-1.495-.933l-4.577-7.186v6.952l1.448.327s0 .84-1.168.84l-3.22.186c-.094-.186 0-.653.327-.746l.84-.233V9.854L7.822 9.76c-.094-.42.14-1.026.793-1.073l3.454-.233 4.763 7.279v-6.44l-1.215-.14c-.093-.513.28-.886.747-.933l3.223-.186z" />
              </svg>
            </div>
            <div>
              <h2 className="text-xl font-semibold text-white">Notion Connected</h2>
              <p className="text-sm text-cscx-gray-400">{status.workspaceName}</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={handleSync}
              disabled={syncing}
              className="px-4 py-2 bg-cscx-gray-800 hover:bg-cscx-gray-700 text-white rounded-lg transition-colors flex items-center gap-2 disabled:opacity-50"
            >
              {syncing ? (
                <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent" />
              ) : (
                <span>Sync Pages</span>
              )}
            </button>
            <button
              onClick={handleDisconnect}
              className="px-4 py-2 text-red-400 hover:text-red-300 hover:bg-cscx-gray-800 rounded-lg transition-colors"
            >
              Disconnect
            </button>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-3 gap-4 mt-6">
          <div className="bg-cscx-gray-800 rounded-lg p-4">
            <p className="text-2xl font-bold text-white">{pages.length}</p>
            <p className="text-sm text-cscx-gray-400">Linked Pages</p>
          </div>
          <div className="bg-cscx-gray-800 rounded-lg p-4">
            <p className="text-2xl font-bold text-white">{databases.length}</p>
            <p className="text-sm text-cscx-gray-400">Databases</p>
          </div>
          <div className="bg-cscx-gray-800 rounded-lg p-4">
            <p className="text-2xl font-bold text-white">
              {status.lastSyncAt ? formatDate(status.lastSyncAt) : 'Never'}
            </p>
            <p className="text-sm text-cscx-gray-400">Last Sync</p>
          </div>
        </div>
      </div>

      {/* Search */}
      <div className="bg-cscx-gray-900 rounded-xl border border-cscx-gray-800 p-4">
        <div className="flex gap-3">
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
            placeholder="Search Notion pages..."
            className="flex-1 px-4 py-2 bg-cscx-gray-800 border border-cscx-gray-700 rounded-lg text-white placeholder-cscx-gray-500 focus:outline-none focus:border-cscx-accent"
          />
          <button
            onClick={handleSearch}
            disabled={searching}
            className="px-6 py-2 bg-cscx-accent hover:bg-cscx-accent/90 text-white rounded-lg transition-colors disabled:opacity-50"
          >
            {searching ? 'Searching...' : 'Search'}
          </button>
        </div>

        {searchResults.length > 0 && (
          <div className="mt-4 space-y-2">
            <p className="text-sm text-cscx-gray-400 mb-2">
              Found {searchResults.length} pages
            </p>
            {searchResults.map((page) => (
              <a
                key={page.id}
                href={page.url}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-3 p-3 bg-cscx-gray-800 rounded-lg hover:bg-cscx-gray-700 transition-colors"
              >
                <span className="text-lg">{page.icon || '📄'}</span>
                <div className="flex-1">
                  <p className="text-white font-medium">{page.title}</p>
                  <p className="text-xs text-cscx-gray-500">
                    Last edited {formatDate(page.lastEditedAt)}
                  </p>
                </div>
                <svg className="w-4 h-4 text-cscx-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                </svg>
              </a>
            ))}
          </div>
        )}
      </div>

      {/* Tabs */}
      <div className="flex gap-1 p-1 bg-cscx-gray-900 rounded-lg w-fit">
        {(['pages', 'databases', 'create'] as const).map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-4 py-2 text-sm font-medium rounded-md transition-colors capitalize ${
              activeTab === tab
                ? 'bg-cscx-accent text-white'
                : 'text-cscx-gray-400 hover:text-white hover:bg-cscx-gray-800'
            }`}
          >
            {tab === 'create' ? 'Create Page' : tab}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      <div className="bg-cscx-gray-900 rounded-xl border border-cscx-gray-800 p-6">
        {/* Pages Tab */}
        {activeTab === 'pages' && (
          <>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-white">
                {customerName ? `Pages for ${customerName}` : 'Linked Pages'}
              </h3>
            </div>

            {pages.length === 0 ? (
              <div className="text-center py-12">
                <p className="text-cscx-gray-500 mb-4">No pages linked yet</p>
                <button
                  onClick={handleSync}
                  className="px-4 py-2 bg-cscx-gray-800 hover:bg-cscx-gray-700 text-white rounded-lg transition-colors"
                >
                  Sync Pages
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {pages.map((page) => (
                  <div
                    key={page.id}
                    onClick={() => handlePageClick(page)}
                    className="bg-cscx-gray-800 rounded-lg p-4 hover:bg-cscx-gray-700 transition-colors cursor-pointer"
                  >
                    <div className="flex items-start gap-3">
                      <span className="text-2xl">{page.icon || '📄'}</span>
                      <div className="flex-1 min-w-0">
                        <h4 className="text-white font-medium truncate">{page.title}</h4>
                        <p className="text-xs text-cscx-gray-500 mt-1">
                          Last edited {formatDate(page.lastEditedAt)}
                        </p>
                        <a
                          href={page.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          onClick={(e) => e.stopPropagation()}
                          className="text-xs text-cscx-accent hover:underline mt-2 inline-flex items-center gap-1"
                        >
                          Open in Notion
                          <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                          </svg>
                        </a>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </>
        )}

        {/* Databases Tab */}
        {activeTab === 'databases' && (
          <>
            <h3 className="text-lg font-semibold text-white mb-4">Accessible Databases</h3>

            {databases.length === 0 ? (
              <p className="text-cscx-gray-500">No databases accessible</p>
            ) : (
              <div className="space-y-3">
                {databases.map((db) => (
                  <a
                    key={db.id}
                    href={db.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-start gap-3 p-4 bg-cscx-gray-800 rounded-lg hover:bg-cscx-gray-700 transition-colors"
                  >
                    <span className="text-2xl">{db.icon || '🗃️'}</span>
                    <div className="flex-1">
                      <h4 className="text-white font-medium">{db.title}</h4>
                      {db.description && (
                        <p className="text-sm text-cscx-gray-400 mt-1">{db.description}</p>
                      )}
                      <p className="text-xs text-cscx-gray-500 mt-2">
                        {db.properties.length} properties
                      </p>
                    </div>
                    <svg className="w-4 h-4 text-cscx-gray-500 mt-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                    </svg>
                  </a>
                ))}
              </div>
            )}
          </>
        )}

        {/* Create Page Tab */}
        {activeTab === 'create' && (
          <>
            <h3 className="text-lg font-semibold text-white mb-4">Create New Page</h3>

            <div className="space-y-4 max-w-md">
              <div>
                <label className="block text-sm text-cscx-gray-400 mb-2">Page Title</label>
                <input
                  type="text"
                  value={createTitle}
                  onChange={(e) => setCreateTitle(e.target.value)}
                  placeholder={customerName ? `${customerName} - ` : 'Enter title...'}
                  className="w-full px-4 py-2 bg-cscx-gray-800 border border-cscx-gray-700 rounded-lg text-white placeholder-cscx-gray-500 focus:outline-none focus:border-cscx-accent"
                />
              </div>

              <div>
                <label className="block text-sm text-cscx-gray-400 mb-2">Template (optional)</label>
                <select
                  value={selectedTemplate}
                  onChange={(e) => setSelectedTemplate(e.target.value)}
                  className="w-full px-4 py-2 bg-cscx-gray-800 border border-cscx-gray-700 rounded-lg text-white focus:outline-none focus:border-cscx-accent"
                >
                  <option value="">No template</option>
                  {templates.map((template) => (
                    <option key={template.id} value={template.id}>
                      {template.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm text-cscx-gray-400 mb-2">Database</label>
                <select
                  value={selectedDatabase}
                  onChange={(e) => setSelectedDatabase(e.target.value)}
                  className="w-full px-4 py-2 bg-cscx-gray-800 border border-cscx-gray-700 rounded-lg text-white focus:outline-none focus:border-cscx-accent"
                >
                  <option value="">Select database...</option>
                  {databases.map((db) => (
                    <option key={db.id} value={db.id}>
                      {db.icon || '🗃️'} {db.title}
                    </option>
                  ))}
                </select>
              </div>

              <button
                onClick={handleCreatePage}
                disabled={creating || !createTitle.trim() || !selectedDatabase}
                className="w-full px-4 py-3 bg-cscx-accent hover:bg-cscx-accent/90 text-white font-medium rounded-lg transition-colors disabled:opacity-50"
              >
                {creating ? 'Creating...' : 'Create Page'}
              </button>
            </div>
          </>
        )}
      </div>

      {/* Page Preview Modal */}
      {selectedPage && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-cscx-gray-900 rounded-xl border border-cscx-gray-800 w-full max-w-2xl max-h-[80vh] overflow-hidden">
            <div className="flex items-center justify-between p-4 border-b border-cscx-gray-800">
              <div className="flex items-center gap-2">
                <span className="text-xl">{selectedPage.icon || '📄'}</span>
                <h3 className="text-lg font-semibold text-white">{selectedPage.title}</h3>
              </div>
              <div className="flex items-center gap-2">
                <a
                  href={selectedPage.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="px-3 py-1 text-sm bg-cscx-gray-800 hover:bg-cscx-gray-700 text-white rounded-lg transition-colors"
                >
                  Open in Notion
                </a>
                <button
                  onClick={() => setSelectedPage(null)}
                  className="p-1 hover:bg-cscx-gray-800 rounded"
                >
                  <svg className="w-5 h-5 text-cscx-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            </div>
            <div className="p-6 overflow-y-auto max-h-[calc(80vh-80px)]">
              {selectedPage.contentMarkdown ? (
                <div className="prose prose-invert prose-sm max-w-none">
                  <pre className="whitespace-pre-wrap text-cscx-gray-300 text-sm font-sans">
                    {selectedPage.contentMarkdown}
                  </pre>
                </div>
              ) : (
                <p className="text-cscx-gray-500">Loading content...</p>
              )}
            </div>
          </div>
        </div>
      )}

      {error && (
        <div className="fixed bottom-4 right-4 bg-red-900/90 text-white px-4 py-3 rounded-lg shadow-lg">
          <div className="flex items-center gap-2">
            <span>{error}</span>
            <button onClick={() => setError(null)} className="text-red-200 hover:text-white">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export default NotionIntegration;
