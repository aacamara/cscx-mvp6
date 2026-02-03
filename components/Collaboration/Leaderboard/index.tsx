/**
 * Leaderboard Component
 * PRD-260: Team Goal Tracking - Leaderboard UI
 *
 * Features:
 * - Ranked list of team members
 * - Progress visualization
 * - Rank change indicators
 * - Achievement badges
 * - Period selector
 * - Goal progress cards
 */

import React, { useState, useEffect, useCallback } from 'react';
import {
  LeaderboardResponse,
  LeaderboardEntry,
  GoalPeriod,
  GoalDashboardResponse,
  GoalStatus,
  BADGE_DEFINITIONS,
  BadgeType
} from '../../../types/leaderboard';

const API_BASE = `${import.meta.env.VITE_API_URL || ''}/api`;

// ============================================
// HELPER FUNCTIONS
// ============================================

const formatNumber = (num: number, decimals = 1): string => {
  if (num >= 1000000) return `${(num / 1000000).toFixed(decimals)}M`;
  if (num >= 1000) return `${(num / 1000).toFixed(decimals)}K`;
  return num.toFixed(decimals);
};

const getStatusColor = (status: GoalStatus): string => {
  switch (status) {
    case 'exceeded': return 'text-purple-400';
    case 'achieved': return 'text-green-400';
    case 'on_track': return 'text-blue-400';
    case 'at_risk': return 'text-yellow-400';
    case 'behind': return 'text-red-400';
    case 'not_started': return 'text-gray-400';
    default: return 'text-gray-400';
  }
};

const getStatusBgColor = (status: GoalStatus): string => {
  switch (status) {
    case 'exceeded': return 'bg-purple-500/20';
    case 'achieved': return 'bg-green-500/20';
    case 'on_track': return 'bg-blue-500/20';
    case 'at_risk': return 'bg-yellow-500/20';
    case 'behind': return 'bg-red-500/20';
    case 'not_started': return 'bg-gray-500/20';
    default: return 'bg-gray-500/20';
  }
};

const getRankChangeColor = (change: number): string => {
  if (change > 0) return 'text-green-400';
  if (change < 0) return 'text-red-400';
  return 'text-gray-400';
};

const getRankChangeIcon = (change: number): string => {
  if (change > 0) return '\u2191';
  if (change < 0) return '\u2193';
  return '-';
};

const getMedalEmoji = (rank: number): string | null => {
  if (rank === 1) return '\uD83E\uDD47';
  if (rank === 2) return '\uD83E\uDD48';
  if (rank === 3) return '\uD83E\uDD49';
  return null;
};

// ============================================
// SUB-COMPONENTS
// ============================================

interface LeaderboardEntryRowProps {
  entry: LeaderboardEntry;
  isCurrentUser?: boolean;
  showDetails?: boolean;
  onViewProfile?: (userId: string) => void;
}

