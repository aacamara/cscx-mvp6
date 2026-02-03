/**
 * Calendly Integration Component - PRD-208
 *
 * Features:
 * - Connect/disconnect Calendly account
 * - View upcoming bookings
 * - Generate scheduling links
 * - View engagement metrics
 */

import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../context/AuthContext';
import {
  Calendar,
  Link2,
  ExternalLink,
  CheckCircle,
  AlertCircle,
  Loader2,
  X,
  Copy,
  Check,
  TrendingUp,
  TrendingDown,
  Minus,
  Clock,
  Users,
  RefreshCw,
  Unlink,
} from 'lucide-react';

const API_URL = import.meta.env.VITE_API_URL || '';

interface ConnectionStatus {
  connected: boolean;
  email?: string;
  name?: string;
  schedulingUrl?: string;
  lastSyncAt?: string;
}

interface CalendlyEvent {
  id: string;
  eventName: string;
  inviteeEmail: string;
  inviteeName?: string;
  startTime: string;
  endTime: string;
  status: string;
  cancelUrl?: string;
  rescheduleUrl?: string;
}

interface EventType {
  uri: string;
  name: string;
  duration: number;
  schedulingUrl: string;
  description?: string;
  color: string;
}

interface EngagementMetrics {
  customerId: string;
  customerName: string;
  totalBookings: number;
  completedMeetings: number;
  canceledMeetings: number;
  cancellationRate: number;
  averageMeetingsPerMonth: number;
  lastMeetingDate?: string;
  nextMeetingDate?: string;
  meetingFrequency: 'high' | 'medium' | 'low' | 'none';
  trend: 'increasing' | 'stable' | 'decreasing';
}

interface CalendlyIntegrationProps {
  customerId?: string;
  customerName?: string;
  onClose?: () => void;
  showMetrics?: boolean;
}

