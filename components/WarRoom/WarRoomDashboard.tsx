/**
 * PRD-121: War Room Dashboard Component
 *
 * Central tracking view for active escalations and war rooms.
 * Shows status, time tracking, severity indicators, and quick actions.
 */

import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../../context/AuthContext';

// ============================================
// Types
// ============================================

interface Escalation {
  id: string;
  customerId: string;
  customerName: string;
  customerARR?: number;
  customerHealthScore?: number;
  severity: 'P1' | 'P2' | 'P3';
  status: 'active' | 'resolved' | 'post_mortem' | 'closed';
  category: string;
  title: string;
  description: string;
  impact: string;
  createdAt: string;
  resolvedAt: string | null;
  ownerId: string;
  ownerName?: string;
}

interface WarRoom {
  id: string;
  escalationId: string;
  slackChannelId: string;
  slackChannelName: string;
  slackChannelUrl?: string;
  briefDocumentUrl?: string;
  dashboardUrl: string;
  participants: Array<{
    userId: string;
    userName: string;
    role: string;
  }>;
  statusUpdates: Array<{
    id: string;
    timestamp: string;
    summary: string;
    progress?: number;
  }>;
  createdAt: string;
}

interface EscalationWithWarRoom {
  escalation: Escalation;
  warRoom: WarRoom | null;
}

interface Metrics {
  totalActive: number;
  activeByPriority: {
    P1: number;
    P2: number;
    P3: number;
  };
  activeByCategory: Record<string, number>;
  avgResolutionTimeHours: number;
}

interface WarRoomDashboardProps {
  onSelectEscalation?: (escalationId: string) => void;
  onCreateEscalation?: () => void;
}

const API_BASE = `${import.meta.env.VITE_API_URL || ''}/api`;

// ============================================
// Dashboard Component
// ============================================

