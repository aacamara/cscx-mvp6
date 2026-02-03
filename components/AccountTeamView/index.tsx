/**
 * Account Team View Component
 * PRD-072: Unified view of internal team members associated with a customer account
 *
 * Features:
 * - Team Coverage Score with status indicator
 * - Core Team and Extended Team sections
 * - Team Activity Timeline (last 30 days)
 * - Communication Channels (Slack, Drive, CRM)
 * - Coordination Status (recent & upcoming)
 * - Coverage Analysis with gap detection
 * - Team Change History
 * - Add/Remove team member functionality
 */

import React, { useState, useEffect, useCallback } from 'react';
import {
  AccountTeamResponse,
  AccountTeamMember,
  AccountTeamActivity,
  CoordinationEvent,
  CommunicationChannel,
  RoleCoverage,
  TeamChange,
  ROLE_LABELS,
  AccountTeamRole,
} from '../../types/accountTeam';

const API_BASE = `${import.meta.env.VITE_API_URL || ''}/api`;

// ============================================
// HELPER FUNCTIONS
// ============================================

const formatDate = (dateStr: string | null): string => {
  if (!dateStr) return '-';
  return new Date(dateStr).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
};

const formatRelativeDate = (dateStr: string | null): string => {
  if (!dateStr) return 'Never';
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffDays === 0) return 'Today';
  if (diffDays === 1) return 'Yesterday';
  if (diffDays < 7) return `${diffDays} days ago`;
  if (diffDays < 30) return `${Math.floor(diffDays / 7)} weeks ago`;
  if (diffDays < 365) return `${Math.floor(diffDays / 30)} months ago`;
  return formatDate(dateStr);
};

const formatFutureDate = (dateStr: string): string => {
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = date.getTime() - now.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffDays === 0) return 'Today';
  if (diffDays === 1) return 'Tomorrow';
  if (diffDays < 7) return `In ${diffDays} days`;
  return formatDate(dateStr);
};

const getAssignmentDuration = (dateStr: string): string => {
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMonths = Math.floor(diffMs / (1000 * 60 * 60 * 24 * 30));

  if (diffMonths < 1) return 'This month';
  if (diffMonths === 1) return '1 month';
  if (diffMonths < 12) return `${diffMonths} months`;
  const years = Math.floor(diffMonths / 12);
  const remainingMonths = diffMonths % 12;
  if (remainingMonths === 0) return `${years} year${years > 1 ? 's' : ''}`;
  return `${years}y ${remainingMonths}m`;
};

const getCoverageColor = (status: string): string => {
  switch (status) {
    case 'excellent':
      return 'text-green-400';
    case 'good':
      return 'text-green-400';
    case 'needs_attention':
      return 'text-yellow-400';
    case 'critical':
      return 'text-red-400';
    default:
      return 'text-gray-400';
  }
};

const getCoverageBgColor = (status: string): string => {
  switch (status) {
    case 'excellent':
      return 'bg-green-500';
    case 'good':
      return 'bg-green-500';
    case 'needs_attention':
      return 'bg-yellow-500';
    case 'critical':
      return 'bg-red-500';
    default:
      return 'bg-gray-500';
  }
};

const getEngagementStatus = (status: string): { color: string; icon: string } => {
  switch (status) {
    case 'active':
      return { color: 'text-green-400', icon: 'check' };
    case 'ok':
      return { color: 'text-gray-400', icon: 'check' };
    case 'overdue':
      return { color: 'text-yellow-400', icon: 'warning' };
    default:
      return { color: 'text-gray-400', icon: 'check' };
  }
};

