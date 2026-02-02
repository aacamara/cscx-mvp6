/**
 * CADGDocumentPreview - Editable document preview for CADG-generated documents
 * Allows users to review, edit, enhance with AI, and approve before creating in Google Docs
 */

import React, { useState, useMemo } from 'react';
import { useAuth } from '../../context/AuthContext';

// ============================================
// Types
// ============================================

export interface DocumentSection {
  id: string;
  title: string;
  content: string;
}

export interface DocumentData {
  title: string;
  sections: DocumentSection[];
}

export interface CustomerData {
  id: string;
  name: string;
  healthScore?: number;
  renewalDate?: string;
}

interface CADGDocumentPreviewProps {
  document: DocumentData;
  customer: CustomerData;
  onSave: (document: DocumentData) => Promise<void>;
  onCancel: () => void;
}

// ============================================
// Component
// ============================================

export const CADGDocumentPreview: React.FC<CADGDocumentPreviewProps> = ({
  document,
  customer,
  onSave,
  onCancel,
}) => {
  const { getAuthHeaders } = useAuth();

  // Original document data (for tracking modifications)
  const [original] = useState<DocumentData>(() => ({
    title: document.title,
    sections: document.sections.map(s => ({ ...s })),
  }));

  // Editable draft state
  const [draft, setDraft] = useState<DocumentData>(() => ({
    title: document.title,
    sections: document.sections.map(s => ({ ...s })),
  }));

  // UI state
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // AI suggestion state per section
  const [suggestions, setSuggestions] = useState<Record<string, string | null>>({});
  const [loadingSuggestions, setLoadingSuggestions] = useState<Record<string, boolean>>({});

  // Check if draft has been modified from original
  const isModified = useMemo(() => {
    if (draft.title !== original.title) return true;
    if (draft.sections.length !== original.sections.length) return true;
    return draft.sections.some((section, i) => {
      const orig = original.sections[i];
      return section.title !== orig?.title || section.content !== orig?.content;
    });
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
      setError(err instanceof Error ? err.message : 'Failed to create document');
    } finally {
      setIsSaving(false);
    }
  };

  // Handle getting AI suggestion for a section
  const handleGetSuggestion = async (sectionId: string) => {
    const section = draft.sections.find(s => s.id === sectionId);
    if (!section) return;

    setLoadingSuggestions(prev => ({ ...prev, [sectionId]: true }));
    setSuggestions(prev => ({ ...prev, [sectionId]: null }));

    try {
      const response = await fetch(
        `${import.meta.env.VITE_API_URL || ''}/api/cadg/document/suggest`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...getAuthHeaders(),
          },
          body: JSON.stringify({
            sectionTitle: section.title,
            sectionContent: section.content,
            documentTitle: draft.title,
            customerId: customer.id,
          }),
        }
      );

      if (!response.ok) {
        throw new Error('Failed to get suggestion');
      }

      const data = await response.json();
      setSuggestions(prev => ({ ...prev, [sectionId]: data.suggestion }));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to get AI suggestion');
    } finally {
      setLoadingSuggestions(prev => ({ ...prev, [sectionId]: false }));
    }
  };

  // Apply suggestion to section
  const handleApplySuggestion = (sectionId: string) => {
    const suggestion = suggestions[sectionId];
    if (!suggestion) return;

    setDraft(prev => ({
      ...prev,
      sections: prev.sections.map(s =>
        s.id === sectionId
          ? { ...s, content: s.content + '\n\n' + suggestion }
          : s
      ),
    }));
    setSuggestions(prev => ({ ...prev, [sectionId]: null }));
  };

  // Dismiss suggestion
  const handleDismissSuggestion = (sectionId: string) => {
    setSuggestions(prev => ({ ...prev, [sectionId]: null }));
  };

  // Update document title
  const updateTitle = (value: string) => {
    setDraft(prev => ({ ...prev, title: value }));
  };

  // Update section title
  const updateSectionTitle = (sectionId: string, value: string) => {
    setDraft(prev => ({
      ...prev,
      sections: prev.sections.map(s =>
        s.id === sectionId ? { ...s, title: value } : s
      ),
    }));
  };

  // Update section content
  const updateSectionContent = (sectionId: string, value: string) => {
    setDraft(prev => ({
      ...prev,
      sections: prev.sections.map(s =>
        s.id === sectionId ? { ...s, content: value } : s
      ),
    }));
  };

  // Add new section
  const addSection = () => {
    const newSection: DocumentSection = {
      id: `section-${Date.now()}`,
      title: 'New Section',
      content: '',
    };
    setDraft(prev => ({
      ...prev,
      sections: [...prev.sections, newSection],
    }));
  };

  // Remove section
  const removeSection = (sectionId: string) => {
    if (draft.sections.length <= 1) {
      setError('Document must have at least one section');
      return;
    }
    setDraft(prev => ({
      ...prev,
      sections: prev.sections.filter(s => s.id !== sectionId),
    }));
  };

  return (
    <div className="bg-cscx-gray-800 border border-cscx-gray-700 rounded-xl overflow-hidden">
      {/* Header */}
      <div className="bg-gradient-to-r from-purple-600/20 to-transparent p-4 border-b border-cscx-gray-700">
        <div className="flex items-start justify-between">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-2xl">📄</span>
              <h3 className="text-white font-semibold">Document Preview</h3>
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

      {/* Document Form */}
      <div className="p-4 space-y-6">
        {/* Document Title */}
        <div>
          <label className="text-xs font-medium text-cscx-gray-400 uppercase tracking-wider block mb-1.5">
            Document Title
          </label>
          <input
            type="text"
            value={draft.title}
            onChange={(e) => updateTitle(e.target.value)}
            disabled={isSaving}
            className="w-full bg-cscx-gray-900/50 border border-cscx-gray-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-purple-500 disabled:opacity-50"
            placeholder="Document title"
          />
        </div>

        {/* Sections */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <label className="text-xs font-medium text-cscx-gray-400 uppercase tracking-wider">
              Sections ({draft.sections.length})
            </label>
            <button
              onClick={addSection}
              disabled={isSaving}
              className="text-xs px-2 py-1 bg-purple-900/30 hover:bg-purple-900/50 text-purple-300 rounded-lg transition-colors disabled:opacity-50"
            >
              + Add Section
            </button>
          </div>

          {draft.sections.map((section, index) => (
            <div
              key={section.id}
              className="bg-cscx-gray-900/30 border border-cscx-gray-700 rounded-lg p-4 space-y-3"
            >
              {/* Section Header */}
              <div className="flex items-center gap-2">
                <span className="text-cscx-gray-500 text-sm font-mono">{index + 1}.</span>
                <input
                  type="text"
                  value={section.title}
                  onChange={(e) => updateSectionTitle(section.id, e.target.value)}
                  disabled={isSaving}
                  className="flex-1 bg-transparent border-b border-cscx-gray-700 px-1 py-1 text-white text-sm font-medium focus:outline-none focus:border-purple-500 disabled:opacity-50"
                  placeholder="Section title"
                />
                <button
                  onClick={() => removeSection(section.id)}
                  disabled={isSaving || draft.sections.length <= 1}
                  className="text-cscx-gray-500 hover:text-red-400 transition-colors disabled:opacity-30"
                  title="Remove section"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                  </svg>
                </button>
              </div>

              {/* Section Content */}
              <textarea
                value={section.content}
                onChange={(e) => updateSectionContent(section.id, e.target.value)}
                disabled={isSaving}
                rows={6}
                className="w-full bg-cscx-gray-900/50 border border-cscx-gray-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-purple-500 disabled:opacity-50 resize-y"
                style={{ minHeight: '150px' }}
                placeholder="Section content..."
              />

              {/* AI Suggestions Button */}
              <div>
                <button
                  onClick={() => handleGetSuggestion(section.id)}
                  disabled={loadingSuggestions[section.id] || isSaving}
                  className="flex items-center gap-2 px-3 py-1.5 bg-blue-900/30 hover:bg-blue-900/50 text-blue-300 text-xs rounded-lg transition-colors disabled:opacity-50"
                >
                  {loadingSuggestions[section.id] ? (
                    <>
                      <div className="animate-spin rounded-full h-3 w-3 border-2 border-blue-300 border-t-transparent" />
                      Getting suggestions...
                    </>
                  ) : (
                    <>
                      <span>✨</span>
                      Get Claude Suggestions
                    </>
                  )}
                </button>
              </div>

              {/* AI Suggestion Card */}
              {suggestions[section.id] && (
                <div className="bg-blue-900/20 border border-blue-500 rounded-lg p-3">
                  <div className="flex items-start justify-between mb-2">
                    <div className="flex items-center gap-2 text-blue-400">
                      <span>💡</span>
                      <span className="font-medium text-xs">AI Suggestion</span>
                    </div>
                  </div>
                  <p className="text-blue-200 text-sm whitespace-pre-wrap mb-3">
                    {suggestions[section.id]}
                  </p>
                  <div className="flex gap-2">
                    <button
                      onClick={() => handleApplySuggestion(section.id)}
                      className="px-2 py-1 bg-blue-600 hover:bg-blue-700 text-white text-xs rounded-lg transition-colors"
                    >
                      Apply
                    </button>
                    <button
                      onClick={() => handleDismissSuggestion(section.id)}
                      className="px-2 py-1 bg-cscx-gray-700 hover:bg-cscx-gray-600 text-white text-xs rounded-lg transition-colors"
                    >
                      Dismiss
                    </button>
                  </div>
                </div>
              )}
            </div>
          ))}
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
      <div className="px-4 pb-4 flex gap-3">
        <button
          onClick={handleCancel}
          disabled={isSaving}
          className="flex-1 px-4 py-2.5 bg-cscx-gray-700 hover:bg-cscx-gray-600 text-white text-sm font-medium rounded-lg transition-colors disabled:opacity-50"
        >
          Cancel
        </button>
        <button
          onClick={handleSave}
          disabled={isSaving || !draft.title || draft.sections.length === 0}
          className="flex-1 px-4 py-2.5 bg-purple-600 hover:bg-purple-700 text-white text-sm font-medium rounded-lg transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
        >
          {isSaving ? (
            <>
              <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent" />
              Creating...
            </>
          ) : (
            <>
              <span>📄</span>
              Create Document
            </>
          )}
        </button>
      </div>
    </div>
  );
};

export default CADGDocumentPreview;
