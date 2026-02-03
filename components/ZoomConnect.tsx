/**
 * Zoom Integration Component - PRD-209
 *
 * Settings panel for Zoom Meeting Management:
 * - OAuth connection
 * - Meeting sync and status
 * - Recording access
 * - Customer meeting history
 */

import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../context/AuthContext';
import {
  CheckCircle,
  AlertCircle,
  X,
  Loader2,
  Link,
  Unlink,
  RefreshCw,
  Video,
  Clock,
  Users,
  Calendar,
  Play,
  FileText,
  ExternalLink,
  ChevronDown,
  ChevronUp,
  Search,
} from 'lucide-react';

interface ZoomConnectionStatus {
  connected: boolean;
  email?: string;
  accountId?: string;
  connectedAt?: string;
  scopes?: string[];
}

interface ZoomMeeting {
  id: string;
  zoom_meeting_id: number;
  topic?: string;
  start_time?: string;
  scheduled_duration_minutes?: number;
  actual_duration_minutes?: number;
  status?: string;
  join_url?: string;
  recording_url?: string;
  has_transcript?: boolean;
  customer_id?: string;
  customer_match_method?: string;
  customer_match_confidence?: number;
  participant_count?: number;
  customers?: { id: string; name: string };
}

interface SyncResult {
  success: boolean;
  totalSynced: number;
  upcoming: { synced: number; errors: string[] };
  past: { synced: number; errors: string[] };
}

interface ZoomConnectProps {
  onClose?: () => void;
  customerId?: string;
}