const LeaderboardEntryRow: React.FC<LeaderboardEntryRowProps> = ({
  entry,
  isCurrentUser,
  showDetails,
  onViewProfile
}) => {
  const medal = getMedalEmoji(entry.rank);

  return (
    <div
      className={`flex items-center gap-4 p-4 rounded-lg transition-colors ${
        isCurrentUser
          ? 'bg-cscx-accent/10 border border-cscx-accent/30'
          : 'bg-cscx-gray-800/50 hover:bg-cscx-gray-800'
      }`}
    >
      {/* Rank */}
      <div className="w-12 flex-shrink-0 text-center">
        {medal ? (
          <span className="text-2xl">{medal}</span>
        ) : (
          <span className="text-xl font-bold text-cscx-gray-400">#{entry.rank}</span>
        )}
      </div>

      {/* Avatar */}
      <div className="w-10 h-10 flex-shrink-0">
        {entry.user_avatar_url ? (
          <img
            src={entry.user_avatar_url}
            alt={entry.user_name || 'User'}
            className="w-10 h-10 rounded-full"
          />
        ) : (
          <div className="w-10 h-10 rounded-full bg-cscx-gray-700 flex items-center justify-center">
            <span className="text-cscx-gray-400 text-lg">
              {entry.user_name?.charAt(0) || '?'}
            </span>
          </div>
        )}
      </div>

      {/* User Info */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span
            className={`font-medium truncate ${
              isCurrentUser ? 'text-cscx-accent' : 'text-white'
            }`}
          >
            {entry.user_name || 'Unknown User'}
          </span>
          {isCurrentUser && (
            <span className="text-xs px-2 py-0.5 rounded bg-cscx-accent/20 text-cscx-accent">
              You
            </span>
          )}
        </div>
        <div className="text-sm text-cscx-gray-400 truncate">
          {entry.user_title || 'CSM'}
        </div>
      </div>

      {/* Score */}
      <div className="text-right flex-shrink-0">
        <div className="text-lg font-bold text-white">
          {formatNumber(entry.total_score, 0)}
        </div>
        <div className="text-xs text-cscx-gray-400">
          {entry.goals_achieved}/{entry.goals_total} goals
        </div>
      </div>

      {/* Rank Change */}
      <div className="w-12 flex-shrink-0 text-center">
        <span className={`text-lg font-medium ${getRankChangeColor(entry.rank_change)}`}>
          {getRankChangeIcon(entry.rank_change)}
          {Math.abs(entry.rank_change) > 0 && Math.abs(entry.rank_change)}
        </span>
      </div>

      {/* Progress Bar */}
      <div className="w-24 flex-shrink-0">
        <div className="h-2 bg-cscx-gray-700 rounded-full overflow-hidden">
          <div
            className="h-full bg-cscx-accent rounded-full transition-all"
            style={{ width: `${Math.min(100, entry.achievement_rate)}%` }}
          />
        </div>
        <div className="text-xs text-cscx-gray-400 text-center mt-1">
          {entry.achievement_rate.toFixed(0)}%
        </div>
      </div>

      {/* Actions */}
      {onViewProfile && (
        <button
          onClick={() => onViewProfile(entry.user_id)}
          className="p-2 text-cscx-gray-400 hover:text-white transition-colors"
          title="View Profile"
        >
          <svg
            className="w-5 h-5"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M9 5l7 7-7 7"
            />
          </svg>
        </button>
      )}
    </div>
  );
};

interface PeriodSelectorProps {
  periods: GoalPeriod[];
  selectedPeriod: string | null;
  onSelectPeriod: (periodId: string) => void;
}

const PeriodSelector: React.FC<PeriodSelectorProps> = ({
  periods,
  selectedPeriod,
  onSelectPeriod
}) => {
  return (
    <div className="flex gap-2 overflow-x-auto pb-2">
      {periods.map((period) => (
        <button
          key={period.id}
          onClick={() => onSelectPeriod(period.id)}
          className={`px-4 py-2 rounded-lg whitespace-nowrap transition-colors ${
            selectedPeriod === period.id
              ? 'bg-cscx-accent text-white'
              : 'bg-cscx-gray-800 text-cscx-gray-300 hover:bg-cscx-gray-700'
          }`}
        >
          {period.name}
        </button>
      ))}
    </div>
  );
};

interface ProgressSummaryCardProps {
  summary: GoalDashboardResponse['progress_summary'];
}

const ProgressSummaryCard: React.FC<ProgressSummaryCardProps> = ({ summary }) => {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
      <div className="bg-cscx-gray-800/50 rounded-lg p-4">
        <div className="text-sm text-cscx-gray-400">Total Goals</div>
        <div className="text-2xl font-bold text-white">{summary.total_goals}</div>
      </div>
      <div className="bg-green-500/10 rounded-lg p-4">
        <div className="text-sm text-green-400">Achieved</div>
        <div className="text-2xl font-bold text-green-400">{summary.achieved}</div>
      </div>
      <div className="bg-blue-500/10 rounded-lg p-4">
        <div className="text-sm text-blue-400">On Track</div>
        <div className="text-2xl font-bold text-blue-400">{summary.on_track}</div>
      </div>
      <div className="bg-yellow-500/10 rounded-lg p-4">
        <div className="text-sm text-yellow-400">At Risk</div>
        <div className="text-2xl font-bold text-yellow-400">{summary.at_risk}</div>
      </div>
      <div className="bg-red-500/10 rounded-lg p-4">
        <div className="text-sm text-red-400">Behind</div>
        <div className="text-2xl font-bold text-red-400">{summary.behind}</div>
      </div>
      <div className="bg-cscx-accent/10 rounded-lg p-4">
        <div className="text-sm text-cscx-gray-400">Avg Progress</div>
        <div className="text-2xl font-bold text-cscx-accent">
          {summary.average_progress.toFixed(0)}%
        </div>
      </div>
    </div>
  );
};

