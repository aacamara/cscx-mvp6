/**
 * Meeting Prep View Component (PRD-127)
 *
 * Displays automated pre-meeting research and briefing including:
 * - Daily meeting list with prep status
 * - Customer snapshot with health indicators
 * - AI-generated talking points and questions
 * - Attendee profiles and history
 * - Previous meeting context
 * - Recommended actions
 */

import React, { useState, useEffect, useCallback } from 'react';

const API_BASE = `${import.meta.env.VITE_API_URL || ''}/api`;

// ==================== Types ====================

interface CustomerSnapshot {
  name: string;
  healthScore: number;
  healthTrend: 'up' | 'down' | 'stable';
  arr: number;
  renewalDate: string | null;
  stage: string;
  daysSinceLastMeeting: number;
  industry?: string;
}

interface TalkingPoint {
  point: string;
  priority: 'must_discuss' | 'should_discuss' | 'nice_to_have';
  context?: string;
}

interface AttendeeProfile {
  name: string;
  email?: string;
  role?: string;
  influence?: 'decision_maker' | 'influencer' | 'user' | 'unknown';
  sentiment?: 'positive' | 'neutral' | 'negative' | 'unknown';
  lastContact?: string;
  interactionCount?: number;
}

interface OpenItem {
  type: string;
  description: string;
  dueDate?: string;
  priority: 'high' | 'medium' | 'low';
}

interface ActivitySummary {
  type: string;
  description: string;
  date: string;
}

interface PreviousMeeting {
  date: string;
  title: string;
  summary?: string;
  decisions?: string[];
  followUps?: string[];
}

interface MeetingContext {
  agenda?: string[];
  objectives?: string[];
  meetingType: string;
}

interface MeetingPrepBrief {
  id: string;
  calendarEventId?: string;
  customerId: string;
  scheduledAt: string;
  status: 'scheduled' | 'delivered' | 'viewed' | 'completed';
  viewedAt?: string;
  dataCompleteness: number;
  customer: CustomerSnapshot;
  meetingContext: MeetingContext;
  talkingPoints: TalkingPoint[];
  questions: string[];
  recommendations: string[];
  attendees: AttendeeProfile[];
  recentActivity: ActivitySummary[];
  openItems: OpenItem[];
  previousMeetings: PreviousMeeting[];
}

interface MeetingSummary {
  id: string;
  calendarEventId?: string;
  customerId: string;
  customerName: string;
  scheduledAt: string;
  meetingType: string;
  status: string;
  healthScore: number;
  arr: number;
  talkingPointCount: number;
  openItemCount: number;
  attendeeCount: number;
}

interface TodaysMeetingsResponse {
  date: string;
  meetingCount: number;
  preparedCount: number;
  viewedCount: number;
  meetings: MeetingSummary[];
}

// ==================== Component ====================

interface MeetingPrepViewProps {
  userId?: string;
  onClose?: () => void;
}