const getChannelIcon = (type: string): JSX.Element => {
  switch (type) {
    case 'slack':
      return (
        <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
          <path d="M5.042 15.165a2.528 2.528 0 0 1-2.52 2.523A2.528 2.528 0 0 1 0 15.165a2.527 2.527 0 0 1 2.522-2.52h2.52v2.52zM6.313 15.165a2.527 2.527 0 0 1 2.521-2.52 2.527 2.527 0 0 1 2.521 2.52v6.313A2.528 2.528 0 0 1 8.834 24a2.528 2.528 0 0 1-2.521-2.522v-6.313zM8.834 5.042a2.528 2.528 0 0 1-2.521-2.52A2.528 2.528 0 0 1 8.834 0a2.528 2.528 0 0 1 2.521 2.522v2.52H8.834zM8.834 6.313a2.528 2.528 0 0 1 2.521 2.521 2.528 2.528 0 0 1-2.521 2.521H2.522A2.528 2.528 0 0 1 0 8.834a2.528 2.528 0 0 1 2.522-2.521h6.312zM18.956 8.834a2.528 2.528 0 0 1 2.522-2.521A2.528 2.528 0 0 1 24 8.834a2.528 2.528 0 0 1-2.522 2.521h-2.522V8.834zM17.688 8.834a2.528 2.528 0 0 1-2.523 2.521 2.527 2.527 0 0 1-2.52-2.521V2.522A2.527 2.527 0 0 1 15.165 0a2.528 2.528 0 0 1 2.523 2.522v6.312zM15.165 18.956a2.528 2.528 0 0 1 2.523 2.522A2.528 2.528 0 0 1 15.165 24a2.527 2.527 0 0 1-2.52-2.522v-2.522h2.52zM15.165 17.688a2.527 2.527 0 0 1-2.52-2.523 2.526 2.526 0 0 1 2.52-2.52h6.313A2.527 2.527 0 0 1 24 15.165a2.528 2.528 0 0 1-2.522 2.523h-6.313z" />
        </svg>
      );
    case 'drive':
      return (
        <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
          <path d="M4.433 22.396l4-6.93H24l-4 6.93H4.433zm3.566-6.93L0 3.737 4.433 0 12 12.464l-3.999 3.002zm8.001 0L8 3.737 12.434 0l8 13.859-4.434 1.607z" />
        </svg>
      );
    case 'crm':
      return (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4"
          />
        </svg>
      );
    default:
      return (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1"
          />
        </svg>
      );
  }
};

// ============================================
// SUB-COMPONENTS
// ============================================

interface TeamMemberCardProps {
  member: AccountTeamMember;
  onViewProfile?: () => void;
  onSendMessage?: () => void;
  compact?: boolean;
}

const TeamMemberCard: React.FC<TeamMemberCardProps> = ({
  member,
  onViewProfile,
  onSendMessage,
  compact = false,
}) => {
  const roleLabel = ROLE_LABELS[member.role] || member.role;

  if (compact) {
    return (
      <tr className="hover:bg-cscx-gray-800/30 transition-colors">
        <td className="px-4 py-3 text-white">{roleLabel}</td>
        <td className="px-4 py-3 text-white font-medium">{member.name}</td>
        <td className="px-4 py-3 text-cscx-gray-400">{formatRelativeDate(member.lastActivity)}</td>
        <td className="px-4 py-3 text-cscx-gray-400 truncate max-w-[200px]">
          {member.nextScheduledAction || '-'}
        </td>
      </tr>
    );
  }

  return (
    <div className="bg-cscx-gray-800/50 rounded-xl p-4 border border-cscx-gray-700">
      {/* Header */}
      <div className="flex items-start justify-between mb-3">
        <div>
          <p className="text-sm text-cscx-gray-400 uppercase tracking-wide">{roleLabel}</p>
          <p className="text-lg font-semibold text-white">
            {member.name}
            {member.isPrimary && (
              <span className="ml-2 text-xs bg-cscx-accent/20 text-cscx-accent px-2 py-0.5 rounded">
                Primary
              </span>
            )}
          </p>
        </div>
        {member.photoUrl ? (
          <img
            src={member.photoUrl}
            alt={member.name}
            className="w-10 h-10 rounded-full bg-cscx-gray-700"
          />
        ) : (
          <div className="w-10 h-10 rounded-full bg-cscx-gray-700 flex items-center justify-center text-cscx-gray-400">
            {member.name
              .split(' ')
              .map((n) => n[0])
              .join('')
              .toUpperCase()}
          </div>
        )}
      </div>

      {/* Contact Info */}
      <div className="space-y-1 text-sm mb-4">
        <p className="text-cscx-gray-400">
          <span className="text-cscx-gray-500">Email:</span>{' '}
          <a href={`mailto:${member.email}`} className="text-white hover:text-cscx-accent">
            {member.email}
          </a>
        </p>
        {member.slackHandle && (
          <p className="text-cscx-gray-400">
            <span className="text-cscx-gray-500">Slack:</span> {member.slackHandle}
          </p>
        )}
        {member.phone && (
          <p className="text-cscx-gray-400">
            <span className="text-cscx-gray-500">Phone:</span> {member.phone}
          </p>
        )}
      </div>

      {/* Assignment & Activity */}
      <div className="border-t border-cscx-gray-700 pt-3 space-y-1 text-sm">
        <p className="text-cscx-gray-400">
          <span className="font-medium text-white">Assigned:</span> {formatDate(member.assignedDate)}{' '}
          ({getAssignmentDuration(member.assignedDate)})
        </p>
        <p className="text-cscx-gray-400">
          <span className="font-medium text-white">Last Activity:</span>{' '}
          {formatRelativeDate(member.lastActivity)}
          {member.activityCount30d > 0 && (
            <span className="text-cscx-gray-500 ml-1">({member.activityCount30d} touches)</span>
          )}
        </p>
        {member.nextScheduledAction && (
          <p className="text-cscx-gray-400">
            <span className="font-medium text-white">Next Action:</span> {member.nextScheduledAction}
          </p>
        )}
      </div>

      {/* Actions */}
      <div className="flex gap-2 mt-4">
        <button
          onClick={onViewProfile}
          className="flex-1 text-xs px-3 py-1.5 bg-cscx-gray-700 hover:bg-cscx-gray-600 text-white rounded transition-colors"
        >
          View Profile
        </button>
        <button
          onClick={onSendMessage}
          className="flex-1 text-xs px-3 py-1.5 bg-cscx-gray-700 hover:bg-cscx-gray-600 text-white rounded transition-colors"
        >
          Send Message
        </button>
      </div>
    </div>
  );
};