export const WarRoomDashboard: React.FC<WarRoomDashboardProps> = ({
  onSelectEscalation,
  onCreateEscalation,
}) => {
  const { getAuthHeaders } = useAuth();
  const [escalations, setEscalations] = useState<Escalation[]>([]);
  const [metrics, setMetrics] = useState<Metrics | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<'all' | 'P1' | 'P2' | 'P3'>('all');
  const [statusFilter, setStatusFilter] = useState<'active' | 'resolved' | 'all'>('active');

  // Fetch escalations
  const fetchEscalations = useCallback(async () => {
    try {
      const params = new URLSearchParams();
      if (statusFilter !== 'all') {
        params.set('status', statusFilter);
      }
      if (filter !== 'all') {
        params.set('severity', filter);
      }

      const response = await fetch(`${API_BASE}/escalations?${params}`, {
        headers: getAuthHeaders(),
      });

      if (!response.ok) throw new Error('Failed to fetch escalations');

      const data = await response.json();
      setEscalations(data.escalations || []);
    } catch (err) {
      console.error('Failed to fetch escalations:', err);
      setError(err instanceof Error ? err.message : 'Failed to load escalations');
    }
  }, [getAuthHeaders, filter, statusFilter]);

  // Fetch metrics
  const fetchMetrics = useCallback(async () => {
    try {
      const response = await fetch(`${API_BASE}/escalations/metrics`, {
        headers: getAuthHeaders(),
      });

      if (response.ok) {
        const data = await response.json();
        setMetrics(data.metrics);
      }
    } catch (err) {
      console.error('Failed to fetch metrics:', err);
    }
  }, [getAuthHeaders]);

  useEffect(() => {
    const loadData = async () => {
      setLoading(true);
      await Promise.all([fetchEscalations(), fetchMetrics()]);
      setLoading(false);
    };
    loadData();

    // Refresh every 30 seconds for active escalations
    const interval = setInterval(fetchEscalations, 30000);
    return () => clearInterval(interval);
  }, [fetchEscalations, fetchMetrics]);

  // Calculate time in escalation
  const getTimeInEscalation = (createdAt: string, resolvedAt: string | null): string => {
    const start = new Date(createdAt);
    const end = resolvedAt ? new Date(resolvedAt) : new Date();
    const diffMs = end.getTime() - start.getTime();
    const hours = Math.floor(diffMs / (1000 * 60 * 60));
    const minutes = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));

    if (hours > 24) {
      const days = Math.floor(hours / 24);
      return `${days}d ${hours % 24}h`;
    }
    return `${hours}h ${minutes}m`;
  };

  // Get severity badge color
  const getSeverityColor = (severity: string): string => {
    switch (severity) {
      case 'P1':
        return 'bg-red-600 text-white';
      case 'P2':
        return 'bg-orange-500 text-white';
      case 'P3':
        return 'bg-yellow-500 text-black';
      default:
        return 'bg-gray-500 text-white';
    }
  };

  // Get status badge color
  const getStatusColor = (status: string): string => {
    switch (status) {
      case 'active':
        return 'bg-red-900/50 text-red-300 border-red-600/50';
      case 'resolved':
        return 'bg-green-900/50 text-green-300 border-green-600/50';
      case 'post_mortem':
        return 'bg-purple-900/50 text-purple-300 border-purple-600/50';
      case 'closed':
        return 'bg-gray-900/50 text-gray-300 border-gray-600/50';
      default:
        return 'bg-gray-900/50 text-gray-300 border-gray-600/50';
    }
  };

  // Loading state
  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-2 border-cscx-accent border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold text-white">War Room Dashboard</h2>
          <p className="text-cscx-gray-400 text-sm mt-1">
            Active escalations and war room tracking
          </p>
        </div>
        {onCreateEscalation && (
          <button
            onClick={onCreateEscalation}
            className="px-4 py-2 bg-cscx-accent text-white rounded-lg hover:bg-cscx-accent/90 transition-colors flex items-center gap-2"
          >
            <span>🚨</span>
            Create Escalation
          </button>
        )}
      </div>

      {/* Metrics Cards */}
      {metrics && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {/* Total Active */}
          <div className="bg-cscx-gray-800 rounded-lg p-4 border border-cscx-gray-700">
            <p className="text-cscx-gray-400 text-sm">Active Escalations</p>
            <p className="text-3xl font-bold text-white mt-1">{metrics.totalActive}</p>
          </div>

          {/* By Priority */}
          <div className="bg-cscx-gray-800 rounded-lg p-4 border border-cscx-gray-700">
            <p className="text-cscx-gray-400 text-sm">By Priority</p>
            <div className="flex items-center gap-3 mt-2">
              <div className="flex items-center gap-1">
                <span className="w-3 h-3 rounded-full bg-red-600" />
                <span className="text-white font-medium">{metrics.activeByPriority.P1}</span>
              </div>
              <div className="flex items-center gap-1">
                <span className="w-3 h-3 rounded-full bg-orange-500" />
                <span className="text-white font-medium">{metrics.activeByPriority.P2}</span>
              </div>
              <div className="flex items-center gap-1">
                <span className="w-3 h-3 rounded-full bg-yellow-500" />
                <span className="text-white font-medium">{metrics.activeByPriority.P3}</span>
              </div>
            </div>
          </div>

          {/* Avg Resolution Time */}
          <div className="bg-cscx-gray-800 rounded-lg p-4 border border-cscx-gray-700">
            <p className="text-cscx-gray-400 text-sm">Avg Resolution Time</p>
            <p className="text-3xl font-bold text-white mt-1">
              {metrics.avgResolutionTimeHours > 0
                ? `${Math.round(metrics.avgResolutionTimeHours)}h`
                : 'N/A'}
            </p>
          </div>

          {/* Categories */}
          <div className="bg-cscx-gray-800 rounded-lg p-4 border border-cscx-gray-700">
            <p className="text-cscx-gray-400 text-sm">Top Category</p>
            <p className="text-lg font-medium text-white mt-1 capitalize">
              {Object.entries(metrics.activeByCategory)
                .sort(([, a], [, b]) => b - a)[0]?.[0] || 'None'}
            </p>
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="flex items-center gap-4">
        <div className="flex gap-1 p-1 bg-cscx-gray-800 rounded-lg">
          {(['all', 'P1', 'P2', 'P3'] as const).map((sev) => (
            <button
              key={sev}
              onClick={() => setFilter(sev)}
              className={`px-3 py-1.5 text-sm font-medium rounded-md transition-colors ${
                filter === sev
                  ? 'bg-cscx-accent text-white'
                  : 'text-cscx-gray-400 hover:text-white'
              }`}
            >
              {sev === 'all' ? 'All' : sev}
            </button>
          ))}
        </div>
        <div className="flex gap-1 p-1 bg-cscx-gray-800 rounded-lg">
          {(['active', 'resolved', 'all'] as const).map((status) => (
            <button
              key={status}
              onClick={() => setStatusFilter(status)}
              className={`px-3 py-1.5 text-sm font-medium rounded-md transition-colors capitalize ${
                statusFilter === status
                  ? 'bg-cscx-accent text-white'
                  : 'text-cscx-gray-400 hover:text-white'
              }`}
            >
              {status}
            </button>
          ))}
        </div>
      </div>

      {/* Escalations List */}
      {error && (
        <div className="bg-red-900/20 border border-red-600/50 rounded-lg p-4 text-red-300">
          {error}
        </div>
      )}

      {escalations.length === 0 ? (
        <div className="bg-cscx-gray-800 rounded-lg p-8 text-center border border-cscx-gray-700">
          <span className="text-4xl mb-4 block">✨</span>
          <h3 className="text-lg font-medium text-white mb-2">No Active Escalations</h3>
          <p className="text-cscx-gray-400 text-sm">
            All clear! No escalations match your current filters.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {escalations.map((escalation) => (
            <EscalationCard
              key={escalation.id}
              escalation={escalation}
              timeInEscalation={getTimeInEscalation(
                escalation.createdAt,
                escalation.resolvedAt
              )}
              severityColor={getSeverityColor(escalation.severity)}
              statusColor={getStatusColor(escalation.status)}
              onSelect={() => onSelectEscalation?.(escalation.id)}
            />
          ))}
        </div>
      )}
    </div>
  );
};

