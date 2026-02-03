/**
 * PRD-257: Cross-Functional Alignment Timeline Component
 *
 * Displays a unified activity timeline from all integrated systems,
 * account team members, detected conflicts, and coordination tools.
 */

import { useState, useEffect, useCallback } from 'react';

// ============================================
// Types
// ============================================

type Team = 'sales' | 'support' | 'product' | 'engineering' | 'cs' | 'executive';
type SourceSystem = 'salesforce' | 'zendesk' | 'jira' | 'slack' | 'cscx' | 'hubspot' | 'intercom';
type ConflictSeverity = 'info' | 'warning' | 'critical';

interface Activity {
  id: string;
  customerId: string;
  sourceSystem: SourceSystem;
  sourceId?: string;
  sourceUrl?: string;
  activityType: string;
  title: string;
  description?: string;
  team: Team;
  performedByName?: string;
  performedByEmail?: string;
  contactName?: string;
  contactEmail?: string;
  activityDate: string;
  isPlanned: boolean;
  status?: string;
  outcome?: string;
}

interface TeamMember {
  id: string;
  name: string;
  team: Team;
  role: string;
  externalEmail?: string;
  isActive: boolean;
}

interface Conflict {
  id: string;
  conflictType: string;
  severity: ConflictSeverity;
  description: string;
  activities: string[];
  detectedAt: string;
  resolvedAt?: string;
}

interface CoordinationRequest {
  id: string;
  requestType: 'hold_off' | 'alignment_call' | 'context_share';
  targetTeam?: Team;
  reason: string;
  status: string;
  createdAt: string;
}

interface TimelineData {
  activities: Activity[];
  total: number;
  hasMore: boolean;
  teamBreakdown: Record<Team, number>;
  sourceBreakdown: Record<SourceSystem, number>;
  plannedCount: number;
  completedCount: number;
}

interface TeamData {
  members: TeamMember[];
  teamBreakdown: Record<Team, TeamMember[]>;
  totalActive: number;
}

interface ConflictData {
  conflicts: Conflict[];
  unresolvedCount: number;
  bySeverity: Record<ConflictSeverity, number>;
}

// ============================================
// Constants
// ============================================

const TEAM_COLORS: Record<Team, string> = {
  sales: 'bg-blue-500',
  support: 'bg-orange-500',
  product: 'bg-purple-500',
  engineering: 'bg-green-500',
  cs: 'bg-cscx-accent',
  executive: 'bg-yellow-500',
};

const TEAM_LABELS: Record<Team, string> = {
  sales: 'Sales',
  support: 'Support',
  product: 'Product',
  engineering: 'Engineering',
  cs: 'Customer Success',
  executive: 'Executive',
};

const SOURCE_ICONS: Record<SourceSystem, string> = {
  salesforce: 'SF',
  zendesk: 'ZD',
  jira: 'JR',
  slack: 'SL',
  cscx: 'CS',
  hubspot: 'HS',
  intercom: 'IC',
};

// ============================================
// Props
// ============================================

interface CrossFunctionalTimelineProps {
  customerId: string;
  customerName?: string;
  onClose?: () => void;
}

// ============================================
// Component
// ============================================

