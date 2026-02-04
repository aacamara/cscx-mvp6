/**
 * CADGMilestonePlanPreview - Editable 30-60-90 day plan preview for CADG-generated milestone plans
 * Allows users to review, edit, and approve phase-based goals, milestones, and success criteria before creating document
 */

import React, { useState, useMemo } from 'react';
import { useAuth } from '../../context/AuthContext';

// ============================================
// Types
// ============================================

export interface Goal {
  id: string;
  goal: string;
  completed: boolean;
}

export interface Milestone {
  id: string;
  milestone: string;
  date: string;
  owner: string;
}

export interface SuccessCriteria {
  id: string;
  criteria: string;
}

export interface Phase {
  id: string;
  name: string;
  daysLabel: string;
  goals: Goal[];
  milestones: Milestone[];
  successCriteria: SuccessCriteria[];
}

export interface MilestonePlanData {
  title: string;
  phases: Phase[];
  notes: string;
  startDate: string;
}

export interface CustomerData {
  id: string;
  name: string;
  healthScore?: number;
  renewalDate?: string;
}

interface CADGMilestonePlanPreviewProps {
  milestonePlan: MilestonePlanData;
  customer: CustomerData;
  onSave: (milestonePlan: MilestonePlanData) => Promise<void>;
  onCancel: () => void;
}

// ============================================
// Owner Options
// ============================================
const OWNER_OPTIONS = ['CSM', 'Customer', 'Implementation Team', 'Support', 'All'];

// ============================================
// Component
// ============================================