export const MeetingPrepView: React.FC<MeetingPrepViewProps> = ({
  userId = 'demo_user',
  onClose
}) => {
  const [todaysMeetings, setTodaysMeetings] = useState<TodaysMeetingsResponse | null>(null);
  const [selectedBrief, setSelectedBrief] = useState<MeetingPrepBrief | null>(null);
  const [loading, setLoading] = useState(true);
  const [briefLoading, setBriefLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'overview' | 'attendees' | 'history'>('overview');

  // Fetch today's meetings
  const fetchTodaysMeetings = useCallback(async () => {
    try {
      setLoading(true);
      const response = await fetch(`${API_BASE}/meeting-prep/today?userId=${userId}`);
      const data = await response.json();

      if (data.success) {
        setTodaysMeetings(data.data);
      } else {
        throw new Error(data.error?.message || 'Failed to fetch meetings');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setLoading(false);
    }
  }, [userId]);

  // Fetch specific brief
  const fetchBrief = useCallback(async (briefId: string) => {
    try {
      setBriefLoading(true);
      const response = await fetch(`${API_BASE}/meeting-prep/${briefId}`);
      const data = await response.json();

      if (data.success) {
        setSelectedBrief(data.data);
        // Mark as viewed
        await fetch(`${API_BASE}/meeting-prep/${briefId}/viewed`, { method: 'PUT' });
      } else {
        throw new Error(data.error?.message || 'Failed to fetch brief');
      }
    } catch (err) {
      console.error('Error fetching brief:', err);
    } finally {
      setBriefLoading(false);
    }
  }, []);

  // Refresh brief
  const refreshBrief = async (briefId: string) => {
    try {
      setBriefLoading(true);
      const response = await fetch(`${API_BASE}/meeting-prep/${briefId}/refresh`, {
        method: 'POST'
      });
      const data = await response.json();

      if (data.success) {
        // Refetch the updated brief
        await fetchBrief(briefId);
      }
    } catch (err) {
      console.error('Error refreshing brief:', err);
    } finally {
      setBriefLoading(false);
    }
  };

  useEffect(() => {
    fetchTodaysMeetings();
  }, [fetchTodaysMeetings]);

  // Helpers
  const formatTime = (dateStr: string) => {
    return new Date(dateStr).toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true
    });
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric'
    });
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(amount);
  };

  const getHealthColor = (score: number) => {
    if (score >= 80) return 'text-green-400';
    if (score >= 60) return 'text-yellow-400';
    return 'text-red-400';
  };

  const getHealthBg = (score: number) => {
    if (score >= 80) return 'bg-green-500';
    if (score >= 60) return 'bg-yellow-500';
    return 'bg-red-500';
  };

  const getTrendIcon = (trend: string) => {
    switch (trend) {
      case 'up': return <span className="text-green-400 text-sm">+</span>;
      case 'down': return <span className="text-red-400 text-sm">-</span>;
      default: return <span className="text-gray-400 text-sm">=</span>;
    }
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'must_discuss': return 'bg-red-500/20 text-red-400 border-red-500/30';
      case 'should_discuss': return 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30';
      case 'nice_to_have': return 'bg-blue-500/20 text-blue-400 border-blue-500/30';
      case 'high': return 'bg-red-500/20 text-red-400';
      case 'medium': return 'bg-yellow-500/20 text-yellow-400';
      case 'low': return 'bg-green-500/20 text-green-400';
      default: return 'bg-gray-500/20 text-gray-400';
    }
  };

  const getInfluenceBadge = (influence: string) => {
    switch (influence) {
      case 'decision_maker': return 'bg-purple-500/20 text-purple-400';
      case 'influencer': return 'bg-blue-500/20 text-blue-400';
      case 'user': return 'bg-gray-500/20 text-gray-400';
      default: return 'bg-gray-500/20 text-gray-400';
    }
  };

  const getSentimentIcon = (sentiment: string) => {
    switch (sentiment) {
      case 'positive': return <span className="text-green-400">+</span>;
      case 'negative': return <span className="text-red-400">-</span>;
      case 'neutral': return <span className="text-yellow-400">=</span>;
      default: return <span className="text-gray-400">?</span>;
    }
  };

  const getMeetingTypeLabel = (type: string) => {
    const labels: Record<string, string> = {
      qbr: 'QBR',
      check_in: 'Check-in',
      escalation: 'Escalation',
      renewal: 'Renewal',
      kickoff: 'Kickoff',
      training: 'Training',
      other: 'Meeting'
    };
    return labels[type] || type;
  };

  // ==================== Render Functions ====================

  // Loading state
  if (loading) {
    return (
      <div className="p-6 bg-cscx-gray-900 rounded-xl">
        <div className="flex items-center justify-center py-12">
          <div className="animate-spin w-8 h-8 border-2 border-cscx-accent border-t-transparent rounded-full" />
          <span className="ml-3 text-cscx-gray-400">Loading today's meetings...</span>
        </div>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className="p-6 bg-cscx-gray-900 rounded-xl">
        <div className="text-center py-8">
          <p className="text-red-400 mb-4">{error}</p>
          <button
            onClick={fetchTodaysMeetings}
            className="px-4 py-2 bg-cscx-accent hover:bg-red-700 text-white rounded-lg transition-colors"
          >
            Try Again
          </button>
        </div>
      </div>
    );
  }

  // Main view with meeting list and brief detail
  return (
    <div className="flex h-full min-h-[600px]">
      {/* Left Panel - Meeting List */}
      <div className={`${selectedBrief ? 'w-1/3' : 'w-full'} border-r border-cscx-gray-800 overflow-y-auto`}>
        {/* Header */}
        <div className="p-4 border-b border-cscx-gray-800 sticky top-0 bg-cscx-gray-900 z-10">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-xl font-bold text-white">Meeting Prep</h2>
              <p className="text-sm text-cscx-gray-400">
                {todaysMeetings?.date || 'Today'} - {todaysMeetings?.meetingCount || 0} meetings
              </p>
            </div>
            {onClose && (
              <button
                onClick={onClose}
                className="p-2 text-cscx-gray-400 hover:text-white hover:bg-cscx-gray-800 rounded-lg"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            )}
          </div>

          {/* Stats */}
          {todaysMeetings && todaysMeetings.meetingCount > 0 && (
            <div className="flex gap-4 mt-3">
              <div className="flex-1 p-2 bg-cscx-gray-800/50 rounded-lg text-center">
                <p className="text-xs text-cscx-gray-500">Prepared</p>
                <p className="text-lg font-semibold text-green-400">
                  {todaysMeetings.preparedCount}/{todaysMeetings.meetingCount}
                </p>
              </div>
              <div className="flex-1 p-2 bg-cscx-gray-800/50 rounded-lg text-center">
                <p className="text-xs text-cscx-gray-500">Viewed</p>
                <p className="text-lg font-semibold text-blue-400">
                  {todaysMeetings.viewedCount}/{todaysMeetings.meetingCount}
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Meeting List */}
        <div className="p-4">
          {!todaysMeetings || todaysMeetings.meetingCount === 0 ? (
            <div className="text-center py-12">
              <div className="text-cscx-gray-500 text-5xl mb-4">-</div>
              <p className="text-cscx-gray-400">No customer meetings today</p>
              <p className="text-sm text-cscx-gray-500 mt-2">
                Meeting prep will be generated automatically when you book customer meetings.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {todaysMeetings.meetings.map(meeting => (
                <button
                  key={meeting.id}
                  onClick={() => fetchBrief(meeting.id)}
                  className={`w-full text-left p-4 rounded-xl border transition-all ${
                    selectedBrief?.id === meeting.id
                      ? 'bg-cscx-accent/10 border-cscx-accent'
                      : 'bg-cscx-gray-800/50 border-cscx-gray-800 hover:bg-cscx-gray-800 hover:border-cscx-gray-700'
                  }`}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <span className="text-lg font-medium text-white">{meeting.customerName}</span>
                        {meeting.status === 'viewed' && (
                          <span className="text-xs text-green-400">Viewed</span>
                        )}
                      </div>
                      <div className="flex items-center gap-2 mt-1">
                        <span className="text-sm text-cscx-gray-400">{formatTime(meeting.scheduledAt)}</span>
                        <span className="text-xs px-2 py-0.5 bg-cscx-gray-700 rounded text-cscx-gray-300">
                          {getMeetingTypeLabel(meeting.meetingType)}
                        </span>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className={`text-lg font-semibold ${getHealthColor(meeting.healthScore)}`}>
                        {meeting.healthScore}
                      </div>
                      <div className="text-xs text-cscx-gray-500">Health</div>
                    </div>
                  </div>

                  {/* Quick stats */}
                  <div className="flex gap-3 mt-3 text-xs text-cscx-gray-500">
                    <span>{meeting.talkingPointCount} talking points</span>
                    <span>-</span>
                    <span>{meeting.attendeeCount} attendees</span>
                    {meeting.openItemCount > 0 && (
                      <>
                        <span>-</span>
                        <span className="text-yellow-400">{meeting.openItemCount} open items</span>
                      </>
                    )}
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Right Panel - Brief Detail */}
      {selectedBrief && (
        <div className="flex-1 overflow-y-auto">
          {briefLoading ? (
            <div className="flex items-center justify-center h-full">
              <div className="animate-spin w-8 h-8 border-2 border-cscx-accent border-t-transparent rounded-full" />
            </div>
          ) : (
            <div className="p-6">
              {/* Brief Header */}
              <div className="flex items-start justify-between mb-6">
                <div>
                  <h3 className="text-2xl font-bold text-white">{selectedBrief.customer.name}</h3>
                  <div className="flex items-center gap-3 mt-1">
                    <span className="text-cscx-gray-400">{formatTime(selectedBrief.scheduledAt)}</span>
                    <span className="px-2 py-0.5 bg-cscx-gray-700 rounded text-sm text-cscx-gray-300">
                      {getMeetingTypeLabel(selectedBrief.meetingContext.meetingType)}
                    </span>
                    <span className="text-xs text-cscx-gray-500">
                      Data: {selectedBrief.dataCompleteness}%
                    </span>
                  </div>
                </div>
                <button
                  onClick={() => refreshBrief(selectedBrief.id)}
                  className="px-3 py-1.5 text-sm bg-cscx-gray-800 hover:bg-cscx-gray-700 text-white rounded-lg transition-colors flex items-center gap-2"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                  </svg>
                  Refresh
                </button>
              </div>

              {/* Customer Snapshot */}
              <div className="grid grid-cols-4 gap-4 mb-6">
                <div className="p-3 bg-cscx-gray-800/50 rounded-lg text-center">
                  <p className="text-xs text-cscx-gray-500 uppercase">Health Score</p>
                  <div className="flex items-center justify-center gap-1 mt-1">
                    <span className={`text-xl font-bold ${getHealthColor(selectedBrief.customer.healthScore)}`}>
                      {selectedBrief.customer.healthScore}
                    </span>
                    {getTrendIcon(selectedBrief.customer.healthTrend)}
                  </div>
                </div>
                <div className="p-3 bg-cscx-gray-800/50 rounded-lg text-center">
                  <p className="text-xs text-cscx-gray-500 uppercase">ARR</p>
                  <p className="text-xl font-bold text-cscx-accent mt-1">
                    {formatCurrency(selectedBrief.customer.arr)}
                  </p>
                </div>
                <div className="p-3 bg-cscx-gray-800/50 rounded-lg text-center">
                  <p className="text-xs text-cscx-gray-500 uppercase">Stage</p>
                  <p className="text-lg font-semibold text-white mt-1 capitalize">
                    {selectedBrief.customer.stage.replace('_', ' ')}
                  </p>
                </div>
                <div className="p-3 bg-cscx-gray-800/50 rounded-lg text-center">
                  <p className="text-xs text-cscx-gray-500 uppercase">Last Meeting</p>
                  <p className="text-lg font-semibold text-white mt-1">
                    {selectedBrief.customer.daysSinceLastMeeting < 999
                      ? `${selectedBrief.customer.daysSinceLastMeeting}d ago`
                      : '-'}
                  </p>
                </div>
              </div>

              {/* Tabs */}
              <div className="flex gap-1 mb-6 border-b border-cscx-gray-800">
                {(['overview', 'attendees', 'history'] as const).map(tab => (
                  <button
                    key={tab}
                    onClick={() => setActiveTab(tab)}
                    className={`px-4 py-2 text-sm font-medium transition-colors ${
                      activeTab === tab
                        ? 'text-white border-b-2 border-cscx-accent'
                        : 'text-cscx-gray-400 hover:text-white'
                    }`}
                  >
                    {tab.charAt(0).toUpperCase() + tab.slice(1)}
                  </button>
                ))}
              </div>

              {/* Tab Content */}
              {activeTab === 'overview' && (
                <div className="space-y-6">
                  {/* Meeting Objectives */}
                  {selectedBrief.meetingContext.objectives && selectedBrief.meetingContext.objectives.length > 0 && (
                    <div>
                      <h4 className="text-sm font-semibold text-cscx-gray-400 uppercase mb-3">Meeting Objectives</h4>
                      <div className="space-y-2">
                        {selectedBrief.meetingContext.objectives.map((obj, i) => (
                          <div key={i} className="flex items-start gap-2 p-2 bg-cscx-gray-800/30 rounded-lg">
                            <span className="text-cscx-accent">-</span>
                            <span className="text-white">{obj}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Talking Points */}
                  <div>
                    <h4 className="text-sm font-semibold text-cscx-gray-400 uppercase mb-3">Talking Points</h4>
                    <div className="space-y-2">
                      {selectedBrief.talkingPoints.map((tp, i) => (
                        <div key={i} className={`p-3 rounded-lg border ${getPriorityColor(tp.priority)}`}>
                          <div className="flex items-start gap-3">
                            <span className="text-xs uppercase font-medium whitespace-nowrap">
                              {tp.priority.replace('_', ' ')}
                            </span>
                            <div>
                              <p className="text-white">{tp.point}</p>
                              {tp.context && (
                                <p className="text-xs opacity-75 mt-1">{tp.context}</p>
                              )}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Questions to Ask */}
                  <div>
                    <h4 className="text-sm font-semibold text-cscx-gray-400 uppercase mb-3">Questions to Ask</h4>
                    <div className="space-y-2">
                      {selectedBrief.questions.map((q, i) => (
                        <div key={i} className="flex items-start gap-2 p-2 bg-cscx-gray-800/30 rounded-lg">
                          <span className="text-blue-400">{i + 1}.</span>
                          <span className="text-cscx-gray-300">{q}</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Open Items */}
                  {selectedBrief.openItems.length > 0 && (
                    <div>
                      <h4 className="text-sm font-semibold text-cscx-gray-400 uppercase mb-3">
                        Open Items
                        <span className="ml-2 px-2 py-0.5 text-xs bg-yellow-500/20 text-yellow-400 rounded-full">
                          {selectedBrief.openItems.length}
                        </span>
                      </h4>
                      <div className="space-y-2">
                        {selectedBrief.openItems.map((item, i) => (
                          <div key={i} className="flex items-start gap-3 p-2 bg-cscx-gray-800/30 rounded-lg">
                            <span className={`px-2 py-0.5 text-xs rounded ${getPriorityColor(item.priority)}`}>
                              {item.priority}
                            </span>
                            <div>
                              <p className="text-white">{item.description}</p>
                              <p className="text-xs text-cscx-gray-500 mt-1">
                                {item.type}{item.dueDate ? ` - Due: ${formatDate(item.dueDate)}` : ''}
                              </p>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Recommendations */}
                  <div>
                    <h4 className="text-sm font-semibold text-cscx-gray-400 uppercase mb-3">Recommendations</h4>
                    <div className="space-y-2">
                      {selectedBrief.recommendations.map((rec, i) => (
                        <div key={i} className="flex items-start gap-2 p-2 bg-cscx-gray-800/30 rounded-lg">
                          <span className="text-green-400">*</span>
                          <span className="text-cscx-gray-300">{rec}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {activeTab === 'attendees' && (
                <div className="space-y-4">
                  {selectedBrief.attendees.length === 0 ? (
                    <p className="text-cscx-gray-500 text-center py-8">No attendee information available</p>
                  ) : (
                    selectedBrief.attendees.map((attendee, i) => (
                      <div key={i} className="p-4 bg-cscx-gray-800/50 rounded-lg">
                        <div className="flex items-start justify-between">
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="font-medium text-white">{attendee.name}</span>
                              {attendee.influence && attendee.influence !== 'unknown' && (
                                <span className={`px-2 py-0.5 text-xs rounded ${getInfluenceBadge(attendee.influence)}`}>
                                  {attendee.influence.replace('_', ' ')}
                                </span>
                              )}
                            </div>
                            {attendee.role && (
                              <p className="text-sm text-cscx-gray-400 mt-1">{attendee.role}</p>
                            )}
                            {attendee.email && (
                              <p className="text-xs text-cscx-gray-500 mt-1">{attendee.email}</p>
                            )}
                          </div>
                          <div className="text-right">
                            <div className="flex items-center gap-1">
                              {getSentimentIcon(attendee.sentiment || 'unknown')}
                              <span className="text-sm text-cscx-gray-400 capitalize">
                                {attendee.sentiment || 'Unknown'}
                              </span>
                            </div>
                            {attendee.lastContact && (
                              <p className="text-xs text-cscx-gray-500 mt-1">
                                Last: {formatDate(attendee.lastContact)}
                              </p>
                            )}
                          </div>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              )}

              {activeTab === 'history' && (
                <div className="space-y-6">
                  {/* Previous Meetings */}
                  <div>
                    <h4 className="text-sm font-semibold text-cscx-gray-400 uppercase mb-3">Previous Meetings</h4>
                    {selectedBrief.previousMeetings.length === 0 ? (
                      <p className="text-cscx-gray-500 text-center py-4">No previous meetings recorded</p>
                    ) : (
                      <div className="space-y-3">
                        {selectedBrief.previousMeetings.map((meeting, i) => (
                          <div key={i} className="p-3 bg-cscx-gray-800/50 rounded-lg">
                            <div className="flex items-start justify-between">
                              <div>
                                <p className="font-medium text-white">{meeting.title}</p>
                                {meeting.summary && (
                                  <p className="text-sm text-cscx-gray-400 mt-1">{meeting.summary}</p>
                                )}
                              </div>
                              <span className="text-xs text-cscx-gray-500">{formatDate(meeting.date)}</span>
                            </div>
                            {meeting.followUps && meeting.followUps.length > 0 && (
                              <div className="mt-2 pt-2 border-t border-cscx-gray-700">
                                <p className="text-xs text-cscx-gray-500 mb-1">Follow-ups:</p>
                                <ul className="text-sm text-cscx-gray-400">
                                  {meeting.followUps.map((fu, j) => (
                                    <li key={j}>- {fu}</li>
                                  ))}
                                </ul>
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Recent Activity */}
                  <div>
                    <h4 className="text-sm font-semibold text-cscx-gray-400 uppercase mb-3">Recent Activity</h4>
                    {selectedBrief.recentActivity.length === 0 ? (
                      <p className="text-cscx-gray-500 text-center py-4">No recent activity</p>
                    ) : (
                      <div className="space-y-2">
                        {selectedBrief.recentActivity.map((activity, i) => (
                          <div key={i} className="flex items-start gap-3 p-2 hover:bg-cscx-gray-800/30 rounded-lg">
                            <span className="text-xs text-cscx-gray-500 whitespace-nowrap min-w-[60px]">
                              {formatDate(activity.date)}
                            </span>
                            <span className="text-xs px-2 py-0.5 bg-cscx-gray-800 text-cscx-gray-400 rounded">
                              {activity.type}
                            </span>
                            <span className="text-sm text-cscx-gray-300">{activity.description}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default MeetingPrepView;
