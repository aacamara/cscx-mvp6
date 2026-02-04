/**
 * CADGSavePlayPreview - Editable save play preview for CADG-generated plans
 * Allows users to review, edit, and approve save plays before creating document
 */

import React, { useState, useMemo } from 'react';
import { useAuth } from '../../context/AuthContext';

// ============================================
// Types
// ============================================

export interface RootCause {
  id: string;
  cause: string;
  description: string;
  category: 'product' | 'service' | 'relationship' | 'value' | 'competitive' | 'budget' | 'timing' | 'other';
  severity: 'critical' | 'high' | 'medium' | 'low';
  evidence: string;
  enabled: boolean;
}

export interface SavePlayAction {
  id: string;
  action: string;
  description: string;
  owner: 'CSM' | 'Customer' | 'Support' | 'Product' | 'Leadership' | 'Implementation' | 'Sales';
  dueDate: string;
  status: 'pending' | 'in_progress' | 'completed' | 'blocked';
  priority: 'high' | 'medium' | 'low';
  relatedCauseIds: string[];
}

export interface SuccessMetric {
  id: string;
  metric: string;
  currentValue: string;
  targetValue: string;
  dueDate: string;
  enabled: boolean;
}

export interface SavePlayData {
  title: string;
  createdDate: string;
  riskLevel: 'critical' | 'high' | 'medium' | 'low';
  situation: string;
  healthScore: number;
  daysUntilRenewal: number;
  arr: number;
  rootCauses: RootCause[];
  actionItems: SavePlayAction[];
  successMetrics: SuccessMetric[];
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

interface CADGSavePlayPreviewProps {
  savePlay: SavePlayData;
  customer: CustomerData;
  onSave: (savePlay: SavePlayData) => Promise<void>;
  onCancel: () => void;
}

// ============================================
// Options
// ============================================
const SEVERITY_OPTIONS = ['critical', 'high', 'medium', 'low'] as const;
const CATEGORY_OPTIONS = ['product', 'service', 'relationship', 'value', 'competitive', 'budget', 'timing', 'other'] as const;
const OWNER_OPTIONS = ['CSM', 'Customer', 'Support', 'Product', 'Leadership', 'Implementation', 'Sales'] as const;
const STATUS_OPTIONS = ['pending', 'in_progress', 'completed', 'blocked'] as const;
const PRIORITY_OPTIONS = ['high', 'medium', 'low'] as const;

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

const CATEGORY_LABELS: Record<string, string> = {
  product: 'Product',
  service: 'Service',
  relationship: 'Relationship',
  value: 'Value',
  competitive: 'Competitive',
  budget: 'Budget',
  timing: 'Timing',
  other: 'Other',
};

const CATEGORY_COLORS: Record<string, string> = {
  product: 'bg-blue-500/20 text-blue-400',
  service: 'bg-purple-500/20 text-purple-400',
  relationship: 'bg-pink-500/20 text-pink-400',
  value: 'bg-emerald-500/20 text-emerald-400',
  competitive: 'bg-rose-500/20 text-rose-400',
  budget: 'bg-amber-500/20 text-amber-400',
  timing: 'bg-cyan-500/20 text-cyan-400',
  other: 'bg-gray-500/20 text-gray-400',
};

const PRIORITY_LABELS: Record<string, string> = {
  high: 'High',
  medium: 'Medium',
  low: 'Low',
};

const PRIORITY_COLORS: Record<string, string> = {
  high: 'bg-red-500/20 text-red-400',
  medium: 'bg-amber-500/20 text-amber-400',
  low: 'bg-green-500/20 text-green-400',
};

const STATUS_LABELS: Record<string, string> = {
  pending: 'Pending',
  in_progress: 'In Progress',
  completed: 'Completed',
  blocked: 'Blocked',
};

const STATUS_COLORS: Record<string, string> = {
  pending: 'bg-gray-500/20 text-gray-400',
  in_progress: 'bg-blue-500/20 text-blue-400',
  completed: 'bg-green-500/20 text-green-400',
  blocked: 'bg-red-500/20 text-red-400',
};

const RISK_LEVEL_COLORS: Record<string, string> = {
  critical: 'text-red-400',
  high: 'text-orange-400',
  medium: 'text-amber-400',
  low: 'text-green-400',
};

// ============================================
// Component
// ============================================

export const CADGSavePlayPreview: React.FC<CADGSavePlayPreviewProps> = ({
  savePlay,
  customer,
  onSave,
  onCancel,
}) => {
  const { getAuthHeaders } = useAuth();

  // Original data (for tracking modifications)
  const [original] = useState<SavePlayData>(() => JSON.parse(JSON.stringify(savePlay)));

  // Editable draft state
  const [draft, setDraft] = useState<SavePlayData>(() => JSON.parse(JSON.stringify(savePlay)));

  // UI state
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'overview' | 'causes' | 'actions' | 'metrics'>('overview');
  const [expandedCause, setExpandedCause] = useState<string | null>(null);
  const [expandedAction, setExpandedAction] = useState<string | null>(null);
  const [expandedMetric, setExpandedMetric] = useState<string | null>(null);

  // Check if draft has been modified
  const isModified = useMemo(() => {
    return JSON.stringify(draft) !== JSON.stringify(original);
  }, [draft, original]);

  // Calculate stats based on current draft
  const calculatedStats = useMemo(() => {
    const enabledCauses = draft.rootCauses.filter(c => c.enabled);
    const criticalCount = enabledCauses.filter(c => c.severity === 'critical').length;
    const highCount = enabledCauses.filter(c => c.severity === 'high').length;
    const pendingActions = draft.actionItems.filter(a => a.status === 'pending' || a.status === 'in_progress').length;
    const enabledMetrics = draft.successMetrics.filter(m => m.enabled);

    // Determine risk level based on causes
    let riskLevel: SavePlayData['riskLevel'] = draft.riskLevel;
    if (criticalCount >= 2) riskLevel = 'critical';
    else if (criticalCount >= 1 || highCount >= 3) riskLevel = 'high';
    else if (highCount >= 1) riskLevel = 'medium';

    return {
      riskLevel,
      enabledCausesCount: enabledCauses.length,
      criticalCount,
      highCount,
      actionsCount: draft.actionItems.length,
      pendingActions,
      metricsCount: enabledMetrics.length,
    };
  }, [draft]);

  // Handle cancel with unsaved changes warning
  const handleCancel = () => {
    if (isModified) {
      const confirmDiscard = window.confirm(
        'You have unsaved changes. Are you sure you want to discard them?'
      );
      if (!confirmDiscard) return;
    }
    onCancel();
  };

  // Handle save
  const handleSave = async () => {
    setIsSaving(true);
    setError(null);

    try {
      // Update risk level before saving
      const finalDraft = {
        ...draft,
        riskLevel: calculatedStats.riskLevel,
      };
      await onSave(finalDraft);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save save play');
    } finally {
      setIsSaving(false);
    }
  };

  // Root cause handlers
  const handleToggleCause = (causeId: string) => {
    setDraft(prev => ({
      ...prev,
      rootCauses: prev.rootCauses.map(c =>
        c.id === causeId ? { ...c, enabled: !c.enabled } : c
      ),
    }));
  };

  const handleUpdateCause = (causeId: string, updates: Partial<RootCause>) => {
    setDraft(prev => ({
      ...prev,
      rootCauses: prev.rootCauses.map(c =>
        c.id === causeId ? { ...c, ...updates } : c
      ),
    }));
  };

  const handleAddCause = () => {
    const newCause: RootCause = {
      id: `cause-${Date.now()}`,
      cause: 'New Root Cause',
      description: '',
      category: 'other',
      severity: 'medium',
      evidence: '',
      enabled: true,
    };
    setDraft(prev => ({
      ...prev,
      rootCauses: [...prev.rootCauses, newCause],
    }));
    setExpandedCause(newCause.id);
  };

  const handleRemoveCause = (causeId: string) => {
    setDraft(prev => ({
      ...prev,
      rootCauses: prev.rootCauses.filter(c => c.id !== causeId),
      // Remove from related actions
      actionItems: prev.actionItems.map(a => ({
        ...a,
        relatedCauseIds: a.relatedCauseIds.filter(id => id !== causeId),
      })),
    }));
  };

  // Action handlers
  const handleUpdateAction = (actionId: string, updates: Partial<SavePlayAction>) => {
    setDraft(prev => ({
      ...prev,
      actionItems: prev.actionItems.map(a =>
        a.id === actionId ? { ...a, ...updates } : a
      ),
    }));
  };

  const handleAddAction = () => {
    const newAction: SavePlayAction = {
      id: `action-${Date.now()}`,
      action: 'New Action',
      description: '',
      owner: 'CSM',
      dueDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10),
      status: 'pending',
      priority: 'high',
      relatedCauseIds: [],
    };
    setDraft(prev => ({
      ...prev,
      actionItems: [...prev.actionItems, newAction],
    }));
    setExpandedAction(newAction.id);
  };

