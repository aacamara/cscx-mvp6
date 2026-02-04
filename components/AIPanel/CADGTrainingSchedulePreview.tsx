/**
 * CADGTrainingSchedulePreview - Editable training schedule preview for CADG-generated training plans
 * Allows users to review, edit, and approve sessions with dates, attendees, and topics before creating document
 */

import React, { useState, useMemo } from 'react';
import { useAuth } from '../../context/AuthContext';

// ============================================
// Types
// ============================================

export interface TrainingSession {
  id: string;
  name: string;
  description: string;
  date: string;
  time: string;
  duration: string;
  trainer: string;
  attendeeGroups: string[];
  topics: string[];
  prerequisites: string[];
}

export interface TrainingScheduleData {
  title: string;
  sessions: TrainingSession[];
  notes: string;
  startDate: string;
}

export interface CustomerData {
  id: string;
  name: string;
  healthScore?: number;
  renewalDate?: string;
}

interface CADGTrainingSchedulePreviewProps {
  trainingSchedule: TrainingScheduleData;
  customer: CustomerData;
  onSave: (trainingSchedule: TrainingScheduleData) => Promise<void>;
  onCancel: () => void;
}

// ============================================
// Options
// ============================================
const TRAINER_OPTIONS = ['CSM', 'Product Expert', 'Implementation Team', 'Support', 'Customer Champion', 'External Trainer'];
const DURATION_OPTIONS = ['30 min', '45 min', '60 min', '90 min', '120 min'];
const ATTENDEE_GROUP_OPTIONS = ['All Users', 'Admins', 'Power Users', 'End Users', 'Executives', 'Technical Team', 'New Hires'];

// ============================================
// Component
// ============================================

