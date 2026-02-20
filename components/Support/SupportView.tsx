import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { DataTable, Column } from '../shared/DataTable';
import { StatusBadge } from '../shared/StatusBadge';
import { FilterBar, FilterConfig } from '../shared/FilterBar';
import { useAuth } from '../../context/AuthContext';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface Ticket {
  id: string;
  ticket_id: string;
  customer_id: string;
  customer_name: string;
  subject: string;
  description?: string;
  category: string;
  severity: string;
  status: string;
  assignee: string;
  reporter_email: string;
  created_at: string;
  updated_at: string;
  resolved_at: string | null;
}

interface SpikeData {
  customer_id: string;
  customer_name: string;
  ticket_count: number;
  multiplier: number;
  severity: string;
  themes: string[];
}

interface SupportSummary {
  total_open_tickets?: number;
  avg_resolution_time_hours?: number;
  escalation_rate?: number;
  total_tickets?: number;
  resolved_today?: number;
  critical_open?: number;
  customers_with_open_tickets?: number;
}

interface SupportViewProps {
  onSelectCustomer?: (customer: { id: string; name: string }) => void;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const API_URL = import.meta.env.VITE_API_URL || '';

const TABS = ['Tickets', 'Spikes', 'Risk'] as const;
type Tab = (typeof TABS)[number];

const SEVERITY_COLOR_MAP: Record<string, string> = {
  low: 'bg-cscx-gray-700/50 text-cscx-gray-400',
  medium: 'badge-warning',
  high: 'bg-orange-500/20 text-orange-400',
  critical: 'badge-error',
  minor: 'bg-cscx-gray-700/50 text-cscx-gray-400',
  moderate: 'badge-warning',
  severe: 'badge-error',
};

const STATUS_COLOR_MAP: Record<string, string> = {
  open: 'badge-warning',
  in_progress: 'bg-blue-500/20 text-blue-400',
  resolved: 'badge-success',
  closed: 'bg-cscx-gray-700/50 text-cscx-gray-400',
};

const TICKET_FILTERS: FilterConfig[] = [
  {
    key: 'search',
    label: 'Subject',
    type: 'search',
    placeholder: 'Search by subject...',
  },
  {
    key: 'status',
    label: 'Status',
    type: 'select',
    options: [
      { value: 'open', label: 'Open' },
      { value: 'in_progress', label: 'In Progress' },
      { value: 'resolved', label: 'Resolved' },
      { value: 'closed', label: 'Closed' },
    ],
  },
  {
    key: 'severity',
    label: 'Severity',
    type: 'select',
    options: [
      { value: 'low', label: 'Low' },
      { value: 'medium', label: 'Medium' },
      { value: 'high', label: 'High' },
      { value: 'critical', label: 'Critical' },
    ],
  },
];

const CATEGORY_OPTIONS = [
  'bug',
  'feature_request',
  'billing',
  'onboarding',
  'integration',
  'performance',
  'other',
];

const SEVERITY_OPTIONS = ['low', 'medium', 'high', 'critical'];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatDate(iso: string | null | undefined): string {
  if (!iso) return '--';
  const d = new Date(iso);
  return d.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

function formatDateTime(iso: string | null | undefined): string {
  if (!iso) return '--';
  const d = new Date(iso);
  return d.toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

function truncate(text: string, max: number): string {
  if (text.length <= max) return text;
  return text.slice(0, max) + '...';
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export const SupportView: React.FC<SupportViewProps> = ({ onSelectCustomer }) => {
  const { getAuthHeaders } = useAuth();

  // Tab state
  const [activeTab, setActiveTab] = useState<Tab>('Tickets');

  // Tickets state
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [ticketsLoading, setTicketsLoading] = useState(false);
  const [ticketsError, setTicketsError] = useState<string | null>(null);
  const [filterValues, setFilterValues] = useState<Record<string, string>>({
    search: '',
    status: '',
    severity: '',
  });

  // Ticket detail modal
  const [selectedTicket, setSelectedTicket] = useState<Ticket | null>(null);
  const [emailDraft, setEmailDraft] = useState<string>('');
  const [emailDraftLoading, setEmailDraftLoading] = useState(false);
  const [statusUpdating, setStatusUpdating] = useState(false);

  // New ticket modal
  const [showNewTicket, setShowNewTicket] = useState(false);
  const [newTicket, setNewTicket] = useState({
    customerId: '',
    subject: '',
    description: '',
    category: CATEGORY_OPTIONS[0],
    severity: 'medium',
  });
  const [newTicketSubmitting, setNewTicketSubmitting] = useState(false);

  // Spikes state
  const [spikes, setSpikes] = useState<SpikeData[]>([]);
  const [spikesLoading, setSpikesLoading] = useState(false);
  const [spikesError, setSpikesError] = useState<string | null>(null);

  // Risk / summary state
  const [summary, setSummary] = useState<SupportSummary | null>(null);
  const [summaryLoading, setSummaryLoading] = useState(false);
  const [summaryError, setSummaryError] = useState<string | null>(null);

  // -------------------------------------------------------------------------
  // Data fetching
  // -------------------------------------------------------------------------

  const authHeaders = useMemo(
    () => ({ 'Content-Type': 'application/json', ...getAuthHeaders() }),
    [getAuthHeaders],
  );

  const fetchTickets = useCallback(async () => {
    setTicketsLoading(true);
    setTicketsError(null);
    try {
      const res = await fetch(`${API_URL}/api/support/tickets`, {
        headers: authHeaders,
      });
      if (!res.ok) throw new Error(`Failed to load tickets (${res.status})`);
      const data = await res.json();
      setTickets(data.tickets || []);
    } catch (err) {
      setTicketsError(err instanceof Error ? err.message : 'Failed to load tickets');
    } finally {
      setTicketsLoading(false);
    }
  }, [authHeaders]);

  const fetchSpikes = useCallback(async () => {
    setSpikesLoading(true);
    setSpikesError(null);
    try {
      const res = await fetch(`${API_URL}/api/support/spike-detection/all`, {
        headers: authHeaders,
      });
      if (!res.ok) throw new Error(`Failed to load spike data (${res.status})`);
      const data = await res.json();
      // API may return { spikes: [...] } or an array directly
      setSpikes(Array.isArray(data) ? data : data.spikes || []);
    } catch (err) {
      setSpikesError(err instanceof Error ? err.message : 'Failed to load spike data');
    } finally {
      setSpikesLoading(false);
    }
  }, [authHeaders]);

  const fetchSummary = useCallback(async () => {
    setSummaryLoading(true);
    setSummaryError(null);
    try {
      const res = await fetch(`${API_URL}/api/support/summary`, {
        headers: authHeaders,
      });
      if (!res.ok) throw new Error(`Failed to load summary (${res.status})`);
      const data = await res.json();
      setSummary(data);
    } catch (err) {
      setSummaryError(err instanceof Error ? err.message : 'Failed to load summary');
    } finally {
      setSummaryLoading(false);
    }
  }, [authHeaders]);

  // Load data when tab changes
  useEffect(() => {
    if (activeTab === 'Tickets') fetchTickets();
    if (activeTab === 'Spikes') fetchSpikes();
    if (activeTab === 'Risk') fetchSummary();
  }, [activeTab, fetchTickets, fetchSpikes, fetchSummary]);

  // -------------------------------------------------------------------------
  // Ticket filtering
  // -------------------------------------------------------------------------

  const filteredTickets = useMemo(() => {
    let items = [...tickets];
    const { search, status, severity } = filterValues;

    if (search) {
      const q = search.toLowerCase();
      items = items.filter(
        (t) =>
          t.subject.toLowerCase().includes(q) ||
          t.customer_name.toLowerCase().includes(q),
      );
    }
    if (status) {
      items = items.filter((t) => t.status === status);
    }
    if (severity) {
      items = items.filter((t) => t.severity === severity);
    }

    return items;
  }, [tickets, filterValues]);

  // -------------------------------------------------------------------------
  // Ticket detail actions
  // -------------------------------------------------------------------------

  const handleGenerateEmailDraft = useCallback(
    async (ticketId: string) => {
      setEmailDraftLoading(true);
      setEmailDraft('');
      try {
        const res = await fetch(
          `${API_URL}/api/support/tickets/${ticketId}/email-draft`,
          { method: 'POST', headers: authHeaders },
        );
        if (!res.ok) throw new Error('Failed to generate email draft');
        const data = await res.json();
        setEmailDraft(data.draft || data.content || data.email || JSON.stringify(data, null, 2));
      } catch (err) {
        setEmailDraft(`Error: ${err instanceof Error ? err.message : 'Unknown error'}`);
      } finally {
        setEmailDraftLoading(false);
      }
    },
    [authHeaders],
  );

  const handleStatusUpdate = useCallback(
    async (ticketId: string, newStatus: string) => {
      setStatusUpdating(true);
      try {
        const res = await fetch(`${API_URL}/api/support/tickets/${ticketId}`, {
          method: 'PATCH',
          headers: authHeaders,
          body: JSON.stringify({ status: newStatus }),
        });
        if (!res.ok) throw new Error('Failed to update status');

        // Refresh tickets and update selected ticket locally
        setTickets((prev) =>
          prev.map((t) => (t.id === ticketId ? { ...t, status: newStatus } : t)),
        );
        setSelectedTicket((prev) => (prev ? { ...prev, status: newStatus } : prev));
      } catch (err) {
        console.error('Status update failed:', err);
      } finally {
        setStatusUpdating(false);
      }
    },
    [authHeaders],
  );

  // -------------------------------------------------------------------------
  // New ticket
  // -------------------------------------------------------------------------

  const handleCreateTicket = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      setNewTicketSubmitting(true);
      try {
        const res = await fetch(`${API_URL}/api/support/webhook`, {
          method: 'POST',
          headers: authHeaders,
          body: JSON.stringify({
            ticketId: `manual-${Date.now()}`,
            customerId: newTicket.customerId,
            category: newTicket.category,
            severity: newTicket.severity,
            subject: newTicket.subject,
            description: newTicket.description,
          }),
        });
        if (!res.ok) throw new Error('Failed to create ticket');
        setShowNewTicket(false);
        setNewTicket({
          customerId: '',
          subject: '',
          description: '',
          category: CATEGORY_OPTIONS[0],
          severity: 'medium',
        });
        fetchTickets();
      } catch (err) {
        console.error('Create ticket failed:', err);
      } finally {
        setNewTicketSubmitting(false);
      }
    },
    [authHeaders, newTicket, fetchTickets],
  );

  // -------------------------------------------------------------------------
  // Table columns
  // -------------------------------------------------------------------------

  const ticketColumns: Column<Ticket>[] = useMemo(
    () => [
      {
        key: 'subject',
        label: 'Subject',
        sortable: true,
        render: (t) => (
          <span className="text-white font-medium">{truncate(t.subject, 60)}</span>
        ),
      },
      {
        key: 'customer_name',
        label: 'Customer',
        sortable: true,
        render: (t) => <span className="text-cscx-gray-300">{t.customer_name}</span>,
      },
      {
        key: 'severity',
        label: 'Severity',
        sortable: true,
        render: (t) => <StatusBadge status={t.severity} colorMap={SEVERITY_COLOR_MAP} />,
      },
      {
        key: 'status',
        label: 'Status',
        sortable: true,
        render: (t) => <StatusBadge status={t.status} colorMap={STATUS_COLOR_MAP} />,
      },
      {
        key: 'assignee',
        label: 'Assignee',
        sortable: true,
        render: (t) => (
          <span className="text-cscx-gray-400">{t.assignee || 'Unassigned'}</span>
        ),
      },
      {
        key: 'created_at',
        label: 'Created',
        sortable: true,
        render: (t) => (
          <span className="text-cscx-gray-400 text-xs">{formatDate(t.created_at)}</span>
        ),
      },
    ],
    [],
  );

  // -------------------------------------------------------------------------
  // Render helpers
  // -------------------------------------------------------------------------

  const renderLoading = () => (
    <div className="flex items-center justify-center py-16">
      <div className="animate-spin rounded-full h-6 w-6 border-2 border-cscx-accent border-t-transparent" />
    </div>
  );

  const renderError = (message: string, retry: () => void) => (
    <div className="flex flex-col items-center justify-center py-16 gap-3">
      <p className="text-cscx-gray-400 text-sm">{message}</p>
      <button onClick={retry} className="btn btn-primary text-sm">
        Retry
      </button>
    </div>
  );

  // -------------------------------------------------------------------------
  // Tickets tab
  // -------------------------------------------------------------------------

  const renderTicketsTab = () => (
    <div>
      <div className="flex items-center justify-between mb-4">
        <FilterBar
          filters={TICKET_FILTERS}
          values={filterValues}
          onChange={(key, value) =>
            setFilterValues((prev) => ({ ...prev, [key]: value }))
          }
          onReset={() => setFilterValues({ search: '', status: '', severity: '' })}
        />
        <button
          onClick={() => setShowNewTicket(true)}
          className="btn btn-primary text-sm flex-shrink-0"
        >
          + New Ticket
        </button>
      </div>

      {ticketsLoading ? (
        renderLoading()
      ) : ticketsError ? (
        renderError(ticketsError, fetchTickets)
      ) : (
        <DataTable<Ticket>
          columns={ticketColumns}
          data={filteredTickets}
          onRowClick={(t) => {
            setSelectedTicket(t);
            setEmailDraft('');
          }}
          emptyMessage="No tickets found"
          rowKey={(t) => t.id}
          pageSize={15}
        />
      )}
    </div>
  );

  // -------------------------------------------------------------------------
  // Ticket detail modal
  // -------------------------------------------------------------------------

  const renderTicketDetailModal = () => {
    if (!selectedTicket) return null;
    const t = selectedTicket;
    const statusOptions = ['open', 'in_progress', 'resolved', 'closed'];

    return (
      <div
        className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
        onClick={() => setSelectedTicket(null)}
      >
        <div
          className="bg-cscx-gray-900 border border-cscx-gray-800 rounded-xl w-full max-w-2xl max-h-[85vh] overflow-y-auto p-6"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="flex items-start justify-between mb-4">
            <div className="flex-1 min-w-0 mr-4">
              <h3 className="text-lg font-semibold text-white">{t.subject}</h3>
              <p className="text-xs text-cscx-gray-400 mt-1">
                {t.ticket_id} &middot; {t.customer_name}
              </p>
            </div>
            <button
              onClick={() => setSelectedTicket(null)}
              className="text-cscx-gray-400 hover:text-white text-xl leading-none"
            >
              &times;
            </button>
          </div>

          {/* Badges */}
          <div className="flex flex-wrap gap-2 mb-4">
            <StatusBadge status={t.severity} colorMap={SEVERITY_COLOR_MAP} />
            <StatusBadge status={t.status} colorMap={STATUS_COLOR_MAP} />
            <span className="badge bg-cscx-gray-700/50 text-cscx-gray-400">
              {t.category.replace(/_/g, ' ')}
            </span>
          </div>

          {/* Detail grid */}
          <div className="grid grid-cols-2 gap-4 text-sm mb-6">
            <div>
              <span className="text-cscx-gray-400 block text-xs mb-1">Reporter</span>
              <span className="text-cscx-gray-300">{t.reporter_email || '--'}</span>
            </div>
            <div>
              <span className="text-cscx-gray-400 block text-xs mb-1">Assignee</span>
              <span className="text-cscx-gray-300">{t.assignee || 'Unassigned'}</span>
            </div>
            <div>
              <span className="text-cscx-gray-400 block text-xs mb-1">Created</span>
              <span className="text-cscx-gray-300">{formatDateTime(t.created_at)}</span>
            </div>
            <div>
              <span className="text-cscx-gray-400 block text-xs mb-1">Updated</span>
              <span className="text-cscx-gray-300">{formatDateTime(t.updated_at)}</span>
            </div>
            {t.resolved_at && (
              <div className="col-span-2">
                <span className="text-cscx-gray-400 block text-xs mb-1">Resolved</span>
                <span className="text-cscx-gray-300">
                  {formatDateTime(t.resolved_at)}
                </span>
              </div>
            )}
          </div>

          {/* Description */}
          {t.description && (
            <div className="mb-6">
              <h4 className="text-xs font-medium text-cscx-gray-400 mb-2">Description</h4>
              <p className="text-sm text-cscx-gray-300 whitespace-pre-wrap bg-cscx-gray-800 rounded-lg p-3">
                {t.description}
              </p>
            </div>
          )}

          {/* Status update */}
          <div className="mb-6">
            <h4 className="text-xs font-medium text-cscx-gray-400 mb-2">
              Update Status
            </h4>
            <div className="flex flex-wrap gap-2">
              {statusOptions.map((s) => (
                <button
                  key={s}
                  disabled={s === t.status || statusUpdating}
                  onClick={() => handleStatusUpdate(t.id, s)}
                  className={`text-xs px-3 py-1.5 rounded-md transition-colors ${
                    s === t.status
                      ? 'bg-cscx-accent/20 text-cscx-accent cursor-default'
                      : 'bg-cscx-gray-800 text-cscx-gray-300 hover:bg-cscx-gray-700 hover:text-white disabled:opacity-40'
                  }`}
                >
                  {s.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())}
                </button>
              ))}
            </div>
          </div>

          {/* Email draft */}
          <div>
            <button
              onClick={() => handleGenerateEmailDraft(t.id)}
              disabled={emailDraftLoading}
              className="btn btn-primary text-sm mb-3"
            >
              {emailDraftLoading ? 'Generating...' : 'Generate Email Draft'}
            </button>
            {emailDraft && (
              <textarea
                readOnly
                value={emailDraft}
                className="input w-full h-40 text-sm font-mono resize-y"
                onClick={(e) => (e.target as HTMLTextAreaElement).select()}
              />
            )}
          </div>
        </div>
      </div>
    );
  };

  // -------------------------------------------------------------------------
  // New ticket modal
  // -------------------------------------------------------------------------

  const renderNewTicketModal = () => {
    if (!showNewTicket) return null;

    return (
      <div
        className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
        onClick={() => setShowNewTicket(false)}
      >
        <div
          className="bg-cscx-gray-900 border border-cscx-gray-800 rounded-xl w-full max-w-lg p-6"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-lg font-semibold text-white">New Ticket</h3>
            <button
              onClick={() => setShowNewTicket(false)}
              className="text-cscx-gray-400 hover:text-white text-xl leading-none"
            >
              &times;
            </button>
          </div>

          <form onSubmit={handleCreateTicket} className="space-y-4">
            {/* Customer ID */}
            <div>
              <label className="block text-xs text-cscx-gray-400 mb-1">Customer ID</label>
              <input
                type="text"
                required
                value={newTicket.customerId}
                onChange={(e) =>
                  setNewTicket((prev) => ({ ...prev, customerId: e.target.value }))
                }
                placeholder="Enter customer ID"
                className="input w-full text-sm"
              />
            </div>

            {/* Subject */}
            <div>
              <label className="block text-xs text-cscx-gray-400 mb-1">Subject</label>
              <input
                type="text"
                required
                value={newTicket.subject}
                onChange={(e) =>
                  setNewTicket((prev) => ({ ...prev, subject: e.target.value }))
                }
                placeholder="Brief description of the issue"
                className="input w-full text-sm"
              />
            </div>

            {/* Description */}
            <div>
              <label className="block text-xs text-cscx-gray-400 mb-1">Description</label>
              <textarea
                value={newTicket.description}
                onChange={(e) =>
                  setNewTicket((prev) => ({ ...prev, description: e.target.value }))
                }
                placeholder="Detailed description..."
                rows={4}
                className="input w-full text-sm resize-y"
              />
            </div>

            {/* Category + Severity */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs text-cscx-gray-400 mb-1">Category</label>
                <select
                  value={newTicket.category}
                  onChange={(e) =>
                    setNewTicket((prev) => ({ ...prev, category: e.target.value }))
                  }
                  className="input w-full text-sm appearance-none"
                >
                  {CATEGORY_OPTIONS.map((c) => (
                    <option key={c} value={c}>
                      {c.replace(/_/g, ' ').replace(/\b\w/g, (ch) => ch.toUpperCase())}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs text-cscx-gray-400 mb-1">Severity</label>
                <select
                  value={newTicket.severity}
                  onChange={(e) =>
                    setNewTicket((prev) => ({ ...prev, severity: e.target.value }))
                  }
                  className="input w-full text-sm appearance-none"
                >
                  {SEVERITY_OPTIONS.map((s) => (
                    <option key={s} value={s}>
                      {s.charAt(0).toUpperCase() + s.slice(1)}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="flex justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => setShowNewTicket(false)}
                className="btn text-sm text-cscx-gray-400 hover:text-white"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={newTicketSubmitting || !newTicket.customerId || !newTicket.subject}
                className="btn btn-primary text-sm disabled:opacity-40"
              >
                {newTicketSubmitting ? 'Creating...' : 'Create Ticket'}
              </button>
            </div>
          </form>
        </div>
      </div>
    );
  };

  // -------------------------------------------------------------------------
  // Spikes tab
  // -------------------------------------------------------------------------

  const renderSpikesTab = () => {
    if (spikesLoading) return renderLoading();
    if (spikesError) return renderError(spikesError, fetchSpikes);

    if (spikes.length === 0) {
      return (
        <div className="flex flex-col items-center justify-center py-16">
          <p className="text-cscx-gray-400 text-sm">
            No ticket spikes detected. All customers are within normal volume ranges.
          </p>
        </div>
      );
    }

    return (
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {spikes.map((spike) => (
          <div
            key={spike.customer_id}
            onClick={() =>
              onSelectCustomer?.({
                id: spike.customer_id,
                name: spike.customer_name,
              })
            }
            className={`card p-4 ${onSelectCustomer ? 'cursor-pointer hover:border-cscx-accent/40' : ''} transition-colors`}
          >
            {/* Spike card header */}
            <div className="flex items-start justify-between mb-3">
              <div className="min-w-0">
                <h4 className="text-sm font-semibold text-white truncate">
                  {spike.customer_name}
                </h4>
                <p className="text-xs text-cscx-gray-400 mt-0.5">
                  {spike.ticket_count} ticket{spike.ticket_count !== 1 ? 's' : ''} in period
                </p>
              </div>
              <StatusBadge status={spike.severity} colorMap={SEVERITY_COLOR_MAP} />
            </div>

            {/* Multiplier bar */}
            <div className="mb-3">
              <div className="flex items-center justify-between text-xs mb-1">
                <span className="text-cscx-gray-400">Volume multiplier</span>
                <span className="text-white font-medium">{spike.multiplier.toFixed(1)}x</span>
              </div>
              <div className="h-1.5 bg-cscx-gray-800 rounded-full overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all ${
                    spike.severity === 'severe'
                      ? 'bg-red-500'
                      : spike.severity === 'moderate'
                        ? 'bg-yellow-500'
                        : 'bg-cscx-gray-500'
                  }`}
                  style={{ width: `${Math.min(100, (spike.multiplier / 5) * 100)}%` }}
                />
              </div>
            </div>

            {/* Themes */}
            {spike.themes && spike.themes.length > 0 && (
              <div>
                <span className="text-xs text-cscx-gray-400 block mb-1.5">Themes</span>
                <div className="flex flex-wrap gap-1.5">
                  {spike.themes.map((theme, i) => (
                    <span
                      key={i}
                      className="badge bg-cscx-gray-800 text-cscx-gray-300 text-xs"
                    >
                      {theme}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>
        ))}
      </div>
    );
  };

  // -------------------------------------------------------------------------
  // Risk tab
  // -------------------------------------------------------------------------

  const renderRiskTab = () => {
    if (summaryLoading) return renderLoading();
    if (summaryError) return renderError(summaryError, fetchSummary);
    if (!summary) {
      return (
        <div className="flex flex-col items-center justify-center py-16">
          <p className="text-cscx-gray-400 text-sm">No summary data available.</p>
        </div>
      );
    }

    const metrics: { label: string; value: string | number; available: boolean }[] = [
      {
        label: 'Total Open Tickets',
        value: summary.total_open_tickets ?? '--',
        available: summary.total_open_tickets !== undefined,
      },
      {
        label: 'Avg Resolution Time',
        value:
          summary.avg_resolution_time_hours !== undefined
            ? `${summary.avg_resolution_time_hours.toFixed(1)}h`
            : '--',
        available: summary.avg_resolution_time_hours !== undefined,
      },
      {
        label: 'Escalation Rate',
        value:
          summary.escalation_rate !== undefined
            ? `${(summary.escalation_rate * 100).toFixed(1)}%`
            : '--',
        available: summary.escalation_rate !== undefined,
      },
      {
        label: 'Total Tickets',
        value: summary.total_tickets ?? '--',
        available: summary.total_tickets !== undefined,
      },
      {
        label: 'Resolved Today',
        value: summary.resolved_today ?? '--',
        available: summary.resolved_today !== undefined,
      },
      {
        label: 'Critical Open',
        value: summary.critical_open ?? '--',
        available: summary.critical_open !== undefined,
      },
      {
        label: 'Customers w/ Open Tickets',
        value: summary.customers_with_open_tickets ?? '--',
        available: summary.customers_with_open_tickets !== undefined,
      },
    ];

    const availableMetrics = metrics.filter((m) => m.available);
    const unavailableMetrics = metrics.filter((m) => !m.available);

    return (
      <div>
        {/* Available metrics */}
        {availableMetrics.length > 0 && (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4 mb-6">
            {availableMetrics.map((m) => (
              <div key={m.label} className="card p-4">
                <p className="text-xs text-cscx-gray-400 mb-1">{m.label}</p>
                <p className="text-2xl font-bold text-white">{m.value}</p>
              </div>
            ))}
          </div>
        )}

        {/* Unavailable metrics hint */}
        {unavailableMetrics.length > 0 && (
          <div className="card p-4 text-center">
            <p className="text-sm text-cscx-gray-400">
              More analytics coming soon:{' '}
              {unavailableMetrics.map((m) => m.label).join(', ')}
            </p>
          </div>
        )}

        {/* No data at all */}
        {availableMetrics.length === 0 && (
          <div className="card p-6 text-center">
            <p className="text-cscx-gray-400 text-sm">
              Support health metrics will appear here once data is available.
            </p>
            <p className="text-cscx-gray-500 text-xs mt-2">
              More analytics coming soon
            </p>
          </div>
        )}
      </div>
    );
  };

  // -------------------------------------------------------------------------
  // Main render
  // -------------------------------------------------------------------------

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-xl font-bold text-white">Support</h2>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 mb-6 bg-cscx-gray-900 p-1 rounded-lg w-fit">
        {TABS.map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-4 py-1.5 text-sm font-medium transition-colors ${
              activeTab === tab
                ? 'bg-cscx-accent text-white rounded-md'
                : 'text-cscx-gray-400 hover:text-white'
            }`}
          >
            {tab}
          </button>
        ))}
      </div>

      {/* Tab content */}
      <div className="flex-1 min-h-0">
        {activeTab === 'Tickets' && renderTicketsTab()}
        {activeTab === 'Spikes' && renderSpikesTab()}
        {activeTab === 'Risk' && renderRiskTab()}
      </div>

      {/* Modals */}
      {renderTicketDetailModal()}
      {renderNewTicketModal()}
    </div>
  );
};
