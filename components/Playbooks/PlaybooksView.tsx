/**
 * PlaybooksView - Playbook Management & Execution
 * Three tabs: Library | Active | Stats
 * Manages playbook browsing, CSM library search, execution, and monitoring.
 */

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useAuth } from '../../context/AuthContext';
import { DataTable, Column } from '../shared/DataTable';
import { StatusBadge } from '../shared/StatusBadge';
import { FilterBar, FilterConfig } from '../shared/FilterBar';

const API_URL = import.meta.env.VITE_API_URL || '';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface Playbook {
  id: string;
  name: string;
  type: string;
  description: string;
  steps: any[];
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

interface CsmPlaybook {
  id: string;
  category: string;
  subcategory: string;
  title: string;
  summary: string;
  use_cases: string[];
  tags: string[];
  created_at: string;
  similarity?: number;
}

interface PlaybookExecution {
  id: string;
  playbookId: string;
  playbookName: string;
  customerId: string;
  customerName: string;
  currentStep: number;
  totalSteps: number;
  status: string;
  startedAt: string;
}

interface Customer {
  id: string;
  name: string;
}

interface PlaybookStats {
  totalPlaybooks?: number;
  totalExecutions?: number;
  completionRate?: number;
  avgDurationDays?: number;
  activeExecutions?: number;
  [key: string]: any;
}

interface PlaybooksViewProps {
  onSelectCustomer?: (customer: { id: string; name: string }) => void;
}

type Tab = 'library' | 'active' | 'stats';

// ---------------------------------------------------------------------------
// Main Component
// ---------------------------------------------------------------------------

export const PlaybooksView: React.FC<PlaybooksViewProps> = ({ onSelectCustomer }) => {
  const { getAuthHeaders, userId } = useAuth();
  const [activeTab, setActiveTab] = useState<Tab>('library');

  const tabs: { key: Tab; label: string }[] = [
    { key: 'library', label: 'Library' },
    { key: 'active', label: 'Active' },
    { key: 'stats', label: 'Stats' },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-xl font-semibold text-white">Playbooks</h2>
        <p className="text-sm text-cscx-gray-400 mt-1">
          Create, manage, and execute customer success playbooks
        </p>
      </div>

      {/* Tab bar */}
      <div className="flex gap-1 bg-cscx-gray-900 p-1 rounded-lg w-fit">
        {tabs.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={`px-4 py-1.5 text-sm font-medium transition-colors ${
              activeTab === tab.key
                ? 'bg-cscx-accent text-white rounded-md'
                : 'text-cscx-gray-400 hover:text-white'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab content */}
      {activeTab === 'library' && (
        <LibraryTab
          getAuthHeaders={getAuthHeaders}
          userId={userId}
          onSelectCustomer={onSelectCustomer}
        />
      )}
      {activeTab === 'active' && (
        <ActiveTab
          getAuthHeaders={getAuthHeaders}
          userId={userId}
          onSelectCustomer={onSelectCustomer}
        />
      )}
      {activeTab === 'stats' && (
        <StatsTab getAuthHeaders={getAuthHeaders} />
      )}
    </div>
  );
};

// ---------------------------------------------------------------------------
// Library Tab
// ---------------------------------------------------------------------------

const LibraryTab: React.FC<{
  getAuthHeaders: () => Record<string, string>;
  userId: string;
  onSelectCustomer?: (customer: { id: string; name: string }) => void;
}> = ({ getAuthHeaders, userId, onSelectCustomer }) => {
  const [playbooks, setPlaybooks] = useState<Playbook[]>([]);
  const [csmPlaybooks, setCsmPlaybooks] = useState<CsmPlaybook[]>([]);
  const [loading, setLoading] = useState(true);
  const [csmLoading, setCsmLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedPlaybook, setSelectedPlaybook] = useState<Playbook | null>(null);
  const [selectedCsm, setSelectedCsm] = useState<CsmPlaybook | null>(null);
  const [csmSearch, setCsmSearch] = useState('');
  const [csmSearchResults, setCsmSearchResults] = useState<CsmPlaybook[] | null>(null);
  const [csmSearching, setCsmSearching] = useState(false);
  const [filterValues, setFilterValues] = useState<Record<string, string>>({ search: '', type: '' });

  const headers = useMemo(
    () => ({ 'Content-Type': 'application/json', ...getAuthHeaders() }),
    [getAuthHeaders],
  );

  // Fetch user playbooks
  const fetchPlaybooks = useCallback(async () => {
    try {
      setLoading(true);
      const res = await fetch(`${API_URL}/api/playbooks`, { headers });
      if (!res.ok) throw new Error('Failed to fetch playbooks');
      const data = await res.json();
      setPlaybooks(Array.isArray(data) ? data : []);
      setError(null);
    } catch (err) {
      setPlaybooks([]);
      setError(err instanceof Error ? err.message : 'Failed to load playbooks');
    } finally {
      setLoading(false);
    }
  }, [headers]);

  // Fetch CSM library
  const fetchCsmPlaybooks = useCallback(async () => {
    try {
      setCsmLoading(true);
      const res = await fetch(`${API_URL}/api/playbooks/csm`, { headers });
      if (!res.ok) throw new Error('Failed to fetch CSM playbooks');
      const data = await res.json();
      setCsmPlaybooks(Array.isArray(data) ? data : []);
    } catch {
      setCsmPlaybooks([]);
    } finally {
      setCsmLoading(false);
    }
  }, [headers]);

  // CSM search
  const handleCsmSearch = useCallback(async () => {
    if (!csmSearch.trim()) {
      setCsmSearchResults(null);
      return;
    }
    try {
      setCsmSearching(true);
      const res = await fetch(
        `${API_URL}/api/playbooks/csm/search?q=${encodeURIComponent(csmSearch)}`,
        { headers },
      );
      if (!res.ok) throw new Error('Search failed');
      const data = await res.json();
      setCsmSearchResults(Array.isArray(data) ? data : []);
    } catch {
      setCsmSearchResults([]);
    } finally {
      setCsmSearching(false);
    }
  }, [csmSearch, headers]);

  useEffect(() => {
    fetchPlaybooks();
    fetchCsmPlaybooks();
  }, [fetchPlaybooks, fetchCsmPlaybooks]);

  // Debounced CSM search
  useEffect(() => {
    if (!csmSearch.trim()) {
      setCsmSearchResults(null);
      return;
    }
    const timer = setTimeout(handleCsmSearch, 400);
    return () => clearTimeout(timer);
  }, [csmSearch, handleCsmSearch]);

  // Derive unique types for filter
  const typeOptions = useMemo(() => {
    const types = [...new Set(playbooks.map((p) => p.type).filter(Boolean))];
    return types.map((t) => ({ value: t, label: t }));
  }, [playbooks]);

  const filterConfigs: FilterConfig[] = [
    { key: 'search', label: 'Name', type: 'search', placeholder: 'Search playbooks...' },
    { key: 'type', label: 'All Types', type: 'select', options: typeOptions },
  ];

  const filteredPlaybooks = useMemo(() => {
    let items = [...playbooks];
    if (filterValues.search) {
      const q = filterValues.search.toLowerCase();
      items = items.filter(
        (p) =>
          p.name.toLowerCase().includes(q) ||
          p.description?.toLowerCase().includes(q),
      );
    }
    if (filterValues.type) {
      items = items.filter((p) => p.type === filterValues.type);
    }
    return items;
  }, [playbooks, filterValues]);

  const playbookColumns: Column<Playbook>[] = [
    {
      key: 'name',
      label: 'Name',
      sortable: true,
      render: (p) => <span className="font-medium text-white">{p.name}</span>,
    },
    { key: 'type', label: 'Type', sortable: true },
    {
      key: 'is_active',
      label: 'Status',
      render: (p) => <StatusBadge status={p.is_active ? 'active' : 'disabled'} />,
    },
    {
      key: 'steps',
      label: 'Steps',
      render: (p) => (
        <span className="text-cscx-gray-300">{Array.isArray(p.steps) ? p.steps.length : 0}</span>
      ),
    },
    {
      key: 'updated_at',
      label: 'Updated',
      sortable: true,
      render: (p) => (
        <span className="text-cscx-gray-400 text-xs">
          {new Date(p.updated_at).toLocaleDateString()}
        </span>
      ),
    },
  ];

  const csmColumns: Column<CsmPlaybook>[] = [
    {
      key: 'title',
      label: 'Title',
      sortable: true,
      render: (p) => <span className="font-medium text-white">{p.title}</span>,
    },
    { key: 'category', label: 'Category', sortable: true },
    { key: 'subcategory', label: 'Subcategory', sortable: true },
    {
      key: 'tags',
      label: 'Tags',
      render: (p) => (
        <div className="flex flex-wrap gap-1">
          {(p.tags || []).slice(0, 3).map((t) => (
            <span key={t} className="badge bg-cscx-gray-700/50 text-cscx-gray-300 text-xs">
              {t}
            </span>
          ))}
          {(p.tags || []).length > 3 && (
            <span className="text-xs text-cscx-gray-500">+{p.tags.length - 3}</span>
          )}
        </div>
      ),
    },
    {
      key: 'similarity',
      label: 'Match',
      render: (p) =>
        p.similarity != null ? (
          <span className="text-cscx-accent font-medium text-xs">
            {(p.similarity * 100).toFixed(0)}%
          </span>
        ) : null,
    },
  ];

  const displayedCsm = csmSearchResults ?? csmPlaybooks;

  return (
    <div className="space-y-8">
      {/* Error banner */}
      {error && (
        <div className="bg-red-500/10 border border-red-500/30 rounded-lg px-4 py-3 text-sm text-red-400">
          {error}
        </div>
      )}

      {/* User playbooks */}
      <section>
        <h3 className="text-lg font-medium text-white mb-4">Your Playbooks</h3>
        <FilterBar
          filters={filterConfigs}
          values={filterValues}
          onChange={(k, v) => setFilterValues((prev) => ({ ...prev, [k]: v }))}
          onReset={() => setFilterValues({ search: '', type: '' })}
        />
        <DataTable
          columns={playbookColumns}
          data={filteredPlaybooks}
          loading={loading}
          onRowClick={(p) => setSelectedPlaybook(p)}
          emptyMessage="No playbooks found. Create your first playbook to get started."
          rowKey={(p) => p.id}
        />
      </section>

      {/* CSM Library */}
      <section>
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-medium text-white">CSM Playbook Library</h3>
          <div className="flex items-center gap-2">
            <input
              type="text"
              placeholder="Semantic search..."
              value={csmSearch}
              onChange={(e) => setCsmSearch(e.target.value)}
              className="input text-sm py-1.5 px-3 max-w-[240px]"
            />
            {csmSearching && (
              <div className="animate-spin rounded-full h-4 w-4 border-2 border-cscx-accent border-t-transparent" />
            )}
          </div>
        </div>
        <DataTable
          columns={csmSearchResults ? csmColumns : csmColumns.filter((c) => c.key !== 'similarity')}
          data={displayedCsm}
          loading={csmLoading}
          onRowClick={(p) => setSelectedCsm(p)}
          emptyMessage={
            csmSearchResults
              ? 'No matching CSM playbooks found.'
              : 'No CSM playbooks available.'
          }
          rowKey={(p) => p.id}
        />
      </section>

      {/* Playbook detail modal */}
      {selectedPlaybook && (
        <PlaybookDetailModal
          playbook={selectedPlaybook}
          getAuthHeaders={getAuthHeaders}
          userId={userId}
          onClose={() => setSelectedPlaybook(null)}
          onRefresh={fetchPlaybooks}
          onSelectCustomer={onSelectCustomer}
        />
      )}

      {/* CSM detail modal */}
      {selectedCsm && (
        <CsmDetailModal
          playbook={selectedCsm}
          onClose={() => setSelectedCsm(null)}
        />
      )}
    </div>
  );
};

// ---------------------------------------------------------------------------
// Playbook Detail Modal (with execute)
// ---------------------------------------------------------------------------

const PlaybookDetailModal: React.FC<{
  playbook: Playbook;
  getAuthHeaders: () => Record<string, string>;
  userId: string;
  onClose: () => void;
  onRefresh: () => void;
  onSelectCustomer?: (customer: { id: string; name: string }) => void;
}> = ({ playbook, getAuthHeaders, userId, onClose, onRefresh, onSelectCustomer }) => {
  const [showExecute, setShowExecute] = useState(false);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loadingCustomers, setLoadingCustomers] = useState(false);
  const [selectedCustomerId, setSelectedCustomerId] = useState('');
  const [executing, setExecuting] = useState(false);
  const [executeError, setExecuteError] = useState<string | null>(null);
  const [executeSuccess, setExecuteSuccess] = useState(false);

  const headers = useMemo(
    () => ({ 'Content-Type': 'application/json', ...getAuthHeaders() }),
    [getAuthHeaders],
  );

  const fetchCustomers = useCallback(async () => {
    try {
      setLoadingCustomers(true);
      const res = await fetch(`${API_URL}/api/customers?limit=100`, { headers });
      if (!res.ok) throw new Error('Failed to fetch customers');
      const data = await res.json();
      setCustomers(data.customers || []);
    } catch {
      setCustomers([]);
    } finally {
      setLoadingCustomers(false);
    }
  }, [headers]);

  useEffect(() => {
    if (showExecute) fetchCustomers();
  }, [showExecute, fetchCustomers]);

  const handleExecute = async () => {
    if (!selectedCustomerId) return;
    try {
      setExecuting(true);
      setExecuteError(null);
      const res = await fetch(`${API_URL}/api/playbooks/${playbook.id}/execute`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ customerId: selectedCustomerId, executedBy: userId }),
      });
      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.error || 'Failed to execute playbook');
      }
      setExecuteSuccess(true);
      onRefresh();
    } catch (err) {
      setExecuteError(err instanceof Error ? err.message : 'Execution failed');
    } finally {
      setExecuting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-cscx-gray-900 border border-cscx-gray-800 rounded-xl max-w-2xl w-full max-h-[80vh] overflow-y-auto">
        {/* Header */}
        <div className="p-4 border-b border-cscx-gray-800 flex items-center justify-between">
          <h3 className="text-lg font-medium text-white">{playbook.name}</h3>
          <button
            onClick={onClose}
            className="p-2 text-cscx-gray-400 hover:text-white rounded-lg transition-colors"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Body */}
        <div className="p-4 space-y-4">
          <div className="flex items-center gap-3">
            <StatusBadge status={playbook.is_active ? 'active' : 'disabled'} />
            <span className="text-sm text-cscx-gray-400">Type: {playbook.type}</span>
            <span className="text-sm text-cscx-gray-400">
              {Array.isArray(playbook.steps) ? playbook.steps.length : 0} steps
            </span>
          </div>

          {playbook.description && (
            <p className="text-cscx-gray-300 text-sm">{playbook.description}</p>
          )}

          {/* Steps */}
          {Array.isArray(playbook.steps) && playbook.steps.length > 0 && (
            <div>
              <h4 className="text-sm font-medium text-cscx-gray-400 mb-2">Steps</h4>
              <ol className="space-y-2">
                {playbook.steps.map((step: any, idx: number) => (
                  <li
                    key={idx}
                    className="flex gap-3 text-sm bg-cscx-gray-800 rounded-lg px-3 py-2"
                  >
                    <span className="text-cscx-accent font-medium shrink-0">{idx + 1}.</span>
                    <span className="text-cscx-gray-300">
                      {typeof step === 'string' ? step : step.name || step.title || step.description || JSON.stringify(step)}
                    </span>
                  </li>
                ))}
              </ol>
            </div>
          )}

          {/* Execute section */}
          {!showExecute && !executeSuccess && (
            <button
              onClick={() => setShowExecute(true)}
              className="btn btn-primary w-full"
            >
              Execute Playbook
            </button>
          )}

          {showExecute && !executeSuccess && (
            <div className="bg-cscx-gray-800 rounded-lg p-4 space-y-3">
              <h4 className="text-sm font-medium text-white">Select Customer</h4>
              {loadingCustomers ? (
                <div className="flex items-center gap-2 text-sm text-cscx-gray-400">
                  <div className="animate-spin rounded-full h-4 w-4 border-2 border-cscx-accent border-t-transparent" />
                  Loading customers...
                </div>
              ) : (
                <select
                  value={selectedCustomerId}
                  onChange={(e) => setSelectedCustomerId(e.target.value)}
                  className="input w-full text-sm"
                >
                  <option value="">Choose a customer...</option>
                  {customers.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              )}

              {executeError && (
                <p className="text-sm text-red-400">{executeError}</p>
              )}

              <div className="flex justify-end gap-2">
                <button
                  onClick={() => setShowExecute(false)}
                  className="btn text-sm text-cscx-gray-400 hover:text-white"
                >
                  Cancel
                </button>
                <button
                  onClick={handleExecute}
                  disabled={!selectedCustomerId || executing}
                  className="btn btn-primary text-sm disabled:opacity-50 flex items-center gap-2"
                >
                  {executing && (
                    <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent" />
                  )}
                  {executing ? 'Executing...' : 'Execute'}
                </button>
              </div>
            </div>
          )}

          {executeSuccess && (
            <div className="bg-green-500/10 border border-green-500/30 rounded-lg px-4 py-3 text-sm text-green-400">
              Playbook execution started successfully. Switch to the Active tab to monitor progress.
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

// ---------------------------------------------------------------------------
// CSM Detail Modal
// ---------------------------------------------------------------------------

const CsmDetailModal: React.FC<{
  playbook: CsmPlaybook;
  onClose: () => void;
}> = ({ playbook, onClose }) => {
  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-cscx-gray-900 border border-cscx-gray-800 rounded-xl max-w-2xl w-full max-h-[80vh] overflow-y-auto">
        {/* Header */}
        <div className="p-4 border-b border-cscx-gray-800 flex items-center justify-between">
          <h3 className="text-lg font-medium text-white">{playbook.title}</h3>
          <button
            onClick={onClose}
            className="p-2 text-cscx-gray-400 hover:text-white rounded-lg transition-colors"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Body */}
        <div className="p-4 space-y-4">
          <div className="flex items-center gap-3 text-sm">
            <span className="badge bg-cscx-accent/20 text-cscx-accent">{playbook.category}</span>
            {playbook.subcategory && (
              <span className="text-cscx-gray-400">{playbook.subcategory}</span>
            )}
            {playbook.similarity != null && (
              <span className="text-cscx-accent font-medium">
                {(playbook.similarity * 100).toFixed(0)}% match
              </span>
            )}
          </div>

          {playbook.summary && (
            <p className="text-cscx-gray-300 text-sm">{playbook.summary}</p>
          )}

          {Array.isArray(playbook.use_cases) && playbook.use_cases.length > 0 && (
            <div>
              <h4 className="text-sm font-medium text-cscx-gray-400 mb-2">Use Cases</h4>
              <ul className="space-y-1">
                {playbook.use_cases.map((uc, idx) => (
                  <li key={idx} className="flex gap-2 text-sm text-cscx-gray-300">
                    <span className="text-cscx-accent shrink-0">-</span>
                    {uc}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {Array.isArray(playbook.tags) && playbook.tags.length > 0 && (
            <div>
              <h4 className="text-sm font-medium text-cscx-gray-400 mb-2">Tags</h4>
              <div className="flex flex-wrap gap-2">
                {playbook.tags.map((tag) => (
                  <span
                    key={tag}
                    className="badge bg-cscx-gray-700/50 text-cscx-gray-300 text-xs"
                  >
                    {tag}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

// ---------------------------------------------------------------------------
// Active Executions Tab
// ---------------------------------------------------------------------------

const ActiveTab: React.FC<{
  getAuthHeaders: () => Record<string, string>;
  userId: string;
  onSelectCustomer?: (customer: { id: string; name: string }) => void;
}> = ({ getAuthHeaders, userId, onSelectCustomer }) => {
  const [executions, setExecutions] = useState<PlaybookExecution[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedExecution, setSelectedExecution] = useState<PlaybookExecution | null>(null);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  const headers = useMemo(
    () => ({ 'Content-Type': 'application/json', ...getAuthHeaders() }),
    [getAuthHeaders],
  );

  const fetchExecutions = useCallback(async () => {
    try {
      setLoading(true);
      const res = await fetch(`${API_URL}/api/playbooks/active`, { headers });
      if (!res.ok) throw new Error('Failed to fetch active executions');
      const data = await res.json();
      setExecutions(Array.isArray(data) ? data : []);
      setError(null);
    } catch (err) {
      setExecutions([]);
      setError(err instanceof Error ? err.message : 'Failed to load executions');
    } finally {
      setLoading(false);
    }
  }, [headers]);

  useEffect(() => {
    fetchExecutions();
    const interval = setInterval(fetchExecutions, 15000);
    return () => clearInterval(interval);
  }, [fetchExecutions]);

  const handleAction = useCallback(
    async (executionId: string, action: 'advance' | 'skip' | 'pause' | 'resume' | 'cancel') => {
      try {
        setActionLoading(`${executionId}-${action}`);
        const res = await fetch(`${API_URL}/api/playbooks/v2/${executionId}/${action}`, {
          method: 'POST',
          headers,
        });
        if (!res.ok) {
          const errData = await res.json().catch(() => ({}));
          throw new Error(errData.error || `Failed to ${action} execution`);
        }
        fetchExecutions();
        // Refresh selected execution if it was the one acted on
        if (selectedExecution?.id === executionId) {
          const updated = await res.json().catch(() => null);
          if (updated) {
            setSelectedExecution((prev) =>
              prev?.id === executionId ? { ...prev, ...updated } : prev,
            );
          }
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : `Failed to ${action}`);
      } finally {
        setActionLoading(null);
      }
    },
    [headers, fetchExecutions, selectedExecution],
  );

  const columns: Column<PlaybookExecution>[] = [
    {
      key: 'playbookName',
      label: 'Playbook',
      sortable: true,
      render: (e) => <span className="font-medium text-white">{e.playbookName}</span>,
    },
    {
      key: 'customerName',
      label: 'Customer',
      sortable: true,
      render: (e) => (
        <button
          className="text-cscx-accent hover:underline text-left"
          onClick={(ev) => {
            ev.stopPropagation();
            onSelectCustomer?.({ id: e.customerId, name: e.customerName });
          }}
        >
          {e.customerName}
        </button>
      ),
    },
    {
      key: 'currentStep',
      label: 'Progress',
      render: (e) => (
        <div className="flex items-center gap-2">
          <div className="flex-1 h-1.5 bg-cscx-gray-800 rounded-full max-w-[80px]">
            <div
              className="h-full bg-cscx-accent rounded-full transition-all"
              style={{ width: `${e.totalSteps > 0 ? (e.currentStep / e.totalSteps) * 100 : 0}%` }}
            />
          </div>
          <span className="text-xs text-cscx-gray-400">
            {e.currentStep}/{e.totalSteps}
          </span>
        </div>
      ),
    },
    {
      key: 'status',
      label: 'Status',
      render: (e) => <StatusBadge status={e.status} />,
    },
    {
      key: 'startedAt',
      label: 'Started',
      sortable: true,
      render: (e) => (
        <span className="text-cscx-gray-400 text-xs">
          {new Date(e.startedAt).toLocaleDateString()}
        </span>
      ),
    },
  ];

  return (
    <div className="space-y-4">
      {error && (
        <div className="bg-red-500/10 border border-red-500/30 rounded-lg px-4 py-3 text-sm text-red-400 flex items-center justify-between">
          <span>{error}</span>
          <button onClick={() => setError(null)} className="text-red-400 hover:text-red-300">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      )}

      <DataTable
        columns={columns}
        data={executions}
        loading={loading}
        onRowClick={(e) => setSelectedExecution(e)}
        emptyMessage="No active executions. Execute a playbook from the Library tab."
        rowKey={(e) => e.id}
      />

      {/* Execution detail modal */}
      {selectedExecution && (
        <ExecutionDetailModal
          execution={selectedExecution}
          onClose={() => setSelectedExecution(null)}
          onAction={handleAction}
          actionLoading={actionLoading}
        />
      )}
    </div>
  );
};

// ---------------------------------------------------------------------------
// Execution Detail Modal
// ---------------------------------------------------------------------------

const ExecutionDetailModal: React.FC<{
  execution: PlaybookExecution;
  onClose: () => void;
  onAction: (executionId: string, action: 'advance' | 'skip' | 'pause' | 'resume' | 'cancel') => void;
  actionLoading: string | null;
}> = ({ execution, onClose, onAction, actionLoading }) => {
  const isLoading = (action: string) => actionLoading === `${execution.id}-${action}`;
  const anyLoading = actionLoading?.startsWith(execution.id) ?? false;

  const actionButtons: {
    action: 'advance' | 'skip' | 'pause' | 'resume' | 'cancel';
    label: string;
    className: string;
    showWhen: string[];
  }[] = [
    {
      action: 'advance',
      label: 'Advance',
      className: 'bg-green-500/20 text-green-400 hover:bg-green-500/30',
      showWhen: ['running', 'in_progress'],
    },
    {
      action: 'skip',
      label: 'Skip Step',
      className: 'bg-yellow-500/20 text-yellow-400 hover:bg-yellow-500/30',
      showWhen: ['running', 'in_progress'],
    },
    {
      action: 'pause',
      label: 'Pause',
      className: 'bg-blue-500/20 text-blue-400 hover:bg-blue-500/30',
      showWhen: ['running', 'in_progress'],
    },
    {
      action: 'resume',
      label: 'Resume',
      className: 'bg-green-500/20 text-green-400 hover:bg-green-500/30',
      showWhen: ['paused'],
    },
    {
      action: 'cancel',
      label: 'Cancel',
      className: 'bg-red-500/20 text-red-400 hover:bg-red-500/30',
      showWhen: ['running', 'in_progress', 'paused'],
    },
  ];

  const visibleActions = actionButtons.filter((a) =>
    a.showWhen.includes(execution.status.toLowerCase()),
  );

  // Build step visualization
  const steps = Array.from({ length: execution.totalSteps }, (_, i) => i + 1);

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-cscx-gray-900 border border-cscx-gray-800 rounded-xl max-w-2xl w-full max-h-[80vh] overflow-y-auto">
        {/* Header */}
        <div className="p-4 border-b border-cscx-gray-800 flex items-center justify-between">
          <div>
            <h3 className="text-lg font-medium text-white">{execution.playbookName}</h3>
            <p className="text-sm text-cscx-gray-400 mt-0.5">
              Customer: {execution.customerName}
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-cscx-gray-400 hover:text-white rounded-lg transition-colors"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Body */}
        <div className="p-4 space-y-5">
          {/* Status row */}
          <div className="flex items-center gap-4">
            <StatusBadge status={execution.status} />
            <span className="text-sm text-cscx-gray-400">
              Started {new Date(execution.startedAt).toLocaleString()}
            </span>
          </div>

          {/* Progress visualization */}
          <div>
            <h4 className="text-sm font-medium text-cscx-gray-400 mb-3">
              Progress ({execution.currentStep} of {execution.totalSteps})
            </h4>
            <div className="space-y-2">
              {steps.map((stepNum) => {
                const isCompleted = stepNum < execution.currentStep;
                const isCurrent = stepNum === execution.currentStep;
                const isPending = stepNum > execution.currentStep;

                return (
                  <div
                    key={stepNum}
                    className={`flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors ${
                      isCurrent
                        ? 'bg-cscx-accent/10 border border-cscx-accent/30'
                        : isCompleted
                          ? 'bg-green-500/5 border border-green-500/10'
                          : 'bg-cscx-gray-800/50 border border-transparent'
                    }`}
                  >
                    {/* Step indicator */}
                    <div
                      className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-medium shrink-0 ${
                        isCurrent
                          ? 'bg-cscx-accent text-white'
                          : isCompleted
                            ? 'bg-green-500/20 text-green-400'
                            : 'bg-cscx-gray-700 text-cscx-gray-500'
                      }`}
                    >
                      {isCompleted ? (
                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                        </svg>
                      ) : (
                        stepNum
                      )}
                    </div>

                    <span
                      className={
                        isCurrent
                          ? 'text-white font-medium'
                          : isCompleted
                            ? 'text-green-400/80'
                            : 'text-cscx-gray-500'
                      }
                    >
                      Step {stepNum}
                      {isCurrent && (
                        <span className="ml-2 text-cscx-accent text-xs">(current)</span>
                      )}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Action buttons */}
          {visibleActions.length > 0 && (
            <div className="flex flex-wrap gap-2 pt-4 border-t border-cscx-gray-800">
              {visibleActions.map((btn) => (
                <button
                  key={btn.action}
                  onClick={() => onAction(execution.id, btn.action)}
                  disabled={anyLoading}
                  className={`px-4 py-2 rounded-lg text-sm transition-colors disabled:opacity-50 flex items-center gap-2 ${btn.className}`}
                >
                  {isLoading(btn.action) && (
                    <div className="animate-spin rounded-full h-4 w-4 border-2 border-current border-t-transparent" />
                  )}
                  {btn.label}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

// ---------------------------------------------------------------------------
// Stats Tab
// ---------------------------------------------------------------------------

const StatsTab: React.FC<{
  getAuthHeaders: () => Record<string, string>;
}> = ({ getAuthHeaders }) => {
  const [stats, setStats] = useState<PlaybookStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  const headers = useMemo(
    () => ({ 'Content-Type': 'application/json', ...getAuthHeaders() }),
    [getAuthHeaders],
  );

  const fetchStats = useCallback(async () => {
    try {
      setLoading(true);
      const res = await fetch(`${API_URL}/api/playbooks/stats`, { headers });
      if (!res.ok) throw new Error('Failed to fetch stats');
      const data = await res.json();
      setStats(data);
      setError(false);
    } catch {
      setStats(null);
      setError(true);
    } finally {
      setLoading(false);
    }
  }, [headers]);

  useEffect(() => {
    fetchStats();
  }, [fetchStats]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-6 w-6 border-2 border-cscx-accent border-t-transparent" />
      </div>
    );
  }

  if (error || !stats) {
    return (
      <div className="card p-8 text-center">
        <svg
          className="w-12 h-12 text-cscx-gray-600 mx-auto mb-4"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"
          />
        </svg>
        <p className="text-cscx-gray-400 font-medium">Statistics coming soon</p>
        <p className="text-sm text-cscx-gray-500 mt-1">
          Playbook analytics will appear here once enough data is collected.
        </p>
      </div>
    );
  }

  const statCards: { label: string; value: string | number; sub?: string }[] = [
    {
      label: 'Total Playbooks',
      value: stats.totalPlaybooks ?? 0,
    },
    {
      label: 'Total Executions',
      value: stats.totalExecutions ?? 0,
    },
    {
      label: 'Active Executions',
      value: stats.activeExecutions ?? 0,
    },
    {
      label: 'Completion Rate',
      value: stats.completionRate != null ? `${(stats.completionRate * 100).toFixed(1)}%` : '--',
    },
    {
      label: 'Avg Duration',
      value: stats.avgDurationDays != null ? `${stats.avgDurationDays.toFixed(1)}d` : '--',
      sub: 'days',
    },
  ];

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
      {statCards.map((card) => (
        <div key={card.label} className="card p-5">
          <p className="text-sm text-cscx-gray-400 mb-1">{card.label}</p>
          <p className="text-2xl font-semibold text-white">{card.value}</p>
        </div>
      ))}
    </div>
  );
};

export default PlaybooksView;
