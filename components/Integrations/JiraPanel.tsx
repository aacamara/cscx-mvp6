/**
 * Jira Integration Panel - PRD-201
 *
 * Displays Jira issues linked to a customer, allowing CSMs to:
 * - View issue status and priority
 * - Get notified on status changes
 * - Create new issues with customer context
 * - See affected customers for impact analysis
 */

import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../../context/AuthContext';

const API_URL = import.meta.env.VITE_API_URL || '';

// ============================================
// Types
// ============================================

interface JiraIssue {
  id: string;
  jira_key: string;
  summary: string;
  description: string;
  issue_type: string;
  status: string;
  status_category: string;
  priority: string;
  assignee: string;
  reporter: string;
  labels: string[];
  jira_created_at: string;
  jira_updated_at: string;
  resolved_at: string | null;
}

interface JiraProject {
  id: string;
  key: string;
  name: string;
  projectTypeKey: string;
}

interface IssueType {
  id: string;
  name: string;
  subtask: boolean;
}

interface JiraMetrics {
  open_bugs: number;
  open_feature_requests: number;
  total_open_issues: number;
  critical_issues: number;
  high_priority_issues: number;
  resolved_last_7d: number;
  resolved_last_30d: number;
  avg_resolution_days: number | null;
}

interface ConnectionStatus {
  configured: boolean;
  connected: boolean;
  connection?: {
    baseUrl: string;
    cloudId?: string;
    authType: string;
    config: {
      syncSchedule: string;
      healthScoreWeight: number;
    };
  };
  lastSyncAt?: string;
  lastSyncStatus?: string;
}

interface JiraPanelProps {
  customerId: string;
  customerName?: string;
  healthScore?: number;
}

// ============================================
// Issue Type Icons
// ============================================

const IssueTypeIcon: React.FC<{ type: string }> = ({ type }) => {
  const iconClass = 'w-4 h-4';
  const typeLower = type.toLowerCase();

  if (typeLower.includes('bug') || typeLower.includes('defect')) {
    return (
      <svg className={`${iconClass} text-red-500`} fill="currentColor" viewBox="0 0 20 20">
        <path d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" />
      </svg>
    );
  }

  if (typeLower.includes('story') || typeLower.includes('feature')) {
    return (
      <svg className={`${iconClass} text-green-500`} fill="currentColor" viewBox="0 0 20 20">
        <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
      </svg>
    );
  }

  if (typeLower.includes('task')) {
    return (
      <svg className={`${iconClass} text-blue-500`} fill="currentColor" viewBox="0 0 20 20">
        <path d="M6 2a2 2 0 00-2 2v12a2 2 0 002 2h8a2 2 0 002-2V7.414A2 2 0 0015.414 6L12 2.586A2 2 0 0010.586 2H6zm5 6a1 1 0 10-2 0v3.586l-1.293-1.293a1 1 0 10-1.414 1.414l3 3a1 1 0 001.414 0l3-3a1 1 0 00-1.414-1.414L11 11.586V8z" />
      </svg>
    );
  }

  return (
    <svg className={`${iconClass} text-gray-500`} fill="currentColor" viewBox="0 0 20 20">
      <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-8-3a1 1 0 00-.867.5 1 1 0 11-1.731-1A3 3 0 0113 8a3.001 3.001 0 01-2 2.83V11a1 1 0 11-2 0v-1a1 1 0 011-1 1 1 0 100-2zm0 8a1 1 0 100-2 1 1 0 000 2z" clipRule="evenodd" />
    </svg>
  );
};

// ============================================
// Priority Badge
// ============================================

