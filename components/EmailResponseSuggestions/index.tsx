/**
 * EmailResponseSuggestions Component
 * PRD-215: Smart Email Response Suggestions
 *
 * Displays AI-generated email response suggestions with context awareness.
 * Users can select, edit, and send responses with one click.
 */

import { useEffect, useState } from 'react';
import {
  useEmailSuggestions,
  getUrgencyColor,
  getUrgencyLabel,
  getIntentLabel,
  getRecommendedActionLabel,
} from '../../hooks/useEmailSuggestions';
import type {
  IncomingEmail,
  StakeholderInfo,
  SendSuggestionResponse,
  EmailResponseSuggestion,
  ResponseStyle,
} from '../../types/emailSuggestions';
import './styles.css';

interface EmailResponseSuggestionsProps {
  email: IncomingEmail;
  customerId: string;
  customerName: string;
  stakeholder?: StakeholderInfo;
  onSend: (result: SendSuggestionResponse) => void;
  onDismiss?: () => void;
  autoGenerate?: boolean;
  className?: string;
}

export function EmailResponseSuggestions({
  email,
  customerId,
  customerName,
  stakeholder,
  onSend,
  onDismiss,
  autoGenerate = true,
  className = '',
}: EmailResponseSuggestionsProps) {
  const {
    state,
    generateSuggestions,
    selectSuggestion,
    startEditing,
    updateEdit,
    cancelEdit,
    sendSuggestion,
    provideFeedback,
    reset,
  } = useEmailSuggestions();

  const [showFeedbackModal, setShowFeedbackModal] = useState(false);
  const [feedbackRating, setFeedbackRating] = useState<number | null>(null);

  // Auto-generate suggestions on mount
  useEffect(() => {
    if (autoGenerate && email && customerId) {
      generateSuggestions({
        emailId: email.id,
        threadId: email.threadId,
        customerId,
        emailContent: {
          from: email.from,
          subject: email.subject,
          bodyText: email.bodyText,
          receivedAt: email.receivedAt?.toISOString(),
        },
      });
    }
  }, [autoGenerate, email?.id, customerId]);

  const handleSend = async (sendNow: boolean) => {
    const result = await sendSuggestion({ sendNow });
    if (result.success) {
      // Record that suggestion was used or edited
      await provideFeedback(state.isEditing ? 'edited' : 'used');
      onSend(result);
    } else {
      // Could show error toast here
      console.error('Failed to send:', result.error);
    }
  };

  const handleReject = async () => {
    await provideFeedback('rejected', feedbackRating || undefined);
    setShowFeedbackModal(false);
    onDismiss?.();
  };

  const selectedSuggestion = state.suggestions.find(
    s => s.id === state.selectedSuggestionId
  );

  // Style icon mapping
  const styleIcons: Record<ResponseStyle, string> = {
    formal: '👔',
    friendly: '👋',
    brief: '⚡',
  };

  const styleLabels: Record<ResponseStyle, string> = {
    formal: 'Professional',
    friendly: 'Friendly',
    brief: 'Brief',
  };

  return (
    <div className={`email-suggestions ${className}`}>
      {/* Header */}
      <div className="suggestions-header">
        <div className="suggestions-title">
          <span className="suggestions-icon">✨</span>
          <span>AI Response Suggestions</span>
        </div>
        {onDismiss && (
          <button className="suggestions-dismiss" onClick={onDismiss} title="Dismiss">
            ×
          </button>
        )}
      </div>

      {/* Loading State */}
      {state.isLoading && (
        <div className="suggestions-loading">
          <div className="loading-spinner" />
          <span>Analyzing email and generating suggestions...</span>
        </div>
      )}

      {/* Error State */}
      {state.error && (
        <div className="suggestions-error">
          <span className="error-icon">⚠️</span>
          <span>{state.error}</span>
          <button
            className="retry-btn"
            onClick={() =>
              generateSuggestions({
                emailId: email.id,
                threadId: email.threadId,
                customerId,
                emailContent: {
                  from: email.from,
                  subject: email.subject,
                  bodyText: email.bodyText,
                },
              })
            }
          >
            Retry
          </button>
        </div>
      )}

      {/* Context Info */}
      {!state.isLoading && !state.error && state.detectedIntent && (
        <div className="suggestions-context">
          <div className="context-pills">
            <span
              className="context-pill urgency"
              style={{ '--urgency-color': getUrgencyColor(state.urgency) } as React.CSSProperties}
            >
              {getUrgencyLabel(state.urgency)}
            </span>
            <span className="context-pill intent">
              {getIntentLabel(state.detectedIntent)}
            </span>
          </div>
          <div className="context-action">
            <span className="action-label">Recommended:</span>
            <span className="action-value">
              {getRecommendedActionLabel(state.recommendedAction)}
            </span>
          </div>
        </div>
      )}

      {/* Suggestion Cards */}
      {!state.isLoading && !state.error && state.suggestions.length > 0 && (
        <div className="suggestions-list">
          {state.suggestions.map(suggestion => (
            <SuggestionCard
              key={suggestion.id}
              suggestion={suggestion}
              isSelected={suggestion.id === state.selectedSuggestionId}
              styleIcon={styleIcons[suggestion.style]}
              styleLabel={styleLabels[suggestion.style]}
              onSelect={() => selectSuggestion(suggestion.id)}
            />
          ))}
        </div>
      )}

      {/* Selected Suggestion Preview / Editor */}
      {selectedSuggestion && !state.isLoading && (
        <div className="suggestion-preview">
          <div className="preview-header">
            <span className="preview-label">
              {state.isEditing ? 'Edit Response' : 'Preview'}
            </span>
            {!state.isEditing && (
              <button className="edit-btn" onClick={startEditing}>
                ✏️ Edit
              </button>
            )}
          </div>

          {state.isEditing && state.editedContent ? (
            <div className="suggestion-editor">
              <div className="editor-field">
                <label>Subject</label>
                <input
                  type="text"
                  value={state.editedContent.subject}
                  onChange={e => updateEdit('subject', e.target.value)}
                  className="editor-input"
                />
              </div>
              <div className="editor-field">
                <label>Message</label>
                <textarea
                  value={state.editedContent.body}
                  onChange={e => updateEdit('body', e.target.value)}
                  className="editor-textarea"
                  rows={10}
                />
              </div>
              <div className="editor-actions">
                <button className="cancel-edit-btn" onClick={cancelEdit}>
                  Cancel
                </button>
              </div>
            </div>
          ) : (
            <div className="preview-content">
              <div className="preview-subject">
                <span className="field-label">Subject:</span>
                <span className="field-value">{selectedSuggestion.subject}</span>
              </div>
              <div className="preview-body">
                <pre className="body-text">{selectedSuggestion.fullText}</pre>
              </div>
              {selectedSuggestion.contextUsed.length > 0 && (
                <div className="preview-context">
                  <span className="context-label">Context incorporated:</span>
                  <ul className="context-list">
                    {selectedSuggestion.contextUsed.map((ctx, i) => (
                      <li key={i}>{ctx}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Action Buttons */}
      {selectedSuggestion && !state.isLoading && (
        <div className="suggestions-actions">
          <button
            className="action-btn secondary"
            onClick={() => setShowFeedbackModal(true)}
            disabled={state.isSending}
          >
            👎 Not Helpful
          </button>
          <button
            className="action-btn secondary"
            onClick={() => handleSend(false)}
            disabled={state.isSending}
          >
            📝 Save as Draft
          </button>
          <button
            className="action-btn primary"
            onClick={() => handleSend(true)}
            disabled={state.isSending}
          >
            {state.isSending ? (
              <>
                <span className="btn-spinner" />
                Sending...
              </>
            ) : (
              <>✉️ Send Now</>
            )}
          </button>
        </div>
      )}

      {/* Confidence Score */}
      {selectedSuggestion && (
        <div className="confidence-indicator">
          <span className="confidence-label">Confidence:</span>
          <div className="confidence-bar">
            <div
              className="confidence-fill"
              style={{ width: `${selectedSuggestion.confidence * 100}%` }}
            />
          </div>
          <span className="confidence-value">
            {Math.round(selectedSuggestion.confidence * 100)}%
          </span>
        </div>
      )}

      {/* Feedback Modal */}
      {showFeedbackModal && (
        <div className="feedback-modal-overlay" onClick={() => setShowFeedbackModal(false)}>
          <div className="feedback-modal" onClick={e => e.stopPropagation()}>
            <h3>Why wasn't this helpful?</h3>
            <p>Your feedback helps us improve suggestions.</p>

            <div className="rating-section">
              <span className="rating-label">Rate this suggestion:</span>
              <div className="rating-stars">
                {[1, 2, 3, 4, 5].map(star => (
                  <button
                    key={star}
                    className={`star-btn ${feedbackRating && feedbackRating >= star ? 'active' : ''}`}
                    onClick={() => setFeedbackRating(star)}
                  >
                    ★
                  </button>
                ))}
              </div>
            </div>

            <div className="feedback-actions">
              <button
                className="feedback-btn secondary"
                onClick={() => setShowFeedbackModal(false)}
              >
                Cancel
              </button>
              <button className="feedback-btn primary" onClick={handleReject}>
                Submit & Dismiss
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ============================================
// Suggestion Card Sub-component
// ============================================

interface SuggestionCardProps {
  suggestion: EmailResponseSuggestion;
  isSelected: boolean;
  styleIcon: string;
  styleLabel: string;
  onSelect: () => void;
}

function SuggestionCard({
  suggestion,
  isSelected,
  styleIcon,
  styleLabel,
  onSelect,
}: SuggestionCardProps) {
  // Show truncated preview of body
  const previewText = suggestion.body.slice(0, 120) + (suggestion.body.length > 120 ? '...' : '');

  return (
    <button
      className={`suggestion-card ${isSelected ? 'selected' : ''}`}
      onClick={onSelect}
      type="button"
    >
      <div className="card-header">
        <span className="style-badge">
          <span className="style-icon">{styleIcon}</span>
          <span className="style-label">{styleLabel}</span>
        </span>
        <span className="confidence-badge">
          {Math.round(suggestion.confidence * 100)}% match
        </span>
      </div>
      <div className="card-preview">
        <p className="greeting">{suggestion.greeting}</p>
        <p className="body-preview">{previewText}</p>
      </div>
      {isSelected && (
        <div className="selected-indicator">
          <span>✓ Selected</span>
        </div>
      )}
    </button>
  );
}

export default EmailResponseSuggestions;
