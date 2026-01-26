/**
 * WorkspacePanel - Customer-Specific Google Workspace Integration
 * Embeds in CustomerDetail to show per-customer integrations
 */

import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';

const API_URL = import.meta.env.VITE_API_URL || '';

// ============================================
// Types
// ============================================

interface CalendarEvent {
  id: string;
  title: string;
  startTime: string;
  endTime: string;
  attendees: Array<{ email: string; name?: string }>;
  meetLink?: string;
}

interface EmailThread {
  id: string;
  subject: string;
  snippet: string;
  from: string;
  lastMessageAt: string;
  isUnread: boolean;
}

interface DriveFile {
  id: string;
  name: string;
  mimeType: string;
  webViewLink: string;
  modifiedTime: string;
}

interface WorkspacePanelProps {
  customerId: string;
  customerName: string;
  customerEmail?: string;
  compact?: boolean;
}

// ============================================
// Component
// ============================================

export const WorkspacePanel: React.FC<WorkspacePanelProps> = ({
  customerId,
  customerName,
  customerEmail,
  compact = false
}) => {
  const { hasGoogleAccess, getAuthHeaders, connectGoogleWorkspace } = useAuth();

  // Data states
  const [meetings, setMeetings] = useState<CalendarEvent[]>([]);
  const [emails, setEmails] = useState<EmailThread[]>([]);
  const [files, setFiles] = useState<DriveFile[]>([]);

  // Loading states
  const [loadingMeetings, setLoadingMeetings] = useState(false);
  const [loadingEmails, setLoadingEmails] = useState(false);
  const [loadingFiles, setLoadingFiles] = useState(false);

  // Active tab
  const [activeTab, setActiveTab] = useState<'calendar' | 'email' | 'drive'>('calendar');

  // Load data when connected
  useEffect(() => {
    if (hasGoogleAccess) {
      loadCustomerData();
    }
  }, [hasGoogleAccess, customerId]);

  const loadCustomerData = async () => {
    await Promise.all([
      loadMeetings(),
      loadEmails(),
      loadFiles()
    ]);
  };

  const loadMeetings = async () => {
    setLoadingMeetings(true);
    try {
      // Get meetings where customer is an attendee
      const response = await fetch(
        `${API_URL}/api/google/calendar/events/upcoming?days=30&attendee=${encodeURIComponent(customerEmail || '')}`,
        { headers: getAuthHeaders() }
      );
      if (response.ok) {
        const data = await response.json();
        setMeetings(data.events || []);
      }
    } catch (err) {
      console.error('Failed to load meetings:', err);
    } finally {
      setLoadingMeetings(false);
    }
  };

  const loadEmails = async () => {
    if (!customerEmail) return;

    setLoadingEmails(true);
    try {
      const response = await fetch(
        `${API_URL}/api/google/gmail/threads?from=${encodeURIComponent(customerEmail)}&maxResults=5`,
        { headers: getAuthHeaders() }
      );
      if (response.ok) {
        const data = await response.json();
        setEmails(data.threads || []);
      }
    } catch (err) {
      console.error('Failed to load emails:', err);
    } finally {
      setLoadingEmails(false);
    }
  };

  const loadFiles = async () => {
    setLoadingFiles(true);
    try {
      // Search for files related to this customer
      const response = await fetch(
        `${API_URL}/api/google/drive/files?q=${encodeURIComponent(customerName)}&maxResults=5`,
        { headers: getAuthHeaders() }
      );
      if (response.ok) {
        const data = await response.json();
        setFiles(data.files || []);
      }
    } catch (err) {
      console.error('Failed to load files:', err);
    } finally {
      setLoadingFiles(false);
    }
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit'
    });
  };

  const formatRelativeTime = (dateStr: string) => {
    const date = new Date(dateStr);
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    const hours = Math.floor(diff / (1000 * 60 * 60));

    if (days > 0) return `${days}d ago`;
    if (hours > 0) return `${hours}h ago`;
    return 'Just now';
  };

  // Not connected state
  if (!hasGoogleAccess) {
    return (
      <div className="bg-cscx-gray-900 border border-cscx-gray-800 rounded-xl p-6">
        <div className="text-center">
          <span className="text-3xl mb-3 block">🔗</span>
          <h3 className="text-white font-medium mb-1">Connect Google Workspace</h3>
          <p className="text-sm text-cscx-gray-400 mb-4">
            View this customer's emails, meetings, and files
          </p>
          <button
            onClick={connectGoogleWorkspace}
            className="px-4 py-2 bg-white hover:bg-gray-100 text-gray-900 text-sm font-medium rounded-lg transition-colors flex items-center justify-center gap-2 mx-auto"
          >
            <svg className="w-4 h-4" viewBox="0 0 24 24">
              <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
              <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
              <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
              <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
            </svg>
            Connect
          </button>
        </div>
      </div>
    );
  }

  if (compact) {
    // Compact view - just counts
    return (
      <div className="bg-cscx-gray-900 border border-cscx-gray-800 rounded-xl p-4">
        <h3 className="text-sm font-medium text-cscx-gray-400 uppercase tracking-wider mb-3">
          Google Workspace
        </h3>
        <div className="grid grid-cols-3 gap-3">
          <div className="text-center p-2 bg-cscx-gray-800 rounded-lg">
            <p className="text-lg font-bold text-white">{meetings.length}</p>
            <p className="text-xs text-cscx-gray-400">Meetings</p>
          </div>
          <div className="text-center p-2 bg-cscx-gray-800 rounded-lg">
            <p className="text-lg font-bold text-white">{emails.length}</p>
            <p className="text-xs text-cscx-gray-400">Emails</p>
          </div>
          <div className="text-center p-2 bg-cscx-gray-800 rounded-lg">
            <p className="text-lg font-bold text-white">{files.length}</p>
            <p className="text-xs text-cscx-gray-400">Files</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-cscx-gray-900 border border-cscx-gray-800 rounded-xl overflow-hidden">
      {/* Header */}
      <div className="p-4 border-b border-cscx-gray-800 flex items-center justify-between">
        <h3 className="text-sm font-medium text-cscx-gray-400 uppercase tracking-wider">
          Customer Workspace
        </h3>
        <button
          onClick={loadCustomerData}
          className="text-xs text-cscx-accent hover:text-red-400 transition-colors"
        >
          ↻ Refresh
        </button>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-cscx-gray-800">
        {(['calendar', 'email', 'drive'] as const).map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`flex-1 px-4 py-2 text-xs font-medium transition-colors ${
              activeTab === tab
                ? 'bg-cscx-gray-800 text-white border-b-2 border-cscx-accent'
                : 'text-cscx-gray-400 hover:text-white'
            }`}
          >
            {tab === 'calendar' && '📅'}
            {tab === 'email' && '✉️'}
            {tab === 'drive' && '📁'}
            <span className="ml-1 capitalize">{tab === 'email' ? 'Gmail' : tab}</span>
          </button>
        ))}
      </div>

      {/* Content */}
      <div className="p-4 max-h-64 overflow-y-auto">
        {/* Calendar Tab */}
        {activeTab === 'calendar' && (
          <>
            {loadingMeetings ? (
              <div className="text-center py-4">
                <div className="animate-spin rounded-full h-5 w-5 border-2 border-cscx-accent border-t-transparent mx-auto" />
              </div>
            ) : meetings.length === 0 ? (
              <p className="text-sm text-cscx-gray-500 text-center py-4">
                No upcoming meetings with {customerName}
              </p>
            ) : (
              <div className="space-y-2">
                {meetings.map((meeting) => (
                  <div key={meeting.id} className="p-2 bg-cscx-gray-800 rounded-lg">
                    <p className="text-sm text-white font-medium truncate">{meeting.title}</p>
                    <p className="text-xs text-cscx-gray-400">{formatDate(meeting.startTime)}</p>
                    {meeting.meetLink && (
                      <a
                        href={meeting.meetLink}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-xs text-cscx-accent hover:underline"
                      >
                        Join Meet
                      </a>
                    )}
                  </div>
                ))}
              </div>
            )}
          </>
        )}

        {/* Email Tab */}
        {activeTab === 'email' && (
          <>
            {loadingEmails ? (
              <div className="text-center py-4">
                <div className="animate-spin rounded-full h-5 w-5 border-2 border-cscx-accent border-t-transparent mx-auto" />
              </div>
            ) : emails.length === 0 ? (
              <p className="text-sm text-cscx-gray-500 text-center py-4">
                No email threads with {customerEmail || customerName}
              </p>
            ) : (
              <div className="space-y-2">
                {emails.map((thread) => (
                  <div
                    key={thread.id}
                    className={`p-2 bg-cscx-gray-800 rounded-lg ${thread.isUnread ? 'border-l-2 border-cscx-accent' : ''}`}
                  >
                    <p className="text-sm text-white font-medium truncate">{thread.subject || '(no subject)'}</p>
                    <p className="text-xs text-cscx-gray-400 truncate">{thread.snippet}</p>
                    <p className="text-xs text-cscx-gray-500 mt-1">{formatRelativeTime(thread.lastMessageAt)}</p>
                  </div>
                ))}
              </div>
            )}
          </>
        )}

        {/* Drive Tab */}
        {activeTab === 'drive' && (
          <>
            {loadingFiles ? (
              <div className="text-center py-4">
                <div className="animate-spin rounded-full h-5 w-5 border-2 border-cscx-accent border-t-transparent mx-auto" />
              </div>
            ) : files.length === 0 ? (
              <p className="text-sm text-cscx-gray-500 text-center py-4">
                No files found for {customerName}
              </p>
            ) : (
              <div className="space-y-2">
                {files.map((file) => (
                  <a
                    key={file.id}
                    href={file.webViewLink}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="p-2 bg-cscx-gray-800 rounded-lg block hover:bg-cscx-gray-700 transition-colors"
                  >
                    <p className="text-sm text-white font-medium truncate">{file.name}</p>
                    <p className="text-xs text-cscx-gray-400">{formatRelativeTime(file.modifiedTime)}</p>
                  </a>
                ))}
              </div>
            )}
          </>
        )}
      </div>

      {/* Quick Actions */}
      <div className="p-4 border-t border-cscx-gray-800">
        <div className="flex gap-2">
          <button className="flex-1 px-3 py-2 bg-cscx-gray-800 hover:bg-cscx-gray-700 text-white text-xs rounded-lg transition-colors">
            📅 Schedule
          </button>
          <button className="flex-1 px-3 py-2 bg-cscx-gray-800 hover:bg-cscx-gray-700 text-white text-xs rounded-lg transition-colors">
            ✉️ Email
          </button>
          <button className="flex-1 px-3 py-2 bg-cscx-gray-800 hover:bg-cscx-gray-700 text-white text-xs rounded-lg transition-colors">
            📁 Upload
          </button>
        </div>
      </div>
    </div>
  );
};

export default WorkspacePanel;