  const handleRemoveAction = (actionId: string) => {
    setDraft(prev => ({
      ...prev,
      actionItems: prev.actionItems.filter(a => a.id !== actionId),
    }));
  };

  const handleMoveAction = (actionId: string, direction: 'up' | 'down') => {
    setDraft(prev => {
      const idx = prev.actionItems.findIndex(a => a.id === actionId);
      if (idx < 0) return prev;
      if (direction === 'up' && idx === 0) return prev;
      if (direction === 'down' && idx === prev.actionItems.length - 1) return prev;

      const newActions = [...prev.actionItems];
      const targetIdx = direction === 'up' ? idx - 1 : idx + 1;
      [newActions[idx], newActions[targetIdx]] = [newActions[targetIdx], newActions[idx]];

      return { ...prev, actionItems: newActions };
    });
  };

  const handleToggleRelatedCause = (actionId: string, causeId: string) => {
    setDraft(prev => ({
      ...prev,
      actionItems: prev.actionItems.map(a => {
        if (a.id !== actionId) return a;
        const hasCause = a.relatedCauseIds.includes(causeId);
        return {
          ...a,
          relatedCauseIds: hasCause
            ? a.relatedCauseIds.filter(id => id !== causeId)
            : [...a.relatedCauseIds, causeId],
        };
      }),
    }));
  };

