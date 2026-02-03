/**
 * Team Analytics Component
 * PRD-260: Team Goal Tracking
 *
 * Features:
 * - Team goal dashboard with progress visualization
 * - Individual goal tracking and contributions
 * - Leaderboard display
 * - Check-ins and achievement tracking
 * - Historical progress charts
 */

import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../../context/AuthContext';

// ============================================
// Types
// ============================================

type PeriodType = 'monthly' | 'quarterly' | 'annual';
type PeriodStatus = 'planning' | 'active' | 'completed';
type GoalType = 'metric' | 'task' | 'milestone';
type OwnerType = 'team' | 'individual';
type GoalStatus = 'on_track' | 'at_risk' | 'behind' | 'achieved' | 'exceeded';

interface GoalPeriod {
  id: string;
  name: string;
  period_type: PeriodType;
  start_date: string;
  end_date: string;
  status: PeriodStatus;
}

interface Goal {
  id: string;
  period_id: string;
  parent_goal_id?: string;
  owner_type: OwnerType;
  team_id?: string;
  user_id?: string;
  name: string;
  description?: string;
  goal_type: GoalType;
  metric_name?: string;
  baseline_value?: number;
  target_value?: number;
  stretch_target_value?: number;
  current_value?: number;
  progress_percentage: number;
  status: GoalStatus;
  is_public: boolean;
  show_in_leaderboard: boolean;
  child_goals?: Goal[];
  recent_progress?: GoalProgressPoint[];
}

interface GoalProgressPoint {
  id: string;
  goal_id: string;
  recorded_at: string;
  value: number;
  progress_percentage: number;
  status: GoalStatus;
}

interface GoalAchievement {
  id: string;
  goal_id: string;
  user_id?: string;
  achievement_type: 'achieved' | 'exceeded' | 'milestone' | 'streak';
  achievement_name?: string;
  achieved_at: string;
  acknowledged: boolean;
  celebrated: boolean;
}

interface LeaderboardEntry {
  user_id: string;
  user_name?: string;
  goals_count: number;
  achieved_count: number;
  average_progress: number;
  rank: number;
}

interface TeamDashboard {
  period: GoalPeriod;
  team_goals: Goal[];
  summary: {
    total_goals: number;
    on_track_count: number;
    at_risk_count: number;
    behind_count: number;
    achieved_count: number;
    average_progress: number;
  };
  leaderboard: LeaderboardEntry[];
  recent_achievements: GoalAchievement[];
}

interface IndividualDashboard {
  period: GoalPeriod;
  individual_goals: Goal[];
  summary: {
    total_goals: number;
    on_track_count: number;
    achieved_count: number;
    average_progress: number;
    team_contribution_percentage: number;
  };
  achievements: GoalAchievement[];
}

// ============================================
// Props
// ============================================

interface TeamAnalyticsProps {
  initialView?: 'team' | 'individual';
  periodId?: string;
  onGoalSelect?: (goalId: string) => void;
}

// ============================================
// API Base
// ============================================

const API_BASE = `${import.meta.env.VITE_API_URL || ''}/api/goals`;

// ============================================
// Component
// ============================================

