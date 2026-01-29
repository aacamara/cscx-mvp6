/**
 * Meeting Intelligence Viewer - View meeting analyses and insights
 * Part of WorkspaceAgent V2 Dashboard (WAD-007)
 */

import React, { useState, useEffect, useMemo } from 'react';
import { useAuth } from '../../context/AuthContext';

const API_URL = import.meta.env.VITE_API_URL || '';

// ============================================
// Types
// ============================================

interface ActionItem {
  description: string;
  assignee?: string;
  due_date?: string;
  priority?: 'low' | 'medium' | 'high';
}

interface MeetingAnalysis {
  id: string;
  meeting_id?: string;
  title: string;
  date: string;
  duration_minutes?: number;
  platform: 'zoom' | 'google_meet' | 'teams' | 'other';
  customer_id?: string;
  customer_name?: string;
  summary?: string;
  sentiment?: 'positive' | 'neutral' | 'negative' | 'mixed';
  key_points?: string[];
  action_items?: ActionItem[];
  risk_indicators?: string[];
  participants?: string[];
  created_at: string;
}

interface Customer {
  id: string;
  name: string;
}

// ============================================
// Constants
// ============================================

const PLATFORM_ICONS: Record<string, string> = {
  zoom: '📹',
  google_meet: '🎥',
  teams: '💼',
  other: '🎙️',
};

const SENTIMENT_COLORS: Record<string, string> = {
  positive: 'bg-green-500/20 text-green-400 border-green-500/30',
  neutral: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
  negative: 'bg-red-500/20 text-red-400 border-red-500/30',
  mixed: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30',
};

const SENTIMENT_ICONS: Record<string, string> = {
  positive: '😊',
  neutral: '😐',
  negative: '😟',
  mixed: '🤔',
};

const PRIORITY_COLORS: Record<string, string> = {
  low: 'text-cscx-gray-400',
  medium: 'text-yellow-400',
  high: 'text-red-400',
};

// ============================================
// Component
// ============================================

