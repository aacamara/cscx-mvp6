/**
 * FeedbackWidget - Floating feedback button and form
 * PRD: Compound Product Launch (CP-008)
 * Fixed position bottom-right, expands to feedback form on click
 */

import React, { useState } from 'react';
import { trackEvent } from '../src/services/analytics';

const API_BASE = `${import.meta.env.VITE_API_URL || ''}/api`;

type FeedbackType = 'general' | 'feature_request' | 'bug' | 'praise';

interface FeedbackWidgetProps {
  userId?: string;
}

export function FeedbackWidget({ userId }: FeedbackWidgetProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Form state
  const [type, setType] = useState<FeedbackType>('general');
  const [message, setMessage] = useState('');
  const [rating, setRating] = useState<number | null>(null);

  const handleOpen = () => {
    setIsOpen(true);
    trackEvent('feedback_widget_opened', { context: window.location.pathname });
  };

  const handleClose = () => {
    setIsOpen(false);
    setSubmitted(false);
    setError(null);
    // Reset form
    setType('general');
    setMessage('');
    setRating(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setError(null);

    try {
      const response = await fetch(`${API_BASE}/feedback/widget`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(userId ? { 'x-user-id': userId } : {}),
        },
        body: JSON.stringify({
          type,
          message,
          rating,
          context: window.location.pathname,
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to submit feedback');
      }

      // Track successful submission
      trackEvent('feedback_submitted', { type, has_rating: !!rating });

      setSubmitted(true);

      // Auto-close after 2 seconds
      setTimeout(() => {
        handleClose();
      }, 2000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to submit feedback');
    } finally {
      setIsSubmitting(false);
    }
  };

  const feedbackTypes: { value: FeedbackType; label: string }[] = [
    { value: 'general', label: 'General Feedback' },
    { value: 'feature_request', label: 'Feature Request' },
    { value: 'bug', label: 'Bug Report' },
    { value: 'praise', label: 'Something Great!' },
  ];

  return (
    <div className="fixed bottom-4 right-4 z-50">
      {/* Feedback Button */}
      {!isOpen && (
        <button
          onClick={handleOpen}
          className="flex items-center gap-2 bg-cscx-accent hover:bg-red-600 text-white px-4 py-2 rounded-full shadow-lg transition-all hover:scale-105"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
          </svg>
          <span className="font-medium">Feedback</span>
        </button>
      )}

      {/* Feedback Form */}
      {isOpen && (
        <div className="bg-cscx-gray-900 border border-cscx-gray-800 rounded-xl shadow-2xl w-80 overflow-hidden">
          {/* Header */}
          <div className="flex items-center justify-between p-4 border-b border-cscx-gray-800">
            <h3 className="text-lg font-semibold text-white">Send Feedback</h3>
            <button
              onClick={handleClose}
              className="text-gray-400 hover:text-white transition-colors"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          {/* Content */}
          <div className="p-4">
            {submitted ? (
              <div className="text-center py-8">
                <div className="w-16 h-16 bg-green-500/20 rounded-full flex items-center justify-center mx-auto mb-4">
                  <svg className="w-8 h-8 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                </div>
                <p className="text-white font-medium">Thank you!</p>
                <p className="text-gray-400 text-sm">Your feedback helps us improve.</p>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-4">
                {/* Type Dropdown */}
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-1">
                    Type
                  </label>
                  <select
                    value={type}
                    onChange={(e) => setType(e.target.value as FeedbackType)}
                    className="w-full bg-cscx-gray-800 border border-cscx-gray-700 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-cscx-accent"
                  >
                    {feedbackTypes.map((ft) => (
                      <option key={ft.value} value={ft.value}>
                        {ft.label}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Message Textarea */}
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-1">
                    Message <span className="text-cscx-accent">*</span>
                  </label>
                  <textarea
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                    placeholder="Tell us what's on your mind..."
                    rows={4}
                    required
                    className="w-full bg-cscx-gray-800 border border-cscx-gray-700 rounded-lg px-3 py-2 text-white placeholder-gray-500 focus:outline-none focus:border-cscx-accent resize-none"
                  />
                </div>

                {/* Rating (Optional) */}
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    Rating (optional)
                  </label>
                  <div className="flex gap-2">
                    {[1, 2, 3, 4, 5].map((star) => (
                      <button
                        key={star}
                        type="button"
                        onClick={() => setRating(rating === star ? null : star)}
                        className={`text-2xl transition-colors ${
                          rating !== null && star <= rating
                            ? 'text-yellow-400'
                            : 'text-gray-600 hover:text-gray-400'
                        }`}
                      >
                        ★
                      </button>
                    ))}
                  </div>
                </div>

                {/* Error Message */}
                {error && (
                  <div className="p-3 bg-red-900/20 border border-red-500/30 rounded-lg">
                    <p className="text-red-400 text-sm">{error}</p>
                  </div>
                )}

                {/* Submit Button */}
                <button
                  type="submit"
                  disabled={isSubmitting || !message.trim()}
                  className="w-full bg-cscx-accent hover:bg-red-600 text-white font-medium py-2 px-4 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isSubmitting ? (
                    <span className="flex items-center justify-center gap-2">
                      <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      Sending...
                    </span>
                  ) : (
                    'Send Feedback'
                  )}
                </button>
              </form>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export default FeedbackWidget;