export function CalendlyIntegration({
  customerId,
  customerName,
  onClose,
  showMetrics = true,
}: CalendlyIntegrationProps) {
  const { getAuthHeaders } = useAuth();

  // Connection state
  const [status, setStatus] = useState<ConnectionStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [connecting, setConnecting] = useState(false);
  const [disconnecting, setDisconnecting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Events state
  const [events, setEvents] = useState<CalendlyEvent[]>([]);
  const [loadingEvents, setLoadingEvents] = useState(false);

  // Event types state
  const [eventTypes, setEventTypes] = useState<EventType[]>([]);
  const [loadingEventTypes, setLoadingEventTypes] = useState(false);

  // Scheduling link state
  const [selectedEventType, setSelectedEventType] = useState<string>('');
  const [generatedLink, setGeneratedLink] = useState<string | null>(null);
  const [generatingLink, setGeneratingLink] = useState(false);
  const [linkCopied, setLinkCopied] = useState(false);

  // Metrics state
  const [metrics, setMetrics] = useState<EngagementMetrics | null>(null);
  const [loadingMetrics, setLoadingMetrics] = useState(false);

  // Syncing state
  const [syncing, setSyncing] = useState(false);

  // Active tab
  const [activeTab, setActiveTab] = useState<'events' | 'schedule' | 'metrics'>('events');

  // Fetch connection status
  const fetchStatus = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch(`${API_URL}/api/calendly/status`, {
        headers: getAuthHeaders(),
      });

      if (response.ok) {
        const data = await response.json();
        setStatus(data);
      } else if (response.status === 401) {
        setStatus({ connected: false });
      } else {
        const errorData = await response.json();
        setError(errorData.message || 'Failed to check connection status');
        setStatus({ connected: false });
      }
    } catch (err) {
      console.error('Error fetching Calendly status:', err);
      setError('Unable to check connection status');
      setStatus({ connected: false });
    } finally {
      setLoading(false);
    }
  }, [getAuthHeaders]);

  // Check URL params for OAuth callback result
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const calendlyConnected = params.get('calendly_connected');
    const calendlyError = params.get('calendly_error');

    if (calendlyConnected === 'true') {
      fetchStatus();
      window.history.replaceState({}, '', window.location.pathname);
    } else if (calendlyError) {
      setError(`Connection failed: ${calendlyError}`);
      window.history.replaceState({}, '', window.location.pathname);
    }
  }, [fetchStatus]);

  useEffect(() => {
    fetchStatus();
  }, [fetchStatus]);

  // Load data when connected
  useEffect(() => {
    if (status?.connected) {
      fetchEventTypes();
      if (customerId) {
        fetchCustomerEvents();
        if (showMetrics) {
          fetchMetrics();
        }
      }
    }
  }, [status?.connected, customerId, showMetrics]);

  // Fetch customer events
  const fetchCustomerEvents = async () => {
    if (!customerId) return;

    setLoadingEvents(true);
    try {
      const response = await fetch(
        `${API_URL}/api/calendly/events/${customerId}?status=active&limit=10`,
        { headers: getAuthHeaders() }
      );

      if (response.ok) {
        const data = await response.json();
        setEvents(data.events || []);
      }
    } catch (err) {
      console.error('Error fetching Calendly events:', err);
    } finally {
      setLoadingEvents(false);
    }
  };

  // Fetch event types
  const fetchEventTypes = async () => {
    setLoadingEventTypes(true);
    try {
      const response = await fetch(`${API_URL}/api/calendly/event-types`, {
        headers: getAuthHeaders(),
      });

      if (response.ok) {
        const data = await response.json();
        setEventTypes(data.eventTypes || []);
        if (data.eventTypes?.length > 0) {
          setSelectedEventType(data.eventTypes[0].uri);
        }
      }
    } catch (err) {
      console.error('Error fetching event types:', err);
    } finally {
      setLoadingEventTypes(false);
    }
  };

  // Fetch engagement metrics
  const fetchMetrics = async () => {
    if (!customerId) return;

    setLoadingMetrics(true);
    try {
      const response = await fetch(
        `${API_URL}/api/calendly/metrics/${customerId}`,
        { headers: getAuthHeaders() }
      );

      if (response.ok) {
        const data = await response.json();
        setMetrics(data);
      }
    } catch (err) {
      console.error('Error fetching metrics:', err);
    } finally {
      setLoadingMetrics(false);
    }
  };

  // Handle connect
  const handleConnect = async () => {
    setConnecting(true);
    setError(null);

    try {
      const response = await fetch(`${API_URL}/api/integrations/calendly/connect`, {
        method: 'POST',
        headers: getAuthHeaders(),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Failed to initiate connection');
      }

      const data = await response.json();

      if (data.url) {
        window.location.href = data.url;
      } else {
        throw new Error('No OAuth URL returned');
      }
    } catch (err) {
      console.error('Error connecting Calendly:', err);
      setError(err instanceof Error ? err.message : 'Failed to connect');
      setConnecting(false);
    }
  };

  // Handle disconnect
  const handleDisconnect = async () => {
    if (!confirm('Are you sure you want to disconnect Calendly? This will remove all synced events.')) {
      return;
    }

    setDisconnecting(true);
    setError(null);

    try {
      const response = await fetch(`${API_URL}/api/calendly/disconnect`, {
        method: 'POST',
        headers: getAuthHeaders(),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Failed to disconnect');
      }

      setStatus({ connected: false });
      setEvents([]);
      setMetrics(null);
    } catch (err) {
      console.error('Error disconnecting Calendly:', err);
      setError(err instanceof Error ? err.message : 'Failed to disconnect');
    } finally {
      setDisconnecting(false);
    }
  };

  // Handle generate scheduling link
  const handleGenerateLink = async () => {
    if (!customerId || !selectedEventType) return;

    setGeneratingLink(true);
    setGeneratedLink(null);
    setError(null);

    try {
      const response = await fetch(`${API_URL}/api/calendly/scheduling-link`, {
        method: 'POST',
        headers: {
          ...getAuthHeaders(),
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          customerId,
          eventTypeUri: selectedEventType,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Failed to generate link');
      }

      const data = await response.json();
      setGeneratedLink(data.bookingUrl);
    } catch (err) {
      console.error('Error generating link:', err);
      setError(err instanceof Error ? err.message : 'Failed to generate link');
    } finally {
      setGeneratingLink(false);
    }
  };

  // Handle copy link
  const handleCopyLink = async () => {
    if (!generatedLink) return;

    try {
      await navigator.clipboard.writeText(generatedLink);
      setLinkCopied(true);
      setTimeout(() => setLinkCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy:', err);
    }
  };

  // Handle manual sync
  const handleSync = async () => {
    setSyncing(true);
    setError(null);

    try {
      const response = await fetch(`${API_URL}/api/calendly/sync`, {
        method: 'POST',
        headers: getAuthHeaders(),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Sync failed');
      }

      // Refresh data after sync
      await Promise.all([
        fetchCustomerEvents(),
        showMetrics && fetchMetrics(),
      ]);
    } catch (err) {
      console.error('Error syncing:', err);
      setError(err instanceof Error ? err.message : 'Sync failed');
    } finally {
      setSyncing(false);
    }
  };

  // Format date
  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    });
  };

  // Format relative date
  const formatRelativeDate = (dateStr: string) => {
    const date = new Date(dateStr);
    const now = new Date();
    const diff = date.getTime() - now.getTime();
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));

    if (days === 0) return 'Today';
    if (days === 1) return 'Tomorrow';
    if (days === -1) return 'Yesterday';
    if (days > 0 && days < 7) return `In ${days} days`;
    if (days < 0 && days > -7) return `${Math.abs(days)} days ago`;
    return formatDate(dateStr);
  };

  // Get trend icon
  const getTrendIcon = (trend: string) => {
    switch (trend) {
      case 'increasing':
        return <TrendingUp className="w-4 h-4 text-green-500" />;
      case 'decreasing':
        return <TrendingDown className="w-4 h-4 text-red-500" />;
      default:
        return <Minus className="w-4 h-4 text-cscx-gray-400" />;
    }
  };

  // Get frequency badge color
  const getFrequencyColor = (frequency: string) => {
    switch (frequency) {
      case 'high':
        return 'bg-green-500/20 text-green-400';
      case 'medium':
        return 'bg-yellow-500/20 text-yellow-400';
      case 'low':
        return 'bg-orange-500/20 text-orange-400';
      default:
        return 'bg-cscx-gray-700 text-cscx-gray-400';
    }
  };

  // Render loading state
  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="w-6 h-6 text-cscx-accent animate-spin" />
      </div>
    );
  }

  // Render not connected state
  if (!status?.connected) {
    return (
      <div className="bg-cscx-gray-900 rounded-xl border border-cscx-gray-700 overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-cscx-gray-700">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-[#006BFF] rounded-lg flex items-center justify-center">
              <Calendar className="w-5 h-5 text-white" />
            </div>
            <div>
              <h3 className="text-lg font-semibold text-white">Calendly</h3>
              <p className="text-sm text-cscx-gray-400">Connect for scheduling integration</p>
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

        {/* Content */}
        <div className="p-6">
          {error && (
            <div className="mb-4 p-3 bg-red-900/20 border border-red-500/30 rounded-lg flex items-center gap-2 text-red-400 text-sm">
              <AlertCircle className="w-4 h-4 flex-shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <div className="space-y-4">
            <div className="space-y-2">
              <p className="text-sm text-cscx-gray-400 font-medium">Connect to unlock:</p>
              <div className="grid gap-2">
                <div className="flex items-center gap-3 p-2 bg-cscx-gray-800/50 rounded-lg">
                  <Calendar className="w-5 h-5 text-[#006BFF]" />
                  <span className="text-cscx-gray-300">Sync Calendly bookings automatically</span>
                </div>
                <div className="flex items-center gap-3 p-2 bg-cscx-gray-800/50 rounded-lg">
                  <Link2 className="w-5 h-5 text-[#006BFF]" />
                  <span className="text-cscx-gray-300">Generate personalized scheduling links</span>
                </div>
                <div className="flex items-center gap-3 p-2 bg-cscx-gray-800/50 rounded-lg">
                  <TrendingUp className="w-5 h-5 text-[#006BFF]" />
                  <span className="text-cscx-gray-300">Track engagement metrics</span>
                </div>
              </div>
            </div>

            <button
              onClick={handleConnect}
              disabled={connecting}
              className="w-full flex items-center justify-center gap-2 bg-[#006BFF] hover:bg-[#0052CC] text-white font-medium py-3 px-4 rounded-lg transition-colors disabled:opacity-50"
            >
              {connecting ? (
                <Loader2 className="w-5 h-5 animate-spin" />
              ) : (
                <>
                  <Link2 className="w-5 h-5" />
                  Connect Calendly
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Render connected state
  return (
    <div className="bg-cscx-gray-900 rounded-xl border border-cscx-gray-700 overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-cscx-gray-700">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-[#006BFF] rounded-lg flex items-center justify-center">
            <Calendar className="w-5 h-5 text-white" />
          </div>
          <div>
            <h3 className="text-lg font-semibold text-white">Calendly</h3>
            <p className="text-sm text-cscx-gray-400">{status.email}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={handleSync}
            disabled={syncing}
            className="p-2 text-cscx-gray-400 hover:text-white hover:bg-cscx-gray-800 rounded-lg transition-colors"
            title="Sync now"
          >
            <RefreshCw className={`w-5 h-5 ${syncing ? 'animate-spin' : ''}`} />
          </button>
          <button
            onClick={handleDisconnect}
            disabled={disconnecting}
            className="p-2 text-red-400 hover:text-red-300 hover:bg-red-900/20 rounded-lg transition-colors"
            title="Disconnect"
          >
            {disconnecting ? (
              <Loader2 className="w-5 h-5 animate-spin" />
            ) : (
              <Unlink className="w-5 h-5" />
            )}
          </button>
          {onClose && (
            <button
              onClick={onClose}
              className="p-2 text-cscx-gray-400 hover:text-white hover:bg-cscx-gray-800 rounded-lg transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          )}
        </div>
      </div>

      {/* Error */}
      {error && (
        <div className="mx-4 mt-4 p-3 bg-red-900/20 border border-red-500/30 rounded-lg flex items-center gap-2 text-red-400 text-sm">
          <AlertCircle className="w-4 h-4 flex-shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Tabs */}
      {customerId && (
        <div className="flex gap-1 p-4 border-b border-cscx-gray-700">
          {(['events', 'schedule', ...(showMetrics ? ['metrics'] : [])] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab as any)}
              className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors capitalize ${
                activeTab === tab
                  ? 'bg-cscx-accent text-white'
                  : 'text-cscx-gray-400 hover:text-white hover:bg-cscx-gray-800'
              }`}
            >
              {tab === 'events' ? 'Upcoming' : tab === 'schedule' ? 'Schedule' : 'Metrics'}
            </button>
          ))}
        </div>
      )}

      {/* Content */}
      <div className="p-4">
        {/* Events Tab */}
        {activeTab === 'events' && customerId && (
          <div className="space-y-3">
            <div className="flex items-center justify-between mb-2">
              <h4 className="text-sm font-medium text-cscx-gray-300">
                Upcoming Bookings {customerName && `for ${customerName}`}
              </h4>
            </div>

            {loadingEvents ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="w-5 h-5 text-cscx-accent animate-spin" />
              </div>
            ) : events.length === 0 ? (
              <div className="text-center py-8 text-cscx-gray-500">
                <Calendar className="w-8 h-8 mx-auto mb-2 opacity-50" />
                <p>No upcoming meetings</p>
              </div>
            ) : (
              <div className="space-y-2">
                {events.map((event) => (
                  <div
                    key={event.id}
                    className="bg-cscx-gray-800 rounded-lg p-3"
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <h5 className="text-white font-medium text-sm">{event.eventName}</h5>
                        <p className="text-xs text-cscx-gray-400 mt-1">
                          {event.inviteeName || event.inviteeEmail}
                        </p>
                        <p className="text-xs text-cscx-accent mt-1">
                          {formatRelativeDate(event.startTime)} - {formatDate(event.startTime)}
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        {event.rescheduleUrl && (
                          <a
                            href={event.rescheduleUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="p-1.5 text-cscx-gray-400 hover:text-white rounded transition-colors"
                            title="Reschedule"
                          >
                            <Clock className="w-4 h-4" />
                          </a>
                        )}
                        {event.cancelUrl && (
                          <a
                            href={event.cancelUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="p-1.5 text-cscx-gray-400 hover:text-red-400 rounded transition-colors"
                            title="Cancel"
                          >
                            <X className="w-4 h-4" />
                          </a>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Schedule Tab */}
        {activeTab === 'schedule' && customerId && (
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-cscx-gray-300 mb-2">
                Select Meeting Type
              </label>
              {loadingEventTypes ? (
                <div className="flex items-center gap-2 text-cscx-gray-400">
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span className="text-sm">Loading event types...</span>
                </div>
              ) : eventTypes.length === 0 ? (
                <p className="text-sm text-cscx-gray-500">No event types available</p>
              ) : (
                <select
                  value={selectedEventType}
                  onChange={(e) => {
                    setSelectedEventType(e.target.value);
                    setGeneratedLink(null);
                  }}
                  className="w-full bg-cscx-gray-800 border border-cscx-gray-700 rounded-lg px-3 py-2 text-white focus:outline-none focus:ring-2 focus:ring-cscx-accent"
                >
                  {eventTypes.map((et) => (
                    <option key={et.uri} value={et.uri}>
                      {et.name} ({et.duration} min)
                    </option>
                  ))}
                </select>
              )}
            </div>

            <button
              onClick={handleGenerateLink}
              disabled={generatingLink || !selectedEventType}
              className="w-full flex items-center justify-center gap-2 bg-[#006BFF] hover:bg-[#0052CC] text-white font-medium py-2.5 px-4 rounded-lg transition-colors disabled:opacity-50"
            >
              {generatingLink ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <>
                  <Link2 className="w-4 h-4" />
                  Generate Scheduling Link
                </>
              )}
            </button>

            {generatedLink && (
              <div className="bg-cscx-gray-800 rounded-lg p-3">
                <p className="text-xs text-cscx-gray-400 mb-2">One-time scheduling link:</p>
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    value={generatedLink}
                    readOnly
                    className="flex-1 bg-cscx-gray-900 border border-cscx-gray-700 rounded px-3 py-1.5 text-sm text-white"
                  />
                  <button
                    onClick={handleCopyLink}
                    className="p-2 bg-cscx-gray-700 hover:bg-cscx-gray-600 text-white rounded transition-colors"
                    title="Copy link"
                  >
                    {linkCopied ? (
                      <Check className="w-4 h-4 text-green-500" />
                    ) : (
                      <Copy className="w-4 h-4" />
                    )}
                  </button>
                  <a
                    href={generatedLink}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="p-2 bg-cscx-gray-700 hover:bg-cscx-gray-600 text-white rounded transition-colors"
                    title="Open link"
                  >
                    <ExternalLink className="w-4 h-4" />
                  </a>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Metrics Tab */}
        {activeTab === 'metrics' && customerId && showMetrics && (
          <div className="space-y-4">
            {loadingMetrics ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="w-5 h-5 text-cscx-accent animate-spin" />
              </div>
            ) : !metrics ? (
              <div className="text-center py-8 text-cscx-gray-500">
                <TrendingUp className="w-8 h-8 mx-auto mb-2 opacity-50" />
                <p>No metrics available</p>
              </div>
            ) : (
              <>
                {/* Summary Cards */}
                <div className="grid grid-cols-2 gap-3">
                  <div className="bg-cscx-gray-800 rounded-lg p-3">
                    <p className="text-xs text-cscx-gray-400">Total Bookings</p>
                    <p className="text-2xl font-bold text-white">{metrics.totalBookings}</p>
                  </div>
                  <div className="bg-cscx-gray-800 rounded-lg p-3">
                    <p className="text-xs text-cscx-gray-400">Completed</p>
                    <p className="text-2xl font-bold text-green-400">{metrics.completedMeetings}</p>
                  </div>
                  <div className="bg-cscx-gray-800 rounded-lg p-3">
                    <p className="text-xs text-cscx-gray-400">Cancellation Rate</p>
                    <p className="text-2xl font-bold text-white">
                      {metrics.cancellationRate.toFixed(0)}%
                    </p>
                  </div>
                  <div className="bg-cscx-gray-800 rounded-lg p-3">
                    <p className="text-xs text-cscx-gray-400">Avg per Month</p>
                    <p className="text-2xl font-bold text-white">
                      {metrics.averageMeetingsPerMonth}
                    </p>
                  </div>
                </div>

                {/* Frequency & Trend */}
                <div className="flex items-center justify-between bg-cscx-gray-800 rounded-lg p-3">
                  <div>
                    <p className="text-xs text-cscx-gray-400">Meeting Frequency</p>
                    <span
                      className={`inline-block mt-1 px-2 py-0.5 text-xs font-medium rounded ${getFrequencyColor(
                        metrics.meetingFrequency
                      )}`}
                    >
                      {metrics.meetingFrequency.charAt(0).toUpperCase() +
                        metrics.meetingFrequency.slice(1)}
                    </span>
                  </div>
                  <div className="text-right">
                    <p className="text-xs text-cscx-gray-400">Trend</p>
                    <div className="flex items-center gap-1 mt-1">
                      {getTrendIcon(metrics.trend)}
                      <span className="text-sm text-white capitalize">{metrics.trend}</span>
                    </div>
                  </div>
                </div>

                {/* Next/Last Meeting */}
                <div className="grid grid-cols-2 gap-3">
                  <div className="bg-cscx-gray-800 rounded-lg p-3">
                    <p className="text-xs text-cscx-gray-400">Last Meeting</p>
                    <p className="text-sm text-white mt-1">
                      {metrics.lastMeetingDate
                        ? formatRelativeDate(metrics.lastMeetingDate)
                        : 'None'}
                    </p>
                  </div>
                  <div className="bg-cscx-gray-800 rounded-lg p-3">
                    <p className="text-xs text-cscx-gray-400">Next Meeting</p>
                    <p className="text-sm text-white mt-1">
                      {metrics.nextMeetingDate
                        ? formatRelativeDate(metrics.nextMeetingDate)
                        : 'None scheduled'}
                    </p>
                  </div>
                </div>
              </>
            )}
          </div>
        )}

        {/* Connected but no customer selected */}
        {!customerId && (
          <div className="text-center py-6">
            <CheckCircle className="w-10 h-10 text-green-500 mx-auto mb-2" />
            <p className="text-white font-medium">Connected to Calendly</p>
            <p className="text-sm text-cscx-gray-400 mt-1">
              Select a customer to view bookings and generate links
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

export default CalendlyIntegration;
