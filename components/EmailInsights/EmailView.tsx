/**
 * EmailView — Email Insights & Sync Management
 *
 * Single-view component for the 5 email endpoints:
 *   GET  /api/email/sync/status   — sync status
 *   POST /api/email/sync          — trigger sync
 *   GET  /api/email/list           — list emails
 *   POST /api/email/summarize      — summarize selected / query-based
 *   POST /api/email/link-customers — link emails to a customer
 */

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { DataTable, Column } from '../shared/DataTable';
import { StatusBadge } from '../shared/StatusBadge';
import { useAuth } from '../../context/AuthContext';

const API_BASE = `${import.meta.env.VITE_API_URL || ''}/api`;

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface SyncStatus {
  lastSync: string | null;
  status: string;
  emailCount: number;
  connectedAccounts: number;
}

interface Email {
  id: string;
  subject: string;
  from: string;
  to: string;
  date: string;
  snippet: string;
  customer_id: string | null;
}

interface ActionItem {
  text: string;
  urgency: 'high' | 'medium' | 'low';
}

interface SummaryResult {
  summary: string;
  key_points: string[];
  action_items: ActionItem[];
  mentioned_customers: string[];
  sentiment: string;
  emailCount: number;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatDate(iso: string | null): string {
  if (!iso) return 'Never';
  const d = new Date(iso);
  return d.toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

const urgencyColor: Record<string, string> = {
  high: 'badge-error',
  medium: 'badge-warning',
  low: 'bg-cscx-gray-700/50 text-cscx-gray-400',
};

const sentimentColorMap: Record<string, string> = {
  positive: 'badge-success',
  neutral: 'bg-blue-500/20 text-blue-400',
  negative: 'badge-error',
  mixed: 'badge-warning',
};

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export const EmailView: React.FC = () => {
  const { getAuthHeaders, userId } = useAuth();

  // ------ Sync state ------
  const [syncStatus, setSyncStatus] = useState<SyncStatus | null>(null);
  const [syncLoading, setSyncLoading] = useState(false);
  const [syncing, setSyncing] = useState(false);

  // ------ Email list state ------
  const [emails, setEmails] = useState<Email[]>([]);
  const [emailsLoading, setEmailsLoading] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  // ------ Summary state ------
  const [summaryResult, setSummaryResult] = useState<SummaryResult | null>(null);
  const [summarizing, setSummarizing] = useState(false);

  // ------ Quick summarize ------
  const [searchQuery, setSearchQuery] = useState('');

  // ------ Link customer ------
  const [linkCustomerId, setLinkCustomerId] = useState('');
  const [linking, setLinking] = useState(false);
  const [linkMessage, setLinkMessage] = useState<string | null>(null);

  // ------ Error state ------
  const [error, setError] = useState<string | null>(null);

  // ------ Request headers ------
  const headers = useMemo(
    () => ({
      'x-user-id': userId || '',
      'Content-Type': 'application/json',
      ...getAuthHeaders(),
    }),
    [userId, getAuthHeaders],
  );

  // ====================================================================
  // Fetch: Sync Status
  // ====================================================================

  const fetchSyncStatus = useCallback(async () => {
    setSyncLoading(true);
    try {
      const res = await fetch(`${API_BASE}/email/sync/status`, { headers });
      if (!res.ok) throw new Error(`Sync status failed (${res.status})`);
      const data: SyncStatus = await res.json();
      setSyncStatus(data);
    } catch (err: any) {
      setError(err.message ?? 'Failed to fetch sync status');
    } finally {
      setSyncLoading(false);
    }
  }, [headers]);

  // ====================================================================
  // Fetch: Email List
  // ====================================================================

  const fetchEmails = useCallback(async () => {
    setEmailsLoading(true);
    try {
      const res = await fetch(`${API_BASE}/email/list?limit=50`, { headers });
      if (!res.ok) throw new Error(`Email list failed (${res.status})`);
      const data: Email[] = await res.json();
      setEmails(data);
    } catch (err: any) {
      setError(err.message ?? 'Failed to load emails');
    } finally {
      setEmailsLoading(false);
    }
  }, [headers]);

  // ====================================================================
  // Action: Trigger Sync
  // ====================================================================

  const triggerSync = useCallback(async () => {
    setSyncing(true);
    setError(null);
    try {
      const res = await fetch(`${API_BASE}/email/sync`, {
        method: 'POST',
        headers,
      });
      if (!res.ok) throw new Error(`Sync trigger failed (${res.status})`);
      // Re-fetch status and emails after sync
      await Promise.all([fetchSyncStatus(), fetchEmails()]);
    } catch (err: any) {
      setError(err.message ?? 'Sync failed');
    } finally {
      setSyncing(false);
    }
  }, [headers, fetchSyncStatus, fetchEmails]);

  // ====================================================================
  // Action: Summarize Selected Emails
  // ====================================================================

  const summarizeSelected = useCallback(async () => {
    if (selectedIds.size === 0) return;
    setSummarizing(true);
    setError(null);
    try {
      const res = await fetch(`${API_BASE}/email/summarize`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ emailIds: Array.from(selectedIds) }),
      });
      if (!res.ok) throw new Error(`Summarize failed (${res.status})`);
      const data: SummaryResult = await res.json();
      setSummaryResult(data);
    } catch (err: any) {
      setError(err.message ?? 'Summarize failed');
    } finally {
      setSummarizing(false);
    }
  }, [selectedIds, headers]);

  // ====================================================================
  // Action: Quick Summarize (search query)
  // ====================================================================

  const quickSummarize = useCallback(async () => {
    if (!searchQuery.trim()) return;
    setSummarizing(true);
    setError(null);
    try {
      const res = await fetch(`${API_BASE}/email/summarize`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ query: searchQuery.trim(), limit: 20 }),
      });
      if (!res.ok) throw new Error(`Quick summarize failed (${res.status})`);
      const data: SummaryResult = await res.json();
      setSummaryResult(data);
    } catch (err: any) {
      setError(err.message ?? 'Quick summarize failed');
    } finally {
      setSummarizing(false);
    }
  }, [searchQuery, headers]);

  // ====================================================================
  // Action: Link Customers
  // ====================================================================

  const linkCustomers = useCallback(async () => {
    if (selectedIds.size === 0 || !linkCustomerId.trim()) return;
    setLinking(true);
    setLinkMessage(null);
    setError(null);
    try {
      const res = await fetch(`${API_BASE}/email/link-customers`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          emailIds: Array.from(selectedIds),
          customerId: linkCustomerId.trim(),
        }),
      });
      if (!res.ok) throw new Error(`Link failed (${res.status})`);
      setLinkMessage(`Linked ${selectedIds.size} email(s) to customer.`);
      setLinkCustomerId('');
      setSelectedIds(new Set());
      await fetchEmails();
    } catch (err: any) {
      setError(err.message ?? 'Link failed');
    } finally {
      setLinking(false);
    }
  }, [selectedIds, linkCustomerId, headers, fetchEmails]);

  // ====================================================================
  // Initial Load
  // ====================================================================

  useEffect(() => {
    fetchSyncStatus();
    fetchEmails();
  }, [fetchSyncStatus, fetchEmails]);

  // ====================================================================
  // Selection helpers
  // ====================================================================

  const toggleSelect = useCallback((id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const toggleSelectAll = useCallback(() => {
    if (selectedIds.size === emails.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(emails.map(e => e.id)));
    }
  }, [emails, selectedIds.size]);

  // ====================================================================
  // Table columns
  // ====================================================================

  const columns: Column<Email>[] = useMemo(
    () => [
      {
        key: '_select',
        label: '',
        className: 'w-8',
        render: (item: Email) => (
          <input
            type="checkbox"
            checked={selectedIds.has(item.id)}
            onChange={() => toggleSelect(item.id)}
            className="accent-cscx-accent"
          />
        ),
      },
      {
        key: 'subject',
        label: 'Subject',
        sortable: true,
        render: (item: Email) => (
          <span className="text-white font-medium truncate max-w-xs block" title={item.subject}>
            {item.subject || '(no subject)'}
          </span>
        ),
      },
      {
        key: 'from',
        label: 'From',
        sortable: true,
        render: (item: Email) => (
          <span className="text-cscx-gray-300 truncate max-w-[200px] block" title={item.from}>
            {item.from}
          </span>
        ),
      },
      {
        key: 'date',
        label: 'Date',
        sortable: true,
        render: (item: Email) => (
          <span className="text-cscx-gray-400 text-xs whitespace-nowrap">
            {formatDate(item.date)}
          </span>
        ),
      },
      {
        key: 'customer_id',
        label: 'Customer',
        render: (item: Email) =>
          item.customer_id ? (
            <StatusBadge status="active" colorMap={{ active: 'badge-success' }} />
          ) : (
            <span className="text-cscx-gray-500 text-xs">Unlinked</span>
          ),
      },
    ],
    [selectedIds, toggleSelect],
  );

  // ====================================================================
  // Render
  // ====================================================================

  return (
    <div className="space-y-6">
      {/* ---------- Header ---------- */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-white">Email Insights</h2>
          <p className="text-sm text-cscx-gray-400 mt-1">
            Sync, browse, and summarize email communications
          </p>
        </div>
      </div>

      {/* ---------- Error banner ---------- */}
      {error && (
        <div className="bg-red-500/10 border border-red-500/30 rounded-lg px-4 py-3 text-sm text-red-400 flex items-center justify-between">
          <span>{error}</span>
          <button
            onClick={() => setError(null)}
            className="text-red-400 hover:text-red-300 ml-4 text-lg leading-none"
          >
            &times;
          </button>
        </div>
      )}

      {/* ================================================================ */}
      {/* Sync Status Card                                                 */}
      {/* ================================================================ */}
      <div className="card p-5">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-md font-semibold text-white">Sync Status</h3>
          <button
            onClick={triggerSync}
            disabled={syncing}
            className="btn btn-primary text-sm flex items-center gap-2"
          >
            {syncing ? (
              <>
                <span className="animate-spin inline-block h-4 w-4 border-2 border-white/30 border-t-white rounded-full" />
                Syncing...
              </>
            ) : (
              'Sync Now'
            )}
          </button>
        </div>

        {syncLoading && !syncStatus ? (
          <div className="flex items-center justify-center py-6">
            <div className="animate-spin rounded-full h-5 w-5 border-2 border-cscx-accent border-t-transparent" />
          </div>
        ) : syncStatus ? (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <div>
              <p className="text-xs text-cscx-gray-400 uppercase tracking-wider mb-1">Last Sync</p>
              <p className="text-sm text-white font-medium">{formatDate(syncStatus.lastSync)}</p>
            </div>
            <div>
              <p className="text-xs text-cscx-gray-400 uppercase tracking-wider mb-1">Status</p>
              <StatusBadge
                status={syncStatus.status}
                colorMap={{
                  connected: 'badge-success',
                  syncing: 'badge-warning',
                  disconnected: 'badge-error',
                  idle: 'bg-cscx-gray-700/50 text-cscx-gray-400',
                }}
              />
            </div>
            <div>
              <p className="text-xs text-cscx-gray-400 uppercase tracking-wider mb-1">Emails</p>
              <p className="text-sm text-white font-medium">
                {syncStatus.emailCount.toLocaleString()}
              </p>
            </div>
            <div>
              <p className="text-xs text-cscx-gray-400 uppercase tracking-wider mb-1">
                Connected Accounts
              </p>
              <p className="text-sm text-white font-medium">{syncStatus.connectedAccounts}</p>
            </div>
          </div>
        ) : (
          <p className="text-sm text-cscx-gray-400">Unable to load sync status.</p>
        )}
      </div>

      {/* ================================================================ */}
      {/* Email Summaries — main content                                   */}
      {/* ================================================================ */}
      <div className="card p-5">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-md font-semibold text-white">
            Emails{' '}
            {emails.length > 0 && (
              <span className="text-cscx-gray-400 font-normal text-sm">({emails.length})</span>
            )}
          </h3>

          {/* Select-all toggle */}
          {emails.length > 0 && (
            <label className="flex items-center gap-2 text-xs text-cscx-gray-400 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={selectedIds.size === emails.length && emails.length > 0}
                onChange={toggleSelectAll}
                className="accent-cscx-accent"
              />
              Select all
            </label>
          )}
        </div>

        {/* Quick Summarize search */}
        <div className="flex items-center gap-2 mb-4">
          <input
            type="text"
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && quickSummarize()}
            placeholder="Quick summarize — search emails by keyword..."
            className="input text-sm py-2 flex-1"
          />
          <button
            onClick={quickSummarize}
            disabled={!searchQuery.trim() || summarizing}
            className="btn btn-primary text-sm whitespace-nowrap"
          >
            {summarizing && selectedIds.size === 0 ? 'Searching...' : 'Quick Summarize'}
          </button>
        </div>

        {/* Data table */}
        <DataTable<Email>
          columns={columns}
          data={emails}
          loading={emailsLoading}
          emptyMessage="No emails found. Try syncing first."
          searchable
          searchKeys={['subject', 'from', 'snippet']}
          pageSize={20}
          rowKey={(item: Email) => item.id}
        />

        {/* Actions bar (visible when emails selected) */}
        {selectedIds.size > 0 && (
          <div className="mt-4 flex flex-wrap items-center gap-3 bg-cscx-gray-800/50 border border-cscx-gray-700 rounded-lg px-4 py-3">
            <span className="text-xs text-cscx-gray-300">
              {selectedIds.size} email{selectedIds.size > 1 ? 's' : ''} selected
            </span>

            <button
              onClick={summarizeSelected}
              disabled={summarizing}
              className="btn btn-primary text-sm"
            >
              {summarizing && selectedIds.size > 0 ? 'Summarizing...' : 'Summarize Selected'}
            </button>

            {/* Link to customer */}
            <div className="flex items-center gap-2 ml-auto">
              <input
                type="text"
                value={linkCustomerId}
                onChange={e => setLinkCustomerId(e.target.value)}
                placeholder="Customer ID"
                className="input text-sm py-1.5 w-40"
              />
              <button
                onClick={linkCustomers}
                disabled={linking || !linkCustomerId.trim()}
                className="btn text-sm bg-cscx-gray-700 hover:bg-cscx-gray-600 text-white"
              >
                {linking ? 'Linking...' : 'Link Customer'}
              </button>
            </div>
          </div>
        )}

        {/* Link success message */}
        {linkMessage && (
          <div className="mt-3 bg-green-500/10 border border-green-500/30 rounded-lg px-4 py-2 text-sm text-green-400 flex items-center justify-between">
            <span>{linkMessage}</span>
            <button
              onClick={() => setLinkMessage(null)}
              className="text-green-400 hover:text-green-300 ml-4 text-lg leading-none"
            >
              &times;
            </button>
          </div>
        )}
      </div>

      {/* ================================================================ */}
      {/* Summary Results                                                  */}
      {/* ================================================================ */}
      {summaryResult && (
        <div className="card p-5 space-y-5">
          <div className="flex items-center justify-between">
            <h3 className="text-md font-semibold text-white">
              Summary{' '}
              <span className="text-cscx-gray-400 font-normal text-sm">
                ({summaryResult.emailCount} email{summaryResult.emailCount !== 1 ? 's' : ''})
              </span>
            </h3>
            <div className="flex items-center gap-2">
              <StatusBadge status={summaryResult.sentiment} colorMap={sentimentColorMap} />
              <button
                onClick={() => setSummaryResult(null)}
                className="text-cscx-gray-400 hover:text-cscx-gray-300 text-sm"
              >
                Dismiss
              </button>
            </div>
          </div>

          {/* Summary text */}
          <div className="bg-cscx-gray-800/50 border border-cscx-gray-700 rounded-lg p-4">
            <p className="text-sm text-cscx-gray-300 leading-relaxed">{summaryResult.summary}</p>
          </div>

          {/* Key points */}
          {summaryResult.key_points.length > 0 && (
            <div>
              <h4 className="text-sm font-semibold text-white mb-2">Key Points</h4>
              <ul className="space-y-1.5">
                {summaryResult.key_points.map((point, i) => (
                  <li key={i} className="flex items-start gap-2 text-sm text-cscx-gray-300">
                    <span className="text-cscx-accent mt-0.5">&#x2022;</span>
                    <span>{point}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Action items */}
          {summaryResult.action_items.length > 0 && (
            <div>
              <h4 className="text-sm font-semibold text-white mb-2">Action Items</h4>
              <div className="space-y-2">
                {summaryResult.action_items.map((item, i) => (
                  <div
                    key={i}
                    className="flex items-center gap-3 bg-cscx-gray-800/30 rounded-lg px-3 py-2"
                  >
                    <span
                      className={`badge text-xs ${urgencyColor[item.urgency] || urgencyColor.low}`}
                    >
                      {item.urgency}
                    </span>
                    <span className="text-sm text-cscx-gray-300">{item.text}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Mentioned customers */}
          {summaryResult.mentioned_customers.length > 0 && (
            <div>
              <h4 className="text-sm font-semibold text-white mb-2">Mentioned Customers</h4>
              <div className="flex flex-wrap gap-2">
                {summaryResult.mentioned_customers.map((name, i) => (
                  <span
                    key={i}
                    className="bg-cscx-accent/10 text-cscx-accent text-xs font-medium px-2.5 py-1 rounded-full"
                  >
                    {name}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
