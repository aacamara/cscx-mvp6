/**
 * Agent Notifications Component
 * Shows real-time notifications from agent execution
 */

import React, { useState, useRef, useEffect } from 'react';
import { useWebSocket } from '../context/WebSocketContext';

export const AgentNotifications: React.FC = () => {
  const { connected, events, unreadCount, markAsRead, markAllAsRead, clearEvents, pendingApprovals } = useWebSocket();
  const [showDropdown, setShowDropdown] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setShowDropdown(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const getEventIcon = (type: string) => {
    switch (type) {
      case 'run:start':
        return '🚀';
      case 'run:end':
        return '✅';
      case 'step':
        return '⚡';
      case 'approval_required':
        return '⚠️';
      case 'agent_message':
        return '💬';
      default:
        return '📌';
    }
  };

  const getEventColor = (type: string) => {
    switch (type) {
      case 'run:start':
        return 'border-blue-500';
      case 'run:end':
        return 'border-green-500';
      case 'step':
        return 'border-gray-500';
      case 'approval_required':
        return 'border-yellow-500';
      case 'agent_message':
        return 'border-purple-500';
      default:
        return 'border-gray-500';
    }
  };

  const formatTime = (timestamp: string) => {
    const date = new Date(timestamp);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffMins < 1440) return `${Math.floor(diffMins / 60)}h ago`;
    return date.toLocaleDateString();
  };

  return (
    <div className="relative" ref={dropdownRef}>
      {/* Notification Bell */}
      <button
        onClick={() => setShowDropdown(!showDropdown)}
        className={`relative p-2 rounded-lg transition-colors ${
          showDropdown
            ? 'bg-cscx-gray-700'
            : 'hover:bg-cscx-gray-800'
        }`}
        title="Agent Notifications"
      >
        {/* Bell Icon */}
        <svg
          className={`w-5 h-5 ${connected ? 'text-white' : 'text-gray-500'}`}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9"
          />
        </svg>

        {/* Unread Badge */}
        {unreadCount > 0 && (
          <span className="absolute -top-1 -right-1 flex items-center justify-center w-5 h-5 text-xs font-bold text-white bg-cscx-accent rounded-full">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}

        {/* Connection Status Dot */}
        <span
          className={`absolute bottom-0 right-0 w-2 h-2 rounded-full ${
            connected ? 'bg-green-500' : 'bg-red-500'
          }`}
          title={connected ? 'Connected' : 'Disconnected'}
        />
      </button>

      {/* Dropdown */}
      {showDropdown && (
        <div className="absolute right-0 mt-2 w-96 bg-cscx-gray-900 border border-cscx-gray-700 rounded-lg shadow-xl z-50 max-h-[500px] overflow-hidden flex flex-col">
          {/* Header */}
          <div className="px-4 py-3 border-b border-cscx-gray-700 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium text-white">Agent Activity</span>
              <span
                className={`w-2 h-2 rounded-full ${connected ? 'bg-green-500' : 'bg-red-500'}`}
              />
            </div>
            <div className="flex items-center gap-2">
              {unreadCount > 0 && (
                <button
                  onClick={markAllAsRead}
                  className="text-xs text-cscx-gray-400 hover:text-white"
                >
                  Mark all read
                </button>
              )}
              {events.length > 0 && (
                <button
                  onClick={clearEvents}
                  className="text-xs text-cscx-gray-400 hover:text-white"
                >
                  Clear
                </button>
              )}
            </div>
          </div>

          {/* Pending Approvals Alert */}
          {pendingApprovals.length > 0 && (
            <div className="px-4 py-2 bg-yellow-900/30 border-b border-yellow-600/30">
              <div className="flex items-center gap-2 text-yellow-400 text-sm">
                <span>⚠️</span>
                <span>{pendingApprovals.length} action(s) waiting for your approval</span>
              </div>
            </div>
          )}

          {/* Events List */}
          <div className="flex-1 overflow-y-auto">
            {events.length === 0 ? (
              <div className="px-4 py-8 text-center text-cscx-gray-400">
                <div className="text-2xl mb-2">🤖</div>
                <p className="text-sm">No agent activity yet</p>
                <p className="text-xs mt-1">Events will appear here when agents execute</p>
              </div>
            ) : (
              <div className="divide-y divide-cscx-gray-800">
                {events.map(event => (
                  <div
                    key={event.id}
                    onClick={() => markAsRead(event.id)}
                    className={`px-4 py-3 hover:bg-cscx-gray-800 cursor-pointer transition-colors ${
                      !event.read ? 'bg-cscx-gray-800/50' : ''
                    }`}
                  >
                    <div className="flex items-start gap-3">
                      {/* Event Icon */}
                      <div className={`mt-0.5 p-1.5 rounded border-l-2 ${getEventColor(event.type)}`}>
                        <span className="text-sm">{getEventIcon(event.type)}</span>
                      </div>

                      {/* Event Content */}
                      <div className="flex-1 min-w-0">
                        <p className={`text-sm ${!event.read ? 'text-white font-medium' : 'text-cscx-gray-300'}`}>
                          {event.message}
                        </p>
                        {event.agentName && (
                          <p className="text-xs text-cscx-gray-500 mt-0.5">
                            Agent: {event.agentName}
                          </p>
                        )}
                        <p className="text-xs text-cscx-gray-500 mt-1">
                          {formatTime(event.timestamp)}
                        </p>
                      </div>

                      {/* Unread Indicator */}
                      {!event.read && (
                        <div className="w-2 h-2 rounded-full bg-cscx-accent mt-2" />
                      )}
                    </div>

                    {/* Action Button for Approvals */}
                    {event.type === 'approval_required' && !event.read && (
                      <div className="mt-2 ml-9">
                        <button className="px-3 py-1 text-xs font-medium bg-cscx-accent hover:bg-cscx-accent/80 text-white rounded transition-colors">
                          Review & Approve
                        </button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="px-4 py-2 border-t border-cscx-gray-700 bg-cscx-gray-800/50">
            <p className="text-xs text-cscx-gray-500 text-center">
              {connected
                ? 'Real-time updates enabled'
                : 'Reconnecting...'}
            </p>
          </div>
        </div>
      )}
    </div>
  );
};

export default AgentNotifications;