interface BadgeDisplayProps {
  badges: BadgeType[];
}

const BadgeDisplay: React.FC<BadgeDisplayProps> = ({ badges }) => {
  if (badges.length === 0) return null;

  return (
    <div className="flex gap-2 flex-wrap">
      {badges.map((badgeType) => {
        const badge = BADGE_DEFINITIONS[badgeType];
        return (
          <div
            key={badgeType}
            className="flex items-center gap-1 px-2 py-1 bg-cscx-gray-800 rounded-full text-xs"
            title={badge.description}
          >
            <span>{badge.label}</span>
          </div>
        );
      })}
    </div>
  );
};

// ============================================
// MAIN COMPONENT
// ============================================

interface LeaderboardProps {
  userId?: string;
  onViewProfile?: (userId: string) => void;
  className?: string;
}

export const Leaderboard: React.FC<LeaderboardProps> = ({
  userId = 'demo-user',
  onViewProfile,
  className = ''
}) => {
  // State
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [leaderboard, setLeaderboard] = useState<LeaderboardResponse | null>(null);
  const [dashboard, setDashboard] = useState<GoalDashboardResponse | null>(null);
  const [periods, setPeriods] = useState<GoalPeriod[]>([]);
  const [selectedPeriod, setSelectedPeriod] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'leaderboard' | 'my-goals'>('leaderboard');

  // Fetch periods
  const fetchPeriods = useCallback(async () => {
    try {
      const response = await fetch(`${API_BASE}/leaderboard/periods?status=active`);
      if (!response.ok) throw new Error('Failed to fetch periods');

      const result = await response.json();
      if (result.success && result.data) {
        setPeriods(result.data);
        if (result.data.length > 0 && !selectedPeriod) {
          setSelectedPeriod(result.data[0].id);
        }
      }
    } catch (err) {
      console.error('Failed to fetch periods:', err);
    }
  }, [selectedPeriod]);

  // Fetch leaderboard
  const fetchLeaderboard = useCallback(async () => {
    if (!selectedPeriod) return;

    setLoading(true);
    try {
      const response = await fetch(
        `${API_BASE}/leaderboard?period_id=${selectedPeriod}&limit=20`
      );
      if (!response.ok) throw new Error('Failed to fetch leaderboard');

      const result = await response.json();
      if (result.success && result.data) {
        setLeaderboard(result.data);
      }
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load leaderboard');
    } finally {
      setLoading(false);
    }
  }, [selectedPeriod]);

  // Fetch dashboard
  const fetchDashboard = useCallback(async () => {
    if (!selectedPeriod) return;

    try {
      const response = await fetch(
        `${API_BASE}/leaderboard/dashboard?user_id=${userId}&period_id=${selectedPeriod}`
      );
      if (!response.ok) throw new Error('Failed to fetch dashboard');

      const result = await response.json();
      if (result.success && result.data) {
        setDashboard(result.data);
      }
    } catch (err) {
      console.error('Failed to fetch dashboard:', err);
    }
  }, [selectedPeriod, userId]);

  // Effects
  useEffect(() => {
    fetchPeriods();
  }, [fetchPeriods]);

  useEffect(() => {
    if (selectedPeriod) {
      fetchLeaderboard();
      fetchDashboard();
    }
  }, [selectedPeriod, fetchLeaderboard, fetchDashboard]);

  // Loading state
  if (loading && !leaderboard) {
    return (
      <div className={`p-8 text-center text-cscx-gray-400 ${className}`}>
        <div className="animate-spin w-8 h-8 border-2 border-cscx-accent border-t-transparent rounded-full mx-auto mb-2" />
        Loading leaderboard...
      </div>
    );
  }

  // Error state
  if (error && !leaderboard) {
    return (
      <div className={`p-8 text-center text-red-400 ${className}`}>
        {error}
        <button
          onClick={fetchLeaderboard}
          className="block mx-auto mt-2 text-sm text-cscx-accent hover:underline"
        >
          Retry
        </button>
      </div>
    );
  }

  return (
    <div className={`space-y-6 ${className}`}>
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-white">Team Leaderboard</h2>
          <p className="text-cscx-gray-400 text-sm">
            Track team performance and goal progress
          </p>
        </div>
        {leaderboard && (
          <div className="flex items-center gap-2 text-sm text-cscx-gray-400">
            <div className="w-2 h-2 rounded-full bg-green-500" />
            Updated {new Date(leaderboard.last_updated).toLocaleTimeString()}
          </div>
        )}
      </div>

      {/* Period Selector */}
      {periods.length > 0 && (
        <PeriodSelector
          periods={periods}
          selectedPeriod={selectedPeriod}
          onSelectPeriod={setSelectedPeriod}
        />
      )}

      {/* Period Progress */}
      {leaderboard && (
        <div className="bg-cscx-gray-800/50 rounded-lg p-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm text-cscx-gray-400">Period Progress</span>
            <span className="text-sm text-white">
              {leaderboard.period_progress.toFixed(0)}% complete
            </span>
          </div>
          <div className="h-2 bg-cscx-gray-700 rounded-full overflow-hidden">
            <div
              className="h-full bg-cscx-accent rounded-full transition-all"
              style={{ width: `${leaderboard.period_progress}%` }}
            />
          </div>
        </div>
      )}

      {/* Tabs */}
      <div className="flex border-b border-cscx-gray-700">
        <button
          onClick={() => setActiveTab('leaderboard')}
          className={`px-4 py-2 text-sm font-medium transition-colors relative ${
            activeTab === 'leaderboard'
              ? 'text-cscx-accent'
              : 'text-cscx-gray-400 hover:text-white'
          }`}
        >
          Leaderboard
          {activeTab === 'leaderboard' && (
            <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-cscx-accent" />
          )}
        </button>
        <button
          onClick={() => setActiveTab('my-goals')}
          className={`px-4 py-2 text-sm font-medium transition-colors relative ${
            activeTab === 'my-goals'
              ? 'text-cscx-accent'
              : 'text-cscx-gray-400 hover:text-white'
          }`}
        >
          My Goals
          {activeTab === 'my-goals' && (
            <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-cscx-accent" />
          )}
        </button>
      </div>

      {/* Leaderboard Tab */}
      {activeTab === 'leaderboard' && leaderboard && (
        <div className="space-y-2">
          {leaderboard.entries.length === 0 ? (
            <div className="text-center py-8 text-cscx-gray-400">
              No leaderboard data available for this period.
            </div>
          ) : (
            leaderboard.entries.map((entry) => (
              <LeaderboardEntryRow
                key={entry.id}
                entry={entry}
                isCurrentUser={entry.user_id === userId}
                onViewProfile={onViewProfile}
              />
            ))
          )}
        </div>
      )}

      {/* My Goals Tab */}
      {activeTab === 'my-goals' && dashboard && (
        <div className="space-y-6">
          {/* Progress Summary */}
          <ProgressSummaryCard summary={dashboard.progress_summary} />

          {/* Individual Goals */}
          <div>
            <h3 className="text-lg font-semibold text-white mb-4">My Goals</h3>
            {dashboard.individual_goals.length === 0 ? (
              <div className="text-center py-8 text-cscx-gray-400">
                No goals set for this period.
              </div>
            ) : (
              <div className="space-y-3">
                {dashboard.individual_goals.map((goal) => (
                  <div
                    key={goal.id}
                    className="bg-cscx-gray-800/50 rounded-lg p-4"
                  >
                    <div className="flex items-start justify-between mb-2">
                      <div>
                        <h4 className="font-medium text-white">{goal.name}</h4>
                        {goal.description && (
                          <p className="text-sm text-cscx-gray-400 mt-1">
                            {goal.description}
                          </p>
                        )}
                      </div>
                      <span
                        className={`px-2 py-1 rounded text-xs ${getStatusBgColor(
                          goal.status
                        )} ${getStatusColor(goal.status)}`}
                      >
                        {goal.status.replace('_', ' ')}
                      </span>
                    </div>

                    {/* Progress Bar */}
                    <div className="mt-3">
                      <div className="flex items-center justify-between text-sm mb-1">
                        <span className="text-cscx-gray-400">
                          Current: {formatNumber(goal.current_value)}
                        </span>
                        <span className="text-cscx-gray-400">
                          Target: {formatNumber(goal.target_value)}
                        </span>
                      </div>
                      <div className="h-2 bg-cscx-gray-700 rounded-full overflow-hidden">
                        <div
                          className={`h-full rounded-full transition-all ${
                            goal.status === 'achieved' || goal.status === 'exceeded'
                              ? 'bg-green-500'
                              : goal.status === 'on_track'
                              ? 'bg-blue-500'
                              : goal.status === 'at_risk'
                              ? 'bg-yellow-500'
                              : goal.status === 'behind'
                              ? 'bg-red-500'
                              : 'bg-cscx-gray-500'
                          }`}
                          style={{
                            width: `${Math.min(100, goal.progress_percentage)}%`
                          }}
                        />
                      </div>
                      <div className="text-right text-sm text-cscx-gray-400 mt-1">
                        {goal.progress_percentage.toFixed(0)}%
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Recent Achievements */}
          {dashboard.recent_achievements.length > 0 && (
            <div>
              <h3 className="text-lg font-semibold text-white mb-4">
                Recent Achievements
              </h3>
              <div className="space-y-2">
                {dashboard.recent_achievements.map((achievement) => (
                  <div
                    key={achievement.id}
                    className="flex items-center gap-3 bg-cscx-gray-800/50 rounded-lg p-3"
                  >
                    <div className="w-10 h-10 rounded-full bg-cscx-accent/20 flex items-center justify-center">
                      {achievement.achievement_type === 'achieved' && (
                        <span className="text-xl">&#10004;</span>
                      )}
                      {achievement.achievement_type === 'exceeded' && (
                        <span className="text-xl">&#9733;</span>
                      )}
                      {achievement.achievement_type === 'streak' && (
                        <span className="text-xl">&#128293;</span>
                      )}
                      {achievement.achievement_type === 'milestone' && (
                        <span className="text-xl">&#127942;</span>
                      )}
                      {achievement.achievement_type === 'first_place' && (
                        <span className="text-xl">&#127941;</span>
                      )}
                    </div>
                    <div className="flex-1">
                      <div className="font-medium text-white capitalize">
                        {achievement.achievement_type.replace('_', ' ')}
                      </div>
                      <div className="text-sm text-cscx-gray-400">
                        {new Date(achievement.achieved_at).toLocaleDateString()}
                      </div>
                    </div>
                    {!achievement.acknowledged && (
                      <span className="px-2 py-1 bg-cscx-accent/20 text-cscx-accent text-xs rounded">
                        New
                      </span>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Team Goals */}
          {dashboard.team_goals.length > 0 && (
            <div>
              <h3 className="text-lg font-semibold text-white mb-4">Team Goals</h3>
              <div className="space-y-3">
                {dashboard.team_goals.map((goal) => (
                  <div
                    key={goal.id}
                    className="bg-cscx-gray-800/50 rounded-lg p-4"
                  >
                    <div className="flex items-center justify-between mb-2">
                      <h4 className="font-medium text-white">{goal.name}</h4>
                      <span
                        className={`px-2 py-1 rounded text-xs ${getStatusBgColor(
                          goal.status
                        )} ${getStatusColor(goal.status)}`}
                      >
                        {goal.status.replace('_', ' ')}
                      </span>
                    </div>
                    <div className="h-2 bg-cscx-gray-700 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-cscx-accent rounded-full"
                        style={{
                          width: `${Math.min(100, goal.progress_percentage)}%`
                        }}
                      />
                    </div>
                    <div className="flex justify-between text-sm text-cscx-gray-400 mt-1">
                      <span>
                        {formatNumber(goal.current_value)} / {formatNumber(goal.target_value)}
                      </span>
                      <span>{goal.progress_percentage.toFixed(0)}%</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default Leaderboard;
