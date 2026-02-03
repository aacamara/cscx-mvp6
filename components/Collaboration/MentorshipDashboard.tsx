/**
 * PRD-255: Mentorship Dashboard Component
 *
 * Central dashboard for the mentorship program including:
 * - Program metrics overview
 * - Mentor directory with matching
 * - Active assignments tracking
 * - Session logging
 * - Analytics and effectiveness reports
 */

import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../../context/AuthContext';

// ============================================
// Types
// ============================================

interface Mentor {
  id: string;
  userId: string;
  userName: string;
  userEmail: string;
  userAvatar?: string;
  isActive: boolean;
  status: 'active' | 'inactive' | 'on_leave';
  maxMentees: number;
  currentMenteeCount: number;
  expertiseAreas: string[];
  availabilityNotes?: string;
  totalMenteesToDate: number;
  averageRating: number | null;
  isCertified: boolean;
  certificationStatus: 'not_certified' | 'in_progress' | 'certified';
  certifiedAt: string | null;
  tenure: number;
  bio?: string;
  preferredMeetingDays?: string[];
}

interface MentorMatch {
  mentorId: string;
  mentor: Mentor;
  matchScore: number;
  factors: {
    expertiseOverlap: number;
    capacityAvailable: boolean;
    locationMatch: boolean;
    timezoneMatch: boolean;
    pastSuccessRate: number;
    tenureScore: number;
  };
  reasoning: string[];
}

interface MentorshipAssignment {
  id: string;
  mentorId: string;
  mentorName: string;
  mentorEmail: string;
  menteeUserId: string;
  menteeName: string;
  menteeEmail: string;
  startDate: string;
  expectedEndDate?: string;
  checkInCadence: 'weekly' | 'biweekly' | 'monthly';
  status: 'pending' | 'active' | 'completed' | 'cancelled' | 'on_hold';
  goals: Array<{
    id: string;
    goal: string;
    targetDate: string;
    achieved: boolean;
  }>;
  milestones: Array<{
    id: string;
    name: string;
    targetDate?: string;
    achievedDate?: string;
    order: number;
  }>;
}

interface MentorshipSession {
  id: string;
  assignmentId: string;
  sessionDate: string;
  durationMinutes?: number;
  topicsCovered: string[];
  summary?: string;
  actionItems: Array<{
    id: string;
    item: string;
    owner: 'mentor' | 'mentee';
    dueDate?: string;
    done: boolean;
  }>;
  menteeConfidenceBefore?: number;
  menteeConfidenceAfter?: number;
  sessionQuality?: number;
}

interface ProgramMetrics {
  totalActiveMentors: number;
  totalActiveMentees: number;
  totalActiveAssignments: number;
  mentorshipCoverage: number;
  avgRampTimeWithMentor: number;
  avgRampTimeWithoutMentor: number;
  rampTimeReduction: number;
  avgSessionFrequency: number;
  avgSessionCompletionRate: number;
  avgMenteeSatisfaction: number;
  avgMentorSatisfaction: number;
}

interface MentorshipDashboardProps {
  userId?: string;
  userRole?: 'csm' | 'manager' | 'admin';
  onViewMentor?: (mentorId: string) => void;
  onViewAssignment?: (assignmentId: string) => void;
}

const API_BASE = `${import.meta.env.VITE_API_URL || ''}/api`;

// ============================================
// Tab Components
// ============================================

type TabType = 'overview' | 'mentors' | 'assignments' | 'sessions' | 'analytics';

// ============================================
// Main Dashboard Component
// ============================================

