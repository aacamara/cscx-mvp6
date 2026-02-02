/**
 * CADGMeetingPrepPreview - Editable meeting prep preview for CADG-generated meeting briefs
 * Allows users to review, edit, enhance with AI, and approve before saving
 */

import React, { useState, useMemo } from 'react';
import { useAuth } from '../../context/AuthContext';

// ============================================
// Types
// ============================================

export interface AgendaItem {
  id: string;
  topic: string;
  duration?: string;
  notes?: string;
}

export interface TalkingPoint {
  id: string;
  point: string;
  supporting?: string;
}

export interface RiskItem {
  id: string;
  risk: string;
  mitigation?: string;
}

export interface MeetingPrepData {
  title: string;
  attendees: string[];
  agenda: AgendaItem[];
  talkingPoints: TalkingPoint[];
  risks: RiskItem[];
}

export interface CustomerData {
  id: string;
  name: string;
  healthScore?: number;
  renewalDate?: string;
}

interface SaveResult {
  documentUrl?: string;
}

interface CADGMeetingPrepPreviewProps {
  meetingPrep: MeetingPrepData;
  customer: CustomerData;
  onSave: (meetingPrep: MeetingPrepData) => Promise<SaveResult | void>;
  onCancel: () => void;
  onSaveAndBook?: (meetingPrep: MeetingPrepData, documentUrl: string) => void;
}

// ============================================
// Component
// ============================================

