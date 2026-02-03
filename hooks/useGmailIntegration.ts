/**
 * useGmailIntegration Hook
 * PRD-190: Gmail Integration for CSCX.AI
 *
 * Custom hook for managing Gmail integration state including:
 * - Email thread sync for customers
 * - Customer email metrics
 * - Template-based composition
 * - AI-assisted email generation
 */

import { useState, useCallback, useRef, useEffect } from 'react';
import type {
  GmailIntegrationState,
  UseGmailIntegrationReturn,
  GmailThread,
  GmailMessage,
  EmailTemplate,
  EmailTemplateCategory,
  ComposeEmailRequest,
  ComposeEmailResponse,
  GenerateEmailRequest,
  GenerateEmailResponse,
  CustomerEmailMetrics,
  SyncCustomerEmailsRequest,
  SyncCustomerEmailsResponse,
  EmailDraftData,
} from '../types/gmailIntegration';

const API_URL = import.meta.env.VITE_API_URL || '';

const initialState: GmailIntegrationState = {
  // Connection
  isConnected: false,
  userEmail: null,
  isConnecting: false,
  connectionError: null,

  // Threads
  threads: [],
  selectedThread: null,
  selectedMessages: [],
  isLoadingThreads: false,
  threadsError: null,
  nextPageToken: null,

  // Customer threads
  customerThreads: new Map(),
  isLoadingCustomerThreads: false,

  // Compose
  isComposing: false,
  draftData: null,
  isSending: false,
  sendError: null,

  // Templates
  templates: [],
  isLoadingTemplates: false,

  // Metrics
  metrics: null,
  isLoadingMetrics: false,

  // AI
  isGeneratingEmail: false,
  generatedEmail: null,

  // Sync
  isSyncing: false,
  lastSyncAt: null,
};

/**
 * Hook for Gmail integration functionality
 */
