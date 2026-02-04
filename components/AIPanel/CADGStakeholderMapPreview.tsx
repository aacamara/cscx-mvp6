/**
 * CADGStakeholderMapPreview - Editable stakeholder map preview for CADG-generated stakeholder maps
 * Allows users to review, edit, and approve contact cards with roles and relationships before creating document
 */

import React, { useState, useMemo } from 'react';
import { useAuth } from '../../context/AuthContext';

// ============================================
// Types
// ============================================

export type StakeholderRole = 'Champion' | 'Sponsor' | 'Blocker' | 'Evaluator' | 'User';
export type EngagementLevel = 'High' | 'Medium' | 'Low';

export interface Stakeholder {
  id: string;
  name: string;
  title: string;
  email: string;
  role: StakeholderRole;
  influenceLevel: number; // 1-5
  engagementLevel: EngagementLevel;
  notes: string;
}

export interface Relationship {
  id: string;
  fromId: string;
  toId: string;
  relationship: string;
}

export interface StakeholderMapData {
  title: string;
  stakeholders: Stakeholder[];
  relationships: Relationship[];
  notes: string;
}

export interface CustomerData {
  id: string;
  name: string;
  healthScore?: number;
  renewalDate?: string;
}

interface CADGStakeholderMapPreviewProps {
  stakeholderMap: StakeholderMapData;
  customer: CustomerData;
  onSave: (stakeholderMap: StakeholderMapData) => Promise<void>;
  onCancel: () => void;
}

// ============================================
// Constants
// ============================================

const ROLE_OPTIONS: StakeholderRole[] = ['Champion', 'Sponsor', 'Blocker', 'Evaluator', 'User'];
const ENGAGEMENT_OPTIONS: EngagementLevel[] = ['High', 'Medium', 'Low'];

const ROLE_COLORS: Record<StakeholderRole, { bg: string; text: string; border: string }> = {
  Champion: { bg: 'bg-green-900/30', text: 'text-green-400', border: 'border-green-600/30' },
  Sponsor: { bg: 'bg-blue-900/30', text: 'text-blue-400', border: 'border-blue-600/30' },
  Blocker: { bg: 'bg-red-900/30', text: 'text-red-400', border: 'border-red-600/30' },
  Evaluator: { bg: 'bg-purple-900/30', text: 'text-purple-400', border: 'border-purple-600/30' },
  User: { bg: 'bg-gray-900/30', text: 'text-gray-400', border: 'border-gray-600/30' },
};

const ROLE_ICONS: Record<StakeholderRole, string> = {
  Champion: '⭐',
  Sponsor: '🏛️',
  Blocker: '🚫',
  Evaluator: '🔍',
  User: '👤',
};

// ============================================
// Component
// ============================================

