/**
 * AgentInbox - Thread Management & Notifications
 * Monitor agent threads, handle interruptions, view execution history
 */

import React, { useState, useEffect, useCallback } from 'react';
import {
  AgentThread,
  ThreadStatus,
  ThreadStep,
  InboxNotification,
  AgentDefinition,
} from '../../types/agentBuilder';

const API_URL = import.meta.env.VITE_API_URL || '';

interface AgentInboxProps {
  agents: AgentDefinition[];
  onThreadSelect?: (thread: AgentThread) => void;
}

// Transform API data to AgentThread format
const transformAgentRuns = (runs: any[]): AgentThread[] => {
  return runs.map(run => {
    const status: ThreadStatus = run.status === 'completed' ? 'completed'
      : run.status === 'failed' ? 'errored'
      : run.status === 'running' ? 'busy'
      : run.status === 'pending_approval' ? 'interrupted'
      : 'idle';

    const steps: ThreadStep[] = (run.steps || []).map((step: any, i: number) => ({
      id: step.id || `step_${i}`,
      order: i,
      toolName: step.name || step.tool_name || 'unknown',
      toolInput: step.input || {},
      status: step.status === 'completed' ? 'completed' : step.status === 'running' ? 'running' : 'pending',
      startedAt: step.started_at ? new Date(step.started_at) : undefined,
      completedAt: step.completed_at ? new Date(step.completed_at) : undefined,
      pausedForReview: step.requires_approval || false,
      output: step.output,
      error: step.error
    }));

    return {
      id: run.id,
      agentId: run.agent_id || run.agentId,
      agentName: run.agent_name || run.agentName || run.agent_type || 'Agent',
      status,
      triggeredBy: run.trigger || 'manual',
      triggeredAt: new Date(run.started_at || run.created_at),
      completedAt: run.completed_at ? new Date(run.completed_at) : undefined,
      currentStep: steps.filter(s => s.status === 'completed').length,
      totalSteps: Math.max(steps.length, 1),
      steps,
      interruptionReason: run.pending_approval_reason || (status === 'interrupted' ? 'Awaiting approval' : undefined),
      requiresAttention: ['interrupted', 'errored'].includes(status),
      notifiedUser: true,
      customerContext: run.customer_context || run.customerContext || { id: run.customer_id, name: run.customer_name },
      error: run.error || run.error_message
    };
  });
};

// Generate notifications from threads that need attention
const generateNotifications = (threads: AgentThread[]): InboxNotification[] => {
  return threads
    .filter(t => t.requiresAttention)
    .map(t => ({
      id: `notif_${t.id}`,
      threadId: t.id,
      agentId: t.agentId,
      agentName: t.agentName,
      type: t.status === 'errored' ? 'error' : 'needs_attention',
      title: t.status === 'errored' ? 'Agent Error' : 'Agent Needs Help',
      message: t.error || t.interruptionReason || 'Agent requires your attention',
      priority: t.status === 'errored' ? 'high' : 'medium',
      createdAt: t.triggeredAt,
      actions: [
        { id: 'view', label: 'View Thread', type: 'primary', action: 'view_thread' },
        { id: 'retry', label: 'Retry', type: 'secondary', action: 'retry' },
        { id: 'dismiss', label: 'Dismiss', type: 'secondary', action: 'dismiss' },
      ],
    }));
};