export const CADGMilestonePlanPreview: React.FC<CADGMilestonePlanPreviewProps> = ({
  milestonePlan,
  customer,
  onSave,
  onCancel,
}) => {
  const { getAuthHeaders } = useAuth();

  // Original data (for tracking modifications)
  const [original] = useState<MilestonePlanData>(() => JSON.parse(JSON.stringify(milestonePlan)));

  // Editable draft state
  const [draft, setDraft] = useState<MilestonePlanData>(() => JSON.parse(JSON.stringify(milestonePlan)));

  // UI state
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [collapsedPhases, setCollapsedPhases] = useState<Set<string>>(new Set());
  const [activePhase, setActivePhase] = useState<string>(draft.phases[0]?.id || '');

  // Check if draft has been modified
  const isModified = useMemo(() => {
    return JSON.stringify(draft) !== JSON.stringify(original);
  }, [draft, original]);

  // Toggle phase collapse
  const togglePhase = (phaseId: string) => {
    setCollapsedPhases(prev => {
      const next = new Set(prev);
      if (next.has(phaseId)) {
        next.delete(phaseId);
      } else {
        next.add(phaseId);
      }
      return next;
    });
  };

  // Handle cancel with unsaved changes warning
  const handleCancel = () => {
    if (isModified) {
      const confirmed = window.confirm(
        'You have unsaved changes. Are you sure you want to discard them?'
      );
      if (!confirmed) return;
    }
    onCancel();
  };

  // Handle save
  const handleSave = async () => {
    setIsSaving(true);
    setError(null);

    try {
      await onSave(draft);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create milestone plan');
    } finally {
      setIsSaving(false);
    }
  };

  // Update title
  const updateTitle = (value: string) => {
    setDraft(prev => ({ ...prev, title: value }));
  };

  // Update start date
  const updateStartDate = (value: string) => {
    setDraft(prev => ({ ...prev, startDate: value }));
  };

  // Update notes
  const updateNotes = (value: string) => {
    setDraft(prev => ({ ...prev, notes: value }));
  };

  // ============================================
  // Phase Operations
  // ============================================

  const updatePhaseName = (phaseId: string, value: string) => {
    setDraft(prev => ({
      ...prev,
      phases: prev.phases.map(p =>
        p.id === phaseId ? { ...p, name: value } : p
      ),
    }));
  };

  const updatePhaseDaysLabel = (phaseId: string, value: string) => {
    setDraft(prev => ({
      ...prev,
      phases: prev.phases.map(p =>
        p.id === phaseId ? { ...p, daysLabel: value } : p
      ),
    }));
  };

  // ============================================
  // Goal Operations
  // ============================================

  const addGoal = (phaseId: string) => {
    setDraft(prev => ({
      ...prev,
      phases: prev.phases.map(p =>
        p.id === phaseId
          ? {
              ...p,
              goals: [
                ...p.goals,
                { id: `goal-${Date.now()}`, goal: '', completed: false },
              ],
            }
          : p
      ),
    }));
  };

  const removeGoal = (phaseId: string, goalId: string) => {
    setDraft(prev => ({
      ...prev,
      phases: prev.phases.map(p =>
        p.id === phaseId
          ? { ...p, goals: p.goals.filter(g => g.id !== goalId) }
          : p
      ),
    }));
  };

  const updateGoal = (phaseId: string, goalId: string, value: string) => {
    setDraft(prev => ({
      ...prev,
      phases: prev.phases.map(p =>
        p.id === phaseId
          ? {
              ...p,
              goals: p.goals.map(g =>
                g.id === goalId ? { ...g, goal: value } : g
              ),
            }
          : p
      ),
    }));
  };

  const toggleGoalCompleted = (phaseId: string, goalId: string) => {
    setDraft(prev => ({
      ...prev,
      phases: prev.phases.map(p =>
        p.id === phaseId
          ? {
              ...p,
              goals: p.goals.map(g =>
                g.id === goalId ? { ...g, completed: !g.completed } : g
              ),
            }
          : p
      ),
    }));
  };

  // ============================================
  // Milestone Operations
  // ============================================

  const addMilestone = (phaseId: string) => {
    const defaultDate = new Date();
    defaultDate.setDate(defaultDate.getDate() + 14);

    setDraft(prev => ({
      ...prev,
      phases: prev.phases.map(p =>
        p.id === phaseId
          ? {
              ...p,
              milestones: [
                ...p.milestones,
                {
                  id: `milestone-${Date.now()}`,
                  milestone: '',
                  date: defaultDate.toISOString().split('T')[0],
                  owner: 'CSM',
                },
              ],
            }
          : p
      ),
    }));
  };

  const removeMilestone = (phaseId: string, milestoneId: string) => {
    setDraft(prev => ({
      ...prev,
      phases: prev.phases.map(p =>
        p.id === phaseId
          ? { ...p, milestones: p.milestones.filter(m => m.id !== milestoneId) }
          : p
      ),
    }));
  };

  const updateMilestone = (
    phaseId: string,
    milestoneId: string,
    field: keyof Milestone,
    value: string
  ) => {
    setDraft(prev => ({
      ...prev,
      phases: prev.phases.map(p =>
        p.id === phaseId
          ? {
              ...p,
              milestones: p.milestones.map(m =>
                m.id === milestoneId ? { ...m, [field]: value } : m
              ),
            }
          : p
      ),
    }));
  };

  // ============================================
  // Success Criteria Operations
  // ============================================

  const addSuccessCriteria = (phaseId: string) => {
    setDraft(prev => ({
      ...prev,
      phases: prev.phases.map(p =>
        p.id === phaseId
          ? {
              ...p,
              successCriteria: [
                ...p.successCriteria,
                { id: `criteria-${Date.now()}`, criteria: '' },
              ],
            }
          : p
      ),
    }));
  };

  const removeSuccessCriteria = (phaseId: string, criteriaId: string) => {
    setDraft(prev => ({
      ...prev,
      phases: prev.phases.map(p =>
        p.id === phaseId
          ? { ...p, successCriteria: p.successCriteria.filter(c => c.id !== criteriaId) }
          : p
      ),
    }));
  };

  const updateSuccessCriteria = (phaseId: string, criteriaId: string, value: string) => {
    setDraft(prev => ({
      ...prev,
      phases: prev.phases.map(p =>
        p.id === phaseId
          ? {
              ...p,
              successCriteria: p.successCriteria.map(c =>
                c.id === criteriaId ? { ...c, criteria: value } : c
              ),
            }
          : p
      ),
    }));
  };

  // Base input class
  const inputClass = 'w-full bg-cscx-gray-900/50 border border-cscx-gray-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-purple-500 disabled:opacity-50';
  const smallInputClass = 'bg-cscx-gray-900/50 border border-cscx-gray-700 rounded-lg px-2 py-1.5 text-white text-xs focus:outline-none focus:border-purple-500 disabled:opacity-50';

  // Get phase color based on index
  const getPhaseColor = (index: number) => {
    const colors = [
      { bg: 'bg-green-900/20', border: 'border-green-600/30', text: 'text-green-400', accent: 'bg-green-600' },
      { bg: 'bg-blue-900/20', border: 'border-blue-600/30', text: 'text-blue-400', accent: 'bg-blue-600' },
      { bg: 'bg-purple-900/20', border: 'border-purple-600/30', text: 'text-purple-400', accent: 'bg-purple-600' },
    ];
    return colors[index % colors.length];
  };

  return (
    <div className="bg-cscx-gray-800 border border-cscx-gray-700 rounded-xl overflow-hidden max-h-[80vh] overflow-y-auto">
      {/* Header */}
      <div className="bg-gradient-to-r from-purple-600/20 to-transparent p-4 border-b border-cscx-gray-700 sticky top-0 z-10 bg-cscx-gray-800">
        <div className="flex items-start justify-between">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-2xl">📅</span>
              <h3 className="text-white font-semibold">30-60-90 Day Plan Preview</h3>
              {isModified && (
                <span className="text-xs bg-yellow-600/30 text-yellow-400 px-2 py-0.5 rounded-full font-medium">
                  Modified
                </span>
              )}
            </div>
            <p className="text-cscx-gray-400 text-sm mt-1">
              For: {customer.name}
            </p>
          </div>
          {customer.healthScore !== undefined && (
            <div className="flex items-center gap-2">
              <span className="text-xs text-cscx-gray-400">Health</span>
              <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${
                customer.healthScore >= 80 ? 'bg-green-900/50 text-green-400' :
                customer.healthScore >= 60 ? 'bg-yellow-900/50 text-yellow-400' :
                'bg-red-900/50 text-red-400'
              }`}>
                {customer.healthScore}
              </span>
            </div>
          )}
        </div>
      </div>

      {/* Content */}
      <div className="p-4 space-y-6">
        {/* Plan Details Section */}
        <div>
          <h4 className="text-xs font-medium text-cscx-gray-400 uppercase tracking-wider mb-3">
            Plan Details
          </h4>
          <div className="space-y-3">
            <div>
              <label className="text-xs text-cscx-gray-400 block mb-1">Title</label>
              <input
                type="text"
                value={draft.title}
                onChange={(e) => updateTitle(e.target.value)}
                disabled={isSaving}
                className={inputClass}
                placeholder="30-60-90 day plan title..."
              />
            </div>
            <div>
              <label className="text-xs text-cscx-gray-400 block mb-1">Start Date</label>
              <input
                type="date"
                value={draft.startDate}
                onChange={(e) => updateStartDate(e.target.value)}
                disabled={isSaving}
                className={`${inputClass} w-48`}
              />
            </div>
          </div>
        </div>

        {/* Phase Tabs */}
        <div>
          <div className="flex gap-2 mb-4">
            {draft.phases.map((phase, index) => {
              const colors = getPhaseColor(index);
              return (
                <button
                  key={phase.id}
                  onClick={() => setActivePhase(phase.id)}
                  className={`flex-1 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                    activePhase === phase.id
                      ? `${colors.bg} ${colors.border} border ${colors.text}`
                      : 'bg-cscx-gray-900/30 border border-cscx-gray-700 text-cscx-gray-400 hover:bg-cscx-gray-900/50'
                  }`}
                >
                  {phase.name}
                </button>
              );
            })}
          </div>

          {/* Active Phase Content */}
          {draft.phases.map((phase, phaseIndex) => {
            if (phase.id !== activePhase) return null;
            const colors = getPhaseColor(phaseIndex);

            return (
              <div key={phase.id} className={`${colors.bg} ${colors.border} border rounded-lg p-4 space-y-4`}>
                {/* Phase Header */}
                <div className="flex items-center gap-3">
                  <div className={`w-2 h-8 ${colors.accent} rounded-full`} />
                  <div className="flex-1 flex gap-3">
                    <input
                      type="text"
                      value={phase.name}
                      onChange={(e) => updatePhaseName(phase.id, e.target.value)}
                      disabled={isSaving}
                      className={`flex-1 ${smallInputClass}`}
                      placeholder="Phase name"
                    />
                    <input
                      type="text"
                      value={phase.daysLabel}
                      onChange={(e) => updatePhaseDaysLabel(phase.id, e.target.value)}
                      disabled={isSaving}
                      className={`w-32 ${smallInputClass}`}
                      placeholder="Days 1-30"
                    />
                  </div>
                </div>

                {/* Goals */}
                <div>
                  <h5 className={`text-xs font-medium ${colors.text} uppercase tracking-wider mb-2 flex items-center gap-2`}>
                    <span>🎯</span>
                    Goals ({phase.goals.length})
                  </h5>
                  <div className="space-y-2">
                    {phase.goals.map((goal, index) => (
                      <div key={goal.id} className="flex items-center gap-2">
                        <button
                          onClick={() => toggleGoalCompleted(phase.id, goal.id)}
                          disabled={isSaving}
                          className={`w-5 h-5 rounded border flex-shrink-0 flex items-center justify-center transition-colors ${
                            goal.completed
                              ? `${colors.accent} border-transparent text-white`
                              : 'border-cscx-gray-600 hover:border-cscx-gray-500'
                          }`}
                        >
                          {goal.completed && (
                            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                            </svg>
                          )}
                        </button>
                        <span className="text-cscx-gray-500 text-xs w-4">{index + 1}.</span>
                        <input
                          type="text"
                          value={goal.goal}
                          onChange={(e) => updateGoal(phase.id, goal.id, e.target.value)}
                          disabled={isSaving}
                          className={`flex-1 ${smallInputClass} ${goal.completed ? 'line-through opacity-60' : ''}`}
                          placeholder="Enter goal..."
                        />
                        <button
                          onClick={() => removeGoal(phase.id, goal.id)}
                          disabled={isSaving}
                          className="p-1 text-cscx-gray-500 hover:text-red-400 transition-colors"
                          title="Remove"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                          </svg>
                        </button>
                      </div>
                    ))}
                    <button
                      onClick={() => addGoal(phase.id)}
                      disabled={isSaving}
                      className="text-xs px-3 py-1.5 bg-cscx-gray-700 hover:bg-cscx-gray-600 text-cscx-gray-300 rounded-lg transition-colors disabled:opacity-50"
                    >
                      + Add Goal
                    </button>
                  </div>
                </div>

                {/* Milestones */}
                <div>
                  <h5 className={`text-xs font-medium ${colors.text} uppercase tracking-wider mb-2 flex items-center gap-2`}>
                    <span>🏁</span>
                    Milestones ({phase.milestones.length})
                  </h5>
                  <div className="space-y-2">
                    {phase.milestones.map((milestone) => (
                      <div
                        key={milestone.id}
                        className="bg-cscx-gray-900/30 border border-cscx-gray-700 rounded-lg p-2"
                      >
                        <div className="flex items-center gap-2 mb-2">
                          <input
                            type="text"
                            value={milestone.milestone}
                            onChange={(e) => updateMilestone(phase.id, milestone.id, 'milestone', e.target.value)}
                            disabled={isSaving}
                            className={`flex-1 ${smallInputClass}`}
                            placeholder="Milestone description"
                          />
                          <button
                            onClick={() => removeMilestone(phase.id, milestone.id)}
                            disabled={isSaving}
                            className="p-1 text-cscx-gray-500 hover:text-red-400 transition-colors"
                            title="Remove"
                          >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                            </svg>
                          </button>
                        </div>
                        <div className="flex gap-2">
                          <input
                            type="date"
                            value={milestone.date}
                            onChange={(e) => updateMilestone(phase.id, milestone.id, 'date', e.target.value)}
                            disabled={isSaving}
                            className={`w-36 ${smallInputClass}`}
                          />
                          <select
                            value={milestone.owner}
                            onChange={(e) => updateMilestone(phase.id, milestone.id, 'owner', e.target.value)}
                            disabled={isSaving}
                            className={`w-32 ${smallInputClass}`}
                          >
                            {OWNER_OPTIONS.map(o => (
                              <option key={o} value={o}>{o}</option>
                            ))}
                          </select>
                        </div>
                      </div>
                    ))}
                    <button
                      onClick={() => addMilestone(phase.id)}
                      disabled={isSaving}
                      className="text-xs px-3 py-1.5 bg-cscx-gray-700 hover:bg-cscx-gray-600 text-cscx-gray-300 rounded-lg transition-colors disabled:opacity-50"
                    >
                      + Add Milestone
                    </button>
                  </div>
                </div>

                {/* Success Criteria */}
                <div>
                  <h5 className={`text-xs font-medium ${colors.text} uppercase tracking-wider mb-2 flex items-center gap-2`}>
                    <span>&#x2705;</span>
                    Success Criteria ({phase.successCriteria.length})
                  </h5>
                  <div className="space-y-2">
                    {phase.successCriteria.map((criteria, index) => (
                      <div key={criteria.id} className="flex items-center gap-2">
                        <span className="text-cscx-gray-500 text-xs w-4">{index + 1}.</span>
                        <input
                          type="text"
                          value={criteria.criteria}
                          onChange={(e) => updateSuccessCriteria(phase.id, criteria.id, e.target.value)}
                          disabled={isSaving}
                          className={`flex-1 ${smallInputClass}`}
                          placeholder="Enter success criteria..."
                        />
                        <button
                          onClick={() => removeSuccessCriteria(phase.id, criteria.id)}
                          disabled={isSaving}
                          className="p-1 text-cscx-gray-500 hover:text-red-400 transition-colors"
                          title="Remove"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                          </svg>
                        </button>
                      </div>
                    ))}
                    <button
                      onClick={() => addSuccessCriteria(phase.id)}
                      disabled={isSaving}
                      className="text-xs px-3 py-1.5 bg-cscx-gray-700 hover:bg-cscx-gray-600 text-cscx-gray-300 rounded-lg transition-colors disabled:opacity-50"
                    >
                      + Add Criteria
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Notes Section */}
        <div>
          <h4 className="text-xs font-medium text-cscx-gray-400 uppercase tracking-wider mb-2 flex items-center gap-2">
            <span>&#x1F4DD;</span>
            Notes
          </h4>
          <textarea
            value={draft.notes}
            onChange={(e) => updateNotes(e.target.value)}
            disabled={isSaving}
            rows={3}
            className={`${inputClass} resize-y`}
            placeholder="Additional notes or context for the plan..."
          />
        </div>
      </div>

      {/* Error Message */}
      {error && (
        <div className="px-4 pb-4">
          <div className="bg-red-900/30 border border-red-600/50 rounded-lg p-3 text-red-400 text-sm">
            {error}
          </div>
        </div>
      )}

      {/* Action Buttons */}
      <div className="px-4 pb-4 flex gap-3 sticky bottom-0 bg-cscx-gray-800 pt-2 border-t border-cscx-gray-700">
        <button
          onClick={handleCancel}
          disabled={isSaving}
          className="flex-1 px-4 py-2.5 bg-cscx-gray-700 hover:bg-cscx-gray-600 text-white text-sm font-medium rounded-lg transition-colors disabled:opacity-50"
        >
          Cancel
        </button>
        <button
          onClick={handleSave}
          disabled={isSaving}
          className="flex-1 px-4 py-2.5 bg-purple-600 hover:bg-purple-700 text-white text-sm font-medium rounded-lg transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
        >
          {isSaving ? (
            <>
              <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent" />
              Creating...
            </>
          ) : (
            <>
              <span>&#x1F4C4;</span>
              Create Milestone Plan
            </>
          )}
        </button>
      </div>
    </div>
  );
};

export default CADGMilestonePlanPreview;
