/**
 * PRD-253: Peer Review Workflow Component
 *
 * Main component for peer review functionality including:
 * - Request creation from content
 * - Reviewer queue and assignment
 * - Inline commenting and feedback
 * - Decision submission (approve/request changes/reject)
 */

import { useState, useEffect } from 'react';
import { usePeerReview } from '../../hooks/usePeerReview';
import type {
  ReviewRequest,
  ReviewQueueItem,
  ReviewComment,
  CreateReviewRequestInput,
  ReviewContentType,
  ReviewType,
  ReviewUrgency,
  CommentSeverity,
  SuggestedReviewer,
} from '../../types/peerReview';
import './styles.css';

// ============================================
// COMPONENT PROPS
// ============================================

interface PeerReviewProps {
  // For creating a new review request
  mode?: 'create' | 'queue' | 'review';
  contentType?: ReviewContentType;
  contentSnapshot?: string;
  contentId?: string;
  customerId?: string;
  contentMetadata?: Record<string, any>;

  // For reviewing existing request
  requestId?: string;
  assignmentId?: string;

  // Callbacks
  onRequestCreated?: (request: ReviewRequest) => void;
  onDecisionSubmitted?: (decision: string) => void;
  onClose?: () => void;
}

// ============================================
// MAIN COMPONENT
// ============================================