export const CADGStakeholderMapPreview: React.FC<CADGStakeholderMapPreviewProps> = ({
  stakeholderMap,
  customer,
  onSave,
  onCancel,
}) => {
  const { getAuthHeaders } = useAuth();

  // Original data (for tracking modifications)
  const [original] = useState<StakeholderMapData>(() => JSON.parse(JSON.stringify(stakeholderMap)));

  // Editable draft state
  const [draft, setDraft] = useState<StakeholderMapData>(() => JSON.parse(JSON.stringify(stakeholderMap)));

  // UI state
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [expandedStakeholders, setExpandedStakeholders] = useState<Set<string>>(new Set());
  const [showRelationships, setShowRelationships] = useState(true);

  // Check if draft has been modified
  const isModified = useMemo(() => {
    return JSON.stringify(draft) !== JSON.stringify(original);
  }, [draft, original]);

  // Toggle stakeholder expand
  const toggleStakeholder = (stakeholderId: string) => {
    setExpandedStakeholders(prev => {
      const next = new Set(prev);
      if (next.has(stakeholderId)) {
        next.delete(stakeholderId);
      } else {
        next.add(stakeholderId);
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
      setError(err instanceof Error ? err.message : 'Failed to create stakeholder map');
    } finally {
      setIsSaving(false);
    }
  };

  // Update title
  const updateTitle = (value: string) => {
    setDraft(prev => ({ ...prev, title: value }));
  };

  // Update notes
  const updateNotes = (value: string) => {
    setDraft(prev => ({ ...prev, notes: value }));
  };

  // ============================================
  // Stakeholder Operations
  // ============================================

  const addStakeholder = () => {
    setDraft(prev => ({
      ...prev,
      stakeholders: [
        ...prev.stakeholders,
        {
          id: `stakeholder-${Date.now()}`,
          name: '',
          title: '',
          email: '',
          role: 'User' as StakeholderRole,
          influenceLevel: 3,
          engagementLevel: 'Medium' as EngagementLevel,
          notes: '',
        },
      ],
    }));
  };

  const removeStakeholder = (stakeholderId: string) => {
    setDraft(prev => ({
      ...prev,
      stakeholders: prev.stakeholders.filter(s => s.id !== stakeholderId),
      // Also remove relationships involving this stakeholder
      relationships: prev.relationships.filter(
        r => r.fromId !== stakeholderId && r.toId !== stakeholderId
      ),
    }));
  };

  const updateStakeholder = (
    stakeholderId: string,
    field: keyof Stakeholder,
    value: string | number
  ) => {
    setDraft(prev => ({
      ...prev,
      stakeholders: prev.stakeholders.map(s =>
        s.id === stakeholderId ? { ...s, [field]: value } : s
      ),
    }));
  };

  // ============================================
  // Relationship Operations
  // ============================================

  const addRelationship = () => {
    if (draft.stakeholders.length < 2) return;

    setDraft(prev => ({
      ...prev,
      relationships: [
        ...prev.relationships,
        {
          id: `rel-${Date.now()}`,
          fromId: prev.stakeholders[0]?.id || '',
          toId: prev.stakeholders[1]?.id || '',
          relationship: '',
        },
      ],
    }));
  };

  const removeRelationship = (relationshipId: string) => {
    setDraft(prev => ({
      ...prev,
      relationships: prev.relationships.filter(r => r.id !== relationshipId),
    }));
  };

  const updateRelationship = (
    relationshipId: string,
    field: keyof Relationship,
    value: string
  ) => {
    setDraft(prev => ({
      ...prev,
      relationships: prev.relationships.map(r =>
        r.id === relationshipId ? { ...r, [field]: value } : r
      ),
    }));
  };

  // Get stakeholder name by ID
  const getStakeholderName = (stakeholderId: string): string => {
    const stakeholder = draft.stakeholders.find(s => s.id === stakeholderId);
    return stakeholder?.name || 'Unknown';
  };

  // Base input class
  const inputClass = 'w-full bg-cscx-gray-900/50 border border-cscx-gray-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-orange-500 disabled:opacity-50';
  const smallInputClass = 'bg-cscx-gray-900/50 border border-cscx-gray-700 rounded-lg px-2 py-1.5 text-white text-xs focus:outline-none focus:border-orange-500 disabled:opacity-50';

  return (
    <div className="bg-cscx-gray-800 border border-cscx-gray-700 rounded-xl overflow-hidden max-h-[80vh] overflow-y-auto">
      {/* Header */}
      <div className="bg-gradient-to-r from-orange-600/20 to-transparent p-4 border-b border-cscx-gray-700 sticky top-0 z-10 bg-cscx-gray-800">
        <div className="flex items-start justify-between">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-2xl">&#x1F465;</span>
              <h3 className="text-white font-semibold">Stakeholder Map Preview</h3>
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
        {/* Map Title Section */}
        <div>
          <h4 className="text-xs font-medium text-cscx-gray-400 uppercase tracking-wider mb-3">
            Map Title
          </h4>
          <input
            type="text"
            value={draft.title}
            onChange={(e) => updateTitle(e.target.value)}
            disabled={isSaving}
            className={inputClass}
            placeholder="Stakeholder map title..."
          />
        </div>

        {/* Stakeholders Section */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <h4 className="text-xs font-medium text-cscx-gray-400 uppercase tracking-wider flex items-center gap-2">
              <span>&#x1F464;</span>
              Stakeholders ({draft.stakeholders.length})
            </h4>
          </div>

          <div className="space-y-3">
            {draft.stakeholders.map((stakeholder) => {
              const roleColor = ROLE_COLORS[stakeholder.role];
              const isExpanded = expandedStakeholders.has(stakeholder.id);

              return (
                <div
                  key={stakeholder.id}
                  className={`${roleColor.bg} ${roleColor.border} border rounded-lg overflow-hidden`}
                >
                  {/* Stakeholder Header (always visible) */}
                  <div
                    className="p-3 cursor-pointer"
                    onClick={() => toggleStakeholder(stakeholder.id)}
                  >
                    <div className="flex items-center gap-3">
                      <span className="text-lg">{ROLE_ICONS[stakeholder.role]}</span>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <input
                            type="text"
                            value={stakeholder.name}
                            onChange={(e) => {
                              e.stopPropagation();
                              updateStakeholder(stakeholder.id, 'name', e.target.value);
                            }}
                            onClick={(e) => e.stopPropagation()}
                            disabled={isSaving}
                            className={`${smallInputClass} flex-1 font-medium`}
                            placeholder="Name"
                          />
                          <select
                            value={stakeholder.role}
                            onChange={(e) => {
                              e.stopPropagation();
                              updateStakeholder(stakeholder.id, 'role', e.target.value);
                            }}
                            onClick={(e) => e.stopPropagation()}
                            disabled={isSaving}
                            className={`${smallInputClass} w-28 ${roleColor.text}`}
                          >
                            {ROLE_OPTIONS.map(role => (
                              <option key={role} value={role}>{role}</option>
                            ))}
                          </select>
                        </div>
                        <input
                          type="text"
                          value={stakeholder.title}
                          onChange={(e) => {
                            e.stopPropagation();
                            updateStakeholder(stakeholder.id, 'title', e.target.value);
                          }}
                          onClick={(e) => e.stopPropagation()}
                          disabled={isSaving}
                          className={`${smallInputClass} w-full mt-1 text-cscx-gray-400`}
                          placeholder="Job title"
                        />
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            removeStakeholder(stakeholder.id);
                          }}
                          disabled={isSaving}
                          className="p-1 text-cscx-gray-500 hover:text-red-400 transition-colors"
                          title="Remove"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                          </svg>
                        </button>
                        <span className="text-cscx-gray-500 text-xs">
                          {isExpanded ? '▼' : '▶'}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Expanded Details */}
                  {isExpanded && (
                    <div className="px-3 pb-3 space-y-3 border-t border-cscx-gray-700/50">
                      {/* Email */}
                      <div className="pt-3">
                        <label className="text-xs text-cscx-gray-400 block mb-1">Email</label>
                        <input
                          type="email"
                          value={stakeholder.email}
                          onChange={(e) => updateStakeholder(stakeholder.id, 'email', e.target.value)}
                          disabled={isSaving}
                          className={`${smallInputClass} w-full`}
                          placeholder="email@example.com"
                        />
                      </div>

                      {/* Influence & Engagement */}
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className="text-xs text-cscx-gray-400 block mb-1">
                            Influence Level
                          </label>
                          <div className="flex items-center gap-2">
                            <input
                              type="range"
                              min="1"
                              max="5"
                              value={stakeholder.influenceLevel}
                              onChange={(e) => updateStakeholder(stakeholder.id, 'influenceLevel', parseInt(e.target.value))}
                              disabled={isSaving}
                              className="flex-1 accent-orange-500"
                            />
                            <span className="text-xs text-orange-400 font-medium w-4 text-center">
                              {stakeholder.influenceLevel}
                            </span>
                          </div>
                        </div>
                        <div>
                          <label className="text-xs text-cscx-gray-400 block mb-1">
                            Engagement Level
                          </label>
                          <select
                            value={stakeholder.engagementLevel}
                            onChange={(e) => updateStakeholder(stakeholder.id, 'engagementLevel', e.target.value)}
                            disabled={isSaving}
                            className={`${smallInputClass} w-full`}
                          >
                            {ENGAGEMENT_OPTIONS.map(level => (
                              <option key={level} value={level}>{level}</option>
                            ))}
                          </select>
                        </div>
                      </div>

                      {/* Notes */}
                      <div>
                        <label className="text-xs text-cscx-gray-400 block mb-1">Notes</label>
                        <textarea
                          value={stakeholder.notes}
                          onChange={(e) => updateStakeholder(stakeholder.id, 'notes', e.target.value)}
                          disabled={isSaving}
                          rows={2}
                          className={`${smallInputClass} w-full resize-y`}
                          placeholder="Notes about this stakeholder..."
                        />
                      </div>
                    </div>
                  )}
                </div>
              );
            })}

            <button
              onClick={addStakeholder}
              disabled={isSaving}
              className="w-full text-xs px-3 py-2 bg-cscx-gray-700 hover:bg-cscx-gray-600 text-cscx-gray-300 rounded-lg transition-colors disabled:opacity-50"
            >
              + Add Stakeholder
            </button>
          </div>
        </div>

        {/* Relationships Section */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <h4 className="text-xs font-medium text-cscx-gray-400 uppercase tracking-wider flex items-center gap-2">
              <span>&#x1F517;</span>
              Relationships ({draft.relationships.length})
            </h4>
            <button
              onClick={() => setShowRelationships(!showRelationships)}
              className="text-xs text-cscx-gray-500 hover:text-cscx-gray-300"
            >
              {showRelationships ? 'Hide' : 'Show'}
            </button>
          </div>

          {showRelationships && (
            <div className="space-y-2">
              {draft.relationships.map((rel) => (
                <div
                  key={rel.id}
                  className="bg-cscx-gray-900/30 border border-cscx-gray-700 rounded-lg p-2 flex items-center gap-2"
                >
                  <select
                    value={rel.fromId}
                    onChange={(e) => updateRelationship(rel.id, 'fromId', e.target.value)}
                    disabled={isSaving}
                    className={`${smallInputClass} flex-1`}
                  >
                    {draft.stakeholders.map(s => (
                      <option key={s.id} value={s.id}>{s.name || 'Unnamed'}</option>
                    ))}
                  </select>
                  <input
                    type="text"
                    value={rel.relationship}
                    onChange={(e) => updateRelationship(rel.id, 'relationship', e.target.value)}
                    disabled={isSaving}
                    className={`${smallInputClass} w-32`}
                    placeholder="relates to"
                  />
                  <select
                    value={rel.toId}
                    onChange={(e) => updateRelationship(rel.id, 'toId', e.target.value)}
                    disabled={isSaving}
                    className={`${smallInputClass} flex-1`}
                  >
                    {draft.stakeholders.map(s => (
                      <option key={s.id} value={s.id}>{s.name || 'Unnamed'}</option>
                    ))}
                  </select>
                  <button
                    onClick={() => removeRelationship(rel.id)}
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

              {draft.stakeholders.length >= 2 && (
                <button
                  onClick={addRelationship}
                  disabled={isSaving}
                  className="w-full text-xs px-3 py-1.5 bg-cscx-gray-700 hover:bg-cscx-gray-600 text-cscx-gray-300 rounded-lg transition-colors disabled:opacity-50"
                >
                  + Add Relationship
                </button>
              )}

              {draft.stakeholders.length < 2 && (
                <p className="text-xs text-cscx-gray-500 text-center py-2">
                  Add at least 2 stakeholders to define relationships
                </p>
              )}
            </div>
          )}
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
            placeholder="Overall notes about the stakeholder landscape..."
          />
        </div>

        {/* Role Legend */}
        <div className="bg-cscx-gray-900/30 rounded-lg p-3">
          <h5 className="text-xs font-medium text-cscx-gray-400 mb-2">Role Legend</h5>
          <div className="flex flex-wrap gap-2">
            {ROLE_OPTIONS.map(role => (
              <span
                key={role}
                className={`text-xs ${ROLE_COLORS[role].bg} ${ROLE_COLORS[role].text} px-2 py-1 rounded-full flex items-center gap-1`}
              >
                <span>{ROLE_ICONS[role]}</span>
                {role}
              </span>
            ))}
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
          disabled={isSaving}
          className="flex-1 px-4 py-2.5 bg-cscx-gray-700 hover:bg-cscx-gray-600 text-white text-sm font-medium rounded-lg transition-colors disabled:opacity-50"
        >
          Cancel
        </button>
        <button
          onClick={handleSave}
          disabled={isSaving}
          className="flex-1 px-4 py-2.5 bg-orange-600 hover:bg-orange-700 text-white text-sm font-medium rounded-lg transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
        >
          {isSaving ? (
            <>
              <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent" />
              Creating...
            </>
          ) : (
            <>
              <span>&#x1F4CA;</span>
              Create Stakeholder Map
            </>
          )}
        </button>
      </div>
    </div>
  );
};

export default CADGStakeholderMapPreview;
