/**
 * useEmailSuggestions Hook
 * PRD-215: Smart Email Response Suggestions
 *
 * Custom hook for managing AI-powered email response suggestions.
 * Handles generation, selection, editing, sending, and feedback.
 */

import { useState, useCallback, useRef } from 'react';
import type {
  EmailSuggestionsState,
  UseEmailSuggestionsReturn,
  SuggestResponseRequest,
  SendSuggestionResponse,
  SuggestionFeedback,
  EmailResponseSuggestion,
  DetectedIntent,
  UrgencyLevel,
  RecommendedAction,
} from '../types/emailSuggestions';

const API_URL = import.meta.env.VITE_API_URL || '';

const initialState: EmailSuggestionsState = {
  isLoading: false,
  suggestions: [],
  selectedSuggestionId: null,
  detectedIntent: null,
  urgency: null,
  recommendedAction: null,
  error: null,
  isEditing: false,
  editedContent: null,
  isSending: false,
};

/**
 * Hook for managing email response suggestions
 */
export function useEmailSuggestions(): UseEmailSuggestionsReturn {
  const [state, setState] = useState<EmailSuggestionsState>(initialState);

  // Keep track of the last request for feedback
  const lastRequestRef = useRef<SuggestResponseRequest | null>(null);

  /**
   * Generate suggestions for an email
   */
  const generateSuggestions = useCallback(async (request: SuggestResponseRequest) => {
    setState(prev => ({
      ...prev,
      isLoading: true,
      error: null,
      suggestions: [],
      selectedSuggestionId: null,
      isEditing: false,
      editedContent: null,
    }));

    lastRequestRef.current = request;

    try {
      const userId = localStorage.getItem('userId') || '';
      const response = await fetch(`${API_URL}/api/email/suggest-response`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(userId ? { 'x-user-id': userId } : {}),
        },
        body: JSON.stringify(request),
      });

      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.error || 'Failed to generate suggestions');
      }

      setState(prev => ({
        ...prev,
        isLoading: false,
        suggestions: data.suggestions || [],
        detectedIntent: data.detectedIntent || null,
        urgency: data.urgency || null,
        recommendedAction: data.recommendedAction || null,
        // Auto-select the first (highest confidence) suggestion
        selectedSuggestionId: data.suggestions?.[0]?.id || null,
      }));
    } catch (error) {
      console.error('Error generating suggestions:', error);
      setState(prev => ({
        ...prev,
        isLoading: false,
        error: error instanceof Error ? error.message : 'Failed to generate suggestions',
      }));
    }
  }, []);

  /**
   * Select a suggestion
   */
  const selectSuggestion = useCallback((id: string) => {
    setState(prev => ({
      ...prev,
      selectedSuggestionId: id,
      isEditing: false,
      editedContent: null,
    }));
  }, []);

  /**
   * Start editing the selected suggestion
   */
  const startEditing = useCallback(() => {
    setState(prev => {
      const selected = prev.suggestions.find(s => s.id === prev.selectedSuggestionId);
      if (!selected) return prev;

      return {
        ...prev,
        isEditing: true,
        editedContent: {
          subject: selected.subject,
          body: selected.fullText,
        },
      };
    });
  }, []);

  /**
   * Update edited content
   */
  const updateEdit = useCallback((field: 'subject' | 'body', value: string) => {
    setState(prev => {
      if (!prev.editedContent) return prev;
      return {
        ...prev,
        editedContent: {
          ...prev.editedContent,
          [field]: value,
        },
      };
    });
  }, []);

  /**
   * Cancel editing
   */
  const cancelEdit = useCallback(() => {
    setState(prev => ({
      ...prev,
      isEditing: false,
      editedContent: null,
    }));
  }, []);

  /**
   * Send the selected suggestion
   */
  const sendSuggestion = useCallback(async (options: { sendNow: boolean }): Promise<SendSuggestionResponse> => {
    const { selectedSuggestionId, suggestions, editedContent, isEditing } = state;
    const request = lastRequestRef.current;

    if (!selectedSuggestionId || !request) {
      return { success: false, error: 'No suggestion selected' };
    }

    const selected = suggestions.find(s => s.id === selectedSuggestionId);
    if (!selected) {
      return { success: false, error: 'Selected suggestion not found' };
    }

    setState(prev => ({ ...prev, isSending: true }));

    try {
      const userId = localStorage.getItem('userId') || '';

      // Determine if content was edited
      const hasEdits = isEditing && editedContent && (
        editedContent.subject !== selected.subject ||
        editedContent.body !== selected.fullText
      );

      const response = await fetch(`${API_URL}/api/email/send-suggestion`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(userId ? { 'x-user-id': userId } : {}),
        },
        body: JSON.stringify({
          suggestionId: selectedSuggestionId,
          emailId: request.emailId,
          threadId: request.threadId,
          recipientEmail: request.emailContent?.from?.email,
          customerId: request.customerId,
          edits: hasEdits ? editedContent : undefined,
          sendNow: options.sendNow,
          logActivity: true,
          createFollowUpTask: false,
        }),
      });

      const data = await response.json();

      setState(prev => ({ ...prev, isSending: false }));

      if (!response.ok || !data.success) {
        return { success: false, error: data.error || 'Failed to send email' };
      }

      return {
        success: true,
        messageId: data.messageId,
        draftId: data.draftId,
        activityLogged: data.activityLogged,
        followUpTaskId: data.followUpTaskId,
      };
    } catch (error) {
      setState(prev => ({ ...prev, isSending: false }));
      console.error('Error sending suggestion:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to send email',
      };
    }
  }, [state]);

  /**
   * Provide feedback on a suggestion
   */
  const provideFeedback = useCallback(async (
    feedback: SuggestionFeedback,
    rating?: number
  ) => {
    const { selectedSuggestionId, suggestions, editedContent, isEditing } = state;
    const request = lastRequestRef.current;

    if (!selectedSuggestionId) {
      console.warn('No suggestion selected for feedback');
      return;
    }

    const selected = suggestions.find(s => s.id === selectedSuggestionId);

    try {
      const userId = localStorage.getItem('userId') || '';

      await fetch(`${API_URL}/api/email/feedback`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(userId ? { 'x-user-id': userId } : {}),
        },
        body: JSON.stringify({
          suggestionId: selectedSuggestionId,
          emailId: request?.emailId || 'unknown',
          feedback,
          rating,
          originalText: selected?.fullText,
          finalText: isEditing && editedContent ? editedContent.body : selected?.fullText,
        }),
      });
    } catch (error) {
      console.error('Error providing feedback:', error);
      // Don't throw - feedback is non-critical
    }
  }, [state]);

  /**
   * Reset state
   */
  const reset = useCallback(() => {
    setState(initialState);
    lastRequestRef.current = null;
  }, []);

  return {
    state,
    generateSuggestions,
    selectSuggestion,
    startEditing,
    updateEdit,
    cancelEdit,
    sendSuggestion,
    provideFeedback,
    reset,
  };
}