export const TeamAnalytics: React.FC<TeamAnalyticsProps> = ({
  initialView = 'team',
  periodId: initialPeriodId,
  onGoalSelect,
}) => {
  const { getAuthHeaders } = useAuth();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [view, setView] = useState<'team' | 'individual'>(initialView);

  // Data state
  const [periods, setPeriods] = useState<GoalPeriod[]>([]);
  const [selectedPeriodId, setSelectedPeriodId] = useState<string | undefined>(initialPeriodId);
  const [teamDashboard, setTeamDashboard] = useState<TeamDashboard | null>(null);
  const [individualDashboard, setIndividualDashboard] = useState<IndividualDashboard | null>(null);
  const [selectedGoal, setSelectedGoal] = useState<Goal | null>(null);

  // Modal state
  const [showCreateGoalModal, setShowCreateGoalModal] = useState(false);
  const [showCheckInModal, setShowCheckInModal] = useState(false);

  // ============================================
  // Fetch Functions
  // ============================================

  const fetchPeriods = useCallback(async () => {
    try {
      const response = await fetch(`${API_BASE}/periods?status=active`, {
        headers: getAuthHeaders(),
      });
      if (!response.ok) throw new Error('Failed to fetch periods');
      const result = await response.json();
      if (result.success) {
        setPeriods(result.data);
        if (!selectedPeriodId && result.data.length > 0) {
          setSelectedPeriodId(result.data[0].id);
        }
      }
    } catch (err) {
      console.error('Error fetching periods:', err);
    }
  }, [getAuthHeaders, selectedPeriodId]);

  const fetchTeamDashboard = useCallback(async () => {
    if (!selectedPeriodId) return;
    setLoading(true);
    setError(null);

    try {
      const response = await fetch(`${API_BASE}/dashboard/team?period_id=${selectedPeriodId}`, {
        headers: getAuthHeaders(),
      });
      if (!response.ok) throw new Error('Failed to fetch team dashboard');
      const result = await response.json();
      if (result.success) {
        setTeamDashboard(result.data);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load team dashboard');
    } finally {
      setLoading(false);
    }
  }, [selectedPeriodId, getAuthHeaders]);

  const fetchIndividualDashboard = useCallback(async () => {
    if (!selectedPeriodId) return;
    setLoading(true);
    setError(null);

    try {
      const response = await fetch(`${API_BASE}/dashboard/individual?period_id=${selectedPeriodId}`, {
        headers: getAuthHeaders(),
      });
      if (!response.ok) throw new Error('Failed to fetch individual dashboard');
      const result = await response.json();
      if (result.success) {
        setIndividualDashboard(result.data);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load individual dashboard');
    } finally {
      setLoading(false);
    }
  }, [selectedPeriodId, getAuthHeaders]);

  const fetchGoalDetail = useCallback(async (goalId: string) => {
    try {
      const response = await fetch(`${API_BASE}/${goalId}`, {
        headers: getAuthHeaders(),
      });
      if (!response.ok) throw new Error('Failed to fetch goal');
      const result = await response.json();
      if (result.success) {
        setSelectedGoal(result.data);
      }
    } catch (err) {
      console.error('Error fetching goal:', err);
    }
  }, [getAuthHeaders]);

  // ============================================
  // Effects
  // ============================================

  useEffect(() => {
    fetchPeriods();
  }, [fetchPeriods]);

  useEffect(() => {
    if (selectedPeriodId) {
      if (view === 'team') {
        fetchTeamDashboard();
      } else {
        fetchIndividualDashboard();
      }
    }
  }, [view, selectedPeriodId, fetchTeamDashboard, fetchIndividualDashboard]);

  // ============================================
  // Handlers
  // ============================================

  const handleGoalClick = (goalId: string) => {
    fetchGoalDetail(goalId);
    onGoalSelect?.(goalId);
  };

  const handleRefreshGoal = async (goalId: string) => {
    try {
      await fetch(`${API_BASE}/${goalId}/refresh`, {
        method: 'POST',
        headers: getAuthHeaders(),
      });
      // Refresh dashboard
      if (view === 'team') {
        fetchTeamDashboard();
      } else {
        fetchIndividualDashboard();
      }
    } catch (err) {
      console.error('Error refreshing goal:', err);
    }
  };

  const handleAcknowledgeAchievement = async (achievementId: string) => {
    try {
      await fetch(`${API_BASE}/achievements/${achievementId}/acknowledge`, {
        method: 'POST',
        headers: getAuthHeaders(),
      });
      // Refresh dashboard
      if (view === 'team') {
        fetchTeamDashboard();
      } else {
        fetchIndividualDashboard();
      }
    } catch (err) {
      console.error('Error acknowledging achievement:', err);
    }
  };

  // ============================================
  // Helper Functions
  // ============================================

  const getStatusColor = (status: GoalStatus) => {
    switch (status) {
      case 'achieved':
      case 'exceeded':
        return 'text-green-400';
      case 'on_track':
        return 'text-blue-400';
      case 'at_risk':
        return 'text-yellow-400';
      case 'behind':
        return 'text-red-400';
      default:
        return 'text-gray-400';
    }
  };

  const getStatusBg = (status: GoalStatus) => {
    switch (status) {
      case 'achieved':
      case 'exceeded':
        return 'bg-green-500/20 border-green-500/30';
      case 'on_track':
        return 'bg-blue-500/20 border-blue-500/30';
      case 'at_risk':
        return 'bg-yellow-500/20 border-yellow-500/30';
      case 'behind':
        return 'bg-red-500/20 border-red-500/30';
      default:
        return 'bg-gray-500/20 border-gray-500/30';
    }
  };

  const getProgressBarColor = (status: GoalStatus) => {
    switch (status) {
      case 'achieved':
      case 'exceeded':
        return 'bg-green-500';
      case 'on_track':
        return 'bg-blue-500';
      case 'at_risk':
        return 'bg-yellow-500';
      case 'behind':
        return 'bg-red-500';
      default:
        return 'bg-gray-500';
    }
  };

  const formatDate = (dateStr: string) => {
    if (!dateStr) return '-';
    return new Date(dateStr).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  };

  // ============================================
  // Loading State
  // ============================================

  if (loading && !teamDashboard && !individualDashboard) {
    return (
      <div className="p-8 text-center">
        <div className="animate-spin w-8 h-8 border-2 border-cscx-accent border-t-transparent rounded-full mx-auto mb-2" />
        <p className="text-cscx-gray-400">Loading team analytics...</p>
      </div>
    );
  }

  // ============================================
  // Error State
  // ============================================

  if (error) {
    return (
      <div className="p-8 text-center text-red-400">
        <p>{error}</p>
        <button
          onClick={() => view === 'team' ? fetchTeamDashboard() : fetchIndividualDashboard()}
          className="mt-4 text-sm text-cscx-accent hover:underline"
        >
          Try again
        </button>
      </div>
    );
  }

  // ============================================
  // Goal Detail View
  // ============================================

  if (selectedGoal) {
    return (
      <div className="space-y-6">
        {/* Back Button */}
        <button
          onClick={() => setSelectedGoal(null)}
          className="text-cscx-gray-400 hover:text-white text-sm flex items-center gap-1"
        >
          &#8592; Back to Dashboard
        </button>

        {/* Goal Header */}
        <div className="bg-cscx-gray-900 border border-cscx-gray-800 rounded-xl p-6">
          <div className="flex justify-between items-start">
            <div>
              <h2 className="text-xl font-bold text-white">{selectedGoal.name}</h2>
              {selectedGoal.description && (
                <p className="text-cscx-gray-400 mt-2">{selectedGoal.description}</p>
              )}
            </div>
            <span className={`px-3 py-1 rounded-full text-sm font-medium border ${getStatusBg(selectedGoal.status)}`}>
              {selectedGoal.status.replace('_', ' ')}
            </span>
          </div>
        </div>

        {/* Progress Card */}
        <div className="bg-cscx-gray-900 border border-cscx-gray-800 rounded-xl p-6">
          <h3 className="text-lg font-semibold text-white mb-4">Progress</h3>
          <div className="flex items-center gap-4 mb-4">
            <div className="flex-1 h-4 bg-cscx-gray-800 rounded-full overflow-hidden">
              <div
                className={`h-full transition-all ${getProgressBarColor(selectedGoal.status)}`}
                style={{ width: `${Math.min(100, selectedGoal.progress_percentage)}%` }}
              />
            </div>
            <span className="text-2xl font-bold text-white">{Math.round(selectedGoal.progress_percentage)}%</span>
          </div>

          {selectedGoal.goal_type === 'metric' && (
            <div className="grid grid-cols-3 gap-4 mt-4">
              <div className="p-3 bg-cscx-gray-800/50 rounded-lg">
                <p className="text-cscx-gray-400 text-xs">Baseline</p>
                <p className="text-lg font-bold text-white">{selectedGoal.baseline_value ?? '-'}</p>
              </div>
              <div className="p-3 bg-cscx-gray-800/50 rounded-lg">
                <p className="text-cscx-gray-400 text-xs">Current</p>
                <p className="text-lg font-bold text-white">{selectedGoal.current_value ?? '-'}</p>
              </div>
              <div className="p-3 bg-cscx-gray-800/50 rounded-lg">
                <p className="text-cscx-gray-400 text-xs">Target</p>
                <p className="text-lg font-bold text-white">{selectedGoal.target_value ?? '-'}</p>
              </div>
            </div>
          )}

          <button
            onClick={() => handleRefreshGoal(selectedGoal.id)}
            className="mt-4 px-4 py-2 bg-cscx-accent text-white rounded-lg hover:bg-cscx-accent/80 transition"
          >
            Refresh Progress
          </button>
        </div>

        {/* Progress History */}
        {selectedGoal.recent_progress && selectedGoal.recent_progress.length > 0 && (
          <div className="bg-cscx-gray-900 border border-cscx-gray-800 rounded-xl p-6">
            <h3 className="text-lg font-semibold text-white mb-4">Progress History</h3>
            <div className="h-32 flex items-end gap-2">
              {selectedGoal.recent_progress.slice(0, 10).reverse().map((point, idx) => (
                <div key={idx} className="flex-1 flex flex-col items-center">
                  <div
                    className={`w-full ${getProgressBarColor(point.status)} rounded-t transition-all hover:opacity-80`}
                    style={{ height: `${point.progress_percentage}%` }}
                    title={`${Math.round(point.progress_percentage)}% - ${formatDate(point.recorded_at)}`}
                  />
                  <p className="text-xs text-cscx-gray-500 mt-1 truncate w-full text-center">
                    {new Date(point.recorded_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                  </p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Child Goals (for team goals) */}
        {selectedGoal.child_goals && selectedGoal.child_goals.length > 0 && (
          <div className="bg-cscx-gray-900 border border-cscx-gray-800 rounded-xl p-6">
            <h3 className="text-lg font-semibold text-white mb-4">Individual Contributions</h3>
            <div className="space-y-3">
              {selectedGoal.child_goals.map((child) => (
                <div
                  key={child.id}
                  className="flex items-center gap-4 p-3 bg-cscx-gray-800/30 rounded-lg hover:bg-cscx-gray-800/50 cursor-pointer transition"
                  onClick={() => handleGoalClick(child.id)}
                >
                  <div className="flex-1">
                    <p className="text-white font-medium">{child.name}</p>
                    <p className="text-cscx-gray-500 text-sm">{child.user_id || 'Unassigned'}</p>
                  </div>
                  <div className="w-24 h-2 bg-cscx-gray-800 rounded-full overflow-hidden">
                    <div
                      className={`h-full ${getProgressBarColor(child.status)}`}
                      style={{ width: `${child.progress_percentage}%` }}
                    />
                  </div>
                  <span className="text-white font-medium w-12 text-right">
                    {Math.round(child.progress_percentage)}%
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Check-in Button */}
        <button
          onClick={() => setShowCheckInModal(true)}
          className="w-full px-4 py-3 bg-cscx-gray-800 text-white rounded-lg hover:bg-cscx-gray-700 transition"
        >
          Add Check-in
        </button>
      </div>
    );
  }

  // ============================================
  // Main Dashboard View
  // ============================================

  const dashboard = view === 'team' ? teamDashboard : individualDashboard;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-xl font-bold text-white">Team Analytics</h2>
          <p className="text-cscx-gray-400 text-sm">Track goals and progress across your team</p>
        </div>
        <div className="flex items-center gap-4">
          {/* View Toggle */}
          <div className="flex bg-cscx-gray-800 rounded-lg p-1">
            <button
              onClick={() => setView('team')}
              className={`px-4 py-2 rounded-lg text-sm transition ${
                view === 'team' ? 'bg-cscx-accent text-white' : 'text-cscx-gray-400 hover:text-white'
              }`}
            >
              Team
            </button>
            <button
              onClick={() => setView('individual')}
              className={`px-4 py-2 rounded-lg text-sm transition ${
                view === 'individual' ? 'bg-cscx-accent text-white' : 'text-cscx-gray-400 hover:text-white'
              }`}
            >
              Individual
            </button>
          </div>

          {/* Period Selector */}
          <select
            value={selectedPeriodId || ''}
            onChange={(e) => setSelectedPeriodId(e.target.value)}
            className="px-3 py-2 bg-cscx-gray-900 border border-cscx-gray-800 rounded-lg text-white text-sm"
          >
            {periods.map((period) => (
              <option key={period.id} value={period.id}>
                {period.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Summary Cards */}
      {dashboard && (
        <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
          <div className="bg-cscx-gray-900 border border-cscx-gray-800 rounded-xl p-4">
            <p className="text-xs text-cscx-gray-400 uppercase tracking-wider">Total Goals</p>
            <p className="text-2xl font-bold text-white mt-1">{dashboard.summary.total_goals}</p>
          </div>
          <div className="bg-cscx-gray-900 border border-cscx-gray-800 rounded-xl p-4">
            <p className="text-xs text-cscx-gray-400 uppercase tracking-wider">On Track</p>
            <p className="text-2xl font-bold text-blue-400 mt-1">{dashboard.summary.on_track_count}</p>
          </div>
          {view === 'team' && teamDashboard && (
            <>
              <div className="bg-cscx-gray-900 border border-cscx-gray-800 rounded-xl p-4">
                <p className="text-xs text-cscx-gray-400 uppercase tracking-wider">At Risk</p>
                <p className="text-2xl font-bold text-yellow-400 mt-1">{teamDashboard.summary.at_risk_count}</p>
              </div>
              <div className="bg-cscx-gray-900 border border-cscx-gray-800 rounded-xl p-4">
                <p className="text-xs text-cscx-gray-400 uppercase tracking-wider">Behind</p>
                <p className="text-2xl font-bold text-red-400 mt-1">{teamDashboard.summary.behind_count}</p>
              </div>
            </>
          )}
          <div className="bg-cscx-gray-900 border border-cscx-gray-800 rounded-xl p-4">
            <p className="text-xs text-cscx-gray-400 uppercase tracking-wider">Achieved</p>
            <p className="text-2xl font-bold text-green-400 mt-1">{dashboard.summary.achieved_count}</p>
          </div>
          <div className="bg-cscx-gray-900 border border-cscx-gray-800 rounded-xl p-4">
            <p className="text-xs text-cscx-gray-400 uppercase tracking-wider">Avg Progress</p>
            <p className="text-2xl font-bold text-white mt-1">{dashboard.summary.average_progress}%</p>
          </div>
        </div>
      )}

      {/* Goals List */}
      <div className="bg-cscx-gray-900 border border-cscx-gray-800 rounded-xl p-6">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-lg font-semibold text-white">
            {view === 'team' ? 'Team Goals' : 'My Goals'}
          </h3>
          <button
            onClick={() => setShowCreateGoalModal(true)}
            className="px-4 py-2 bg-cscx-accent text-white rounded-lg hover:bg-cscx-accent/80 transition text-sm"
          >
            + Create Goal
          </button>
        </div>

        {view === 'team' && teamDashboard && teamDashboard.team_goals.length === 0 && (
          <p className="text-cscx-gray-400 text-center py-8">No team goals for this period</p>
        )}

        {view === 'individual' && individualDashboard && individualDashboard.individual_goals.length === 0 && (
          <p className="text-cscx-gray-400 text-center py-8">No individual goals for this period</p>
        )}

        <div className="space-y-3">
          {view === 'team' && teamDashboard?.team_goals.map((goal) => (
            <div
              key={goal.id}
              className="flex items-center gap-4 p-4 bg-cscx-gray-800/30 rounded-lg hover:bg-cscx-gray-800/50 cursor-pointer transition"
              onClick={() => handleGoalClick(goal.id)}
            >
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <p className="text-white font-medium">{goal.name}</p>
                  <span className={`px-2 py-0.5 rounded-full text-xs font-medium border ${getStatusBg(goal.status)}`}>
                    {goal.status.replace('_', ' ')}
                  </span>
                </div>
                {goal.metric_name && (
                  <p className="text-cscx-gray-500 text-sm mt-1">
                    {goal.metric_name} - Current: {goal.current_value ?? 'N/A'} / Target: {goal.target_value}
                  </p>
                )}
              </div>
              <div className="w-32 h-2 bg-cscx-gray-800 rounded-full overflow-hidden">
                <div
                  className={`h-full ${getProgressBarColor(goal.status)}`}
                  style={{ width: `${Math.min(100, goal.progress_percentage)}%` }}
                />
              </div>
              <span className="text-white font-medium w-16 text-right">
                {Math.round(goal.progress_percentage)}%
              </span>
            </div>
          ))}

          {view === 'individual' && individualDashboard?.individual_goals.map((goal) => (
            <div
              key={goal.id}
              className="flex items-center gap-4 p-4 bg-cscx-gray-800/30 rounded-lg hover:bg-cscx-gray-800/50 cursor-pointer transition"
              onClick={() => handleGoalClick(goal.id)}
            >
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <p className="text-white font-medium">{goal.name}</p>
                  <span className={`px-2 py-0.5 rounded-full text-xs font-medium border ${getStatusBg(goal.status)}`}>
                    {goal.status.replace('_', ' ')}
                  </span>
                </div>
                {goal.metric_name && (
                  <p className="text-cscx-gray-500 text-sm mt-1">
                    {goal.metric_name} - Current: {goal.current_value ?? 'N/A'} / Target: {goal.target_value}
                  </p>
                )}
              </div>
              <div className="w-32 h-2 bg-cscx-gray-800 rounded-full overflow-hidden">
                <div
                  className={`h-full ${getProgressBarColor(goal.status)}`}
                  style={{ width: `${Math.min(100, goal.progress_percentage)}%` }}
                />
              </div>
              <span className="text-white font-medium w-16 text-right">
                {Math.round(goal.progress_percentage)}%
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Leaderboard (Team View Only) */}
      {view === 'team' && teamDashboard && teamDashboard.leaderboard.length > 0 && (
        <div className="bg-cscx-gray-900 border border-cscx-gray-800 rounded-xl p-6">
          <h3 className="text-lg font-semibold text-white mb-4">Leaderboard</h3>
          <div className="space-y-2">
            {teamDashboard.leaderboard.slice(0, 10).map((entry) => (
              <div
                key={entry.user_id}
                className="flex items-center gap-4 p-3 bg-cscx-gray-800/30 rounded-lg"
              >
                <span className={`w-8 h-8 flex items-center justify-center rounded-full font-bold ${
                  entry.rank === 1 ? 'bg-yellow-500/20 text-yellow-400' :
                  entry.rank === 2 ? 'bg-gray-400/20 text-gray-300' :
                  entry.rank === 3 ? 'bg-amber-600/20 text-amber-500' :
                  'bg-cscx-gray-800 text-cscx-gray-400'
                }`}>
                  {entry.rank}
                </span>
                <div className="flex-1">
                  <p className="text-white font-medium">{entry.user_name || entry.user_id}</p>
                  <p className="text-cscx-gray-500 text-sm">
                    {entry.achieved_count}/{entry.goals_count} goals achieved
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-white font-bold">{entry.average_progress}%</p>
                  <p className="text-cscx-gray-500 text-xs">avg progress</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Recent Achievements */}
      {teamDashboard && teamDashboard.recent_achievements.length > 0 && (
        <div className="bg-cscx-gray-900 border border-cscx-gray-800 rounded-xl p-6">
          <h3 className="text-lg font-semibold text-white mb-4">Recent Achievements</h3>
          <div className="space-y-3">
            {teamDashboard.recent_achievements.map((achievement) => (
              <div
                key={achievement.id}
                className="flex items-center gap-4 p-3 bg-cscx-gray-800/30 rounded-lg"
              >
                <div className="w-10 h-10 bg-green-500/20 rounded-full flex items-center justify-center text-lg">
                  {achievement.achievement_type === 'exceeded' ? '🏆' : '✅'}
                </div>
                <div className="flex-1">
                  <p className="text-white font-medium">{achievement.achievement_name}</p>
                  <p className="text-cscx-gray-500 text-sm">{formatDate(achievement.achieved_at)}</p>
                </div>
                {!achievement.acknowledged && (
                  <button
                    onClick={() => handleAcknowledgeAchievement(achievement.id)}
                    className="px-3 py-1 bg-cscx-accent text-white rounded-lg text-sm hover:bg-cscx-accent/80 transition"
                  >
                    Acknowledge
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Individual Team Contribution */}
      {view === 'individual' && individualDashboard && individualDashboard.summary.team_contribution_percentage > 0 && (
        <div className="bg-cscx-gray-900 border border-cscx-gray-800 rounded-xl p-6">
          <h3 className="text-lg font-semibold text-white mb-4">Team Contribution</h3>
          <div className="flex items-center gap-4">
            <div className="flex-1 h-4 bg-cscx-gray-800 rounded-full overflow-hidden">
              <div
                className="h-full bg-cscx-accent"
                style={{ width: `${individualDashboard.summary.team_contribution_percentage}%` }}
              />
            </div>
            <span className="text-2xl font-bold text-white">
              {individualDashboard.summary.team_contribution_percentage}%
            </span>
          </div>
          <p className="text-cscx-gray-400 text-sm mt-2">
            Your contribution to team goals this period
          </p>
        </div>
      )}
    </div>
  );
};

export default TeamAnalytics;
