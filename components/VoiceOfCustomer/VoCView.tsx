/**
 * VoCView — Voice of Customer
 * Combines NPS survey management, Feedback tracking, and Analytics
 * into a single tabbed view with detail modals and action workflows.
 */

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { DataTable, Column } from '../shared/DataTable';
import { StatusBadge } from '../shared/StatusBadge';
import { FilterBar, FilterConfig } from '../shared/FilterBar';
import { useAuth } from '../../context/AuthContext';

const API_URL = import.meta.env.VITE_API_URL || '';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface NpsResponse {
  id: string;
  customer_id: string;
  respondent_email: string;
  respondent_name: string;
  score: number;
  feedback: string;
  category: 'promoter' | 'passive' | 'detractor';
  survey_campaign: string;
  submitted_at: string;
  created_at: string;
}

interface FeedbackItem {
  id: string;
  customer_id: string;
  source: string;
  content: string;
  type: string;
  category: string;
  sentiment: 'positive' | 'negative' | 'neutral' | 'mixed';
  priority: string;
  status: 'new' | 'acknowledged' | 'in_review' | 'routed' | 'resolved' | 'closed';
  routed_to_team: string;
  submitted_by: string;
  created_at: string;
  resolved_at: string | null;
}

interface FeedbackComment {
  id: string;
  content: string;
  authorId: string;
  authorName: string;
  created_at: string;
}

interface NpsAnalytics {
  overall_score: number;
  total_responses: number;
  promoters: number;
  passives: number;
  detractors: number;
  trends: { period: string; score: number }[];
}

interface FeedbackAnalytics {
  total: number;
  by_category: Record<string, number>;
  by_sentiment: Record<string, number>;
  avg_resolution_hours: number;
  resolution_rate: number;
}

interface RoutingRule {
  id: string;
  condition: string;
  target_team: string;
  priority: string;
}

interface NpsTheme {
  theme: string;
  count: number;
  sentiment: string;
}

interface VoCViewProps {
  onSelectCustomer?: (customer: { id: string; name: string }) => void;
}

type TabKey = 'nps' | 'feedback' | 'analytics';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function scoreColor(score: number): string {
  if (score >= 9) return 'text-green-400';
  if (score >= 7) return 'text-yellow-400';
  return 'text-red-400';
}

function scoreBg(score: number): string {
  if (score >= 9) return 'bg-green-500/20 text-green-400';
  if (score >= 7) return 'bg-yellow-500/20 text-yellow-400';
  return 'bg-red-500/20 text-red-400';
}

function sentimentColor(sentiment: string): string {
  switch (sentiment) {
    case 'positive': return 'badge-success';
    case 'negative': return 'badge-error';
    case 'mixed': return 'bg-yellow-500/20 text-yellow-400';
    default: return 'bg-cscx-gray-700/50 text-cscx-gray-400';
  }
}