export function CrossFunctionalTimeline({
  customerId,
  customerName,
  onClose,
}: CrossFunctionalTimelineProps) {
  // State
  const [activeTab, setActiveTab] = useState<'timeline' | 'team' | 'conflicts' | 'coordinate'>('timeline');
  const [timeline, setTimeline] = useState<TimelineData | null>(null);
  const [team, setTeam] = useState<TeamData | null>(null);
  const [conflicts, setConflicts] = useState<ConflictData | null>(null);
  const [coordinationRequests, setCoordinationRequests] = useState<CoordinationRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filters
  const [selectedTeams, setSelectedTeams] = useState<Team[]>([]);
  const [showPlanned, setShowPlanned] = useState(true);
  const [dateRange, setDateRange] = useState<'7d' | '30d' | '90d' | 'all'>('30d');

  // New request modal
  const [showNewRequest, setShowNewRequest] = useState(false);
  const [newRequestType, setNewRequestType] = useState<'hold_off' | 'alignment_call' | 'context_share'>('hold_off');
  const [newRequestReason, setNewRequestReason] = useState('');
  const [newRequestTeam, setNewRequestTeam] = useState<Team | ''>('');

  // ============================================
  // Data Fetching
  // ============================================

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const baseUrl = '/api/cross-functional';

      // Build query params for activities
      const params = new URLSearchParams();
      if (selectedTeams.length > 0) {
        params.set('teams', selectedTeams.join(','));
      }
      if (!showPlanned) {
        params.set('isPlanned', 'false');
      }
      if (dateRange !== 'all') {
        const days = dateRange === '7d' ? 7 : dateRange === '30d' ? 30 : 90;
        const startDate = new Date();
        startDate.setDate(startDate.getDate() - days);
        params.set('startDate', startDate.toISOString());
      }
      params.set('limit', '100');

      // Fetch all data in parallel
      const [activitiesRes, teamRes, conflictsRes, requestsRes] = await Promise.all([
        fetch(`${baseUrl}/customers/${customerId}/activities?${params}`),
        fetch(`${baseUrl}/customers/${customerId}/team`),
        fetch(`${baseUrl}/customers/${customerId}/conflicts`),
        fetch(`${baseUrl}/coordination-requests?customerId=${customerId}`),
      ]);

      // Process responses
      if (activitiesRes.ok) {
        const data = await activitiesRes.json();
        if (data.success) setTimeline(data.data);
      }

      if (teamRes.ok) {
        const data = await teamRes.json();
        if (data.success) setTeam(data.data);
      }

      if (conflictsRes.ok) {
        const data = await conflictsRes.json();
        if (data.success) setConflicts(data.data);
      }

      if (requestsRes.ok) {
        const data = await requestsRes.json();
        if (data.success) setCoordinationRequests(data.data.requests || []);
      }
    } catch (err) {
      console.error('Error fetching cross-functional data:', err);
      setError('Failed to load cross-functional data');
    } finally {
      setLoading(false);
    }
  }, [customerId, selectedTeams, showPlanned, dateRange]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // ============================================
  // Actions
  // ============================================

  const handleRunConflictDetection = async () => {
    try {
      const res = await fetch(`/api/cross-functional/customers/${customerId}/conflicts/detect`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ lookbackDays: 7 }),
      });

      if (res.ok) {
        // Refresh conflicts
        const conflictsRes = await fetch(`/api/cross-functional/customers/${customerId}/conflicts`);
        if (conflictsRes.ok) {
          const data = await conflictsRes.json();
          if (data.success) setConflicts(data.data);
        }
      }
    } catch (err) {
      console.error('Error running conflict detection:', err);
    }
  };

  const handleResolveConflict = async (conflictId: string, notes?: string) => {
    try {
      const res = await fetch(`/api/cross-functional/conflicts/${conflictId}/resolve`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ resolutionNotes: notes }),
      });

      if (res.ok) {
        // Refresh conflicts
        fetchData();
      }
    } catch (err) {
      console.error('Error resolving conflict:', err);
    }
  };

  const handleCreateCoordinationRequest = async () => {
    if (!newRequestReason.trim()) return;

    try {
      const res = await fetch('/api/cross-functional/coordination-requests', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          customerId,
          requestType: newRequestType,
          targetTeam: newRequestTeam || undefined,
          reason: newRequestReason,
        }),
      });

      if (res.ok) {
        setShowNewRequest(false);
        setNewRequestReason('');
        setNewRequestTeam('');
        fetchData();
      }
    } catch (err) {
      console.error('Error creating coordination request:', err);
    }
  };

  const toggleTeamFilter = (team: Team) => {
    setSelectedTeams(prev =>
      prev.includes(team)
        ? prev.filter(t => t !== team)
        : [...prev, team]
    );
  };

  // ============================================
  // Render Helpers
  // ============================================

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: date.getFullYear() !== new Date().getFullYear() ? 'numeric' : undefined,
    });
  };

  const formatTime = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
    });
  };

  // ============================================
  // Render
  // ============================================

  if (loading) {
    return (
      <div className="bg-cscx-gray-800 rounded-lg border border-gray-700 p-6">
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-cscx-accent" />
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-cscx-gray-800 rounded-lg border border-gray-700 p-6">
        <div className="text-red-400 text-center">{error}</div>
      </div>
    );
  }

  return (
    <div className="bg-cscx-gray-800 rounded-lg border border-gray-700">
      {/* Header */}
      <div className="p-4 border-b border-gray-700">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold text-white">
              Cross-Functional Alignment
            </h2>
            {customerName && (
              <p className="text-sm text-gray-400">{customerName}</p>
            )}
          </div>
          {onClose && (
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-white"
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          )}
        </div>

        {/* Tabs */}
        <div className="flex gap-1 mt-4">
          {[
            { key: 'timeline', label: 'Timeline', count: timeline?.total },
            { key: 'team', label: 'Team', count: team?.totalActive },
            { key: 'conflicts', label: 'Conflicts', count: conflicts?.unresolvedCount },
            { key: 'coordinate', label: 'Coordinate', count: coordinationRequests.filter(r => r.status === 'pending').length },
          ].map(tab => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key as typeof activeTab)}
              className={`px-3 py-1.5 rounded text-sm font-medium transition-colors ${
                activeTab === tab.key
                  ? 'bg-cscx-accent text-white'
                  : 'text-gray-400 hover:text-white hover:bg-gray-700'
              }`}
            >
              {tab.label}
              {tab.count !== undefined && tab.count > 0 && (
                <span className={`ml-1.5 px-1.5 py-0.5 rounded-full text-xs ${
                  activeTab === tab.key ? 'bg-white/20' : 'bg-gray-600'
                }`}>
                  {tab.count}
                </span>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* Content */}
      <div className="p-4">
        {/* Timeline Tab */}
        {activeTab === 'timeline' && (
          <div>
            {/* Filters */}
            <div className="flex flex-wrap gap-2 mb-4">
              {/* Team filters */}
              <div className="flex gap-1">
                {(Object.keys(TEAM_LABELS) as Team[]).map(team => (
                  <button
                    key={team}
                    onClick={() => toggleTeamFilter(team)}
                    className={`px-2 py-1 rounded text-xs font-medium transition-colors ${
                      selectedTeams.length === 0 || selectedTeams.includes(team)
                        ? `${TEAM_COLORS[team]} text-white`
                        : 'bg-gray-700 text-gray-400'
                    }`}
                  >
                    {TEAM_LABELS[team]}
                    {timeline?.teamBreakdown[team] ? ` (${timeline.teamBreakdown[team]})` : ''}
                  </button>
                ))}
              </div>

              <div className="flex gap-2 ml-auto">
                {/* Date range */}
                <select
                  value={dateRange}
                  onChange={(e) => setDateRange(e.target.value as typeof dateRange)}
                  className="bg-gray-700 border border-gray-600 rounded px-2 py-1 text-sm text-white"
                >
                  <option value="7d">Last 7 days</option>
                  <option value="30d">Last 30 days</option>
                  <option value="90d">Last 90 days</option>
                  <option value="all">All time</option>
                </select>

                {/* Show planned toggle */}
                <label className="flex items-center gap-2 text-sm text-gray-400">
                  <input
                    type="checkbox"
                    checked={showPlanned}
                    onChange={(e) => setShowPlanned(e.target.checked)}
                    className="rounded bg-gray-700 border-gray-600"
                  />
                  Show planned
                </label>
              </div>
            </div>

            {/* Activity list */}
            <div className="space-y-3 max-h-96 overflow-y-auto">
              {timeline?.activities.length === 0 ? (
                <div className="text-center text-gray-400 py-8">
                  No activities found
                </div>
              ) : (
                timeline?.activities.map(activity => (
                  <div
                    key={activity.id}
                    className="flex gap-3 p-3 bg-gray-700/50 rounded-lg hover:bg-gray-700 transition-colors"
                  >
                    {/* Team indicator */}
                    <div className={`w-1 rounded-full ${TEAM_COLORS[activity.team]}`} />

                    {/* Content */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <div className="flex items-center gap-2">
                            <span className={`px-1.5 py-0.5 rounded text-xs ${TEAM_COLORS[activity.team]} text-white`}>
                              {TEAM_LABELS[activity.team]}
                            </span>
                            <span className="px-1.5 py-0.5 rounded text-xs bg-gray-600 text-gray-300">
                              {SOURCE_ICONS[activity.sourceSystem]}
                            </span>
                            {activity.isPlanned && (
                              <span className="px-1.5 py-0.5 rounded text-xs bg-blue-500/20 text-blue-400">
                                Planned
                              </span>
                            )}
                          </div>
                          <h4 className="text-white font-medium mt-1 truncate">
                            {activity.title}
                          </h4>
                          {activity.description && (
                            <p className="text-gray-400 text-sm mt-0.5 line-clamp-2">
                              {activity.description}
                            </p>
                          )}
                        </div>
                        <div className="text-right text-sm text-gray-400 whitespace-nowrap">
                          <div>{formatDate(activity.activityDate)}</div>
                          <div className="text-xs">{formatTime(activity.activityDate)}</div>
                        </div>
                      </div>

                      {/* Metadata */}
                      <div className="flex items-center gap-4 mt-2 text-xs text-gray-500">
                        {activity.performedByName && (
                          <span>By: {activity.performedByName}</span>
                        )}
                        {activity.contactName && (
                          <span>Contact: {activity.contactName}</span>
                        )}
                        {activity.sourceUrl && (
                          <a
                            href={activity.sourceUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-cscx-accent hover:underline"
                          >
                            View in {activity.sourceSystem}
                          </a>
                        )}
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>

            {timeline?.hasMore && (
              <div className="text-center mt-4">
                <button className="text-cscx-accent hover:underline text-sm">
                  Load more activities
                </button>
              </div>
            )}
          </div>
        )}

        {/* Team Tab */}
        {activeTab === 'team' && (
          <div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {(Object.keys(TEAM_LABELS) as Team[]).map(teamKey => {
                const members = team?.teamBreakdown[teamKey] || [];
                if (members.length === 0) return null;

                return (
                  <div key={teamKey} className="bg-gray-700/50 rounded-lg p-3">
                    <div className="flex items-center gap-2 mb-2">
                      <div className={`w-2 h-2 rounded-full ${TEAM_COLORS[teamKey]}`} />
                      <h4 className="font-medium text-white">{TEAM_LABELS[teamKey]}</h4>
                      <span className="text-gray-400 text-sm">({members.length})</span>
                    </div>
                    <div className="space-y-2">
                      {members.map(member => (
                        <div
                          key={member.id}
                          className={`p-2 rounded ${member.isActive ? 'bg-gray-700' : 'bg-gray-800 opacity-60'}`}
                        >
                          <div className="font-medium text-white text-sm">{member.name}</div>
                          <div className="text-gray-400 text-xs">{member.role}</div>
                          {member.externalEmail && (
                            <div className="text-gray-500 text-xs truncate">{member.externalEmail}</div>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>

            {team?.members.length === 0 && (
              <div className="text-center text-gray-400 py-8">
                No team members assigned to this account
              </div>
            )}
          </div>
        )}

        {/* Conflicts Tab */}
        {activeTab === 'conflicts' && (
          <div>
            <div className="flex justify-between items-center mb-4">
              <div className="flex gap-4 text-sm">
                {conflicts?.bySeverity && (
                  <>
                    {conflicts.bySeverity.critical > 0 && (
                      <span className="text-red-400">
                        Critical: {conflicts.bySeverity.critical}
                      </span>
                    )}
                    {conflicts.bySeverity.warning > 0 && (
                      <span className="text-yellow-400">
                        Warning: {conflicts.bySeverity.warning}
                      </span>
                    )}
                    {conflicts.bySeverity.info > 0 && (
                      <span className="text-blue-400">
                        Info: {conflicts.bySeverity.info}
                      </span>
                    )}
                  </>
                )}
              </div>
              <button
                onClick={handleRunConflictDetection}
                className="px-3 py-1.5 bg-cscx-accent text-white rounded text-sm hover:bg-cscx-accent/80"
              >
                Run Detection
              </button>
            </div>

            <div className="space-y-3">
              {conflicts?.conflicts.length === 0 ? (
                <div className="text-center text-gray-400 py-8">
                  No conflicts detected
                </div>
              ) : (
                conflicts?.conflicts.map(conflict => (
                  <div
                    key={conflict.id}
                    className={`p-3 rounded-lg border ${
                      conflict.severity === 'critical'
                        ? 'border-red-500/50 bg-red-500/10'
                        : conflict.severity === 'warning'
                        ? 'border-yellow-500/50 bg-yellow-500/10'
                        : 'border-blue-500/50 bg-blue-500/10'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className={`px-2 py-0.5 rounded text-xs font-medium ${
                            conflict.severity === 'critical'
                              ? 'bg-red-500 text-white'
                              : conflict.severity === 'warning'
                              ? 'bg-yellow-500 text-black'
                              : 'bg-blue-500 text-white'
                          }`}>
                            {conflict.severity.toUpperCase()}
                          </span>
                          <span className="text-gray-400 text-xs">
                            {conflict.conflictType.replace(/_/g, ' ')}
                          </span>
                        </div>
                        <p className="text-white mt-1">{conflict.description}</p>
                        <div className="text-gray-500 text-xs mt-1">
                          Detected: {formatDate(conflict.detectedAt)}
                        </div>
                      </div>
                      {!conflict.resolvedAt && (
                        <button
                          onClick={() => handleResolveConflict(conflict.id)}
                          className="px-2 py-1 text-xs bg-gray-600 text-white rounded hover:bg-gray-500"
                        >
                          Resolve
                        </button>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        )}

        {/* Coordinate Tab */}
        {activeTab === 'coordinate' && (
          <div>
            <div className="flex justify-between items-center mb-4">
              <h3 className="font-medium text-white">Coordination Requests</h3>
              <button
                onClick={() => setShowNewRequest(true)}
                className="px-3 py-1.5 bg-cscx-accent text-white rounded text-sm hover:bg-cscx-accent/80"
              >
                New Request
              </button>
            </div>

            {/* New request form */}
            {showNewRequest && (
              <div className="p-4 bg-gray-700 rounded-lg mb-4">
                <h4 className="font-medium text-white mb-3">Create Coordination Request</h4>
                <div className="space-y-3">
                  <div>
                    <label className="block text-sm text-gray-400 mb-1">Request Type</label>
                    <select
                      value={newRequestType}
                      onChange={(e) => setNewRequestType(e.target.value as typeof newRequestType)}
                      className="w-full bg-gray-600 border border-gray-500 rounded px-3 py-2 text-white"
                    >
                      <option value="hold_off">Hold Off Request</option>
                      <option value="alignment_call">Schedule Alignment Call</option>
                      <option value="context_share">Share Context</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm text-gray-400 mb-1">Target Team (optional)</label>
                    <select
                      value={newRequestTeam}
                      onChange={(e) => setNewRequestTeam(e.target.value as Team | '')}
                      className="w-full bg-gray-600 border border-gray-500 rounded px-3 py-2 text-white"
                    >
                      <option value="">All Teams</option>
                      {(Object.keys(TEAM_LABELS) as Team[]).map(team => (
                        <option key={team} value={team}>{TEAM_LABELS[team]}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm text-gray-400 mb-1">Reason</label>
                    <textarea
                      value={newRequestReason}
                      onChange={(e) => setNewRequestReason(e.target.value)}
                      placeholder="Explain why this coordination is needed..."
                      className="w-full bg-gray-600 border border-gray-500 rounded px-3 py-2 text-white min-h-[80px]"
                    />
                  </div>
                  <div className="flex gap-2 justify-end">
                    <button
                      onClick={() => setShowNewRequest(false)}
                      className="px-3 py-1.5 text-gray-400 hover:text-white"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={handleCreateCoordinationRequest}
                      disabled={!newRequestReason.trim()}
                      className="px-3 py-1.5 bg-cscx-accent text-white rounded hover:bg-cscx-accent/80 disabled:opacity-50"
                    >
                      Create Request
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* Request list */}
            <div className="space-y-3">
              {coordinationRequests.length === 0 ? (
                <div className="text-center text-gray-400 py-8">
                  No coordination requests
                </div>
              ) : (
                coordinationRequests.map(request => (
                  <div
                    key={request.id}
                    className="p-3 bg-gray-700/50 rounded-lg"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className={`px-2 py-0.5 rounded text-xs font-medium ${
                            request.requestType === 'hold_off'
                              ? 'bg-orange-500 text-white'
                              : request.requestType === 'alignment_call'
                              ? 'bg-blue-500 text-white'
                              : 'bg-green-500 text-white'
                          }`}>
                            {request.requestType.replace(/_/g, ' ')}
                          </span>
                          {request.targetTeam && (
                            <span className={`px-2 py-0.5 rounded text-xs ${TEAM_COLORS[request.targetTeam]} text-white`}>
                              {TEAM_LABELS[request.targetTeam]}
                            </span>
                          )}
                          <span className={`px-2 py-0.5 rounded text-xs ${
                            request.status === 'pending'
                              ? 'bg-yellow-500/20 text-yellow-400'
                              : request.status === 'acknowledged'
                              ? 'bg-blue-500/20 text-blue-400'
                              : request.status === 'completed'
                              ? 'bg-green-500/20 text-green-400'
                              : 'bg-gray-500/20 text-gray-400'
                          }`}>
                            {request.status}
                          </span>
                        </div>
                        <p className="text-white mt-1">{request.reason}</p>
                        <div className="text-gray-500 text-xs mt-1">
                          Created: {formatDate(request.createdAt)}
                        </div>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default CrossFunctionalTimeline;
