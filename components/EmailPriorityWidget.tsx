/**
 * Email Priority Widget
 * PRD Email Integration: US-007
 *
 * Shows top 5 emails requiring attention with priority scoring.
 * Priority based on: sender importance, urgency keywords, customer health.
 */

import React, { useState, useEffect, useCallback } from 'react';

interface PriorityEmail {
  id: string;
  subject: string;
  from_email: string;
  from_name?: string;
  date: string;
  snippet?: string;
  is_read: boolean;
  is_important: boolean;
  priority?: number;
  customer_id?: string;
  customer_name?: string;
  labels?: string[];
}

interface EmailSummary {
  summary: string;
  key_points: string[];
  action_items: Array<{
    description: string;
    owner?: string;
    urgency: 'high' | 'medium' | 'low';
  }>;
  sentiment: 'positive' | 'neutral' | 'negative' | 'mixed';
}

interface EmailPriorityWidgetProps {
  userId?: string;
  compact?: boolean;
  limit?: number;
  refreshInterval?: number; // in milliseconds
  onEmailClick?: (emailId: string) => void;
}

// Demo user ID for development
const DEMO_USER_ID = 'df2dc7be-ece0-40b2-a9d7-0f6c45b75131';

export function EmailPriorityWidget({
  userId: providedUserId,
  compact = false,
  limit = 5,
  refreshInterval = 60000, // 1 minute default
  onEmailClick
}: EmailPriorityWidgetProps) {
  const userId = providedUserId || DEMO_USER_ID;
  const [emails, setEmails] = useState<PriorityEmail[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [summarizing, setSummarizing] = useState<string | null>(null);
  const [activeSummary, setActiveSummary] = useState<{ id: string; data: EmailSummary } | null>(null);

  const API_URL = import.meta.env.VITE_API_URL || '';

  // Fetch priority emails
  const fetchPriorityEmails = useCallback(async () => {
    try {
      const response = await fetch(
        `${API_URL}/api/email/list?limit=${limit}&sortBy=priority&sortOrder=desc&importantOnly=false`,
        {
          headers: {
            'x-user-id': userId
          }
        }
      );

      if (response.ok) {
        const data = await response.json();
        setEmails(data.emails || []);
        setError(null);
      } else {
        const errorData = await response.json();
        setError(errorData.error || 'Failed to fetch emails');
      }
    } catch (err) {
      console.error('Failed to fetch priority emails:', err);
      setError('Failed to connect to email service');
    } finally {
      setLoading(false);
    }
  }, [userId, limit, API_URL]);

  // Initial fetch and auto-refresh
  useEffect(() => {
    fetchPriorityEmails();

    const interval = setInterval(fetchPriorityEmails, refreshInterval);
    return () => clearInterval(interval);
  }, [fetchPriorityEmails, refreshInterval]);

  // Summarize a single email
  const handleSummarize = async (emailId: string) => {
    setSummarizing(emailId);
    setActiveSummary(null);

    try {
      const response = await fetch(`${API_URL}/api/email/summarize`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-user-id': userId
        },
        body: JSON.stringify({ emailIds: [emailId] })
      });

      if (response.ok) {
        const data = await response.json();
        setActiveSummary({ id: emailId, data });
      } else {
        const errorData = await response.json();
        setError(errorData.error || 'Failed to summarize email');
      }
    } catch (err) {
      console.error('Failed to summarize email:', err);
      setError('Failed to summarize email');
    } finally {
      setSummarizing(null);
    }
  };

  // Get priority indicator color
  const getPriorityColor = (email: PriorityEmail): string => {
    if (email.priority && email.priority >= 8) return 'bg-red-500';
    if (email.priority && email.priority >= 5) return 'bg-yellow-500';
    if (email.is_important) return 'bg-orange-500';
    return 'bg-blue-500';
  };

  // Get priority label
  const getPriorityLabel = (email: PriorityEmail): string => {
    if (email.priority && email.priority >= 8) return 'Urgent';
    if (email.priority && email.priority >= 5) return 'High';
    if (email.is_important) return 'Important';
    return 'Normal';
  };

  // Format relative date
  const formatRelativeDate = (dateStr: string): string => {
    const date = new Date(dateStr);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    return date.toLocaleDateString();
  };

  // Compact view - just count and indicator
  if (compact) {
    const urgentCount = emails.filter(e => (e.priority && e.priority >= 8) || e.is_important).length;

    return (
      <div className="flex items-center gap-2">
        {loading ? (
          <div className="w-3 h-3 rounded-full bg-gray-400 animate-pulse" />
        ) : urgentCount > 0 ? (
          <>
            <div className="w-3 h-3 rounded-full bg-red-500 animate-pulse" />
            <span className="text-xs text-gray-400">{urgentCount} urgent emails</span>
          </>
        ) : emails.length > 0 ? (
          <>
            <div className="w-3 h-3 rounded-full bg-blue-500" />
            <span className="text-xs text-gray-400">{emails.length} emails</span>
          </>
        ) : (
          <span className="text-xs text-gray-500">No priority emails</span>
        )}
      </div>
    );
  }

  // Full view
  return (
    <div className="bg-cscx-gray-800 rounded-lg border border-cscx-gray-700">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-cscx-gray-700">
        <div className="flex items-center gap-2">
          <svg className="w-5 h-5 text-cscx-accent" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
          </svg>
          <span className="font-medium text-white">Priority Inbox</span>
        </div>

        <button
          onClick={fetchPriorityEmails}
          className="p-1.5 text-gray-400 hover:text-white rounded transition-colors"
          title="Refresh"
        >
          <svg className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
          </svg>
        </button>
      </div>

      {/* Error state */}
      {error && (
        <div className="p-3 mx-4 mt-3 rounded bg-red-900/30 border border-red-800 text-red-400 text-sm">
          {error}
          <button
            onClick={() => setError(null)}
            className="ml-2 text-red-300 hover:text-red-200"
          >
            ✕
          </button>
        </div>
      )}

      {/* Loading state */}
      {loading && emails.length === 0 && (
        <div className="p-8 text-center">
          <div className="w-8 h-8 mx-auto mb-2 border-2 border-gray-600 border-t-cscx-accent rounded-full animate-spin" />
          <span className="text-sm text-gray-400">Loading emails...</span>
        </div>
      )}

      {/* Empty state */}
      {!loading && emails.length === 0 && !error && (
        <div className="p-8 text-center">
          <svg className="w-12 h-12 mx-auto mb-3 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4" />
          </svg>
          <p className="text-sm text-gray-500">No priority emails</p>
          <p className="text-xs text-gray-600 mt-1">Connect Gmail to see your important emails</p>
        </div>
      )}

      {/* Email list */}
      {emails.length > 0 && (
        <div className="divide-y divide-cscx-gray-700">
          {emails.map((email) => (
            <div
              key={email.id}
              className={`p-4 hover:bg-cscx-gray-700/50 transition-colors ${!email.is_read ? 'bg-cscx-gray-700/30' : ''}`}
            >
              <div className="flex items-start gap-3">
                {/* Priority indicator */}
                <div className={`w-2 h-2 mt-2 rounded-full flex-shrink-0 ${getPriorityColor(email)}`} />

                {/* Email content */}
                <div className="flex-1 min-w-0">
                  {/* Header row */}
                  <div className="flex items-center justify-between gap-2 mb-1">
                    <span className={`text-sm truncate ${!email.is_read ? 'text-white font-medium' : 'text-gray-300'}`}>
                      {email.from_name || email.from_email}
                    </span>
                    <span className="text-xs text-gray-500 flex-shrink-0">
                      {formatRelativeDate(email.date)}
                    </span>
                  </div>

                  {/* Subject */}
                  <p className={`text-sm truncate ${!email.is_read ? 'text-gray-200' : 'text-gray-400'}`}>
                    {email.subject}
                  </p>

                  {/* Snippet preview */}
                  {email.snippet && (
                    <p className="text-xs text-gray-500 truncate mt-1">
                      {email.snippet}
                    </p>
                  )}

                  {/* Tags row */}
                  <div className="flex items-center gap-2 mt-2">
                    {/* Priority badge */}
                    <span className={`text-xs px-1.5 py-0.5 rounded ${
                      getPriorityLabel(email) === 'Urgent' ? 'bg-red-900/50 text-red-400' :
                      getPriorityLabel(email) === 'High' ? 'bg-yellow-900/50 text-yellow-400' :
                      getPriorityLabel(email) === 'Important' ? 'bg-orange-900/50 text-orange-400' :
                      'bg-gray-700 text-gray-400'
                    }`}>
                      {getPriorityLabel(email)}
                    </span>

                    {/* Customer association */}
                    {email.customer_name && (
                      <span className="text-xs px-1.5 py-0.5 rounded bg-blue-900/50 text-blue-400">
                        {email.customer_name}
                      </span>
                    )}

                    {/* Unread indicator */}
                    {!email.is_read && (
                      <span className="text-xs px-1.5 py-0.5 rounded bg-cscx-accent/20 text-cscx-accent">
                        New
                      </span>
                    )}
                  </div>

                  {/* Quick actions */}
                  <div className="flex items-center gap-2 mt-3">
                    <button
                      onClick={() => handleSummarize(email.id)}
                      disabled={summarizing === email.id}
                      className="text-xs px-2 py-1 text-gray-400 hover:text-white border border-gray-600 rounded transition-colors disabled:opacity-50"
                    >
                      {summarizing === email.id ? (
                        <span className="flex items-center gap-1">
                          <svg className="w-3 h-3 animate-spin" fill="none" viewBox="0 0 24 24">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                          </svg>
                          Summarizing...
                        </span>
                      ) : (
                        'Summarize'
                      )}
                    </button>

                    <button
                      onClick={() => onEmailClick?.(email.id)}
                      className="text-xs px-2 py-1 text-gray-400 hover:text-white border border-gray-600 rounded transition-colors"
                    >
                      View
                    </button>
                  </div>

                  {/* Summary display */}
                  {activeSummary?.id === email.id && (
                    <div className="mt-3 p-3 bg-cscx-gray-900 rounded-lg border border-cscx-gray-700">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-xs font-medium text-gray-300">AI Summary</span>
                        <button
                          onClick={() => setActiveSummary(null)}
                          className="text-gray-500 hover:text-gray-300"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                          </svg>
                        </button>
                      </div>

                      <p className="text-sm text-gray-300 mb-2">{activeSummary.data.summary}</p>

                      {activeSummary.data.key_points.length > 0 && (
                        <div className="mb-2">
                          <span className="text-xs text-gray-500">Key Points:</span>
                          <ul className="mt-1 space-y-1">
                            {activeSummary.data.key_points.map((point, i) => (
                              <li key={i} className="text-xs text-gray-400 flex items-start gap-1">
                                <span className="text-cscx-accent">•</span>
                                {point}
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}

                      {activeSummary.data.action_items.length > 0 && (
                        <div>
                          <span className="text-xs text-gray-500">Action Items:</span>
                          <ul className="mt-1 space-y-1">
                            {activeSummary.data.action_items.map((item, i) => (
                              <li key={i} className="text-xs flex items-start gap-1">
                                <span className={
                                  item.urgency === 'high' ? 'text-red-400' :
                                  item.urgency === 'medium' ? 'text-yellow-400' :
                                  'text-gray-400'
                                }>
                                  {item.urgency === 'high' ? '⚠️' : item.urgency === 'medium' ? '📌' : '○'}
                                </span>
                                <span className="text-gray-400">{item.description}</span>
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}

                      {/* Sentiment indicator */}
                      <div className="mt-2 pt-2 border-t border-cscx-gray-700">
                        <span className={`text-xs ${
                          activeSummary.data.sentiment === 'positive' ? 'text-green-400' :
                          activeSummary.data.sentiment === 'negative' ? 'text-red-400' :
                          activeSummary.data.sentiment === 'mixed' ? 'text-yellow-400' :
                          'text-gray-400'
                        }`}>
                          Sentiment: {activeSummary.data.sentiment}
                        </span>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Footer */}
      {emails.length > 0 && (
        <div className="p-3 border-t border-cscx-gray-700 text-center">
          <span className="text-xs text-gray-500">
            Auto-refreshes every {Math.round(refreshInterval / 1000)}s
          </span>
        </div>
      )}
    </div>
  );
}

export default EmailPriorityWidget;