const PriorityBadge: React.FC<{ priority: string }> = ({ priority }) => {
  const priorityLower = priority?.toLowerCase() || '';
  let bgColor = 'bg-gray-100 text-gray-700';
  let icon = null;

  if (priorityLower.includes('highest') || priorityLower.includes('critical') || priorityLower.includes('blocker')) {
    bgColor = 'bg-red-100 text-red-800';
    icon = (
      <svg className="w-3 h-3 mr-1" fill="currentColor" viewBox="0 0 20 20">
        <path fillRule="evenodd" d="M5.293 9.707a1 1 0 010-1.414l4-4a1 1 0 011.414 0l4 4a1 1 0 01-1.414 1.414L10 6.414l-3.293 3.293a1 1 0 01-1.414 0z" clipRule="evenodd" />
      </svg>
    );
  } else if (priorityLower.includes('high')) {
    bgColor = 'bg-orange-100 text-orange-800';
  } else if (priorityLower.includes('medium') || priorityLower.includes('normal')) {
    bgColor = 'bg-yellow-100 text-yellow-800';
  } else if (priorityLower.includes('low')) {
    bgColor = 'bg-green-100 text-green-800';
  }

  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${bgColor}`}>
      {icon}
      {priority || 'None'}
    </span>
  );
};

// ============================================
// Status Badge
// ============================================

const StatusBadge: React.FC<{ status: string; category: string }> = ({ status, category }) => {
  let bgColor = 'bg-gray-100 text-gray-700';

  if (category === 'done') {
    bgColor = 'bg-green-100 text-green-800';
  } else if (category === 'indeterminate') {
    bgColor = 'bg-blue-100 text-blue-800';
  } else if (category === 'new') {
    bgColor = 'bg-gray-100 text-gray-700';
  }

  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${bgColor}`}>
      {status}
    </span>
  );
};

// ============================================
// Create Issue Modal
// ============================================

interface CreateIssueModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: CreateIssueFormData) => Promise<void>;
  projects: JiraProject[];
  issueTypes: IssueType[];
  customerId: string;
  customerName?: string;
  healthScore?: number;
  loadingIssueTypes: boolean;
  onProjectChange: (projectKey: string) => void;
}

interface CreateIssueFormData {
  projectKey: string;
  summary: string;
  description: string;
  issueType: string;
  priority: string;
}

