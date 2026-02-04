/**
 * CADGResolutionPlanPreview - Editable resolution plan preview for CADG-generated plans
 * Allows users to review, edit, and approve resolution plans before creating document
 */

import React, { useState, useMemo } from 'react';
import { useAuth } from '../../context/AuthContext';

// ============================================
// Types
// ============================================

export interface ResolutionIssue {
  id: string;
  title: string;
  description: string;
  category: 'product' | 'service' | 'integration' | 'performance' | 'usability' | 'security' | 'compliance' | 'other';
  severity: 'critical' | 'high' | 'medium' | 'low';
  status: 'open' | 'in_progress' | 'blocked' | 'resolved';
  reportedDate: string;
  enabled: boolean;
}

export interface ResolutionAction {
  id: string;
  action: string;
  description: string;
  owner: 'CSM' | 'Customer' | 'Support' | 'Product' | 'Engineering' | 'Leadership' | 'Implementation';
  dueDate: string;
  status: 'pending' | 'in_progress' | 'completed' | 'blocked';
  priority: 'high' | 'medium' | 'low';
  relatedIssueIds: string[];
}

export interface ResolutionDependency {
  id: string;
  description: string;
  type: 'internal' | 'external' | 'customer' | 'vendor';
  status: 'pending' | 'in_progress' | 'resolved';
  blockedBy: string;
  enabled: boolean;
}

export interface ResolutionPlanData {
  title: string;
  createdDate: string;
  targetResolutionDate: string;
  overallStatus: 'on_track' | 'at_risk' | 'blocked' | 'resolved';
  summary: string;
  healthScore: number;
  daysUntilRenewal: number;
  arr: number;
  issues: ResolutionIssue[];
  actionItems: ResolutionAction[];
  dependencies: ResolutionDependency[];
  timeline: string;
  notes: string;
}

export interface CustomerData {
  id: string | null;
  name: string;
  healthScore?: number;
  arr?: number;
  renewalDate?: string;
}

interface CADGResolutionPlanPreviewProps {
  resolutionPlan: ResolutionPlanData;
  customer: CustomerData;
  onSave: (plan: ResolutionPlanData) => Promise<void>;
  onCancel: () => void;
}

// ============================================
// Options
// ============================================
const OVERALL_STATUS_OPTIONS = ['on_track', 'at_risk', 'blocked', 'resolved'] as const;
const ISSUE_CATEGORY_OPTIONS = ['product', 'service', 'integration', 'performance', 'usability', 'security', 'compliance', 'other'] as const;
const SEVERITY_OPTIONS = ['critical', 'high', 'medium', 'low'] as const;
const ISSUE_STATUS_OPTIONS = ['open', 'in_progress', 'blocked', 'resolved'] as const;
const ACTION_STATUS_OPTIONS = ['pending', 'in_progress', 'completed', 'blocked'] as const;
const PRIORITY_OPTIONS = ['high', 'medium', 'low'] as const;
const OWNER_OPTIONS = ['CSM', 'Customer', 'Support', 'Product', 'Engineering', 'Leadership', 'Implementation'] as const;
const DEPENDENCY_TYPE_OPTIONS = ['internal', 'external', 'customer', 'vendor'] as const;
const DEPENDENCY_STATUS_OPTIONS = ['pending', 'in_progress', 'resolved'] as const;

const OVERALL_STATUS_LABELS: Record<string, string> = {
  on_track: 'On Track',
  at_risk: 'At Risk',
  blocked: 'Blocked',
  resolved: 'Resolved',
};

const OVERALL_STATUS_COLORS: Record<string, string> = {
  on_track: 'text-emerald-400',
  at_risk: 'text-amber-400',
  blocked: 'text-red-400',
  resolved: 'text-blue-400',
};

const CATEGORY_LABELS: Record<string, string> = {
  product: 'Product',
  service: 'Service',
  integration: 'Integration',
  performance: 'Performance',
  usability: 'Usability',
  security: 'Security',
  compliance: 'Compliance',
  other: 'Other',
};

const CATEGORY_COLORS: Record<string, string> = {
  product: 'bg-purple-500/20 text-purple-400 border-purple-500/30',
  service: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
  integration: 'bg-cyan-500/20 text-cyan-400 border-cyan-500/30',
  performance: 'bg-amber-500/20 text-amber-400 border-amber-500/30',
  usability: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30',
  security: 'bg-red-500/20 text-red-400 border-red-500/30',
  compliance: 'bg-indigo-500/20 text-indigo-400 border-indigo-500/30',
  other: 'bg-gray-500/20 text-gray-400 border-gray-500/30',
};

