/**
 * CADGTransformationRoadmapPreview - Editable transformation roadmap preview for CADG-generated roadmaps
 * Allows users to review, edit, and approve transformation roadmaps before creating Google Slides
 */

import React, { useState, useMemo } from 'react';
import { useAuth } from '../../context/AuthContext';

// ============================================
// Types
// ============================================

export interface TransformationPhase {
  id: string;
  name: string;
  description: string;
  duration: string;
  startDate: string;
  endDate: string;
  objectives: string[];
  deliverables: string[];
  owner: 'CSM' | 'Customer' | 'Product' | 'Engineering' | 'Sales' | 'Support' | 'Leadership' | 'All';
  status: 'planned' | 'in_progress' | 'completed' | 'at_risk';
  enabled: boolean;
}

export interface TransformationMilestone {
  id: string;
  name: string;
  description: string;
  phaseId: string;
  targetDate: string;
  status: 'planned' | 'in_progress' | 'completed' | 'at_risk';
  owner: string;
  enabled: boolean;
}

export interface TransformationSuccessCriterion {
  id: string;
  criterion: string;
  category: 'adoption' | 'business' | 'technical' | 'operational' | 'strategic';
  measurable: boolean;
  targetValue: string;
  enabled: boolean;
}

export interface TransformationDependency {
  id: string;
  description: string;
  type: 'internal' | 'external' | 'customer' | 'vendor' | 'technical';
  owner: string;
  status: 'resolved' | 'pending' | 'blocked';
  enabled: boolean;
}

export interface TransformationRisk {
  id: string;
  risk: string;
  likelihood: 'high' | 'medium' | 'low';
  impact: 'high' | 'medium' | 'low';
  mitigation: string;
  enabled: boolean;
}

export interface TransformationRoadmapData {
  title: string;
  visionStatement: string;
  createdDate: string;
  timelineStart: string;
  timelineEnd: string;
  totalDuration: string;
  currentState: string;
  targetState: string;
  phases: TransformationPhase[];
  milestones: TransformationMilestone[];
  successCriteria: TransformationSuccessCriterion[];
  dependencies: TransformationDependency[];
  risks: TransformationRisk[];
  keyStakeholders: string[];
  notes: string;
  healthScore: number;
  arr: number;
}

export interface CustomerData {
  id: string | null;
  name: string;
  healthScore?: number;
  arr?: number;
  renewalDate?: string;
}

interface CADGTransformationRoadmapPreviewProps {
  roadmap: TransformationRoadmapData;
  customer: CustomerData;
  onSave: (roadmap: TransformationRoadmapData) => Promise<void>;
  onCancel: () => void;
}

// ============================================
// Options
// ============================================
const PHASE_STATUS_OPTIONS = ['planned', 'in_progress', 'completed', 'at_risk'] as const;
const MILESTONE_STATUS_OPTIONS = ['planned', 'in_progress', 'completed', 'at_risk'] as const;
const OWNER_OPTIONS = ['CSM', 'Customer', 'Product', 'Engineering', 'Sales', 'Support', 'Leadership', 'All'] as const;
const CATEGORY_OPTIONS = ['adoption', 'business', 'technical', 'operational', 'strategic'] as const;
const DEPENDENCY_TYPE_OPTIONS = ['internal', 'external', 'customer', 'vendor', 'technical'] as const;
const DEPENDENCY_STATUS_OPTIONS = ['resolved', 'pending', 'blocked'] as const;
const LIKELIHOOD_OPTIONS = ['high', 'medium', 'low'] as const;

const STATUS_LABELS: Record<string, string> = {
  planned: 'Planned',
  in_progress: 'In Progress',
  completed: 'Completed',
  at_risk: 'At Risk',
};

const STATUS_COLORS: Record<string, string> = {
  planned: 'bg-gray-500/20 text-gray-400 border-gray-500/30',
  in_progress: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
  completed: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30',
  at_risk: 'bg-red-500/20 text-red-400 border-red-500/30',
};

const CATEGORY_LABELS: Record<string, string> = {
  adoption: 'Adoption',
  business: 'Business',
  technical: 'Technical',
  operational: 'Operational',
  strategic: 'Strategic',
};

const CATEGORY_COLORS: Record<string, string> = {
  adoption: 'bg-cyan-500/20 text-cyan-400 border-cyan-500/30',
  business: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30',
  technical: 'bg-purple-500/20 text-purple-400 border-purple-500/30',
  operational: 'bg-amber-500/20 text-amber-400 border-amber-500/30',
  strategic: 'bg-indigo-500/20 text-indigo-400 border-indigo-500/30',
};

const DEPENDENCY_TYPE_LABELS: Record<string, string> = {
  internal: 'Internal',
  external: 'External',
  customer: 'Customer',
  vendor: 'Vendor',
  technical: 'Technical',
};

const DEPENDENCY_TYPE_COLORS: Record<string, string> = {
  internal: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
  external: 'bg-purple-500/20 text-purple-400 border-purple-500/30',
  customer: 'bg-amber-500/20 text-amber-400 border-amber-500/30',
  vendor: 'bg-cyan-500/20 text-cyan-400 border-cyan-500/30',
  technical: 'bg-pink-500/20 text-pink-400 border-pink-500/30',
};

const DEPENDENCY_STATUS_LABELS: Record<string, string> = {
  resolved: 'Resolved',
  pending: 'Pending',
  blocked: 'Blocked',
};

const DEPENDENCY_STATUS_COLORS: Record<string, string> = {
  resolved: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30',
  pending: 'bg-amber-500/20 text-amber-400 border-amber-500/30',
  blocked: 'bg-red-500/20 text-red-400 border-red-500/30',
};

const LIKELIHOOD_LABELS: Record<string, string> = {
  high: 'High',
  medium: 'Medium',
  low: 'Low',
};

const LIKELIHOOD_COLORS: Record<string, string> = {
  high: 'bg-red-500/20 text-red-400 border-red-500/30',
  medium: 'bg-amber-500/20 text-amber-400 border-amber-500/30',
  low: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30',
};

const PHASE_COLORS = [
  'from-emerald-500/20 to-emerald-600/10 border-emerald-500/30',
  'from-blue-500/20 to-blue-600/10 border-blue-500/30',
  'from-purple-500/20 to-purple-600/10 border-purple-500/30',
  'from-amber-500/20 to-amber-600/10 border-amber-500/30',
  'from-cyan-500/20 to-cyan-600/10 border-cyan-500/30',
];

