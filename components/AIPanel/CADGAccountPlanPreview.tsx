/**
 * CADGAccountPlanPreview - Editable strategic account plan preview for CADG-generated plans
 * Allows users to review, edit, and approve account plans before creating document + tracker
 */

import React, { useState, useMemo } from 'react';
import { useAuth } from '../../context/AuthContext';

// ============================================
// Types
// ============================================

export interface AccountObjective {
  id: string;
  title: string;
  description: string;
  category: 'growth' | 'retention' | 'expansion' | 'adoption' | 'risk_mitigation' | 'strategic';
  priority: 'high' | 'medium' | 'low';
  targetDate: string;
  metrics: string[];
  enabled: boolean;
}

export interface AccountAction {
  id: string;
  action: string;
  description: string;
  owner: 'CSM' | 'Customer' | 'Product' | 'Engineering' | 'Sales' | 'Support' | 'Leadership';
  priority: 'high' | 'medium' | 'low';
  dueDate: string;
  status: 'planned' | 'in_progress' | 'completed' | 'blocked';
  relatedObjectiveIds: string[];
  enabled: boolean;
}

export interface AccountMilestone {
  id: string;
  name: string;
  description: string;
  targetDate: string;
  status: 'planned' | 'in_progress' | 'completed' | 'at_risk';
  owner: string;
  enabled: boolean;
}

export interface AccountResource {
  id: string;
  type: 'budget' | 'headcount' | 'tooling' | 'training' | 'support' | 'other';
  description: string;
  allocation: string;
  enabled: boolean;
}

export interface AccountPlanData {
  title: string;
  planPeriod: string;
  createdDate: string;
  accountOverview: string;
  objectives: AccountObjective[];
  actionItems: AccountAction[];
  milestones: AccountMilestone[];
  resources: AccountResource[];
  successCriteria: string[];
  risks: string[];
  timeline: string;
  healthScore: number;
  daysUntilRenewal: number;
  arr: number;
  notes: string;
}

export interface CustomerData {
  id: string | null;
  name: string;
  healthScore?: number;
  arr?: number;
  renewalDate?: string;
}

interface CADGAccountPlanPreviewProps {
  accountPlan: AccountPlanData;
  customer: CustomerData;
  onSave: (accountPlan: AccountPlanData) => Promise<void>;
  onCancel: () => void;
}

// ============================================
// Options
// ============================================
const CATEGORY_OPTIONS = ['growth', 'retention', 'expansion', 'adoption', 'risk_mitigation', 'strategic'] as const;
const PRIORITY_OPTIONS = ['high', 'medium', 'low'] as const;
const ACTION_STATUS_OPTIONS = ['planned', 'in_progress', 'completed', 'blocked'] as const;
const MILESTONE_STATUS_OPTIONS = ['planned', 'in_progress', 'completed', 'at_risk'] as const;
const OWNER_OPTIONS = ['CSM', 'Customer', 'Product', 'Engineering', 'Sales', 'Support', 'Leadership'] as const;
const RESOURCE_TYPE_OPTIONS = ['budget', 'headcount', 'tooling', 'training', 'support', 'other'] as const;

const CATEGORY_LABELS: Record<string, string> = {
  growth: 'Growth',
  retention: 'Retention',
  expansion: 'Expansion',
  adoption: 'Adoption',
  risk_mitigation: 'Risk Mitigation',
  strategic: 'Strategic',
};

