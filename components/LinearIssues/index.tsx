/**
 * Linear Issues Component - PRD-202
 *
 * Displays Linear issues linked to a customer:
 * - Issue list with state indicators
 * - Priority badges
 * - Quick filters by state
 * - Issue creation modal
 * - Sync controls
 */

import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../../context/AuthContext';
import {
  CheckCircle,
  AlertCircle,
  X,
  Loader2,
  Link,
  Unlink,
  RefreshCw,
  Plus,
  ExternalLink,
  Clock,
  User,
  Tag,
  Folder,
  AlertTriangle,
  Circle,
  CheckCircle2,
  XCircle,
  ArrowUp,
  ArrowDown,
  Filter,
  ChevronDown,
} from 'lucide-react';

// ============================================
// Types
// ============================================

interface LinearIssue {
  id: string;
  identifier: string;
  title: string;
  description?: string;
  state: {
    name: string;
    type: 'backlog' | 'unstarted' | 'started' | 'completed' | 'canceled';
    color: string;
  };
  priority: number;
  priorityLabel: string;
  assignee?: {
    name: string;
    email?: string;
  };
  team: {
    name: string;
    key: string;
  };
  project?: {
    name: string;
  };
  labels: Array<{
    name: string;
    color: string;
  }>;
  dueDate?: string;
  url: string;
  createdAt: string;
  updatedAt: string;
  completedAt?: string;
}

interface LinearTeam {
  id: string;
  name: string;
  key: string;
}

interface LinearLabel {
  id: string;
  name: string;
  color: string;
}

interface SyncStatus {
  configured: boolean;
  connected: boolean;
  lastSyncAt?: string;
  lastSyncStatus?: 'completed' | 'failed' | 'running';
  issuesSynced?: number;
}

interface LinearIssuesProps {
  customerId: string;
  customerName: string;
  onClose?: () => void;
  compact?: boolean;
}

// ============================================
// Helper Functions
// ============================================

function getPriorityIcon(priority: number): React.ReactNode {
  switch (priority) {
    case 1:
      return <AlertTriangle className="w-4 h-4 text-red-500" />;
    case 2:
      return <ArrowUp className="w-4 h-4 text-orange-500" />;
    case 3:
      return <Circle className="w-4 h-4 text-yellow-500" />;
    case 4:
      return <ArrowDown className="w-4 h-4 text-blue-400" />;
    default:
      return <Circle className="w-4 h-4 text-cscx-gray-500" />;
  }
}

function getStateIcon(stateType: string): React.ReactNode {
  switch (stateType) {
    case 'completed':
      return <CheckCircle2 className="w-4 h-4 text-green-500" />;
    case 'canceled':
      return <XCircle className="w-4 h-4 text-red-500" />;
    case 'started':
      return <Circle className="w-4 h-4 text-blue-500 fill-blue-500" />;
    case 'unstarted':
      return <Circle className="w-4 h-4 text-cscx-gray-400" />;
    case 'backlog':
      return <Circle className="w-4 h-4 text-cscx-gray-600" />;
    default:
      return <Circle className="w-4 h-4 text-cscx-gray-500" />;
  }
}

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

function formatRelativeTime(dateStr: string): string {
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffDays === 0) return 'Today';
  if (diffDays === 1) return 'Yesterday';
  if (diffDays < 7) return `${diffDays} days ago`;
  if (diffDays < 30) return `${Math.floor(diffDays / 7)} weeks ago`;
  return formatDate(dateStr);
}

// ============================================
// Main Component
// ============================================