export function useGmailIntegration(): UseGmailIntegrationReturn {
  const [state, setState] = useState<GmailIntegrationState>(initialState);
  const abortControllerRef = useRef<AbortController | null>(null);

  /**
   * Get user ID from localStorage
   */
  const getUserId = useCallback(() => {
    return localStorage.getItem('userId') || '';
  }, []);

  /**
   * Get request headers
   */
  const getHeaders = useCallback(() => {
    const userId = getUserId();
    return {
      'Content-Type': 'application/json',
      ...(userId ? { 'x-user-id': userId } : {}),
    };
  }, [getUserId]);

  // ==================== Connection Methods ====================

  /**
   * Check Google connection status
   */
  const checkConnection = useCallback(async () => {
    try {
      const response = await fetch(`${API_URL}/api/google/auth/status`, {
        headers: getHeaders(),
      });

      const data = await response.json();

      setState(prev => ({
        ...prev,
        isConnected: data.connected || false,
        userEmail: data.email || null,
        connectionError: null,
      }));
    } catch (error) {
      setState(prev => ({
        ...prev,
        isConnected: false,
        connectionError: 'Failed to check connection status',
      }));
    }
  }, [getHeaders]);

  /**
   * Connect to Google
   */
  const connect = useCallback(async () => {
    setState(prev => ({ ...prev, isConnecting: true, connectionError: null }));

    try {
      const response = await fetch(`${API_URL}/api/google/auth/url`, {
        headers: getHeaders(),
      });

      const data = await response.json();

      if (data.url) {
        window.location.href = data.url;
      } else {
        throw new Error('Failed to get authorization URL');
      }
    } catch (error) {
      setState(prev => ({
        ...prev,
        isConnecting: false,
        connectionError: error instanceof Error ? error.message : 'Connection failed',
      }));
    }
  }, [getHeaders]);

  /**
   * Disconnect from Google
   */
  const disconnect = useCallback(async () => {
    try {
      await fetch(`${API_URL}/api/google/auth/disconnect`, {
        method: 'POST',
        headers: getHeaders(),
      });

      setState(prev => ({
        ...prev,
        isConnected: false,
        userEmail: null,
        threads: [],
        customerThreads: new Map(),
        metrics: null,
      }));
    } catch (error) {
      console.error('Failed to disconnect:', error);
    }
  }, [getHeaders]);

  // ==================== Thread Methods ====================

  /**
   * Load email threads
   */
  const loadThreads = useCallback(async (
    options: { query?: string; maxResults?: number; pageToken?: string } = {}
  ) => {
    setState(prev => ({ ...prev, isLoadingThreads: true, threadsError: null }));

    try {
      const params = new URLSearchParams();
      if (options.query) params.append('query', options.query);
      if (options.maxResults) params.append('maxResults', options.maxResults.toString());
      if (options.pageToken) params.append('pageToken', options.pageToken);

      const response = await fetch(
        `${API_URL}/api/google/gmail/threads?${params}`,
        { headers: getHeaders() }
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to load threads');
      }

      setState(prev => ({
        ...prev,
        isLoadingThreads: false,
        threads: options.pageToken ? [...prev.threads, ...data.threads] : data.threads,
        nextPageToken: data.nextPageToken || null,
      }));
    } catch (error) {
      setState(prev => ({
        ...prev,
        isLoadingThreads: false,
        threadsError: error instanceof Error ? error.message : 'Failed to load threads',
      }));
    }
  }, [getHeaders]);

  /**
   * Load a single thread with messages
   */
  const loadThread = useCallback(async (threadId: string) => {
    setState(prev => ({ ...prev, isLoadingThreads: true }));

    try {
      const response = await fetch(
        `${API_URL}/api/google/gmail/threads/${threadId}`,
        { headers: getHeaders() }
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to load thread');
      }

      setState(prev => ({
        ...prev,
        isLoadingThreads: false,
        selectedThread: data.thread,
        selectedMessages: data.messages,
      }));
    } catch (error) {
      setState(prev => ({
        ...prev,
        isLoadingThreads: false,
        threadsError: error instanceof Error ? error.message : 'Failed to load thread',
      }));
    }
  }, [getHeaders]);

  /**
   * Load threads for a specific customer
   */
  const loadCustomerThreads = useCallback(async (customerId: string) => {
    setState(prev => ({ ...prev, isLoadingCustomerThreads: true }));

    try {
      const response = await fetch(
        `${API_URL}/api/google/gmail/customer/${customerId}`,
        { headers: getHeaders() }
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to load customer threads');
      }

      setState(prev => {
        const newMap = new Map(prev.customerThreads);
        newMap.set(customerId, data.threads);
        return {
          ...prev,
          isLoadingCustomerThreads: false,
          customerThreads: newMap,
        };
      });
    } catch (error) {
      setState(prev => ({
        ...prev,
        isLoadingCustomerThreads: false,
        threadsError: error instanceof Error ? error.message : 'Failed to load customer threads',
      }));
    }
  }, [getHeaders]);

  /**
   * Refresh threads
   */
  const refreshThreads = useCallback(async () => {
    setState(prev => ({ ...prev, threads: [], nextPageToken: null }));
    await loadThreads();
  }, [loadThreads]);

  // ==================== Action Methods ====================

  /**
   * Mark thread as read
   */
  const markAsRead = useCallback(async (threadId: string) => {
    try {
      await fetch(
        `${API_URL}/api/google/gmail/threads/${threadId}/read`,
        { method: 'POST', headers: getHeaders() }
      );

      setState(prev => ({
        ...prev,
        threads: prev.threads.map(t =>
          t.gmailThreadId === threadId ? { ...t, isUnread: false } : t
        ),
      }));
    } catch (error) {
      console.error('Failed to mark as read:', error);
    }
  }, [getHeaders]);

  /**
   * Mark thread as unread
   */
  const markAsUnread = useCallback(async (threadId: string) => {
    try {
      await fetch(
        `${API_URL}/api/google/gmail/threads/${threadId}/unread`,
        { method: 'POST', headers: getHeaders() }
      );

      setState(prev => ({
        ...prev,
        threads: prev.threads.map(t =>
          t.gmailThreadId === threadId ? { ...t, isUnread: true } : t
        ),
      }));
    } catch (error) {
      console.error('Failed to mark as unread:', error);
    }
  }, [getHeaders]);

  /**
   * Archive thread
   */
  const archiveThread = useCallback(async (threadId: string) => {
    try {
      await fetch(
        `${API_URL}/api/google/gmail/threads/${threadId}/archive`,
        { method: 'POST', headers: getHeaders() }
      );

      setState(prev => ({
        ...prev,
        threads: prev.threads.filter(t => t.gmailThreadId !== threadId),
      }));
    } catch (error) {
      console.error('Failed to archive:', error);
    }
  }, [getHeaders]);

  /**
   * Star thread
   */
  const starThread = useCallback(async (threadId: string) => {
    try {
      await fetch(
        `${API_URL}/api/google/gmail/threads/${threadId}/star`,
        { method: 'POST', headers: getHeaders() }
      );

      setState(prev => ({
        ...prev,
        threads: prev.threads.map(t =>
          t.gmailThreadId === threadId ? { ...t, isStarred: true } : t
        ),
      }));
    } catch (error) {
      console.error('Failed to star:', error);
    }
  }, [getHeaders]);

  /**
   * Unstar thread
   */
  const unstarThread = useCallback(async (threadId: string) => {
    try {
      await fetch(
        `${API_URL}/api/google/gmail/threads/${threadId}/unstar`,
        { method: 'POST', headers: getHeaders() }
      );

      setState(prev => ({
        ...prev,
        threads: prev.threads.map(t =>
          t.gmailThreadId === threadId ? { ...t, isStarred: false } : t
        ),
      }));
    } catch (error) {
      console.error('Failed to unstar:', error);
    }
  }, [getHeaders]);

  // ==================== Compose Methods ====================

  /**
   * Start composing an email
   */
  const startCompose = useCallback((
    options: { customerId?: string; stakeholderIds?: string[]; templateId?: string } = {}
  ) => {
    const draftData: EmailDraftData = {
      id: `draft-${Date.now()}`,
      customerId: options.customerId,
      templateId: options.templateId,
      recipients: { to: [], cc: [], bcc: [] },
      subject: '',
      bodyHtml: '',
      isAiGenerated: false,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    setState(prev => ({
      ...prev,
      isComposing: true,
      draftData,
      sendError: null,
    }));
  }, []);

  /**
   * Cancel composing
   */
  const cancelCompose = useCallback(() => {
    setState(prev => ({
      ...prev,
      isComposing: false,
      draftData: null,
      generatedEmail: null,
      sendError: null,
    }));
  }, []);

  /**
   * Send an email
   */
  const sendEmail = useCallback(async (
    request: ComposeEmailRequest
  ): Promise<ComposeEmailResponse> => {
    setState(prev => ({ ...prev, isSending: true, sendError: null }));

    try {
      const response = await fetch(
        `${API_URL}/api/google/gmail/send-with-tracking`,
        {
          method: 'POST',
          headers: getHeaders(),
          body: JSON.stringify(request),
        }
      );

      const data = await response.json();

      setState(prev => ({
        ...prev,
        isSending: false,
        isComposing: data.success ? false : prev.isComposing,
        draftData: data.success ? null : prev.draftData,
        sendError: data.success ? null : data.error,
      }));

      return data;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to send email';
      setState(prev => ({
        ...prev,
        isSending: false,
        sendError: errorMessage,
      }));
      return { success: false, error: errorMessage };
    }
  }, [getHeaders]);

  /**
   * Save as draft
   */
  const saveDraft = useCallback(async (
    request: ComposeEmailRequest
  ): Promise<ComposeEmailResponse> => {
    setState(prev => ({ ...prev, isSending: true, sendError: null }));

    try {
      const response = await fetch(
        `${API_URL}/api/google/gmail/drafts`,
        {
          method: 'POST',
          headers: getHeaders(),
          body: JSON.stringify(request),
        }
      );

      const data = await response.json();

      setState(prev => ({
        ...prev,
        isSending: false,
        sendError: data.draftId ? null : 'Failed to save draft',
      }));

      return {
        success: !!data.draftId,
        draftId: data.draftId,
        error: data.error,
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to save draft';
      setState(prev => ({
        ...prev,
        isSending: false,
        sendError: errorMessage,
      }));
      return { success: false, error: errorMessage };
    }
  }, [getHeaders]);

  // ==================== Template Methods ====================

  /**
   * Load email templates
   */
  const loadTemplates = useCallback(async (category?: EmailTemplateCategory) => {
    setState(prev => ({ ...prev, isLoadingTemplates: true }));

    try {
      const params = new URLSearchParams();
      if (category) params.append('category', category);

      const response = await fetch(
        `${API_URL}/api/google/gmail/templates?${params}`,
        { headers: getHeaders() }
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to load templates');
      }

      setState(prev => ({
        ...prev,
        isLoadingTemplates: false,
        templates: data.templates,
      }));
    } catch (error) {
      setState(prev => ({
        ...prev,
        isLoadingTemplates: false,
      }));
      console.error('Failed to load templates:', error);
    }
  }, [getHeaders]);

  /**
   * Apply a template with variables
   */
  const applyTemplate = useCallback((
    templateId: string,
    variables: Record<string, string | number | string[]>
  ) => {
    const template = state.templates.find(t => t.id === templateId);
    if (!template) return;

    // Apply variables to template
    let subject = template.subject;
    let bodyHtml = template.bodyHtml;

    for (const [key, value] of Object.entries(variables)) {
      const placeholder = `{{${key}}}`;
      const replacement = Array.isArray(value)
        ? value.map(v => `<li>${v}</li>`).join('\n')
        : String(value);

      subject = subject.replace(new RegExp(placeholder.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g'), String(value));
      bodyHtml = bodyHtml.replace(new RegExp(placeholder.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g'), replacement);
    }

    setState(prev => ({
      ...prev,
      draftData: prev.draftData ? {
        ...prev.draftData,
        templateId,
        templateName: template.name,
        subject,
        bodyHtml,
        variablesUsed: variables,
        updatedAt: new Date(),
      } : null,
    }));
  }, [state.templates]);

  // ==================== AI Methods ====================

  /**
   * Generate email using AI
   */
  const generateEmail = useCallback(async (request: GenerateEmailRequest) => {
    setState(prev => ({ ...prev, isGeneratingEmail: true, generatedEmail: null }));

    try {
      const response = await fetch(
        `${API_URL}/api/email/generate`,
        {
          method: 'POST',
          headers: getHeaders(),
          body: JSON.stringify(request),
        }
      );

      const data: GenerateEmailResponse = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.error || 'Failed to generate email');
      }

      setState(prev => ({
        ...prev,
        isGeneratingEmail: false,
        generatedEmail: data.email || null,
        draftData: prev.draftData && data.email ? {
          ...prev.draftData,
          subject: data.email.subject,
          bodyHtml: data.email.bodyHtml,
          bodyText: data.email.bodyText,
          isAiGenerated: true,
          updatedAt: new Date(),
        } : prev.draftData,
      }));
    } catch (error) {
      setState(prev => ({
        ...prev,
        isGeneratingEmail: false,
      }));
      console.error('Failed to generate email:', error);
    }
  }, [getHeaders]);

  // ==================== Metrics Methods ====================

  /**
   * Load email metrics for a customer
   */
  const loadMetrics = useCallback(async (customerId: string, period: string = 'month') => {
    setState(prev => ({ ...prev, isLoadingMetrics: true }));

    try {
      const response = await fetch(
        `${API_URL}/api/google/gmail/customer/${customerId}/metrics?period=${period}`,
        { headers: getHeaders() }
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to load metrics');
      }

      setState(prev => ({
        ...prev,
        isLoadingMetrics: false,
        metrics: {
          customerId,
          period,
          emailsSent: data.metrics.emailsSent,
          emailsReceived: data.metrics.emailsReceived,
          avgResponseHours: data.metrics.avgResponseHours,
          totalThreads: data.metrics.totalThreads,
          avgThreadDepth: data.metrics.avgThreadDepth,
          lastOutboundAt: data.metrics.lastOutboundAt ? new Date(data.metrics.lastOutboundAt) : null,
          lastInboundAt: data.metrics.lastInboundAt ? new Date(data.metrics.lastInboundAt) : null,
          stakeholdersContacted: data.metrics.stakeholdersContacted || 0,
          uniqueRecipients: data.metrics.uniqueRecipients || 0,
          engagementScore: data.metrics.engagementScore || 0,
        },
      }));
    } catch (error) {
      setState(prev => ({
        ...prev,
        isLoadingMetrics: false,
      }));
      console.error('Failed to load metrics:', error);
    }
  }, [getHeaders]);

  // ==================== Sync Methods ====================

  /**
   * Sync customer emails
   */
  const syncCustomerEmails = useCallback(async (
    request: SyncCustomerEmailsRequest
  ): Promise<SyncCustomerEmailsResponse> => {
    setState(prev => ({ ...prev, isSyncing: true }));

    try {
      const response = await fetch(
        `${API_URL}/api/google/gmail/customer/${request.customerId}/sync`,
        {
          method: 'POST',
          headers: getHeaders(),
          body: JSON.stringify({
            maxResults: request.maxResults,
            sinceDays: request.sinceDays,
          }),
        }
      );

      const data = await response.json();

      setState(prev => ({
        ...prev,
        isSyncing: false,
        lastSyncAt: new Date(),
      }));

      return {
        success: data.success,
        threadsFound: data.threadsSynced || 0,
        threadsSynced: data.threadsSynced || 0,
        metricsUpdated: data.metricsUpdated || false,
        newThreadIds: data.newThreadIds || [],
        error: data.error,
      };
    } catch (error) {
      setState(prev => ({
        ...prev,
        isSyncing: false,
      }));

      return {
        success: false,
        threadsFound: 0,
        threadsSynced: 0,
        metricsUpdated: false,
        newThreadIds: [],
        error: error instanceof Error ? error.message : 'Sync failed',
      };
    }
  }, [getHeaders]);

  // Check connection on mount
  useEffect(() => {
    checkConnection();
  }, [checkConnection]);

  return {
    state,
    connect,
    disconnect,
    checkConnection,
    loadThreads,
    loadThread,
    loadCustomerThreads,
    refreshThreads,
    markAsRead,
    markAsUnread,
    archiveThread,
    starThread,
    unstarThread,
    startCompose,
    cancelCompose,
    sendEmail,
    saveDraft,
    loadTemplates,
    applyTemplate,
    generateEmail,
    loadMetrics,
    syncCustomerEmails,
  };
}

export default useGmailIntegration;