export const CADGTrainingSchedulePreview: React.FC<CADGTrainingSchedulePreviewProps> = ({
  trainingSchedule,
  customer,
  onSave,
  onCancel,
}) => {
  const { getAuthHeaders } = useAuth();

  // Original data (for tracking modifications)
  const [original] = useState<TrainingScheduleData>(() => JSON.parse(JSON.stringify(trainingSchedule)));

  // Editable draft state
  const [draft, setDraft] = useState<TrainingScheduleData>(() => JSON.parse(JSON.stringify(trainingSchedule)));

  // UI state
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [expandedSessions, setExpandedSessions] = useState<Set<string>>(new Set([draft.sessions[0]?.id || '']));

  // Check if draft has been modified
  const isModified = useMemo(() => {
    return JSON.stringify(draft) !== JSON.stringify(original);
  }, [draft, original]);

  // Toggle session expand/collapse
  const toggleSession = (sessionId: string) => {
    setExpandedSessions(prev => {
      const next = new Set(prev);
      if (next.has(sessionId)) {
        next.delete(sessionId);
      } else {
        next.add(sessionId);
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
      setError(err instanceof Error ? err.message : 'Failed to create training schedule');
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
  // Session Operations
  // ============================================

  const addSession = () => {
    const newDate = new Date();
    newDate.setDate(newDate.getDate() + 7);

    setDraft(prev => ({
      ...prev,
      sessions: [
        ...prev.sessions,
        {
          id: `session-${Date.now()}`,
          name: '',
          description: '',
          date: newDate.toISOString().split('T')[0],
          time: '10:00',
          duration: '60 min',
          trainer: 'CSM',
          attendeeGroups: [],
          topics: [],
          prerequisites: [],
        },
      ],
    }));
  };

  const removeSession = (sessionId: string) => {
    setDraft(prev => ({
      ...prev,
      sessions: prev.sessions.filter(s => s.id !== sessionId),
    }));
  };

  const updateSession = (sessionId: string, field: keyof TrainingSession, value: any) => {
    setDraft(prev => ({
      ...prev,
      sessions: prev.sessions.map(s =>
        s.id === sessionId ? { ...s, [field]: value } : s
      ),
    }));
  };

  const moveSession = (sessionId: string, direction: 'up' | 'down') => {
    setDraft(prev => {
      const index = prev.sessions.findIndex(s => s.id === sessionId);
      if (
        (direction === 'up' && index === 0) ||
        (direction === 'down' && index === prev.sessions.length - 1)
      ) {
        return prev;
      }

      const newSessions = [...prev.sessions];
      const swapIndex = direction === 'up' ? index - 1 : index + 1;
      [newSessions[index], newSessions[swapIndex]] = [newSessions[swapIndex], newSessions[index]];

      return { ...prev, sessions: newSessions };
    });
  };

  // ============================================
  // Topic Operations
  // ============================================

  const addTopic = (sessionId: string) => {
    setDraft(prev => ({
      ...prev,
      sessions: prev.sessions.map(s =>
        s.id === sessionId
          ? { ...s, topics: [...s.topics, ''] }
          : s
      ),
    }));
  };

  const updateTopic = (sessionId: string, topicIndex: number, value: string) => {
    setDraft(prev => ({
      ...prev,
      sessions: prev.sessions.map(s =>
        s.id === sessionId
          ? {
              ...s,
              topics: s.topics.map((t, i) => (i === topicIndex ? value : t)),
            }
          : s
      ),
    }));
  };

  const removeTopic = (sessionId: string, topicIndex: number) => {
    setDraft(prev => ({
      ...prev,
      sessions: prev.sessions.map(s =>
        s.id === sessionId
          ? { ...s, topics: s.topics.filter((_, i) => i !== topicIndex) }
          : s
      ),
    }));
  };

  // ============================================
  // Prerequisite Operations
  // ============================================

  const addPrerequisite = (sessionId: string) => {
    setDraft(prev => ({
      ...prev,
      sessions: prev.sessions.map(s =>
        s.id === sessionId
          ? { ...s, prerequisites: [...s.prerequisites, ''] }
          : s
      ),
    }));
  };

  const updatePrerequisite = (sessionId: string, prereqIndex: number, value: string) => {
    setDraft(prev => ({
      ...prev,
      sessions: prev.sessions.map(s =>
        s.id === sessionId
          ? {
              ...s,
              prerequisites: s.prerequisites.map((p, i) => (i === prereqIndex ? value : p)),
            }
          : s
      ),
    }));
  };

  const removePrerequisite = (sessionId: string, prereqIndex: number) => {
    setDraft(prev => ({
      ...prev,
      sessions: prev.sessions.map(s =>
        s.id === sessionId
          ? { ...s, prerequisites: s.prerequisites.filter((_, i) => i !== prereqIndex) }
          : s
      ),
    }));
  };

  // ============================================
  // Attendee Group Operations
  // ============================================

  const toggleAttendeeGroup = (sessionId: string, group: string) => {
    setDraft(prev => ({
      ...prev,
      sessions: prev.sessions.map(s => {
        if (s.id !== sessionId) return s;
        const hasGroup = s.attendeeGroups.includes(group);
        return {
          ...s,
          attendeeGroups: hasGroup
            ? s.attendeeGroups.filter(g => g !== group)
            : [...s.attendeeGroups, group],
        };
      }),
    }));
  };

  // Base input class
  const inputClass = 'w-full bg-cscx-gray-900/50 border border-cscx-gray-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-cyan-500 disabled:opacity-50';
  const smallInputClass = 'bg-cscx-gray-900/50 border border-cscx-gray-700 rounded-lg px-2 py-1.5 text-white text-xs focus:outline-none focus:border-cyan-500 disabled:opacity-50';

  // Format date for display
  const formatDate = (dateStr: string) => {
    try {
      const date = new Date(dateStr + 'T00:00:00');
      return date.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
    } catch {
      return dateStr;
    }
  };

  return (
    <div className="bg-cscx-gray-800 border border-cscx-gray-700 rounded-xl overflow-hidden max-h-[80vh] overflow-y-auto">
      {/* Header */}
      <div className="bg-gradient-to-r from-cyan-600/20 to-transparent p-4 border-b border-cscx-gray-700 sticky top-0 z-10 bg-cscx-gray-800">
        <div className="flex items-start justify-between">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-2xl">📚</span>
              <h3 className="text-white font-semibold">Training Schedule Preview</h3>
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
        {/* Schedule Details Section */}
        <div>
          <h4 className="text-xs font-medium text-cscx-gray-400 uppercase tracking-wider mb-3">
            Schedule Details
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
                placeholder="Training schedule title..."
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

        {/* Sessions Section */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <h4 className="text-xs font-medium text-cscx-gray-400 uppercase tracking-wider flex items-center gap-2">
              <span>🎓</span>
              Training Sessions ({draft.sessions.length})
            </h4>
            <button
              onClick={addSession}
              disabled={isSaving}
              className="text-xs px-3 py-1.5 bg-cyan-600/30 hover:bg-cyan-600/50 text-cyan-400 rounded-lg transition-colors disabled:opacity-50"
            >
              + Add Session
            </button>
          </div>

          <div className="space-y-3">
            {draft.sessions.map((session, index) => {
              const isExpanded = expandedSessions.has(session.id);

              return (
                <div
                  key={session.id}
                  className="bg-cscx-gray-900/30 border border-cscx-gray-700 rounded-lg overflow-hidden"
                >
                  {/* Session Header */}
                  <button
                    onClick={() => toggleSession(session.id)}
                    className="w-full p-3 flex items-center gap-3 hover:bg-cscx-gray-900/50 transition-colors"
                  >
                    <div className="flex items-center gap-2 flex-1 min-w-0">
                      <span className="text-cyan-400 text-xs font-mono">{index + 1}</span>
                      <div className="flex-1 text-left min-w-0">
                        <p className="text-white text-sm font-medium truncate">
                          {session.name || 'New Session'}
                        </p>
                        <p className="text-cscx-gray-500 text-xs">
                          {formatDate(session.date)} at {session.time} • {session.duration} • {session.trainer}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-cscx-gray-500">
                        {session.topics.length} topics
                      </span>
                      <span className="text-cscx-gray-500 text-xs">
                        {isExpanded ? '▼' : '▶'}
                      </span>
                    </div>
                  </button>

                  {/* Session Details (Expanded) */}
                  {isExpanded && (
                    <div className="p-3 border-t border-cscx-gray-700 space-y-4">
                      {/* Basic Info */}
                      <div className="grid grid-cols-2 gap-3">
                        <div className="col-span-2">
                          <label className="text-xs text-cscx-gray-400 block mb-1">Session Name</label>
                          <input
                            type="text"
                            value={session.name}
                            onChange={(e) => updateSession(session.id, 'name', e.target.value)}
                            disabled={isSaving}
                            className={smallInputClass + ' w-full'}
                            placeholder="Session name..."
                          />
                        </div>
                        <div className="col-span-2">
                          <label className="text-xs text-cscx-gray-400 block mb-1">Description</label>
                          <textarea
                            value={session.description}
                            onChange={(e) => updateSession(session.id, 'description', e.target.value)}
                            disabled={isSaving}
                            rows={2}
                            className={smallInputClass + ' w-full resize-y'}
                            placeholder="Brief description..."
                          />
                        </div>
                        <div>
                          <label className="text-xs text-cscx-gray-400 block mb-1">Date</label>
                          <input
                            type="date"
                            value={session.date}
                            onChange={(e) => updateSession(session.id, 'date', e.target.value)}
                            disabled={isSaving}
                            className={smallInputClass + ' w-full'}
                          />
                        </div>
                        <div>
                          <label className="text-xs text-cscx-gray-400 block mb-1">Time</label>
                          <input
                            type="time"
                            value={session.time}
                            onChange={(e) => updateSession(session.id, 'time', e.target.value)}
                            disabled={isSaving}
                            className={smallInputClass + ' w-full'}
                          />
                        </div>
                        <div>
                          <label className="text-xs text-cscx-gray-400 block mb-1">Duration</label>
                          <select
                            value={session.duration}
                            onChange={(e) => updateSession(session.id, 'duration', e.target.value)}
                            disabled={isSaving}
                            className={smallInputClass + ' w-full'}
                          >
                            {DURATION_OPTIONS.map(d => (
                              <option key={d} value={d}>{d}</option>
                            ))}
                          </select>
                        </div>
                        <div>
                          <label className="text-xs text-cscx-gray-400 block mb-1">Trainer</label>
                          <select
                            value={session.trainer}
                            onChange={(e) => updateSession(session.id, 'trainer', e.target.value)}
                            disabled={isSaving}
                            className={smallInputClass + ' w-full'}
                          >
                            {TRAINER_OPTIONS.map(t => (
                              <option key={t} value={t}>{t}</option>
                            ))}
                          </select>
                        </div>
                      </div>

                      {/* Attendee Groups */}
                      <div>
                        <label className="text-xs text-cscx-gray-400 block mb-2">Attendee Groups</label>
                        <div className="flex flex-wrap gap-2">
                          {ATTENDEE_GROUP_OPTIONS.map(group => {
                            const isSelected = session.attendeeGroups.includes(group);
                            return (
                              <button
                                key={group}
                                onClick={() => toggleAttendeeGroup(session.id, group)}
                                disabled={isSaving}
                                className={`text-xs px-2 py-1 rounded-full border transition-colors ${
                                  isSelected
                                    ? 'bg-cyan-600/30 border-cyan-600/50 text-cyan-400'
                                    : 'border-cscx-gray-600 text-cscx-gray-400 hover:border-cscx-gray-500'
                                }`}
                              >
                                {isSelected && '✓ '}{group}
                              </button>
                            );
                          })}
                        </div>
                      </div>

                      {/* Topics */}
                      <div>
                        <label className="text-xs text-cscx-gray-400 block mb-2">Topics to Cover</label>
                        <div className="space-y-2">
                          {session.topics.map((topic, topicIndex) => (
                            <div key={topicIndex} className="flex items-center gap-2">
                              <span className="text-cscx-gray-500 text-xs w-4">{topicIndex + 1}.</span>
                              <input
                                type="text"
                                value={topic}
                                onChange={(e) => updateTopic(session.id, topicIndex, e.target.value)}
                                disabled={isSaving}
                                className={smallInputClass + ' flex-1'}
                                placeholder="Enter topic..."
                              />
                              <button
                                onClick={() => removeTopic(session.id, topicIndex)}
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
                            onClick={() => addTopic(session.id)}
                            disabled={isSaving}
                            className="text-xs px-2 py-1 bg-cscx-gray-700 hover:bg-cscx-gray-600 text-cscx-gray-300 rounded transition-colors disabled:opacity-50"
                          >
                            + Add Topic
                          </button>
                        </div>
                      </div>

                      {/* Prerequisites */}
                      <div>
                        <label className="text-xs text-cscx-gray-400 block mb-2">Prerequisites</label>
                        <div className="space-y-2">
                          {session.prerequisites.map((prereq, prereqIndex) => (
                            <div key={prereqIndex} className="flex items-center gap-2">
                              <span className="text-cscx-gray-500 text-xs">•</span>
                              <input
                                type="text"
                                value={prereq}
                                onChange={(e) => updatePrerequisite(session.id, prereqIndex, e.target.value)}
                                disabled={isSaving}
                                className={smallInputClass + ' flex-1'}
                                placeholder="Enter prerequisite..."
                              />
                              <button
                                onClick={() => removePrerequisite(session.id, prereqIndex)}
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
                            onClick={() => addPrerequisite(session.id)}
                            disabled={isSaving}
                            className="text-xs px-2 py-1 bg-cscx-gray-700 hover:bg-cscx-gray-600 text-cscx-gray-300 rounded transition-colors disabled:opacity-50"
                          >
                            + Add Prerequisite
                          </button>
                        </div>
                      </div>

                      {/* Session Actions */}
                      <div className="flex items-center justify-between pt-2 border-t border-cscx-gray-700/50">
                        <div className="flex gap-2">
                          <button
                            onClick={() => moveSession(session.id, 'up')}
                            disabled={isSaving || index === 0}
                            className="p-1.5 text-cscx-gray-500 hover:text-white disabled:opacity-30 transition-colors"
                            title="Move up"
                          >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
                            </svg>
                          </button>
                          <button
                            onClick={() => moveSession(session.id, 'down')}
                            disabled={isSaving || index === draft.sessions.length - 1}
                            className="p-1.5 text-cscx-gray-500 hover:text-white disabled:opacity-30 transition-colors"
                            title="Move down"
                          >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                            </svg>
                          </button>
                        </div>
                        <button
                          onClick={() => removeSession(session.id)}
                          disabled={isSaving}
                          className="text-xs px-2 py-1 text-red-400 hover:bg-red-900/30 rounded transition-colors disabled:opacity-50"
                        >
                          Remove Session
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
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
            placeholder="Additional notes or instructions for the training schedule..."
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
          className="flex-1 px-4 py-2.5 bg-cyan-600 hover:bg-cyan-700 text-white text-sm font-medium rounded-lg transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
        >
          {isSaving ? (
            <>
              <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent" />
              Creating...
            </>
          ) : (
            <>
              <span>📄</span>
              Create Training Schedule
            </>
          )}
        </button>
      </div>
    </div>
  );
};

export default CADGTrainingSchedulePreview;