interface ActivityTimelineProps {
  activities: AccountTeamActivity[];
}

const ActivityTimeline: React.FC<ActivityTimelineProps> = ({ activities }) => {
  if (activities.length === 0) {
    return <p className="text-cscx-gray-500 text-center py-4">No recent activity</p>;
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="bg-cscx-gray-800/50">
            <th className="text-left px-4 py-2 text-cscx-gray-400 font-medium">Date</th>
            <th className="text-left px-4 py-2 text-cscx-gray-400 font-medium">Team Member</th>
            <th className="text-left px-4 py-2 text-cscx-gray-400 font-medium">Activity</th>
            <th className="text-left px-4 py-2 text-cscx-gray-400 font-medium">Details</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-cscx-gray-800">
          {activities.map((activity) => (
            <tr key={activity.id} className="hover:bg-cscx-gray-800/30 transition-colors">
              <td className="px-4 py-2 text-cscx-gray-400 whitespace-nowrap">
                {formatDate(activity.timestamp)}
              </td>
              <td className="px-4 py-2 text-white">{activity.userName}</td>
              <td className="px-4 py-2">
                <span className="px-2 py-0.5 text-xs bg-cscx-gray-700 text-cscx-gray-300 rounded">
                  {activity.activityType}
                </span>
              </td>
              <td className="px-4 py-2 text-cscx-gray-400">{activity.description}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

interface CoordinationSectionProps {
  recent: CoordinationEvent[];
  upcoming: CoordinationEvent[];
  onScheduleSync?: () => void;
}

const CoordinationSection: React.FC<CoordinationSectionProps> = ({
  recent,
  upcoming,
  onScheduleSync,
}) => {
  return (
    <div className="space-y-6">
      {/* Upcoming */}
      <div>
        <h4 className="text-sm font-medium text-white mb-3">Upcoming Coordination</h4>
        {upcoming.length === 0 ? (
          <p className="text-cscx-gray-500 text-sm">No upcoming meetings scheduled</p>
        ) : (
          <div className="space-y-2">
            {upcoming.map((event) => (
              <div
                key={event.id}
                className="flex items-center justify-between p-3 bg-cscx-gray-800/50 rounded-lg"
              >
                <div>
                  <p className="text-white font-medium">{event.topic}</p>
                  <p className="text-xs text-cscx-gray-400">
                    {event.participants.join(', ')} - {formatFutureDate(event.date)}
                  </p>
                </div>
                <span
                  className={`text-xs px-2 py-0.5 rounded ${
                    event.status === 'scheduled'
                      ? 'bg-green-500/20 text-green-400'
                      : 'bg-yellow-500/20 text-yellow-400'
                  }`}
                >
                  {event.status}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Recent */}
      <div>
        <h4 className="text-sm font-medium text-white mb-3">Recent Coordination</h4>
        {recent.length === 0 ? (
          <p className="text-cscx-gray-500 text-sm">No recent coordination</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-cscx-gray-800/50">
                  <th className="text-left px-3 py-2 text-cscx-gray-400 font-medium">Date</th>
                  <th className="text-left px-3 py-2 text-cscx-gray-400 font-medium">Topic</th>
                  <th className="text-left px-3 py-2 text-cscx-gray-400 font-medium">Participants</th>
                  <th className="text-left px-3 py-2 text-cscx-gray-400 font-medium">Outcome</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-cscx-gray-800">
                {recent.map((event) => (
                  <tr key={event.id} className="hover:bg-cscx-gray-800/30">
                    <td className="px-3 py-2 text-cscx-gray-400">{formatDate(event.date)}</td>
                    <td className="px-3 py-2 text-white">{event.topic}</td>
                    <td className="px-3 py-2 text-cscx-gray-400">{event.participants.join(', ')}</td>
                    <td className="px-3 py-2 text-cscx-gray-400">{event.outcome || '-'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Actions */}
      <div className="flex gap-2">
        <button
          onClick={onScheduleSync}
          className="px-4 py-2 text-sm bg-cscx-accent hover:bg-red-700 text-white rounded-lg transition-colors"
        >
          Schedule Team Sync
        </button>
        <button className="px-4 py-2 text-sm bg-cscx-gray-700 hover:bg-cscx-gray-600 text-white rounded-lg transition-colors">
          Create Agenda
        </button>
      </div>
    </div>
  );
};

interface CoverageAnalysisSectionProps {
  coverage: {
    roleCoverage: RoleCoverage[];
    engagementBalance: any[];
    coverageScore: number;
    gaps: string[];
    recommendations: string[];
  };
}

const CoverageAnalysisSection: React.FC<CoverageAnalysisSectionProps> = ({ coverage }) => {
  return (
    <div className="space-y-6">
      {/* Role Coverage Table */}
      <div>
        <h4 className="text-sm font-medium text-white mb-3">Role Coverage</h4>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-cscx-gray-800/50">
                <th className="text-left px-3 py-2 text-cscx-gray-400 font-medium">Role</th>
                <th className="text-left px-3 py-2 text-cscx-gray-400 font-medium">Required?</th>
                <th className="text-left px-3 py-2 text-cscx-gray-400 font-medium">Assigned</th>
                <th className="text-left px-3 py-2 text-cscx-gray-400 font-medium">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-cscx-gray-800">
              {coverage.roleCoverage.map((rc) => (
                <tr key={rc.role} className="hover:bg-cscx-gray-800/30">
                  <td className="px-3 py-2 text-white">{rc.roleLabel}</td>
                  <td className="px-3 py-2 text-cscx-gray-400">
                    {rc.required ? 'Yes' : 'As needed'}
                  </td>
                  <td className="px-3 py-2 text-white">{rc.assigned?.name || '-'}</td>
                  <td className="px-3 py-2">
                    {rc.status === 'covered' && (
                      <span className="text-green-400 flex items-center gap-1">
                        <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                          <path
                            fillRule="evenodd"
                            d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                            clipRule="evenodd"
                          />
                        </svg>
                        Covered
                      </span>
                    )}
                    {rc.status === 'gap' && (
                      <span className="text-red-400 flex items-center gap-1">
                        <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                          <path
                            fillRule="evenodd"
                            d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z"
                            clipRule="evenodd"
                          />
                        </svg>
                        Gap
                      </span>
                    )}
                    {rc.status === 'as_needed' && (
                      <span className="text-cscx-gray-400">As needed</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Engagement Balance */}
      <div>
        <h4 className="text-sm font-medium text-white mb-3">Engagement Balance</h4>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-cscx-gray-800/50">
                <th className="text-left px-3 py-2 text-cscx-gray-400 font-medium">Team Member</th>
                <th className="text-left px-3 py-2 text-cscx-gray-400 font-medium">
                  Touch Points (30d)
                </th>
                <th className="text-left px-3 py-2 text-cscx-gray-400 font-medium">Expected</th>
                <th className="text-left px-3 py-2 text-cscx-gray-400 font-medium">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-cscx-gray-800">
              {coverage.engagementBalance.map((eb) => {
                const { color, icon } = getEngagementStatus(eb.status);
                return (
                  <tr key={eb.userId} className="hover:bg-cscx-gray-800/30">
                    <td className="px-3 py-2 text-white">{eb.name}</td>
                    <td className="px-3 py-2 text-white">{eb.touchPoints30d}</td>
                    <td className="px-3 py-2 text-cscx-gray-400">
                      {eb.expectedMin === 0 && eb.expectedMax === 0
                        ? 'As needed'
                        : `${eb.expectedMin}-${eb.expectedMax}`}
                    </td>
                    <td className="px-3 py-2">
                      <span className={`flex items-center gap-1 ${color}`}>
                        {icon === 'check' ? (
                          <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                            <path
                              fillRule="evenodd"
                              d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                              clipRule="evenodd"
                            />
                          </svg>
                        ) : (
                          <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                            <path
                              fillRule="evenodd"
                              d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z"
                              clipRule="evenodd"
                            />
                          </svg>
                        )}
                        {eb.status === 'active'
                          ? 'Active'
                          : eb.status === 'ok'
                          ? 'OK'
                          : 'Overdue'}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Recommendations */}
      {coverage.recommendations.length > 0 && (
        <div>
          <h4 className="text-sm font-medium text-white mb-3">Recommendations</h4>
          <ul className="space-y-2">
            {coverage.recommendations.map((rec, idx) => (
              <li key={idx} className="flex items-start gap-2 text-sm text-cscx-gray-300">
                <svg
                  className="w-4 h-4 text-yellow-400 mt-0.5 flex-shrink-0"
                  fill="currentColor"
                  viewBox="0 0 20 20"
                >
                  <path
                    fillRule="evenodd"
                    d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z"
                    clipRule="evenodd"
                  />
                </svg>
                {rec}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
};

// ============================================
// MAIN COMPONENT
// ============================================

interface AccountTeamViewProps {
  customerId: string;
  customerName?: string;
  onClose?: () => void;
  onSelectMember?: (memberId: string) => void;
}

export const AccountTeamView: React.FC<AccountTeamViewProps> = ({
  customerId,
  customerName,
  onClose,
  onSelectMember,
}) => {
  // State
  const [data, setData] = useState<AccountTeamResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showHistorical, setShowHistorical] = useState(false);
  const [activeTab, setActiveTab] = useState<'team' | 'activity' | 'coordination' | 'coverage'>(
    'team'
  );

  // Fetch team data
  const fetchTeamData = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const params = new URLSearchParams();
      if (showHistorical) {
        params.append('includeHistorical', 'true');
      }

      const response = await fetch(
        `${API_BASE}/intelligence/account-team/${customerId}?${params.toString()}`
      );

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error?.message || 'Failed to fetch account team');
      }

      const result = await response.json();
      setData(result.data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setLoading(false);
    }
  }, [customerId, showHistorical]);

  useEffect(() => {
    fetchTeamData();
  }, [fetchTeamData]);

  // Loading state
  if (loading && !data) {
    return (
      <div className="p-8 bg-cscx-gray-900 border border-cscx-gray-800 rounded-xl">
        <div className="flex items-center justify-center py-12">
          <div className="animate-spin w-8 h-8 border-2 border-cscx-accent border-t-transparent rounded-full" />
          <span className="ml-3 text-cscx-gray-400">Loading account team...</span>
        </div>
      </div>
    );
  }

  // Error state
  if (error && !data) {
    return (
      <div className="p-8 bg-cscx-gray-900 border border-cscx-gray-800 rounded-xl">
        <div className="text-center py-8">
          <p className="text-red-400 mb-4">{error}</p>
          <button
            onClick={fetchTeamData}
            className="px-4 py-2 text-sm bg-cscx-accent hover:bg-red-700 text-white rounded-lg transition-colors"
          >
            Try Again
          </button>
        </div>
      </div>
    );
  }

  if (!data) {
    return null;
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-cscx-gray-900 border border-cscx-gray-800 rounded-xl p-6">
        <div className="flex items-start justify-between">
          <div>
            <h2 className="text-2xl font-bold text-white">Account Team: {data.customerName}</h2>
            <p className="text-cscx-gray-400 text-sm mt-1">
              Last Updated: {formatRelativeDate(data.lastUpdated)}
            </p>
          </div>
          <div className="flex items-center gap-4">
            {/* Coverage Score */}
            <div className="text-right">
              <p className="text-xs text-cscx-gray-500 uppercase">Team Coverage Score</p>
              <div className="flex items-center gap-2 mt-1">
                <span className={`text-2xl font-bold ${getCoverageColor(data.coverageStatus)}`}>
                  {data.coverageScore}/100
                </span>
                <span
                  className={`text-xs px-2 py-0.5 rounded capitalize ${getCoverageBgColor(
                    data.coverageStatus
                  )}/20 ${getCoverageColor(data.coverageStatus)}`}
                >
                  {data.coverageStatus.replace('_', ' ')}
                </span>
              </div>
            </div>

            {onClose && (
              <button
                onClick={onClose}
                className="p-2 text-cscx-gray-400 hover:text-white hover:bg-cscx-gray-800 rounded-lg transition-colors"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M6 18L18 6M6 6l12 12"
                  />
                </svg>
              </button>
            )}
          </div>
        </div>

        {/* Coverage Status Message */}
        <div
          className={`mt-4 p-3 rounded-lg ${
            data.coverage.gaps.length === 0
              ? 'bg-green-500/10 border border-green-500/30'
              : 'bg-yellow-500/10 border border-yellow-500/30'
          }`}
        >
          <p
            className={`text-sm ${
              data.coverage.gaps.length === 0 ? 'text-green-400' : 'text-yellow-400'
            }`}
          >
            {data.coverage.gaps.length === 0
              ? 'All key roles covered | No gaps identified'
              : `${data.coverage.gaps.length} coverage gap${
                  data.coverage.gaps.length > 1 ? 's' : ''
                } identified`}
          </p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 border-b border-cscx-gray-800 pb-2">
        {(['team', 'activity', 'coordination', 'coverage'] as const).map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-4 py-2 text-sm font-medium rounded-t-lg transition-colors capitalize ${
              activeTab === tab
                ? 'bg-cscx-gray-800 text-white'
                : 'text-cscx-gray-400 hover:text-white'
            }`}
          >
            {tab}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      {activeTab === 'team' && (
        <div className="space-y-6">
          {/* Core Team */}
          <div className="bg-cscx-gray-900 border border-cscx-gray-800 rounded-xl p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-white">Core Team</h3>
              <button className="px-3 py-1.5 text-sm bg-cscx-accent hover:bg-red-700 text-white rounded-lg transition-colors">
                + Add Team Member
              </button>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
              {data.coreTeam.map((member) => (
                <TeamMemberCard
                  key={member.id}
                  member={member}
                  onViewProfile={() => onSelectMember?.(member.id)}
                />
              ))}
            </div>
          </div>

          {/* Extended Team */}
          <div className="bg-cscx-gray-900 border border-cscx-gray-800 rounded-xl p-6">
            <h3 className="text-lg font-semibold text-white mb-4">Extended Team</h3>
            {data.extendedTeam.length === 0 ? (
              <p className="text-cscx-gray-500">No extended team members assigned</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-cscx-gray-800/50">
                      <th className="text-left px-4 py-2 text-cscx-gray-400 font-medium">Role</th>
                      <th className="text-left px-4 py-2 text-cscx-gray-400 font-medium">Name</th>
                      <th className="text-left px-4 py-2 text-cscx-gray-400 font-medium">
                        Last Active
                      </th>
                      <th className="text-left px-4 py-2 text-cscx-gray-400 font-medium">Focus</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-cscx-gray-800">
                    {data.extendedTeam.map((member) => (
                      <TeamMemberCard key={member.id} member={member} compact />
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Historical Team (Toggle) */}
          <div className="flex items-center gap-3">
            <label className="flex items-center gap-2 text-sm text-cscx-gray-400 cursor-pointer">
              <input
                type="checkbox"
                checked={showHistorical}
                onChange={(e) => setShowHistorical(e.target.checked)}
                className="w-4 h-4 rounded border-cscx-gray-600 bg-cscx-gray-800 text-cscx-accent focus:ring-cscx-accent"
              />
              Show past team members
            </label>
          </div>

          {showHistorical && data.historicalTeam && data.historicalTeam.length > 0 && (
            <div className="bg-cscx-gray-900 border border-cscx-gray-800 rounded-xl p-6">
              <h3 className="text-lg font-semibold text-white mb-4">Historical Team</h3>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-cscx-gray-800/50">
                      <th className="text-left px-4 py-2 text-cscx-gray-400 font-medium">Role</th>
                      <th className="text-left px-4 py-2 text-cscx-gray-400 font-medium">Name</th>
                      <th className="text-left px-4 py-2 text-cscx-gray-400 font-medium">
                        End Date
                      </th>
                      <th className="text-left px-4 py-2 text-cscx-gray-400 font-medium">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-cscx-gray-800">
                    {data.historicalTeam.map((member) => (
                      <tr key={member.id} className="hover:bg-cscx-gray-800/30 opacity-60">
                        <td className="px-4 py-3 text-white">
                          {ROLE_LABELS[member.role] || member.role}
                        </td>
                        <td className="px-4 py-3 text-white">{member.name}</td>
                        <td className="px-4 py-3 text-cscx-gray-400">
                          {formatDate(member.endDate)}
                        </td>
                        <td className="px-4 py-3 text-cscx-gray-500 capitalize">{member.status}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Communication Channels */}
          <div className="bg-cscx-gray-900 border border-cscx-gray-800 rounded-xl p-6">
            <h3 className="text-lg font-semibold text-white mb-4">Communication Channels</h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {data.channels.map((channel, idx) => (
                <div
                  key={idx}
                  className="flex items-center gap-3 p-3 bg-cscx-gray-800/50 rounded-lg hover:bg-cscx-gray-800 transition-colors cursor-pointer"
                >
                  <div className="text-cscx-gray-400">{getChannelIcon(channel.type)}</div>
                  <div className="flex-1">
                    <p className="text-white font-medium">{channel.name}</p>
                    {channel.memberCount && (
                      <p className="text-xs text-cscx-gray-500">
                        {channel.memberCount} members
                        {channel.isActive && ' | Active'}
                      </p>
                    )}
                  </div>
                  <svg
                    className="w-4 h-4 text-cscx-gray-500"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"
                    />
                  </svg>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {activeTab === 'activity' && (
        <div className="bg-cscx-gray-900 border border-cscx-gray-800 rounded-xl p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-white">Team Activity (Last 30 Days)</h3>
            <button className="px-3 py-1.5 text-sm bg-cscx-gray-700 hover:bg-cscx-gray-600 text-white rounded-lg transition-colors">
              Export Log
            </button>
          </div>
          <ActivityTimeline activities={data.recentActivity} />
        </div>
      )}

      {activeTab === 'coordination' && (
        <div className="bg-cscx-gray-900 border border-cscx-gray-800 rounded-xl p-6">
          <h3 className="text-lg font-semibold text-white mb-4">Coordination Status</h3>
          <CoordinationSection
            recent={data.recentCoordination}
            upcoming={data.upcomingCoordination}
          />
        </div>
      )}

      {activeTab === 'coverage' && (
        <div className="bg-cscx-gray-900 border border-cscx-gray-800 rounded-xl p-6">
          <h3 className="text-lg font-semibold text-white mb-4">Coverage Analysis</h3>
          <CoverageAnalysisSection coverage={data.coverage} />
        </div>
      )}

      {/* Team Changes History */}
      <div className="bg-cscx-gray-900 border border-cscx-gray-800 rounded-xl p-6">
        <h3 className="text-lg font-semibold text-white mb-4">Team Changes History</h3>
        {data.teamChanges.length === 0 ? (
          <p className="text-cscx-gray-500">No team changes recorded</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-cscx-gray-800/50">
                  <th className="text-left px-4 py-2 text-cscx-gray-400 font-medium">Date</th>
                  <th className="text-left px-4 py-2 text-cscx-gray-400 font-medium">Change</th>
                  <th className="text-left px-4 py-2 text-cscx-gray-400 font-medium">Details</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-cscx-gray-800">
                {data.teamChanges.map((change) => (
                  <tr key={change.id} className="hover:bg-cscx-gray-800/30">
                    <td className="px-4 py-2 text-cscx-gray-400">{formatDate(change.date)}</td>
                    <td className="px-4 py-2 capitalize text-white">
                      {change.changeType.replace('_', ' ')}
                    </td>
                    <td className="px-4 py-2 text-cscx-gray-400">{change.description}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Quick Actions */}
      <div className="flex gap-3 justify-end">
        <button className="px-4 py-2 text-sm bg-cscx-gray-700 hover:bg-cscx-gray-600 text-white rounded-lg transition-colors">
          Open Slack Channel
        </button>
        <button className="px-4 py-2 text-sm bg-cscx-gray-700 hover:bg-cscx-gray-600 text-white rounded-lg transition-colors">
          Update Roles
        </button>
        <button className="px-4 py-2 text-sm bg-cscx-accent hover:bg-red-700 text-white rounded-lg transition-colors">
          + Add Team Member
        </button>
      </div>
    </div>
  );
};

export default AccountTeamView;
