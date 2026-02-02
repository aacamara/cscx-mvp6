/**
 * CADGEmailPreview - Editable email preview for CADG-generated emails
 * Allows users to review, edit, enhance with AI, and approve before sending
 */

import React, { useState, useMemo } from 'react';
import { useAuth } from '../../context/AuthContext';

// ============================================
// Types
// ============================================

export interface EmailData {
  to: string[];
  cc: string[];
  subject: string;
  body: string;
}

export interface CustomerData {
  id: string;
  name: string;
  healthScore?: number;
  renewalDate?: string;
}

interface CADGEmailPreviewProps {
  email: EmailData;
  customer: CustomerData;
  onSend: (email: EmailData) => Promise<void>;
  onCancel: () => void;
}

// ============================================
// Component
// ============================================

export const CADGEmailPreview: React.FC<CADGEmailPreviewProps> = ({
  email,
  customer,
  onSend,
  onCancel,
}) => {
  const { getAuthHeaders } = useAuth();

  // Original email data (for tracking modifications)
  const [original] = useState<EmailData>(() => ({
    to: [...email.to],
    cc: [...email.cc],
    subject: email.subject,
    body: email.body,
  }));

  // Editable draft state
  const [draft, setDraft] = useState<EmailData>(() => ({
    to: [...email.to],
    cc: [...email.cc],
    subject: email.subject,
    body: email.body,
  }));

  // UI state
  const [isSending, setIsSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // AI suggestion state
  const [suggestion, setSuggestion] = useState<string | null>(null);
  const [isLoadingSuggestion, setIsLoadingSuggestion] = useState(false);
  const [suggestionApplied, setSuggestionApplied] = useState(false);

  // Check if draft has been modified from original
  const isModified = useMemo(() => {
    return (
      draft.to.join(',') !== original.to.join(',') ||
      draft.cc.join(',') !== original.cc.join(',') ||
      draft.subject !== original.subject ||
      draft.body !== original.body
    );
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

  // Handle send
  const handleSend = async () => {
    setIsSending(true);
    setError(null);

    try {
      await onSend(draft);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to send email');
    } finally {
      setIsSending(false);
    }
  };

  // Handle getting AI suggestions
  const handleGetSuggestion = async () => {
    setIsLoadingSuggestion(true);
    setSuggestion(null);
    setSuggestionApplied(false);

    try {
      const response = await fetch(
        `${import.meta.env.VITE_API_URL || ''}/api/cadg/email/suggest`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...getAuthHeaders(),
          },
          body: JSON.stringify({
            subject: draft.subject,
            body: draft.body,
            customerId: customer.id,
          }),
        }
      );

      if (!response.ok) {
        throw new Error('Failed to get suggestion');
      }

      const data = await response.json();
      setSuggestion(data.suggestion);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to get AI suggestion');
    } finally {
      setIsLoadingSuggestion(false);
    }
  };

  // Apply suggestion to body
  const handleApplySuggestion = () => {
    if (suggestion) {
      setDraft(prev => ({
        ...prev,
        body: prev.body + '\n\n' + suggestion,
      }));
      setSuggestionApplied(true);
      setSuggestion(null);
    }
  };

  // Dismiss suggestion
  const handleDismissSuggestion = () => {
    setSuggestion(null);
  };

  // Update email fields
  const updateTo = (value: string) => {
    setDraft(prev => ({
      ...prev,
      to: value.split(',').map(e => e.trim()).filter(Boolean),
    }));
  };

  const updateCc = (value: string) => {
    setDraft(prev => ({
      ...prev,
      cc: value.split(',').map(e => e.trim()).filter(Boolean),
    }));
  };

  const updateSubject = (value: string) => {
    setDraft(prev => ({ ...prev, subject: value }));
  };

  const updateBody = (value: string) => {
    setDraft(prev => ({ ...prev, body: value }));
  };

  return (
    <div className="bg-cscx-gray-800 border border-cscx-gray-700 rounded-xl overflow-hidden">
      {/* Header */}
      <div className="bg-gradient-to-r from-blue-600/20 to-transparent p-4 border-b border-cscx-gray-700">
        <div className="flex items-start justify-between">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-2xl">✉️</span>
              <h3 className="text-white font-semibold">Email Preview</h3>
              {isModified && (
                <span className="text-xs bg-yellow-600/30 text-yellow-400 px-2 py-0.5 rounded-full font-medium">
                  Modified
                </span>
              )}
            </div>
            <p className="text-cscx-gray-400 text-sm mt-1">
              To: {customer.name}
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

      {/* Email Form */}
      <div className="p-4 space-y-4">
        {/* To Field */}
        <div>
          <label className="text-xs font-medium text-cscx-gray-400 uppercase tracking-wider block mb-1.5">
            To
          </label>
          <input
            type="text"
            value={draft.to.join(', ')}
            onChange={(e) => updateTo(e.target.value)}
            disabled={isSending}
            className="w-full bg-cscx-gray-900/50 border border-cscx-gray-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-blue-500 disabled:opacity-50"
            placeholder="email@example.com"
          />
        </div>

        {/* CC Field */}
        <div>
          <label className="text-xs font-medium text-cscx-gray-400 uppercase tracking-wider block mb-1.5">
            CC
          </label>
          <input
            type="text"
            value={draft.cc.join(', ')}
            onChange={(e) => updateCc(e.target.value)}
            disabled={isSending}
            className="w-full bg-cscx-gray-900/50 border border-cscx-gray-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-blue-500 disabled:opacity-50"
            placeholder="cc@example.com (optional)"
          />
        </div>

        {/* Subject Field */}
        <div>
          <label className="text-xs font-medium text-cscx-gray-400 uppercase tracking-wider block mb-1.5">
            Subject
          </label>
          <input
            type="text"
            value={draft.subject}
            onChange={(e) => updateSubject(e.target.value)}
            disabled={isSending}
            className="w-full bg-cscx-gray-900/50 border border-cscx-gray-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-blue-500 disabled:opacity-50"
            placeholder="Email subject"
          />
        </div>

        {/* Body Field */}
        <div>
          <label className="text-xs font-medium text-cscx-gray-400 uppercase tracking-wider block mb-1.5">
            Body
          </label>
          <textarea
            value={draft.body}
            onChange={(e) => updateBody(e.target.value)}
            disabled={isSending}
            rows={10}
            className="w-full bg-cscx-gray-900/50 border border-cscx-gray-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-blue-500 disabled:opacity-50 resize-y"
            style={{ minHeight: '200px' }}
            placeholder="Email body"
          />
        </div>

        {/* AI Suggestions Button */}
        <div>
          <button
            onClick={handleGetSuggestion}
            disabled={isLoadingSuggestion || isSending}
            className="flex items-center gap-2 px-3 py-2 bg-blue-900/30 hover:bg-blue-900/50 text-blue-300 text-sm rounded-lg transition-colors disabled:opacity-50"
          >
            {isLoadingSuggestion ? (
              <>
                <div className="animate-spin rounded-full h-4 w-4 border-2 border-blue-300 border-t-transparent" />
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
        {suggestion && !suggestionApplied && (
          <div className="bg-blue-900/20 border border-blue-500 rounded-lg p-4">
            <div className="flex items-start justify-between mb-2">
              <div className="flex items-center gap-2 text-blue-400">
                <span>💡</span>
                <span className="font-medium text-sm">AI Suggestion</span>
              </div>
            </div>
            <p className="text-blue-200 text-sm whitespace-pre-wrap mb-3">
              {suggestion}
            </p>
            <div className="flex gap-2">
              <button
                onClick={handleApplySuggestion}
                className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-sm rounded-lg transition-colors"
              >
                Apply
              </button>
              <button
                onClick={handleDismissSuggestion}
                className="px-3 py-1.5 bg-cscx-gray-700 hover:bg-cscx-gray-600 text-white text-sm rounded-lg transition-colors"
              >
                Dismiss
              </button>
            </div>
          </div>
        )}
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
          disabled={isSending}
          className="flex-1 px-4 py-2.5 bg-cscx-gray-700 hover:bg-cscx-gray-600 text-white text-sm font-medium rounded-lg transition-colors disabled:opacity-50"
        >
          Cancel
        </button>
        <button
          onClick={handleSend}
          disabled={isSending || draft.to.length === 0 || !draft.subject || !draft.body}
          className="flex-1 px-4 py-2.5 bg-green-600 hover:bg-green-700 text-white text-sm font-medium rounded-lg transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
        >
          {isSending ? (
            <>
              <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent" />
              Sending...
            </>
          ) : (
            <>
              <span>📤</span>
              Send Email
            </>
          )}
        </button>
      </div>
    </div>
  );
};

export default CADGEmailPreview;