export const CADGMeetingPrepPreview: React.FC<CADGMeetingPrepPreviewProps> = ({
  meetingPrep,
  customer,
  onSave,
  onCancel,
  onSaveAndBook,
}) => {
  const { getAuthHeaders } = useAuth();

  // Original data (for tracking modifications)
  const [original] = useState<MeetingPrepData>(() => ({
    title: meetingPrep.title,
    attendees: [...meetingPrep.attendees],
    agenda: meetingPrep.agenda.map(a => ({ ...a })),
    talkingPoints: meetingPrep.talkingPoints.map(t => ({ ...t })),
    risks: meetingPrep.risks.map(r => ({ ...r })),
  }));

  // Editable draft state
  const [draft, setDraft] = useState<MeetingPrepData>(() => ({
    title: meetingPrep.title,
    attendees: [...meetingPrep.attendees],
    agenda: meetingPrep.agenda.map(a => ({ ...a })),
    talkingPoints: meetingPrep.talkingPoints.map(t => ({ ...t })),
    risks: meetingPrep.risks.map(r => ({ ...r })),
  }));

  // UI state
  const [isSaving, setIsSaving] = useState(false);
  const [isSavingAndBooking, setIsSavingAndBooking] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // AI suggestion state
  const [agendaSuggestions, setAgendaSuggestions] = useState<string[] | null>(null);
  const [talkingPointSuggestions, setTalkingPointSuggestions] = useState<string[] | null>(null);
  const [isLoadingAgenda, setIsLoadingAgenda] = useState(false);
  const [isLoadingTalkingPoints, setIsLoadingTalkingPoints] = useState(false);

  // Check if draft has been modified from original
  const isModified = useMemo(() => {
    if (draft.title !== original.title) return true;
    if (draft.attendees.join(',') !== original.attendees.join(',')) return true;
    if (draft.agenda.length !== original.agenda.length) return true;
    if (draft.talkingPoints.length !== original.talkingPoints.length) return true;
    if (draft.risks.length !== original.risks.length) return true;
    return draft.agenda.some((a, i) => a.topic !== original.agenda[i]?.topic) ||
           draft.talkingPoints.some((t, i) => t.point !== original.talkingPoints[i]?.point) ||
           draft.risks.some((r, i) => r.risk !== original.risks[i]?.risk);
  }, [draft, original]);

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
      setError(err instanceof Error ? err.message : 'Failed to save meeting prep');
    } finally {
      setIsSaving(false);
    }
  };

  // Handle save and book
  const handleSaveAndBook = async () => {
    if (!onSaveAndBook) return;

    setIsSavingAndBooking(true);
    setError(null);

    try {
      const result = await onSave(draft);
      const documentUrl = (result && typeof result === 'object' && 'documentUrl' in result)
        ? result.documentUrl || ''
        : '';
      onSaveAndBook(draft, documentUrl);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save meeting prep');
      setIsSavingAndBooking(false);
    }
  };

  // Get AI suggestions for agenda
  const handleGetAgendaSuggestions = async () => {
    setIsLoadingAgenda(true);
    setAgendaSuggestions(null);

    try {
      const response = await fetch(
        `${import.meta.env.VITE_API_URL || ''}/api/cadg/meeting-prep/suggest`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...getAuthHeaders(),
          },
          body: JSON.stringify({
            suggestionType: 'agenda',
            currentItems: draft.agenda.map(a => a.topic),
            customerId: customer.id,
            meetingContext: draft.title,
          }),
        }
      );

      if (!response.ok) {
        throw new Error('Failed to get suggestions');
      }

      const data = await response.json();
      setAgendaSuggestions(data.suggestions || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to get AI suggestions');
    } finally {
      setIsLoadingAgenda(false);
    }
  };

  // Get AI suggestions for talking points
  const handleGetTalkingPointSuggestions = async () => {
    setIsLoadingTalkingPoints(true);
    setTalkingPointSuggestions(null);

    try {
      const response = await fetch(
        `${import.meta.env.VITE_API_URL || ''}/api/cadg/meeting-prep/suggest`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...getAuthHeaders(),
          },
          body: JSON.stringify({
            suggestionType: 'talking_points',
            currentItems: draft.talkingPoints.map(t => t.point),
            customerId: customer.id,
            meetingContext: draft.title,
          }),
        }
      );

      if (!response.ok) {
        throw new Error('Failed to get suggestions');
      }

      const data = await response.json();
      setTalkingPointSuggestions(data.suggestions || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to get AI suggestions');
    } finally {
      setIsLoadingTalkingPoints(false);
    }
  };

  // Apply all agenda suggestions
  const handleApplyAllAgenda = () => {
    if (!agendaSuggestions) return;
    const newItems = agendaSuggestions.map((topic, i) => ({
      id: `agenda-new-${Date.now()}-${i}`,
      topic,
    }));
    setDraft(prev => ({
      ...prev,
      agenda: [...prev.agenda, ...newItems],
    }));
    setAgendaSuggestions(null);
  };

  // Apply single agenda suggestion
  const handleApplySingleAgenda = (topic: string) => {
    setDraft(prev => ({
      ...prev,
      agenda: [...prev.agenda, { id: `agenda-${Date.now()}`, topic }],
    }));
    setAgendaSuggestions(prev => prev?.filter(s => s !== topic) || null);
  };

  // Apply all talking point suggestions
  const handleApplyAllTalkingPoints = () => {
    if (!talkingPointSuggestions) return;
    const newItems = talkingPointSuggestions.map((point, i) => ({
      id: `tp-new-${Date.now()}-${i}`,
      point,
    }));
    setDraft(prev => ({
      ...prev,
      talkingPoints: [...prev.talkingPoints, ...newItems],
    }));
    setTalkingPointSuggestions(null);
  };

  // Apply single talking point suggestion
  const handleApplySingleTalkingPoint = (point: string) => {
    setDraft(prev => ({
      ...prev,
      talkingPoints: [...prev.talkingPoints, { id: `tp-${Date.now()}`, point }],
    }));
    setTalkingPointSuggestions(prev => prev?.filter(s => s !== point) || null);
  };

  // Update handlers
  const updateTitle = (value: string) => {
    setDraft(prev => ({ ...prev, title: value }));
  };

  const updateAttendees = (value: string) => {
    setDraft(prev => ({
      ...prev,
      attendees: value.split(',').map(e => e.trim()).filter(Boolean),
    }));
  };

  const updateAgendaItem = (id: string, topic: string) => {
    setDraft(prev => ({
      ...prev,
      agenda: prev.agenda.map(a => a.id === id ? { ...a, topic } : a),
    }));
  };

  const addAgendaItem = () => {
    setDraft(prev => ({
      ...prev,
      agenda: [...prev.agenda, { id: `agenda-${Date.now()}`, topic: '' }],
    }));
  };

  const removeAgendaItem = (id: string) => {
    setDraft(prev => ({
      ...prev,
      agenda: prev.agenda.filter(a => a.id !== id),
    }));
  };

  const updateTalkingPoint = (id: string, point: string) => {
    setDraft(prev => ({
      ...prev,
      talkingPoints: prev.talkingPoints.map(t => t.id === id ? { ...t, point } : t),
    }));
  };

  const addTalkingPoint = () => {
    setDraft(prev => ({
      ...prev,
      talkingPoints: [...prev.talkingPoints, { id: `tp-${Date.now()}`, point: '' }],
    }));
  };

  const removeTalkingPoint = (id: string) => {
    setDraft(prev => ({
      ...prev,
      talkingPoints: prev.talkingPoints.filter(t => t.id !== id),
    }));
  };

  const updateRisk = (id: string, risk: string) => {
    setDraft(prev => ({
      ...prev,
      risks: prev.risks.map(r => r.id === id ? { ...r, risk } : r),
    }));
  };

  const addRisk = () => {
    setDraft(prev => ({
      ...prev,
      risks: [...prev.risks, { id: `risk-${Date.now()}`, risk: '' }],
    }));
  };

  const removeRisk = (id: string) => {
    setDraft(prev => ({
      ...prev,
      risks: prev.risks.filter(r => r.id !== id),
    }));
  };

  return (
    <div className="bg-cscx-gray-800 border border-cscx-gray-700 rounded-xl overflow-hidden max-h-[80vh] overflow-y-auto">
      {/* Header */}
      <div className="bg-gradient-to-r from-teal-600/20 to-transparent p-4 border-b border-cscx-gray-700 sticky top-0 z-10">
        <div className="flex items-start justify-between">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-2xl">📋</span>
              <h3 className="text-white font-semibold">Meeting Prep Preview</h3>
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

      {/* Form */}
      <div className="p-4 space-y-6">
        {/* Meeting Title */}
        <div>
          <label className="text-xs font-medium text-cscx-gray-400 uppercase tracking-wider block mb-1.5">
            Meeting Title
          </label>
          <input
            type="text"
            value={draft.title}
            onChange={(e) => updateTitle(e.target.value)}
            disabled={isSaving}
            className="w-full bg-cscx-gray-900/50 border border-cscx-gray-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-teal-500 disabled:opacity-50"
            placeholder="Meeting title"
          />
        </div>

        {/* Attendees */}
        <div>
          <label className="text-xs font-medium text-cscx-gray-400 uppercase tracking-wider block mb-1.5">
            Attendees
          </label>
          <input
            type="text"
            value={draft.attendees.join(', ')}
            onChange={(e) => updateAttendees(e.target.value)}
            disabled={isSaving}
            className="w-full bg-cscx-gray-900/50 border border-cscx-gray-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-teal-500 disabled:opacity-50"
            placeholder="email@example.com, another@example.com"
          />
        </div>

        {/* Agenda */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <label className="text-xs font-medium text-cscx-gray-400 uppercase tracking-wider">
              Agenda ({draft.agenda.length})
            </label>
            <div className="flex gap-2">
              <button
                onClick={handleGetAgendaSuggestions}
                disabled={isLoadingAgenda || isSaving}
                className="text-xs px-2 py-1 bg-blue-900/30 hover:bg-blue-900/50 text-blue-300 rounded-lg transition-colors disabled:opacity-50 flex items-center gap-1"
              >
                {isLoadingAgenda ? (
                  <div className="animate-spin rounded-full h-3 w-3 border-2 border-blue-300 border-t-transparent" />
                ) : (
                  <span>✨</span>
                )}
                Suggest Agenda
              </button>
              <button
                onClick={addAgendaItem}
                disabled={isSaving}
                className="text-xs px-2 py-1 bg-teal-900/30 hover:bg-teal-900/50 text-teal-300 rounded-lg transition-colors disabled:opacity-50"
              >
                + Add
              </button>
            </div>
          </div>
          <div className="space-y-2">
            {draft.agenda.map((item, i) => (
              <div key={item.id} className="flex items-center gap-2">
                <span className="text-cscx-gray-500 text-sm w-6">{i + 1}.</span>
                <input
                  type="text"
                  value={item.topic}
                  onChange={(e) => updateAgendaItem(item.id, e.target.value)}
                  disabled={isSaving}
                  className="flex-1 bg-cscx-gray-900/50 border border-cscx-gray-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-teal-500 disabled:opacity-50"
                  placeholder="Agenda topic"
                />
                <button
                  onClick={() => removeAgendaItem(item.id)}
                  disabled={isSaving}
                  className="text-cscx-gray-500 hover:text-red-400 transition-colors disabled:opacity-30 p-1"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            ))}
          </div>
          {/* Agenda Suggestions */}
          {agendaSuggestions && agendaSuggestions.length > 0 && (
            <div className="mt-3 bg-blue-900/20 border border-blue-500 rounded-lg p-3">
              <div className="flex items-center justify-between mb-2">
                <span className="text-blue-400 text-xs font-medium flex items-center gap-1">
                  <span>💡</span> Suggested Agenda Items
                </span>
                <div className="flex gap-2">
                  <button
                    onClick={handleApplyAllAgenda}
                    className="text-xs px-2 py-1 bg-blue-600 hover:bg-blue-700 text-white rounded transition-colors"
                  >
                    Apply All
                  </button>
                  <button
                    onClick={() => setAgendaSuggestions(null)}
                    className="text-xs px-2 py-1 bg-cscx-gray-700 hover:bg-cscx-gray-600 text-white rounded transition-colors"
                  >
                    Dismiss
                  </button>
                </div>
              </div>
              <div className="space-y-1">
                {agendaSuggestions.map((suggestion, i) => (
                  <div key={i} className="flex items-center gap-2 text-blue-200 text-sm">
                    <button
                      onClick={() => handleApplySingleAgenda(suggestion)}
                      className="text-blue-400 hover:text-blue-300 transition-colors"
                    >
                      +
                    </button>
                    <span>{suggestion}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Talking Points */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <label className="text-xs font-medium text-cscx-gray-400 uppercase tracking-wider">
              Talking Points ({draft.talkingPoints.length})
            </label>
            <div className="flex gap-2">
              <button
                onClick={handleGetTalkingPointSuggestions}
                disabled={isLoadingTalkingPoints || isSaving}
                className="text-xs px-2 py-1 bg-blue-900/30 hover:bg-blue-900/50 text-blue-300 rounded-lg transition-colors disabled:opacity-50 flex items-center gap-1"
              >
                {isLoadingTalkingPoints ? (
                  <div className="animate-spin rounded-full h-3 w-3 border-2 border-blue-300 border-t-transparent" />
                ) : (
                  <span>✨</span>
                )}
                Suggest Points
              </button>
              <button
                onClick={addTalkingPoint}
                disabled={isSaving}
                className="text-xs px-2 py-1 bg-teal-900/30 hover:bg-teal-900/50 text-teal-300 rounded-lg transition-colors disabled:opacity-50"
              >
                + Add
              </button>
            </div>
          </div>
          <div className="space-y-2">
            {draft.talkingPoints.map((item, i) => (
              <div key={item.id} className="flex items-start gap-2">
                <span className="text-cscx-gray-500 text-sm w-6 pt-2">•</span>
                <textarea
                  value={item.point}
                  onChange={(e) => updateTalkingPoint(item.id, e.target.value)}
                  disabled={isSaving}
                  rows={2}
                  className="flex-1 bg-cscx-gray-900/50 border border-cscx-gray-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-teal-500 disabled:opacity-50 resize-none"
                  placeholder="Talking point"
                />
                <button
                  onClick={() => removeTalkingPoint(item.id)}
                  disabled={isSaving}
                  className="text-cscx-gray-500 hover:text-red-400 transition-colors disabled:opacity-30 p-1 mt-1"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            ))}
          </div>
          {/* Talking Point Suggestions */}
          {talkingPointSuggestions && talkingPointSuggestions.length > 0 && (
            <div className="mt-3 bg-blue-900/20 border border-blue-500 rounded-lg p-3">
              <div className="flex items-center justify-between mb-2">
                <span className="text-blue-400 text-xs font-medium flex items-center gap-1">
                  <span>💡</span> Suggested Talking Points
                </span>
                <div className="flex gap-2">
                  <button
                    onClick={handleApplyAllTalkingPoints}
                    className="text-xs px-2 py-1 bg-blue-600 hover:bg-blue-700 text-white rounded transition-colors"
                  >
                    Apply All
                  </button>
                  <button
                    onClick={() => setTalkingPointSuggestions(null)}
                    className="text-xs px-2 py-1 bg-cscx-gray-700 hover:bg-cscx-gray-600 text-white rounded transition-colors"
                  >
                    Dismiss
                  </button>
                </div>
              </div>
              <div className="space-y-1">
                {talkingPointSuggestions.map((suggestion, i) => (
                  <div key={i} className="flex items-start gap-2 text-blue-200 text-sm">
                    <button
                      onClick={() => handleApplySingleTalkingPoint(suggestion)}
                      className="text-blue-400 hover:text-blue-300 transition-colors mt-0.5"
                    >
                      +
                    </button>
                    <span>{suggestion}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Risks */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <label className="text-xs font-medium text-cscx-gray-400 uppercase tracking-wider">
              Risks & Concerns ({draft.risks.length})
            </label>
            <button
              onClick={addRisk}
              disabled={isSaving}
              className="text-xs px-2 py-1 bg-teal-900/30 hover:bg-teal-900/50 text-teal-300 rounded-lg transition-colors disabled:opacity-50"
            >
              + Add
            </button>
          </div>
          <div className="space-y-2">
            {draft.risks.map((item) => (
              <div key={item.id} className="flex items-start gap-2">
                <span className="text-red-400 text-sm w-6 pt-2">!</span>
                <textarea
                  value={item.risk}
                  onChange={(e) => updateRisk(item.id, e.target.value)}
                  disabled={isSaving}
                  rows={2}
                  className="flex-1 bg-cscx-gray-900/50 border border-cscx-gray-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-teal-500 disabled:opacity-50 resize-none"
                  placeholder="Risk or concern to address"
                />
                <button
                  onClick={() => removeRisk(item.id)}
                  disabled={isSaving}
                  className="text-cscx-gray-500 hover:text-red-400 transition-colors disabled:opacity-30 p-1 mt-1"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            ))}
            {draft.risks.length === 0 && (
              <p className="text-cscx-gray-500 text-sm italic">No risks identified. Add any concerns to address.</p>
            )}
          </div>
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
          disabled={isSaving || isSavingAndBooking}
          className="px-4 py-2.5 bg-cscx-gray-700 hover:bg-cscx-gray-600 text-white text-sm font-medium rounded-lg transition-colors disabled:opacity-50"
        >
          Cancel
        </button>
        <button
          onClick={handleSave}
          disabled={isSaving || isSavingAndBooking || !draft.title}
          className="px-4 py-2.5 border border-teal-600 text-teal-400 hover:bg-teal-900/30 text-sm font-medium rounded-lg transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
        >
          {isSaving ? (
            <>
              <div className="animate-spin rounded-full h-4 w-4 border-2 border-teal-400 border-t-transparent" />
              Saving...
            </>
          ) : (
            'Save Only'
          )}
        </button>
        {onSaveAndBook && (
          <button
            onClick={handleSaveAndBook}
            disabled={isSaving || isSavingAndBooking || !draft.title}
            className="flex-1 px-4 py-2.5 bg-teal-600 hover:bg-teal-700 text-white text-sm font-medium rounded-lg transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {isSavingAndBooking ? (
              <>
                <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent" />
                Saving...
              </>
            ) : (
              <>
                <span>&#x1F4C5;</span>
                Save & Book Meeting
              </>
            )}
          </button>
        )}
      </div>
    </div>
  );
};

export default CADGMeetingPrepPreview;