export const MeetingIntelligenceViewer: React.FC = () => {
  const { getAuthHeaders } = useAuth();

  const [analyses, setAnalyses] = useState<MeetingAnalysis[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expandedMeetingId, setExpandedMeetingId] = useState<string | null>(null);
  const [selectedCustomerId, setSelectedCustomerId] = useState<string>('all');

  // Fetch data on mount
  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    setError(null);
    try {
      // Fetch both analyses and customers in parallel
      const [analysesRes, customersRes] = await Promise.all([
        fetch(`${API_URL}/api/meeting-intelligence/analyses`, {
          headers: getAuthHeaders(),
          credentials: 'include',
        }),
        fetch(`${API_URL}/api/customers`, {
          headers: getAuthHeaders(),
          credentials: 'include',
        }),
      ]);

      if (!analysesRes.ok) {
        throw new Error(`Failed to fetch analyses: ${analysesRes.status}`);
      }

      const analysesData = await analysesRes.json();
      setAnalyses(analysesData.analyses || analysesData || []);

      if (customersRes.ok) {
        const customersData = await customersRes.json();
        setCustomers(customersData.customers || customersData || []);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch meeting analyses');
    } finally {
      setLoading(false);
    }
  };

  // Filter analyses by selected customer
  const filteredAnalyses = useMemo(() => {
    if (selectedCustomerId === 'all') return analyses;
    return analyses.filter((a) => a.customer_id === selectedCustomerId);
  }, [analyses, selectedCustomerId]);

  const toggleExpanded = (meetingId: string) => {
    setExpandedMeetingId((prev) => (prev === meetingId ? null : meetingId));
  };

  const formatDate = (dateString: string): string => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  };

  const formatDuration = (minutes?: number): string => {
    if (!minutes) return 'Unknown';
    if (minutes < 60) return `${minutes} min`;
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return mins > 0 ? `${hours}h ${mins}m` : `${hours}h`;
  };

  // Loading state
  if (loading) {
    return (
      <div className="bg-cscx-gray-900 border border-cscx-gray-800 rounded-xl p-8">
        <div className="flex items-center justify-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-2 border-cscx-accent border-t-transparent" />
          <span className="ml-3 text-cscx-gray-400">Loading meeting analyses...</span>
        </div>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className="bg-cscx-gray-900 border border-cscx-gray-800 rounded-xl p-8">
        <div className="text-center py-12">
          <div className="text-4xl mb-4">⚠️</div>
          <h3 className="text-xl font-semibold text-white mb-2">Failed to Load Analyses</h3>
          <p className="text-cscx-gray-400 mb-4">{error}</p>
          <button
            onClick={fetchData}
            className="px-4 py-2 bg-cscx-accent hover:bg-cscx-accent/80 text-white rounded-lg transition-colors"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header with Filter */}
      <div className="bg-cscx-gray-900 border border-cscx-gray-800 rounded-xl p-4">
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div className="flex items-center gap-3">
            <div className="text-2xl">📅</div>
            <div>
              <h3 className="text-lg font-semibold text-white">Meeting Intelligence</h3>
              <p className="text-sm text-cscx-gray-400">
                {filteredAnalyses.length} of {analyses.length} meetings
              </p>
            </div>
          </div>

          {/* Customer Filter */}
          {customers.length > 0 && (
            <select
              value={selectedCustomerId}
              onChange={(e) => setSelectedCustomerId(e.target.value)}
              className="bg-cscx-gray-800 border border-cscx-gray-700 rounded-lg px-4 py-2 text-white focus:outline-none focus:border-cscx-accent"
            >
              <option value="all">All Customers</option>
              {customers.map((customer) => (
                <option key={customer.id} value={customer.id}>
                  {customer.name}
                </option>
              ))}
            </select>
          )}
        </div>
      </div>

      {/* Empty state */}
      {filteredAnalyses.length === 0 ? (
        <div className="bg-cscx-gray-900 border border-cscx-gray-800 rounded-xl p-8">
          <div className="text-center py-12">
            <div className="text-4xl mb-4">📅</div>
            <h3 className="text-xl font-semibold text-white mb-2">No Meeting Analyses</h3>
            <p className="text-cscx-gray-400 max-w-md mx-auto">
              {selectedCustomerId !== 'all'
                ? 'No meetings found for this customer. Try selecting a different customer or "All Customers".'
                : 'Meeting analyses will appear here once meetings are processed. Connect your calendar or Zoom to start analyzing meetings.'}
            </p>
          </div>
        </div>
      ) : (
        /* Meeting Cards */
        <div className="grid gap-4">
          {filteredAnalyses.map((analysis) => {
            const isExpanded = expandedMeetingId === analysis.id;
            return (
              <div
                key={analysis.id}
                className="bg-cscx-gray-900 border border-cscx-gray-800 rounded-xl overflow-hidden"
              >
                {/* Meeting Header */}
                <button
                  onClick={() => toggleExpanded(analysis.id)}
                  className="w-full p-4 flex items-start justify-between gap-4 hover:bg-cscx-gray-800/30 transition-colors text-left"
                >
                  <div className="flex items-start gap-3 flex-1 min-w-0">
                    <div className="text-2xl">
                      {PLATFORM_ICONS[analysis.platform] || PLATFORM_ICONS.other}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h4 className="text-white font-medium">{analysis.title}</h4>
                        {analysis.sentiment && (
                          <span
                            className={`px-2 py-0.5 text-xs rounded-full border flex items-center gap-1 ${
                              SENTIMENT_COLORS[analysis.sentiment]
                            }`}
                          >
                            <span>{SENTIMENT_ICONS[analysis.sentiment]}</span>
                            {analysis.sentiment}
                          </span>
                        )}
                      </div>

                      {/* Customer Name */}
                      {analysis.customer_name && (
                        <p className="text-sm text-cscx-accent mt-1">{analysis.customer_name}</p>
                      )}

                      {/* Summary Preview */}
                      {analysis.summary && (
                        <p className="text-sm text-cscx-gray-400 mt-1 line-clamp-2">
                          {analysis.summary}
                        </p>
                      )}

                      {/* Quick Stats */}
                      <div className="flex items-center gap-4 mt-3 text-sm flex-wrap">
                        <div className="flex items-center gap-1 text-cscx-gray-400">
                          <span>📆</span>
                          <span>{formatDate(analysis.date)}</span>
                        </div>
                        <div className="flex items-center gap-1 text-cscx-gray-400">
                          <span>⏱️</span>
                          <span>{formatDuration(analysis.duration_minutes)}</span>
                        </div>
                        {analysis.action_items && analysis.action_items.length > 0 && (
                          <div className="flex items-center gap-1 text-blue-400">
                            <span>✅</span>
                            <span>{analysis.action_items.length} action items</span>
                          </div>
                        )}
                        {analysis.risk_indicators && analysis.risk_indicators.length > 0 && (
                          <div className="flex items-center gap-1 text-red-400">
                            <span>⚠️</span>
                            <span>{analysis.risk_indicators.length} risks</span>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>

                  <span className="text-cscx-gray-400">{isExpanded ? '▼' : '▶'}</span>
                </button>

                {/* Expanded Details */}
                {isExpanded && (
                  <div className="border-t border-cscx-gray-800 p-4 bg-cscx-gray-800/20 space-y-4">
                    {/* Key Points */}
                    {analysis.key_points && analysis.key_points.length > 0 && (
                      <div>
                        <h5 className="text-sm font-medium text-white mb-2">Key Points</h5>
                        <ul className="space-y-1">
                          {analysis.key_points.map((point, idx) => (
                            <li
                              key={idx}
                              className="text-sm text-cscx-gray-400 flex items-start gap-2"
                            >
                              <span className="text-cscx-accent">•</span>
                              {point}
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}

                    {/* Action Items */}
                    {analysis.action_items && analysis.action_items.length > 0 && (
                      <div>
                        <h5 className="text-sm font-medium text-white mb-2">Action Items</h5>
                        <div className="space-y-2">
                          {analysis.action_items.map((item, idx) => (
                            <div
                              key={idx}
                              className="p-2 bg-cscx-gray-900 rounded-lg flex items-start justify-between gap-3"
                            >
                              <div className="flex items-start gap-2">
                                <span className="text-blue-400">☐</span>
                                <span className="text-sm text-cscx-gray-300">
                                  {item.description}
                                </span>
                              </div>
                              <div className="flex items-center gap-2 text-xs">
                                {item.assignee && (
                                  <span className="text-cscx-gray-500">{item.assignee}</span>
                                )}
                                {item.priority && (
                                  <span className={PRIORITY_COLORS[item.priority] || ''}>
                                    {item.priority}
                                  </span>
                                )}
                                {item.due_date && (
                                  <span className="text-cscx-gray-500">{item.due_date}</span>
                                )}
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Risk Indicators */}
                    {analysis.risk_indicators && analysis.risk_indicators.length > 0 && (
                      <div>
                        <h5 className="text-sm font-medium text-white mb-2">Risk Indicators</h5>
                        <div className="flex flex-wrap gap-2">
                          {analysis.risk_indicators.map((risk, idx) => (
                            <span
                              key={idx}
                              className="px-2 py-1 text-xs bg-red-500/20 text-red-400 rounded"
                            >
                              ⚠️ {risk}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Participants */}
                    {analysis.participants && analysis.participants.length > 0 && (
                      <div>
                        <h5 className="text-sm font-medium text-white mb-2">Participants</h5>
                        <div className="flex flex-wrap gap-2">
                          {analysis.participants.map((participant, idx) => (
                            <span
                              key={idx}
                              className="px-2 py-1 text-xs bg-cscx-gray-800 text-cscx-gray-400 rounded"
                            >
                              👤 {participant}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default MeetingIntelligenceViewer;
