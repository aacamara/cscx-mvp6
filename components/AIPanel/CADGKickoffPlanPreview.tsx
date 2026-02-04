/**
 * CADGKickoffPlanPreview - Editable kickoff plan preview for CADG-generated onboarding kickoffs
 * Allows users to review, edit, and approve attendees, agenda, goals, and next steps before creating document
 */

import React, { useState, useMemo } from 'react';
import { useAuth } from '../../context/AuthContext';

// ============================================
// Types
// ============================================

export interface Attendee {
  id: string;
  name: string;
  email: string;
  role: string;
}

export interface AgendaItem {
  id: string;
  topic: string;
  duration: string;
  owner: string;
}

export interface Goal {
  id: string;
  goal: string;
}

export interface NextStep {
  id: string;
  action: string;
  owner: string;
  dueDate: string;
}

export interface KickoffPlanData {
  title: string;
  attendees: Attendee[];
  agenda: AgendaItem[];
  goals: Goal[];
  nextSteps: NextStep[];
  notes: string;
  meetingDate: string;
  meetingDuration: string;
}

export interface CustomerData {
  id: string;
  name: string;
  healthScore?: number;
  renewalDate?: string;
}

interface CADGKickoffPlanPreviewProps {
  kickoffPlan: KickoffPlanData;
  customer: CustomerData;
  onSave: (kickoffPlan: KickoffPlanData) => Promise<void>;
  onCancel: () => void;
}

// ============================================
// Owner Options
// ============================================
const OWNER_OPTIONS = ['CSM', 'Customer', 'Implementation Team', 'Support', 'All'];
const ROLE_OPTIONS = ['Executive Sponsor', 'Project Lead', 'Key User', 'Decision Maker', 'Technical Contact', 'End User'];
const DURATION_OPTIONS = ['5 min', '10 min', '15 min', '20 min', '30 min', '45 min', '60 min'];

// ============================================
// Component
// ============================================