const SEVERITY_LABELS: Record<string, string> = {
  critical: 'Critical',
  high: 'High',
  medium: 'Medium',
  low: 'Low',
};

const SEVERITY_COLORS: Record<string, string> = {
  critical: 'bg-red-500/20 text-red-400 border-red-500/30',
  high: 'bg-orange-500/20 text-orange-400 border-orange-500/30',
  medium: 'bg-amber-500/20 text-amber-400 border-amber-500/30',
  low: 'bg-green-500/20 text-green-400 border-green-500/30',
};

const ISSUE_STATUS_LABELS: Record<string, string> = {
  open: 'Open',
  in_progress: 'In Progress',
  blocked: 'Blocked',
  resolved: 'Resolved',
};

const ISSUE_STATUS_COLORS: Record<string, string> = {
  open: 'bg-gray-500/20 text-gray-400 border-gray-500/30',
  in_progress: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
  blocked: 'bg-red-500/20 text-red-400 border-red-500/30',
  resolved: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30',
};

const ACTION_STATUS_LABELS: Record<string, string> = {
  pending: 'Pending',
  in_progress: 'In Progress',
  completed: 'Completed',
  blocked: 'Blocked',
};

const ACTION_STATUS_COLORS: Record<string, string> = {
  pending: 'bg-gray-500/20 text-gray-400 border-gray-500/30',
  in_progress: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
  completed: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30',
  blocked: 'bg-red-500/20 text-red-400 border-red-500/30',
};

const PRIORITY_LABELS: Record<string, string> = {
  high: 'High',
  medium: 'Medium',
  low: 'Low',
};

const PRIORITY_COLORS: Record<string, string> = {
  high: 'bg-red-500/20 text-red-400 border-red-500/30',
  medium: 'bg-amber-500/20 text-amber-400 border-amber-500/30',
  low: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30',
};

const DEPENDENCY_TYPE_LABELS: Record<string, string> = {
  internal: 'Internal',
  external: 'External',
  customer: 'Customer',
  vendor: 'Vendor',
};

const DEPENDENCY_TYPE_COLORS: Record<string, string> = {
  internal: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
  external: 'bg-purple-500/20 text-purple-400 border-purple-500/30',
  customer: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30',
  vendor: 'bg-orange-500/20 text-orange-400 border-orange-500/30',
};

// ============================================
// Component
// ============================================

