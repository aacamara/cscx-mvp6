/**
 * Integrations Centre
 * Shows connected services and allows access to Google Calendar, Gmail, Drive
 */

import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';

const API_URL = import.meta.env.VITE_API_URL || '';

interface CalendarEvent {
  id: string;
  title: string;
  startTime: string;
  endTime: string;
  attendees: Array<{ email: string; name?: string }>;
  meetLink?: string;
  location?: string;
}

interface EmailThread {
  id: string;
  subject: string;
  snippet: string;
  from: string;
  lastMessageAt: string;
  messageCount: number;
  isUnread: boolean;
}

interface DriveFile {
  id: string;
  name: string;
  mimeType: string;
  webViewLink: string;
  modifiedTime: string;
  iconLink?: string;
}

interface ConnectionStatus {
  connected: boolean;
  email?: string;
  scopes?: string[];
  isValid?: boolean;
}

export function IntegrationsCentre() {
  const { user, hasGoogleAccess, getAuthHeaders, connectGoogleWorkspace } = useAuth();

  // Connection status
  const [googleStatus, setGoogleStatus] = useState<ConnectionStatus | null>(null);
  const [loadingStatus, setLoadingStatus] = useState(true);

  // Data states
  const [calendarEvents, setCalendarEvents] = useState<CalendarEvent[]>([]);
  const [emailThreads, setEmailThreads] = useState<EmailThread[]>([]);
  const [driveFiles, setDriveFiles] = useState<DriveFile[]>([]);

  // Loading states
  const [loadingCalendar, setLoadingCalendar] = useState(false);
  const [loadingEmails, setLoadingEmails] = useState(false);
  const [loadingDrive, setLoadingDrive] = useState(false);

  // Active tab
  const [activeTab, setActiveTab] = useState<'overview' | 'calendar' | 'email' | 'drive'>('overview');

  // Error states
  const [error, setError] = useState<string | null>(null);

  // Check Google connection status
  useEffect(() => {
    checkGoogleStatus();
  }, [hasGoogleAccess]);

  // Load data when Google is connected
  useEffect(() => {
    if (googleStatus?.connected) {
      loadAllData();
    }
  }, [googleStatus?.connected]);

  const checkGoogleStatus = async () => {
    setLoadingStatus(true);
    try {
      const response = await fetch(`${API_URL}/api/google/auth/status`, {
        headers: getAuthHeaders(),
      });
      if (response.ok) {
        const data = await response.json();
        setGoogleStatus(data);
      } else {
        setGoogleStatus({ connected: false });
      }
    } catch (err) {
      console.error('Failed to check Google status:', err);
      setGoogleStatus({ connected: false });
    } finally {
      setLoadingStatus(false);
    }
  };

  const loadAllData = async () => {
    await Promise.all([
      loadCalendarEvents(),
      loadEmailThreads(),
      loadDriveFiles(),
    ]);
  };

  const loadCalendarEvents = async () => {
    setLoadingCalendar(true);
    try {
      const response = await fetch(`${API_URL}/api/google/calendar/events/upcoming?days=7`, {
        headers: getAuthHeaders(),
      });
      if (response.ok) {
        const data = await response.json();
        setCalendarEvents(data.events || []);
      }
    } catch (err) {
      console.error('Failed to load calendar:', err);
    } finally {
      setLoadingCalendar(false);
    }
  };

  const loadEmailThreads = async () => {
    setLoadingEmails(true);
    try {
      const response = await fetch(`${API_URL}/api/google/gmail/threads?maxResults=10`, {
        headers: getAuthHeaders(),
      });
      if (response.ok) {
        const data = await response.json();
        setEmailThreads(data.threads || []);
      }
    } catch (err) {
      console.error('Failed to load emails:', err);
    } finally {
      setLoadingEmails(false);
    }
  };

  const loadDriveFiles = async () => {
    setLoadingDrive(true);
    try {
      const response = await fetch(`${API_URL}/api/google/drive/files?maxResults=10`, {
        headers: getAuthHeaders(),
      });
      if (response.ok) {
        const data = await response.json();
        setDriveFiles(data.files || []);
      }
    } catch (err) {
      console.error('Failed to load drive files:', err);
    } finally {
      setLoadingDrive(false);
    }
  };

  const handleConnectGoogle = async () => {
    try {
      await connectGoogleWorkspace();
    } catch (err) {
      setError('Failed to connect Google. Please try again.');
    }
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    });
  };

  const formatRelativeTime = (dateStr: string) => {
    const date = new Date(dateStr);
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    const hours = Math.floor(diff / (1000 * 60 * 60));
    const minutes = Math.floor(diff / (1000 * 60));

    if (days > 0) return `${days}d ago`;
    if (hours > 0) return `${hours}h ago`;
    if (minutes > 0) return `${minutes}m ago`;
    return 'Just now';
  };

  // Render not connected state
  if (loadingStatus) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="animate-spin rounded-full h-8 w-8 border-2 border-cscx-accent border-t-transparent" />
      </div>
    );
  }

  if (!googleStatus?.connected) {
    return (
      <div className="bg-cscx-gray-900 rounded-xl border border-cscx-gray-800 p-8">
        <div className="text-center max-w-md mx-auto">
          <div className="text-6xl mb-4">🔗</div>
          <h2 className="text-2xl font-bold text-white mb-2">Connect Your Google Workspace</h2>
          <p className="text-cscx-gray-400 mb-6">
            Connect your Google account to access Calendar, Gmail, and Drive directly from CSCX.AI
          </p>

          <div className="bg-cscx-gray-800 rounded-lg p-4 mb-6 text-left">
            <p className="text-sm text-cscx-gray-300 mb-3">You'll get access to:</p>
            <ul className="space-y-2 text-sm">
              <li className="flex items-center gap-2 text-cscx-gray-300">
                <span className="text-green-500">✓</span> Calendar events and meeting scheduling
              </li>
              <li className="flex items-center gap-2 text-cscx-gray-300">
                <span className="text-green-500">✓</span> Gmail inbox and email drafting
              </li>
              <li className="flex items-center gap-2 text-cscx-gray-300">
                <span className="text-green-500">✓</span> Drive files and document search
              </li>
              <li className="flex items-center gap-2 text-cscx-gray-300">
                <span className="text-green-500">✓</span> AI-powered meeting briefs
              </li>
            </ul>
          </div>

          <button
            onClick={handleConnectGoogle}
            className="w-full flex items-center justify-center gap-3 bg-white hover:bg-gray-100 text-gray-900 font-medium py-3 px-4 rounded-lg transition-colors"
          >
            <svg className="w-5 h-5" viewBox="0 0 24 24">
              <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
              <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
              <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
              <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
            </svg>
            Connect Google Workspace
          </button>

          {error && (
            <p className="mt-4 text-sm text-red-400">{error}</p>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header with connection status */}
      <div className="bg-cscx-gray-900 rounded-xl border border-cscx-gray-800 p-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-full bg-green-500/20 flex items-center justify-center">
              <svg className="w-6 h-6 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <div>
              <h2 className="text-xl font-semibold text-white">Google Workspace Connected</h2>
              <p className="text-sm text-cscx-gray-400">{googleStatus.email}</p>
            </div>
          </div>
          <button
            onClick={loadAllData}
            className="px-4 py-2 bg-cscx-gray-800 hover:bg-cscx-gray-700 text-white rounded-lg transition-colors flex items-center gap-2"
          >
            <span>↻</span> Refresh All
          </button>
        </div>

        {/* Integration cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-6">
          <div className="bg-cscx-gray-800 rounded-lg p-4">
            <div className="flex items-center gap-3 mb-2">
              <span className="text-2xl">📅</span>
              <span className="text-white font-medium">Calendar</span>
            </div>
            <p className="text-2xl font-bold text-white">{calendarEvents.length}</p>
            <p className="text-sm text-cscx-gray-400">upcoming events</p>
          </div>

          <div className="bg-cscx-gray-800 rounded-lg p-4">
            <div className="flex items-center gap-3 mb-2">
              <span className="text-2xl">✉️</span>
              <span className="text-white font-medium">Gmail</span>
            </div>
            <p className="text-2xl font-bold text-white">{emailThreads.length}</p>
            <p className="text-sm text-cscx-gray-400">recent threads</p>
          </div>

          <div className="bg-cscx-gray-800 rounded-lg p-4">
            <div className="flex items-center gap-3 mb-2">
              <span className="text-2xl">📁</span>
              <span className="text-white font-medium">Drive</span>
            </div>
            <p className="text-2xl font-bold text-white">{driveFiles.length}</p>
            <p className="text-sm text-cscx-gray-400">recent files</p>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 p-1 bg-cscx-gray-900 rounded-lg w-fit">
        {(['overview', 'calendar', 'email', 'drive'] as const).map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-4 py-2 text-sm font-medium rounded-md transition-colors capitalize ${
              activeTab === tab
                ? 'bg-cscx-accent text-white'
                : 'text-cscx-gray-400 hover:text-white hover:bg-cscx-gray-800'
            }`}
          >
            {tab === 'email' ? 'Gmail' : tab}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      <div className="bg-cscx-gray-900 rounded-xl border border-cscx-gray-800">
        {/* Overview Tab */}
        {activeTab === 'overview' && (
          <div className="p-6 grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Upcoming Meetings */}
            <div>
              <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                <span>📅</span> Upcoming Meetings
              </h3>
              {loadingCalendar ? (
                <div className="animate-pulse space-y-3">
                  {[1, 2, 3].map(i => (
                    <div key={i} className="h-16 bg-cscx-gray-800 rounded-lg" />
                  ))}
                </div>
              ) : calendarEvents.length === 0 ? (
                <p className="text-cscx-gray-500 text-sm">No upcoming meetings</p>
              ) : (
                <div className="space-y-3">
                  {calendarEvents.slice(0, 5).map((event) => (
                    <div key={event.id} className="bg-cscx-gray-800 rounded-lg p-3">
                      <p className="text-white font-medium text-sm truncate">{event.title}</p>
                      <p className="text-xs text-cscx-gray-400 mt-1">{formatDate(event.startTime)}</p>
                      {event.meetLink && (
                        <a
                          href={event.meetLink}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-xs text-cscx-accent hover:underline mt-1 inline-block"
                        >
                          Join Meet
                        </a>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Recent Emails */}
            <div>
              <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                <span>✉️</span> Recent Emails
              </h3>
              {loadingEmails ? (
                <div className="animate-pulse space-y-3">
                  {[1, 2, 3].map(i => (
                    <div key={i} className="h-16 bg-cscx-gray-800 rounded-lg" />
                  ))}
                </div>
              ) : emailThreads.length === 0 ? (
                <p className="text-cscx-gray-500 text-sm">No recent emails</p>
              ) : (
                <div className="space-y-3">
                  {emailThreads.slice(0, 5).map((thread) => (
                    <div key={thread.id} className="bg-cscx-gray-800 rounded-lg p-3">
                      <p className="text-white font-medium text-sm truncate">{thread.subject}</p>
                      <p className="text-xs text-cscx-gray-400 mt-1 truncate">{thread.from}</p>
                      <p className="text-xs text-cscx-gray-500 mt-1">{formatRelativeTime(thread.lastMessageAt)}</p>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Recent Files */}
            <div>
              <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                <span>📁</span> Recent Files
              </h3>
              {loadingDrive ? (
                <div className="animate-pulse space-y-3">
                  {[1, 2, 3].map(i => (
                    <div key={i} className="h-16 bg-cscx-gray-800 rounded-lg" />
                  ))}
                </div>
              ) : driveFiles.length === 0 ? (
                <p className="text-cscx-gray-500 text-sm">No recent files</p>
              ) : (
                <div className="space-y-3">
                  {driveFiles.slice(0, 5).map((file) => (
                    <a
                      key={file.id}
                      href={file.webViewLink}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="bg-cscx-gray-800 rounded-lg p-3 block hover:bg-cscx-gray-700 transition-colors"
                    >
                      <p className="text-white font-medium text-sm truncate">{file.name}</p>
                      <p className="text-xs text-cscx-gray-400 mt-1">{formatRelativeTime(file.modifiedTime)}</p>
                    </a>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Calendar Tab */}
        {activeTab === 'calendar' && (
          <div className="p-6">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-lg font-semibold text-white">Calendar Events</h3>
              <button
                onClick={loadCalendarEvents}
                disabled={loadingCalendar}
                className="px-3 py-1 text-sm bg-cscx-gray-800 hover:bg-cscx-gray-700 text-white rounded-lg transition-colors"
              >
                {loadingCalendar ? 'Loading...' : 'Refresh'}
              </button>
            </div>

            {calendarEvents.length === 0 ? (
              <p className="text-cscx-gray-500">No upcoming events in the next 7 days</p>
            ) : (
              <div className="space-y-4">
                {calendarEvents.map((event) => (
                  <div key={event.id} className="bg-cscx-gray-800 rounded-lg p-4 flex items-start justify-between">
                    <div className="flex-1">
                      <h4 className="text-white font-medium">{event.title}</h4>
                      <p className="text-sm text-cscx-gray-400 mt-1">{formatDate(event.startTime)}</p>
                      {event.attendees.length > 0 && (
                        <p className="text-xs text-cscx-gray-500 mt-2">
                          {event.attendees.slice(0, 3).map(a => a.name || a.email).join(', ')}
                          {event.attendees.length > 3 && ` +${event.attendees.length - 3} more`}
                        </p>
                      )}
                    </div>
                    {event.meetLink && (
                      <a
                        href={event.meetLink}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="px-3 py-1 bg-blue-600 hover:bg-blue-700 text-white text-sm rounded-lg transition-colors"
                      >
                        Join
                      </a>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Email Tab */}
        {activeTab === 'email' && (
          <div className="p-6">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-lg font-semibold text-white">Gmail Inbox</h3>
              <button
                onClick={loadEmailThreads}
                disabled={loadingEmails}
                className="px-3 py-1 text-sm bg-cscx-gray-800 hover:bg-cscx-gray-700 text-white rounded-lg transition-colors"
              >
                {loadingEmails ? 'Loading...' : 'Refresh'}
              </button>
            </div>

            {emailThreads.length === 0 ? (
              <p className="text-cscx-gray-500">No recent emails</p>
            ) : (
              <div className="space-y-3">
                {emailThreads.map((thread) => (
                  <div
                    key={thread.id}
                    className={`bg-cscx-gray-800 rounded-lg p-4 ${thread.isUnread ? 'border-l-4 border-cscx-accent' : ''}`}
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <h4 className={`font-medium ${thread.isUnread ? 'text-white' : 'text-cscx-gray-300'}`}>
                          {thread.subject || '(no subject)'}
                        </h4>
                        <p className="text-sm text-cscx-gray-400 mt-1">{thread.from}</p>
                        <p className="text-sm text-cscx-gray-500 mt-2 line-clamp-2">{thread.snippet}</p>
                      </div>
                      <div className="text-xs text-cscx-gray-500 whitespace-nowrap ml-4">
                        {formatRelativeTime(thread.lastMessageAt)}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Drive Tab */}
        {activeTab === 'drive' && (
          <div className="p-6">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-lg font-semibold text-white">Google Drive</h3>
              <button
                onClick={loadDriveFiles}
                disabled={loadingDrive}
                className="px-3 py-1 text-sm bg-cscx-gray-800 hover:bg-cscx-gray-700 text-white rounded-lg transition-colors"
              >
                {loadingDrive ? 'Loading...' : 'Refresh'}
              </button>
            </div>

            {driveFiles.length === 0 ? (
              <p className="text-cscx-gray-500">No recent files</p>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {driveFiles.map((file) => (
                  <a
                    key={file.id}
                    href={file.webViewLink}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="bg-cscx-gray-800 rounded-lg p-4 hover:bg-cscx-gray-700 transition-colors block"
                  >
                    <div className="flex items-start gap-3">
                      {file.iconLink ? (
                        <img src={file.iconLink} alt="" className="w-6 h-6" />
                      ) : (
                        <span className="text-xl">📄</span>
                      )}
                      <div className="flex-1 min-w-0">
                        <h4 className="text-white font-medium text-sm truncate">{file.name}</h4>
                        <p className="text-xs text-cscx-gray-500 mt-1">
                          Modified {formatRelativeTime(file.modifiedTime)}
                        </p>
                      </div>
                    </div>
                  </a>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

export default IntegrationsCentre;