export function PeerReview({
  mode = 'create',
  contentType,
  contentSnapshot,
  contentId,
  customerId,
  contentMetadata,
  requestId,
  assignmentId,
  onRequestCreated,
  onDecisionSubmitted,
  onClose,
}: PeerReviewProps) {
  const {
    state,
    createRequest,
    getMyRequests,
    getReviewQueue,
    getRequest,
    assignReviewer,
    startReview,
    submitDecision,
    addComment,
    getComments,
    resolveComment,
    getSuggestedReviewers,
    clearError,
  } = usePeerReview();

  // Local form state
  const [reviewType, setReviewType] = useState<ReviewType>('quality');
  const [urgency, setUrgency] = useState<ReviewUrgency>('normal');
  const [focusAreas, setFocusAreas] = useState('');
  const [requiresApproval, setRequiresApproval] = useState(false);
  const [selectedReviewers, setSelectedReviewers] = useState<string[]>([]);

  // Comment state
  const [newComment, setNewComment] = useState('');
  const [commentSeverity, setCommentSeverity] = useState<CommentSeverity>('suggestion');
  const [selectedText, setSelectedText] = useState<{
    text: string;
    start: number;
    end: number;
  } | null>(null);

  // Decision state
  const [decisionFeedback, setDecisionFeedback] = useState('');
  const [decisionRating, setDecisionRating] = useState<number>(4);

  // Load initial data
  useEffect(() => {
    if (mode === 'create' && contentType) {
      getSuggestedReviewers({ contentType, customerId });
    } else if (mode === 'queue') {
      getReviewQueue();
    } else if (mode === 'review' && requestId) {
      getRequest(requestId);
      if (assignmentId) {
        getComments(assignmentId);
      }
    }
  }, [mode, contentType, customerId, requestId, assignmentId]);

  // ============================================
  // HANDLERS
  // ============================================

  const handleCreateRequest = async () => {
    if (!contentType || !contentSnapshot) {
      return;
    }

    const input: CreateReviewRequestInput = {
      contentType,
      contentSnapshot,
      contentId,
      customerId,
      contentMetadata,
      reviewType,
      urgency,
      focusAreas: focusAreas || undefined,
      requiresApproval,
      reviewerUserIds: selectedReviewers.length > 0 ? selectedReviewers : undefined,
    };

    const request = await createRequest(input);
    if (request && onRequestCreated) {
      onRequestCreated(request);
    }
  };

  const handleToggleReviewer = (userId: string) => {
    setSelectedReviewers(prev =>
      prev.includes(userId)
        ? prev.filter(id => id !== userId)
        : [...prev, userId]
    );
  };

  const handleStartReview = async (queueItem: ReviewQueueItem) => {
    const success = await startReview(queueItem.assignment.id);
    if (success) {
      await getRequest(queueItem.request.id);
      await getComments(queueItem.assignment.id);
    }
  };

  const handleAddComment = async () => {
    if (!assignmentId || !newComment.trim()) return;

    await addComment(assignmentId, {
      comment: newComment,
      severity: commentSeverity,
      commentType: selectedText ? 'inline' : 'general',
      selectionStart: selectedText?.start,
      selectionEnd: selectedText?.end,
      selectionText: selectedText?.text,
    });

    setNewComment('');
    setSelectedText(null);
  };

  const handleSubmitDecision = async (decision: 'approved' | 'changes_requested' | 'rejected') => {
    if (!assignmentId) return;

    const success = await submitDecision(assignmentId, {
      decision,
      overallFeedback: decisionFeedback || undefined,
      rating: decisionRating,
    });

    if (success && onDecisionSubmitted) {
      onDecisionSubmitted(decision);
    }
  };

  const handleTextSelection = () => {
    const selection = window.getSelection();
    if (selection && selection.toString().trim()) {
      const range = selection.getRangeAt(0);
      const contentElement = document.getElementById('review-content');
      if (contentElement && contentElement.contains(range.commonAncestorContainer)) {
        setSelectedText({
          text: selection.toString(),
          start: range.startOffset,
          end: range.endOffset,
        });
      }
    }
  };

  // ============================================
  // RENDER
  // ============================================

  return (
    <div className="peer-review-container">
      {/* Header */}
      <div className="peer-review-header">
        <h2 className="peer-review-title">
          {mode === 'create' && 'Request Peer Review'}
          {mode === 'queue' && 'Review Queue'}
          {mode === 'review' && 'Review Content'}
        </h2>
        {onClose && (
          <button className="peer-review-close" onClick={onClose}>
            x
          </button>
        )}
      </div>

      {/* Error display */}
      {state.error && (
        <div className="peer-review-error">
          <span>{state.error}</span>
          <button onClick={clearError}>Dismiss</button>
        </div>
      )}

      {/* CREATE MODE */}
      {mode === 'create' && (
        <div className="peer-review-create">
          {/* Content preview */}
          <div className="content-preview">
            <h3>Content to Review</h3>
            <div className="content-type-badge">
              {contentType?.replace('_', ' ')}
            </div>
            <pre className="content-snapshot">{contentSnapshot}</pre>
          </div>

          {/* Review settings */}
          <div className="review-settings">
            <div className="setting-group">
              <label>Review Type</label>
              <select
                value={reviewType}
                onChange={e => setReviewType(e.target.value as ReviewType)}
              >
                <option value="quality">Quality Check</option>
                <option value="accuracy">Accuracy Verification</option>
                <option value="compliance">Compliance Review</option>
                <option value="coaching">Coaching/Feedback</option>
              </select>
            </div>

            <div className="setting-group">
              <label>Urgency</label>
              <select
                value={urgency}
                onChange={e => setUrgency(e.target.value as ReviewUrgency)}
              >
                <option value="low">Low (72h)</option>
                <option value="normal">Normal (24h)</option>
                <option value="high">High (8h)</option>
                <option value="urgent">Urgent (2h)</option>
              </select>
            </div>

            <div className="setting-group">
              <label>Focus Areas (optional)</label>
              <textarea
                value={focusAreas}
                onChange={e => setFocusAreas(e.target.value)}
                placeholder="What should reviewers focus on?"
                rows={2}
              />
            </div>

            <div className="setting-group checkbox">
              <label>
                <input
                  type="checkbox"
                  checked={requiresApproval}
                  onChange={e => setRequiresApproval(e.target.checked)}
                />
                Require approval before sending
              </label>
            </div>
          </div>

          {/* Reviewer selection */}
          <div className="reviewer-selection">
            <h3>Select Reviewers</h3>
            {state.suggestionsLoading ? (
              <div className="loading">Finding suggested reviewers...</div>
            ) : (
              <div className="reviewer-list">
                {state.suggestedReviewers.map(suggestion => (
                  <ReviewerCard
                    key={suggestion.user.id}
                    suggestion={suggestion}
                    isSelected={selectedReviewers.includes(suggestion.user.id)}
                    onToggle={() => handleToggleReviewer(suggestion.user.id)}
                  />
                ))}
                {state.suggestedReviewers.length === 0 && (
                  <p className="no-reviewers">No reviewers available</p>
                )}
              </div>
            )}
          </div>

          {/* Submit button */}
          <div className="peer-review-actions">
            <button
              className="btn-primary"
              onClick={handleCreateRequest}
              disabled={state.isSubmitting || selectedReviewers.length === 0}
            >
              {state.isSubmitting ? 'Creating...' : 'Request Review'}
            </button>
          </div>
        </div>
      )}

      {/* QUEUE MODE */}
      {mode === 'queue' && (
        <div className="peer-review-queue">
          {state.queueLoading ? (
            <div className="loading">Loading review queue...</div>
          ) : state.reviewQueue.length === 0 ? (
            <div className="empty-queue">
              <p>No pending reviews</p>
            </div>
          ) : (
            <div className="queue-list">
              {state.reviewQueue.map(item => (
                <QueueItemCard
                  key={item.assignment.id}
                  item={item}
                  onStart={() => handleStartReview(item)}
                />
              ))}
            </div>
          )}
          <div className="queue-footer">
            <span>{state.queueTotal} total items</span>
          </div>
        </div>
      )}

      {/* REVIEW MODE */}
      {mode === 'review' && state.currentRequest && (
        <div className="peer-review-active">
          {/* Two-column layout */}
          <div className="review-layout">
            {/* Left: Content being reviewed */}
            <div className="review-content-panel">
              <div className="content-header">
                <span className="content-type">
                  {state.currentRequest.contentType.replace('_', ' ')}
                </span>
                <span className={`urgency-badge urgency-${state.currentRequest.urgency}`}>
                  {state.currentRequest.urgency}
                </span>
              </div>

              {state.currentRequest.focusAreas && (
                <div className="focus-areas">
                  <strong>Focus on:</strong> {state.currentRequest.focusAreas}
                </div>
              )}

              <div
                id="review-content"
                className="review-content"
                onMouseUp={handleTextSelection}
              >
                <pre>{state.currentRequest.contentSnapshot}</pre>
              </div>

              {/* Inline comments overlay */}
              <div className="inline-comments">
                {state.comments
                  .filter(c => c.commentType === 'inline' && !c.isResolved)
                  .map(comment => (
                    <InlineCommentMarker key={comment.id} comment={comment} />
                  ))}
              </div>
            </div>

            {/* Right: Comments and feedback */}
            <div className="review-feedback-panel">
              {/* Add comment */}
              {selectedText && (
                <div className="selected-text-indicator">
                  Selected: "{selectedText.text.slice(0, 50)}..."
                </div>
              )}

              <div className="add-comment-section">
                <textarea
                  value={newComment}
                  onChange={e => setNewComment(e.target.value)}
                  placeholder={selectedText ? 'Comment on selected text...' : 'Add a general comment...'}
                  rows={3}
                />
                <div className="comment-controls">
                  <select
                    value={commentSeverity}
                    onChange={e => setCommentSeverity(e.target.value as CommentSeverity)}
                  >
                    <option value="suggestion">Suggestion</option>
                    <option value="important">Important</option>
                    <option value="critical">Critical</option>
                  </select>
                  <button
                    className="btn-secondary"
                    onClick={handleAddComment}
                    disabled={!newComment.trim()}
                  >
                    Add Comment
                  </button>
                </div>
              </div>

              {/* Comments list */}
              <div className="comments-list">
                <h4>Comments ({state.comments.length})</h4>
                {state.comments.map(comment => (
                  <CommentCard
                    key={comment.id}
                    comment={comment}
                    onResolve={() => resolveComment(comment.id)}
                  />
                ))}
              </div>

              {/* Decision section */}
              <div className="decision-section">
                <h4>Your Decision</h4>
                <textarea
                  value={decisionFeedback}
                  onChange={e => setDecisionFeedback(e.target.value)}
                  placeholder="Overall feedback..."
                  rows={3}
                />

                <div className="rating-section">
                  <label>Quality Rating</label>
                  <div className="rating-stars">
                    {[1, 2, 3, 4, 5].map(star => (
                      <button
                        key={star}
                        className={`star ${star <= decisionRating ? 'active' : ''}`}
                        onClick={() => setDecisionRating(star)}
                      >
                        *
                      </button>
                    ))}
                  </div>
                </div>

                <div className="decision-buttons">
                  <button
                    className="btn-reject"
                    onClick={() => handleSubmitDecision('rejected')}
                    disabled={state.isSubmitting}
                  >
                    Reject
                  </button>
                  <button
                    className="btn-changes"
                    onClick={() => handleSubmitDecision('changes_requested')}
                    disabled={state.isSubmitting}
                  >
                    Request Changes
                  </button>
                  <button
                    className="btn-approve"
                    onClick={() => handleSubmitDecision('approved')}
                    disabled={state.isSubmitting}
                  >
                    Approve
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ============================================
// SUB-COMPONENTS
// ============================================

interface ReviewerCardProps {
  suggestion: SuggestedReviewer;
  isSelected: boolean;
  onToggle: () => void;
}

function ReviewerCard({ suggestion, isSelected, onToggle }: ReviewerCardProps) {
  return (
    <button
      className={`reviewer-card ${isSelected ? 'selected' : ''}`}
      onClick={onToggle}
    >
      <div className="reviewer-avatar">
        {suggestion.user.name.charAt(0).toUpperCase()}
      </div>
      <div className="reviewer-info">
        <span className="reviewer-name">{suggestion.user.name}</span>
        <span className="reviewer-email">{suggestion.user.email}</span>
        <div className="reviewer-reasons">
          {suggestion.reasons.slice(0, 2).map((reason, i) => (
            <span key={i} className="reason-tag">{reason}</span>
          ))}
        </div>
      </div>
      <div className="reviewer-score">
        {Math.round(suggestion.score)}
      </div>
      {isSelected && <span className="selected-check">Check</span>}
    </button>
  );
}

interface QueueItemCardProps {
  item: ReviewQueueItem;
  onStart: () => void;
}

function QueueItemCard({ item, onStart }: QueueItemCardProps) {
  return (
    <div className={`queue-item ${item.isOverdue ? 'overdue' : ''}`}>
      <div className="queue-item-header">
        <span className="content-type">
          {item.request.contentType.replace('_', ' ')}
        </span>
        <span className={`urgency-badge urgency-${item.request.urgency}`}>
          {item.request.urgency}
        </span>
      </div>

      <div className="queue-item-preview">
        {item.request.contentSnapshot?.slice(0, 150)}...
      </div>

      <div className="queue-item-meta">
        <span className="review-type">{item.request.reviewType}</span>
        {item.timeRemaining && (
          <span className="time-remaining">{item.timeRemaining} remaining</span>
        )}
        {item.isOverdue && <span className="overdue-label">Overdue</span>}
      </div>

      <div className="queue-item-actions">
        <button className="btn-primary" onClick={onStart}>
          Start Review
        </button>
      </div>
    </div>
  );
}

interface CommentCardProps {
  comment: ReviewComment;
  onResolve: () => void;
}

function CommentCard({ comment, onResolve }: CommentCardProps) {
  return (
    <div className={`comment-card severity-${comment.severity} ${comment.isResolved ? 'resolved' : ''}`}>
      {comment.selectionText && (
        <div className="comment-selection">
          "{comment.selectionText}"
        </div>
      )}
      <div className="comment-content">{comment.comment}</div>
      {comment.suggestion && (
        <div className="comment-suggestion">
          Suggested: {comment.suggestion}
        </div>
      )}
      <div className="comment-footer">
        <span className={`severity-badge severity-${comment.severity}`}>
          {comment.severity}
        </span>
        {!comment.isResolved && (
          <button className="resolve-btn" onClick={onResolve}>
            Resolve
          </button>
        )}
        {comment.isResolved && (
          <span className="resolved-label">Resolved</span>
        )}
      </div>
    </div>
  );
}

interface InlineCommentMarkerProps {
  comment: ReviewComment;
}

function InlineCommentMarker({ comment }: InlineCommentMarkerProps) {
  return (
    <div
      className={`inline-comment-marker severity-${comment.severity}`}
      title={comment.comment}
    >
      !
    </div>
  );
}

export default PeerReview;