const CreateIssueModal: React.FC<CreateIssueModalProps> = ({
  isOpen,
  onClose,
  onSubmit,
  projects,
  issueTypes,
  customerName,
  healthScore,
  loadingIssueTypes,
  onProjectChange,
}) => {
  const [formData, setFormData] = useState<CreateIssueFormData>({
    projectKey: '',
    summary: '',
    description: '',
    issueType: '',
    priority: 'Medium',
  });
  const [submitting, setSubmitting] = useState(false);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      await onSubmit(formData);
      onClose();
      setFormData({ projectKey: '', summary: '', description: '', issueType: '', priority: 'Medium' });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-lg mx-4">
        <div className="px-6 py-4 border-b border-gray-200">
          <h3 className="text-lg font-medium text-gray-900">Create Jira Issue</h3>
          {customerName && (
            <p className="mt-1 text-sm text-gray-500">
              For customer: {customerName} {healthScore !== undefined && `(Health: ${healthScore})`}
            </p>
          )}
        </div>

        <form onSubmit={handleSubmit} className="px-6 py-4 space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700">Project</label>
            <select
              value={formData.projectKey}
              onChange={(e) => {
                setFormData({ ...formData, projectKey: e.target.value, issueType: '' });
                onProjectChange(e.target.value);
              }}
              className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-cscx-accent focus:ring-cscx-accent"
              required
            >
              <option value="">Select a project</option>
              {projects.map((p) => (
                <option key={p.id} value={p.key}>
                  {p.name} ({p.key})
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700">Issue Type</label>
            <select
              value={formData.issueType}
              onChange={(e) => setFormData({ ...formData, issueType: e.target.value })}
              className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-cscx-accent focus:ring-cscx-accent"
              required
              disabled={!formData.projectKey || loadingIssueTypes}
            >
              <option value="">Select issue type</option>
              {issueTypes
                .filter((t) => !t.subtask)
                .map((t) => (
                  <option key={t.id} value={t.name}>
                    {t.name}
                  </option>
                ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700">Summary</label>
            <input
              type="text"
              value={formData.summary}
              onChange={(e) => setFormData({ ...formData, summary: e.target.value })}
              className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-cscx-accent focus:ring-cscx-accent"
              placeholder="Brief summary of the issue"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700">Description</label>
            <textarea
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              rows={4}
              className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-cscx-accent focus:ring-cscx-accent"
              placeholder="Detailed description of the issue"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700">Priority</label>
            <select
              value={formData.priority}
              onChange={(e) => setFormData({ ...formData, priority: e.target.value })}
              className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-cscx-accent focus:ring-cscx-accent"
            >
              <option value="Highest">Highest</option>
              <option value="High">High</option>
              <option value="Medium">Medium</option>
              <option value="Low">Low</option>
              <option value="Lowest">Lowest</option>
            </select>
          </div>

          <div className="flex justify-end space-x-3 pt-4 border-t border-gray-200">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="px-4 py-2 text-sm font-medium text-white bg-cscx-accent border border-transparent rounded-md hover:bg-red-600 disabled:opacity-50"
            >
              {submitting ? 'Creating...' : 'Create Issue'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

// ============================================
// Main Jira Panel Component
// ============================================

export const JiraPanel: React.FC<JiraPanelProps> = ({ customerId, customerName, healthScore }) => {
  const { getAuthHeaders, user } = useAuth();

  // State
  const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus | null>(null);
  const [issues, setIssues] = useState<JiraIssue[]>([]);
  const [metrics, setMetrics] = useState<JiraMetrics | null>(null);
  const [projects, setProjects] = useState<JiraProject[]>([]);
  const [issueTypes, setIssueTypes] = useState<IssueType[]>([]);

  // Loading states
  const [loadingConnection, setLoadingConnection] = useState(true);
  const [loadingIssues, setLoadingIssues] = useState(false);
  const [loadingMetrics, setLoadingMetrics] = useState(false);
  const [loadingProjects, setLoadingProjects] = useState(false);
  const [loadingIssueTypes, setLoadingIssueTypes] = useState(false);
  const [syncing, setSyncing] = useState(false);

  // UI state
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<'all' | 'open' | 'bugs' | 'features'>('open');

  // ============================================
  // Data Loading
  // ============================================

  const checkConnectionStatus = useCallback(async () => {
    try {
      const response = await fetch(`${API_URL}/api/integrations/jira/status?userId=${user?.id}`, {
        headers: getAuthHeaders(),
      });
      if (response.ok) {
        const data = await response.json();
        setConnectionStatus(data);
      }
    } catch (err) {
      console.error('Failed to check Jira connection:', err);
    } finally {
      setLoadingConnection(false);
    }
  }, [getAuthHeaders, user?.id]);

  const loadIssues = useCallback(async () => {
    setLoadingIssues(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (filter === 'open') {
        // Filter for open issues only
      } else if (filter === 'bugs') {
        params.append('type', 'Bug');
      } else if (filter === 'features') {
        params.append('type', 'Story');
      }

      const response = await fetch(
        `${API_URL}/api/integrations/jira/issues/${customerId}?${params.toString()}`,
        { headers: getAuthHeaders() }
      );
      if (response.ok) {
        const data = await response.json();
        setIssues(data.issues || []);
      }
    } catch (err) {
      setError('Failed to load issues');
      console.error('Failed to load Jira issues:', err);
    } finally {
      setLoadingIssues(false);
    }
  }, [customerId, filter, getAuthHeaders]);

  const loadMetrics = useCallback(async () => {
    setLoadingMetrics(true);
    try {
      const response = await fetch(`${API_URL}/api/integrations/jira/metrics/${customerId}`, {
        headers: getAuthHeaders(),
      });
      if (response.ok) {
        const data = await response.json();
        if (data.metrics && data.metrics.length > 0) {
          setMetrics(data.metrics[0]);
        }
      }
    } catch (err) {
      console.error('Failed to load Jira metrics:', err);
    } finally {
      setLoadingMetrics(false);
    }
  }, [customerId, getAuthHeaders]);

  const loadProjects = useCallback(async () => {
    setLoadingProjects(true);
    try {
      const response = await fetch(`${API_URL}/api/integrations/jira/projects?userId=${user?.id}`, {
        headers: getAuthHeaders(),
      });
      if (response.ok) {
        const data = await response.json();
        setProjects(data.projects || []);
      }
    } catch (err) {
      console.error('Failed to load Jira projects:', err);
    } finally {
      setLoadingProjects(false);
    }
  }, [getAuthHeaders, user?.id]);

  const loadIssueTypes = useCallback(
    async (projectKey: string) => {
      if (!projectKey) return;
      setLoadingIssueTypes(true);
      try {
        const response = await fetch(
          `${API_URL}/api/integrations/jira/projects/${projectKey}/issue-types?userId=${user?.id}`,
          { headers: getAuthHeaders() }
        );
        if (response.ok) {
          const data = await response.json();
          setIssueTypes(data.issueTypes || []);
        }
      } catch (err) {
        console.error('Failed to load issue types:', err);
      } finally {
        setLoadingIssueTypes(false);
      }
    },
    [getAuthHeaders, user?.id]
  );

  // ============================================
  // Actions
  // ============================================

  const syncIssues = async () => {
    setSyncing(true);
    try {
      const response = await fetch(`${API_URL}/api/integrations/jira/sync`, {
        method: 'POST',
        headers: {
          ...getAuthHeaders(),
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ userId: user?.id, customerId }),
      });
      if (response.ok) {
        await loadIssues();
        await loadMetrics();
      }
    } catch (err) {
      setError('Failed to sync issues');
      console.error('Failed to sync Jira issues:', err);
    } finally {
      setSyncing(false);
    }
  };

  const createIssue = async (formData: CreateIssueFormData) => {
    const response = await fetch(`${API_URL}/api/integrations/jira/issues`, {
      method: 'POST',
      headers: {
        ...getAuthHeaders(),
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        userId: user?.id,
        customerId,
        customerName,
        healthScore,
        ...formData,
      }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to create issue');
    }

    await loadIssues();
  };

  // ============================================
  // Effects
  // ============================================

  useEffect(() => {
    checkConnectionStatus();
  }, [checkConnectionStatus]);

  useEffect(() => {
    if (connectionStatus?.connected) {
      loadIssues();
      loadMetrics();
      loadProjects();
    }
  }, [connectionStatus?.connected, loadIssues, loadMetrics, loadProjects]);

  // ============================================
  // Render
  // ============================================

  if (loadingConnection) {
    return (
      <div className="bg-white rounded-lg shadow p-6">
        <div className="animate-pulse">
          <div className="h-6 bg-gray-200 rounded w-1/4 mb-4"></div>
          <div className="h-4 bg-gray-200 rounded w-3/4"></div>
        </div>
      </div>
    );
  }

  if (!connectionStatus?.connected) {
    return (
      <div className="bg-white rounded-lg shadow p-6">
        <div className="text-center py-8">
          <svg className="mx-auto h-12 w-12 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
          </svg>
          <h3 className="mt-2 text-sm font-medium text-gray-900">Jira not connected</h3>
          <p className="mt-1 text-sm text-gray-500">
            Connect your Jira account to view and manage issues for this customer.
          </p>
          <div className="mt-6">
            <a
              href="/settings/integrations"
              className="inline-flex items-center px-4 py-2 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-cscx-accent hover:bg-red-600"
            >
              Connect Jira
            </a>
          </div>
        </div>
      </div>
    );
  }

  const filteredIssues = issues.filter((issue) => {
    if (filter === 'open') return issue.status_category !== 'done';
    if (filter === 'bugs') return issue.issue_type?.toLowerCase().includes('bug');
    if (filter === 'features') return issue.issue_type?.toLowerCase().includes('story') || issue.issue_type?.toLowerCase().includes('feature');
    return true;
  });

  return (
    <div className="bg-white rounded-lg shadow">
      {/* Header */}
      <div className="px-6 py-4 border-b border-gray-200">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <svg className="h-6 w-6 text-blue-600" fill="currentColor" viewBox="0 0 24 24">
              <path d="M11.571 11.513H0a5.218 5.218 0 0 0 5.232 5.215h2.13v2.057A5.215 5.215 0 0 0 12.575 24V12.518a1.005 1.005 0 0 0-1.005-1.005zm5.723-5.756H5.232a5.218 5.218 0 0 0 5.215 5.232h2.13v2.057a5.215 5.215 0 0 0 5.215 5.214V6.761a1.005 1.005 0 0 0-1.005-1.005zM23.013 0H11.571a5.218 5.218 0 0 0 5.215 5.232h2.13v2.057a5.215 5.215 0 0 0 5.214 5.214V1.004A1.005 1.005 0 0 0 23.013 0z" />
            </svg>
            <h3 className="text-lg font-medium text-gray-900">Jira Issues</h3>
          </div>
          <div className="flex items-center space-x-2">
            <button
              onClick={syncIssues}
              disabled={syncing}
              className="inline-flex items-center px-3 py-1.5 border border-gray-300 shadow-sm text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50"
            >
              {syncing ? (
                <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-gray-500" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                </svg>
              ) : (
                <svg className="-ml-1 mr-2 h-4 w-4 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
              )}
              Sync
            </button>
            <button
              onClick={() => setShowCreateModal(true)}
              className="inline-flex items-center px-3 py-1.5 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-cscx-accent hover:bg-red-600"
            >
              <svg className="-ml-1 mr-2 h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              Create Issue
            </button>
          </div>
        </div>
      </div>

      {/* Metrics Summary */}
      {metrics && (
        <div className="px-6 py-4 bg-gray-50 border-b border-gray-200">
          <div className="grid grid-cols-4 gap-4">
            <div className="text-center">
              <div className="text-2xl font-bold text-gray-900">{metrics.total_open_issues}</div>
              <div className="text-xs text-gray-500">Open Issues</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-red-600">{metrics.open_bugs}</div>
              <div className="text-xs text-gray-500">Open Bugs</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-orange-600">
                {metrics.critical_issues + metrics.high_priority_issues}
              </div>
              <div className="text-xs text-gray-500">High Priority</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-green-600">{metrics.resolved_last_7d}</div>
              <div className="text-xs text-gray-500">Resolved (7d)</div>
            </div>
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="px-6 py-3 border-b border-gray-200">
        <div className="flex space-x-2">
          {(['open', 'all', 'bugs', 'features'] as const).map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`px-3 py-1.5 text-sm font-medium rounded-md ${
                filter === f
                  ? 'bg-cscx-accent text-white'
                  : 'text-gray-600 bg-gray-100 hover:bg-gray-200'
              }`}
            >
              {f.charAt(0).toUpperCase() + f.slice(1)}
            </button>
          ))}
        </div>
      </div>

      {/* Issues List */}
      <div className="divide-y divide-gray-200">
        {loadingIssues ? (
          <div className="px-6 py-8 text-center">
            <svg className="animate-spin mx-auto h-8 w-8 text-gray-400" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
            </svg>
          </div>
        ) : filteredIssues.length === 0 ? (
          <div className="px-6 py-8 text-center text-gray-500">
            No issues found for this customer.
          </div>
        ) : (
          filteredIssues.map((issue) => (
            <div key={issue.id} className="px-6 py-4 hover:bg-gray-50">
              <div className="flex items-start justify-between">
                <div className="flex items-start space-x-3">
                  <IssueTypeIcon type={issue.issue_type} />
                  <div>
                    <div className="flex items-center space-x-2">
                      <a
                        href={`${connectionStatus.connection?.baseUrl}/browse/${issue.jira_key}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-sm font-medium text-blue-600 hover:text-blue-800"
                      >
                        {issue.jira_key}
                      </a>
                      <StatusBadge status={issue.status} category={issue.status_category} />
                      <PriorityBadge priority={issue.priority} />
                    </div>
                    <p className="mt-1 text-sm text-gray-900">{issue.summary}</p>
                    <div className="mt-1 flex items-center space-x-4 text-xs text-gray-500">
                      {issue.assignee && <span>Assignee: {issue.assignee}</span>}
                      <span>Updated: {new Date(issue.jira_updated_at).toLocaleDateString()}</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Error Display */}
      {error && (
        <div className="px-6 py-4 bg-red-50 border-t border-red-200">
          <p className="text-sm text-red-600">{error}</p>
        </div>
      )}

      {/* Create Issue Modal */}
      <CreateIssueModal
        isOpen={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        onSubmit={createIssue}
        projects={projects}
        issueTypes={issueTypes}
        customerId={customerId}
        customerName={customerName}
        healthScore={healthScore}
        loadingIssueTypes={loadingIssueTypes}
        onProjectChange={loadIssueTypes}
      />
    </div>
  );
};

export default JiraPanel;