function formatDate(dateStr: string): string {
  if (!dateStr) return '--';
  return new Date(dateStr).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

function truncate(text: string, max = 80): string {
  if (!text) return '--';
  return text.length > max ? text.slice(0, max) + '...' : text;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export const VoCView: React.FC<VoCViewProps> = ({ onSelectCustomer }) => {
  const { getAuthHeaders } = useAuth();
  const [activeTab, setActiveTab] = useState<TabKey>('nps');

  // Shared fetch helper
  const apiFetch = useCallback(
    async (path: string, options?: RequestInit) => {
      const res = await fetch(`${API_URL}${path}`, {
        ...options,
        headers: {
          'Content-Type': 'application/json',
          ...getAuthHeaders(),
          ...(options?.headers || {}),
        },
      });
      if (!res.ok) throw new Error(`API error ${res.status}`);
      return res.json();
    },
    [getAuthHeaders],
  );

  const tabs: { key: TabKey; label: string }[] = [
    { key: 'nps', label: 'NPS' },
    { key: 'feedback', label: 'Feedback' },
    { key: 'analytics', label: 'Analytics' },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold text-white">Voice of Customer</h1>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-cscx-gray-900 p-1 rounded-lg w-fit">
        {tabs.map((t) => (
          <button
            key={t.key}
            onClick={() => setActiveTab(t.key)}
            className={`px-4 py-1.5 text-sm font-medium transition-colors rounded-md ${
              activeTab === t.key
                ? 'bg-cscx-accent text-white'
                : 'text-cscx-gray-400 hover:text-white'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      {activeTab === 'nps' && (
        <NpsTab apiFetch={apiFetch} onSelectCustomer={onSelectCustomer} />
      )}
      {activeTab === 'feedback' && (
        <FeedbackTab apiFetch={apiFetch} onSelectCustomer={onSelectCustomer} />
      )}
      {activeTab === 'analytics' && <AnalyticsTab apiFetch={apiFetch} />}
    </div>
  );
};

// ===========================================================================
// NPS Tab
// ===========================================================================

interface TabProps {
  apiFetch: (path: string, options?: RequestInit) => Promise<any>;
  onSelectCustomer?: (customer: { id: string; name: string }) => void;
}

const NpsTab: React.FC<TabProps> = ({ apiFetch, onSelectCustomer }) => {
  const [responses, setResponses] = useState<NpsResponse[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filters, setFilters] = useState<Record<string, string>>({ category: '', search: '' });
  const [selectedResponse, setSelectedResponse] = useState<NpsResponse | null>(null);
  const [themes, setThemes] = useState<NpsTheme[]>([]);

  const fetchResponses = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await apiFetch('/api/nps/responses?limit=50');
      setResponses(data.responses || []);
    } catch (err: any) {
      setError(err.message || 'Failed to load NPS responses');
    } finally {
      setLoading(false);
    }
  }, [apiFetch]);

  const fetchThemes = useCallback(async () => {
    try {
      const data = await apiFetch('/api/nps/analytics/themes');
      setThemes(data.themes || []);
    } catch {
      // Non-critical — silently ignore
    }
  }, [apiFetch]);

  useEffect(() => {
    fetchResponses();
    fetchThemes();
  }, [fetchResponses, fetchThemes]);

  // Filter responses
  const filtered = useMemo(() => {
    let items = [...responses];
    if (filters.category) {
      items = items.filter((r) => r.category === filters.category);
    }
    if (filters.search) {
      const q = filters.search.toLowerCase();
      items = items.filter(
        (r) =>
          (r.respondent_name || '').toLowerCase().includes(q) ||
          (r.respondent_email || '').toLowerCase().includes(q) ||
          (r.feedback || '').toLowerCase().includes(q),
      );
    }
    return items;
  }, [responses, filters]);

  // Score distribution
  const distribution = useMemo(() => {
    const promoters = responses.filter((r) => r.score >= 9).length;
    const passives = responses.filter((r) => r.score >= 7 && r.score <= 8).length;
    const detractors = responses.filter((r) => r.score <= 6).length;
    const total = responses.length || 1;
    const nps = Math.round(((promoters - detractors) / total) * 100);
    return { promoters, passives, detractors, total: responses.length, nps };
  }, [responses]);

  const filterConfigs: FilterConfig[] = [
    {
      key: 'category',
      label: 'Category',
      type: 'select',
      options: [
        { value: 'promoter', label: 'Promoters (9-10)' },
        { value: 'passive', label: 'Passives (7-8)' },
        { value: 'detractor', label: 'Detractors (0-6)' },
      ],
    },
    {
      key: 'search',
      label: 'Search',
      type: 'search',
      placeholder: 'Search respondent or feedback...',
    },
  ];

  const columns: Column<NpsResponse>[] = [
    {
      key: 'respondent_name',
      label: 'Respondent',
      sortable: true,
      render: (r) => (
        <div>
          <div className="text-white font-medium text-sm">{r.respondent_name || '--'}</div>
          <div className="text-cscx-gray-400 text-xs">{r.respondent_email}</div>
        </div>
      ),
    },
    {
      key: 'score',
      label: 'Score',
      sortable: true,
      render: (r) => (
        <span className={`badge ${scoreBg(r.score)} font-bold`}>{r.score}</span>
      ),
    },
    {
      key: 'customer_id',
      label: 'Customer',
      render: (r) =>
        r.customer_id ? (
          <button
            onClick={(e) => {
              e.stopPropagation();
              onSelectCustomer?.({ id: r.customer_id, name: r.respondent_name });
            }}
            className="text-cscx-accent hover:underline text-sm"
          >
            View
          </button>
        ) : (
          <span className="text-cscx-gray-400">--</span>
        ),
    },
    {
      key: 'feedback',
      label: 'Feedback',
      render: (r) => (
        <span className="text-cscx-gray-300 text-sm">{truncate(r.feedback)}</span>
      ),
    },
    {
      key: 'submitted_at',
      label: 'Date',
      sortable: true,
      render: (r) => (
        <span className="text-cscx-gray-400 text-sm">{formatDate(r.submitted_at)}</span>
      ),
    },
  ];

  if (error) {
    return (
      <div className="card p-6 text-center">
        <p className="text-red-400 mb-3">{error}</p>
        <button onClick={fetchResponses} className="btn btn-primary text-sm">
          Retry
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Score Distribution Summary */}
      {!loading && responses.length > 0 && (
        <div className="card p-4">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-medium text-white">NPS Score Distribution</h3>
            <div className="text-right">
              <span className="text-2xl font-bold text-white">{distribution.nps}</span>
              <span className="text-cscx-gray-400 text-sm ml-1">NPS</span>
            </div>
          </div>
          <div className="flex rounded-full overflow-hidden h-3 bg-cscx-gray-800">
            {distribution.total > 0 && (
              <>
                <div
                  className="bg-green-500 transition-all"
                  style={{ width: `${(distribution.promoters / distribution.total) * 100}%` }}
                  title={`Promoters: ${distribution.promoters}`}
                />
                <div
                  className="bg-yellow-500 transition-all"
                  style={{ width: `${(distribution.passives / distribution.total) * 100}%` }}
                  title={`Passives: ${distribution.passives}`}
                />
                <div
                  className="bg-red-500 transition-all"
                  style={{ width: `${(distribution.detractors / distribution.total) * 100}%` }}
                  title={`Detractors: ${distribution.detractors}`}
                />
              </>
            )}
          </div>
          <div className="flex justify-between mt-2 text-xs">
            <span className="text-green-400">Promoters {distribution.promoters}</span>
            <span className="text-yellow-400">Passives {distribution.passives}</span>
            <span className="text-red-400">Detractors {distribution.detractors}</span>
          </div>
        </div>
      )}

      {/* Themes */}
      {themes.length > 0 && (
        <div className="card p-4">
          <h3 className="text-sm font-medium text-white mb-2">Common Themes</h3>
          <div className="flex flex-wrap gap-2">
            {themes.map((t, i) => (
              <span key={i} className="badge bg-cscx-gray-800 text-cscx-gray-300">
                {t.theme} ({t.count})
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Filters */}
      <FilterBar
        filters={filterConfigs}
        values={filters}
        onChange={(key, val) => setFilters((prev) => ({ ...prev, [key]: val }))}
        onReset={() => setFilters({ category: '', search: '' })}
      />

      {/* Table */}
      <DataTable<NpsResponse>
        columns={columns}
        data={filtered}
        loading={loading}
        onRowClick={(r) => setSelectedResponse(r)}
        emptyMessage="No NPS responses found"
        rowKey={(r) => r.id}
        pageSize={20}
      />

      {/* Detail Modal */}
      {selectedResponse && (
        <NpsDetailModal
          response={selectedResponse}
          apiFetch={apiFetch}
          onClose={() => setSelectedResponse(null)}
          onSelectCustomer={onSelectCustomer}
          onRefresh={fetchResponses}
        />
      )}
    </div>
  );
};

// ===========================================================================
// NPS Detail Modal
// ===========================================================================

interface NpsDetailModalProps {
  response: NpsResponse;
  apiFetch: (path: string, options?: RequestInit) => Promise<any>;
  onClose: () => void;
  onSelectCustomer?: (customer: { id: string; name: string }) => void;
  onRefresh: () => void;
}

const NpsDetailModal: React.FC<NpsDetailModalProps> = ({
  response,
  apiFetch,
  onClose,
  onSelectCustomer,
  onRefresh,
}) => {
  const [history, setHistory] = useState<NpsResponse[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [recovering, setRecovering] = useState(false);
  const [recoveryStatus, setRecoveryStatus] = useState<string | null>(null);

  useEffect(() => {
    if (response.customer_id) {
      setHistoryLoading(true);
      apiFetch(`/api/nps/customer/${response.customer_id}/history`)
        .then((data) => setHistory(data.history || data.responses || []))
        .catch(() => {})
        .finally(() => setHistoryLoading(false));
    }
  }, [response.customer_id, apiFetch]);

  const handleRecover = async () => {
    try {
      setRecovering(true);
      const data = await apiFetch(`/api/nps/responses/${response.id}/recover`, {
        method: 'POST',
      });
      setRecoveryStatus(data.status || 'Recovery initiated');
      onRefresh();
    } catch {
      setRecoveryStatus('Failed to initiate recovery');
    } finally {
      setRecovering(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="card w-full max-w-2xl max-h-[85vh] overflow-y-auto p-6 m-4">
        {/* Header */}
        <div className="flex items-start justify-between mb-4">
          <div>
            <h2 className="text-lg font-semibold text-white">{response.respondent_name}</h2>
            <p className="text-cscx-gray-400 text-sm">{response.respondent_email}</p>
          </div>
          <button onClick={onClose} className="text-cscx-gray-400 hover:text-white text-xl leading-none">
            &times;
          </button>
        </div>

        {/* Score */}
        <div className="flex items-center gap-4 mb-4">
          <span className={`text-3xl font-bold ${scoreColor(response.score)}`}>{response.score}</span>
          <StatusBadge
            status={response.category}
            colorMap={{
              promoter: 'badge-success',
              passive: 'bg-yellow-500/20 text-yellow-400',
              detractor: 'badge-error',
            }}
          />
          {response.survey_campaign && (
            <span className="badge bg-cscx-gray-800 text-cscx-gray-300">
              {response.survey_campaign}
            </span>
          )}
          <span className="text-cscx-gray-400 text-sm ml-auto">
            {formatDate(response.submitted_at)}
          </span>
        </div>

        {/* Feedback */}
        <div className="mb-4">
          <h3 className="text-sm font-medium text-cscx-gray-300 mb-1">Feedback</h3>
          <p className="text-white text-sm bg-cscx-gray-900 rounded-lg p-3">
            {response.feedback || 'No feedback provided'}
          </p>
        </div>

        {/* Customer link */}
        {response.customer_id && onSelectCustomer && (
          <div className="mb-4">
            <button
              onClick={() => {
                onSelectCustomer({ id: response.customer_id, name: response.respondent_name });
                onClose();
              }}
              className="text-cscx-accent hover:underline text-sm"
            >
              View Customer Profile
            </button>
          </div>
        )}

        {/* Detractor Recovery */}
        {response.score <= 6 && (
          <div className="mb-4 p-3 rounded-lg bg-red-500/10 border border-red-500/20">
            <h3 className="text-sm font-medium text-red-400 mb-2">Detractor Recovery</h3>
            {recoveryStatus ? (
              <p className="text-sm text-cscx-gray-300">{recoveryStatus}</p>
            ) : (
              <button
                onClick={handleRecover}
                disabled={recovering}
                className="btn btn-primary text-sm"
              >
                {recovering ? 'Initiating...' : 'Initiate Recovery'}
              </button>
            )}
          </div>
        )}

        {/* NPS History */}
        {response.customer_id && (
          <div>
            <h3 className="text-sm font-medium text-cscx-gray-300 mb-2">Customer NPS History</h3>
            {historyLoading ? (
              <div className="flex justify-center py-4">
                <div className="animate-spin rounded-full h-5 w-5 border-2 border-cscx-accent border-t-transparent" />
              </div>
            ) : history.length === 0 ? (
              <p className="text-cscx-gray-400 text-sm">No previous responses</p>
            ) : (
              <div className="space-y-2 max-h-48 overflow-y-auto">
                {history.map((h) => (
                  <div
                    key={h.id}
                    className="flex items-center justify-between bg-cscx-gray-900 rounded-lg px-3 py-2 text-sm"
                  >
                    <span className={`font-bold ${scoreColor(h.score)}`}>{h.score}</span>
                    <span className="text-cscx-gray-300 flex-1 ml-3 truncate">
                      {truncate(h.feedback, 50)}
                    </span>
                    <span className="text-cscx-gray-400 text-xs ml-2">
                      {formatDate(h.submitted_at)}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

// ===========================================================================
// Feedback Tab
// ===========================================================================

const FeedbackTab: React.FC<TabProps> = ({ apiFetch, onSelectCustomer }) => {
  const [items, setItems] = useState<FeedbackItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filters, setFilters] = useState<Record<string, string>>({
    status: '',
    category: '',
    sentiment: '',
    source: '',
  });
  const [selectedItem, setSelectedItem] = useState<FeedbackItem | null>(null);

  const fetchFeedback = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await apiFetch('/api/feedback?limit=50');
      setItems(data.feedback || []);
    } catch (err: any) {
      setError(err.message || 'Failed to load feedback');
    } finally {
      setLoading(false);
    }
  }, [apiFetch]);

  useEffect(() => {
    fetchFeedback();
  }, [fetchFeedback]);

  // Derive unique values for filter dropdowns
  const uniqueCategories = useMemo(
    () => [...new Set(items.map((i) => i.category).filter(Boolean))],
    [items],
  );
  const uniqueSources = useMemo(
    () => [...new Set(items.map((i) => i.source).filter(Boolean))],
    [items],
  );

  const filtered = useMemo(() => {
    let list = [...items];
    if (filters.status) list = list.filter((i) => i.status === filters.status);
    if (filters.category) list = list.filter((i) => i.category === filters.category);
    if (filters.sentiment) list = list.filter((i) => i.sentiment === filters.sentiment);
    if (filters.source) list = list.filter((i) => i.source === filters.source);
    return list;
  }, [items, filters]);

  const filterConfigs: FilterConfig[] = [
    {
      key: 'status',
      label: 'Status',
      type: 'select',
      options: [
        { value: 'new', label: 'New' },
        { value: 'acknowledged', label: 'Acknowledged' },
        { value: 'in_review', label: 'In Review' },
        { value: 'routed', label: 'Routed' },
        { value: 'resolved', label: 'Resolved' },
        { value: 'closed', label: 'Closed' },
      ],
    },
    {
      key: 'category',
      label: 'Category',
      type: 'select',
      options: uniqueCategories.map((c) => ({ value: c, label: c })),
    },
    {
      key: 'sentiment',
      label: 'Sentiment',
      type: 'select',
      options: [
        { value: 'positive', label: 'Positive' },
        { value: 'negative', label: 'Negative' },
        { value: 'neutral', label: 'Neutral' },
        { value: 'mixed', label: 'Mixed' },
      ],
    },
    {
      key: 'source',
      label: 'Source',
      type: 'select',
      options: uniqueSources.map((s) => ({ value: s, label: s })),
    },
  ];

  const columns: Column<FeedbackItem>[] = [
    {
      key: 'content',
      label: 'Content',
      render: (item) => (
        <span className="text-cscx-gray-300 text-sm">{truncate(item.content, 60)}</span>
      ),
    },
    {
      key: 'customer_id',
      label: 'Customer',
      render: (item) =>
        item.customer_id ? (
          <button
            onClick={(e) => {
              e.stopPropagation();
              onSelectCustomer?.({ id: item.customer_id, name: item.submitted_by || item.customer_id });
            }}
            className="text-cscx-accent hover:underline text-sm"
          >
            View
          </button>
        ) : (
          <span className="text-cscx-gray-400">--</span>
        ),
    },
    {
      key: 'source',
      label: 'Source',
      render: (item) => (
        <span className="badge bg-cscx-gray-800 text-cscx-gray-300">{item.source || '--'}</span>
      ),
    },
    {
      key: 'sentiment',
      label: 'Sentiment',
      sortable: true,
      render: (item) => (
        <StatusBadge status={item.sentiment} colorMap={{
          positive: 'badge-success',
          negative: 'badge-error',
          neutral: 'bg-cscx-gray-700/50 text-cscx-gray-400',
          mixed: 'bg-yellow-500/20 text-yellow-400',
        }} />
      ),
    },
    {
      key: 'priority',
      label: 'Priority',
      sortable: true,
      render: (item) => (
        <StatusBadge status={item.priority || 'normal'} colorMap={{
          critical: 'badge-error',
          high: 'bg-orange-500/20 text-orange-400',
          medium: 'bg-yellow-500/20 text-yellow-400',
          low: 'bg-cscx-gray-700/50 text-cscx-gray-400',
          normal: 'bg-cscx-gray-700/50 text-cscx-gray-400',
        }} />
      ),
    },
    {
      key: 'status',
      label: 'Status',
      sortable: true,
      render: (item) => <StatusBadge status={item.status} />,
    },
  ];

  if (error) {
    return (
      <div className="card p-6 text-center">
        <p className="text-red-400 mb-3">{error}</p>
        <button onClick={fetchFeedback} className="btn btn-primary text-sm">
          Retry
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <FilterBar
        filters={filterConfigs}
        values={filters}
        onChange={(key, val) => setFilters((prev) => ({ ...prev, [key]: val }))}
        onReset={() => setFilters({ status: '', category: '', sentiment: '', source: '' })}
      />

      <DataTable<FeedbackItem>
        columns={columns}
        data={filtered}
        loading={loading}
        onRowClick={(item) => setSelectedItem(item)}
        emptyMessage="No feedback found"
        rowKey={(item) => item.id}
        pageSize={20}
      />

      {selectedItem && (
        <FeedbackDetailModal
          item={selectedItem}
          apiFetch={apiFetch}
          onClose={() => setSelectedItem(null)}
          onSelectCustomer={onSelectCustomer}
          onRefresh={fetchFeedback}
        />
      )}
    </div>
  );
};

// ===========================================================================
// Feedback Detail Modal
// ===========================================================================

interface FeedbackDetailModalProps {
  item: FeedbackItem;
  apiFetch: (path: string, options?: RequestInit) => Promise<any>;
  onClose: () => void;
  onSelectCustomer?: (customer: { id: string; name: string }) => void;
  onRefresh: () => void;
}

const FeedbackDetailModal: React.FC<FeedbackDetailModalProps> = ({
  item,
  apiFetch,
  onClose,
  onSelectCustomer,
  onRefresh,
}) => {
  const [comments, setComments] = useState<FeedbackComment[]>([]);
  const [newComment, setNewComment] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [actionMsg, setActionMsg] = useState<string | null>(null);

  // Routing
  const [routeTeam, setRouteTeam] = useState('');
  const [routeReason, setRouteReason] = useState('');
  const [showRouteForm, setShowRouteForm] = useState(false);

  // Acknowledge
  const [ackDraft, setAckDraft] = useState<string | null>(null);
  const [showAckForm, setShowAckForm] = useState(false);

  // Resolve
  const [resolution, setResolution] = useState('');
  const [showResolveForm, setShowResolveForm] = useState(false);

  const fetchComments = useCallback(async () => {
    try {
      const data = await apiFetch(`/api/feedback/${item.id}/comments`);
      setComments(data.comments || []);
    } catch {
      // non-critical
    }
  }, [apiFetch, item.id]);

  useEffect(() => {
    fetchComments();
  }, [fetchComments]);

  const postComment = async () => {
    if (!newComment.trim()) return;
    try {
      setSubmitting(true);
      await apiFetch(`/api/feedback/${item.id}/comments`, {
        method: 'POST',
        body: JSON.stringify({ content: newComment, authorId: 'current', authorName: 'Me' }),
      });
      setNewComment('');
      fetchComments();
    } catch {
      setActionMsg('Failed to post comment');
    } finally {
      setSubmitting(false);
    }
  };

  const handleRoute = async () => {
    if (!routeTeam.trim()) return;
    try {
      setActionLoading('route');
      await apiFetch(`/api/feedback/${item.id}/route`, {
        method: 'PATCH',
        body: JSON.stringify({ team: routeTeam, reason: routeReason }),
      });
      setActionMsg('Routed successfully');
      setShowRouteForm(false);
      onRefresh();
    } catch {
      setActionMsg('Failed to route feedback');
    } finally {
      setActionLoading(null);
    }
  };

  const handleAcknowledge = async () => {
    try {
      setActionLoading('ack');
      if (!ackDraft) {
        // Get AI draft first
        const data = await apiFetch(`/api/feedback/${item.id}/acknowledge/draft`, {
          method: 'POST',
        });
        setAckDraft(data.message || data.draft || '');
        setShowAckForm(true);
      } else {
        // Send the acknowledgement
        await apiFetch(`/api/feedback/${item.id}/acknowledge/send`, {
          method: 'POST',
          body: JSON.stringify({ message: ackDraft }),
        });
        setActionMsg('Acknowledgement sent');
        setShowAckForm(false);
        setAckDraft(null);
        onRefresh();
      }
    } catch {
      setActionMsg('Failed to acknowledge');
    } finally {
      setActionLoading(null);
    }
  };

  const handleResolve = async () => {
    if (!resolution.trim()) return;
    try {
      setActionLoading('resolve');
      await apiFetch(`/api/feedback/${item.id}/resolve`, {
        method: 'PATCH',
        body: JSON.stringify({ resolution, resolvedBy: 'current' }),
      });
      setActionMsg('Resolved');
      setShowResolveForm(false);
      onRefresh();
    } catch {
      setActionMsg('Failed to resolve');
    } finally {
      setActionLoading(null);
    }
  };

  const handleStatusChange = async (status: string) => {
    try {
      setActionLoading('status');
      await apiFetch(`/api/feedback/${item.id}/status`, {
        method: 'PATCH',
        body: JSON.stringify({ status }),
      });
      setActionMsg(`Status updated to ${status}`);
      onRefresh();
    } catch {
      setActionMsg('Failed to update status');
    } finally {
      setActionLoading(null);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="card w-full max-w-2xl max-h-[85vh] overflow-y-auto p-6 m-4">
        {/* Header */}
        <div className="flex items-start justify-between mb-4">
          <h2 className="text-lg font-semibold text-white">Feedback Detail</h2>
          <button onClick={onClose} className="text-cscx-gray-400 hover:text-white text-xl leading-none">
            &times;
          </button>
        </div>

        {/* Content */}
        <div className="mb-4">
          <p className="text-white text-sm bg-cscx-gray-900 rounded-lg p-3">{item.content}</p>
        </div>

        {/* Classification */}
        <div className="grid grid-cols-2 gap-3 mb-4">
          <div>
            <span className="text-cscx-gray-400 text-xs block mb-1">Type</span>
            <span className="badge bg-cscx-gray-800 text-cscx-gray-300">{item.type || '--'}</span>
          </div>
          <div>
            <span className="text-cscx-gray-400 text-xs block mb-1">Category</span>
            <span className="badge bg-cscx-gray-800 text-cscx-gray-300">{item.category || '--'}</span>
          </div>
          <div>
            <span className="text-cscx-gray-400 text-xs block mb-1">Sentiment</span>
            <StatusBadge status={item.sentiment} colorMap={{
              positive: 'badge-success',
              negative: 'badge-error',
              neutral: 'bg-cscx-gray-700/50 text-cscx-gray-400',
              mixed: 'bg-yellow-500/20 text-yellow-400',
            }} />
          </div>
          <div>
            <span className="text-cscx-gray-400 text-xs block mb-1">Priority</span>
            <StatusBadge status={item.priority || 'normal'} colorMap={{
              critical: 'badge-error',
              high: 'bg-orange-500/20 text-orange-400',
              medium: 'bg-yellow-500/20 text-yellow-400',
              low: 'bg-cscx-gray-700/50 text-cscx-gray-400',
              normal: 'bg-cscx-gray-700/50 text-cscx-gray-400',
            }} />
          </div>
        </div>

        {/* Meta */}
        <div className="flex flex-wrap gap-3 text-xs text-cscx-gray-400 mb-4">
          <span>Source: {item.source || '--'}</span>
          <span>Status: {item.status}</span>
          {item.routed_to_team && <span>Routed to: {item.routed_to_team}</span>}
          <span>Created: {formatDate(item.created_at)}</span>
          {item.resolved_at && <span>Resolved: {formatDate(item.resolved_at)}</span>}
        </div>

        {/* Customer link */}
        {item.customer_id && onSelectCustomer && (
          <div className="mb-4">
            <button
              onClick={() => {
                onSelectCustomer({ id: item.customer_id, name: item.submitted_by || item.customer_id });
                onClose();
              }}
              className="text-cscx-accent hover:underline text-sm"
            >
              View Customer Profile
            </button>
          </div>
        )}

        {/* Action message */}
        {actionMsg && (
          <div className="mb-3 p-2 rounded bg-cscx-gray-900 text-sm text-cscx-gray-300">
            {actionMsg}
          </div>
        )}

        {/* Actions */}
        <div className="flex flex-wrap gap-2 mb-4">
          <button
            onClick={() => setShowRouteForm(!showRouteForm)}
            disabled={!!actionLoading}
            className="btn text-sm bg-cscx-gray-800 text-white hover:bg-cscx-gray-700"
          >
            Route to Team
          </button>
          <button
            onClick={handleAcknowledge}
            disabled={!!actionLoading}
            className="btn text-sm bg-cscx-gray-800 text-white hover:bg-cscx-gray-700"
          >
            {actionLoading === 'ack' ? 'Loading...' : showAckForm ? 'Send Acknowledgement' : 'Acknowledge'}
          </button>
          <button
            onClick={() => setShowResolveForm(!showResolveForm)}
            disabled={!!actionLoading}
            className="btn text-sm bg-cscx-gray-800 text-white hover:bg-cscx-gray-700"
          >
            Resolve
          </button>
          <select
            onChange={(e) => {
              if (e.target.value) handleStatusChange(e.target.value);
              e.target.value = '';
            }}
            disabled={!!actionLoading}
            className="input text-sm py-1.5 px-3"
            defaultValue=""
          >
            <option value="" disabled>
              Update Status
            </option>
            <option value="new">New</option>
            <option value="acknowledged">Acknowledged</option>
            <option value="in_review">In Review</option>
            <option value="routed">Routed</option>
            <option value="resolved">Resolved</option>
            <option value="closed">Closed</option>
          </select>
        </div>

        {/* Route Form */}
        {showRouteForm && (
          <div className="mb-4 p-3 rounded-lg bg-cscx-gray-900 space-y-2">
            <input
              type="text"
              placeholder="Team name"
              value={routeTeam}
              onChange={(e) => setRouteTeam(e.target.value)}
              className="input text-sm w-full"
            />
            <input
              type="text"
              placeholder="Reason (optional)"
              value={routeReason}
              onChange={(e) => setRouteReason(e.target.value)}
              className="input text-sm w-full"
            />
            <button
              onClick={handleRoute}
              disabled={!routeTeam.trim() || actionLoading === 'route'}
              className="btn btn-primary text-sm"
            >
              {actionLoading === 'route' ? 'Routing...' : 'Route'}
            </button>
          </div>
        )}

        {/* Acknowledge Form */}
        {showAckForm && ackDraft !== null && (
          <div className="mb-4 p-3 rounded-lg bg-cscx-gray-900 space-y-2">
            <label className="text-xs text-cscx-gray-400">AI-drafted acknowledgement (editable):</label>
            <textarea
              value={ackDraft}
              onChange={(e) => setAckDraft(e.target.value)}
              rows={4}
              className="input text-sm w-full resize-none"
            />
            <button
              onClick={handleAcknowledge}
              disabled={actionLoading === 'ack'}
              className="btn btn-primary text-sm"
            >
              {actionLoading === 'ack' ? 'Sending...' : 'Send'}
            </button>
          </div>
        )}

        {/* Resolve Form */}
        {showResolveForm && (
          <div className="mb-4 p-3 rounded-lg bg-cscx-gray-900 space-y-2">
            <textarea
              placeholder="Resolution details..."
              value={resolution}
              onChange={(e) => setResolution(e.target.value)}
              rows={3}
              className="input text-sm w-full resize-none"
            />
            <button
              onClick={handleResolve}
              disabled={!resolution.trim() || actionLoading === 'resolve'}
              className="btn btn-primary text-sm"
            >
              {actionLoading === 'resolve' ? 'Resolving...' : 'Resolve'}
            </button>
          </div>
        )}

        {/* Comments */}
        <div className="border-t border-cscx-gray-800 pt-4">
          <h3 className="text-sm font-medium text-cscx-gray-300 mb-3">
            Comments ({comments.length})
          </h3>
          <div className="space-y-2 max-h-48 overflow-y-auto mb-3">
            {comments.length === 0 ? (
              <p className="text-cscx-gray-400 text-sm">No comments yet</p>
            ) : (
              comments.map((c) => (
                <div key={c.id} className="bg-cscx-gray-900 rounded-lg px-3 py-2">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-white text-xs font-medium">{c.authorName}</span>
                    <span className="text-cscx-gray-400 text-xs">{formatDate(c.created_at)}</span>
                  </div>
                  <p className="text-cscx-gray-300 text-sm">{c.content}</p>
                </div>
              ))
            )}
          </div>
          <div className="flex gap-2">
            <input
              type="text"
              placeholder="Add a comment..."
              value={newComment}
              onChange={(e) => setNewComment(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && postComment()}
              className="input text-sm flex-1"
            />
            <button
              onClick={postComment}
              disabled={!newComment.trim() || submitting}
              className="btn btn-primary text-sm"
            >
              {submitting ? '...' : 'Post'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

// ===========================================================================
// Analytics Tab
// ===========================================================================

const AnalyticsTab: React.FC<{ apiFetch: (path: string, options?: RequestInit) => Promise<any> }> = ({
  apiFetch,
}) => {
  const [npsAnalytics, setNpsAnalytics] = useState<NpsAnalytics | null>(null);
  const [feedbackAnalytics, setFeedbackAnalytics] = useState<FeedbackAnalytics | null>(null);
  const [routingRules, setRoutingRules] = useState<RoutingRule[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchAll = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const [npsData, fbData, rulesData] = await Promise.allSettled([
        apiFetch('/api/nps/analytics'),
        apiFetch('/api/feedback/analytics'),
        apiFetch('/api/feedback/routing-rules'),
      ]);
      if (npsData.status === 'fulfilled') setNpsAnalytics(npsData.value);
      if (fbData.status === 'fulfilled') setFeedbackAnalytics(fbData.value);
      if (rulesData.status === 'fulfilled') setRoutingRules(rulesData.value.rules || []);
    } catch (err: any) {
      setError(err.message || 'Failed to load analytics');
    } finally {
      setLoading(false);
    }
  }, [apiFetch]);

  useEffect(() => {
    fetchAll();
  }, [fetchAll]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-6 w-6 border-2 border-cscx-accent border-t-transparent" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="card p-6 text-center">
        <p className="text-red-400 mb-3">{error}</p>
        <button onClick={fetchAll} className="btn btn-primary text-sm">
          Retry
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Key Metrics */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <MetricCard
          label="Overall NPS"
          value={npsAnalytics?.overall_score ?? '--'}
          sub={npsAnalytics ? `${npsAnalytics.total_responses} responses` : undefined}
        />
        <MetricCard
          label="Feedback Volume"
          value={feedbackAnalytics?.total ?? '--'}
          sub={feedbackAnalytics ? `${Object.keys(feedbackAnalytics.by_category).length} categories` : undefined}
        />
        <MetricCard
          label="Avg Resolution"
          value={feedbackAnalytics?.avg_resolution_hours != null
            ? `${Math.round(feedbackAnalytics.avg_resolution_hours)}h`
            : '--'}
          sub="resolution time"
        />
        <MetricCard
          label="Resolution Rate"
          value={feedbackAnalytics?.resolution_rate != null
            ? `${Math.round(feedbackAnalytics.resolution_rate * 100)}%`
            : '--'}
          sub="of feedback resolved"
        />
      </div>

      {/* NPS Trend */}
      {npsAnalytics?.trends && npsAnalytics.trends.length > 0 && (
        <div className="card p-4">
          <h3 className="text-sm font-medium text-white mb-3">NPS Trend</h3>
          <div className="flex items-end gap-1 h-24">
            {npsAnalytics.trends.map((t, i) => {
              const max = Math.max(...npsAnalytics.trends.map((x) => Math.abs(x.score)), 1);
              const heightPct = Math.max(10, (Math.abs(t.score) / max) * 100);
              return (
                <div key={i} className="flex-1 flex flex-col items-center justify-end">
                  <span className="text-xs text-cscx-gray-300 mb-1">{t.score}</span>
                  <div
                    className={`w-full rounded-t ${t.score >= 0 ? 'bg-green-500/60' : 'bg-red-500/60'}`}
                    style={{ height: `${heightPct}%` }}
                  />
                  <span className="text-[10px] text-cscx-gray-400 mt-1 truncate w-full text-center">
                    {t.period}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Sentiment Distribution */}
      {feedbackAnalytics?.by_sentiment && (
        <div className="card p-4">
          <h3 className="text-sm font-medium text-white mb-3">Sentiment Distribution</h3>
          {(() => {
            const sentiments = feedbackAnalytics.by_sentiment;
            const total = Object.values(sentiments).reduce((a, b) => a + b, 0) || 1;
            const colors: Record<string, string> = {
              positive: 'bg-green-500',
              negative: 'bg-red-500',
              neutral: 'bg-gray-500',
              mixed: 'bg-yellow-500',
            };
            return (
              <>
                <div className="flex rounded-full overflow-hidden h-3 bg-cscx-gray-800">
                  {Object.entries(sentiments).map(([key, count]) => (
                    <div
                      key={key}
                      className={`${colors[key] || 'bg-cscx-gray-600'} transition-all`}
                      style={{ width: `${(count / total) * 100}%` }}
                      title={`${key}: ${count}`}
                    />
                  ))}
                </div>
                <div className="flex flex-wrap gap-4 mt-2 text-xs">
                  {Object.entries(sentiments).map(([key, count]) => (
                    <span key={key} className="text-cscx-gray-300">
                      <span
                        className={`inline-block w-2 h-2 rounded-full mr-1 ${colors[key] || 'bg-cscx-gray-600'}`}
                      />
                      {key}: {count} ({Math.round((count / total) * 100)}%)
                    </span>
                  ))}
                </div>
              </>
            );
          })()}
        </div>
      )}

      {/* Category Distribution */}
      {feedbackAnalytics?.by_category && Object.keys(feedbackAnalytics.by_category).length > 0 && (
        <div className="card p-4">
          <h3 className="text-sm font-medium text-white mb-3">Feedback by Category</h3>
          <div className="space-y-2">
            {Object.entries(feedbackAnalytics.by_category)
              .sort(([, a], [, b]) => b - a)
              .map(([cat, count]) => {
                const total = Object.values(feedbackAnalytics.by_category).reduce((a, b) => a + b, 0) || 1;
                return (
                  <div key={cat} className="flex items-center gap-3">
                    <span className="text-sm text-cscx-gray-300 w-32 truncate">{cat}</span>
                    <div className="flex-1 bg-cscx-gray-800 rounded-full h-2">
                      <div
                        className="bg-cscx-accent rounded-full h-2 transition-all"
                        style={{ width: `${(count / total) * 100}%` }}
                      />
                    </div>
                    <span className="text-xs text-cscx-gray-400 w-8 text-right">{count}</span>
                  </div>
                );
              })}
          </div>
        </div>
      )}

      {/* Routing Rules */}
      {routingRules.length > 0 && (
        <div className="card p-4">
          <h3 className="text-sm font-medium text-white mb-3">Routing Rules</h3>
          <div className="table-container">
            <table className="w-full text-sm">
              <thead className="table-header">
                <tr>
                  <th className="table-cell text-left font-medium">Condition</th>
                  <th className="table-cell text-left font-medium">Target Team</th>
                  <th className="table-cell text-left font-medium">Priority</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-cscx-gray-800/50">
                {routingRules.map((rule) => (
                  <tr key={rule.id} className="table-row">
                    <td className="table-cell text-cscx-gray-300">{rule.condition}</td>
                    <td className="table-cell text-white">{rule.target_team}</td>
                    <td className="table-cell">
                      <StatusBadge status={rule.priority || 'normal'} colorMap={{
                        critical: 'badge-error',
                        high: 'bg-orange-500/20 text-orange-400',
                        medium: 'bg-yellow-500/20 text-yellow-400',
                        low: 'bg-cscx-gray-700/50 text-cscx-gray-400',
                        normal: 'bg-cscx-gray-700/50 text-cscx-gray-400',
                      }} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};

// ===========================================================================
// Metric Card (Analytics helper)
// ===========================================================================

const MetricCard: React.FC<{ label: string; value: string | number; sub?: string }> = ({
  label,
  value,
  sub,
}) => (
  <div className="card p-4">
    <p className="text-cscx-gray-400 text-xs mb-1">{label}</p>
    <p className="text-2xl font-bold text-white">{value}</p>
    {sub && <p className="text-cscx-gray-400 text-xs mt-1">{sub}</p>}
  </div>
);
