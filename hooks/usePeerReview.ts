/**
 * PRD-253: Peer Review Workflow Hook
 *
 * Custom hook for managing peer review workflow state and operations.
 */

import { useState, useCallback, useRef, useEffect } from 'react';
import type {
  ReviewRequest,
  ReviewAssignment,
  ReviewComment,
  ReviewQueueItem,
  CreateReviewRequestInput,
  AddCommentInput,
  SubmitDecisionInput,
  SuggestedReviewer,
  ReviewAnalytics,
  PaginatedResponse,
  ReviewRequestStatus,
  AssignmentStatus,
} from '../types/peerReview';

const API_URL = import.meta.env.VITE_API_URL || '';

// ============================================
// STATE INTERFACES
// ============================================

export interface PeerReviewState {
  // My requests
  myRequests: ReviewRequest[];
  myRequestsLoading: boolean;
  myRequestsTotal: number;

  // Review queue
  reviewQueue: ReviewQueueItem[];
  queueLoading: boolean;
  queueTotal: number;

  // Current review
  currentRequest: ReviewRequest | null;
  currentAssignment: ReviewAssignment | null;
  comments: ReviewComment[];

  // Suggested reviewers
  suggestedReviewers: SuggestedReviewer[];
  suggestionsLoading: boolean;

  // Analytics
  analytics: ReviewAnalytics | null;
  analyticsLoading: boolean;

  // General
  error: string | null;
  isSubmitting: boolean;
}

export interface UsePeerReviewReturn {
  state: PeerReviewState;

  // Request operations
  createRequest: (input: CreateReviewRequestInput) => Promise<ReviewRequest | null>;
  getMyRequests: (status?: ReviewRequestStatus, page?: number) => Promise<void>;
  getRequest: (requestId: string) => Promise<ReviewRequest | null>;
  cancelRequest: (requestId: string) => Promise<boolean>;

  // Assignment operations
  assignReviewer: (requestId: string, reviewerUserId: string) => Promise<boolean>;
  getReviewQueue: (status?: AssignmentStatus, page?: number) => Promise<void>;
  startReview: (assignmentId: string) => Promise<boolean>;
  declineAssignment: (assignmentId: string, reason?: string) => Promise<boolean>;

  // Decision operations
  submitDecision: (assignmentId: string, input: SubmitDecisionInput) => Promise<boolean>;
  approve: (assignmentId: string, feedback?: string, rating?: number) => Promise<boolean>;
  requestChanges: (assignmentId: string, feedback: string, rating?: number) => Promise<boolean>;
  reject: (assignmentId: string, feedback: string, rating?: number) => Promise<boolean>;

  // Comment operations
  addComment: (assignmentId: string, input: AddCommentInput) => Promise<ReviewComment | null>;
  getComments: (assignmentId: string) => Promise<void>;
  resolveComment: (commentId: string, note?: string) => Promise<boolean>;

  // Suggestions
  getSuggestedReviewers: (input?: Partial<CreateReviewRequestInput>) => Promise<void>;

  // Analytics
  getAnalytics: () => Promise<void>;

  // Utility
  clearError: () => void;
  reset: () => void;
}

// ============================================
// INITIAL STATE
// ============================================

const initialState: PeerReviewState = {
  myRequests: [],
  myRequestsLoading: false,
  myRequestsTotal: 0,

  reviewQueue: [],
  queueLoading: false,
  queueTotal: 0,

  currentRequest: null,
  currentAssignment: null,
  comments: [],

  suggestedReviewers: [],
  suggestionsLoading: false,

  analytics: null,
  analyticsLoading: false,

  error: null,
  isSubmitting: false,
};

// ============================================
// HOOK IMPLEMENTATION
// ============================================

