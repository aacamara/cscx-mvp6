/**
 * CADGRiskAssessmentPreview - Editable risk assessment preview for CADG-generated plans
 * Allows users to review, edit, and approve risk factors and mitigation actions before creating document
 */

import React, { useState, useMemo } from 'react';
import { useAuth } from '../../context/AuthContext';

// ============================================
// Types
// ============================================

export interface RiskFactor {
  id: string;
  name: string;
  description: string;
  category: 'health' | 'engagement' | 'support' | 'nps' | 'usage' | 'relationship' | 'financial' | 'competitive';
  severity: 'critical' | 'high' | 'medium' | 'low';
  weight: number;
  enabled: boolean;
  evidence: string;
}

export interface MitigationAction {
  id: string;
  action: string;
  description: string;
  owner: 'CSM' | 'Customer' | 'Support' | 'Product' | 'Leadership' | 'Implementation';
  dueDate: string;
  status: 'pending' | 'in_progress' | 'completed' | 'blocked';
  priority: 'high' | 'medium' | 'low';
  relatedRiskIds: string[];
}

export interface RiskAssessmentData {
  title: string;
  assessmentDate: string;
  overallRiskScore: number;
  riskLevel: 'critical' | 'high' | 'medium' | 'low';
  healthScore: number;
  daysUntilRenewal: number;
  arr: number;
  riskFactors: RiskFactor[];
  mitigationActions: MitigationAction[];
  executiveSummary: string;
  notes: string;
}

export interface CustomerData {
  id: string | null;
  name: string;
  healthScore?: number;
  arr?: number;
  renewalDate?: string;
}

interface CADGRiskAssessmentPreviewProps {
  riskAssessment: RiskAssessmentData;
  customer: CustomerData;
  onSave: (riskAssessment: RiskAssessmentData) => Promise<void>;
  onCancel: () => void;
}

// ============================================
// Options
// ============================================
const SEVERITY_OPTIONS = ['critical', 'high', 'medium', 'low'] as const;
const CATEGORY_OPTIONS = ['health', 'engagement', 'support', 'nps', 'usage', 'relationship', 'financial', 'competitive'] as const;
const OWNER_OPTIONS = ['CSM', 'Customer', 'Support', 'Product', 'Leadership', 'Implementation'] as const;
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
  health: 'Health',
  engagement: 'Engagement',
  support: 'Support',
  nps: 'NPS',
  usage: 'Usage',
  relationship: 'Relationship',
  financial: 'Financial',
  competitive: 'Competitive',
};

