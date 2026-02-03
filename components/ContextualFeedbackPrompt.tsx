/**
 * ContextualFeedbackPrompt - Show feedback prompts at key moments
 * PRD: Compound Product Launch (CP-009)
 * Displays at: after mock onboarding, after CSV import, after 3rd session
 */

import React, { useState, useEffect } from 'react';
import { trackEvent } from '../src/services/analytics';

const STORAGE_PREFIX = 'cscx_feedback_prompt_';
const SESSION_COUNT_KEY = 'cscx_session_count';

type PromptType = 'onboarding_complete' | 'csv_import' | 'third_session';

interface ContextualFeedbackPromptProps {
  type: PromptType;
  onDismiss?: () => void;
  onSubmit?: (feedback: string) => void;
}

const PROMPT_CONFIG: Record<PromptType, { question: string; placeholder: string }> = {
  onboarding_complete: {
    question: 'How was this experience?',
    placeholder: 'Tell us what you thought of the onboarding...',
  },
  csv_import: {
    question: 'Was the import easy?',
    placeholder: 'Any issues or suggestions for the import process?',
  },
  third_session: {
    question: 'What feature would help your workflow?',
    placeholder: 'What would make CSCX.AI more useful for you?',
  },
};

export function ContextualFeedbackPrompt({
  type,
  onDismiss,
  onSubmit,
}: ContextualFeedbackPromptProps) {
  const [isVisible, setIsVisible] = useState(false);
  const [feedback, setFeedback] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const storageKey = `${STORAGE_PREFIX}${type}`;
  const config = PROMPT_CONFIG[type];

  useEffect(() => {
    // Check if this prompt has been dismissed
    const dismissed = localStorage.getItem(storageKey);
    if (!dismissed) {
      setIsVisible(true);
      trackEvent('feedback_prompt_shown', { type });
    }
  }, [type, storageKey]);

  const handleDismiss = () => {
    localStorage.setItem(storageKey, 'dismissed');
    trackEvent('feedback_prompt_dismissed', { type });
    setIsVisible(false);
    onDismiss?.();
  };

  const handleSubmit = async () => {
    if (!feedback.trim()) return;

    setIsSubmitting(true);
    trackEvent('feedback_prompt_submitted', { type, has_feedback: true });

    try {
      const API_BASE = `${import.meta.env.VITE_API_URL || ''}/api`;
      await fetch(`${API_BASE}/feedback/widget`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'general',
          message: `[${type}] ${feedback}`,
          context: window.location.pathname,
        }),
      });

      localStorage.setItem(storageKey, 'submitted');
      setSubmitted(true);
      onSubmit?.(feedback);

      // Auto-dismiss after 2 seconds
      setTimeout(() => {
        setIsVisible(false);
        onDismiss?.();
      }, 2000);
    } catch (err) {
      console.error('Failed to submit contextual feedback:', err);
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isVisible) return null;

  return (
    <div className="fixed bottom-20 right-4 z-40 animate-slide-up">
      <div className="bg-cscx-gray-900 border border-cscx-gray-800 rounded-xl shadow-2xl w-80 overflow-hidden">
        {submitted ? (
          <div className="p-6 text-center">
            <div className="w-12 h-12 bg-green-500/20 rounded-full flex items-center justify-center mx-auto mb-3">
              <svg className="w-6 h-6 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <p className="text-white font-medium">Thanks for your feedback!</p>
          </div>
        ) : (
          <>
            {/* Header */}
            <div className="flex items-start justify-between p-4 border-b border-cscx-gray-800">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 bg-cscx-accent/20 rounded-full flex items-center justify-center">
                  <svg className="w-4 h-4 text-cscx-accent" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
                <p className="text-white font-medium">{config.question}</p>
              </div>
              <button
                onClick={handleDismiss}
                className="text-gray-500 hover:text-gray-300 transition-colors"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Content */}
            <div className="p-4">
              <textarea
                value={feedback}
                onChange={(e) => setFeedback(e.target.value)}
                placeholder={config.placeholder}
                rows={3}
                className="w-full bg-cscx-gray-800 border border-cscx-gray-700 rounded-lg px-3 py-2 text-white placeholder-gray-500 focus:outline-none focus:border-cscx-accent resize-none text-sm"
              />

              <div className="flex gap-2 mt-3">
                <button
                  onClick={handleDismiss}
                  className="flex-1 py-2 px-3 bg-cscx-gray-800 hover:bg-cscx-gray-700 text-gray-400 text-sm rounded-lg transition-colors"
                >
                  Skip
                </button>
                <button
                  onClick={handleSubmit}
                  disabled={isSubmitting || !feedback.trim()}
                  className="flex-1 py-2 px-3 bg-cscx-accent hover:bg-red-600 text-white text-sm font-medium rounded-lg transition-colors disabled:opacity-50"
                >
                  {isSubmitting ? 'Sending...' : 'Send'}
                </button>
              </div>
            </div>
          </>
        )}
      </div>

      <style>{`
        @keyframes slide-up {
          from {
            opacity: 0;
            transform: translateY(20px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
        .animate-slide-up {
          animation: slide-up 0.3s ease-out;
        }
      `}</style>
    </div>
  );
}

/**
 * Hook to check if third session prompt should be shown
 */
export function useThirdSessionPrompt(): boolean {
  const [shouldShow, setShouldShow] = useState(false);

  useEffect(() => {
    const count = parseInt(localStorage.getItem(SESSION_COUNT_KEY) || '0', 10);
    const newCount = count + 1;
    localStorage.setItem(SESSION_COUNT_KEY, newCount.toString());

    // Show on exactly the 3rd session
    if (newCount === 3) {
      const dismissed = localStorage.getItem(`${STORAGE_PREFIX}third_session`);
      if (!dismissed) {
        setShouldShow(true);
      }
    }
  }, []);

  return shouldShow;
}

export default ContextualFeedbackPrompt;