export function usePeerReview(): UsePeerReviewReturn {
  const [state, setState] = useState<PeerReviewState>(initialState);
  const abortControllerRef = useRef<AbortController | null>(null);

  // Get user ID from localStorage
  const getUserId = () => localStorage.getItem('userId') || '';

  // Helper for API calls
  const apiCall = useCallback(async <T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<T> => {
    const userId = getUserId();
    const response = await fetch(`${API_URL}${endpoint}`, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        ...(userId ? { 'x-user-id': userId } : {}),
        ...options.headers,
      },
    });

    const data = await response.json();

    if (!response.ok || !data.success) {
      throw new Error(data.error || 'API request failed');
    }

    return data;
  }, []);

  // ============================================
  // REQUEST OPERATIONS
  // ============================================

  const createRequest = useCallback(async (
    input: CreateReviewRequestInput
  ): Promise<ReviewRequest | null> => {
    setState(prev => ({ ...prev, isSubmitting: true, error: null }));

    try {
      const data = await apiCall<{ request: ReviewRequest }>(
        '/api/peer-review/requests',
        {
          method: 'POST',
          body: JSON.stringify(input),
        }
      );

      setState(prev => ({
        ...prev,
        isSubmitting: false,
        currentRequest: data.request,
      }));

      return data.request;
    } catch (error) {
      setState(prev => ({
        ...prev,
        isSubmitting: false,
        error: error instanceof Error ? error.message : 'Failed to create request',
      }));
      return null;
    }
  }, [apiCall]);

  const getMyRequests = useCallback(async (
    status?: ReviewRequestStatus,
    page = 1
  ): Promise<void> => {
    setState(prev => ({ ...prev, myRequestsLoading: true, error: null }));

    try {
      const params = new URLSearchParams({ page: page.toString() });
      if (status) params.append('status', status);

      const data = await apiCall<PaginatedResponse<ReviewRequest>>(
        `/api/peer-review/requests?${params}`
      );

      setState(prev => ({
        ...prev,
        myRequestsLoading: false,
        myRequests: data.items,
        myRequestsTotal: data.total,
      }));
    } catch (error) {
      setState(prev => ({
        ...prev,
        myRequestsLoading: false,
        error: error instanceof Error ? error.message : 'Failed to fetch requests',
      }));
    }
  }, [apiCall]);

  const getRequest = useCallback(async (requestId: string): Promise<ReviewRequest | null> => {
    try {
      const data = await apiCall<{ request: ReviewRequest }>(
        `/api/peer-review/requests/${requestId}`
      );

      setState(prev => ({
        ...prev,
        currentRequest: data.request,
      }));

      return data.request;
    } catch (error) {
      setState(prev => ({
        ...prev,
        error: error instanceof Error ? error.message : 'Failed to fetch request',
      }));
      return null;
    }
  }, [apiCall]);

  const cancelRequest = useCallback(async (requestId: string): Promise<boolean> => {
    setState(prev => ({ ...prev, isSubmitting: true, error: null }));

    try {
      await apiCall<{ success: boolean }>(
        `/api/peer-review/requests/${requestId}`,
        { method: 'DELETE' }
      );

      setState(prev => ({
        ...prev,
        isSubmitting: false,
        myRequests: prev.myRequests.filter(r => r.id !== requestId),
        currentRequest: prev.currentRequest?.id === requestId ? null : prev.currentRequest,
      }));

      return true;
    } catch (error) {
      setState(prev => ({
        ...prev,
        isSubmitting: false,
        error: error instanceof Error ? error.message : 'Failed to cancel request',
      }));
      return false;
    }
  }, [apiCall]);

  // ============================================
  // ASSIGNMENT OPERATIONS
  // ============================================

  const assignReviewer = useCallback(async (
    requestId: string,
    reviewerUserId: string
  ): Promise<boolean> => {
    setState(prev => ({ ...prev, isSubmitting: true, error: null }));

    try {
      await apiCall<{ assignment: ReviewAssignment }>(
        `/api/peer-review/requests/${requestId}/assign`,
        {
          method: 'POST',
          body: JSON.stringify({ reviewerUserId }),
        }
      );

      setState(prev => ({ ...prev, isSubmitting: false }));
      return true;
    } catch (error) {
      setState(prev => ({
        ...prev,
        isSubmitting: false,
        error: error instanceof Error ? error.message : 'Failed to assign reviewer',
      }));
      return false;
    }
  }, [apiCall]);

  const getReviewQueue = useCallback(async (
    status?: AssignmentStatus,
    page = 1
  ): Promise<void> => {
    setState(prev => ({ ...prev, queueLoading: true, error: null }));

    try {
      const params = new URLSearchParams({ page: page.toString() });
      if (status) params.append('status', status);

      const data = await apiCall<PaginatedResponse<ReviewQueueItem>>(
        `/api/peer-review/queue?${params}`
      );

      setState(prev => ({
        ...prev,
        queueLoading: false,
        reviewQueue: data.items,
        queueTotal: data.total,
      }));
    } catch (error) {
      setState(prev => ({
        ...prev,
        queueLoading: false,
        error: error instanceof Error ? error.message : 'Failed to fetch queue',
      }));
    }
  }, [apiCall]);

  const startReview = useCallback(async (assignmentId: string): Promise<boolean> => {
    setState(prev => ({ ...prev, isSubmitting: true, error: null }));

    try {
      const data = await apiCall<{ assignment: ReviewAssignment }>(
        `/api/peer-review/assignments/${assignmentId}/start`,
        { method: 'POST' }
      );

      setState(prev => ({
        ...prev,
        isSubmitting: false,
        currentAssignment: data.assignment,
      }));

      return true;
    } catch (error) {
      setState(prev => ({
        ...prev,
        isSubmitting: false,
        error: error instanceof Error ? error.message : 'Failed to start review',
      }));
      return false;
    }
  }, [apiCall]);

  const declineAssignment = useCallback(async (
    assignmentId: string,
    reason?: string
  ): Promise<boolean> => {
    setState(prev => ({ ...prev, isSubmitting: true, error: null }));

    try {
      await apiCall<{ success: boolean }>(
        `/api/peer-review/assignments/${assignmentId}/decline`,
        {
          method: 'POST',
          body: JSON.stringify({ reason }),
        }
      );

      setState(prev => ({
        ...prev,
        isSubmitting: false,
        reviewQueue: prev.reviewQueue.filter(q => q.assignment.id !== assignmentId),
      }));

      return true;
    } catch (error) {
      setState(prev => ({
        ...prev,
        isSubmitting: false,
        error: error instanceof Error ? error.message : 'Failed to decline assignment',
      }));
      return false;
    }
  }, [apiCall]);

  // ============================================
  // DECISION OPERATIONS
  // ============================================

  const submitDecision = useCallback(async (
    assignmentId: string,
    input: SubmitDecisionInput
  ): Promise<boolean> => {
    setState(prev => ({ ...prev, isSubmitting: true, error: null }));

    const endpoint = `/api/peer-review/assignments/${assignmentId}/${
      input.decision === 'approved' ? 'approve' :
      input.decision === 'changes_requested' ? 'request-changes' : 'reject'
    }`;

    try {
      const data = await apiCall<{ assignment: ReviewAssignment }>(
        endpoint,
        {
          method: 'POST',
          body: JSON.stringify({
            overallFeedback: input.overallFeedback,
            rating: input.rating,
          }),
        }
      );

      setState(prev => ({
        ...prev,
        isSubmitting: false,
        currentAssignment: data.assignment,
        reviewQueue: prev.reviewQueue.filter(q => q.assignment.id !== assignmentId),
      }));

      return true;
    } catch (error) {
      setState(prev => ({
        ...prev,
        isSubmitting: false,
        error: error instanceof Error ? error.message : 'Failed to submit decision',
      }));
      return false;
    }
  }, [apiCall]);

  const approve = useCallback(async (
    assignmentId: string,
    feedback?: string,
    rating?: number
  ): Promise<boolean> => {
    return submitDecision(assignmentId, {
      decision: 'approved',
      overallFeedback: feedback,
      rating,
    });
  }, [submitDecision]);

  const requestChanges = useCallback(async (
    assignmentId: string,
    feedback: string,
    rating?: number
  ): Promise<boolean> => {
    return submitDecision(assignmentId, {
      decision: 'changes_requested',
      overallFeedback: feedback,
      rating,
    });
  }, [submitDecision]);

  const reject = useCallback(async (
    assignmentId: string,
    feedback: string,
    rating?: number
  ): Promise<boolean> => {
    return submitDecision(assignmentId, {
      decision: 'rejected',
      overallFeedback: feedback,
      rating,
    });
  }, [submitDecision]);

  // ============================================
  // COMMENT OPERATIONS
  // ============================================

  const addComment = useCallback(async (
    assignmentId: string,
    input: AddCommentInput
  ): Promise<ReviewComment | null> => {
    try {
      const data = await apiCall<{ comment: ReviewComment }>(
        `/api/peer-review/assignments/${assignmentId}/comments`,
        {
          method: 'POST',
          body: JSON.stringify(input),
        }
      );

      setState(prev => ({
        ...prev,
        comments: [...prev.comments, data.comment],
      }));

      return data.comment;
    } catch (error) {
      setState(prev => ({
        ...prev,
        error: error instanceof Error ? error.message : 'Failed to add comment',
      }));
      return null;
    }
  }, [apiCall]);

  const getComments = useCallback(async (assignmentId: string): Promise<void> => {
    try {
      const data = await apiCall<{ comments: ReviewComment[] }>(
        `/api/peer-review/assignments/${assignmentId}/comments`
      );

      setState(prev => ({
        ...prev,
        comments: data.comments,
      }));
    } catch (error) {
      setState(prev => ({
        ...prev,
        error: error instanceof Error ? error.message : 'Failed to fetch comments',
      }));
    }
  }, [apiCall]);

  const resolveComment = useCallback(async (
    commentId: string,
    note?: string
  ): Promise<boolean> => {
    try {
      const data = await apiCall<{ comment: ReviewComment }>(
        `/api/peer-review/comments/${commentId}/resolve`,
        {
          method: 'POST',
          body: JSON.stringify({ resolutionNote: note }),
        }
      );

      setState(prev => ({
        ...prev,
        comments: prev.comments.map(c =>
          c.id === commentId ? data.comment : c
        ),
      }));

      return true;
    } catch (error) {
      setState(prev => ({
        ...prev,
        error: error instanceof Error ? error.message : 'Failed to resolve comment',
      }));
      return false;
    }
  }, [apiCall]);

  // ============================================
  // SUGGESTIONS
  // ============================================

  const getSuggestedReviewers = useCallback(async (
    input?: Partial<CreateReviewRequestInput>
  ): Promise<void> => {
    setState(prev => ({ ...prev, suggestionsLoading: true, error: null }));

    try {
      const data = await apiCall<{ suggestions: SuggestedReviewer[] }>(
        '/api/peer-review/suggest-reviewers',
        {
          method: 'POST',
          body: JSON.stringify(input || {}),
        }
      );

      setState(prev => ({
        ...prev,
        suggestionsLoading: false,
        suggestedReviewers: data.suggestions,
      }));
    } catch (error) {
      setState(prev => ({
        ...prev,
        suggestionsLoading: false,
        error: error instanceof Error ? error.message : 'Failed to get suggestions',
      }));
    }
  }, [apiCall]);

  // ============================================
  // ANALYTICS
  // ============================================

  const getAnalytics = useCallback(async (): Promise<void> => {
    setState(prev => ({ ...prev, analyticsLoading: true, error: null }));

    try {
      const data = await apiCall<{ analytics: ReviewAnalytics }>(
        '/api/peer-review/analytics'
      );

      setState(prev => ({
        ...prev,
        analyticsLoading: false,
        analytics: data.analytics,
      }));
    } catch (error) {
      setState(prev => ({
        ...prev,
        analyticsLoading: false,
        error: error instanceof Error ? error.message : 'Failed to fetch analytics',
      }));
    }
  }, [apiCall]);

  // ============================================
  // UTILITY
  // ============================================

  const clearError = useCallback(() => {
    setState(prev => ({ ...prev, error: null }));
  }, []);

  const reset = useCallback(() => {
    setState(initialState);
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, []);

  return {
    state,
    createRequest,
    getMyRequests,
    getRequest,
    cancelRequest,
    assignReviewer,
    getReviewQueue,
    startReview,
    declineAssignment,
    submitDecision,
    approve,
    requestChanges,
    reject,
    addComment,
    getComments,
    resolveComment,
    getSuggestedReviewers,
    getAnalytics,
    clearError,
    reset,
  };
}

export default usePeerReview;