export function LinearIssues({ customerId, customerName, onClose, compact = false }: LinearIssuesProps) {
  const { user, getAuthHeaders } = useAuth();
  const [status, setStatus] = useState<SyncStatus | null>(null);
  const [issues, setIssues] = useState<LinearIssue[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<'all' | 'open' | 'completed'>('open');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [teams, setTeams] = useState<LinearTeam[]>([]);
  const [labels, setLabels] = useState<LinearLabel[]>([]);

  // Create issue form state
  const [newIssue, setNewIssue] = useState({
    title: '',
    description: '',
    teamId: '',
    priority: 3,
    labelIds: [] as string[],
  });
  const [creating, setCreating] = useState(false);

  const API_URL = import.meta.env.VITE_API_URL || '';
  const userId = user?.id;

  // Fetch connection status
  const fetchStatus = useCallback(async () => {
    if (!userId) return;

    try {
      const response = await fetch(`${API_URL}/api/linear/status?userId=${userId}`, {
        headers: getAuthHeaders(),
      });

      if (response.ok) {
        const data = await response.json();
        setStatus(data);
      }
    } catch (err) {
      console.error('Error fetching Linear status:', err);
    }
  }, [API_URL, userId, getAuthHeaders]);

  // Fetch issues
  const fetchIssues = useCallback(async () => {
    if (!userId || !customerId) return;

    setLoading(true);
    setError(null);

    try {
      const response = await fetch(
        `${API_URL}/api/linear/issues/${customerId}?status=${filter}`,
        { headers: getAuthHeaders() }
      );

      if (response.ok) {
        const data = await response.json();
        setIssues(data.issues || []);
      } else {
        const errorData = await response.json();
        setError(errorData.error || 'Failed to fetch issues');
      }
    } catch (err) {
      console.error('Error fetching issues:', err);
      setError('Unable to fetch issues');
    } finally {
      setLoading(false);
    }
  }, [API_URL, userId, customerId, filter, getAuthHeaders]);

  // Fetch teams and labels for create modal
  const fetchTeamsAndLabels = useCallback(async () => {
    if (!userId) return;

    try {
      const [teamsResponse, labelsResponse] = await Promise.all([
        fetch(`${API_URL}/api/linear/teams?userId=${userId}`, { headers: getAuthHeaders() }),
        fetch(`${API_URL}/api/linear/labels?userId=${userId}`, { headers: getAuthHeaders() }),
      ]);

      if (teamsResponse.ok) {
        const teamsData = await teamsResponse.json();
        setTeams(teamsData.teams || []);
        if (teamsData.teams?.length > 0 && !newIssue.teamId) {
          setNewIssue((prev) => ({ ...prev, teamId: teamsData.teams[0].id }));
        }
      }

      if (labelsResponse.ok) {
        const labelsData = await labelsResponse.json();
        setLabels(labelsData.labels || []);
      }
    } catch (err) {
      console.error('Error fetching teams/labels:', err);
    }
  }, [API_URL, userId, getAuthHeaders, newIssue.teamId]);

  useEffect(() => {
    fetchStatus();
    fetchIssues();
  }, [fetchStatus, fetchIssues]);

  useEffect(() => {
    if (showCreateModal && teams.length === 0) {
      fetchTeamsAndLabels();
    }
  }, [showCreateModal, teams.length, fetchTeamsAndLabels]);

  // Handle sync
  const handleSync = async () => {
    if (!userId || !customerId) return;

    setSyncing(true);
    setError(null);

    try {
      const response = await fetch(`${API_URL}/api/linear/sync`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...getAuthHeaders(),
        },
        body: JSON.stringify({ userId, customerId }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Sync failed');
      }

      // Refresh issues after sync
      await fetchIssues();
      await fetchStatus();
    } catch (err) {
      console.error('Sync error:', err);
      setError(err instanceof Error ? err.message : 'Sync failed');
    } finally {
      setSyncing(false);
    }
  };

  // Handle create issue
  const handleCreateIssue = async () => {
    if (!userId || !newIssue.teamId || !newIssue.title) return;

    setCreating(true);
    setError(null);

    try {
      const response = await fetch(`${API_URL}/api/linear/issues`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...getAuthHeaders(),
        },
        body: JSON.stringify({
          userId,
          customerId,
          issue: {
            teamId: newIssue.teamId,
            title: newIssue.title,
            description: newIssue.description || `Customer: ${customerName}`,
            priority: newIssue.priority,
            labelIds: newIssue.labelIds,
          },
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to create issue');
      }

      // Reset form and close modal
      setNewIssue({
        title: '',
        description: '',
        teamId: teams[0]?.id || '',
        priority: 3,
        labelIds: [],
      });
      setShowCreateModal(false);

      // Refresh issues
      await fetchIssues();
    } catch (err) {
      console.error('Create issue error:', err);
      setError(err instanceof Error ? err.message : 'Failed to create issue');
    } finally {
      setCreating(false);
    }
  };

  // Render issue card
  const renderIssueCard = (issue: LinearIssue) => (
    <div
      key={issue.id}
      className="p-3 bg-cscx-gray-800/50 rounded-lg border border-cscx-gray-700 hover:border-cscx-gray-600 transition-colors"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-3 flex-1 min-w-0">
          <div className="flex-shrink-0 mt-0.5">{getStateIcon(issue.state.type)}</div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <span className="text-xs text-cscx-gray-400 font-mono">{issue.identifier}</span>
              {getPriorityIcon(issue.priority)}
            </div>
            <h4 className="text-sm text-white font-medium truncate">{issue.title}</h4>
            <div className="flex items-center gap-3 mt-2 text-xs text-cscx-gray-400">
              {issue.assignee && (
                <div className="flex items-center gap-1">
                  <User className="w-3 h-3" />
                  <span className="truncate max-w-[100px]">{issue.assignee.name}</span>
                </div>
              )}
              {issue.project && (
                <div className="flex items-center gap-1">
                  <Folder className="w-3 h-3" />
                  <span className="truncate max-w-[100px]">{issue.project.name}</span>
                </div>
              )}
              <div className="flex items-center gap-1">
                <Clock className="w-3 h-3" />
                <span>{formatRelativeTime(issue.updatedAt)}</span>
              </div>
            </div>
            {issue.labels.length > 0 && (
              <div className="flex items-center gap-1 mt-2 flex-wrap">
                {issue.labels.slice(0, 3).map((label) => (
                  <span
                    key={label.name}
                    className="px-1.5 py-0.5 text-xs rounded"
                    style={{
                      backgroundColor: `${label.color}20`,
                      color: label.color,
                    }}
                  >
                    {label.name}
                  </span>
                ))}
                {issue.labels.length > 3 && (
                  <span className="text-xs text-cscx-gray-500">
                    +{issue.labels.length - 3}
                  </span>
                )}
              </div>
            )}
          </div>
        </div>
        <a
          href={issue.url}
          target="_blank"
          rel="noopener noreferrer"
          className="flex-shrink-0 p-1.5 text-cscx-gray-400 hover:text-white hover:bg-cscx-gray-700 rounded transition-colors"
          title="Open in Linear"
        >
          <ExternalLink className="w-4 h-4" />
        </a>
      </div>
    </div>
  );

  // Render create modal
  const renderCreateModal = () => (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-cscx-gray-900 rounded-xl border border-cscx-gray-700 w-full max-w-lg mx-4">
        <div className="flex items-center justify-between p-4 border-b border-cscx-gray-700">
          <h3 className="text-lg font-semibold text-white">Create Linear Issue</h3>
          <button
            onClick={() => setShowCreateModal(false)}
            className="p-1 text-cscx-gray-400 hover:text-white rounded"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-4 space-y-4">
          {/* Title */}
          <div>
            <label className="block text-sm text-cscx-gray-400 mb-1">Title *</label>
            <input
              type="text"
              value={newIssue.title}
              onChange={(e) => setNewIssue((prev) => ({ ...prev, title: e.target.value }))}
              placeholder="Issue title"
              className="w-full bg-cscx-gray-800 border border-cscx-gray-700 rounded-lg px-3 py-2 text-white placeholder-cscx-gray-500 focus:outline-none focus:border-cscx-accent"
            />
          </div>

          {/* Description */}
          <div>
            <label className="block text-sm text-cscx-gray-400 mb-1">Description</label>
            <textarea
              value={newIssue.description}
              onChange={(e) => setNewIssue((prev) => ({ ...prev, description: e.target.value }))}
              placeholder={`Describe the issue...\n\nCustomer context will be added automatically.`}
              rows={4}
              className="w-full bg-cscx-gray-800 border border-cscx-gray-700 rounded-lg px-3 py-2 text-white placeholder-cscx-gray-500 focus:outline-none focus:border-cscx-accent resize-none"
            />
          </div>

          {/* Team */}
          <div>
            <label className="block text-sm text-cscx-gray-400 mb-1">Team *</label>
            <select
              value={newIssue.teamId}
              onChange={(e) => setNewIssue((prev) => ({ ...prev, teamId: e.target.value }))}
              className="w-full bg-cscx-gray-800 border border-cscx-gray-700 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-cscx-accent"
            >
              <option value="">Select a team</option>
              {teams.map((team) => (
                <option key={team.id} value={team.id}>
                  {team.key} - {team.name}
                </option>
              ))}
            </select>
          </div>

          {/* Priority */}
          <div>
            <label className="block text-sm text-cscx-gray-400 mb-1">Priority</label>
            <div className="flex gap-2">
              {[
                { value: 1, label: 'Urgent', color: 'red' },
                { value: 2, label: 'High', color: 'orange' },
                { value: 3, label: 'Normal', color: 'yellow' },
                { value: 4, label: 'Low', color: 'blue' },
              ].map((p) => (
                <button
                  key={p.value}
                  onClick={() => setNewIssue((prev) => ({ ...prev, priority: p.value }))}
                  className={`flex-1 py-2 px-3 rounded-lg text-sm font-medium transition-colors ${
                    newIssue.priority === p.value
                      ? `bg-${p.color}-500/20 text-${p.color}-400 border border-${p.color}-500/50`
                      : 'bg-cscx-gray-800 text-cscx-gray-400 hover:text-white border border-transparent'
                  }`}
                >
                  {p.label}
                </button>
              ))}
            </div>
          </div>

          {/* Labels */}
          {labels.length > 0 && (
            <div>
              <label className="block text-sm text-cscx-gray-400 mb-1">Labels</label>
              <div className="flex flex-wrap gap-2">
                {labels.slice(0, 10).map((label) => (
                  <button
                    key={label.id}
                    onClick={() => {
                      setNewIssue((prev) => ({
                        ...prev,
                        labelIds: prev.labelIds.includes(label.id)
                          ? prev.labelIds.filter((id) => id !== label.id)
                          : [...prev.labelIds, label.id],
                      }));
                    }}
                    className={`px-2 py-1 text-xs rounded transition-colors ${
                      newIssue.labelIds.includes(label.id)
                        ? 'ring-2 ring-white/50'
                        : 'opacity-60 hover:opacity-100'
                    }`}
                    style={{
                      backgroundColor: `${label.color}30`,
                      color: label.color,
                    }}
                  >
                    {label.name}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Customer info */}
          <div className="p-3 bg-cscx-gray-800/50 rounded-lg text-sm text-cscx-gray-400">
            <span className="text-cscx-gray-500">Customer:</span>{' '}
            <span className="text-white">{customerName}</span>
          </div>
        </div>

        <div className="flex justify-end gap-3 p-4 border-t border-cscx-gray-700">
          <button
            onClick={() => setShowCreateModal(false)}
            className="px-4 py-2 text-cscx-gray-400 hover:text-white transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleCreateIssue}
            disabled={creating || !newIssue.title || !newIssue.teamId}
            className="flex items-center gap-2 px-4 py-2 bg-[#5E6AD2] hover:bg-[#4F5AC2] text-white font-medium rounded-lg transition-colors disabled:opacity-50"
          >
            {creating ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Plus className="w-4 h-4" />
            )}
            Create Issue
          </button>
        </div>
      </div>
    </div>
  );

  return (
    <div className={`bg-cscx-gray-900 rounded-xl border border-cscx-gray-700 overflow-hidden ${compact ? '' : 'max-h-[80vh] overflow-y-auto'}`}>
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-cscx-gray-700 sticky top-0 bg-cscx-gray-900 z-10">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-[#5E6AD2] rounded-lg flex items-center justify-center">
            <svg className="w-6 h-6 text-white" viewBox="0 0 100 100" fill="currentColor">
              <path d="M50 0C22.4 0 0 22.4 0 50s22.4 50 50 50 50-22.4 50-50S77.6 0 50 0zm0 90c-22.1 0-40-17.9-40-40s17.9-40 40-40 40 17.9 40 40-17.9 40-40 40z" />
              <path d="M50 25c-13.8 0-25 11.2-25 25s11.2 25 25 25 25-11.2 25-25-11.2-25-25-25zm0 40c-8.3 0-15-6.7-15-15s6.7-15 15-15 15 6.7 15 15-6.7 15-15 15z" />
            </svg>
          </div>
          <div>
            <h3 className="text-lg font-semibold text-white">Linear Issues</h3>
            <p className="text-sm text-cscx-gray-400">Issues linked to {customerName}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {status?.connected && (
            <>
              <button
                onClick={() => setShowCreateModal(true)}
                className="flex items-center gap-2 px-3 py-1.5 text-sm text-white bg-[#5E6AD2] hover:bg-[#4F5AC2] rounded-lg transition-colors"
              >
                <Plus className="w-4 h-4" />
                New Issue
              </button>
              <button
                onClick={handleSync}
                disabled={syncing}
                className="flex items-center gap-2 px-3 py-1.5 text-sm text-cscx-gray-400 hover:text-white hover:bg-cscx-gray-800 rounded-lg transition-colors disabled:opacity-50"
              >
                {syncing ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <RefreshCw className="w-4 h-4" />
                )}
                Sync
              </button>
            </>
          )}
          {onClose && (
            <button
              onClick={onClose}
              className="p-2 text-cscx-gray-400 hover:text-white hover:bg-cscx-gray-800 rounded-lg transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          )}
        </div>
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

      {/* Not connected state */}
      {status && !status.connected && (
        <div className="p-8 text-center">
          <div className="w-16 h-16 bg-cscx-gray-800 rounded-full flex items-center justify-center mx-auto mb-4">
            <Unlink className="w-8 h-8 text-cscx-gray-500" />
          </div>
          <h4 className="text-lg font-medium text-white mb-2">Linear Not Connected</h4>
          <p className="text-cscx-gray-400 text-sm mb-4">
            Connect Linear to view and create issues for this customer.
          </p>
          <a
            href="/settings/integrations"
            className="inline-flex items-center gap-2 px-4 py-2 bg-[#5E6AD2] hover:bg-[#4F5AC2] text-white font-medium rounded-lg transition-colors"
          >
            <Link className="w-4 h-4" />
            Connect Linear
          </a>
        </div>
      )}

      {/* Connected state */}
      {status?.connected && (
        <>
          {/* Filter tabs */}
          <div className="flex items-center gap-1 px-4 py-2 border-b border-cscx-gray-700">
            {[
              { value: 'open', label: 'Open' },
              { value: 'completed', label: 'Completed' },
              { value: 'all', label: 'All' },
            ].map((tab) => (
              <button
                key={tab.value}
                onClick={() => setFilter(tab.value as typeof filter)}
                className={`px-3 py-1.5 text-sm font-medium rounded-lg transition-colors ${
                  filter === tab.value
                    ? 'bg-cscx-gray-800 text-white'
                    : 'text-cscx-gray-400 hover:text-white'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {/* Issues list */}
          <div className="p-4">
            {loading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="w-8 h-8 text-cscx-accent animate-spin" />
              </div>
            ) : issues.length === 0 ? (
              <div className="text-center py-12">
                <div className="w-12 h-12 bg-cscx-gray-800 rounded-full flex items-center justify-center mx-auto mb-3">
                  <CheckCircle2 className="w-6 h-6 text-cscx-gray-500" />
                </div>
                <p className="text-cscx-gray-400">
                  {filter === 'open'
                    ? 'No open issues'
                    : filter === 'completed'
                    ? 'No completed issues'
                    : 'No issues found'}
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {issues.map(renderIssueCard)}
              </div>
            )}
          </div>

          {/* Last sync info */}
          {status.lastSyncAt && (
            <div className="px-4 pb-4">
              <div className="text-xs text-cscx-gray-500 text-center">
                Last synced: {formatRelativeTime(status.lastSyncAt)}
              </div>
            </div>
          )}
        </>
      )}

      {/* Create modal */}
      {showCreateModal && renderCreateModal()}
    </div>
  );
}

export default LinearIssues;