const API_URL = import.meta.env.VITE_API_URL || '';

// ============================================
// Component
// ============================================

export const CADGTransformationRoadmapPreview: React.FC<CADGTransformationRoadmapPreviewProps> = ({
  roadmap,
  customer,
  onSave,
  onCancel,
}) => {
  const { getAuthHeaders } = useAuth();
  const [editedRoadmap, setEditedRoadmap] = useState<TransformationRoadmapData>({ ...roadmap });
  const [activeTab, setActiveTab] = useState<'overview' | 'phases' | 'milestones' | 'criteria' | 'dependencies' | 'risks'>('overview');
  const [expandedPhases, setExpandedPhases] = useState<Set<string>>(new Set([roadmap.phases[0]?.id]));
  const [expandedMilestones, setExpandedMilestones] = useState<Set<string>>(new Set());
  const [expandedRisks, setExpandedRisks] = useState<Set<string>>(new Set());
  const [isSaving, setIsSaving] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);

  // Calculate summary stats
  const enabledPhases = useMemo(() => editedRoadmap.phases.filter(p => p.enabled), [editedRoadmap.phases]);
  const enabledMilestones = useMemo(() => editedRoadmap.milestones.filter(m => m.enabled), [editedRoadmap.milestones]);
  const enabledCriteria = useMemo(() => editedRoadmap.successCriteria.filter(c => c.enabled), [editedRoadmap.successCriteria]);
  const enabledDependencies = useMemo(() => editedRoadmap.dependencies.filter(d => d.enabled), [editedRoadmap.dependencies]);
  const enabledRisks = useMemo(() => editedRoadmap.risks.filter(r => r.enabled), [editedRoadmap.risks]);

  const phasesInProgress = useMemo(() => enabledPhases.filter(p => p.status === 'in_progress').length, [enabledPhases]);
  const phasesCompleted = useMemo(() => enabledPhases.filter(p => p.status === 'completed').length, [enabledPhases]);
  const highRisks = useMemo(() => enabledRisks.filter(r => r.likelihood === 'high' || r.impact === 'high').length, [enabledRisks]);
  const blockedDependencies = useMemo(() => enabledDependencies.filter(d => d.status === 'blocked').length, [enabledDependencies]);

  // Helper to mark changes
  const markChanged = () => {
    if (!hasChanges) setHasChanges(true);
  };

  // ============================================
  // Phase Handlers
  // ============================================
  const togglePhaseEnabled = (phaseId: string) => {
    setEditedRoadmap(prev => ({
      ...prev,
      phases: prev.phases.map(p => p.id === phaseId ? { ...p, enabled: !p.enabled } : p),
    }));
    markChanged();
  };

  const togglePhaseExpanded = (phaseId: string) => {
    setExpandedPhases(prev => {
      const next = new Set(prev);
      if (next.has(phaseId)) {
        next.delete(phaseId);
      } else {
        next.add(phaseId);
      }
      return next;
    });
  };

  const updatePhase = (phaseId: string, field: keyof TransformationPhase, value: any) => {
    setEditedRoadmap(prev => ({
      ...prev,
      phases: prev.phases.map(p => p.id === phaseId ? { ...p, [field]: value } : p),
    }));
    markChanged();
  };

  const addPhaseObjective = (phaseId: string) => {
    setEditedRoadmap(prev => ({
      ...prev,
      phases: prev.phases.map(p => p.id === phaseId ? { ...p, objectives: [...p.objectives, 'New objective'] } : p),
    }));
    markChanged();
  };

  const removePhaseObjective = (phaseId: string, idx: number) => {
    setEditedRoadmap(prev => ({
      ...prev,
      phases: prev.phases.map(p => p.id === phaseId ? { ...p, objectives: p.objectives.filter((_, i) => i !== idx) } : p),
    }));
    markChanged();
  };

  const updatePhaseObjective = (phaseId: string, idx: number, value: string) => {
    setEditedRoadmap(prev => ({
      ...prev,
      phases: prev.phases.map(p => p.id === phaseId ? { ...p, objectives: p.objectives.map((obj, i) => i === idx ? value : obj) } : p),
    }));
    markChanged();
  };

  const addPhaseDeliverable = (phaseId: string) => {
    setEditedRoadmap(prev => ({
      ...prev,
      phases: prev.phases.map(p => p.id === phaseId ? { ...p, deliverables: [...p.deliverables, 'New deliverable'] } : p),
    }));
    markChanged();
  };

  const removePhaseDeliverable = (phaseId: string, idx: number) => {
    setEditedRoadmap(prev => ({
      ...prev,
      phases: prev.phases.map(p => p.id === phaseId ? { ...p, deliverables: p.deliverables.filter((_, i) => i !== idx) } : p),
    }));
    markChanged();
  };

  const updatePhaseDeliverable = (phaseId: string, idx: number, value: string) => {
    setEditedRoadmap(prev => ({
      ...prev,
      phases: prev.phases.map(p => p.id === phaseId ? { ...p, deliverables: p.deliverables.map((del, i) => i === idx ? value : del) } : p),
    }));
    markChanged();
  };

  const addPhase = () => {
    const newId = `phase-${Date.now()}`;
    const lastPhase = editedRoadmap.phases[editedRoadmap.phases.length - 1];
    const newStartDate = lastPhase?.endDate || editedRoadmap.timelineStart;
    const endDate = new Date(newStartDate);
    endDate.setMonth(endDate.getMonth() + 3);

    setEditedRoadmap(prev => ({
      ...prev,
      phases: [...prev.phases, {
        id: newId,
        name: 'New Phase',
        description: '',
        duration: '3 months',
        startDate: newStartDate,
        endDate: endDate.toISOString().slice(0, 10),
        objectives: [],
        deliverables: [],
        owner: 'CSM',
        status: 'planned',
        enabled: true,
      }],
    }));
    setExpandedPhases(prev => new Set(prev).add(newId));
    markChanged();
  };

  const removePhase = (phaseId: string) => {
    setEditedRoadmap(prev => ({
      ...prev,
      phases: prev.phases.filter(p => p.id !== phaseId),
      milestones: prev.milestones.map(m => m.phaseId === phaseId ? { ...m, phaseId: prev.phases[0]?.id || '' } : m),
    }));
    markChanged();
  };

  // ============================================
  // Milestone Handlers
  // ============================================
  const toggleMilestoneEnabled = (milestoneId: string) => {
    setEditedRoadmap(prev => ({
      ...prev,
      milestones: prev.milestones.map(m => m.id === milestoneId ? { ...m, enabled: !m.enabled } : m),
    }));
    markChanged();
  };

  const toggleMilestoneExpanded = (milestoneId: string) => {
    setExpandedMilestones(prev => {
      const next = new Set(prev);
      if (next.has(milestoneId)) {
        next.delete(milestoneId);
      } else {
        next.add(milestoneId);
      }
      return next;
    });
  };

  const updateMilestone = (milestoneId: string, field: keyof TransformationMilestone, value: any) => {
    setEditedRoadmap(prev => ({
      ...prev,
      milestones: prev.milestones.map(m => m.id === milestoneId ? { ...m, [field]: value } : m),
    }));
    markChanged();
  };

  const addMilestone = () => {
    const newId = `milestone-${Date.now()}`;
    setEditedRoadmap(prev => ({
      ...prev,
      milestones: [...prev.milestones, {
        id: newId,
        name: 'New Milestone',
        description: '',
        phaseId: prev.phases[0]?.id || '',
        targetDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10),
        status: 'planned',
        owner: 'CSM',
        enabled: true,
      }],
    }));
    setExpandedMilestones(prev => new Set(prev).add(newId));
    markChanged();
  };

  const removeMilestone = (milestoneId: string) => {
    setEditedRoadmap(prev => ({
      ...prev,
      milestones: prev.milestones.filter(m => m.id !== milestoneId),
    }));
    markChanged();
  };

  // ============================================
  // Success Criteria Handlers
  // ============================================
  const toggleCriterionEnabled = (criterionId: string) => {
    setEditedRoadmap(prev => ({
      ...prev,
      successCriteria: prev.successCriteria.map(c => c.id === criterionId ? { ...c, enabled: !c.enabled } : c),
    }));
    markChanged();
  };

  const updateCriterion = (criterionId: string, field: keyof TransformationSuccessCriterion, value: any) => {
    setEditedRoadmap(prev => ({
      ...prev,
      successCriteria: prev.successCriteria.map(c => c.id === criterionId ? { ...c, [field]: value } : c),
    }));
    markChanged();
  };

  const addCriterion = () => {
    const newId = `criterion-${Date.now()}`;
    setEditedRoadmap(prev => ({
      ...prev,
      successCriteria: [...prev.successCriteria, {
        id: newId,
        criterion: 'New success criterion',
        category: 'business',
        measurable: true,
        targetValue: 'TBD',
        enabled: true,
      }],
    }));
    markChanged();
  };

  const removeCriterion = (criterionId: string) => {
    setEditedRoadmap(prev => ({
      ...prev,
      successCriteria: prev.successCriteria.filter(c => c.id !== criterionId),
    }));
    markChanged();
  };

  // ============================================
  // Dependency Handlers
  // ============================================
  const toggleDependencyEnabled = (dependencyId: string) => {
    setEditedRoadmap(prev => ({
      ...prev,
      dependencies: prev.dependencies.map(d => d.id === dependencyId ? { ...d, enabled: !d.enabled } : d),
    }));
    markChanged();
  };

  const updateDependency = (dependencyId: string, field: keyof TransformationDependency, value: any) => {
    setEditedRoadmap(prev => ({
      ...prev,
      dependencies: prev.dependencies.map(d => d.id === dependencyId ? { ...d, [field]: value } : d),
    }));
    markChanged();
  };

  const addDependency = () => {
    const newId = `dependency-${Date.now()}`;
    setEditedRoadmap(prev => ({
      ...prev,
      dependencies: [...prev.dependencies, {
        id: newId,
        description: 'New dependency',
        type: 'internal',
        owner: 'TBD',
        status: 'pending',
        enabled: true,
      }],
    }));
    markChanged();
  };

  const removeDependency = (dependencyId: string) => {
    setEditedRoadmap(prev => ({
      ...prev,
      dependencies: prev.dependencies.filter(d => d.id !== dependencyId),
    }));
    markChanged();
  };

  // ============================================
  // Risk Handlers
  // ============================================
  const toggleRiskEnabled = (riskId: string) => {
    setEditedRoadmap(prev => ({
      ...prev,
      risks: prev.risks.map(r => r.id === riskId ? { ...r, enabled: !r.enabled } : r),
    }));
    markChanged();
  };

  const toggleRiskExpanded = (riskId: string) => {
    setExpandedRisks(prev => {
      const next = new Set(prev);
      if (next.has(riskId)) {
        next.delete(riskId);
      } else {
        next.add(riskId);
      }
      return next;
    });
  };

  const updateRisk = (riskId: string, field: keyof TransformationRisk, value: any) => {
    setEditedRoadmap(prev => ({
      ...prev,
      risks: prev.risks.map(r => r.id === riskId ? { ...r, [field]: value } : r),
    }));
    markChanged();
  };

  const addRisk = () => {
    const newId = `risk-${Date.now()}`;
    setEditedRoadmap(prev => ({
      ...prev,
      risks: [...prev.risks, {
        id: newId,
        risk: 'New risk',
        likelihood: 'medium',
        impact: 'medium',
        mitigation: '',
        enabled: true,
      }],
    }));
    setExpandedRisks(prev => new Set(prev).add(newId));
    markChanged();
  };

  const removeRisk = (riskId: string) => {
    setEditedRoadmap(prev => ({
      ...prev,
      risks: prev.risks.filter(r => r.id !== riskId),
    }));
    markChanged();
  };

  // ============================================
  // Stakeholder Handlers
  // ============================================
  const addStakeholder = () => {
    setEditedRoadmap(prev => ({
      ...prev,
      keyStakeholders: [...prev.keyStakeholders, 'New Stakeholder'],
    }));
    markChanged();
  };

  const updateStakeholder = (idx: number, value: string) => {
    setEditedRoadmap(prev => ({
      ...prev,
      keyStakeholders: prev.keyStakeholders.map((s, i) => i === idx ? value : s),
    }));
    markChanged();
  };

  const removeStakeholder = (idx: number) => {
    setEditedRoadmap(prev => ({
      ...prev,
      keyStakeholders: prev.keyStakeholders.filter((_, i) => i !== idx),
    }));
    markChanged();
  };

  // ============================================
  // Save Handler
  // ============================================
  const handleSave = async () => {
    setIsSaving(true);
    try {
      await onSave(editedRoadmap);
    } finally {
      setIsSaving(false);
    }
  };

  const handleCancel = () => {
    if (hasChanges) {
      const confirmed = window.confirm('You have unsaved changes. Are you sure you want to cancel?');
      if (!confirmed) return;
    }
    onCancel();
  };

  // ============================================
  // Render
  // ============================================
  return (
    <div className="bg-cscx-gray-800 rounded-lg overflow-hidden flex flex-col max-h-[80vh]">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-gradient-to-r from-violet-500/20 to-purple-500/20 border-b border-violet-500/30 p-4">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-violet-500/20 flex items-center justify-center">
              <span className="text-xl">🗺️</span>
            </div>
            <div>
              <input
                type="text"
                value={editedRoadmap.title}
                onChange={(e) => {
                  setEditedRoadmap(prev => ({ ...prev, title: e.target.value }));
                  markChanged();
                }}
                className="bg-transparent text-lg font-semibold text-white border-b border-transparent hover:border-violet-500/50 focus:border-violet-500 focus:outline-none px-1 -ml-1"
              />
              <div className="text-sm text-gray-400 flex items-center gap-2 mt-1">
                <span>{customer.name}</span>
                <span className="text-gray-600">•</span>
                <span>{editedRoadmap.totalDuration}</span>
                <span className="text-gray-600">•</span>
                <span>{editedRoadmap.timelineStart} to {editedRoadmap.timelineEnd}</span>
              </div>
            </div>
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
              className="px-4 py-1.5 bg-violet-500 hover:bg-violet-600 text-white text-sm font-medium rounded-lg transition-colors disabled:opacity-50 flex items-center gap-2"
            >
              {isSaving ? (
                <>
                  <span className="animate-spin">⏳</span>
                  Saving...
                </>
              ) : (
                <>
                  <span>💾</span>
                  Create Roadmap
                </>
              )}
            </button>
          </div>
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-5 gap-3">
          <div className="bg-cscx-gray-900/50 rounded-lg p-3 border border-violet-500/20">
            <div className="text-xs text-gray-400 mb-1">Phases</div>
            <div className="text-xl font-bold text-violet-400">{enabledPhases.length}</div>
            <div className="text-xs text-gray-500">{phasesCompleted} completed</div>
          </div>
          <div className="bg-cscx-gray-900/50 rounded-lg p-3 border border-violet-500/20">
            <div className="text-xs text-gray-400 mb-1">Milestones</div>
            <div className="text-xl font-bold text-violet-400">{enabledMilestones.length}</div>
            <div className="text-xs text-gray-500">{enabledMilestones.filter(m => m.status === 'completed').length} completed</div>
          </div>
          <div className="bg-cscx-gray-900/50 rounded-lg p-3 border border-violet-500/20">
            <div className="text-xs text-gray-400 mb-1">Success Criteria</div>
            <div className="text-xl font-bold text-violet-400">{enabledCriteria.length}</div>
            <div className="text-xs text-gray-500">{enabledCriteria.filter(c => c.measurable).length} measurable</div>
          </div>
          <div className="bg-cscx-gray-900/50 rounded-lg p-3 border border-violet-500/20">
            <div className="text-xs text-gray-400 mb-1">Dependencies</div>
            <div className="text-xl font-bold text-violet-400">{enabledDependencies.length}</div>
            <div className="text-xs text-gray-500">{blockedDependencies > 0 ? <span className="text-red-400">{blockedDependencies} blocked</span> : <span className="text-emerald-400">None blocked</span>}</div>
          </div>
          <div className="bg-cscx-gray-900/50 rounded-lg p-3 border border-violet-500/20">
            <div className="text-xs text-gray-400 mb-1">Risks</div>
            <div className="text-xl font-bold text-violet-400">{enabledRisks.length}</div>
            <div className="text-xs text-gray-500">{highRisks > 0 ? <span className="text-red-400">{highRisks} high</span> : <span className="text-emerald-400">None high</span>}</div>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="border-b border-cscx-gray-700 px-4">
        <div className="flex gap-1">
          {[
            { id: 'overview', label: 'Overview', icon: '📋' },
            { id: 'phases', label: 'Phases', icon: '🔄', count: enabledPhases.length },
            { id: 'milestones', label: 'Milestones', icon: '🎯', count: enabledMilestones.length },
            { id: 'criteria', label: 'Criteria', icon: '✅', count: enabledCriteria.length },
            { id: 'dependencies', label: 'Dependencies', icon: '🔗', count: enabledDependencies.length },
            { id: 'risks', label: 'Risks', icon: '⚠️', count: enabledRisks.length },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as typeof activeTab)}
              className={`px-4 py-3 text-sm font-medium transition-colors relative flex items-center gap-2 ${
                activeTab === tab.id
                  ? 'text-violet-400'
                  : 'text-gray-400 hover:text-gray-300'
              }`}
            >
              <span>{tab.icon}</span>
              <span>{tab.label}</span>
              {tab.count !== undefined && (
                <span className={`text-xs px-1.5 py-0.5 rounded-full ${
                  activeTab === tab.id ? 'bg-violet-500/20 text-violet-400' : 'bg-gray-700 text-gray-400'
                }`}>
                  {tab.count}
                </span>
              )}
              {activeTab === tab.id && (
                <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-violet-500" />
              )}
            </button>
          ))}
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-4">
        {/* Overview Tab */}
        {activeTab === 'overview' && (
          <div className="space-y-6">
            {/* Vision Statement */}
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">Vision Statement</label>
              <textarea
                value={editedRoadmap.visionStatement}
                onChange={(e) => {
                  setEditedRoadmap(prev => ({ ...prev, visionStatement: e.target.value }));
                  markChanged();
                }}
                rows={3}
                className="w-full bg-cscx-gray-900 border border-cscx-gray-700 rounded-lg px-4 py-3 text-white focus:border-violet-500 focus:outline-none resize-none"
                placeholder="Describe the transformation vision..."
              />
            </div>

            {/* Current & Target State */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">Current State</label>
                <textarea
                  value={editedRoadmap.currentState}
                  onChange={(e) => {
                    setEditedRoadmap(prev => ({ ...prev, currentState: e.target.value }));
                    markChanged();
                  }}
                  rows={4}
                  className="w-full bg-cscx-gray-900 border border-cscx-gray-700 rounded-lg px-4 py-3 text-white focus:border-violet-500 focus:outline-none resize-none"
                  placeholder="Describe where they are now..."
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">Target State</label>
                <textarea
                  value={editedRoadmap.targetState}
                  onChange={(e) => {
                    setEditedRoadmap(prev => ({ ...prev, targetState: e.target.value }));
                    markChanged();
                  }}
                  rows={4}
                  className="w-full bg-cscx-gray-900 border border-cscx-gray-700 rounded-lg px-4 py-3 text-white focus:border-violet-500 focus:outline-none resize-none"
                  placeholder="Describe where they want to be..."
                />
              </div>
            </div>

            {/* Key Stakeholders */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="block text-sm font-medium text-gray-300">Key Stakeholders</label>
                <button
                  onClick={addStakeholder}
                  className="text-xs text-violet-400 hover:text-violet-300"
                >
                  + Add Stakeholder
                </button>
              </div>
              <div className="space-y-2">
                {editedRoadmap.keyStakeholders.map((stakeholder, idx) => (
                  <div key={idx} className="flex items-center gap-2">
                    <span className="text-gray-500 text-sm">{idx + 1}.</span>
                    <input
                      type="text"
                      value={stakeholder}
                      onChange={(e) => updateStakeholder(idx, e.target.value)}
                      className="flex-1 bg-cscx-gray-900 border border-cscx-gray-700 rounded px-3 py-2 text-sm text-white focus:border-violet-500 focus:outline-none"
                    />
                    <button
                      onClick={() => removeStakeholder(idx)}
                      className="text-gray-500 hover:text-red-400"
                    >
                      ×
                    </button>
                  </div>
                ))}
              </div>
            </div>

            {/* Notes */}
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">Internal Notes</label>
              <textarea
                value={editedRoadmap.notes}
                onChange={(e) => {
                  setEditedRoadmap(prev => ({ ...prev, notes: e.target.value }));
                  markChanged();
                }}
                rows={3}
                className="w-full bg-cscx-gray-900 border border-cscx-gray-700 rounded-lg px-4 py-3 text-white focus:border-violet-500 focus:outline-none resize-none"
                placeholder="Add any internal notes..."
              />
            </div>
          </div>
        )}

        {/* Phases Tab */}
        {activeTab === 'phases' && (
          <div className="space-y-4">
            <div className="flex justify-end">
              <button
                onClick={addPhase}
                className="text-sm text-violet-400 hover:text-violet-300 flex items-center gap-1"
              >
                <span>+</span> Add Phase
              </button>
            </div>

            {editedRoadmap.phases.map((phase, idx) => (
              <div
                key={phase.id}
                className={`rounded-lg border overflow-hidden transition-all ${
                  phase.enabled
                    ? `bg-gradient-to-r ${PHASE_COLORS[idx % PHASE_COLORS.length]}`
                    : 'bg-cscx-gray-900/50 border-gray-700 opacity-60'
                }`}
              >
                {/* Phase Header */}
                <div
                  className="flex items-center gap-3 p-4 cursor-pointer"
                  onClick={() => togglePhaseExpanded(phase.id)}
                >
                  <input
                    type="checkbox"
                    checked={phase.enabled}
                    onChange={(e) => {
                      e.stopPropagation();
                      togglePhaseEnabled(phase.id);
                    }}
                    className="w-4 h-4 rounded accent-violet-500"
                  />
                  <div className="w-8 h-8 rounded-full bg-cscx-gray-900/50 flex items-center justify-center text-sm font-bold text-white">
                    {idx + 1}
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <input
                        type="text"
                        value={phase.name}
                        onChange={(e) => {
                          e.stopPropagation();
                          updatePhase(phase.id, 'name', e.target.value);
                        }}
                        onClick={(e) => e.stopPropagation()}
                        className="bg-transparent font-medium text-white border-b border-transparent hover:border-violet-500/50 focus:border-violet-500 focus:outline-none"
                      />
                      <span className={`text-xs px-2 py-0.5 rounded-full border ${STATUS_COLORS[phase.status]}`}>
                        {STATUS_LABELS[phase.status]}
                      </span>
                    </div>
                    <div className="text-xs text-gray-400 mt-1">
                      {phase.duration} • {phase.startDate} to {phase.endDate} • Owner: {phase.owner}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        removePhase(phase.id);
                      }}
                      className="text-gray-500 hover:text-red-400 p-1"
                    >
                      🗑️
                    </button>
                    <span className={`transform transition-transform ${expandedPhases.has(phase.id) ? 'rotate-180' : ''}`}>
                      ▼
                    </span>
                  </div>
                </div>

                {/* Phase Content */}
                {expandedPhases.has(phase.id) && (
                  <div className="px-4 pb-4 space-y-4 border-t border-white/10">
                    {/* Description */}
                    <div className="pt-4">
                      <label className="block text-xs text-gray-400 mb-1">Description</label>
                      <textarea
                        value={phase.description}
                        onChange={(e) => updatePhase(phase.id, 'description', e.target.value)}
                        rows={2}
                        className="w-full bg-cscx-gray-900/50 border border-cscx-gray-700 rounded px-3 py-2 text-sm text-white focus:border-violet-500 focus:outline-none resize-none"
                      />
                    </div>

                    {/* Timeline & Status */}
                    <div className="grid grid-cols-4 gap-3">
                      <div>
                        <label className="block text-xs text-gray-400 mb-1">Start Date</label>
                        <input
                          type="date"
                          value={phase.startDate}
                          onChange={(e) => updatePhase(phase.id, 'startDate', e.target.value)}
                          className="w-full bg-cscx-gray-900/50 border border-cscx-gray-700 rounded px-3 py-2 text-sm text-white focus:border-violet-500 focus:outline-none"
                        />
                      </div>
                      <div>
                        <label className="block text-xs text-gray-400 mb-1">End Date</label>
                        <input
                          type="date"
                          value={phase.endDate}
                          onChange={(e) => updatePhase(phase.id, 'endDate', e.target.value)}
                          className="w-full bg-cscx-gray-900/50 border border-cscx-gray-700 rounded px-3 py-2 text-sm text-white focus:border-violet-500 focus:outline-none"
                        />
                      </div>
                      <div>
                        <label className="block text-xs text-gray-400 mb-1">Status</label>
                        <select
                          value={phase.status}
                          onChange={(e) => updatePhase(phase.id, 'status', e.target.value)}
                          className="w-full bg-cscx-gray-900/50 border border-cscx-gray-700 rounded px-3 py-2 text-sm text-white focus:border-violet-500 focus:outline-none"
                        >
                          {PHASE_STATUS_OPTIONS.map((status) => (
                            <option key={status} value={status}>{STATUS_LABELS[status]}</option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <label className="block text-xs text-gray-400 mb-1">Owner</label>
                        <select
                          value={phase.owner}
                          onChange={(e) => updatePhase(phase.id, 'owner', e.target.value)}
                          className="w-full bg-cscx-gray-900/50 border border-cscx-gray-700 rounded px-3 py-2 text-sm text-white focus:border-violet-500 focus:outline-none"
                        >
                          {OWNER_OPTIONS.map((owner) => (
                            <option key={owner} value={owner}>{owner}</option>
                          ))}
                        </select>
                      </div>
                    </div>

                    {/* Objectives */}
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <label className="block text-xs text-gray-400">Objectives</label>
                        <button
                          onClick={() => addPhaseObjective(phase.id)}
                          className="text-xs text-violet-400 hover:text-violet-300"
                        >
                          + Add
                        </button>
                      </div>
                      <div className="space-y-2">
                        {phase.objectives.map((obj, objIdx) => (
                          <div key={objIdx} className="flex items-center gap-2">
                            <span className="text-gray-500 text-xs">•</span>
                            <input
                              type="text"
                              value={obj}
                              onChange={(e) => updatePhaseObjective(phase.id, objIdx, e.target.value)}
                              className="flex-1 bg-cscx-gray-900/50 border border-cscx-gray-700 rounded px-3 py-1.5 text-xs text-white focus:border-violet-500 focus:outline-none"
                            />
                            <button
                              onClick={() => removePhaseObjective(phase.id, objIdx)}
                              className="text-gray-500 hover:text-red-400 text-xs"
                            >
                              ×
                            </button>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Deliverables */}
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <label className="block text-xs text-gray-400">Deliverables</label>
                        <button
                          onClick={() => addPhaseDeliverable(phase.id)}
                          className="text-xs text-violet-400 hover:text-violet-300"
                        >
                          + Add
                        </button>
                      </div>
                      <div className="space-y-2">
                        {phase.deliverables.map((del, delIdx) => (
                          <div key={delIdx} className="flex items-center gap-2">
                            <span className="text-gray-500 text-xs">📦</span>
                            <input
                              type="text"
                              value={del}
                              onChange={(e) => updatePhaseDeliverable(phase.id, delIdx, e.target.value)}
                              className="flex-1 bg-cscx-gray-900/50 border border-cscx-gray-700 rounded px-3 py-1.5 text-xs text-white focus:border-violet-500 focus:outline-none"
                            />
                            <button
                              onClick={() => removePhaseDeliverable(phase.id, delIdx)}
                              className="text-gray-500 hover:text-red-400 text-xs"
                            >
                              ×
                            </button>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        {/* Milestones Tab */}
        {activeTab === 'milestones' && (
          <div className="space-y-4">
            <div className="flex justify-end">
              <button
                onClick={addMilestone}
                className="text-sm text-violet-400 hover:text-violet-300 flex items-center gap-1"
              >
                <span>+</span> Add Milestone
              </button>
            </div>

            {editedRoadmap.milestones.map((milestone, idx) => {
              const phase = editedRoadmap.phases.find(p => p.id === milestone.phaseId);
              return (
                <div
                  key={milestone.id}
                  className={`rounded-lg border overflow-hidden transition-all ${
                    milestone.enabled
                      ? 'bg-cscx-gray-900/50 border-violet-500/30'
                      : 'bg-cscx-gray-900/30 border-gray-700 opacity-60'
                  }`}
                >
                  {/* Milestone Header */}
                  <div
                    className="flex items-center gap-3 p-4 cursor-pointer"
                    onClick={() => toggleMilestoneExpanded(milestone.id)}
                  >
                    <input
                      type="checkbox"
                      checked={milestone.enabled}
                      onChange={(e) => {
                        e.stopPropagation();
                        toggleMilestoneEnabled(milestone.id);
                      }}
                      className="w-4 h-4 rounded accent-violet-500"
                    />
                    <div className="w-6 h-6 rounded-full bg-violet-500/20 flex items-center justify-center text-xs font-bold text-violet-400">
                      {idx + 1}
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <input
                          type="text"
                          value={milestone.name}
                          onChange={(e) => {
                            e.stopPropagation();
                            updateMilestone(milestone.id, 'name', e.target.value);
                          }}
                          onClick={(e) => e.stopPropagation()}
                          className="bg-transparent font-medium text-white border-b border-transparent hover:border-violet-500/50 focus:border-violet-500 focus:outline-none"
                        />
                        <span className={`text-xs px-2 py-0.5 rounded-full border ${STATUS_COLORS[milestone.status]}`}>
                          {STATUS_LABELS[milestone.status]}
                        </span>
                      </div>
                      <div className="text-xs text-gray-400 mt-1">
                        {milestone.targetDate} • Phase: {phase?.name || 'N/A'} • Owner: {milestone.owner}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          removeMilestone(milestone.id);
                        }}
                        className="text-gray-500 hover:text-red-400 p-1"
                      >
                        🗑️
                      </button>
                      <span className={`transform transition-transform ${expandedMilestones.has(milestone.id) ? 'rotate-180' : ''}`}>
                        ▼
                      </span>
                    </div>
                  </div>

                  {/* Milestone Content */}
                  {expandedMilestones.has(milestone.id) && (
                    <div className="px-4 pb-4 space-y-3 border-t border-violet-500/20">
                      <div className="pt-3">
                        <label className="block text-xs text-gray-400 mb-1">Description</label>
                        <textarea
                          value={milestone.description}
                          onChange={(e) => updateMilestone(milestone.id, 'description', e.target.value)}
                          rows={2}
                          className="w-full bg-cscx-gray-900/50 border border-cscx-gray-700 rounded px-3 py-2 text-sm text-white focus:border-violet-500 focus:outline-none resize-none"
                        />
                      </div>
                      <div className="grid grid-cols-4 gap-3">
                        <div>
                          <label className="block text-xs text-gray-400 mb-1">Target Date</label>
                          <input
                            type="date"
                            value={milestone.targetDate}
                            onChange={(e) => updateMilestone(milestone.id, 'targetDate', e.target.value)}
                            className="w-full bg-cscx-gray-900/50 border border-cscx-gray-700 rounded px-3 py-2 text-sm text-white focus:border-violet-500 focus:outline-none"
                          />
                        </div>
                        <div>
                          <label className="block text-xs text-gray-400 mb-1">Phase</label>
                          <select
                            value={milestone.phaseId}
                            onChange={(e) => updateMilestone(milestone.id, 'phaseId', e.target.value)}
                            className="w-full bg-cscx-gray-900/50 border border-cscx-gray-700 rounded px-3 py-2 text-sm text-white focus:border-violet-500 focus:outline-none"
                          >
                            {editedRoadmap.phases.map((p) => (
                              <option key={p.id} value={p.id}>{p.name}</option>
                            ))}
                          </select>
                        </div>
                        <div>
                          <label className="block text-xs text-gray-400 mb-1">Status</label>
                          <select
                            value={milestone.status}
                            onChange={(e) => updateMilestone(milestone.id, 'status', e.target.value)}
                            className="w-full bg-cscx-gray-900/50 border border-cscx-gray-700 rounded px-3 py-2 text-sm text-white focus:border-violet-500 focus:outline-none"
                          >
                            {MILESTONE_STATUS_OPTIONS.map((status) => (
                              <option key={status} value={status}>{STATUS_LABELS[status]}</option>
                            ))}
                          </select>
                        </div>
                        <div>
                          <label className="block text-xs text-gray-400 mb-1">Owner</label>
                          <input
                            type="text"
                            value={milestone.owner}
                            onChange={(e) => updateMilestone(milestone.id, 'owner', e.target.value)}
                            className="w-full bg-cscx-gray-900/50 border border-cscx-gray-700 rounded px-3 py-2 text-sm text-white focus:border-violet-500 focus:outline-none"
                          />
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {/* Success Criteria Tab */}
        {activeTab === 'criteria' && (
          <div className="space-y-4">
            <div className="flex justify-end">
              <button
                onClick={addCriterion}
                className="text-sm text-violet-400 hover:text-violet-300 flex items-center gap-1"
              >
                <span>+</span> Add Criterion
              </button>
            </div>

            {editedRoadmap.successCriteria.map((criterion) => (
              <div
                key={criterion.id}
                className={`rounded-lg border p-4 transition-all ${
                  criterion.enabled
                    ? 'bg-cscx-gray-900/50 border-violet-500/30'
                    : 'bg-cscx-gray-900/30 border-gray-700 opacity-60'
                }`}
              >
                <div className="flex items-start gap-3">
                  <input
                    type="checkbox"
                    checked={criterion.enabled}
                    onChange={() => toggleCriterionEnabled(criterion.id)}
                    className="w-4 h-4 rounded accent-violet-500 mt-1"
                  />
                  <div className="flex-1 space-y-3">
                    <div className="flex items-center gap-2">
                      <input
                        type="text"
                        value={criterion.criterion}
                        onChange={(e) => updateCriterion(criterion.id, 'criterion', e.target.value)}
                        className="flex-1 bg-transparent font-medium text-white border-b border-transparent hover:border-violet-500/50 focus:border-violet-500 focus:outline-none"
                      />
                      <span className={`text-xs px-2 py-0.5 rounded-full border ${CATEGORY_COLORS[criterion.category]}`}>
                        {CATEGORY_LABELS[criterion.category]}
                      </span>
                    </div>
                    <div className="grid grid-cols-3 gap-3">
                      <div>
                        <label className="block text-xs text-gray-400 mb-1">Category</label>
                        <select
                          value={criterion.category}
                          onChange={(e) => updateCriterion(criterion.id, 'category', e.target.value)}
                          className="w-full bg-cscx-gray-900/50 border border-cscx-gray-700 rounded px-3 py-2 text-sm text-white focus:border-violet-500 focus:outline-none"
                        >
                          {CATEGORY_OPTIONS.map((cat) => (
                            <option key={cat} value={cat}>{CATEGORY_LABELS[cat]}</option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <label className="block text-xs text-gray-400 mb-1">Target Value</label>
                        <input
                          type="text"
                          value={criterion.targetValue}
                          onChange={(e) => updateCriterion(criterion.id, 'targetValue', e.target.value)}
                          className="w-full bg-cscx-gray-900/50 border border-cscx-gray-700 rounded px-3 py-2 text-sm text-white focus:border-violet-500 focus:outline-none"
                        />
                      </div>
                      <div>
                        <label className="block text-xs text-gray-400 mb-1">Measurable</label>
                        <button
                          onClick={() => updateCriterion(criterion.id, 'measurable', !criterion.measurable)}
                          className={`w-full px-3 py-2 rounded text-sm font-medium transition-colors ${
                            criterion.measurable
                              ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                              : 'bg-gray-700 text-gray-400 border border-gray-600'
                          }`}
                        >
                          {criterion.measurable ? '✓ Measurable' : 'Not Measurable'}
                        </button>
                      </div>
                    </div>
                  </div>
                  <button
                    onClick={() => removeCriterion(criterion.id)}
                    className="text-gray-500 hover:text-red-400"
                  >
                    🗑️
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Dependencies Tab */}
        {activeTab === 'dependencies' && (
          <div className="space-y-4">
            <div className="flex justify-end">
              <button
                onClick={addDependency}
                className="text-sm text-violet-400 hover:text-violet-300 flex items-center gap-1"
              >
                <span>+</span> Add Dependency
              </button>
            </div>

            {editedRoadmap.dependencies.map((dependency) => (
              <div
                key={dependency.id}
                className={`rounded-lg border p-4 transition-all ${
                  dependency.enabled
                    ? 'bg-cscx-gray-900/50 border-violet-500/30'
                    : 'bg-cscx-gray-900/30 border-gray-700 opacity-60'
                }`}
              >
                <div className="flex items-start gap-3">
                  <input
                    type="checkbox"
                    checked={dependency.enabled}
                    onChange={() => toggleDependencyEnabled(dependency.id)}
                    className="w-4 h-4 rounded accent-violet-500 mt-1"
                  />
                  <div className="flex-1 space-y-3">
                    <div className="flex items-center gap-2">
                      <input
                        type="text"
                        value={dependency.description}
                        onChange={(e) => updateDependency(dependency.id, 'description', e.target.value)}
                        className="flex-1 bg-transparent font-medium text-white border-b border-transparent hover:border-violet-500/50 focus:border-violet-500 focus:outline-none"
                      />
                      <span className={`text-xs px-2 py-0.5 rounded-full border ${DEPENDENCY_TYPE_COLORS[dependency.type]}`}>
                        {DEPENDENCY_TYPE_LABELS[dependency.type]}
                      </span>
                      <span className={`text-xs px-2 py-0.5 rounded-full border ${DEPENDENCY_STATUS_COLORS[dependency.status]}`}>
                        {DEPENDENCY_STATUS_LABELS[dependency.status]}
                      </span>
                    </div>
                    <div className="grid grid-cols-3 gap-3">
                      <div>
                        <label className="block text-xs text-gray-400 mb-1">Type</label>
                        <select
                          value={dependency.type}
                          onChange={(e) => updateDependency(dependency.id, 'type', e.target.value)}
                          className="w-full bg-cscx-gray-900/50 border border-cscx-gray-700 rounded px-3 py-2 text-sm text-white focus:border-violet-500 focus:outline-none"
                        >
                          {DEPENDENCY_TYPE_OPTIONS.map((type) => (
                            <option key={type} value={type}>{DEPENDENCY_TYPE_LABELS[type]}</option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <label className="block text-xs text-gray-400 mb-1">Owner</label>
                        <input
                          type="text"
                          value={dependency.owner}
                          onChange={(e) => updateDependency(dependency.id, 'owner', e.target.value)}
                          className="w-full bg-cscx-gray-900/50 border border-cscx-gray-700 rounded px-3 py-2 text-sm text-white focus:border-violet-500 focus:outline-none"
                        />
                      </div>
                      <div>
                        <label className="block text-xs text-gray-400 mb-1">Status</label>
                        <select
                          value={dependency.status}
                          onChange={(e) => updateDependency(dependency.id, 'status', e.target.value)}
                          className="w-full bg-cscx-gray-900/50 border border-cscx-gray-700 rounded px-3 py-2 text-sm text-white focus:border-violet-500 focus:outline-none"
                        >
                          {DEPENDENCY_STATUS_OPTIONS.map((status) => (
                            <option key={status} value={status}>{DEPENDENCY_STATUS_LABELS[status]}</option>
                          ))}
                        </select>
                      </div>
                    </div>
                  </div>
                  <button
                    onClick={() => removeDependency(dependency.id)}
                    className="text-gray-500 hover:text-red-400"
                  >
                    🗑️
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Risks Tab */}
        {activeTab === 'risks' && (
          <div className="space-y-4">
            <div className="flex justify-end">
              <button
                onClick={addRisk}
                className="text-sm text-violet-400 hover:text-violet-300 flex items-center gap-1"
              >
                <span>+</span> Add Risk
              </button>
            </div>

            {editedRoadmap.risks.map((risk) => (
              <div
                key={risk.id}
                className={`rounded-lg border overflow-hidden transition-all ${
                  risk.enabled
                    ? 'bg-cscx-gray-900/50 border-violet-500/30'
                    : 'bg-cscx-gray-900/30 border-gray-700 opacity-60'
                }`}
              >
                {/* Risk Header */}
                <div
                  className="flex items-center gap-3 p-4 cursor-pointer"
                  onClick={() => toggleRiskExpanded(risk.id)}
                >
                  <input
                    type="checkbox"
                    checked={risk.enabled}
                    onChange={(e) => {
                      e.stopPropagation();
                      toggleRiskEnabled(risk.id);
                    }}
                    className="w-4 h-4 rounded accent-violet-500"
                  />
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <input
                        type="text"
                        value={risk.risk}
                        onChange={(e) => {
                          e.stopPropagation();
                          updateRisk(risk.id, 'risk', e.target.value);
                        }}
                        onClick={(e) => e.stopPropagation()}
                        className="flex-1 bg-transparent font-medium text-white border-b border-transparent hover:border-violet-500/50 focus:border-violet-500 focus:outline-none"
                      />
                      <span className={`text-xs px-2 py-0.5 rounded-full border ${LIKELIHOOD_COLORS[risk.likelihood]}`}>
                        L: {LIKELIHOOD_LABELS[risk.likelihood]}
                      </span>
                      <span className={`text-xs px-2 py-0.5 rounded-full border ${LIKELIHOOD_COLORS[risk.impact]}`}>
                        I: {LIKELIHOOD_LABELS[risk.impact]}
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        removeRisk(risk.id);
                      }}
                      className="text-gray-500 hover:text-red-400 p-1"
                    >
                      🗑️
                    </button>
                    <span className={`transform transition-transform ${expandedRisks.has(risk.id) ? 'rotate-180' : ''}`}>
                      ▼
                    </span>
                  </div>
                </div>

                {/* Risk Content */}
                {expandedRisks.has(risk.id) && (
                  <div className="px-4 pb-4 space-y-3 border-t border-violet-500/20">
                    <div className="pt-3 grid grid-cols-2 gap-3">
                      <div>
                        <label className="block text-xs text-gray-400 mb-1">Likelihood</label>
                        <select
                          value={risk.likelihood}
                          onChange={(e) => updateRisk(risk.id, 'likelihood', e.target.value)}
                          className="w-full bg-cscx-gray-900/50 border border-cscx-gray-700 rounded px-3 py-2 text-sm text-white focus:border-violet-500 focus:outline-none"
                        >
                          {LIKELIHOOD_OPTIONS.map((level) => (
                            <option key={level} value={level}>{LIKELIHOOD_LABELS[level]}</option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <label className="block text-xs text-gray-400 mb-1">Impact</label>
                        <select
                          value={risk.impact}
                          onChange={(e) => updateRisk(risk.id, 'impact', e.target.value)}
                          className="w-full bg-cscx-gray-900/50 border border-cscx-gray-700 rounded px-3 py-2 text-sm text-white focus:border-violet-500 focus:outline-none"
                        >
                          {LIKELIHOOD_OPTIONS.map((level) => (
                            <option key={level} value={level}>{LIKELIHOOD_LABELS[level]}</option>
                          ))}
                        </select>
                      </div>
                    </div>
                    <div>
                      <label className="block text-xs text-gray-400 mb-1">Mitigation Strategy</label>
                      <textarea
                        value={risk.mitigation}
                        onChange={(e) => updateRisk(risk.id, 'mitigation', e.target.value)}
                        rows={2}
                        className="w-full bg-cscx-gray-900/50 border border-cscx-gray-700 rounded px-3 py-2 text-sm text-white focus:border-violet-500 focus:outline-none resize-none"
                        placeholder="Describe mitigation strategy..."
                      />
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

export default CADGTransformationRoadmapPreview;