// ============================================
// Escalation Card Component
// ============================================

interface EscalationCardProps {
  escalation: Escalation;
  timeInEscalation: string;
  severityColor: string;
  statusColor: string;
  onSelect: () => void;
}

const EscalationCard: React.FC<EscalationCardProps> = ({
  escalation,
  timeInEscalation,
  severityColor,
  statusColor,
  onSelect,
}) => {
  return (
    <div
      onClick={onSelect}
      className="bg-cscx-gray-800 rounded-lg p-4 border border-cscx-gray-700 hover:border-cscx-accent/50 transition-all cursor-pointer"
    >
      <div className="flex items-start justify-between">
        <div className="flex-1 min-w-0">
          {/* Header */}
          <div className="flex items-center gap-2 mb-2">
            <span className={`px-2 py-0.5 text-xs font-bold rounded ${severityColor}`}>
              {escalation.severity}
            </span>
            <span
              className={`px-2 py-0.5 text-xs font-medium rounded border ${statusColor}`}
            >
              {escalation.status}
            </span>
            <span className="text-xs text-cscx-gray-500 capitalize">
              {escalation.category}
            </span>
          </div>

          {/* Title */}
          <h3 className="text-white font-medium truncate">{escalation.title}</h3>

          {/* Customer Info */}
          <div className="flex items-center gap-4 mt-2">
            <span className="text-sm text-cscx-gray-300">{escalation.customerName}</span>
            {escalation.customerARR && (
              <span className="text-xs text-cscx-gray-500">
                ${escalation.customerARR.toLocaleString()} ARR
              </span>
            )}
          </div>

          {/* Description Preview */}
          <p className="text-sm text-cscx-gray-400 mt-2 line-clamp-2">
            {escalation.description}
          </p>
        </div>

        {/* Right Side: Time & Actions */}
        <div className="flex flex-col items-end gap-2 ml-4">
          {/* Time in Escalation */}
          <div className="text-right">
            <p className="text-xs text-cscx-gray-500">Time in Escalation</p>
            <p
              className={`text-lg font-bold ${
                escalation.status === 'active' ? 'text-cscx-accent' : 'text-cscx-gray-400'
              }`}
            >
              {timeInEscalation}
            </p>
          </div>

          {/* Owner */}
          <div className="text-xs text-cscx-gray-500 text-right">
            Owner: {escalation.ownerName || 'Unassigned'}
          </div>
        </div>
      </div>

      {/* Footer with Quick Actions */}
      <div className="flex items-center justify-between mt-4 pt-3 border-t border-cscx-gray-700">
        <div className="flex items-center gap-4">
          <span className="text-xs text-cscx-gray-500">
            Created {new Date(escalation.createdAt).toLocaleDateString()}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={(e) => {
              e.stopPropagation();
              // Open Slack channel - would need war room data
              console.log('Open Slack');
            }}
            className="p-1.5 text-cscx-gray-400 hover:text-white hover:bg-cscx-gray-700 rounded transition-colors"
            title="Join Slack Channel"
          >
            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
              <path d="M5.042 15.165a2.528 2.528 0 0 1-2.52 2.523A2.528 2.528 0 0 1 0 15.165a2.527 2.527 0 0 1 2.522-2.52h2.52v2.52zM6.313 15.165a2.527 2.527 0 0 1 2.521-2.52 2.527 2.527 0 0 1 2.521 2.52v6.313A2.528 2.528 0 0 1 8.834 24a2.528 2.528 0 0 1-2.521-2.522v-6.313zM8.834 5.042a2.528 2.528 0 0 1-2.521-2.52A2.528 2.528 0 0 1 8.834 0a2.528 2.528 0 0 1 2.521 2.522v2.52H8.834zM8.834 6.313a2.528 2.528 0 0 1 2.521 2.521 2.528 2.528 0 0 1-2.521 2.521H2.522A2.528 2.528 0 0 1 0 8.834a2.528 2.528 0 0 1 2.522-2.521h6.312zM18.956 8.834a2.528 2.528 0 0 1 2.522-2.521A2.528 2.528 0 0 1 24 8.834a2.528 2.528 0 0 1-2.522 2.521h-2.522V8.834zM17.688 8.834a2.528 2.528 0 0 1-2.523 2.521 2.527 2.527 0 0 1-2.52-2.521V2.522A2.527 2.527 0 0 1 15.165 0a2.528 2.528 0 0 1 2.523 2.522v6.312zM15.165 18.956a2.528 2.528 0 0 1 2.523 2.522A2.528 2.528 0 0 1 15.165 24a2.527 2.527 0 0 1-2.52-2.522v-2.522h2.52zM15.165 17.688a2.527 2.527 0 0 1-2.52-2.523 2.526 2.526 0 0 1 2.52-2.52h6.313A2.527 2.527 0 0 1 24 15.165a2.528 2.528 0 0 1-2.522 2.523h-6.313z" />
            </svg>
          </button>
          <button
            onClick={(e) => {
              e.stopPropagation();
              // View escalation brief
              console.log('View Brief');
            }}
            className="p-1.5 text-cscx-gray-400 hover:text-white hover:bg-cscx-gray-700 rounded transition-colors"
            title="View Brief"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
              />
            </svg>
          </button>
          <button
            onClick={(e) => {
              e.stopPropagation();
              onSelect();
            }}
            className="px-3 py-1 text-xs bg-cscx-gray-700 text-white rounded hover:bg-cscx-gray-600 transition-colors"
          >
            View Details
          </button>
        </div>
      </div>
    </div>
  );
};

export default WarRoomDashboard;