export function CADGResolutionPlanPreview({
  resolutionPlan,
  customer,
  onSave,
  onCancel,
}: CADGResolutionPlanPreviewProps) {
  const { getAuthHeaders } = useAuth();
  const [plan, setPlan] = useState<ResolutionPlanData>(resolutionPlan);
  const [isSaving, setIsSaving] = useState(false);
  const [activeTab, setActiveTab] = useState<'overview' | 'issues' | 'actions' | 'dependencies'>('overview');
  const [expandedIssues, setExpandedIssues] = useState<Set<string>>(new Set());
  const [expandedActions, setExpandedActions] = useState<Set<string>>(new Set());
  const [expandedDeps, setExpandedDeps] = useState<Set<string>>(new Set());
  const [hasChanges, setHasChanges] = useState(false);

  // Calculate metrics
  const metrics = useMemo(() => {
    const enabledIssues = plan.issues.filter(i => i.enabled);
    const openIssues = enabledIssues.filter(i => i.status !== 'resolved').length;
    const criticalIssues = enabledIssues.filter(i => i.severity === 'critical').length;
    const pendingActions = plan.actionItems.filter(a => a.status === 'pending').length;
    const blockedItems = plan.actionItems.filter(a => a.status === 'blocked').length +
                         enabledIssues.filter(i => i.status === 'blocked').length;
    return { openIssues, criticalIssues, pendingActions, blockedItems, totalIssues: enabledIssues.length };
  }, [plan.issues, plan.actionItems]);

  // Update field helper
  const updateField = <K extends keyof ResolutionPlanData>(field: K, value: ResolutionPlanData[K]) => {
    setPlan(prev => ({ ...prev, [field]: value }));
    setHasChanges(true);
  };

  // Issue management
  const updateIssue = (issueId: string, updates: Partial<ResolutionIssue>) => {
    setPlan(prev => ({
      ...prev,
      issues: prev.issues.map(i => i.id === issueId ? { ...i, ...updates } : i),
    }));
    setHasChanges(true);
  };

  const toggleIssueExpanded = (issueId: string) => {
    setExpandedIssues(prev => {
      const next = new Set(prev);
      if (next.has(issueId)) next.delete(issueId);
      else next.add(issueId);
      return next;
    });
  };

  const addIssue = () => {
    const newIssue: ResolutionIssue = {
      id: `issue-${Date.now()}`,
      title: 'New Issue',
      description: '',
      category: 'other',
      severity: 'medium',
      status: 'open',
      reportedDate: new Date().toISOString().slice(0, 10),
      enabled: true,
    };
    setPlan(prev => ({ ...prev, issues: [...prev.issues, newIssue] }));
    setExpandedIssues(prev => new Set([...prev, newIssue.id]));
    setHasChanges(true);
  };

  const removeIssue = (issueId: string) => {
    setPlan(prev => ({
      ...prev,
      issues: prev.issues.filter(i => i.id !== issueId),
      // Also remove this issue from any action's relatedIssueIds
      actionItems: prev.actionItems.map(a => ({
        ...a,
        relatedIssueIds: a.relatedIssueIds.filter(id => id !== issueId),
      })),
    }));
    setHasChanges(true);
  };

  // Action management
  const updateAction = (actionId: string, updates: Partial<ResolutionAction>) => {
    setPlan(prev => ({
      ...prev,
      actionItems: prev.actionItems.map(a => a.id === actionId ? { ...a, ...updates } : a),
    }));
    setHasChanges(true);
  };

  const toggleActionExpanded = (actionId: string) => {
    setExpandedActions(prev => {
      const next = new Set(prev);
      if (next.has(actionId)) next.delete(actionId);
      else next.add(actionId);
      return next;
    });
  };

  const addAction = () => {
    const newAction: ResolutionAction = {
      id: `action-${Date.now()}`,
      action: 'New Action',
      description: '',
      owner: 'CSM',
      dueDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10),
      status: 'pending',
      priority: 'medium',
      relatedIssueIds: [],
    };
    setPlan(prev => ({ ...prev, actionItems: [...prev.actionItems, newAction] }));
    setExpandedActions(prev => new Set([...prev, newAction.id]));
    setHasChanges(true);
  };

  const removeAction = (actionId: string) => {
    setPlan(prev => ({
      ...prev,
      actionItems: prev.actionItems.filter(a => a.id !== actionId),
    }));
    setHasChanges(true);
  };

  const moveAction = (actionId: string, direction: 'up' | 'down') => {
    setPlan(prev => {
      const idx = prev.actionItems.findIndex(a => a.id === actionId);
      if (idx === -1) return prev;
      const newIdx = direction === 'up' ? idx - 1 : idx + 1;
      if (newIdx < 0 || newIdx >= prev.actionItems.length) return prev;
      const newItems = [...prev.actionItems];
      [newItems[idx], newItems[newIdx]] = [newItems[newIdx], newItems[idx]];
      return { ...prev, actionItems: newItems };
    });
    setHasChanges(true);
  };

  const toggleRelatedIssue = (actionId: string, issueId: string) => {
    setPlan(prev => ({
      ...prev,
      actionItems: prev.actionItems.map(a => {
        if (a.id !== actionId) return a;
        const has = a.relatedIssueIds.includes(issueId);
        return {
          ...a,
          relatedIssueIds: has
            ? a.relatedIssueIds.filter(id => id !== issueId)
            : [...a.relatedIssueIds, issueId],
        };
      }),
    }));
    setHasChanges(true);
  };

  // Dependency management
  const updateDependency = (depId: string, updates: Partial<ResolutionDependency>) => {
    setPlan(prev => ({
      ...prev,
      dependencies: prev.dependencies.map(d => d.id === depId ? { ...d, ...updates } : d),
    }));
    setHasChanges(true);
  };

  const toggleDepExpanded = (depId: string) => {
    setExpandedDeps(prev => {
      const next = new Set(prev);
      if (next.has(depId)) next.delete(depId);
      else next.add(depId);
      return next;
    });
  };

  const addDependency = () => {
    const newDep: ResolutionDependency = {
      id: `dep-${Date.now()}`,
      description: 'New Dependency',
      type: 'internal',
      status: 'pending',
      blockedBy: '',
      enabled: true,
    };
    setPlan(prev => ({ ...prev, dependencies: [...prev.dependencies, newDep] }));
    setExpandedDeps(prev => new Set([...prev, newDep.id]));
    setHasChanges(true);
  };

  const removeDependency = (depId: string) => {
    setPlan(prev => ({
      ...prev,
      dependencies: prev.dependencies.filter(d => d.id !== depId),
    }));
    setHasChanges(true);
  };

  // Save handler
  const handleSave = async () => {
    setIsSaving(true);
    try {
      await onSave(plan);
    } finally {
      setIsSaving(false);
    }
  };

  // Cancel with confirmation
  const handleCancel = () => {
    if (hasChanges) {
      if (!window.confirm('You have unsaved changes. Are you sure you want to cancel?')) {
        return;
      }
    }
    onCancel();
  };

  return (
    <div className="bg-cscx-gray-800 rounded-lg overflow-hidden flex flex-col h-full max-h-[80vh]">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-gradient-to-r from-cyan-500/10 to-blue-500/10 border-b border-cyan-500/20 px-4 py-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-cyan-500/20 flex items-center justify-center">
              <svg className="w-5 h-5 text-cyan-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
              </svg>
            </div>
            <div>
              <h3 className="text-lg font-semibold text-white">{plan.title}</h3>
              <p className="text-xs text-gray-400">
                {customer.name} • Target: {plan.targetResolutionDate}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span className={`text-sm font-medium ${OVERALL_STATUS_COLORS[plan.overallStatus]}`}>
              {OVERALL_STATUS_LABELS[plan.overallStatus]}
            </span>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-gray-700">
        {(['overview', 'issues', 'actions', 'dependencies'] as const).map(tab => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`flex-1 py-2 text-sm font-medium transition-colors ${
              activeTab === tab
                ? 'text-cyan-400 border-b-2 border-cyan-400'
                : 'text-gray-400 hover:text-gray-200'
            }`}
          >
            {tab === 'overview' && 'Overview'}
            {tab === 'issues' && `Issues (${metrics.totalIssues})`}
            {tab === 'actions' && `Actions (${plan.actionItems.length})`}
            {tab === 'dependencies' && `Dependencies (${plan.dependencies.filter(d => d.enabled).length})`}
          </button>
        ))}
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {/* Overview Tab */}
        {activeTab === 'overview' && (
          <div className="space-y-4">
            {/* Key Metrics */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <div className="bg-gray-700/50 rounded-lg p-3">
                <div className="text-xs text-gray-400">Open Issues</div>
                <div className="text-xl font-bold text-white">{metrics.openIssues}</div>
                {metrics.criticalIssues > 0 && (
                  <div className="text-xs text-red-400">{metrics.criticalIssues} critical</div>
                )}
              </div>
              <div className="bg-gray-700/50 rounded-lg p-3">
                <div className="text-xs text-gray-400">Pending Actions</div>
                <div className="text-xl font-bold text-white">{metrics.pendingActions}</div>
              </div>
              <div className="bg-gray-700/50 rounded-lg p-3">
                <div className="text-xs text-gray-400">Health Score</div>
                <div className="text-xl font-bold text-white">{plan.healthScore}</div>
              </div>
              <div className="bg-gray-700/50 rounded-lg p-3">
                <div className="text-xs text-gray-400">Days to Renewal</div>
                <div className="text-xl font-bold text-white">{plan.daysUntilRenewal}</div>
              </div>
            </div>

            {/* Overall Status */}
            <div className="bg-gray-700/30 rounded-lg p-4">
              <label className="block text-sm font-medium text-gray-300 mb-2">Overall Status</label>
              <select
                value={plan.overallStatus}
                onChange={e => updateField('overallStatus', e.target.value as ResolutionPlanData['overallStatus'])}
                className="w-full bg-gray-700 text-white rounded px-3 py-2 text-sm border border-gray-600 focus:border-cyan-500 focus:outline-none"
              >
                {OVERALL_STATUS_OPTIONS.map(opt => (
                  <option key={opt} value={opt}>{OVERALL_STATUS_LABELS[opt]}</option>
                ))}
              </select>
            </div>

            {/* Target Resolution Date */}
            <div className="bg-gray-700/30 rounded-lg p-4">
              <label className="block text-sm font-medium text-gray-300 mb-2">Target Resolution Date</label>
              <input
                type="date"
                value={plan.targetResolutionDate}
                onChange={e => updateField('targetResolutionDate', e.target.value)}
                className="w-full bg-gray-700 text-white rounded px-3 py-2 text-sm border border-gray-600 focus:border-cyan-500 focus:outline-none"
              />
            </div>

            {/* Summary */}
            <div className="bg-gray-700/30 rounded-lg p-4">
              <label className="block text-sm font-medium text-gray-300 mb-2">Summary</label>
              <textarea
                value={plan.summary}
                onChange={e => updateField('summary', e.target.value)}
                rows={3}
                className="w-full bg-gray-700 text-white rounded px-3 py-2 text-sm border border-gray-600 focus:border-cyan-500 focus:outline-none resize-none"
              />
            </div>

            {/* Timeline */}
            <div className="bg-gray-700/30 rounded-lg p-4">
              <label className="block text-sm font-medium text-gray-300 mb-2">Timeline</label>
              <textarea
                value={plan.timeline}
                onChange={e => updateField('timeline', e.target.value)}
                rows={2}
                className="w-full bg-gray-700 text-white rounded px-3 py-2 text-sm border border-gray-600 focus:border-cyan-500 focus:outline-none resize-none"
              />
            </div>

            {/* Notes */}
            <div className="bg-gray-700/30 rounded-lg p-4">
              <label className="block text-sm font-medium text-gray-300 mb-2">Internal Notes</label>
              <textarea
                value={plan.notes}
                onChange={e => updateField('notes', e.target.value)}
                rows={2}
                placeholder="Add any internal notes..."
                className="w-full bg-gray-700 text-white rounded px-3 py-2 text-sm border border-gray-600 focus:border-cyan-500 focus:outline-none resize-none"
              />
            </div>
          </div>
        )}

        {/* Issues Tab */}
        {activeTab === 'issues' && (
          <div className="space-y-3">
            {plan.issues.map((issue, idx) => (
              <div
                key={issue.id}
                className={`rounded-lg border transition-colors ${
                  issue.enabled
                    ? 'bg-gray-700/30 border-gray-600'
                    : 'bg-gray-800/50 border-gray-700 opacity-60'
                }`}
              >
                {/* Issue Header */}
                <div className="flex items-center gap-3 p-3">
                  <input
                    type="checkbox"
                    checked={issue.enabled}
                    onChange={e => updateIssue(issue.id, { enabled: e.target.checked })}
                    className="rounded border-gray-500 text-cyan-500 focus:ring-cyan-500"
                  />
                  <div
                    className="flex-1 flex items-center gap-2 cursor-pointer"
                    onClick={() => toggleIssueExpanded(issue.id)}
                  >
                    <span className={`text-sm px-2 py-0.5 rounded border ${SEVERITY_COLORS[issue.severity]}`}>
                      {SEVERITY_LABELS[issue.severity]}
                    </span>
                    <span className={`text-xs px-2 py-0.5 rounded border ${CATEGORY_COLORS[issue.category]}`}>
                      {CATEGORY_LABELS[issue.category]}
                    </span>
                    <span className="text-white font-medium flex-1">{issue.title}</span>
                    <span className={`text-xs px-2 py-0.5 rounded border ${ISSUE_STATUS_COLORS[issue.status]}`}>
                      {ISSUE_STATUS_LABELS[issue.status]}
                    </span>
                    <svg
                      className={`w-4 h-4 text-gray-400 transition-transform ${expandedIssues.has(issue.id) ? 'rotate-180' : ''}`}
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                  </div>
                  <button
                    onClick={() => removeIssue(issue.id)}
                    className="p-1 text-gray-400 hover:text-red-400"
                    title="Remove issue"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>

                {/* Issue Details (Expanded) */}
                {expandedIssues.has(issue.id) && (
                  <div className="border-t border-gray-600 p-3 space-y-3">
                    <div>
                      <label className="block text-xs text-gray-400 mb-1">Title</label>
                      <input
                        type="text"
                        value={issue.title}
                        onChange={e => updateIssue(issue.id, { title: e.target.value })}
                        className="w-full bg-gray-700 text-white rounded px-2 py-1 text-sm border border-gray-600 focus:border-cyan-500 focus:outline-none"
                      />
                    </div>
                    <div>
                      <label className="block text-xs text-gray-400 mb-1">Description</label>
                      <textarea
                        value={issue.description}
                        onChange={e => updateIssue(issue.id, { description: e.target.value })}
                        rows={2}
                        className="w-full bg-gray-700 text-white rounded px-2 py-1 text-sm border border-gray-600 focus:border-cyan-500 focus:outline-none resize-none"
                      />
                    </div>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                      <div>
                        <label className="block text-xs text-gray-400 mb-1">Category</label>
                        <select
                          value={issue.category}
                          onChange={e => updateIssue(issue.id, { category: e.target.value as ResolutionIssue['category'] })}
                          className="w-full bg-gray-700 text-white rounded px-2 py-1 text-sm border border-gray-600 focus:border-cyan-500 focus:outline-none"
                        >
                          {ISSUE_CATEGORY_OPTIONS.map(opt => (
                            <option key={opt} value={opt}>{CATEGORY_LABELS[opt]}</option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <label className="block text-xs text-gray-400 mb-1">Severity</label>
                        <select
                          value={issue.severity}
                          onChange={e => updateIssue(issue.id, { severity: e.target.value as ResolutionIssue['severity'] })}
                          className="w-full bg-gray-700 text-white rounded px-2 py-1 text-sm border border-gray-600 focus:border-cyan-500 focus:outline-none"
                        >
                          {SEVERITY_OPTIONS.map(opt => (
                            <option key={opt} value={opt}>{SEVERITY_LABELS[opt]}</option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <label className="block text-xs text-gray-400 mb-1">Status</label>
                        <select
                          value={issue.status}
                          onChange={e => updateIssue(issue.id, { status: e.target.value as ResolutionIssue['status'] })}
                          className="w-full bg-gray-700 text-white rounded px-2 py-1 text-sm border border-gray-600 focus:border-cyan-500 focus:outline-none"
                        >
                          {ISSUE_STATUS_OPTIONS.map(opt => (
                            <option key={opt} value={opt}>{ISSUE_STATUS_LABELS[opt]}</option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <label className="block text-xs text-gray-400 mb-1">Reported Date</label>
                        <input
                          type="date"
                          value={issue.reportedDate}
                          onChange={e => updateIssue(issue.id, { reportedDate: e.target.value })}
                          className="w-full bg-gray-700 text-white rounded px-2 py-1 text-sm border border-gray-600 focus:border-cyan-500 focus:outline-none"
                        />
                      </div>
                    </div>
                  </div>
                )}
              </div>
            ))}

            {/* Add Issue Button */}
            <button
              onClick={addIssue}
              className="w-full py-2 border-2 border-dashed border-gray-600 rounded-lg text-gray-400 hover:text-cyan-400 hover:border-cyan-500/50 transition-colors flex items-center justify-center gap-2"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              Add Issue
            </button>
          </div>
        )}

        {/* Actions Tab */}
        {activeTab === 'actions' && (
          <div className="space-y-3">
            {plan.actionItems.map((action, idx) => (
              <div
                key={action.id}
                className="rounded-lg border bg-gray-700/30 border-gray-600"
              >
                {/* Action Header */}
                <div className="flex items-center gap-3 p-3">
                  <div className="flex flex-col gap-1">
                    <button
                      onClick={() => moveAction(action.id, 'up')}
                      disabled={idx === 0}
                      className="p-0.5 text-gray-400 hover:text-white disabled:opacity-30"
                    >
                      <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
                      </svg>
                    </button>
                    <button
                      onClick={() => moveAction(action.id, 'down')}
                      disabled={idx === plan.actionItems.length - 1}
                      className="p-0.5 text-gray-400 hover:text-white disabled:opacity-30"
                    >
                      <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                      </svg>
                    </button>
                  </div>
                  <span className="w-6 h-6 rounded-full bg-cyan-500/20 text-cyan-400 text-xs flex items-center justify-center font-medium">
                    {idx + 1}
                  </span>
                  <div
                    className="flex-1 flex items-center gap-2 cursor-pointer"
                    onClick={() => toggleActionExpanded(action.id)}
                  >
                    <span className={`text-xs px-2 py-0.5 rounded border ${PRIORITY_COLORS[action.priority]}`}>
                      {PRIORITY_LABELS[action.priority]}
                    </span>
                    <span className="text-white font-medium flex-1">{action.action}</span>
                    <span className="text-xs text-gray-400">{action.owner}</span>
                    <span className={`text-xs px-2 py-0.5 rounded border ${ACTION_STATUS_COLORS[action.status]}`}>
                      {ACTION_STATUS_LABELS[action.status]}
                    </span>
                    <svg
                      className={`w-4 h-4 text-gray-400 transition-transform ${expandedActions.has(action.id) ? 'rotate-180' : ''}`}
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                  </div>
                  <button
                    onClick={() => removeAction(action.id)}
                    className="p-1 text-gray-400 hover:text-red-400"
                    title="Remove action"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>

                {/* Action Details (Expanded) */}
                {expandedActions.has(action.id) && (
                  <div className="border-t border-gray-600 p-3 space-y-3">
                    <div>
                      <label className="block text-xs text-gray-400 mb-1">Action</label>
                      <input
                        type="text"
                        value={action.action}
                        onChange={e => updateAction(action.id, { action: e.target.value })}
                        className="w-full bg-gray-700 text-white rounded px-2 py-1 text-sm border border-gray-600 focus:border-cyan-500 focus:outline-none"
                      />
                    </div>
                    <div>
                      <label className="block text-xs text-gray-400 mb-1">Description</label>
                      <textarea
                        value={action.description}
                        onChange={e => updateAction(action.id, { description: e.target.value })}
                        rows={2}
                        className="w-full bg-gray-700 text-white rounded px-2 py-1 text-sm border border-gray-600 focus:border-cyan-500 focus:outline-none resize-none"
                      />
                    </div>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                      <div>
                        <label className="block text-xs text-gray-400 mb-1">Owner</label>
                        <select
                          value={action.owner}
                          onChange={e => updateAction(action.id, { owner: e.target.value as ResolutionAction['owner'] })}
                          className="w-full bg-gray-700 text-white rounded px-2 py-1 text-sm border border-gray-600 focus:border-cyan-500 focus:outline-none"
                        >
                          {OWNER_OPTIONS.map(opt => (
                            <option key={opt} value={opt}>{opt}</option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <label className="block text-xs text-gray-400 mb-1">Priority</label>
                        <select
                          value={action.priority}
                          onChange={e => updateAction(action.id, { priority: e.target.value as ResolutionAction['priority'] })}
                          className="w-full bg-gray-700 text-white rounded px-2 py-1 text-sm border border-gray-600 focus:border-cyan-500 focus:outline-none"
                        >
                          {PRIORITY_OPTIONS.map(opt => (
                            <option key={opt} value={opt}>{PRIORITY_LABELS[opt]}</option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <label className="block text-xs text-gray-400 mb-1">Due Date</label>
                        <input
                          type="date"
                          value={action.dueDate}
                          onChange={e => updateAction(action.id, { dueDate: e.target.value })}
                          className="w-full bg-gray-700 text-white rounded px-2 py-1 text-sm border border-gray-600 focus:border-cyan-500 focus:outline-none"
                        />
                      </div>
                      <div>
                        <label className="block text-xs text-gray-400 mb-1">Status</label>
                        <select
                          value={action.status}
                          onChange={e => updateAction(action.id, { status: e.target.value as ResolutionAction['status'] })}
                          className="w-full bg-gray-700 text-white rounded px-2 py-1 text-sm border border-gray-600 focus:border-cyan-500 focus:outline-none"
                        >
                          {ACTION_STATUS_OPTIONS.map(opt => (
                            <option key={opt} value={opt}>{ACTION_STATUS_LABELS[opt]}</option>
                          ))}
                        </select>
                      </div>
                    </div>
                    {/* Related Issues */}
                    <div>
                      <label className="block text-xs text-gray-400 mb-2">Related Issues</label>
                      <div className="flex flex-wrap gap-2">
                        {plan.issues.filter(i => i.enabled).map(issue => (
                          <button
                            key={issue.id}
                            onClick={() => toggleRelatedIssue(action.id, issue.id)}
                            className={`text-xs px-2 py-1 rounded border transition-colors ${
                              action.relatedIssueIds.includes(issue.id)
                                ? 'bg-cyan-500/20 text-cyan-400 border-cyan-500/50'
                                : 'bg-gray-700 text-gray-400 border-gray-600 hover:border-gray-500'
                            }`}
                          >
                            {issue.title}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            ))}

            {/* Add Action Button */}
            <button
              onClick={addAction}
              className="w-full py-2 border-2 border-dashed border-gray-600 rounded-lg text-gray-400 hover:text-cyan-400 hover:border-cyan-500/50 transition-colors flex items-center justify-center gap-2"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              Add Action
            </button>
          </div>
        )}

        {/* Dependencies Tab */}
        {activeTab === 'dependencies' && (
          <div className="space-y-3">
            {plan.dependencies.map((dep, idx) => (
              <div
                key={dep.id}
                className={`rounded-lg border transition-colors ${
                  dep.enabled
                    ? 'bg-gray-700/30 border-gray-600'
                    : 'bg-gray-800/50 border-gray-700 opacity-60'
                }`}
              >
                {/* Dependency Header */}
                <div className="flex items-center gap-3 p-3">
                  <input
                    type="checkbox"
                    checked={dep.enabled}
                    onChange={e => updateDependency(dep.id, { enabled: e.target.checked })}
                    className="rounded border-gray-500 text-cyan-500 focus:ring-cyan-500"
                  />
                  <div
                    className="flex-1 flex items-center gap-2 cursor-pointer"
                    onClick={() => toggleDepExpanded(dep.id)}
                  >
                    <span className={`text-xs px-2 py-0.5 rounded border ${DEPENDENCY_TYPE_COLORS[dep.type]}`}>
                      {DEPENDENCY_TYPE_LABELS[dep.type]}
                    </span>
                    <span className="text-white flex-1">{dep.description}</span>
                    <span className={`text-xs px-2 py-0.5 rounded border ${
                      dep.status === 'resolved'
                        ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30'
                        : dep.status === 'in_progress'
                          ? 'bg-blue-500/20 text-blue-400 border-blue-500/30'
                          : 'bg-gray-500/20 text-gray-400 border-gray-500/30'
                    }`}>
                      {dep.status === 'in_progress' ? 'In Progress' : dep.status.charAt(0).toUpperCase() + dep.status.slice(1)}
                    </span>
                    <svg
                      className={`w-4 h-4 text-gray-400 transition-transform ${expandedDeps.has(dep.id) ? 'rotate-180' : ''}`}
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                  </div>
                  <button
                    onClick={() => removeDependency(dep.id)}
                    className="p-1 text-gray-400 hover:text-red-400"
                    title="Remove dependency"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>

                {/* Dependency Details (Expanded) */}
                {expandedDeps.has(dep.id) && (
                  <div className="border-t border-gray-600 p-3 space-y-3">
                    <div>
                      <label className="block text-xs text-gray-400 mb-1">Description</label>
                      <input
                        type="text"
                        value={dep.description}
                        onChange={e => updateDependency(dep.id, { description: e.target.value })}
                        className="w-full bg-gray-700 text-white rounded px-2 py-1 text-sm border border-gray-600 focus:border-cyan-500 focus:outline-none"
                      />
                    </div>
                    <div className="grid grid-cols-3 gap-2">
                      <div>
                        <label className="block text-xs text-gray-400 mb-1">Type</label>
                        <select
                          value={dep.type}
                          onChange={e => updateDependency(dep.id, { type: e.target.value as ResolutionDependency['type'] })}
                          className="w-full bg-gray-700 text-white rounded px-2 py-1 text-sm border border-gray-600 focus:border-cyan-500 focus:outline-none"
                        >
                          {DEPENDENCY_TYPE_OPTIONS.map(opt => (
                            <option key={opt} value={opt}>{DEPENDENCY_TYPE_LABELS[opt]}</option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <label className="block text-xs text-gray-400 mb-1">Status</label>
                        <select
                          value={dep.status}
                          onChange={e => updateDependency(dep.id, { status: e.target.value as ResolutionDependency['status'] })}
                          className="w-full bg-gray-700 text-white rounded px-2 py-1 text-sm border border-gray-600 focus:border-cyan-500 focus:outline-none"
                        >
                          {DEPENDENCY_STATUS_OPTIONS.map(opt => (
                            <option key={opt} value={opt}>
                              {opt === 'in_progress' ? 'In Progress' : opt.charAt(0).toUpperCase() + opt.slice(1)}
                            </option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <label className="block text-xs text-gray-400 mb-1">Blocked By</label>
                        <input
                          type="text"
                          value={dep.blockedBy}
                          onChange={e => updateDependency(dep.id, { blockedBy: e.target.value })}
                          className="w-full bg-gray-700 text-white rounded px-2 py-1 text-sm border border-gray-600 focus:border-cyan-500 focus:outline-none"
                        />
                      </div>
                    </div>
                  </div>
                )}
              </div>
            ))}

            {/* Add Dependency Button */}
            <button
              onClick={addDependency}
              className="w-full py-2 border-2 border-dashed border-gray-600 rounded-lg text-gray-400 hover:text-cyan-400 hover:border-cyan-500/50 transition-colors flex items-center justify-center gap-2"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              Add Dependency
            </button>
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="sticky bottom-0 bg-gray-800 border-t border-gray-700 p-4 flex items-center justify-between">
        <button
          onClick={handleCancel}
          disabled={isSaving}
          className="px-4 py-2 text-sm text-gray-400 hover:text-white transition-colors disabled:opacity-50"
        >
          Cancel
        </button>
        <div className="flex items-center gap-3">
          {hasChanges && (
            <span className="text-xs text-amber-400">Unsaved changes</span>
          )}
          <button
            onClick={handleSave}
            disabled={isSaving}
            className="px-6 py-2 bg-cyan-500 text-white text-sm font-medium rounded-lg hover:bg-cyan-600 transition-colors disabled:opacity-50 flex items-center gap-2"
          >
            {isSaving ? (
              <>
                <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
                Saving...
              </>
            ) : (
              <>
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                Create Resolution Plan
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

export default CADGResolutionPlanPreview;