/**
 * Helper to get urgency color
 */
export function getUrgencyColor(urgency: UrgencyLevel | null): string {
  switch (urgency) {
    case 'critical':
      return '#dc2626'; // red
    case 'high':
      return '#ea580c'; // orange
    case 'normal':
      return '#2563eb'; // blue
    case 'low':
      return '#6b7280'; // gray
    default:
      return '#6b7280';
  }
}

/**
 * Helper to get urgency label
 */
export function getUrgencyLabel(urgency: UrgencyLevel | null): string {
  switch (urgency) {
    case 'critical':
      return 'Critical - Respond Immediately';
    case 'high':
      return 'High - Respond Today';
    case 'normal':
      return 'Normal';
    case 'low':
      return 'Low Priority';
    default:
      return 'Unknown';
  }
}

/**
 * Helper to get intent label
 */
export function getIntentLabel(intent: DetectedIntent | null): string {
  const labels: Record<DetectedIntent, string> = {
    information_request: 'Information Request',
    support_request: 'Support Request',
    scheduling_request: 'Scheduling Request',
    escalation: 'Escalation',
    feedback: 'Feedback',
    renewal_discussion: 'Renewal Discussion',
    general: 'General Inquiry',
    complaint: 'Complaint',
    thank_you: 'Thank You',
  };
  return intent ? labels[intent] || 'Unknown' : 'Unknown';
}

/**
 * Helper to get recommended action label
 */
export function getRecommendedActionLabel(action: RecommendedAction | null): string {
  const labels: Record<RecommendedAction, string> = {
    respond_immediately: 'Respond Immediately',
    respond_today: 'Respond Today',
    respond_this_week: 'Respond This Week',
    schedule_call: 'Schedule a Call',
    escalate: 'Escalate',
    forward_to_support: 'Forward to Support',
  };
  return action ? labels[action] || 'Unknown' : 'Unknown';
}

export default useEmailSuggestions;