export const AgentInbox: React.FC<AgentInboxProps> = ({ agents, onThreadSelect }) => {
  const [threads, setThreads] = useState<AgentThread[]>([]);
  const [notifications, setNotifications] = useState<InboxNotification[]>([]);
  const [selectedStatus, setSelectedStatus] = useState<ThreadStatus | 'all' | 'attention'>('all');
  const [selectedThread, setSelectedThread] = useState<AgentThread | null>(null);
  const [view, setView] = useState<'threads' | 'notifications'>('threads');
  const [isLoading, setIsLoading] = useState(true);

  // Fetch agent runs from API
  const fetchAgentRuns = useCallback(async () => {
    setIsLoading(true);
    try {
      const userId = localStorage.getItem('userId') || 'demo-user';

      const response = await fetch(`${API_URL}/api/agents/traces?limit=50`, {
        headers: { 'x-user-id': userId }
      });

      if (response.ok) {
        const data = await response.json();
        const runs = data.runs || data || [];
        const transformedThreads = transformAgentRuns(runs);
        setThreads(transformedThreads);
        setNotifications(generateNotifications(transformedThreads));
      } else {
        console.log('Failed to fetch agent runs, showing empty state');
        setThreads([]);
        setNotifications([]);
      }
    } catch (error) {
      console.error('Error fetching agent runs:', error);
      setThreads([]);
      setNotifications([]);
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Fetch on mount and poll every 30 seconds
  useEffect(() => {
    fetchAgentRuns();

    const interval = setInterval(fetchAgentRuns, 30000);
    return () => clearInterval(interval);
  }, [fetchAgentRuns]);

  // Filter threads
  const filteredThreads = threads.filter(t => {
    if (selectedStatus === 'all') return true;
    if (selectedStatus === 'attention') return t.requiresAttention;
    return t.status === selectedStatus;
  });

  // Count by status
  const statusCounts = {
    all: threads.length,
    attention: threads.filter(t => t.requiresAttention).length,
    idle: threads.filter(t => t.status === 'idle').length,
    busy: threads.filter(t => t.status === 'busy').length,
    interrupted: threads.filter(t => t.status === 'interrupted').length,
    errored: threads.filter(t => t.status === 'errored').length,
    completed: threads.filter(t => t.status === 'completed').length,
  };

  const getStatusColor = (status: ThreadStatus) => {
    switch (status) {
      case 'idle': return 'text-gray-400 bg-gray-500/20';
      case 'busy': return 'text-blue-400 bg-blue-500/20';
      case 'interrupted': return 'text-yellow-400 bg-yellow-500/20';
      case 'errored': return 'text-red-400 bg-red-500/20';
      case 'completed': return 'text-green-400 bg-green-500/20';
    }
  };

  const getStatusIcon = (status: ThreadStatus) => {
    switch (status) {
      case 'idle': return '⏸️';
      case 'busy': return '🔄';
      case 'interrupted': return '⚠️';
      case 'errored': return '❌';
      case 'completed': return '✅';
    }
  };

  const formatTime = (date: Date) => {
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);

    if (minutes < 1) return 'Just now';
    if (minutes < 60) return `${minutes}m ago`;
    if (hours < 24) return `${hours}h ago`;
    return date.toLocaleDateString();
  };

  // Handle notification actions
  const handleNotificationAction = (notification: InboxNotification, actionId: string) => {
    if (actionId === 'view_thread') {
      const thread = threads.find(t => t.id === notification.threadId);
      if (thread) setSelectedThread(thread);
    } else if (actionId === 'dismiss') {
      setNotifications(prev => prev.filter(n => n.id !== notification.id));
    } else if (actionId === 'retry') {
      // Simulate retry
      const thread = threads.find(t => t.id === notification.threadId);
      if (thread) {
        setThreads(prev => prev.map(t =>
          t.id === thread.id ? { ...t, status: 'busy', requiresAttention: false } : t
        ));
        setNotifications(prev => prev.filter(n => n.id !== notification.id));
      }
    }
  };

  return (
    <div className="bg-cscx-gray-900 border border-cscx-gray-800 rounded-xl overflow-hidden">
      {/* Header */}
      <div className="p-4 border-b border-cscx-gray-800">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-bold text-white flex items-center gap-2">
            <span>📥</span> Agent Inbox
          </h3>
          <div className="flex gap-2">
            <button
              onClick={() => setView('threads')}
              className={`px-3 py-1.5 text-sm rounded-lg transition-colors ${
                view === 'threads'
                  ? 'bg-cscx-accent text-white'
                  : 'bg-cscx-gray-800 text-cscx-gray-400 hover:text-white'
              }`}
            >
              Threads
            </button>
            <button
              onClick={() => setView('notifications')}
              className={`px-3 py-1.5 text-sm rounded-lg transition-colors relative ${
                view === 'notifications'
                  ? 'bg-cscx-accent text-white'
                  : 'bg-cscx-gray-800 text-cscx-gray-400 hover:text-white'
              }`}
            >
              Notifications
              {notifications.length > 0 && (
                <span className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 text-white text-xs rounded-full flex items-center justify-center">
                  {notifications.length}
                </span>
              )}
            </button>
          </div>
        </div>

        {/* Status Filters (for threads view) */}
        {view === 'threads' && (
          <div className="flex gap-2 mt-4 overflow-x-auto pb-2">
            {(['all', 'attention', 'busy', 'idle', 'interrupted', 'errored', 'completed'] as const).map(status => (
              <button
                key={status}
                onClick={() => setSelectedStatus(status)}
                className={`px-3 py-1.5 text-sm rounded-lg whitespace-nowrap transition-colors ${
                  selectedStatus === status
                    ? 'bg-cscx-accent text-white'
                    : 'bg-cscx-gray-800 text-cscx-gray-400 hover:text-white'
                }`}
              >
                {status === 'attention' ? '🔔' : status === 'all' ? '📋' : getStatusIcon(status as ThreadStatus)}
                {' '}{status.charAt(0).toUpperCase() + status.slice(1)}
                {' '}({statusCounts[status]})
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Thread List */}
      {view === 'threads' && !selectedThread && (
        <div className="max-h-[400px] overflow-y-auto">
          {isLoading ? (
            <div className="p-8 text-center">
              <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-cscx-accent mb-3"></div>
              <p className="text-cscx-gray-500">Loading agent threads...</p>
            </div>
          ) : filteredThreads.length === 0 ? (
            <div className="p-8 text-center">
              <div className="text-4xl mb-2">📭</div>
              <p className="text-cscx-gray-500">No threads found</p>
              <p className="text-cscx-gray-600 text-sm mt-1">Threads will appear here when agents run</p>
            </div>
          ) : (
            <div className="divide-y divide-cscx-gray-800">
              {filteredThreads.map(thread => (
                <button
                  key={thread.id}
                  onClick={() => {
                    setSelectedThread(thread);
                    onThreadSelect?.(thread);
                  }}
                  className="w-full p-4 text-left hover:bg-cscx-gray-800/50 transition-colors"
                >
                  <div className="flex items-start justify-between">
                    <div className="flex items-start gap-3">
                      <span className="text-2xl">{getStatusIcon(thread.status)}</span>
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="text-white font-medium">{thread.agentName}</span>
                          <span className={`px-2 py-0.5 text-xs rounded-full ${getStatusColor(thread.status)}`}>
                            {thread.status}
                          </span>
                          {thread.requiresAttention && (
                            <span className="px-2 py-0.5 text-xs rounded-full bg-red-500/20 text-red-400">
                              Needs Attention
                            </span>
                          )}
                        </div>
                        {thread.customerContext && (
                          <p className="text-sm text-cscx-gray-400 mt-0.5">
                            Customer: {thread.customerContext.name}
                          </p>
                        )}
                        {thread.error && (
                          <p className="text-sm text-red-400 mt-1">{thread.error}</p>
                        )}
                        {thread.interruptionReason && (
                          <p className="text-sm text-yellow-400 mt-1">{thread.interruptionReason}</p>
                        )}
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-xs text-cscx-gray-500">{formatTime(thread.triggeredAt)}</p>
                      <p className="text-xs text-cscx-gray-600 mt-1">
                        Step {thread.currentStep + 1}/{thread.totalSteps}
                      </p>
                    </div>
                  </div>

                  {/* Progress bar */}
                  <div className="mt-3 h-1.5 bg-cscx-gray-800 rounded-full overflow-hidden">
                    <div
                      className={`h-full transition-all ${
                        thread.status === 'errored' ? 'bg-red-500' :
                        thread.status === 'interrupted' ? 'bg-yellow-500' :
                        thread.status === 'completed' ? 'bg-green-500' :
                        'bg-cscx-accent'
                      }`}
                      style={{ width: `${((thread.currentStep + 1) / thread.totalSteps) * 100}%` }}
                    />
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Thread Detail */}
      {view === 'threads' && selectedThread && (
        <div className="p-4">
          <button
            onClick={() => setSelectedThread(null)}
            className="text-sm text-cscx-accent hover:text-red-400 mb-4 flex items-center gap-1"
          >
            ← Back to threads
          </button>

          <div className="space-y-4">
            {/* Thread Header */}
            <div className="flex items-start justify-between">
              <div>
                <h4 className="text-lg font-bold text-white flex items-center gap-2">
                  {getStatusIcon(selectedThread.status)} {selectedThread.agentName}
                </h4>
                {selectedThread.customerContext && (
                  <p className="text-sm text-cscx-gray-400">
                    Customer: {selectedThread.customerContext.name}
                  </p>
                )}
              </div>
              <span className={`px-3 py-1 text-sm rounded-full ${getStatusColor(selectedThread.status)}`}>
                {selectedThread.status}
              </span>
            </div>

            {/* Error/Interruption Message */}
            {(selectedThread.error || selectedThread.interruptionReason) && (
              <div className={`p-3 rounded-lg ${
                selectedThread.error ? 'bg-red-500/10 border border-red-500/30' : 'bg-yellow-500/10 border border-yellow-500/30'
              }`}>
                <p className={selectedThread.error ? 'text-red-400' : 'text-yellow-400'}>
                  {selectedThread.error || selectedThread.interruptionReason}
                </p>
              </div>
            )}

            {/* Steps */}
            <div>
              <h5 className="text-sm font-medium text-cscx-gray-400 mb-2">Execution Steps</h5>
              <div className="space-y-2">
                {selectedThread.steps.map((step, i) => (
                  <div
                    key={step.id}
                    className={`p-3 rounded-lg border ${
                      step.status === 'completed' ? 'bg-green-500/5 border-green-500/30' :
                      step.status === 'running' ? 'bg-blue-500/5 border-blue-500/30' :
                      step.status === 'failed' ? 'bg-red-500/5 border-red-500/30' :
                      'bg-cscx-gray-800 border-cscx-gray-700'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="text-lg">
                          {step.status === 'completed' ? '✅' :
                           step.status === 'running' ? '🔄' :
                           step.status === 'failed' ? '❌' :
                           step.status === 'paused' ? '⏸️' : '⏳'}
                        </span>
                        <span className="text-white font-medium">{step.toolName}</span>
                      </div>
                      <span className="text-xs text-cscx-gray-500">
                        {step.completedAt ? formatTime(step.completedAt) : step.startedAt ? 'Running...' : 'Pending'}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Actions */}
            {selectedThread.requiresAttention && (
              <div className="flex gap-2 pt-4 border-t border-cscx-gray-800">
                <button className="flex-1 px-4 py-2 bg-cscx-accent hover:bg-red-700 text-white rounded-lg transition-colors">
                  Retry
                </button>
                <button className="flex-1 px-4 py-2 bg-cscx-gray-800 hover:bg-cscx-gray-700 text-white rounded-lg transition-colors">
                  Provide Input
                </button>
                <button className="flex-1 px-4 py-2 bg-cscx-gray-800 hover:bg-cscx-gray-700 text-white rounded-lg transition-colors">
                  Dismiss
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Notifications List */}
      {view === 'notifications' && (
        <div className="max-h-[400px] overflow-y-auto">
          {notifications.length === 0 ? (
            <div className="p-8 text-center">
              <div className="text-4xl mb-2">🎉</div>
              <p className="text-cscx-gray-500">All caught up! No notifications.</p>
            </div>
          ) : (
            <div className="divide-y divide-cscx-gray-800">
              {notifications.map(notification => (
                <div key={notification.id} className="p-4">
                  <div className="flex items-start gap-3">
                    <span className="text-2xl">
                      {notification.type === 'error' ? '❌' :
                       notification.type === 'needs_attention' ? '⚠️' :
                       notification.type === 'needs_auth' ? '🔐' : '📢'}
                    </span>
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <span className="text-white font-medium">{notification.title}</span>
                        <span className={`px-2 py-0.5 text-xs rounded-full ${
                          notification.priority === 'urgent' ? 'bg-red-500/20 text-red-400' :
                          notification.priority === 'high' ? 'bg-orange-500/20 text-orange-400' :
                          'bg-yellow-500/20 text-yellow-400'
                        }`}>
                          {notification.priority}
                        </span>
                      </div>
                      <p className="text-sm text-cscx-gray-400 mt-1">{notification.message}</p>
                      <p className="text-xs text-cscx-gray-500 mt-1">
                        Agent: {notification.agentName} • {formatTime(notification.createdAt)}
                      </p>

                      {/* Actions */}
                      <div className="flex gap-2 mt-3">
                        {notification.actions?.map(action => (
                          <button
                            key={action.id}
                            onClick={() => handleNotificationAction(notification, action.action)}
                            className={`px-3 py-1.5 text-sm rounded-lg transition-colors ${
                              action.type === 'primary'
                                ? 'bg-cscx-accent hover:bg-red-700 text-white'
                                : action.type === 'danger'
                                  ? 'bg-red-500/20 hover:bg-red-500/30 text-red-400'
                                  : 'bg-cscx-gray-800 hover:bg-cscx-gray-700 text-white'
                            }`}
                          >
                            {action.label}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default AgentInbox;