export function ZoomConnect({ onClose, customerId }: ZoomConnectProps) {
  const { user, getAuthHeaders } = useAuth();
  const [status, setStatus] = useState<ZoomConnectionStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [connecting, setConnecting] = useState(false);
  const [disconnecting, setDisconnecting] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'overview' | 'meetings' | 'recordings'>('overview');
  const [meetings, setMeetings] = useState<ZoomMeeting[]>([]);
  const [loadingMeetings, setLoadingMeetings] = useState(false);
  const [showPast, setShowPast] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  const API_URL = import.meta.env.VITE_API_URL || '';
  const userId = user?.id;

  // Fetch connection status
  const fetchStatus = useCallback(async () => {
    if (!userId) return;

    setLoading(true);
    setError(null);

    try {
      const response = await fetch(`${API_URL}/api/zoom/status`, {
        headers: getAuthHeaders(),
      });

      if (response.ok) {
        const data = await response.json();
        setStatus(data);
      } else {
        setStatus({ connected: false });
      }
    } catch (err) {
      console.error('Error fetching Zoom status:', err);
      setStatus({ connected: false });
    } finally {
      setLoading(false);
    }
  }, [API_URL, userId, getAuthHeaders]);

  // Fetch meetings from database
  const fetchMeetings = useCallback(async () => {
    if (!userId || !status?.connected) return;

    setLoadingMeetings(true);
    try {
      const params = new URLSearchParams({ limit: '20' });
      if (customerId) {
        params.set('customerId', customerId);
      }
      if (!showPast) {
        params.set('startAfter', new Date().toISOString());
      }

      const response = await fetch(`${API_URL}/api/zoom/db/meetings?${params}`, {
        headers: getAuthHeaders(),
      });

      if (response.ok) {
        const data = await response.json();
        setMeetings(data.meetings || []);
      }
    } catch (err) {
      console.error('Error fetching meetings:', err);
    } finally {
      setLoadingMeetings(false);
    }
  }, [API_URL, userId, status?.connected, customerId, showPast, getAuthHeaders]);

  useEffect(() => {
    fetchStatus();
  }, [fetchStatus]);

  useEffect(() => {
    if (status?.connected && activeTab === 'meetings') {
      fetchMeetings();
    }
  }, [status?.connected, activeTab, showPast, fetchMeetings]);

  // Check URL params for OAuth callback result
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const zoomConnected = params.get('zoom_connected');
    const errorParam = params.get('error');

    if (zoomConnected === 'true') {
      fetchStatus();
      window.history.replaceState({}, '', window.location.pathname);
    } else if (errorParam) {
      setError(`Connection failed: ${errorParam}`);
      window.history.replaceState({}, '', window.location.pathname);
    }
  }, [fetchStatus]);

  // Handle connect
  const handleConnect = async () => {
    if (!userId) return;

    setConnecting(true);
    setError(null);

    try {
      const response = await fetch(`${API_URL}/api/zoom/auth`, {
        headers: getAuthHeaders(),
      });

      if (!response.ok) {
        throw new Error('Failed to initiate connection');
      }

      const data = await response.json();

      if (data.authUrl) {
        window.location.href = data.authUrl;
      } else {
        throw new Error('No OAuth URL returned');
      }
    } catch (err) {
      console.error('Error connecting Zoom:', err);
      setError(err instanceof Error ? err.message : 'Failed to connect');
      setConnecting(false);
    }
  };

  // Handle disconnect
  const handleDisconnect = async () => {
    if (!userId) return;

    if (!confirm('Are you sure you want to disconnect Zoom? Meeting history will be preserved.')) {
      return;
    }

    setDisconnecting(true);
    setError(null);

    try {
      const response = await fetch(`${API_URL}/api/zoom/disconnect`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...getAuthHeaders(),
        },
      });

      if (!response.ok) {
        throw new Error('Failed to disconnect');
      }

      setStatus({ connected: false });
    } catch (err) {
      console.error('Error disconnecting Zoom:', err);
      setError(err instanceof Error ? err.message : 'Failed to disconnect');
    } finally {
      setDisconnecting(false);
    }
  };

  // Handle sync
  const handleSync = async (syncAll: boolean = false) => {
    if (!userId) return;

    setSyncing(true);
    setError(null);

    try {
      const response = await fetch(`${API_URL}/api/zoom/sync`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...getAuthHeaders(),
        },
        body: JSON.stringify({ type: syncAll ? 'all' : 'upcoming' }),
      });

      if (!response.ok) {
        throw new Error('Sync failed');
      }

      const result: SyncResult = await response.json();

      if (result.success) {
        await fetchMeetings();
      }

      // Show sync results
      const totalErrors = [...result.upcoming.errors, ...result.past.errors];
      if (totalErrors.length > 0) {
        setError(`Synced ${result.totalSynced} meetings with ${totalErrors.length} errors`);
      }
    } catch (err) {
      console.error('Sync error:', err);
      setError(err instanceof Error ? err.message : 'Sync failed');
    } finally {
      setSyncing(false);
    }
  };

  const formatDate = (dateStr?: string) => {
    if (!dateStr) return '';
    return new Date(dateStr).toLocaleString('en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    });
  };

  const formatDuration = (minutes?: number) => {
    if (!minutes) return '';
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return hours > 0 ? `${hours}h ${mins}m` : `${mins}m`;
  };

  const getMeetingStatusColor = (status?: string) => {
    switch (status) {
      case 'waiting':
        return 'text-yellow-400';
      case 'started':
        return 'text-green-400';
      case 'ended':
      case 'finished':
        return 'text-cscx-gray-400';
      default:
        return 'text-cscx-gray-400';
    }
  };

  const filteredMeetings = meetings.filter((m) =>
    !searchQuery || m.topic?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="bg-cscx-gray-900 rounded-xl border border-cscx-gray-700 overflow-hidden max-h-[80vh] overflow-y-auto">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-cscx-gray-700 sticky top-0 bg-cscx-gray-900 z-10">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-[#2D8CFF] rounded-lg flex items-center justify-center">
            <Video className="w-6 h-6 text-white" />
          </div>
          <div>
            <h3 className="text-lg font-semibold text-white">Zoom Integration</h3>
            <p className="text-sm text-cscx-gray-400">Meeting sync and recordings</p>
          </div>
        </div>
        {onClose && (
          <button
            onClick={onClose}
            className="p-2 text-cscx-gray-400 hover:text-white hover:bg-cscx-gray-800 rounded-lg transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        )}
      </div>

      {/* Error Message */}
      {error && (
        <div className="mx-4 mt-4 p-3 bg-red-900/20 border border-red-500/30 rounded-lg flex items-center gap-2 text-red-400 text-sm">
          <AlertCircle className="w-4 h-4 flex-shrink-0" />
          <span>{error}</span>
          <button onClick={() => setError(null)} className="ml-auto hover:text-red-300">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Loading State */}
      {loading && (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-8 h-8 text-cscx-accent animate-spin" />
        </div>
      )}

      {/* Disconnected State */}
      {!loading && !status?.connected && (
        <div className="p-4 space-y-4">
          {/* Benefits */}
          <div className="space-y-2">
            <p className="text-sm text-cscx-gray-400 font-medium">Connect to enable:</p>
            <div className="grid gap-2">
              <div className="flex items-center gap-3 p-2 bg-cscx-gray-800/50 rounded-lg">
                <Calendar className="w-5 h-5 text-blue-400" />
                <span className="text-cscx-gray-300">Automatic meeting sync</span>
              </div>
              <div className="flex items-center gap-3 p-2 bg-cscx-gray-800/50 rounded-lg">
                <Play className="w-5 h-5 text-green-400" />
                <span className="text-cscx-gray-300">Recording access and playback</span>
              </div>
              <div className="flex items-center gap-3 p-2 bg-cscx-gray-800/50 rounded-lg">
                <FileText className="w-5 h-5 text-purple-400" />
                <span className="text-cscx-gray-300">Transcript analysis with AI</span>
              </div>
              <div className="flex items-center gap-3 p-2 bg-cscx-gray-800/50 rounded-lg">
                <Users className="w-5 h-5 text-orange-400" />
                <span className="text-cscx-gray-300">Customer meeting tracking</span>
              </div>
            </div>
          </div>

          {/* Connect Button */}
          <button
            onClick={handleConnect}
            disabled={connecting}
            className="w-full flex items-center justify-center gap-2 bg-[#2D8CFF] hover:bg-[#2478E0] text-white font-medium py-3 px-4 rounded-lg transition-colors disabled:opacity-50"
          >
            {connecting ? (
              <Loader2 className="w-5 h-5 animate-spin" />
            ) : (
              <>
                <Link className="w-5 h-5" />
                Connect Zoom
              </>
            )}
          </button>
        </div>
      )}

      {/* Connected State */}
      {!loading && status?.connected && (
        <>
          {/* Tabs */}
          <div className="flex border-b border-cscx-gray-700">
            {(['overview', 'meetings', 'recordings'] as const).map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`flex-1 px-4 py-3 text-sm font-medium capitalize transition-colors ${
                  activeTab === tab
                    ? 'text-cscx-accent border-b-2 border-cscx-accent'
                    : 'text-cscx-gray-400 hover:text-white'
                }`}
              >
                {tab}
              </button>
            ))}
          </div>

          {/* Tab Content */}
          <div className="p-4">
            {/* Overview Tab */}
            {activeTab === 'overview' && (
              <div className="space-y-4">
                {/* Connection Status */}
                <div className="flex items-center justify-between p-3 bg-green-900/20 border border-green-500/30 rounded-lg">
                  <div className="flex items-center gap-3">
                    <CheckCircle className="w-5 h-5 text-green-500" />
                    <div>
                      <p className="text-white font-medium">Connected</p>
                      <p className="text-sm text-cscx-gray-400">{status.email}</p>
                    </div>
                  </div>
                  <button
                    onClick={handleDisconnect}
                    disabled={disconnecting}
                    className="flex items-center gap-2 px-3 py-1.5 text-sm text-red-400 hover:text-red-300 hover:bg-red-900/20 rounded-lg transition-colors disabled:opacity-50"
                  >
                    {disconnecting ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <Unlink className="w-4 h-4" />
                    )}
                    Disconnect
                  </button>
                </div>

                {/* Connected At */}
                {status.connectedAt && (
                  <div className="p-3 bg-cscx-gray-800/50 rounded-lg">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Clock className="w-4 h-4 text-cscx-gray-400" />
                        <span className="text-sm text-cscx-gray-400">Connected:</span>
                      </div>
                      <span className="text-sm text-white">
                        {new Date(status.connectedAt).toLocaleDateString()}
                      </span>
                    </div>
                  </div>
                )}

                {/* Sync Actions */}
                <div className="space-y-2">
                  <p className="text-sm text-cscx-gray-400 font-medium">Sync Options</p>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      onClick={() => handleSync(false)}
                      disabled={syncing}
                      className="flex items-center justify-center gap-2 p-3 bg-cscx-gray-800 hover:bg-cscx-gray-700 rounded-lg transition-colors disabled:opacity-50"
                    >
                      {syncing ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <RefreshCw className="w-4 h-4" />
                      )}
                      <span className="text-sm text-white">Sync Upcoming</span>
                    </button>
                    <button
                      onClick={() => handleSync(true)}
                      disabled={syncing}
                      className="flex items-center justify-center gap-2 p-3 bg-cscx-gray-800 hover:bg-cscx-gray-700 rounded-lg transition-colors disabled:opacity-50"
                    >
                      {syncing ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <Calendar className="w-4 h-4" />
                      )}
                      <span className="text-sm text-white">Sync All</span>
                    </button>
                  </div>
                </div>

                {/* Scopes */}
                {status.scopes && status.scopes.length > 0 && (
                  <div className="space-y-2">
                    <p className="text-sm text-cscx-gray-400 font-medium">Permissions</p>
                    <div className="flex flex-wrap gap-2">
                      {status.scopes.map((scope) => (
                        <span
                          key={scope}
                          className="text-xs px-2 py-1 bg-cscx-gray-800 text-cscx-gray-300 rounded"
                        >
                          {scope}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Meetings Tab */}
            {activeTab === 'meetings' && (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <p className="text-sm text-cscx-gray-400 font-medium">Meetings</p>
                    <button
                      onClick={() => setShowPast(!showPast)}
                      className="flex items-center gap-1 text-xs text-cscx-accent hover:text-cscx-accent/80"
                    >
                      {showPast ? (
                        <>
                          <ChevronUp className="w-3 h-3" /> Show Upcoming
                        </>
                      ) : (
                        <>
                          <ChevronDown className="w-3 h-3" /> Show Past
                        </>
                      )}
                    </button>
                  </div>
                  <button
                    onClick={fetchMeetings}
                    disabled={loadingMeetings}
                    className="text-cscx-accent hover:text-cscx-accent/80"
                  >
                    {loadingMeetings ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <RefreshCw className="w-4 h-4" />
                    )}
                  </button>
                </div>

                {/* Search */}
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-cscx-gray-500" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Search meetings..."
                    className="w-full pl-10 pr-4 py-2 bg-cscx-gray-800 border border-cscx-gray-700 rounded-lg text-white text-sm placeholder-cscx-gray-500 focus:outline-none focus:ring-2 focus:ring-cscx-accent"
                  />
                </div>

                {loadingMeetings ? (
                  <div className="flex justify-center py-8">
                    <Loader2 className="w-6 h-6 text-cscx-accent animate-spin" />
                  </div>
                ) : filteredMeetings.length === 0 ? (
                  <p className="text-sm text-cscx-gray-500 text-center py-8">
                    {meetings.length === 0 ? 'No meetings synced yet. Click "Sync" to fetch meetings.' : 'No meetings match your search.'}
                  </p>
                ) : (
                  <div className="space-y-2">
                    {filteredMeetings.map((meeting) => (
                      <div
                        key={meeting.id}
                        className="p-3 bg-cscx-gray-800/50 rounded-lg space-y-2"
                      >
                        <div className="flex items-start justify-between">
                          <div className="flex-1 min-w-0">
                            <p className="text-white font-medium truncate">
                              {meeting.topic || 'Untitled Meeting'}
                            </p>
                            <div className="flex items-center gap-3 mt-1 text-xs text-cscx-gray-400">
                              <span>{formatDate(meeting.start_time)}</span>
                              {meeting.scheduled_duration_minutes && (
                                <span>{formatDuration(meeting.scheduled_duration_minutes)}</span>
                              )}
                              <span className={getMeetingStatusColor(meeting.status)}>
                                {meeting.status || 'scheduled'}
                              </span>
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            {meeting.has_transcript && (
                              <span className="text-xs text-purple-400" title="Transcript available">
                                <FileText className="w-4 h-4" />
                              </span>
                            )}
                            {meeting.recording_url && (
                              <span className="text-xs text-green-400" title="Recording available">
                                <Play className="w-4 h-4" />
                              </span>
                            )}
                            {meeting.join_url && (
                              <a
                                href={meeting.join_url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-cscx-accent hover:text-cscx-accent/80"
                                title="Join meeting"
                              >
                                <ExternalLink className="w-4 h-4" />
                              </a>
                            )}
                          </div>
                        </div>
                        {meeting.customers?.name && (
                          <div className="flex items-center gap-2">
                            <span className="text-xs text-cscx-gray-500">Customer:</span>
                            <span className="text-xs text-cscx-gray-300">{meeting.customers.name}</span>
                            {meeting.customer_match_confidence && (
                              <span className="text-xs text-cscx-gray-500">
                                ({Math.round(meeting.customer_match_confidence * 100)}% match)
                              </span>
                            )}
                          </div>
                        )}
                        {meeting.participant_count !== undefined && meeting.participant_count > 0 && (
                          <div className="flex items-center gap-1 text-xs text-cscx-gray-500">
                            <Users className="w-3 h-3" />
                            {meeting.participant_count} participants
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Recordings Tab */}
            {activeTab === 'recordings' && (
              <div className="space-y-4">
                <p className="text-sm text-cscx-gray-400 font-medium">Recent Recordings</p>

                {loadingMeetings ? (
                  <div className="flex justify-center py-8">
                    <Loader2 className="w-6 h-6 text-cscx-accent animate-spin" />
                  </div>
                ) : (
                  <div className="space-y-2">
                    {meetings.filter((m) => m.has_transcript || m.recording_url).length === 0 ? (
                      <p className="text-sm text-cscx-gray-500 text-center py-8">
                        No recordings available yet. Recordings appear after meetings with cloud recording enabled end.
                      </p>
                    ) : (
                      meetings
                        .filter((m) => m.has_transcript || m.recording_url)
                        .map((meeting) => (
                          <div
                            key={meeting.id}
                            className="p-3 bg-cscx-gray-800/50 rounded-lg space-y-2"
                          >
                            <div className="flex items-start justify-between">
                              <div>
                                <p className="text-white font-medium">
                                  {meeting.topic || 'Untitled Meeting'}
                                </p>
                                <p className="text-xs text-cscx-gray-400 mt-1">
                                  {formatDate(meeting.start_time)}
                                </p>
                              </div>
                              <div className="flex items-center gap-2">
                                {meeting.recording_url && (
                                  <a
                                    href={meeting.recording_url}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="flex items-center gap-1 px-2 py-1 text-xs bg-green-600 hover:bg-green-700 text-white rounded transition-colors"
                                  >
                                    <Play className="w-3 h-3" />
                                    Watch
                                  </a>
                                )}
                                {meeting.has_transcript && (
                                  <span className="flex items-center gap-1 px-2 py-1 text-xs bg-purple-600/20 text-purple-400 rounded">
                                    <FileText className="w-3 h-3" />
                                    Transcript
                                  </span>
                                )}
                              </div>
                            </div>
                            {meeting.actual_duration_minutes && (
                              <div className="flex items-center gap-1 text-xs text-cscx-gray-500">
                                <Clock className="w-3 h-3" />
                                {formatDuration(meeting.actual_duration_minutes)}
                              </div>
                            )}
                          </div>
                        ))
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}

export default ZoomConnect;