  // Success metric handlers
  const handleToggleMetric = (metricId: string) => {
    setDraft(prev => ({
      ...prev,
      successMetrics: prev.successMetrics.map(m =>
        m.id === metricId ? { ...m, enabled: !m.enabled } : m
      ),
    }));
  };

  const handleUpdateMetric = (metricId: string, updates: Partial<SuccessMetric>) => {
    setDraft(prev => ({
      ...prev,
      successMetrics: prev.successMetrics.map(m =>
        m.id === metricId ? { ...m, ...updates } : m
      ),
    }));
  };

  const handleAddMetric = () => {
    const newMetric: SuccessMetric = {
      id: `metric-${Date.now()}`,
      metric: 'New Metric',
      currentValue: '',
      targetValue: '',
      dueDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10),
      enabled: true,
    };
    setDraft(prev => ({
      ...prev,
      successMetrics: [...prev.successMetrics, newMetric],
    }));
    setExpandedMetric(newMetric.id);
  };

  const handleRemoveMetric = (metricId: string) => {
    setDraft(prev => ({
      ...prev,
      successMetrics: prev.successMetrics.filter(m => m.id !== metricId),
    }));
  };

  // ============================================
  // Render
  // ============================================

  return (
    <div className="bg-cscx-gray-800 rounded-lg border border-gray-700 overflow-hidden max-h-[80vh] flex flex-col">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-gradient-to-r from-orange-900/30 to-red-900/20 border-b border-gray-700 p-4">
        <div className="flex items-center justify-between">
          <div className="flex-1">
            <input
              type="text"
              value={draft.title}
              onChange={(e) => setDraft(prev => ({ ...prev, title: e.target.value }))}
              className="text-lg font-semibold bg-transparent border-none outline-none text-white w-full focus:ring-1 focus:ring-orange-500/50 rounded px-1"
            />
            <div className="flex items-center gap-4 mt-1 text-sm text-gray-400">
              <span>{customer.name}</span>
              <span>|</span>
              <span>Created: {draft.createdDate}</span>
              <span>|</span>
              <span className={RISK_LEVEL_COLORS[calculatedStats.riskLevel]}>
                {SEVERITY_LABELS[calculatedStats.riskLevel]} Risk
              </span>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handleCancel}
              className="px-3 py-1.5 text-sm text-gray-300 hover:text-white hover:bg-gray-700 rounded transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              disabled={isSaving}
              className="px-4 py-1.5 text-sm bg-orange-600 hover:bg-orange-700 text-white rounded transition-colors disabled:opacity-50"
            >
              {isSaving ? 'Saving...' : 'Create Save Play'}
            </button>
          </div>
        </div>

        {error && (
          <div className="mt-2 p-2 bg-red-900/50 border border-red-700 rounded text-red-300 text-sm">
            {error}
          </div>
        )}

        {/* Save Play Overview Card */}
        <div className="mt-4 p-4 bg-cscx-gray-900/50 rounded-lg border border-gray-700">
          <div className="grid grid-cols-5 gap-4">
            {/* Risk Level */}
            <div>
              <div className="text-xs text-gray-500 uppercase mb-1">Risk Level</div>
              <div className={`text-2xl font-bold ${RISK_LEVEL_COLORS[calculatedStats.riskLevel]}`}>
                {SEVERITY_LABELS[calculatedStats.riskLevel]}
              </div>
            </div>

            {/* Health Score */}
            <div>
              <div className="text-xs text-gray-500 uppercase mb-1">Health Score</div>
              <div className={`text-2xl font-bold ${
                draft.healthScore < 40 ? 'text-red-400' :
                draft.healthScore < 60 ? 'text-orange-400' :
                draft.healthScore < 80 ? 'text-amber-400' :
                'text-green-400'
              }`}>
                {draft.healthScore}
              </div>
            </div>

            {/* ARR */}
            <div>
              <div className="text-xs text-gray-500 uppercase mb-1">ARR</div>
              <div className="text-2xl font-bold text-white">
                ${(draft.arr / 1000).toFixed(0)}K
              </div>
            </div>

            {/* Days Until Renewal */}
            <div>
              <div className="text-xs text-gray-500 uppercase mb-1">Days to Renewal</div>
              <div className={`text-2xl font-bold ${
                draft.daysUntilRenewal < 30 ? 'text-red-400' :
                draft.daysUntilRenewal < 60 ? 'text-orange-400' :
                'text-white'
              }`}>
                {draft.daysUntilRenewal}
              </div>
            </div>

            {/* Timeline */}
            <div>
              <div className="text-xs text-gray-500 uppercase mb-1">Save Timeline</div>
              <input
                type="text"
                value={draft.timeline}
                onChange={(e) => setDraft(prev => ({ ...prev, timeline: e.target.value }))}
                className="text-lg font-semibold bg-transparent border-none outline-none text-orange-400 w-full focus:ring-1 focus:ring-orange-500/50 rounded"
                placeholder="e.g., 30 days"
              />
            </div>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 mt-4">
          {(['overview', 'causes', 'actions', 'metrics'] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-4 py-2 text-sm rounded-t-lg transition-colors ${
                activeTab === tab
                  ? 'bg-cscx-gray-900 text-orange-400 border-t border-x border-orange-500/30'
                  : 'text-gray-400 hover:text-white hover:bg-cscx-gray-900/50'
              }`}
            >
              {tab === 'overview' && 'Overview'}
              {tab === 'causes' && `Root Causes (${calculatedStats.enabledCausesCount})`}
              {tab === 'actions' && `Actions (${calculatedStats.actionsCount})`}
              {tab === 'metrics' && `Metrics (${calculatedStats.metricsCount})`}
            </button>
          ))}
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-4">
        {/* Overview Tab */}
        {activeTab === 'overview' && (
          <div className="space-y-4">
            {/* Situation Summary */}
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Situation Summary
              </label>
              <textarea
                value={draft.situation}
                onChange={(e) => setDraft(prev => ({ ...prev, situation: e.target.value }))}
                rows={4}
                className="w-full px-3 py-2 bg-cscx-gray-900 border border-gray-700 rounded-lg text-white text-sm focus:outline-none focus:ring-1 focus:ring-orange-500/50"
                placeholder="Describe the situation requiring a save play..."
              />
            </div>

            {/* Stats Cards */}
            <div className="grid grid-cols-4 gap-4">
              <div className="p-4 bg-cscx-gray-900/50 rounded-lg border border-gray-700">
                <div className="text-xs text-gray-500 uppercase mb-1">Critical Causes</div>
                <div className="text-2xl font-bold text-red-400">{calculatedStats.criticalCount}</div>
              </div>
              <div className="p-4 bg-cscx-gray-900/50 rounded-lg border border-gray-700">
                <div className="text-xs text-gray-500 uppercase mb-1">High Causes</div>
                <div className="text-2xl font-bold text-orange-400">{calculatedStats.highCount}</div>
              </div>
              <div className="p-4 bg-cscx-gray-900/50 rounded-lg border border-gray-700">
                <div className="text-xs text-gray-500 uppercase mb-1">Pending Actions</div>
                <div className="text-2xl font-bold text-blue-400">{calculatedStats.pendingActions}</div>
              </div>
              <div className="p-4 bg-cscx-gray-900/50 rounded-lg border border-gray-700">
                <div className="text-xs text-gray-500 uppercase mb-1">Success Metrics</div>
                <div className="text-2xl font-bold text-emerald-400">{calculatedStats.metricsCount}</div>
              </div>
            </div>

            {/* Quick Summary */}
            <div className="p-4 bg-orange-900/10 border border-orange-500/20 rounded-lg">
              <div className="text-sm text-orange-400 font-medium mb-2">Save Play Summary</div>
              <div className="text-sm text-gray-300">
                This save play addresses <span className="text-white font-medium">{calculatedStats.enabledCausesCount} root causes</span> with{' '}
                <span className="text-white font-medium">{calculatedStats.actionsCount} action items</span>. Target timeline is{' '}
                <span className="text-orange-400 font-medium">{draft.timeline}</span> with{' '}
                <span className="text-emerald-400 font-medium">{calculatedStats.metricsCount} success metrics</span> to track progress.
              </div>
            </div>

            {/* Notes */}
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Internal Notes
              </label>
              <textarea
                value={draft.notes}
                onChange={(e) => setDraft(prev => ({ ...prev, notes: e.target.value }))}
                rows={3}
                className="w-full px-3 py-2 bg-cscx-gray-900 border border-gray-700 rounded-lg text-white text-sm focus:outline-none focus:ring-1 focus:ring-orange-500/50"
                placeholder="Add any internal notes..."
              />
            </div>
          </div>
        )}

        {/* Root Causes Tab */}
        {activeTab === 'causes' && (
          <div className="space-y-3">
            <div className="flex justify-between items-center mb-4">
              <div className="text-sm text-gray-400">
                {calculatedStats.enabledCausesCount} of {draft.rootCauses.length} causes enabled
              </div>
              <button
                onClick={handleAddCause}
                className="px-3 py-1.5 text-sm bg-orange-600/20 text-orange-400 hover:bg-orange-600/30 rounded transition-colors"
              >
                + Add Cause
              </button>
            </div>

            {draft.rootCauses.map((cause) => (
              <div
                key={cause.id}
                className={`border rounded-lg overflow-hidden transition-colors ${
                  cause.enabled
                    ? 'bg-cscx-gray-900/50 border-gray-700'
                    : 'bg-cscx-gray-900/20 border-gray-800 opacity-60'
                }`}
              >
                {/* Cause Header */}
                <div
                  className="p-3 cursor-pointer hover:bg-cscx-gray-900/70"
                  onClick={() => setExpandedCause(expandedCause === cause.id ? null : cause.id)}
                >
                  <div className="flex items-center gap-3">
                    {/* Checkbox */}
                    <input
                      type="checkbox"
                      checked={cause.enabled}
                      onChange={(e) => {
                        e.stopPropagation();
                        handleToggleCause(cause.id);
                      }}
                      className="w-4 h-4 rounded bg-cscx-gray-800 border-gray-600 text-orange-500 focus:ring-orange-500/50"
                    />

                    {/* Severity Badge */}
                    <span className={`px-2 py-0.5 text-xs rounded border ${SEVERITY_COLORS[cause.severity]}`}>
                      {SEVERITY_LABELS[cause.severity]}
                    </span>

                    {/* Category Badge */}
                    <span className={`px-2 py-0.5 text-xs rounded ${CATEGORY_COLORS[cause.category]}`}>
                      {CATEGORY_LABELS[cause.category]}
                    </span>

                    {/* Cause Name */}
                    <span className="flex-1 text-white font-medium">{cause.cause}</span>

                    {/* Expand Icon */}
                    <svg
                      className={`w-4 h-4 text-gray-400 transition-transform ${
                        expandedCause === cause.id ? 'rotate-180' : ''
                      }`}
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                  </div>
                </div>

                {/* Expanded Content */}
                {expandedCause === cause.id && (
                  <div className="p-4 border-t border-gray-700 space-y-3">
                    <div className="grid grid-cols-2 gap-4">
                      {/* Cause Name */}
                      <div>
                        <label className="block text-xs text-gray-500 mb-1">Root Cause</label>
                        <input
                          type="text"
                          value={cause.cause}
                          onChange={(e) => handleUpdateCause(cause.id, { cause: e.target.value })}
                          className="w-full px-2 py-1.5 bg-cscx-gray-800 border border-gray-700 rounded text-white text-sm focus:outline-none focus:ring-1 focus:ring-orange-500/50"
                        />
                      </div>

                      {/* Category */}
                      <div>
                        <label className="block text-xs text-gray-500 mb-1">Category</label>
                        <select
                          value={cause.category}
                          onChange={(e) => handleUpdateCause(cause.id, { category: e.target.value as RootCause['category'] })}
                          className="w-full px-2 py-1.5 bg-cscx-gray-800 border border-gray-700 rounded text-white text-sm focus:outline-none focus:ring-1 focus:ring-orange-500/50"
                        >
                          {CATEGORY_OPTIONS.map(cat => (
                            <option key={cat} value={cat}>{CATEGORY_LABELS[cat]}</option>
                          ))}
                        </select>
                      </div>

                      {/* Severity */}
                      <div>
                        <label className="block text-xs text-gray-500 mb-1">Severity</label>
                        <select
                          value={cause.severity}
                          onChange={(e) => handleUpdateCause(cause.id, { severity: e.target.value as RootCause['severity'] })}
                          className="w-full px-2 py-1.5 bg-cscx-gray-800 border border-gray-700 rounded text-white text-sm focus:outline-none focus:ring-1 focus:ring-orange-500/50"
                        >
                          {SEVERITY_OPTIONS.map(sev => (
                            <option key={sev} value={sev}>{SEVERITY_LABELS[sev]}</option>
                          ))}
                        </select>
                      </div>
                    </div>

                    {/* Description */}
                    <div>
                      <label className="block text-xs text-gray-500 mb-1">Description</label>
                      <textarea
                        value={cause.description}
                        onChange={(e) => handleUpdateCause(cause.id, { description: e.target.value })}
                        rows={2}
                        className="w-full px-2 py-1.5 bg-cscx-gray-800 border border-gray-700 rounded text-white text-sm focus:outline-none focus:ring-1 focus:ring-orange-500/50"
                        placeholder="Describe the root cause..."
                      />
                    </div>

                    {/* Evidence */}
                    <div>
                      <label className="block text-xs text-gray-500 mb-1">Evidence</label>
                      <textarea
                        value={cause.evidence}
                        onChange={(e) => handleUpdateCause(cause.id, { evidence: e.target.value })}
                        rows={2}
                        className="w-full px-2 py-1.5 bg-cscx-gray-800 border border-gray-700 rounded text-white text-sm focus:outline-none focus:ring-1 focus:ring-orange-500/50"
                        placeholder="Supporting evidence..."
                      />
                    </div>

                    {/* Remove Button */}
                    <div className="flex justify-end">
                      <button
                        onClick={() => handleRemoveCause(cause.id)}
                        className="px-3 py-1.5 text-sm text-red-400 hover:text-red-300 hover:bg-red-900/20 rounded transition-colors"
                      >
                        Remove Cause
                      </button>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        {/* Actions Tab */}
        {activeTab === 'actions' && (
          <div className="space-y-3">
            <div className="flex justify-between items-center mb-4">
              <div className="text-sm text-gray-400">
                {calculatedStats.pendingActions} of {calculatedStats.actionsCount} actions pending
              </div>
              <button
                onClick={handleAddAction}
                className="px-3 py-1.5 text-sm bg-orange-600/20 text-orange-400 hover:bg-orange-600/30 rounded transition-colors"
              >
                + Add Action
              </button>
            </div>

            {draft.actionItems.map((action, index) => (
              <div
                key={action.id}
                className="bg-cscx-gray-900/50 border border-gray-700 rounded-lg overflow-hidden"
              >
                {/* Action Header */}
                <div
                  className="p-3 cursor-pointer hover:bg-cscx-gray-900/70"
                  onClick={() => setExpandedAction(expandedAction === action.id ? null : action.id)}
                >
                  <div className="flex items-center gap-3">
                    {/* Priority Badge */}
                    <span className={`px-2 py-0.5 text-xs rounded ${PRIORITY_COLORS[action.priority]}`}>
                      {PRIORITY_LABELS[action.priority]}
                    </span>

                    {/* Status Badge */}
                    <span className={`px-2 py-0.5 text-xs rounded ${STATUS_COLORS[action.status]}`}>
                      {STATUS_LABELS[action.status]}
                    </span>

                    {/* Action Name */}
                    <span className="flex-1 text-white font-medium">{action.action}</span>

                    {/* Owner */}
                    <span className="text-sm text-gray-400">{action.owner}</span>

                    {/* Due Date */}
                    <span className="text-sm text-gray-500">{action.dueDate}</span>

                    {/* Move Buttons */}
                    <div className="flex gap-1">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleMoveAction(action.id, 'up');
                        }}
                        disabled={index === 0}
                        className="p-1 text-gray-500 hover:text-white disabled:opacity-30"
                      >
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
                        </svg>
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleMoveAction(action.id, 'down');
                        }}
                        disabled={index === draft.actionItems.length - 1}
                        className="p-1 text-gray-500 hover:text-white disabled:opacity-30"
                      >
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                        </svg>
                      </button>
                    </div>

                    {/* Expand Icon */}
                    <svg
                      className={`w-4 h-4 text-gray-400 transition-transform ${
                        expandedAction === action.id ? 'rotate-180' : ''
                      }`}
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                  </div>
                </div>

                {/* Expanded Content */}
                {expandedAction === action.id && (
                  <div className="p-4 border-t border-gray-700 space-y-3">
                    <div className="grid grid-cols-2 gap-4">
                      {/* Action Name */}
                      <div>
                        <label className="block text-xs text-gray-500 mb-1">Action</label>
                        <input
                          type="text"
                          value={action.action}
                          onChange={(e) => handleUpdateAction(action.id, { action: e.target.value })}
                          className="w-full px-2 py-1.5 bg-cscx-gray-800 border border-gray-700 rounded text-white text-sm focus:outline-none focus:ring-1 focus:ring-orange-500/50"
                        />
                      </div>

                      {/* Owner */}
                      <div>
                        <label className="block text-xs text-gray-500 mb-1">Owner</label>
                        <select
                          value={action.owner}
                          onChange={(e) => handleUpdateAction(action.id, { owner: e.target.value as SavePlayAction['owner'] })}
                          className="w-full px-2 py-1.5 bg-cscx-gray-800 border border-gray-700 rounded text-white text-sm focus:outline-none focus:ring-1 focus:ring-orange-500/50"
                        >
                          {OWNER_OPTIONS.map(owner => (
                            <option key={owner} value={owner}>{owner}</option>
                          ))}
                        </select>
                      </div>

                      {/* Priority */}
                      <div>
                        <label className="block text-xs text-gray-500 mb-1">Priority</label>
                        <select
                          value={action.priority}
                          onChange={(e) => handleUpdateAction(action.id, { priority: e.target.value as SavePlayAction['priority'] })}
                          className="w-full px-2 py-1.5 bg-cscx-gray-800 border border-gray-700 rounded text-white text-sm focus:outline-none focus:ring-1 focus:ring-orange-500/50"
                        >
                          {PRIORITY_OPTIONS.map(p => (
                            <option key={p} value={p}>{PRIORITY_LABELS[p]}</option>
                          ))}
                        </select>
                      </div>

                      {/* Status */}
                      <div>
                        <label className="block text-xs text-gray-500 mb-1">Status</label>
                        <select
                          value={action.status}
                          onChange={(e) => handleUpdateAction(action.id, { status: e.target.value as SavePlayAction['status'] })}
                          className="w-full px-2 py-1.5 bg-cscx-gray-800 border border-gray-700 rounded text-white text-sm focus:outline-none focus:ring-1 focus:ring-orange-500/50"
                        >
                          {STATUS_OPTIONS.map(s => (
                            <option key={s} value={s}>{STATUS_LABELS[s]}</option>
                          ))}
                        </select>
                      </div>

                      {/* Due Date */}
                      <div>
                        <label className="block text-xs text-gray-500 mb-1">Due Date</label>
                        <input
                          type="date"
                          value={action.dueDate}
                          onChange={(e) => handleUpdateAction(action.id, { dueDate: e.target.value })}
                          className="w-full px-2 py-1.5 bg-cscx-gray-800 border border-gray-700 rounded text-white text-sm focus:outline-none focus:ring-1 focus:ring-orange-500/50"
                        />
                      </div>
                    </div>

                    {/* Description */}
                    <div>
                      <label className="block text-xs text-gray-500 mb-1">Description</label>
                      <textarea
                        value={action.description}
                        onChange={(e) => handleUpdateAction(action.id, { description: e.target.value })}
                        rows={2}
                        className="w-full px-2 py-1.5 bg-cscx-gray-800 border border-gray-700 rounded text-white text-sm focus:outline-none focus:ring-1 focus:ring-orange-500/50"
                        placeholder="Detailed action steps..."
                      />
                    </div>

                    {/* Related Causes */}
                    <div>
                      <label className="block text-xs text-gray-500 mb-2">Related Root Causes</label>
                      <div className="flex flex-wrap gap-2">
                        {draft.rootCauses.filter(c => c.enabled).map(cause => (
                          <button
                            key={cause.id}
                            onClick={() => handleToggleRelatedCause(action.id, cause.id)}
                            className={`px-2 py-1 text-xs rounded border transition-colors ${
                              action.relatedCauseIds.includes(cause.id)
                                ? 'bg-orange-500/20 text-orange-400 border-orange-500/30'
                                : 'bg-cscx-gray-800 text-gray-400 border-gray-700 hover:border-gray-600'
                            }`}
                          >
                            {cause.cause}
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Remove Button */}
                    <div className="flex justify-end">
                      <button
                        onClick={() => handleRemoveAction(action.id)}
                        className="px-3 py-1.5 text-sm text-red-400 hover:text-red-300 hover:bg-red-900/20 rounded transition-colors"
                      >
                        Remove Action
                      </button>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        {/* Metrics Tab */}
        {activeTab === 'metrics' && (
          <div className="space-y-3">
            <div className="flex justify-between items-center mb-4">
              <div className="text-sm text-gray-400">
                {calculatedStats.metricsCount} of {draft.successMetrics.length} metrics enabled
              </div>
              <button
                onClick={handleAddMetric}
                className="px-3 py-1.5 text-sm bg-orange-600/20 text-orange-400 hover:bg-orange-600/30 rounded transition-colors"
              >
                + Add Metric
              </button>
            </div>

            {draft.successMetrics.map((metric) => (
              <div
                key={metric.id}
                className={`border rounded-lg overflow-hidden transition-colors ${
                  metric.enabled
                    ? 'bg-cscx-gray-900/50 border-gray-700'
                    : 'bg-cscx-gray-900/20 border-gray-800 opacity-60'
                }`}
              >
                {/* Metric Header */}
                <div
                  className="p-3 cursor-pointer hover:bg-cscx-gray-900/70"
                  onClick={() => setExpandedMetric(expandedMetric === metric.id ? null : metric.id)}
                >
                  <div className="flex items-center gap-3">
                    {/* Checkbox */}
                    <input
                      type="checkbox"
                      checked={metric.enabled}
                      onChange={(e) => {
                        e.stopPropagation();
                        handleToggleMetric(metric.id);
                      }}
                      className="w-4 h-4 rounded bg-cscx-gray-800 border-gray-600 text-orange-500 focus:ring-orange-500/50"
                    />

                    {/* Metric Name */}
                    <span className="flex-1 text-white font-medium">{metric.metric}</span>

                    {/* Current Value */}
                    <span className="text-sm text-gray-400">{metric.currentValue}</span>

                    {/* Arrow */}
                    <svg className="w-4 h-4 text-orange-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
                    </svg>

                    {/* Target Value */}
                    <span className="text-sm text-emerald-400">{metric.targetValue}</span>

                    {/* Due Date */}
                    <span className="text-sm text-gray-500">by {metric.dueDate}</span>

                    {/* Expand Icon */}
                    <svg
                      className={`w-4 h-4 text-gray-400 transition-transform ${
                        expandedMetric === metric.id ? 'rotate-180' : ''
                      }`}
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                  </div>
                </div>

                {/* Expanded Content */}
                {expandedMetric === metric.id && (
                  <div className="p-4 border-t border-gray-700 space-y-3">
                    <div className="grid grid-cols-2 gap-4">
                      {/* Metric Name */}
                      <div className="col-span-2">
                        <label className="block text-xs text-gray-500 mb-1">Metric Name</label>
                        <input
                          type="text"
                          value={metric.metric}
                          onChange={(e) => handleUpdateMetric(metric.id, { metric: e.target.value })}
                          className="w-full px-2 py-1.5 bg-cscx-gray-800 border border-gray-700 rounded text-white text-sm focus:outline-none focus:ring-1 focus:ring-orange-500/50"
                        />
                      </div>

                      {/* Current Value */}
                      <div>
                        <label className="block text-xs text-gray-500 mb-1">Current Value</label>
                        <input
                          type="text"
                          value={metric.currentValue}
                          onChange={(e) => handleUpdateMetric(metric.id, { currentValue: e.target.value })}
                          className="w-full px-2 py-1.5 bg-cscx-gray-800 border border-gray-700 rounded text-white text-sm focus:outline-none focus:ring-1 focus:ring-orange-500/50"
                        />
                      </div>

                      {/* Target Value */}
                      <div>
                        <label className="block text-xs text-gray-500 mb-1">Target Value</label>
                        <input
                          type="text"
                          value={metric.targetValue}
                          onChange={(e) => handleUpdateMetric(metric.id, { targetValue: e.target.value })}
                          className="w-full px-2 py-1.5 bg-cscx-gray-800 border border-gray-700 rounded text-white text-sm focus:outline-none focus:ring-1 focus:ring-orange-500/50"
                        />
                      </div>

                      {/* Due Date */}
                      <div>
                        <label className="block text-xs text-gray-500 mb-1">Target Date</label>
                        <input
                          type="date"
                          value={metric.dueDate}
                          onChange={(e) => handleUpdateMetric(metric.id, { dueDate: e.target.value })}
                          className="w-full px-2 py-1.5 bg-cscx-gray-800 border border-gray-700 rounded text-white text-sm focus:outline-none focus:ring-1 focus:ring-orange-500/50"
                        />
                      </div>
                    </div>

                    {/* Remove Button */}
                    <div className="flex justify-end">
                      <button
                        onClick={() => handleRemoveMetric(metric.id)}
                        className="px-3 py-1.5 text-sm text-red-400 hover:text-red-300 hover:bg-red-900/20 rounded transition-colors"
                      >
                        Remove Metric
                      </button>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default CADGSavePlayPreview;