const MentorshipDashboard: React.FC<MentorshipDashboardProps> = ({
  userId,
  userRole = 'csm',
  onViewMentor,
  onViewAssignment,
}) => {
  const { user } = useAuth();

  const [activeTab, setActiveTab] = useState<TabType>('overview');
  const [mentors, setMentors] = useState<Mentor[]>([]);
  const [assignments, setAssignments] = useState<MentorshipAssignment[]>([]);
  const [metrics, setMetrics] = useState<ProgramMetrics | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filters
  const [mentorFilter, setMentorFilter] = useState<'all' | 'available' | 'certified'>('all');
  const [assignmentFilter, setAssignmentFilter] = useState<'all' | 'pending' | 'active' | 'completed'>('all');

  // Modals
  const [showOptInModal, setShowOptInModal] = useState(false);
  const [showAssignModal, setShowAssignModal] = useState(false);
  const [showSessionModal, setShowSessionModal] = useState(false);
  const [selectedAssignment, setSelectedAssignment] = useState<MentorshipAssignment | null>(null);

  // ============================================
  // Data Fetching
  // ============================================

  const fetchMentors = useCallback(async () => {
    try {
      const params = new URLSearchParams();
      if (mentorFilter === 'available') params.append('isAvailable', 'true');
      if (mentorFilter === 'certified') params.append('isCertified', 'true');

      const response = await fetch(`${API_BASE}/mentorship/mentors?${params}`);
      const data = await response.json();

      if (data.success) {
        setMentors(data.mentors);
      }
    } catch (err) {
      console.error('Failed to fetch mentors:', err);
    }
  }, [mentorFilter]);

  const fetchAssignments = useCallback(async () => {
    try {
      const params = new URLSearchParams();
      if (assignmentFilter !== 'all') params.append('status', assignmentFilter);

      const response = await fetch(`${API_BASE}/mentorship/assignments?${params}`);
      const data = await response.json();

      if (data.success) {
        setAssignments(data.assignments);
      }
    } catch (err) {
      console.error('Failed to fetch assignments:', err);
    }
  }, [assignmentFilter]);

  const fetchMetrics = useCallback(async () => {
    try {
      const response = await fetch(`${API_BASE}/mentorship/analytics`);
      const data = await response.json();

      if (data.success) {
        setMetrics(data.metrics);
      }
    } catch (err) {
      console.error('Failed to fetch metrics:', err);
    }
  }, []);

  useEffect(() => {
    const loadData = async () => {
      setLoading(true);
      setError(null);
      try {
        await Promise.all([fetchMentors(), fetchAssignments(), fetchMetrics()]);
      } catch (err) {
        setError('Failed to load mentorship data');
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, [fetchMentors, fetchAssignments, fetchMetrics]);

  // ============================================
  // Actions
  // ============================================

  const handleOptIn = async (formData: {
    expertiseAreas: string[];
    maxMentees: number;
    availabilityNotes?: string;
    bio?: string;
  }) => {
    try {
      const response = await fetch(`${API_BASE}/mentorship/mentors`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-user-id': user?.id || userId || '',
          'x-user-name': user?.user_metadata?.full_name || user?.user_metadata?.name || 'User',
          'x-user-email': user?.email || 'user@example.com',
        },
        body: JSON.stringify(formData),
      });

      const data = await response.json();

      if (data.success) {
        setShowOptInModal(false);
        fetchMentors();
      } else {
        setError(data.error);
      }
    } catch (err) {
      setError('Failed to register as mentor');
    }
  };

  const handleAcceptAssignment = async (assignmentId: string) => {
    try {
      const response = await fetch(`${API_BASE}/mentorship/assignments/${assignmentId}/accept`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });

      const data = await response.json();

      if (data.success) {
        fetchAssignments();
      } else {
        setError(data.error);
      }
    } catch (err) {
      setError('Failed to accept assignment');
    }
  };

  const handleDeclineAssignment = async (assignmentId: string, reason: string) => {
    try {
      const response = await fetch(`${API_BASE}/mentorship/assignments/${assignmentId}/decline`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason }),
      });

      const data = await response.json();

      if (data.success) {
        fetchAssignments();
      } else {
        setError(data.error);
      }
    } catch (err) {
      setError('Failed to decline assignment');
    }
  };

  // ============================================
  // Render Helpers
  // ============================================

  const renderTabButton = (tab: TabType, label: string) => (
    <button
      onClick={() => setActiveTab(tab)}
      className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
        activeTab === tab
          ? 'bg-cscx-accent text-white'
          : 'text-gray-400 hover:text-white hover:bg-gray-800'
      }`}
    >
      {label}
    </button>
  );

  const renderStatusBadge = (status: string) => {
    const colors: Record<string, string> = {
      pending: 'bg-yellow-500/20 text-yellow-400',
      active: 'bg-green-500/20 text-green-400',
      completed: 'bg-blue-500/20 text-blue-400',
      cancelled: 'bg-red-500/20 text-red-400',
      on_hold: 'bg-gray-500/20 text-gray-400',
    };

    return (
      <span className={`px-2 py-1 text-xs font-medium rounded-full ${colors[status] || colors.pending}`}>
        {status.replace('_', ' ')}
      </span>
    );
  };

  const renderStars = (rating: number | null) => {
    if (rating === null) return <span className="text-gray-500">No ratings yet</span>;

    return (
      <div className="flex items-center gap-1">
        {[1, 2, 3, 4, 5].map((star) => (
          <svg
            key={star}
            className={`w-4 h-4 ${star <= rating ? 'text-yellow-400' : 'text-gray-600'}`}
            fill="currentColor"
            viewBox="0 0 20 20"
          >
            <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
          </svg>
        ))}
        <span className="ml-1 text-sm text-gray-400">({rating.toFixed(1)})</span>
      </div>
    );
  };

  // ============================================
  // Tab Content
  // ============================================

  const renderOverview = () => (
    <div className="space-y-6">
      {/* Metrics Cards */}
      {metrics && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-gray-800 rounded-lg p-4 border border-gray-700">
            <div className="text-sm text-gray-400">Active Mentors</div>
            <div className="text-2xl font-bold text-white">{metrics.totalActiveMentors}</div>
          </div>
          <div className="bg-gray-800 rounded-lg p-4 border border-gray-700">
            <div className="text-sm text-gray-400">Active Mentees</div>
            <div className="text-2xl font-bold text-white">{metrics.totalActiveMentees}</div>
          </div>
          <div className="bg-gray-800 rounded-lg p-4 border border-gray-700">
            <div className="text-sm text-gray-400">Mentorship Coverage</div>
            <div className="text-2xl font-bold text-green-400">{metrics.mentorshipCoverage}%</div>
          </div>
          <div className="bg-gray-800 rounded-lg p-4 border border-gray-700">
            <div className="text-sm text-gray-400">Ramp Time Reduction</div>
            <div className="text-2xl font-bold text-cscx-accent">{metrics.rampTimeReduction}%</div>
          </div>
        </div>
      )}

      {/* Satisfaction Scores */}
      {metrics && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="bg-gray-800 rounded-lg p-4 border border-gray-700">
            <div className="text-sm text-gray-400 mb-2">Mentee Satisfaction</div>
            <div className="flex items-center gap-2">
              {renderStars(metrics.avgMenteeSatisfaction)}
            </div>
          </div>
          <div className="bg-gray-800 rounded-lg p-4 border border-gray-700">
            <div className="text-sm text-gray-400 mb-2">Mentor Satisfaction</div>
            <div className="flex items-center gap-2">
              {renderStars(metrics.avgMentorSatisfaction)}
            </div>
          </div>
        </div>
      )}

      {/* Recent Assignments */}
      <div className="bg-gray-800 rounded-lg border border-gray-700">
        <div className="p-4 border-b border-gray-700 flex items-center justify-between">
          <h3 className="text-lg font-semibold text-white">Recent Assignments</h3>
          <button
            onClick={() => setActiveTab('assignments')}
            className="text-sm text-cscx-accent hover:underline"
          >
            View all
          </button>
        </div>
        <div className="p-4">
          {assignments.slice(0, 5).map((assignment) => (
            <div
              key={assignment.id}
              className="flex items-center justify-between py-3 border-b border-gray-700 last:border-0"
            >
              <div>
                <div className="text-white font-medium">{assignment.menteeName}</div>
                <div className="text-sm text-gray-400">
                  Mentor: {assignment.mentorName}
                </div>
              </div>
              <div className="flex items-center gap-2">
                {renderStatusBadge(assignment.status)}
                {assignment.status === 'pending' && (
                  <button
                    onClick={() => handleAcceptAssignment(assignment.id)}
                    className="text-xs text-green-400 hover:text-green-300"
                  >
                    Accept
                  </button>
                )}
              </div>
            </div>
          ))}
          {assignments.length === 0 && (
            <div className="text-center text-gray-500 py-8">
              No assignments yet
            </div>
          )}
        </div>
      </div>
    </div>
  );

  const renderMentors = () => (
    <div className="space-y-4">
      {/* Filters and Actions */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <button
            onClick={() => setMentorFilter('all')}
            className={`px-3 py-1.5 text-sm rounded-lg ${
              mentorFilter === 'all'
                ? 'bg-gray-700 text-white'
                : 'text-gray-400 hover:text-white'
            }`}
          >
            All
          </button>
          <button
            onClick={() => setMentorFilter('available')}
            className={`px-3 py-1.5 text-sm rounded-lg ${
              mentorFilter === 'available'
                ? 'bg-gray-700 text-white'
                : 'text-gray-400 hover:text-white'
            }`}
          >
            Available
          </button>
          <button
            onClick={() => setMentorFilter('certified')}
            className={`px-3 py-1.5 text-sm rounded-lg ${
              mentorFilter === 'certified'
                ? 'bg-gray-700 text-white'
                : 'text-gray-400 hover:text-white'
            }`}
          >
            Certified
          </button>
        </div>
        <button
          onClick={() => setShowOptInModal(true)}
          className="px-4 py-2 bg-cscx-accent text-white rounded-lg text-sm font-medium hover:bg-cscx-accent/90"
        >
          Become a Mentor
        </button>
      </div>

      {/* Mentor Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {mentors.map((mentor) => (
          <div
            key={mentor.id}
            className="bg-gray-800 rounded-lg border border-gray-700 p-4 hover:border-gray-600 cursor-pointer"
            onClick={() => onViewMentor?.(mentor.id)}
          >
            <div className="flex items-start gap-3">
              <div className="w-12 h-12 rounded-full bg-gray-700 flex items-center justify-center text-white font-medium">
                {mentor.userName.split(' ').map(n => n[0]).join('')}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <h4 className="text-white font-medium truncate">{mentor.userName}</h4>
                  {mentor.isCertified && (
                    <svg className="w-4 h-4 text-blue-400" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M6.267 3.455a3.066 3.066 0 001.745-.723 3.066 3.066 0 013.976 0 3.066 3.066 0 001.745.723 3.066 3.066 0 012.812 2.812c.051.643.304 1.254.723 1.745a3.066 3.066 0 010 3.976 3.066 3.066 0 00-.723 1.745 3.066 3.066 0 01-2.812 2.812 3.066 3.066 0 00-1.745.723 3.066 3.066 0 01-3.976 0 3.066 3.066 0 00-1.745-.723 3.066 3.066 0 01-2.812-2.812 3.066 3.066 0 00-.723-1.745 3.066 3.066 0 010-3.976 3.066 3.066 0 00.723-1.745 3.066 3.066 0 012.812-2.812zm7.44 5.252a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                    </svg>
                  )}
                </div>
                <div className="mt-1">{renderStars(mentor.averageRating)}</div>
              </div>
            </div>

            <div className="mt-4">
              <div className="flex flex-wrap gap-1">
                {mentor.expertiseAreas.slice(0, 3).map((area) => (
                  <span
                    key={area}
                    className="px-2 py-0.5 text-xs bg-gray-700 text-gray-300 rounded"
                  >
                    {area}
                  </span>
                ))}
                {mentor.expertiseAreas.length > 3 && (
                  <span className="px-2 py-0.5 text-xs text-gray-500">
                    +{mentor.expertiseAreas.length - 3} more
                  </span>
                )}
              </div>
            </div>

            <div className="mt-4 pt-4 border-t border-gray-700 flex items-center justify-between text-sm">
              <span className="text-gray-400">
                {mentor.currentMenteeCount}/{mentor.maxMentees} mentees
              </span>
              <span className={`${
                mentor.currentMenteeCount < mentor.maxMentees
                  ? 'text-green-400'
                  : 'text-red-400'
              }`}>
                {mentor.currentMenteeCount < mentor.maxMentees ? 'Available' : 'At capacity'}
              </span>
            </div>
          </div>
        ))}
      </div>

      {mentors.length === 0 && (
        <div className="text-center text-gray-500 py-12">
          No mentors found matching your criteria
        </div>
      )}
    </div>
  );

  const renderAssignments = () => (
    <div className="space-y-4">
      {/* Filters */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          {['all', 'pending', 'active', 'completed'].map((filter) => (
            <button
              key={filter}
              onClick={() => setAssignmentFilter(filter as any)}
              className={`px-3 py-1.5 text-sm rounded-lg capitalize ${
                assignmentFilter === filter
                  ? 'bg-gray-700 text-white'
                  : 'text-gray-400 hover:text-white'
              }`}
            >
              {filter}
            </button>
          ))}
        </div>
        {(userRole === 'manager' || userRole === 'admin') && (
          <button
            onClick={() => setShowAssignModal(true)}
            className="px-4 py-2 bg-cscx-accent text-white rounded-lg text-sm font-medium hover:bg-cscx-accent/90"
          >
            Create Assignment
          </button>
        )}
      </div>

      {/* Assignments Table */}
      <div className="bg-gray-800 rounded-lg border border-gray-700 overflow-hidden">
        <table className="w-full">
          <thead className="bg-gray-900">
            <tr>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase">Mentee</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase">Mentor</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase">Start Date</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase">Cadence</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase">Progress</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase">Status</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-700">
            {assignments.map((assignment) => {
              const completedGoals = assignment.goals.filter(g => g.achieved).length;
              const completedMilestones = assignment.milestones.filter(m => m.achievedDate).length;
              const totalItems = assignment.goals.length + assignment.milestones.length;
              const progress = totalItems > 0
                ? Math.round(((completedGoals + completedMilestones) / totalItems) * 100)
                : 0;

              return (
                <tr key={assignment.id} className="hover:bg-gray-750">
                  <td className="px-4 py-3">
                    <div className="text-white">{assignment.menteeName}</div>
                    <div className="text-xs text-gray-500">{assignment.menteeEmail}</div>
                  </td>
                  <td className="px-4 py-3">
                    <div className="text-white">{assignment.mentorName}</div>
                  </td>
                  <td className="px-4 py-3 text-gray-400">
                    {new Date(assignment.startDate).toLocaleDateString()}
                  </td>
                  <td className="px-4 py-3 text-gray-400 capitalize">
                    {assignment.checkInCadence}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <div className="flex-1 h-2 bg-gray-700 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-cscx-accent rounded-full"
                          style={{ width: `${progress}%` }}
                        />
                      </div>
                      <span className="text-sm text-gray-400">{progress}%</span>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    {renderStatusBadge(assignment.status)}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => {
                          setSelectedAssignment(assignment);
                          setShowSessionModal(true);
                        }}
                        className="text-xs text-blue-400 hover:text-blue-300"
                      >
                        Log Session
                      </button>
                      <button
                        onClick={() => onViewAssignment?.(assignment.id)}
                        className="text-xs text-gray-400 hover:text-white"
                      >
                        View
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>

        {assignments.length === 0 && (
          <div className="text-center text-gray-500 py-12">
            No assignments found
          </div>
        )}
      </div>
    </div>
  );

  const renderSessions = () => (
    <div className="space-y-4">
      <div className="bg-gray-800 rounded-lg border border-gray-700 p-6 text-center">
        <p className="text-gray-400">
          Select an assignment to view or log sessions.
        </p>
        <button
          onClick={() => setActiveTab('assignments')}
          className="mt-4 px-4 py-2 bg-gray-700 text-white rounded-lg text-sm hover:bg-gray-600"
        >
          View Assignments
        </button>
      </div>
    </div>
  );

  const renderAnalytics = () => (
    <div className="space-y-6">
      {/* Ramp Time Comparison */}
      <div className="bg-gray-800 rounded-lg border border-gray-700 p-6">
        <h3 className="text-lg font-semibold text-white mb-4">Ramp Time Comparison</h3>
        <div className="grid grid-cols-2 gap-8">
          <div className="text-center">
            <div className="text-3xl font-bold text-green-400">
              {metrics?.avgRampTimeWithMentor || 0} days
            </div>
            <div className="text-sm text-gray-400 mt-1">With Mentor</div>
          </div>
          <div className="text-center">
            <div className="text-3xl font-bold text-gray-400">
              {metrics?.avgRampTimeWithoutMentor || 0} days
            </div>
            <div className="text-sm text-gray-400 mt-1">Without Mentor</div>
          </div>
        </div>
        <div className="mt-4 text-center">
          <span className="text-cscx-accent font-medium">
            {metrics?.rampTimeReduction || 0}% faster ramp time with mentorship
          </span>
        </div>
      </div>

      {/* Session Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="bg-gray-800 rounded-lg border border-gray-700 p-6">
          <div className="text-sm text-gray-400">Avg. Sessions per Month</div>
          <div className="text-2xl font-bold text-white mt-1">
            {metrics?.avgSessionFrequency.toFixed(1) || 0}
          </div>
        </div>
        <div className="bg-gray-800 rounded-lg border border-gray-700 p-6">
          <div className="text-sm text-gray-400">Session Completion Rate</div>
          <div className="text-2xl font-bold text-white mt-1">
            {metrics?.avgSessionCompletionRate || 0}%
          </div>
        </div>
      </div>

      {/* Program Health */}
      <div className="bg-gray-800 rounded-lg border border-gray-700 p-6">
        <h3 className="text-lg font-semibold text-white mb-4">Program Health</h3>
        <div className="space-y-4">
          <div>
            <div className="flex justify-between text-sm mb-1">
              <span className="text-gray-400">Mentorship Coverage</span>
              <span className="text-white">{metrics?.mentorshipCoverage || 0}%</span>
            </div>
            <div className="h-2 bg-gray-700 rounded-full overflow-hidden">
              <div
                className="h-full bg-green-500 rounded-full"
                style={{ width: `${metrics?.mentorshipCoverage || 0}%` }}
              />
            </div>
          </div>
          <div>
            <div className="flex justify-between text-sm mb-1">
              <span className="text-gray-400">Mentor Utilization</span>
              <span className="text-white">
                {mentors.length > 0
                  ? Math.round(
                      (mentors.reduce((sum, m) => sum + m.currentMenteeCount, 0) /
                        mentors.reduce((sum, m) => sum + m.maxMentees, 0)) *
                        100
                    )
                  : 0}
                %
              </span>
            </div>
            <div className="h-2 bg-gray-700 rounded-full overflow-hidden">
              <div
                className="h-full bg-blue-500 rounded-full"
                style={{
                  width: `${
                    mentors.length > 0
                      ? Math.round(
                          (mentors.reduce((sum, m) => sum + m.currentMenteeCount, 0) /
                            mentors.reduce((sum, m) => sum + m.maxMentees, 0)) *
                            100
                        )
                      : 0
                  }%`,
                }}
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );

  // ============================================
  // Main Render
  // ============================================

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-cscx-accent"></div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Mentorship Program</h1>
          <p className="text-gray-400 mt-1">
            Manage mentor assignments, track progress, and analyze program effectiveness
          </p>
        </div>
      </div>

      {/* Error Banner */}
      {error && (
        <div className="bg-red-500/20 border border-red-500/50 text-red-400 px-4 py-3 rounded-lg">
          {error}
          <button
            onClick={() => setError(null)}
            className="ml-4 text-red-300 hover:text-red-200"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Tabs */}
      <div className="flex items-center gap-2 border-b border-gray-800 pb-4">
        {renderTabButton('overview', 'Overview')}
        {renderTabButton('mentors', 'Mentors')}
        {renderTabButton('assignments', 'Assignments')}
        {renderTabButton('sessions', 'Sessions')}
        {renderTabButton('analytics', 'Analytics')}
      </div>

      {/* Tab Content */}
      <div>
        {activeTab === 'overview' && renderOverview()}
        {activeTab === 'mentors' && renderMentors()}
        {activeTab === 'assignments' && renderAssignments()}
        {activeTab === 'sessions' && renderSessions()}
        {activeTab === 'analytics' && renderAnalytics()}
      </div>

      {/* Opt-In Modal */}
      {showOptInModal && (
        <OptInModal
          onClose={() => setShowOptInModal(false)}
          onSubmit={handleOptIn}
        />
      )}

      {/* Session Log Modal */}
      {showSessionModal && selectedAssignment && (
        <SessionModal
          assignment={selectedAssignment}
          onClose={() => {
            setShowSessionModal(false);
            setSelectedAssignment(null);
          }}
          onSubmit={async (data) => {
            try {
              const response = await fetch(
                `${API_BASE}/mentorship/assignments/${selectedAssignment.id}/sessions`,
                {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify(data),
                }
              );
              const result = await response.json();
              if (result.success) {
                setShowSessionModal(false);
                setSelectedAssignment(null);
              } else {
                setError(result.error);
              }
            } catch (err) {
              setError('Failed to log session');
            }
          }}
        />
      )}
    </div>
  );
};

// ============================================
// Modal Components
// ============================================

interface OptInModalProps {
  onClose: () => void;
  onSubmit: (data: {
    expertiseAreas: string[];
    maxMentees: number;
    availabilityNotes?: string;
    bio?: string;
  }) => void;
}

const OptInModal: React.FC<OptInModalProps> = ({ onClose, onSubmit }) => {
  const [expertiseAreas, setExpertiseAreas] = useState<string[]>([]);
  const [maxMentees, setMaxMentees] = useState(2);
  const [availabilityNotes, setAvailabilityNotes] = useState('');
  const [bio, setBio] = useState('');
  const [newExpertise, setNewExpertise] = useState('');

  const addExpertise = () => {
    if (newExpertise.trim() && !expertiseAreas.includes(newExpertise.trim())) {
      setExpertiseAreas([...expertiseAreas, newExpertise.trim()]);
      setNewExpertise('');
    }
  };

  const removeExpertise = (area: string) => {
    setExpertiseAreas(expertiseAreas.filter(e => e !== area));
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-gray-800 rounded-lg border border-gray-700 w-full max-w-lg mx-4">
        <div className="p-4 border-b border-gray-700 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-white">Become a Mentor</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-white">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="p-4 space-y-4">
          {/* Expertise Areas */}
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Areas of Expertise *
            </label>
            <div className="flex gap-2 mb-2">
              <input
                type="text"
                value={newExpertise}
                onChange={(e) => setNewExpertise(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && (e.preventDefault(), addExpertise())}
                placeholder="e.g., onboarding, renewals, technical"
                className="flex-1 px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:border-cscx-accent"
              />
              <button
                type="button"
                onClick={addExpertise}
                className="px-4 py-2 bg-gray-700 text-white rounded-lg hover:bg-gray-600"
              >
                Add
              </button>
            </div>
            <div className="flex flex-wrap gap-2">
              {expertiseAreas.map((area) => (
                <span
                  key={area}
                  className="px-2 py-1 bg-gray-700 text-gray-300 rounded-lg text-sm flex items-center gap-1"
                >
                  {area}
                  <button
                    type="button"
                    onClick={() => removeExpertise(area)}
                    className="text-gray-500 hover:text-red-400"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </span>
              ))}
            </div>
          </div>

          {/* Max Mentees */}
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Maximum Mentees
            </label>
            <select
              value={maxMentees}
              onChange={(e) => setMaxMentees(parseInt(e.target.value))}
              className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:outline-none focus:border-cscx-accent"
            >
              <option value={1}>1 mentee</option>
              <option value={2}>2 mentees</option>
              <option value={3}>3 mentees</option>
            </select>
          </div>

          {/* Availability Notes */}
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Availability Notes
            </label>
            <input
              type="text"
              value={availabilityNotes}
              onChange={(e) => setAvailabilityNotes(e.target.value)}
              placeholder="e.g., Available Tuesdays and Thursdays 2-4pm PT"
              className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:border-cscx-accent"
            />
          </div>

          {/* Bio */}
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Short Bio
            </label>
            <textarea
              value={bio}
              onChange={(e) => setBio(e.target.value)}
              rows={3}
              placeholder="Tell potential mentees about yourself..."
              className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:border-cscx-accent resize-none"
            />
          </div>
        </div>

        <div className="p-4 border-t border-gray-700 flex justify-end gap-2">
          <button
            onClick={onClose}
            className="px-4 py-2 text-gray-400 hover:text-white"
          >
            Cancel
          </button>
          <button
            onClick={() => onSubmit({ expertiseAreas, maxMentees, availabilityNotes, bio })}
            disabled={expertiseAreas.length === 0}
            className="px-4 py-2 bg-cscx-accent text-white rounded-lg font-medium hover:bg-cscx-accent/90 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Register as Mentor
          </button>
        </div>
      </div>
    </div>
  );
};

interface SessionModalProps {
  assignment: MentorshipAssignment;
  onClose: () => void;
  onSubmit: (data: {
    sessionDate: string;
    durationMinutes?: number;
    topicsCovered: string[];
    summary?: string;
    menteeConfidenceBefore?: number;
    menteeConfidenceAfter?: number;
    sessionQuality?: number;
  }) => void;
}

const SessionModal: React.FC<SessionModalProps> = ({ assignment, onClose, onSubmit }) => {
  const [sessionDate, setSessionDate] = useState(new Date().toISOString().split('T')[0]);
  const [durationMinutes, setDurationMinutes] = useState(30);
  const [topicsCovered, setTopicsCovered] = useState<string[]>([]);
  const [newTopic, setNewTopic] = useState('');
  const [summary, setSummary] = useState('');
  const [confidenceBefore, setConfidenceBefore] = useState(3);
  const [confidenceAfter, setConfidenceAfter] = useState(3);
  const [sessionQuality, setSessionQuality] = useState(4);

  const addTopic = () => {
    if (newTopic.trim() && !topicsCovered.includes(newTopic.trim())) {
      setTopicsCovered([...topicsCovered, newTopic.trim()]);
      setNewTopic('');
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-gray-800 rounded-lg border border-gray-700 w-full max-w-lg mx-4 max-h-[90vh] overflow-y-auto">
        <div className="p-4 border-b border-gray-700 flex items-center justify-between sticky top-0 bg-gray-800">
          <div>
            <h2 className="text-lg font-semibold text-white">Log Session</h2>
            <p className="text-sm text-gray-400">with {assignment.menteeName}</p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-white">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="p-4 space-y-4">
          {/* Date and Duration */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Session Date
              </label>
              <input
                type="date"
                value={sessionDate}
                onChange={(e) => setSessionDate(e.target.value)}
                className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:outline-none focus:border-cscx-accent"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Duration (minutes)
              </label>
              <input
                type="number"
                value={durationMinutes}
                onChange={(e) => setDurationMinutes(parseInt(e.target.value))}
                min={5}
                max={120}
                className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:outline-none focus:border-cscx-accent"
              />
            </div>
          </div>

          {/* Topics */}
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Topics Covered *
            </label>
            <div className="flex gap-2 mb-2">
              <input
                type="text"
                value={newTopic}
                onChange={(e) => setNewTopic(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && (e.preventDefault(), addTopic())}
                placeholder="Add a topic..."
                className="flex-1 px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:border-cscx-accent"
              />
              <button
                type="button"
                onClick={addTopic}
                className="px-4 py-2 bg-gray-700 text-white rounded-lg hover:bg-gray-600"
              >
                Add
              </button>
            </div>
            <div className="flex flex-wrap gap-2">
              {topicsCovered.map((topic) => (
                <span
                  key={topic}
                  className="px-2 py-1 bg-gray-700 text-gray-300 rounded-lg text-sm flex items-center gap-1"
                >
                  {topic}
                  <button
                    type="button"
                    onClick={() => setTopicsCovered(topicsCovered.filter(t => t !== topic))}
                    className="text-gray-500 hover:text-red-400"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </span>
              ))}
            </div>
          </div>

          {/* Summary */}
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Session Summary
            </label>
            <textarea
              value={summary}
              onChange={(e) => setSummary(e.target.value)}
              rows={3}
              placeholder="Key takeaways from this session..."
              className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:border-cscx-accent resize-none"
            />
          </div>

          {/* Ratings */}
          <div className="grid grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Confidence Before
              </label>
              <select
                value={confidenceBefore}
                onChange={(e) => setConfidenceBefore(parseInt(e.target.value))}
                className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:outline-none focus:border-cscx-accent"
              >
                {[1, 2, 3, 4, 5].map(n => (
                  <option key={n} value={n}>{n}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Confidence After
              </label>
              <select
                value={confidenceAfter}
                onChange={(e) => setConfidenceAfter(parseInt(e.target.value))}
                className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:outline-none focus:border-cscx-accent"
              >
                {[1, 2, 3, 4, 5].map(n => (
                  <option key={n} value={n}>{n}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Session Quality
              </label>
              <select
                value={sessionQuality}
                onChange={(e) => setSessionQuality(parseInt(e.target.value))}
                className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:outline-none focus:border-cscx-accent"
              >
                {[1, 2, 3, 4, 5].map(n => (
                  <option key={n} value={n}>{n}</option>
                ))}
              </select>
            </div>
          </div>
        </div>

        <div className="p-4 border-t border-gray-700 flex justify-end gap-2 sticky bottom-0 bg-gray-800">
          <button
            onClick={onClose}
            className="px-4 py-2 text-gray-400 hover:text-white"
          >
            Cancel
          </button>
          <button
            onClick={() => onSubmit({
              sessionDate,
              durationMinutes,
              topicsCovered,
              summary,
              menteeConfidenceBefore: confidenceBefore,
              menteeConfidenceAfter: confidenceAfter,
              sessionQuality,
            })}
            disabled={topicsCovered.length === 0}
            className="px-4 py-2 bg-cscx-accent text-white rounded-lg font-medium hover:bg-cscx-accent/90 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Log Session
          </button>
        </div>
      </div>
    </div>
  );
};

export default MentorshipDashboard;