const CATEGORY_COLORS: Record<string, string> = {
  growth: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30',
  retention: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
  expansion: 'bg-purple-500/20 text-purple-400 border-purple-500/30',
  adoption: 'bg-cyan-500/20 text-cyan-400 border-cyan-500/30',
  risk_mitigation: 'bg-red-500/20 text-red-400 border-red-500/30',
  strategic: 'bg-indigo-500/20 text-indigo-400 border-indigo-500/30',
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

const ACTION_STATUS_LABELS: Record<string, string> = {
  planned: 'Planned',
  in_progress: 'In Progress',
  completed: 'Completed',
  blocked: 'Blocked',
};

const ACTION_STATUS_COLORS: Record<string, string> = {
  planned: 'bg-gray-500/20 text-gray-400 border-gray-500/30',
  in_progress: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
  completed: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30',
  blocked: 'bg-red-500/20 text-red-400 border-red-500/30',
};

const MILESTONE_STATUS_LABELS: Record<string, string> = {
  planned: 'Planned',
  in_progress: 'In Progress',
  completed: 'Completed',
  at_risk: 'At Risk',
};

const MILESTONE_STATUS_COLORS: Record<string, string> = {
  planned: 'bg-gray-500/20 text-gray-400 border-gray-500/30',
  in_progress: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
  completed: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30',
  at_risk: 'bg-red-500/20 text-red-400 border-red-500/30',
};

const RESOURCE_TYPE_LABELS: Record<string, string> = {
  budget: 'Budget',
  headcount: 'Headcount',
  tooling: 'Tooling',
  training: 'Training',
  support: 'Support',
  other: 'Other',
};

const RESOURCE_TYPE_ICONS: Record<string, string> = {
  budget: '💰',
  headcount: '👥',
  tooling: '🔧',
  training: '📚',
  support: '🎧',
  other: '📋',
};

const API_URL = import.meta.env.VITE_API_URL || '';

// ============================================
// Component
// ============================================

export const CADGAccountPlanPreview: React.FC<CADGAccountPlanPreviewProps> = ({
  accountPlan,
  customer,
  onSave,
  onCancel,
}) => {
  const { getAuthHeaders } = useAuth();
  const [editedPlan, setEditedPlan] = useState<AccountPlanData>({ ...accountPlan });
  const [activeTab, setActiveTab] = useState<'overview' | 'objectives' | 'actions' | 'milestones' | 'resources' | 'criteria'>('overview');
  const [expandedObjectives, setExpandedObjectives] = useState<Set<string>>(new Set());
  const [expandedActions, setExpandedActions] = useState<Set<string>>(new Set());
  const [expandedMilestones, setExpandedMilestones] = useState<Set<string>>(new Set());
  const [isSaving, setIsSaving] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);

  // Calculate summary stats
  const enabledObjectives = useMemo(() => editedPlan.objectives.filter(o => o.enabled), [editedPlan.objectives]);
  const enabledActions = useMemo(() => editedPlan.actionItems.filter(a => a.enabled), [editedPlan.actionItems]);
  const enabledMilestones = useMemo(() => editedPlan.milestones.filter(m => m.enabled), [editedPlan.milestones]);
  const enabledResources = useMemo(() => editedPlan.resources.filter(r => r.enabled), [editedPlan.resources]);

  const highPriorityObjectives = useMemo(() => enabledObjectives.filter(o => o.priority === 'high').length, [enabledObjectives]);
  const upcomingMilestones = useMemo(() => {
    const thirtyDays = Date.now() + 30 * 24 * 60 * 60 * 1000;
    return enabledMilestones.filter(m => new Date(m.targetDate).getTime() < thirtyDays).length;
  }, [enabledMilestones]);

  // Handlers
  const updateField = (field: keyof AccountPlanData, value: any) => {
    setEditedPlan(prev => ({ ...prev, [field]: value }));
    setHasChanges(true);
  };

  const toggleObjectiveExpanded = (id: string) => {
    setExpandedObjectives(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleActionExpanded = (id: string) => {
    setExpandedActions(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleMilestoneExpanded = (id: string) => {
    setExpandedMilestones(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  // Objective handlers
  const updateObjective = (id: string, updates: Partial<AccountObjective>) => {
    setEditedPlan(prev => ({
      ...prev,
      objectives: prev.objectives.map(o => o.id === id ? { ...o, ...updates } : o),
    }));
    setHasChanges(true);
  };

  const addObjective = () => {
    const newObjective: AccountObjective = {
      id: `objective-${Date.now()}`,
      title: 'New Objective',
      description: '',
      category: 'strategic',
      priority: 'medium',
      targetDate: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10),
      metrics: [],
      enabled: true,
    };
    setEditedPlan(prev => ({
      ...prev,
      objectives: [...prev.objectives, newObjective],
    }));
    setExpandedObjectives(prev => new Set(prev).add(newObjective.id));
    setHasChanges(true);
  };

  const removeObjective = (id: string) => {
    setEditedPlan(prev => ({
      ...prev,
      objectives: prev.objectives.filter(o => o.id !== id),
      actionItems: prev.actionItems.map(a => ({
        ...a,
        relatedObjectiveIds: a.relatedObjectiveIds.filter(oid => oid !== id),
      })),
    }));
    setHasChanges(true);
  };

  const addMetricToObjective = (objectiveId: string) => {
    setEditedPlan(prev => ({
      ...prev,
      objectives: prev.objectives.map(o =>
        o.id === objectiveId
          ? { ...o, metrics: [...o.metrics, 'New metric'] }
          : o
      ),
    }));
    setHasChanges(true);
  };

  const updateObjectiveMetric = (objectiveId: string, metricIdx: number, value: string) => {
    setEditedPlan(prev => ({
      ...prev,
      objectives: prev.objectives.map(o =>
        o.id === objectiveId
          ? { ...o, metrics: o.metrics.map((m, i) => i === metricIdx ? value : m) }
          : o
      ),
    }));
    setHasChanges(true);
  };

  const removeObjectiveMetric = (objectiveId: string, metricIdx: number) => {
    setEditedPlan(prev => ({
      ...prev,
      objectives: prev.objectives.map(o =>
        o.id === objectiveId
          ? { ...o, metrics: o.metrics.filter((_, i) => i !== metricIdx) }
          : o
      ),
    }));
    setHasChanges(true);
  };

  // Action handlers
  const updateAction = (id: string, updates: Partial<AccountAction>) => {
    setEditedPlan(prev => ({
      ...prev,
      actionItems: prev.actionItems.map(a => a.id === id ? { ...a, ...updates } : a),
    }));
    setHasChanges(true);
  };

  const addAction = () => {
    const newAction: AccountAction = {
      id: `action-${Date.now()}`,
      action: 'New Action',
      description: '',
      owner: 'CSM',
      priority: 'medium',
      dueDate: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10),
      status: 'planned',
      relatedObjectiveIds: [],
      enabled: true,
    };
    setEditedPlan(prev => ({
      ...prev,
      actionItems: [...prev.actionItems, newAction],
    }));
    setExpandedActions(prev => new Set(prev).add(newAction.id));
    setHasChanges(true);
  };

  const removeAction = (id: string) => {
    setEditedPlan(prev => ({
      ...prev,
      actionItems: prev.actionItems.filter(a => a.id !== id),
    }));
    setHasChanges(true);
  };

  const toggleActionObjective = (actionId: string, objectiveId: string) => {
    setEditedPlan(prev => ({
      ...prev,
      actionItems: prev.actionItems.map(a => {
        if (a.id !== actionId) return a;
        const hasObjective = a.relatedObjectiveIds.includes(objectiveId);
        return {
          ...a,
          relatedObjectiveIds: hasObjective
            ? a.relatedObjectiveIds.filter(id => id !== objectiveId)
            : [...a.relatedObjectiveIds, objectiveId],
        };
      }),
    }));
    setHasChanges(true);
  };

  const moveAction = (id: string, direction: 'up' | 'down') => {
    setEditedPlan(prev => {
      const items = [...prev.actionItems];
      const idx = items.findIndex(a => a.id === id);
      if ((direction === 'up' && idx === 0) || (direction === 'down' && idx === items.length - 1)) return prev;
      const swapIdx = direction === 'up' ? idx - 1 : idx + 1;
      [items[idx], items[swapIdx]] = [items[swapIdx], items[idx]];
      return { ...prev, actionItems: items };
    });
    setHasChanges(true);
  };

  // Milestone handlers
  const updateMilestone = (id: string, updates: Partial<AccountMilestone>) => {
    setEditedPlan(prev => ({
      ...prev,
      milestones: prev.milestones.map(m => m.id === id ? { ...m, ...updates } : m),
    }));
    setHasChanges(true);
  };

  const addMilestone = () => {
    const newMilestone: AccountMilestone = {
      id: `milestone-${Date.now()}`,
      name: 'New Milestone',
      description: '',
      targetDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10),
      status: 'planned',
      owner: 'CSM',
      enabled: true,
    };
    setEditedPlan(prev => ({
      ...prev,
      milestones: [...prev.milestones, newMilestone],
    }));
    setExpandedMilestones(prev => new Set(prev).add(newMilestone.id));
    setHasChanges(true);
  };

  const removeMilestone = (id: string) => {
    setEditedPlan(prev => ({
      ...prev,
      milestones: prev.milestones.filter(m => m.id !== id),
    }));
    setHasChanges(true);
  };

  // Resource handlers
  const updateResource = (id: string, updates: Partial<AccountResource>) => {
    setEditedPlan(prev => ({
      ...prev,
      resources: prev.resources.map(r => r.id === id ? { ...r, ...updates } : r),
    }));
    setHasChanges(true);
  };

  const addResource = () => {
    const newResource: AccountResource = {
      id: `resource-${Date.now()}`,
      type: 'other',
      description: 'New resource requirement',
      allocation: 'TBD',
      enabled: true,
    };
    setEditedPlan(prev => ({
      ...prev,
      resources: [...prev.resources, newResource],
    }));
    setHasChanges(true);
  };

  const removeResource = (id: string) => {
    setEditedPlan(prev => ({
      ...prev,
      resources: prev.resources.filter(r => r.id !== id),
    }));
    setHasChanges(true);
  };

  // Success criteria handlers
  const addSuccessCriterion = () => {
    setEditedPlan(prev => ({
      ...prev,
      successCriteria: [...prev.successCriteria, 'New success criterion'],
    }));
    setHasChanges(true);
  };

  const updateSuccessCriterion = (idx: number, value: string) => {
    setEditedPlan(prev => ({
      ...prev,
      successCriteria: prev.successCriteria.map((c, i) => i === idx ? value : c),
    }));
    setHasChanges(true);
  };

  const removeSuccessCriterion = (idx: number) => {
    setEditedPlan(prev => ({
      ...prev,
      successCriteria: prev.successCriteria.filter((_, i) => i !== idx),
    }));
    setHasChanges(true);
  };

  // Risk handlers
  const addRisk = () => {
    setEditedPlan(prev => ({
      ...prev,
      risks: [...prev.risks, 'New identified risk'],
    }));
    setHasChanges(true);
  };

  const updateRisk = (idx: number, value: string) => {
    setEditedPlan(prev => ({
      ...prev,
      risks: prev.risks.map((r, i) => i === idx ? value : r),
    }));
    setHasChanges(true);
  };

  const removeRisk = (idx: number) => {
    setEditedPlan(prev => ({
      ...prev,
      risks: prev.risks.filter((_, i) => i !== idx),
    }));
    setHasChanges(true);
  };

  // Save handler
  const handleSave = async () => {
    setIsSaving(true);
    try {
      await onSave(editedPlan);
    } finally {
      setIsSaving(false);
    }
  };

  // Cancel handler with confirmation
  const handleCancel = () => {
    if (hasChanges) {
      if (window.confirm('You have unsaved changes. Are you sure you want to cancel?')) {
        onCancel();
      }
    } else {
      onCancel();
    }
  };

  // Tab content
  const tabs = [
    { id: 'overview', label: 'Overview', count: null },
    { id: 'objectives', label: 'Objectives', count: enabledObjectives.length },
    { id: 'actions', label: 'Actions', count: enabledActions.length },
    { id: 'milestones', label: 'Milestones', count: enabledMilestones.length },
    { id: 'resources', label: 'Resources', count: enabledResources.length },
    { id: 'criteria', label: 'Criteria & Risks', count: editedPlan.successCriteria.length + editedPlan.risks.length },
  ] as const;

  return (
    <div className="bg-cscx-gray-800 rounded-xl border border-indigo-500/30 overflow-hidden">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-gradient-to-r from-indigo-900/50 to-purple-900/50 px-4 py-3 border-b border-indigo-500/30">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <span className="text-xl">📋</span>
            <h3 className="text-lg font-semibold text-white">Strategic Account Plan</h3>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handleCancel}
              className="px-3 py-1.5 text-sm text-gray-400 hover:text-white transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              disabled={isSaving}
              className="px-4 py-1.5 bg-indigo-500 hover:bg-indigo-600 text-white text-sm font-medium rounded-lg transition-colors disabled:opacity-50"
            >
              {isSaving ? 'Saving...' : 'Create Plan'}
            </button>
          </div>
        </div>

        {/* Customer info */}
        <div className="flex items-center gap-4 text-sm text-gray-400">
          <span className="font-medium text-white">{customer.name}</span>
          <span>|</span>
          <span>Health: <span className={editedPlan.healthScore >= 70 ? 'text-emerald-400' : editedPlan.healthScore >= 50 ? 'text-amber-400' : 'text-red-400'}>{editedPlan.healthScore}</span></span>
          <span>|</span>
          <span>ARR: <span className="text-white">${editedPlan.arr.toLocaleString()}</span></span>
          <span>|</span>
          <span>Days to Renewal: <span className={editedPlan.daysUntilRenewal <= 30 ? 'text-red-400' : editedPlan.daysUntilRenewal <= 90 ? 'text-amber-400' : 'text-white'}>{editedPlan.daysUntilRenewal}</span></span>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-gray-700 bg-cscx-gray-900/50 overflow-x-auto">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`px-4 py-2.5 text-sm font-medium whitespace-nowrap transition-colors ${
              activeTab === tab.id
                ? 'text-indigo-400 border-b-2 border-indigo-400'
                : 'text-gray-400 hover:text-white'
            }`}
          >
            {tab.label}
            {tab.count !== null && (
              <span className={`ml-1.5 px-1.5 py-0.5 text-xs rounded ${
                activeTab === tab.id ? 'bg-indigo-500/30 text-indigo-300' : 'bg-gray-700 text-gray-400'
              }`}>
                {tab.count}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Content */}
      <div className="p-4 max-h-[500px] overflow-y-auto">
        {/* Overview Tab */}
        {activeTab === 'overview' && (
          <div className="space-y-4">
            {/* Summary cards */}
            <div className="grid grid-cols-4 gap-3">
              <div className="bg-cscx-gray-900/50 rounded-lg p-3 border border-gray-700">
                <div className="text-xs text-gray-400 mb-1">Objectives</div>
                <div className="text-xl font-semibold text-indigo-400">{enabledObjectives.length}</div>
                <div className="text-xs text-gray-500">{highPriorityObjectives} high priority</div>
              </div>
              <div className="bg-cscx-gray-900/50 rounded-lg p-3 border border-gray-700">
                <div className="text-xs text-gray-400 mb-1">Action Items</div>
                <div className="text-xl font-semibold text-purple-400">{enabledActions.length}</div>
                <div className="text-xs text-gray-500">{enabledActions.filter(a => a.status === 'in_progress').length} in progress</div>
              </div>
              <div className="bg-cscx-gray-900/50 rounded-lg p-3 border border-gray-700">
                <div className="text-xs text-gray-400 mb-1">Milestones</div>
                <div className="text-xl font-semibold text-cyan-400">{enabledMilestones.length}</div>
                <div className="text-xs text-gray-500">{upcomingMilestones} in next 30 days</div>
              </div>
              <div className="bg-cscx-gray-900/50 rounded-lg p-3 border border-gray-700">
                <div className="text-xs text-gray-400 mb-1">Resources</div>
                <div className="text-xl font-semibold text-amber-400">{enabledResources.length}</div>
                <div className="text-xs text-gray-500">allocated</div>
              </div>
            </div>

            {/* Title */}
            <div>
              <label className="block text-xs text-gray-400 mb-1">Plan Title</label>
              <input
                type="text"
                value={editedPlan.title}
                onChange={(e) => updateField('title', e.target.value)}
                className="w-full px-3 py-2 bg-cscx-gray-900 border border-gray-700 rounded-lg text-white text-sm focus:outline-none focus:border-indigo-500"
              />
            </div>

            {/* Plan Period */}
            <div>
              <label className="block text-xs text-gray-400 mb-1">Plan Period</label>
              <input
                type="text"
                value={editedPlan.planPeriod}
                onChange={(e) => updateField('planPeriod', e.target.value)}
                className="w-full px-3 py-2 bg-cscx-gray-900 border border-gray-700 rounded-lg text-white text-sm focus:outline-none focus:border-indigo-500"
              />
            </div>

            {/* Account Overview */}
            <div>
              <label className="block text-xs text-gray-400 mb-1">Account Overview</label>
              <textarea
                value={editedPlan.accountOverview}
                onChange={(e) => updateField('accountOverview', e.target.value)}
                rows={4}
                className="w-full px-3 py-2 bg-cscx-gray-900 border border-gray-700 rounded-lg text-white text-sm focus:outline-none focus:border-indigo-500"
              />
            </div>

            {/* Timeline */}
            <div>
              <label className="block text-xs text-gray-400 mb-1">Timeline Overview</label>
              <textarea
                value={editedPlan.timeline}
                onChange={(e) => updateField('timeline', e.target.value)}
                rows={3}
                className="w-full px-3 py-2 bg-cscx-gray-900 border border-gray-700 rounded-lg text-white text-sm focus:outline-none focus:border-indigo-500"
              />
            </div>

            {/* Notes */}
            <div>
              <label className="block text-xs text-gray-400 mb-1">Internal Notes (optional)</label>
              <textarea
                value={editedPlan.notes}
                onChange={(e) => updateField('notes', e.target.value)}
                rows={2}
                placeholder="Add any internal notes..."
                className="w-full px-3 py-2 bg-cscx-gray-900 border border-gray-700 rounded-lg text-white text-sm focus:outline-none focus:border-indigo-500 placeholder-gray-500"
              />
            </div>
          </div>
        )}

        {/* Objectives Tab */}
        {activeTab === 'objectives' && (
          <div className="space-y-3">
            <div className="flex justify-between items-center mb-2">
              <p className="text-sm text-gray-400">Define strategic objectives for this account</p>
              <button
                onClick={addObjective}
                className="px-3 py-1.5 bg-indigo-500/20 text-indigo-400 text-sm rounded-lg hover:bg-indigo-500/30 transition-colors"
              >
                + Add Objective
              </button>
            </div>

            {editedPlan.objectives.map((objective, idx) => (
              <div
                key={objective.id}
                className={`border rounded-lg overflow-hidden transition-colors ${
                  objective.enabled ? 'border-indigo-500/30 bg-cscx-gray-900/50' : 'border-gray-700 bg-cscx-gray-900/30 opacity-60'
                }`}
              >
                <div
                  className="flex items-center gap-3 p-3 cursor-pointer"
                  onClick={() => toggleObjectiveExpanded(objective.id)}
                >
                  <input
                    type="checkbox"
                    checked={objective.enabled}
                    onChange={(e) => {
                      e.stopPropagation();
                      updateObjective(objective.id, { enabled: e.target.checked });
                    }}
                    className="w-4 h-4 accent-indigo-500"
                  />
                  <span className="text-gray-400 text-sm font-medium w-6">#{idx + 1}</span>
                  <div className="flex-1 min-w-0">
                    <div className="text-white text-sm font-medium truncate">{objective.title}</div>
                  </div>
                  <span className={`px-2 py-0.5 text-xs rounded border ${CATEGORY_COLORS[objective.category]}`}>
                    {CATEGORY_LABELS[objective.category]}
                  </span>
                  <span className={`px-2 py-0.5 text-xs rounded border ${PRIORITY_COLORS[objective.priority]}`}>
                    {PRIORITY_LABELS[objective.priority]}
                  </span>
                  <span className={`transform transition-transform ${expandedObjectives.has(objective.id) ? 'rotate-180' : ''}`}>
                    ▼
                  </span>
                </div>

                {expandedObjectives.has(objective.id) && (
                  <div className="px-3 pb-3 space-y-3 border-t border-gray-700/50 pt-3">
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block text-xs text-gray-400 mb-1">Title</label>
                        <input
                          type="text"
                          value={objective.title}
                          onChange={(e) => updateObjective(objective.id, { title: e.target.value })}
                          className="w-full px-3 py-1.5 bg-cscx-gray-900 border border-gray-700 rounded text-white text-sm focus:outline-none focus:border-indigo-500"
                        />
                      </div>
                      <div className="flex gap-3">
                        <div className="flex-1">
                          <label className="block text-xs text-gray-400 mb-1">Category</label>
                          <select
                            value={objective.category}
                            onChange={(e) => updateObjective(objective.id, { category: e.target.value as AccountObjective['category'] })}
                            className="w-full px-3 py-1.5 bg-cscx-gray-900 border border-gray-700 rounded text-white text-sm focus:outline-none focus:border-indigo-500"
                          >
                            {CATEGORY_OPTIONS.map(opt => (
                              <option key={opt} value={opt}>{CATEGORY_LABELS[opt]}</option>
                            ))}
                          </select>
                        </div>
                        <div className="flex-1">
                          <label className="block text-xs text-gray-400 mb-1">Priority</label>
                          <select
                            value={objective.priority}
                            onChange={(e) => updateObjective(objective.id, { priority: e.target.value as AccountObjective['priority'] })}
                            className="w-full px-3 py-1.5 bg-cscx-gray-900 border border-gray-700 rounded text-white text-sm focus:outline-none focus:border-indigo-500"
                          >
                            {PRIORITY_OPTIONS.map(opt => (
                              <option key={opt} value={opt}>{PRIORITY_LABELS[opt]}</option>
                            ))}
                          </select>
                        </div>
                      </div>
                    </div>

                    <div>
                      <label className="block text-xs text-gray-400 mb-1">Description</label>
                      <textarea
                        value={objective.description}
                        onChange={(e) => updateObjective(objective.id, { description: e.target.value })}
                        rows={2}
                        className="w-full px-3 py-1.5 bg-cscx-gray-900 border border-gray-700 rounded text-white text-sm focus:outline-none focus:border-indigo-500"
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block text-xs text-gray-400 mb-1">Target Date</label>
                        <input
                          type="date"
                          value={objective.targetDate}
                          onChange={(e) => updateObjective(objective.id, { targetDate: e.target.value })}
                          className="w-full px-3 py-1.5 bg-cscx-gray-900 border border-gray-700 rounded text-white text-sm focus:outline-none focus:border-indigo-500"
                        />
                      </div>
                    </div>

                    {/* Metrics */}
                    <div>
                      <div className="flex justify-between items-center mb-1">
                        <label className="text-xs text-gray-400">Success Metrics</label>
                        <button
                          onClick={() => addMetricToObjective(objective.id)}
                          className="text-xs text-indigo-400 hover:text-indigo-300"
                        >
                          + Add
                        </button>
                      </div>
                      <div className="space-y-1">
                        {objective.metrics.map((metric, mIdx) => (
                          <div key={mIdx} className="flex items-center gap-2">
                            <input
                              type="text"
                              value={metric}
                              onChange={(e) => updateObjectiveMetric(objective.id, mIdx, e.target.value)}
                              className="flex-1 px-2 py-1 bg-cscx-gray-900 border border-gray-700 rounded text-white text-sm focus:outline-none focus:border-indigo-500"
                            />
                            <button
                              onClick={() => removeObjectiveMetric(objective.id, mIdx)}
                              className="text-red-400 hover:text-red-300 text-sm"
                            >
                              ×
                            </button>
                          </div>
                        ))}
                        {objective.metrics.length === 0 && (
                          <p className="text-xs text-gray-500 italic">No metrics defined</p>
                        )}
                      </div>
                    </div>

                    <div className="flex justify-end">
                      <button
                        onClick={() => removeObjective(objective.id)}
                        className="text-red-400 hover:text-red-300 text-xs"
                      >
                        Remove Objective
                      </button>
                    </div>
                  </div>
                )}
              </div>
            ))}

            {editedPlan.objectives.length === 0 && (
              <div className="text-center py-6 text-gray-500">
                No objectives defined. Click "Add Objective" to get started.
              </div>
            )}
          </div>
        )}

        {/* Actions Tab */}
        {activeTab === 'actions' && (
          <div className="space-y-3">
            <div className="flex justify-between items-center mb-2">
              <p className="text-sm text-gray-400">Define action items to achieve objectives</p>
              <button
                onClick={addAction}
                className="px-3 py-1.5 bg-purple-500/20 text-purple-400 text-sm rounded-lg hover:bg-purple-500/30 transition-colors"
              >
                + Add Action
              </button>
            </div>

            {editedPlan.actionItems.map((action, idx) => (
              <div
                key={action.id}
                className={`border rounded-lg overflow-hidden transition-colors ${
                  action.enabled ? 'border-purple-500/30 bg-cscx-gray-900/50' : 'border-gray-700 bg-cscx-gray-900/30 opacity-60'
                }`}
              >
                <div
                  className="flex items-center gap-3 p-3 cursor-pointer"
                  onClick={() => toggleActionExpanded(action.id)}
                >
                  <input
                    type="checkbox"
                    checked={action.enabled}
                    onChange={(e) => {
                      e.stopPropagation();
                      updateAction(action.id, { enabled: e.target.checked });
                    }}
                    className="w-4 h-4 accent-purple-500"
                  />
                  <div className="flex gap-1">
                    <button
                      onClick={(e) => { e.stopPropagation(); moveAction(action.id, 'up'); }}
                      disabled={idx === 0}
                      className="text-gray-500 hover:text-white disabled:opacity-30 text-xs"
                    >
                      ▲
                    </button>
                    <button
                      onClick={(e) => { e.stopPropagation(); moveAction(action.id, 'down'); }}
                      disabled={idx === editedPlan.actionItems.length - 1}
                      className="text-gray-500 hover:text-white disabled:opacity-30 text-xs"
                    >
                      ▼
                    </button>
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-white text-sm font-medium truncate">{action.action}</div>
                  </div>
                  <span className="text-xs text-gray-400">{action.owner}</span>
                  <span className={`px-2 py-0.5 text-xs rounded border ${PRIORITY_COLORS[action.priority]}`}>
                    {PRIORITY_LABELS[action.priority]}
                  </span>
                  <span className={`px-2 py-0.5 text-xs rounded border ${ACTION_STATUS_COLORS[action.status]}`}>
                    {ACTION_STATUS_LABELS[action.status]}
                  </span>
                  <span className={`transform transition-transform ${expandedActions.has(action.id) ? 'rotate-180' : ''}`}>
                    ▼
                  </span>
                </div>

                {expandedActions.has(action.id) && (
                  <div className="px-3 pb-3 space-y-3 border-t border-gray-700/50 pt-3">
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block text-xs text-gray-400 mb-1">Action</label>
                        <input
                          type="text"
                          value={action.action}
                          onChange={(e) => updateAction(action.id, { action: e.target.value })}
                          className="w-full px-3 py-1.5 bg-cscx-gray-900 border border-gray-700 rounded text-white text-sm focus:outline-none focus:border-purple-500"
                        />
                      </div>
                      <div className="flex gap-3">
                        <div className="flex-1">
                          <label className="block text-xs text-gray-400 mb-1">Owner</label>
                          <select
                            value={action.owner}
                            onChange={(e) => updateAction(action.id, { owner: e.target.value as AccountAction['owner'] })}
                            className="w-full px-3 py-1.5 bg-cscx-gray-900 border border-gray-700 rounded text-white text-sm focus:outline-none focus:border-purple-500"
                          >
                            {OWNER_OPTIONS.map(opt => (
                              <option key={opt} value={opt}>{opt}</option>
                            ))}
                          </select>
                        </div>
                        <div className="flex-1">
                          <label className="block text-xs text-gray-400 mb-1">Priority</label>
                          <select
                            value={action.priority}
                            onChange={(e) => updateAction(action.id, { priority: e.target.value as AccountAction['priority'] })}
                            className="w-full px-3 py-1.5 bg-cscx-gray-900 border border-gray-700 rounded text-white text-sm focus:outline-none focus:border-purple-500"
                          >
                            {PRIORITY_OPTIONS.map(opt => (
                              <option key={opt} value={opt}>{PRIORITY_LABELS[opt]}</option>
                            ))}
                          </select>
                        </div>
                      </div>
                    </div>

                    <div>
                      <label className="block text-xs text-gray-400 mb-1">Description</label>
                      <textarea
                        value={action.description}
                        onChange={(e) => updateAction(action.id, { description: e.target.value })}
                        rows={2}
                        className="w-full px-3 py-1.5 bg-cscx-gray-900 border border-gray-700 rounded text-white text-sm focus:outline-none focus:border-purple-500"
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block text-xs text-gray-400 mb-1">Due Date</label>
                        <input
                          type="date"
                          value={action.dueDate}
                          onChange={(e) => updateAction(action.id, { dueDate: e.target.value })}
                          className="w-full px-3 py-1.5 bg-cscx-gray-900 border border-gray-700 rounded text-white text-sm focus:outline-none focus:border-purple-500"
                        />
                      </div>
                      <div>
                        <label className="block text-xs text-gray-400 mb-1">Status</label>
                        <select
                          value={action.status}
                          onChange={(e) => updateAction(action.id, { status: e.target.value as AccountAction['status'] })}
                          className="w-full px-3 py-1.5 bg-cscx-gray-900 border border-gray-700 rounded text-white text-sm focus:outline-none focus:border-purple-500"
                        >
                          {ACTION_STATUS_OPTIONS.map(opt => (
                            <option key={opt} value={opt}>{ACTION_STATUS_LABELS[opt]}</option>
                          ))}
                        </select>
                      </div>
                    </div>

                    {/* Related Objectives */}
                    <div>
                      <label className="block text-xs text-gray-400 mb-1">Related Objectives (click to toggle)</label>
                      <div className="flex flex-wrap gap-2">
                        {enabledObjectives.map(obj => {
                          const isLinked = action.relatedObjectiveIds.includes(obj.id);
                          return (
                            <button
                              key={obj.id}
                              onClick={() => toggleActionObjective(action.id, obj.id)}
                              className={`px-2 py-1 text-xs rounded border transition-colors ${
                                isLinked
                                  ? 'bg-indigo-500/30 text-indigo-300 border-indigo-500/50'
                                  : 'bg-gray-700 text-gray-400 border-gray-600 hover:border-gray-500'
                              }`}
                            >
                              {obj.title}
                            </button>
                          );
                        })}
                        {enabledObjectives.length === 0 && (
                          <span className="text-xs text-gray-500 italic">No objectives available</span>
                        )}
                      </div>
                    </div>

                    <div className="flex justify-end">
                      <button
                        onClick={() => removeAction(action.id)}
                        className="text-red-400 hover:text-red-300 text-xs"
                      >
                        Remove Action
                      </button>
                    </div>
                  </div>
                )}
              </div>
            ))}

            {editedPlan.actionItems.length === 0 && (
              <div className="text-center py-6 text-gray-500">
                No action items defined. Click "Add Action" to get started.
              </div>
            )}
          </div>
        )}

        {/* Milestones Tab */}
        {activeTab === 'milestones' && (
          <div className="space-y-3">
            <div className="flex justify-between items-center mb-2">
              <p className="text-sm text-gray-400">Track progress with key milestones</p>
              <button
                onClick={addMilestone}
                className="px-3 py-1.5 bg-cyan-500/20 text-cyan-400 text-sm rounded-lg hover:bg-cyan-500/30 transition-colors"
              >
                + Add Milestone
              </button>
            </div>

            {editedPlan.milestones.map((milestone, idx) => (
              <div
                key={milestone.id}
                className={`border rounded-lg overflow-hidden transition-colors ${
                  milestone.enabled ? 'border-cyan-500/30 bg-cscx-gray-900/50' : 'border-gray-700 bg-cscx-gray-900/30 opacity-60'
                }`}
              >
                <div
                  className="flex items-center gap-3 p-3 cursor-pointer"
                  onClick={() => toggleMilestoneExpanded(milestone.id)}
                >
                  <input
                    type="checkbox"
                    checked={milestone.enabled}
                    onChange={(e) => {
                      e.stopPropagation();
                      updateMilestone(milestone.id, { enabled: e.target.checked });
                    }}
                    className="w-4 h-4 accent-cyan-500"
                  />
                  <span className="w-6 h-6 rounded-full bg-cyan-500/30 text-cyan-400 flex items-center justify-center text-xs font-medium">
                    {idx + 1}
                  </span>
                  <div className="flex-1 min-w-0">
                    <div className="text-white text-sm font-medium truncate">{milestone.name}</div>
                  </div>
                  <span className="text-xs text-gray-400">{milestone.targetDate}</span>
                  <span className={`px-2 py-0.5 text-xs rounded border ${MILESTONE_STATUS_COLORS[milestone.status]}`}>
                    {MILESTONE_STATUS_LABELS[milestone.status]}
                  </span>
                  <span className={`transform transition-transform ${expandedMilestones.has(milestone.id) ? 'rotate-180' : ''}`}>
                    ▼
                  </span>
                </div>

                {expandedMilestones.has(milestone.id) && (
                  <div className="px-3 pb-3 space-y-3 border-t border-gray-700/50 pt-3">
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block text-xs text-gray-400 mb-1">Name</label>
                        <input
                          type="text"
                          value={milestone.name}
                          onChange={(e) => updateMilestone(milestone.id, { name: e.target.value })}
                          className="w-full px-3 py-1.5 bg-cscx-gray-900 border border-gray-700 rounded text-white text-sm focus:outline-none focus:border-cyan-500"
                        />
                      </div>
                      <div className="flex gap-3">
                        <div className="flex-1">
                          <label className="block text-xs text-gray-400 mb-1">Target Date</label>
                          <input
                            type="date"
                            value={milestone.targetDate}
                            onChange={(e) => updateMilestone(milestone.id, { targetDate: e.target.value })}
                            className="w-full px-3 py-1.5 bg-cscx-gray-900 border border-gray-700 rounded text-white text-sm focus:outline-none focus:border-cyan-500"
                          />
                        </div>
                        <div className="flex-1">
                          <label className="block text-xs text-gray-400 mb-1">Status</label>
                          <select
                            value={milestone.status}
                            onChange={(e) => updateMilestone(milestone.id, { status: e.target.value as AccountMilestone['status'] })}
                            className="w-full px-3 py-1.5 bg-cscx-gray-900 border border-gray-700 rounded text-white text-sm focus:outline-none focus:border-cyan-500"
                          >
                            {MILESTONE_STATUS_OPTIONS.map(opt => (
                              <option key={opt} value={opt}>{MILESTONE_STATUS_LABELS[opt]}</option>
                            ))}
                          </select>
                        </div>
                      </div>
                    </div>

                    <div>
                      <label className="block text-xs text-gray-400 mb-1">Description</label>
                      <textarea
                        value={milestone.description}
                        onChange={(e) => updateMilestone(milestone.id, { description: e.target.value })}
                        rows={2}
                        className="w-full px-3 py-1.5 bg-cscx-gray-900 border border-gray-700 rounded text-white text-sm focus:outline-none focus:border-cyan-500"
                      />
                    </div>

                    <div>
                      <label className="block text-xs text-gray-400 mb-1">Owner</label>
                      <input
                        type="text"
                        value={milestone.owner}
                        onChange={(e) => updateMilestone(milestone.id, { owner: e.target.value })}
                        className="w-full px-3 py-1.5 bg-cscx-gray-900 border border-gray-700 rounded text-white text-sm focus:outline-none focus:border-cyan-500"
                      />
                    </div>

                    <div className="flex justify-end">
                      <button
                        onClick={() => removeMilestone(milestone.id)}
                        className="text-red-400 hover:text-red-300 text-xs"
                      >
                        Remove Milestone
                      </button>
                    </div>
                  </div>
                )}
              </div>
            ))}

            {editedPlan.milestones.length === 0 && (
              <div className="text-center py-6 text-gray-500">
                No milestones defined. Click "Add Milestone" to get started.
              </div>
            )}
          </div>
        )}

        {/* Resources Tab */}
        {activeTab === 'resources' && (
          <div className="space-y-3">
            <div className="flex justify-between items-center mb-2">
              <p className="text-sm text-gray-400">Define required resources for this plan</p>
              <button
                onClick={addResource}
                className="px-3 py-1.5 bg-amber-500/20 text-amber-400 text-sm rounded-lg hover:bg-amber-500/30 transition-colors"
              >
                + Add Resource
              </button>
            </div>

            {editedPlan.resources.map((resource) => (
              <div
                key={resource.id}
                className={`flex items-center gap-3 p-3 border rounded-lg transition-colors ${
                  resource.enabled ? 'border-amber-500/30 bg-cscx-gray-900/50' : 'border-gray-700 bg-cscx-gray-900/30 opacity-60'
                }`}
              >
                <input
                  type="checkbox"
                  checked={resource.enabled}
                  onChange={(e) => updateResource(resource.id, { enabled: e.target.checked })}
                  className="w-4 h-4 accent-amber-500"
                />
                <span className="text-lg">{RESOURCE_TYPE_ICONS[resource.type]}</span>
                <select
                  value={resource.type}
                  onChange={(e) => updateResource(resource.id, { type: e.target.value as AccountResource['type'] })}
                  className="px-2 py-1 bg-cscx-gray-900 border border-gray-700 rounded text-white text-sm focus:outline-none focus:border-amber-500"
                >
                  {RESOURCE_TYPE_OPTIONS.map(opt => (
                    <option key={opt} value={opt}>{RESOURCE_TYPE_LABELS[opt]}</option>
                  ))}
                </select>
                <input
                  type="text"
                  value={resource.description}
                  onChange={(e) => updateResource(resource.id, { description: e.target.value })}
                  className="flex-1 px-3 py-1 bg-cscx-gray-900 border border-gray-700 rounded text-white text-sm focus:outline-none focus:border-amber-500"
                  placeholder="Description"
                />
                <input
                  type="text"
                  value={resource.allocation}
                  onChange={(e) => updateResource(resource.id, { allocation: e.target.value })}
                  className="w-40 px-3 py-1 bg-cscx-gray-900 border border-gray-700 rounded text-white text-sm focus:outline-none focus:border-amber-500"
                  placeholder="Allocation"
                />
                <button
                  onClick={() => removeResource(resource.id)}
                  className="text-red-400 hover:text-red-300"
                >
                  ×
                </button>
              </div>
            ))}

            {editedPlan.resources.length === 0 && (
              <div className="text-center py-6 text-gray-500">
                No resources defined. Click "Add Resource" to get started.
              </div>
            )}
          </div>
        )}

        {/* Criteria & Risks Tab */}
        {activeTab === 'criteria' && (
          <div className="space-y-6">
            {/* Success Criteria */}
            <div>
              <div className="flex justify-between items-center mb-2">
                <h4 className="text-sm font-medium text-white">Success Criteria</h4>
                <button
                  onClick={addSuccessCriterion}
                  className="px-3 py-1.5 bg-emerald-500/20 text-emerald-400 text-sm rounded-lg hover:bg-emerald-500/30 transition-colors"
                >
                  + Add Criterion
                </button>
              </div>
              <div className="space-y-2">
                {editedPlan.successCriteria.map((criterion, idx) => (
                  <div key={idx} className="flex items-center gap-2">
                    <span className="w-6 h-6 rounded-full bg-emerald-500/20 text-emerald-400 flex items-center justify-center text-xs font-medium">
                      {idx + 1}
                    </span>
                    <input
                      type="text"
                      value={criterion}
                      onChange={(e) => updateSuccessCriterion(idx, e.target.value)}
                      className="flex-1 px-3 py-1.5 bg-cscx-gray-900 border border-gray-700 rounded text-white text-sm focus:outline-none focus:border-emerald-500"
                    />
                    <button
                      onClick={() => removeSuccessCriterion(idx)}
                      className="text-red-400 hover:text-red-300"
                    >
                      ×
                    </button>
                  </div>
                ))}
                {editedPlan.successCriteria.length === 0 && (
                  <p className="text-sm text-gray-500 italic">No success criteria defined</p>
                )}
              </div>
            </div>

            {/* Identified Risks */}
            <div>
              <div className="flex justify-between items-center mb-2">
                <h4 className="text-sm font-medium text-white">Identified Risks</h4>
                <button
                  onClick={addRisk}
                  className="px-3 py-1.5 bg-red-500/20 text-red-400 text-sm rounded-lg hover:bg-red-500/30 transition-colors"
                >
                  + Add Risk
                </button>
              </div>
              <div className="space-y-2">
                {editedPlan.risks.map((risk, idx) => (
                  <div key={idx} className="flex items-center gap-2">
                    <span className="text-red-400">⚠️</span>
                    <input
                      type="text"
                      value={risk}
                      onChange={(e) => updateRisk(idx, e.target.value)}
                      className="flex-1 px-3 py-1.5 bg-cscx-gray-900 border border-gray-700 rounded text-white text-sm focus:outline-none focus:border-red-500"
                    />
                    <button
                      onClick={() => removeRisk(idx)}
                      className="text-red-400 hover:text-red-300"
                    >
                      ×
                    </button>
                  </div>
                ))}
                {editedPlan.risks.length === 0 && (
                  <p className="text-sm text-gray-500 italic">No risks identified</p>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