const CATEGORY_COLORS: Record<string, string> = {
  health: 'bg-red-500/20 text-red-400',
  engagement: 'bg-blue-500/20 text-blue-400',
  support: 'bg-purple-500/20 text-purple-400',
  nps: 'bg-cyan-500/20 text-cyan-400',
  usage: 'bg-emerald-500/20 text-emerald-400',
  relationship: 'bg-pink-500/20 text-pink-400',
  financial: 'bg-amber-500/20 text-amber-400',
  competitive: 'bg-rose-500/20 text-rose-400',
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

// ============================================
// Component
// ============================================

export const CADGRiskAssessmentPreview: React.FC<CADGRiskAssessmentPreviewProps> = ({
  riskAssessment,
  customer,
  onSave,
  onCancel,
}) => {
  const { getAuthHeaders } = useAuth();

  // Original data (for tracking modifications)
  const [original] = useState<RiskAssessmentData>(() => JSON.parse(JSON.stringify(riskAssessment)));

  // Editable draft state
  const [draft, setDraft] = useState<RiskAssessmentData>(() => JSON.parse(JSON.stringify(riskAssessment)));

  // UI state
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'overview' | 'risks' | 'actions' | 'summary'>('overview');
  const [expandedRisk, setExpandedRisk] = useState<string | null>(null);
  const [expandedAction, setExpandedAction] = useState<string | null>(null);

  // Check if draft has been modified
  const isModified = useMemo(() => {
    return JSON.stringify(draft) !== JSON.stringify(original);
  }, [draft, original]);

  // Calculate risk score and stats based on current draft
  const calculatedStats = useMemo(() => {
    const enabledFactors = draft.riskFactors.filter(r => r.enabled);
    const severityScores: Record<string, number> = {
      critical: 100,
      high: 75,
      medium: 50,
      low: 25,
    };

    let weightedSum = 0;
    let totalWeight = 0;
    enabledFactors.forEach(factor => {
      const severityScore = severityScores[factor.severity];
      weightedSum += severityScore * factor.weight;
      totalWeight += factor.weight;
    });

    const calculatedRiskScore = totalWeight > 0 ? Math.round(weightedSum / totalWeight) : 0;

    let calculatedRiskLevel: RiskAssessmentData['riskLevel'] = 'low';
    if (calculatedRiskScore >= 80) calculatedRiskLevel = 'critical';
    else if (calculatedRiskScore >= 60) calculatedRiskLevel = 'high';
    else if (calculatedRiskScore >= 40) calculatedRiskLevel = 'medium';

    const criticalCount = enabledFactors.filter(r => r.severity === 'critical').length;
    const highCount = enabledFactors.filter(r => r.severity === 'high').length;
    const pendingActions = draft.mitigationActions.filter(a => a.status === 'pending' || a.status === 'in_progress').length;

    return {
      riskScore: calculatedRiskScore,
      riskLevel: calculatedRiskLevel,
      enabledFactorsCount: enabledFactors.length,
      criticalCount,
      highCount,
      actionsCount: draft.mitigationActions.length,
      pendingActions,
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
      // Update risk score and level before saving
      const finalDraft = {
        ...draft,
        overallRiskScore: calculatedStats.riskScore,
        riskLevel: calculatedStats.riskLevel,
      };
      await onSave(finalDraft);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save risk assessment');
    } finally {
      setIsSaving(false);
    }
  };

  // Risk factor handlers
  const handleToggleRisk = (riskId: string) => {
    setDraft(prev => ({
      ...prev,
      riskFactors: prev.riskFactors.map(r =>
        r.id === riskId ? { ...r, enabled: !r.enabled } : r
      ),
    }));
  };

  const handleUpdateRisk = (riskId: string, updates: Partial<RiskFactor>) => {
    setDraft(prev => ({
      ...prev,
      riskFactors: prev.riskFactors.map(r =>
        r.id === riskId ? { ...r, ...updates } : r
      ),
    }));
  };

  const handleAddRisk = () => {
    const newRisk: RiskFactor = {
      id: `risk-${Date.now()}`,
      name: 'New Risk Factor',
      description: '',
      category: 'health',
      severity: 'medium',
      weight: 50,
      enabled: true,
      evidence: '',
    };
    setDraft(prev => ({
      ...prev,
      riskFactors: [...prev.riskFactors, newRisk],
    }));
    setExpandedRisk(newRisk.id);
  };

  const handleRemoveRisk = (riskId: string) => {
    setDraft(prev => ({
      ...prev,
      riskFactors: prev.riskFactors.filter(r => r.id !== riskId),
      // Remove from related actions
      mitigationActions: prev.mitigationActions.map(a => ({
        ...a,
        relatedRiskIds: a.relatedRiskIds.filter(id => id !== riskId),
      })),
    }));
  };

  // Mitigation action handlers
  const handleUpdateAction = (actionId: string, updates: Partial<MitigationAction>) => {
    setDraft(prev => ({
      ...prev,
      mitigationActions: prev.mitigationActions.map(a =>
        a.id === actionId ? { ...a, ...updates } : a
      ),
    }));
  };

  const handleAddAction = () => {
    const newAction: MitigationAction = {
      id: `action-${Date.now()}`,
      action: 'New Action',
      description: '',
      owner: 'CSM',
      dueDate: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10),
      status: 'pending',
      priority: 'medium',
      relatedRiskIds: [],
    };
    setDraft(prev => ({
      ...prev,
      mitigationActions: [...prev.mitigationActions, newAction],
    }));
    setExpandedAction(newAction.id);
  };

  const handleRemoveAction = (actionId: string) => {
    setDraft(prev => ({
      ...prev,
      mitigationActions: prev.mitigationActions.filter(a => a.id !== actionId),
    }));
  };

  const handleMoveAction = (actionId: string, direction: 'up' | 'down') => {
    setDraft(prev => {
      const idx = prev.mitigationActions.findIndex(a => a.id === actionId);
      if (idx < 0) return prev;
      if (direction === 'up' && idx === 0) return prev;
      if (direction === 'down' && idx === prev.mitigationActions.length - 1) return prev;

      const newActions = [...prev.mitigationActions];
      const targetIdx = direction === 'up' ? idx - 1 : idx + 1;
      [newActions[idx], newActions[targetIdx]] = [newActions[targetIdx], newActions[idx]];

      return { ...prev, mitigationActions: newActions };
    });
  };

  const handleToggleRelatedRisk = (actionId: string, riskId: string) => {
    setDraft(prev => ({
      ...prev,
      mitigationActions: prev.mitigationActions.map(a => {
        if (a.id !== actionId) return a;
        const hasRisk = a.relatedRiskIds.includes(riskId);
        return {
          ...a,
          relatedRiskIds: hasRisk
            ? a.relatedRiskIds.filter(id => id !== riskId)
            : [...a.relatedRiskIds, riskId],
        };
      }),
    }));
  };

  // ============================================
  // Render
  // ============================================

  return (
    <div className="bg-cscx-gray-800 rounded-lg border border-gray-700 overflow-hidden max-h-[80vh] flex flex-col">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-gradient-to-r from-red-900/30 to-orange-900/20 border-b border-gray-700 p-4">
        <div className="flex items-center justify-between">
          <div className="flex-1">
            <input
              type="text"
              value={draft.title}
              onChange={(e) => setDraft(prev => ({ ...prev, title: e.target.value }))}
              className="text-lg font-semibold bg-transparent border-none outline-none text-white w-full focus:ring-1 focus:ring-red-500/50 rounded px-1"
            />
            <div className="flex items-center gap-4 mt-1 text-sm text-gray-400">
              <span>{customer.name}</span>
              <span>|</span>
              <span>Assessment Date: {draft.assessmentDate}</span>
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
              className="px-4 py-1.5 text-sm bg-red-600 hover:bg-red-700 text-white rounded transition-colors disabled:opacity-50"
            >
              {isSaving ? 'Saving...' : 'Create Assessment'}
            </button>
          </div>
        </div>

        {error && (
          <div className="mt-2 p-2 bg-red-900/50 border border-red-700 rounded text-red-300 text-sm">
            {error}
          </div>
        )}

        {/* Risk Score Overview Card */}
        <div className="mt-4 p-4 bg-cscx-gray-900/50 rounded-lg border border-gray-700">
          <div className="grid grid-cols-5 gap-4">
            {/* Risk Score */}
            <div className="col-span-2">
              <div className="text-xs text-gray-500 uppercase mb-1">Overall Risk Score</div>
              <div className="flex items-end gap-2">
                <span className={`text-4xl font-bold ${
                  calculatedStats.riskLevel === 'critical' ? 'text-red-400' :
                  calculatedStats.riskLevel === 'high' ? 'text-orange-400' :
                  calculatedStats.riskLevel === 'medium' ? 'text-amber-400' :
                  'text-green-400'
                }`}>
                  {calculatedStats.riskScore}
                </span>
                <span className="text-gray-500 text-lg mb-1">/100</span>
              </div>
              <div className={`text-sm font-medium mt-1 ${
                calculatedStats.riskLevel === 'critical' ? 'text-red-400' :
                calculatedStats.riskLevel === 'high' ? 'text-orange-400' :
                calculatedStats.riskLevel === 'medium' ? 'text-amber-400' :
                'text-green-400'
              }`}>
                {SEVERITY_LABELS[calculatedStats.riskLevel]} Risk
              </div>
              {/* Risk Score Bar */}
              <div className="mt-2 h-2 bg-gray-700 rounded-full overflow-hidden">
                <div
                  className={`h-full transition-all duration-300 ${
                    calculatedStats.riskLevel === 'critical' ? 'bg-red-500' :
                    calculatedStats.riskLevel === 'high' ? 'bg-orange-500' :
                    calculatedStats.riskLevel === 'medium' ? 'bg-amber-500' :
                    'bg-green-500'
                  }`}
                  style={{ width: `${calculatedStats.riskScore}%` }}
                />
              </div>
            </div>

            {/* Health Score */}
            <div>
              <div className="text-xs text-gray-500 uppercase mb-1">Health Score</div>
              <div className="text-2xl font-semibold text-white">{draft.healthScore}</div>
              <div className="text-xs text-gray-500">/100</div>
            </div>

            {/* Days Until Renewal */}
            <div>
              <div className="text-xs text-gray-500 uppercase mb-1">Days to Renewal</div>
              <div className={`text-2xl font-semibold ${
                draft.daysUntilRenewal <= 30 ? 'text-red-400' :
                draft.daysUntilRenewal <= 60 ? 'text-orange-400' :
                draft.daysUntilRenewal <= 90 ? 'text-amber-400' :
                'text-white'
              }`}>
                {draft.daysUntilRenewal}
              </div>
              <div className="text-xs text-gray-500">days</div>
            </div>

            {/* ARR */}
            <div>
              <div className="text-xs text-gray-500 uppercase mb-1">ARR at Risk</div>
              <div className="text-2xl font-semibold text-white">
                ${(draft.arr / 1000).toFixed(0)}K
              </div>
              <div className="text-xs text-gray-500">${draft.arr.toLocaleString()}</div>
            </div>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="border-b border-gray-700 bg-cscx-gray-900/50">
        <div className="flex">
          {[
            { id: 'overview', label: 'Overview' },
            { id: 'risks', label: `Risk Factors (${calculatedStats.enabledFactorsCount})` },
            { id: 'actions', label: `Mitigation Actions (${draft.mitigationActions.length})` },
            { id: 'summary', label: 'Summary' },
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as typeof activeTab)}
              className={`px-4 py-2.5 text-sm font-medium transition-colors ${
                activeTab === tab.id
                  ? 'text-red-400 border-b-2 border-red-400 bg-red-500/10'
                  : 'text-gray-400 hover:text-white hover:bg-gray-700/50'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-4">
        {/* Overview Tab */}
        {activeTab === 'overview' && (
          <div className="space-y-4">
            {/* Quick Stats */}
            <div className="grid grid-cols-4 gap-3">
              <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-3">
                <div className="text-xs text-red-400 uppercase mb-1">Critical Risks</div>
                <div className="text-2xl font-bold text-red-400">{calculatedStats.criticalCount}</div>
              </div>
              <div className="bg-orange-500/10 border border-orange-500/30 rounded-lg p-3">
                <div className="text-xs text-orange-400 uppercase mb-1">High Risks</div>
                <div className="text-2xl font-bold text-orange-400">{calculatedStats.highCount}</div>
              </div>
              <div className="bg-blue-500/10 border border-blue-500/30 rounded-lg p-3">
                <div className="text-xs text-blue-400 uppercase mb-1">Total Factors</div>
                <div className="text-2xl font-bold text-blue-400">{calculatedStats.enabledFactorsCount}</div>
              </div>
              <div className="bg-emerald-500/10 border border-emerald-500/30 rounded-lg p-3">
                <div className="text-xs text-emerald-400 uppercase mb-1">Pending Actions</div>
                <div className="text-2xl font-bold text-emerald-400">{calculatedStats.pendingActions}</div>
              </div>
            </div>

            {/* Executive Summary */}
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">Executive Summary</label>
              <textarea
                value={draft.executiveSummary}
                onChange={(e) => setDraft(prev => ({ ...prev, executiveSummary: e.target.value }))}
                rows={4}
                className="w-full bg-cscx-gray-900 border border-gray-700 rounded-lg px-3 py-2 text-white placeholder-gray-500 focus:outline-none focus:ring-1 focus:ring-red-500/50 resize-none"
                placeholder="Brief summary of the risk assessment..."
              />
            </div>

            {/* Risk Factor Breakdown by Category */}
            <div>
              <h3 className="text-sm font-medium text-gray-300 mb-3">Risk Factors by Category</h3>
              <div className="grid grid-cols-4 gap-2">
                {CATEGORY_OPTIONS.map(category => {
                  const catFactors = draft.riskFactors.filter(r => r.category === category && r.enabled);
                  const catCritical = catFactors.filter(r => r.severity === 'critical').length;
                  const catHigh = catFactors.filter(r => r.severity === 'high').length;
                  return (
                    <div
                      key={category}
                      className={`p-2 rounded border ${catFactors.length > 0 ? CATEGORY_COLORS[category] : 'bg-gray-800/50'} border-gray-700`}
                    >
                      <div className="text-xs font-medium">{CATEGORY_LABELS[category]}</div>
                      <div className="flex items-center gap-1 mt-1">
                        <span className="text-lg font-bold">{catFactors.length}</span>
                        {catCritical > 0 && (
                          <span className="text-xs px-1 bg-red-500/30 rounded text-red-400">{catCritical}C</span>
                        )}
                        {catHigh > 0 && (
                          <span className="text-xs px-1 bg-orange-500/30 rounded text-orange-400">{catHigh}H</span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Top Risk Factors Preview */}
            <div>
              <h3 className="text-sm font-medium text-gray-300 mb-3">Top Risk Factors</h3>
              <div className="space-y-2">
                {draft.riskFactors
                  .filter(r => r.enabled)
                  .sort((a, b) => {
                    const severityOrder = { critical: 0, high: 1, medium: 2, low: 3 };
                    return severityOrder[a.severity] - severityOrder[b.severity] || b.weight - a.weight;
                  })
                  .slice(0, 5)
                  .map(risk => (
                    <div
                      key={risk.id}
                      className="flex items-center gap-3 p-2 bg-cscx-gray-900/50 rounded border border-gray-700"
                    >
                      <span className={`px-2 py-0.5 rounded text-xs font-medium border ${SEVERITY_COLORS[risk.severity]}`}>
                        {SEVERITY_LABELS[risk.severity]}
                      </span>
                      <span className={`px-2 py-0.5 rounded text-xs ${CATEGORY_COLORS[risk.category]}`}>
                        {CATEGORY_LABELS[risk.category]}
                      </span>
                      <span className="text-sm text-white flex-1">{risk.name}</span>
                      <span className="text-xs text-gray-500">{risk.weight}%</span>
                    </div>
                  ))}
              </div>
            </div>
          </div>
        )}

        {/* Risk Factors Tab */}
        {activeTab === 'risks' && (
          <div className="space-y-3">
            <div className="flex justify-between items-center mb-2">
              <span className="text-sm text-gray-400">
                {calculatedStats.enabledFactorsCount} of {draft.riskFactors.length} factors enabled
              </span>
              <button
                onClick={handleAddRisk}
                className="px-3 py-1.5 text-sm bg-red-600/20 hover:bg-red-600/30 text-red-400 rounded border border-red-500/30 transition-colors"
              >
                + Add Risk Factor
              </button>
            </div>

            {draft.riskFactors.map(risk => (
              <div
                key={risk.id}
                className={`border rounded-lg transition-all ${
                  risk.enabled
                    ? 'border-gray-600 bg-cscx-gray-900/50'
                    : 'border-gray-700/50 bg-cscx-gray-900/20 opacity-60'
                }`}
              >
                {/* Risk Header */}
                <div
                  className="flex items-center gap-3 p-3 cursor-pointer"
                  onClick={() => setExpandedRisk(expandedRisk === risk.id ? null : risk.id)}
                >
                  {/* Enable Toggle */}
                  <input
                    type="checkbox"
                    checked={risk.enabled}
                    onChange={(e) => {
                      e.stopPropagation();
                      handleToggleRisk(risk.id);
                    }}
                    className="w-4 h-4 rounded border-gray-600 bg-cscx-gray-800 text-red-500 focus:ring-red-500/50"
                  />

                  {/* Severity Badge */}
                  <span className={`px-2 py-0.5 rounded text-xs font-medium border ${SEVERITY_COLORS[risk.severity]}`}>
                    {SEVERITY_LABELS[risk.severity]}
                  </span>

                  {/* Category Badge */}
                  <span className={`px-2 py-0.5 rounded text-xs ${CATEGORY_COLORS[risk.category]}`}>
                    {CATEGORY_LABELS[risk.category]}
                  </span>

                  {/* Name */}
                  <span className="text-sm text-white flex-1 font-medium">{risk.name}</span>

                  {/* Weight */}
                  <span className="text-xs text-gray-500 bg-gray-800 px-2 py-0.5 rounded">{risk.weight}%</span>

                  {/* Expand Icon */}
                  <svg
                    className={`w-4 h-4 text-gray-400 transition-transform ${expandedRisk === risk.id ? 'rotate-180' : ''}`}
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </div>

                {/* Expanded Content */}
                {expandedRisk === risk.id && (
                  <div className="border-t border-gray-700 p-3 space-y-3">
                    {/* Name */}
                    <div>
                      <label className="block text-xs text-gray-500 mb-1">Risk Factor Name</label>
                      <input
                        type="text"
                        value={risk.name}
                        onChange={(e) => handleUpdateRisk(risk.id, { name: e.target.value })}
                        className="w-full bg-cscx-gray-800 border border-gray-700 rounded px-2 py-1.5 text-sm text-white focus:outline-none focus:ring-1 focus:ring-red-500/50"
                      />
                    </div>

                    {/* Description */}
                    <div>
                      <label className="block text-xs text-gray-500 mb-1">Description</label>
                      <textarea
                        value={risk.description}
                        onChange={(e) => handleUpdateRisk(risk.id, { description: e.target.value })}
                        rows={2}
                        className="w-full bg-cscx-gray-800 border border-gray-700 rounded px-2 py-1.5 text-sm text-white focus:outline-none focus:ring-1 focus:ring-red-500/50 resize-none"
                      />
                    </div>

                    <div className="grid grid-cols-3 gap-3">
                      {/* Severity */}
                      <div>
                        <label className="block text-xs text-gray-500 mb-1">Severity</label>
                        <select
                          value={risk.severity}
                          onChange={(e) => handleUpdateRisk(risk.id, { severity: e.target.value as RiskFactor['severity'] })}
                          className="w-full bg-cscx-gray-800 border border-gray-700 rounded px-2 py-1.5 text-sm text-white focus:outline-none focus:ring-1 focus:ring-red-500/50"
                        >
                          {SEVERITY_OPTIONS.map(s => (
                            <option key={s} value={s}>{SEVERITY_LABELS[s]}</option>
                          ))}
                        </select>
                      </div>

                      {/* Category */}
                      <div>
                        <label className="block text-xs text-gray-500 mb-1">Category</label>
                        <select
                          value={risk.category}
                          onChange={(e) => handleUpdateRisk(risk.id, { category: e.target.value as RiskFactor['category'] })}
                          className="w-full bg-cscx-gray-800 border border-gray-700 rounded px-2 py-1.5 text-sm text-white focus:outline-none focus:ring-1 focus:ring-red-500/50"
                        >
                          {CATEGORY_OPTIONS.map(c => (
                            <option key={c} value={c}>{CATEGORY_LABELS[c]}</option>
                          ))}
                        </select>
                      </div>

                      {/* Weight */}
                      <div>
                        <label className="block text-xs text-gray-500 mb-1">Weight: {risk.weight}%</label>
                        <input
                          type="range"
                          min="0"
                          max="100"
                          value={risk.weight}
                          onChange={(e) => handleUpdateRisk(risk.id, { weight: parseInt(e.target.value) })}
                          className="w-full accent-red-500"
                        />
                      </div>
                    </div>

                    {/* Evidence */}
                    <div>
                      <label className="block text-xs text-gray-500 mb-1">Evidence</label>
                      <textarea
                        value={risk.evidence}
                        onChange={(e) => handleUpdateRisk(risk.id, { evidence: e.target.value })}
                        rows={2}
                        className="w-full bg-cscx-gray-800 border border-gray-700 rounded px-2 py-1.5 text-sm text-white focus:outline-none focus:ring-1 focus:ring-red-500/50 resize-none"
                        placeholder="Data or observations supporting this risk..."
                      />
                    </div>

                    {/* Remove Button */}
                    <div className="flex justify-end">
                      <button
                        onClick={() => handleRemoveRisk(risk.id)}
                        className="px-3 py-1 text-xs text-red-400 hover:text-red-300 hover:bg-red-500/10 rounded transition-colors"
                      >
                        Remove Risk Factor
                      </button>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        {/* Mitigation Actions Tab */}
        {activeTab === 'actions' && (
          <div className="space-y-3">
            <div className="flex justify-between items-center mb-2">
              <span className="text-sm text-gray-400">
                {calculatedStats.pendingActions} pending, {draft.mitigationActions.filter(a => a.status === 'completed').length} completed
              </span>
              <button
                onClick={handleAddAction}
                className="px-3 py-1.5 text-sm bg-emerald-600/20 hover:bg-emerald-600/30 text-emerald-400 rounded border border-emerald-500/30 transition-colors"
              >
                + Add Action
              </button>
            </div>

            {draft.mitigationActions.map((action, idx) => (
              <div
                key={action.id}
                className="border border-gray-600 rounded-lg bg-cscx-gray-900/50"
              >
                {/* Action Header */}
                <div
                  className="flex items-center gap-3 p-3 cursor-pointer"
                  onClick={() => setExpandedAction(expandedAction === action.id ? null : action.id)}
                >
                  {/* Reorder Controls */}
                  <div className="flex flex-col gap-0.5">
                    <button
                      onClick={(e) => { e.stopPropagation(); handleMoveAction(action.id, 'up'); }}
                      disabled={idx === 0}
                      className="text-gray-500 hover:text-white disabled:opacity-30"
                    >
                      <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
                      </svg>
                    </button>
                    <button
                      onClick={(e) => { e.stopPropagation(); handleMoveAction(action.id, 'down'); }}
                      disabled={idx === draft.mitigationActions.length - 1}
                      className="text-gray-500 hover:text-white disabled:opacity-30"
                    >
                      <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                      </svg>
                    </button>
                  </div>

                  {/* Priority Badge */}
                  <span className={`px-2 py-0.5 rounded text-xs font-medium ${PRIORITY_COLORS[action.priority]}`}>
                    {PRIORITY_LABELS[action.priority]}
                  </span>

                  {/* Status Badge */}
                  <span className={`px-2 py-0.5 rounded text-xs ${STATUS_COLORS[action.status]}`}>
                    {STATUS_LABELS[action.status]}
                  </span>

                  {/* Action Name */}
                  <span className="text-sm text-white flex-1 font-medium">{action.action}</span>

                  {/* Owner */}
                  <span className="text-xs text-gray-400">{action.owner}</span>

                  {/* Due Date */}
                  <span className="text-xs text-gray-500">{action.dueDate}</span>

                  {/* Expand Icon */}
                  <svg
                    className={`w-4 h-4 text-gray-400 transition-transform ${expandedAction === action.id ? 'rotate-180' : ''}`}
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </div>

                {/* Expanded Content */}
                {expandedAction === action.id && (
                  <div className="border-t border-gray-700 p-3 space-y-3">
                    {/* Action Name */}
                    <div>
                      <label className="block text-xs text-gray-500 mb-1">Action Title</label>
                      <input
                        type="text"
                        value={action.action}
                        onChange={(e) => handleUpdateAction(action.id, { action: e.target.value })}
                        className="w-full bg-cscx-gray-800 border border-gray-700 rounded px-2 py-1.5 text-sm text-white focus:outline-none focus:ring-1 focus:ring-emerald-500/50"
                      />
                    </div>

                    {/* Description */}
                    <div>
                      <label className="block text-xs text-gray-500 mb-1">Description</label>
                      <textarea
                        value={action.description}
                        onChange={(e) => handleUpdateAction(action.id, { description: e.target.value })}
                        rows={2}
                        className="w-full bg-cscx-gray-800 border border-gray-700 rounded px-2 py-1.5 text-sm text-white focus:outline-none focus:ring-1 focus:ring-emerald-500/50 resize-none"
                      />
                    </div>

                    <div className="grid grid-cols-4 gap-3">
                      {/* Owner */}
                      <div>
                        <label className="block text-xs text-gray-500 mb-1">Owner</label>
                        <select
                          value={action.owner}
                          onChange={(e) => handleUpdateAction(action.id, { owner: e.target.value as MitigationAction['owner'] })}
                          className="w-full bg-cscx-gray-800 border border-gray-700 rounded px-2 py-1.5 text-sm text-white focus:outline-none focus:ring-1 focus:ring-emerald-500/50"
                        >
                          {OWNER_OPTIONS.map(o => (
                            <option key={o} value={o}>{o}</option>
                          ))}
                        </select>
                      </div>

                      {/* Priority */}
                      <div>
                        <label className="block text-xs text-gray-500 mb-1">Priority</label>
                        <select
                          value={action.priority}
                          onChange={(e) => handleUpdateAction(action.id, { priority: e.target.value as MitigationAction['priority'] })}
                          className="w-full bg-cscx-gray-800 border border-gray-700 rounded px-2 py-1.5 text-sm text-white focus:outline-none focus:ring-1 focus:ring-emerald-500/50"
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
                          onChange={(e) => handleUpdateAction(action.id, { status: e.target.value as MitigationAction['status'] })}
                          className="w-full bg-cscx-gray-800 border border-gray-700 rounded px-2 py-1.5 text-sm text-white focus:outline-none focus:ring-1 focus:ring-emerald-500/50"
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
                          className="w-full bg-cscx-gray-800 border border-gray-700 rounded px-2 py-1.5 text-sm text-white focus:outline-none focus:ring-1 focus:ring-emerald-500/50"
                        />
                      </div>
                    </div>

                    {/* Related Risks */}
                    <div>
                      <label className="block text-xs text-gray-500 mb-2">Related Risk Factors</label>
                      <div className="flex flex-wrap gap-2">
                        {draft.riskFactors.filter(r => r.enabled).map(risk => (
                          <button
                            key={risk.id}
                            onClick={() => handleToggleRelatedRisk(action.id, risk.id)}
                            className={`px-2 py-1 text-xs rounded border transition-colors ${
                              action.relatedRiskIds.includes(risk.id)
                                ? `${SEVERITY_COLORS[risk.severity]} border-current`
                                : 'border-gray-600 text-gray-400 hover:border-gray-500'
                            }`}
                          >
                            {risk.name}
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Remove Button */}
                    <div className="flex justify-end">
                      <button
                        onClick={() => handleRemoveAction(action.id)}
                        className="px-3 py-1 text-xs text-red-400 hover:text-red-300 hover:bg-red-500/10 rounded transition-colors"
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

        {/* Summary Tab */}
        {activeTab === 'summary' && (
          <div className="space-y-4">
            {/* Assessment Details */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs text-gray-500 mb-1">Assessment Date</label>
                <input
                  type="date"
                  value={draft.assessmentDate}
                  onChange={(e) => setDraft(prev => ({ ...prev, assessmentDate: e.target.value }))}
                  className="w-full bg-cscx-gray-800 border border-gray-700 rounded px-2 py-1.5 text-sm text-white focus:outline-none focus:ring-1 focus:ring-red-500/50"
                />
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">Health Score</label>
                <input
                  type="number"
                  min="0"
                  max="100"
                  value={draft.healthScore}
                  onChange={(e) => setDraft(prev => ({ ...prev, healthScore: parseInt(e.target.value) || 0 }))}
                  className="w-full bg-cscx-gray-800 border border-gray-700 rounded px-2 py-1.5 text-sm text-white focus:outline-none focus:ring-1 focus:ring-red-500/50"
                />
              </div>
            </div>

            {/* Notes */}
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">Additional Notes</label>
              <textarea
                value={draft.notes}
                onChange={(e) => setDraft(prev => ({ ...prev, notes: e.target.value }))}
                rows={6}
                className="w-full bg-cscx-gray-900 border border-gray-700 rounded-lg px-3 py-2 text-white placeholder-gray-500 focus:outline-none focus:ring-1 focus:ring-red-500/50 resize-none"
                placeholder="Internal notes, context, or additional observations..."
              />
            </div>

            {/* Summary Preview */}
            <div className="bg-cscx-gray-900/70 border border-gray-700 rounded-lg p-4">
              <h3 className="text-sm font-medium text-gray-300 mb-3">Assessment Summary</h3>
              <div className="text-sm text-gray-400 space-y-2">
                <p>
                  <strong className="text-white">{customer.name}</strong> has an overall risk score of{' '}
                  <span className={`font-bold ${
                    calculatedStats.riskLevel === 'critical' ? 'text-red-400' :
                    calculatedStats.riskLevel === 'high' ? 'text-orange-400' :
                    calculatedStats.riskLevel === 'medium' ? 'text-amber-400' :
                    'text-green-400'
                  }`}>
                    {calculatedStats.riskScore}/100
                  </span>{' '}
                  ({SEVERITY_LABELS[calculatedStats.riskLevel]} Risk).
                </p>
                <p>
                  <strong className="text-gray-300">{calculatedStats.enabledFactorsCount} risk factors</strong> identified:
                  {calculatedStats.criticalCount > 0 && <span className="text-red-400 ml-1">{calculatedStats.criticalCount} critical</span>}
                  {calculatedStats.highCount > 0 && <span className="text-orange-400 ml-1">{calculatedStats.criticalCount > 0 ? ', ' : ''}{calculatedStats.highCount} high</span>}
                </p>
                <p>
                  <strong className="text-gray-300">{draft.mitigationActions.length} mitigation actions</strong> planned,
                  with <span className="text-blue-400">{calculatedStats.pendingActions} pending/in-progress</span>.
                </p>
                <p>
                  Renewal in <strong className={`${
                    draft.daysUntilRenewal <= 30 ? 'text-red-400' :
                    draft.daysUntilRenewal <= 60 ? 'text-orange-400' :
                    draft.daysUntilRenewal <= 90 ? 'text-amber-400' :
                    'text-white'
                  }`}>{draft.daysUntilRenewal} days</strong> with{' '}
                  <strong className="text-white">${draft.arr.toLocaleString()}</strong> ARR at risk.
                </p>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default CADGRiskAssessmentPreview;