export const CADGKickoffPlanPreview: React.FC<CADGKickoffPlanPreviewProps> = ({
  kickoffPlan,
  customer,
  onSave,
  onCancel,
}) => {
  const { getAuthHeaders } = useAuth();

  // Original data (for tracking modifications)
  const [original] = useState<KickoffPlanData>(() => JSON.parse(JSON.stringify(kickoffPlan)));

  // Editable draft state
  const [draft, setDraft] = useState<KickoffPlanData>(() => JSON.parse(JSON.stringify(kickoffPlan)));

  // UI state
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [collapsedSections, setCollapsedSections] = useState<Set<string>>(new Set());

  // AI suggestion state
  const [aiLoading, setAiLoading] = useState<Record<string, boolean>>({});

  // Check if draft has been modified
  const isModified = useMemo(() => {
    return JSON.stringify(draft) !== JSON.stringify(original);
  }, [draft, original]);

  // Toggle section collapse
  const toggleSection = (sectionId: string) => {
    setCollapsedSections(prev => {
      const next = new Set(prev);
      if (next.has(sectionId)) {
        next.delete(sectionId);
      } else {
        next.add(sectionId);
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
      setError(err instanceof Error ? err.message : 'Failed to create kickoff plan');
    } finally {
      setIsSaving(false);
    }
  };

  // Update title
  const updateTitle = (value: string) => {
    setDraft(prev => ({ ...prev, title: value }));
  };

  // Update meeting date
  const updateMeetingDate = (value: string) => {
    setDraft(prev => ({ ...prev, meetingDate: value }));
  };

  // Update meeting duration
  const updateMeetingDuration = (value: string) => {
    setDraft(prev => ({ ...prev, meetingDuration: value }));
  };

  // Update notes
  const updateNotes = (value: string) => {
    setDraft(prev => ({ ...prev, notes: value }));
  };

  // ============================================
  // Attendee Operations
  // ============================================

  const addAttendee = () => {
    setDraft(prev => ({
      ...prev,
      attendees: [
        ...prev.attendees,
        { id: `att-${Date.now()}`, name: '', email: '', role: 'Key User' },
      ],
    }));
  };

  const removeAttendee = (id: string) => {
    setDraft(prev => ({
      ...prev,
      attendees: prev.attendees.filter(a => a.id !== id),
    }));
  };

  const updateAttendee = (id: string, field: keyof Attendee, value: string) => {
    setDraft(prev => ({
      ...prev,
      attendees: prev.attendees.map(a =>
        a.id === id ? { ...a, [field]: value } : a
      ),
    }));
  };

  // ============================================
  // Agenda Operations
  // ============================================

  const addAgendaItem = () => {
    setDraft(prev => ({
      ...prev,
      agenda: [
        ...prev.agenda,
        { id: `agenda-${Date.now()}`, topic: '', duration: '10 min', owner: 'CSM' },
      ],
    }));
  };

  const removeAgendaItem = (id: string) => {
    setDraft(prev => ({
      ...prev,
      agenda: prev.agenda.filter(a => a.id !== id),
    }));
  };

  const updateAgendaItem = (id: string, field: keyof AgendaItem, value: string) => {
    setDraft(prev => ({
      ...prev,
      agenda: prev.agenda.map(a =>
        a.id === id ? { ...a, [field]: value } : a
      ),
    }));
  };

  const reorderAgendaItem = (index: number, direction: 'up' | 'down') => {
    const newIndex = direction === 'up' ? index - 1 : index + 1;
    if (newIndex < 0 || newIndex >= draft.agenda.length) return;

    setDraft(prev => {
      const items = [...prev.agenda];
      const [item] = items.splice(index, 1);
      items.splice(newIndex, 0, item);
      return { ...prev, agenda: items };
    });
  };

  // ============================================
  // Goals Operations
  // ============================================

  const addGoal = () => {
    setDraft(prev => ({
      ...prev,
      goals: [
        ...prev.goals,
        { id: `goal-${Date.now()}`, goal: '' },
      ],
    }));
  };

  const removeGoal = (id: string) => {
    setDraft(prev => ({
      ...prev,
      goals: prev.goals.filter(g => g.id !== id),
    }));
  };

  const updateGoal = (id: string, value: string) => {
    setDraft(prev => ({
      ...prev,
      goals: prev.goals.map(g =>
        g.id === id ? { ...g, goal: value } : g
      ),
    }));
  };

  // ============================================
  // Next Steps Operations
  // ============================================

  const addNextStep = () => {
    const defaultDate = new Date();
    defaultDate.setDate(defaultDate.getDate() + 7);

    setDraft(prev => ({
      ...prev,
      nextSteps: [
        ...prev.nextSteps,
        {
          id: `step-${Date.now()}`,
          action: '',
          owner: 'CSM',
          dueDate: defaultDate.toISOString().split('T')[0],
        },
      ],
    }));
  };

  const removeNextStep = (id: string) => {
    setDraft(prev => ({
      ...prev,
      nextSteps: prev.nextSteps.filter(s => s.id !== id),
    }));
  };

  const updateNextStep = (id: string, field: keyof NextStep, value: string) => {
    setDraft(prev => ({
      ...prev,
      nextSteps: prev.nextSteps.map(s =>
        s.id === id ? { ...s, [field]: value } : s
      ),
    }));
  };

  const reorderNextStep = (index: number, direction: 'up' | 'down') => {
    const newIndex = direction === 'up' ? index - 1 : index + 1;
    if (newIndex < 0 || newIndex >= draft.nextSteps.length) return;

    setDraft(prev => {
      const items = [...prev.nextSteps];
      const [item] = items.splice(index, 1);
      items.splice(newIndex, 0, item);
      return { ...prev, nextSteps: items };
    });
  };

  // Base input class
  const inputClass = 'w-full bg-cscx-gray-900/50 border border-cscx-gray-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-teal-500 disabled:opacity-50';
  const smallInputClass = 'bg-cscx-gray-900/50 border border-cscx-gray-700 rounded-lg px-2 py-1.5 text-white text-xs focus:outline-none focus:border-teal-500 disabled:opacity-50';

  return (
    <div className="bg-cscx-gray-800 border border-cscx-gray-700 rounded-xl overflow-hidden max-h-[80vh] overflow-y-auto">
      {/* Header */}
      <div className="bg-gradient-to-r from-teal-600/20 to-transparent p-4 border-b border-cscx-gray-700 sticky top-0 z-10 bg-cscx-gray-800">
        <div className="flex items-start justify-between">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-2xl">🚀</span>
              <h3 className="text-white font-semibold">Kickoff Plan Preview</h3>
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
        {/* Meeting Details Section */}
        <div>
          <h4 className="text-xs font-medium text-cscx-gray-400 uppercase tracking-wider mb-3">
            Meeting Details
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
                placeholder="Kickoff meeting title..."
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-cscx-gray-400 block mb-1">Date</label>
                <input
                  type="date"
                  value={draft.meetingDate}
                  onChange={(e) => updateMeetingDate(e.target.value)}
                  disabled={isSaving}
                  className={inputClass}
                />
              </div>
              <div>
                <label className="text-xs text-cscx-gray-400 block mb-1">Duration</label>
                <select
                  value={draft.meetingDuration}
                  onChange={(e) => updateMeetingDuration(e.target.value)}
                  disabled={isSaving}
                  className={inputClass}
                >
                  <option value="30 min">30 min</option>
                  <option value="45 min">45 min</option>
                  <option value="60 min">60 min</option>
                  <option value="90 min">90 min</option>
                  <option value="120 min">120 min</option>
                </select>
              </div>
            </div>
          </div>
        </div>

        {/* Attendees Section */}
        <div>
          <div
            className="flex items-center justify-between cursor-pointer"
            onClick={() => toggleSection('attendees')}
          >
            <h4 className="text-xs font-medium text-cscx-gray-400 uppercase tracking-wider flex items-center gap-2">
              <span>👥</span>
              Attendees ({draft.attendees.length})
            </h4>
            <span className="text-cscx-gray-500 text-xs">
              {collapsedSections.has('attendees') ? '+ Expand' : '- Collapse'}
            </span>
          </div>
          {!collapsedSections.has('attendees') && (
            <div className="mt-3 space-y-2">
              {draft.attendees.map((attendee) => (
                <div
                  key={attendee.id}
                  className="bg-cscx-gray-900/30 border border-cscx-gray-700 rounded-lg p-2 flex gap-2"
                >
                  <input
                    type="text"
                    value={attendee.name}
                    onChange={(e) => updateAttendee(attendee.id, 'name', e.target.value)}
                    disabled={isSaving}
                    className={`flex-1 ${smallInputClass}`}
                    placeholder="Name"
                  />
                  <input
                    type="email"
                    value={attendee.email}
                    onChange={(e) => updateAttendee(attendee.id, 'email', e.target.value)}
                    disabled={isSaving}
                    className={`flex-1 ${smallInputClass}`}
                    placeholder="Email"
                  />
                  <select
                    value={attendee.role}
                    onChange={(e) => updateAttendee(attendee.id, 'role', e.target.value)}
                    disabled={isSaving}
                    className={`w-32 ${smallInputClass}`}
                  >
                    {ROLE_OPTIONS.map(role => (
                      <option key={role} value={role}>{role}</option>
                    ))}
                  </select>
                  <button
                    onClick={() => removeAttendee(attendee.id)}
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
                onClick={addAttendee}
                disabled={isSaving}
                className="text-xs px-3 py-1.5 bg-cscx-gray-700 hover:bg-cscx-gray-600 text-cscx-gray-300 rounded-lg transition-colors disabled:opacity-50"
              >
                + Add Attendee
              </button>
            </div>
          )}
        </div>

        {/* Agenda Section */}
        <div>
          <div
            className="flex items-center justify-between cursor-pointer"
            onClick={() => toggleSection('agenda')}
          >
            <h4 className="text-xs font-medium text-cscx-gray-400 uppercase tracking-wider flex items-center gap-2">
              <span>📋</span>
              Agenda ({draft.agenda.length} items)
            </h4>
            <span className="text-cscx-gray-500 text-xs">
              {collapsedSections.has('agenda') ? '+ Expand' : '- Collapse'}
            </span>
          </div>
          {!collapsedSections.has('agenda') && (
            <div className="mt-3 space-y-2">
              {draft.agenda.map((item, index) => (
                <div
                  key={item.id}
                  className="bg-cscx-gray-900/30 border border-cscx-gray-700 rounded-lg p-2"
                >
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-cscx-gray-500 text-xs font-medium w-6">{index + 1}.</span>
                    <input
                      type="text"
                      value={item.topic}
                      onChange={(e) => updateAgendaItem(item.id, 'topic', e.target.value)}
                      disabled={isSaving}
                      className={`flex-1 ${smallInputClass}`}
                      placeholder="Topic"
                    />
                    <div className="flex gap-1">
                      <button
                        onClick={() => reorderAgendaItem(index, 'up')}
                        disabled={isSaving || index === 0}
                        className="p-1 text-cscx-gray-500 hover:text-white disabled:opacity-30 transition-colors"
                        title="Move up"
                      >
                        <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
                        </svg>
                      </button>
                      <button
                        onClick={() => reorderAgendaItem(index, 'down')}
                        disabled={isSaving || index === draft.agenda.length - 1}
                        className="p-1 text-cscx-gray-500 hover:text-white disabled:opacity-30 transition-colors"
                        title="Move down"
                      >
                        <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                        </svg>
                      </button>
                      <button
                        onClick={() => removeAgendaItem(item.id)}
                        disabled={isSaving}
                        className="p-1 text-cscx-gray-500 hover:text-red-400 transition-colors"
                        title="Remove"
                      >
                        <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      </button>
                    </div>
                  </div>
                  <div className="flex gap-2 ml-6">
                    <select
                      value={item.duration}
                      onChange={(e) => updateAgendaItem(item.id, 'duration', e.target.value)}
                      disabled={isSaving}
                      className={`w-24 ${smallInputClass}`}
                    >
                      {DURATION_OPTIONS.map(d => (
                        <option key={d} value={d}>{d}</option>
                      ))}
                    </select>
                    <select
                      value={item.owner}
                      onChange={(e) => updateAgendaItem(item.id, 'owner', e.target.value)}
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
                onClick={addAgendaItem}
                disabled={isSaving}
                className="text-xs px-3 py-1.5 bg-cscx-gray-700 hover:bg-cscx-gray-600 text-cscx-gray-300 rounded-lg transition-colors disabled:opacity-50"
              >
                + Add Agenda Item
              </button>
            </div>
          )}
        </div>

        {/* Goals Section */}
        <div>
          <div
            className="flex items-center justify-between cursor-pointer"
            onClick={() => toggleSection('goals')}
          >
            <h4 className="text-xs font-medium text-cscx-gray-400 uppercase tracking-wider flex items-center gap-2">
              <span>🎯</span>
              Goals ({draft.goals.length})
            </h4>
            <span className="text-cscx-gray-500 text-xs">
              {collapsedSections.has('goals') ? '+ Expand' : '- Collapse'}
            </span>
          </div>
          {!collapsedSections.has('goals') && (
            <div className="mt-3 space-y-2">
              {draft.goals.map((goal, index) => (
                <div key={goal.id} className="flex items-center gap-2">
                  <span className="text-cscx-gray-500 text-xs w-6">{index + 1}.</span>
                  <input
                    type="text"
                    value={goal.goal}
                    onChange={(e) => updateGoal(goal.id, e.target.value)}
                    disabled={isSaving}
                    className={`flex-1 ${smallInputClass}`}
                    placeholder="Enter goal..."
                  />
                  <button
                    onClick={() => removeGoal(goal.id)}
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
                onClick={addGoal}
                disabled={isSaving}
                className="text-xs px-3 py-1.5 bg-cscx-gray-700 hover:bg-cscx-gray-600 text-cscx-gray-300 rounded-lg transition-colors disabled:opacity-50"
              >
                + Add Goal
              </button>
            </div>
          )}
        </div>

        {/* Next Steps Section */}
        <div>
          <div
            className="flex items-center justify-between cursor-pointer"
            onClick={() => toggleSection('nextSteps')}
          >
            <h4 className="text-xs font-medium text-cscx-gray-400 uppercase tracking-wider flex items-center gap-2">
              <span>✅</span>
              Next Steps ({draft.nextSteps.length})
            </h4>
            <span className="text-cscx-gray-500 text-xs">
              {collapsedSections.has('nextSteps') ? '+ Expand' : '- Collapse'}
            </span>
          </div>
          {!collapsedSections.has('nextSteps') && (
            <div className="mt-3 space-y-2">
              {draft.nextSteps.map((step, index) => (
                <div
                  key={step.id}
                  className="bg-cscx-gray-900/30 border border-cscx-gray-700 rounded-lg p-2"
                >
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-cscx-gray-500 text-xs font-medium w-6">{index + 1}.</span>
                    <input
                      type="text"
                      value={step.action}
                      onChange={(e) => updateNextStep(step.id, 'action', e.target.value)}
                      disabled={isSaving}
                      className={`flex-1 ${smallInputClass}`}
                      placeholder="Action item..."
                    />
                    <div className="flex gap-1">
                      <button
                        onClick={() => reorderNextStep(index, 'up')}
                        disabled={isSaving || index === 0}
                        className="p-1 text-cscx-gray-500 hover:text-white disabled:opacity-30 transition-colors"
                        title="Move up"
                      >
                        <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
                        </svg>
                      </button>
                      <button
                        onClick={() => reorderNextStep(index, 'down')}
                        disabled={isSaving || index === draft.nextSteps.length - 1}
                        className="p-1 text-cscx-gray-500 hover:text-white disabled:opacity-30 transition-colors"
                        title="Move down"
                      >
                        <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                        </svg>
                      </button>
                      <button
                        onClick={() => removeNextStep(step.id)}
                        disabled={isSaving}
                        className="p-1 text-cscx-gray-500 hover:text-red-400 transition-colors"
                        title="Remove"
                      >
                        <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      </button>
                    </div>
                  </div>
                  <div className="flex gap-2 ml-6">
                    <select
                      value={step.owner}
                      onChange={(e) => updateNextStep(step.id, 'owner', e.target.value)}
                      disabled={isSaving}
                      className={`w-32 ${smallInputClass}`}
                    >
                      {OWNER_OPTIONS.map(o => (
                        <option key={o} value={o}>{o}</option>
                      ))}
                    </select>
                    <input
                      type="date"
                      value={step.dueDate}
                      onChange={(e) => updateNextStep(step.id, 'dueDate', e.target.value)}
                      disabled={isSaving}
                      className={`w-36 ${smallInputClass}`}
                    />
                  </div>
                </div>
              ))}
              <button
                onClick={addNextStep}
                disabled={isSaving}
                className="text-xs px-3 py-1.5 bg-cscx-gray-700 hover:bg-cscx-gray-600 text-cscx-gray-300 rounded-lg transition-colors disabled:opacity-50"
              >
                + Add Next Step
              </button>
            </div>
          )}
        </div>

        {/* Notes Section */}
        <div>
          <h4 className="text-xs font-medium text-cscx-gray-400 uppercase tracking-wider mb-2 flex items-center gap-2">
            <span>📝</span>
            Notes
          </h4>
          <textarea
            value={draft.notes}
            onChange={(e) => updateNotes(e.target.value)}
            disabled={isSaving}
            rows={3}
            className={`${inputClass} resize-y`}
            placeholder="Additional notes or context for the kickoff..."
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
          className="flex-1 px-4 py-2.5 bg-teal-600 hover:bg-teal-700 text-white text-sm font-medium rounded-lg transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
        >
          {isSaving ? (
            <>
              <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent" />
              Creating...
            </>
          ) : (
            <>
              <span>📄</span>
              Create Kickoff Plan
            </>
          )}
        </button>
      </div>
    </div>
  );
};

export default CADGKickoffPlanPreview;
