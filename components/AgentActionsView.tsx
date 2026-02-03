/**
 * AgentActionsView - Agent Actions Inbox
 * PRD-3: Agent Inbox View
 * View and manage pending agent actions for HITL approval
 */

import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../context/AuthContext';

const API_BASE = `${import.meta.env.VITE_API_URL || ''}/api`;

// Uses /api/approvals endpoint (database-backed)
interface AgentAction {
  id: string;
  agentName: string;
  actionType: string;
  description: string;
  status: 'pending' | 'approved' | 'rejected' | 'modified' | 'expired';
  payload: Record<string, any>;
  customerId?: string;
  customerName?: string;
  createdAt: string;
  updatedAt?: string;
  approvedBy?: string;
  rejectedReason?: string;
  originalContent?: string;
}

interface AgentActionsViewProps {
  onClose?: () => void;
}

export const AgentActionsView: React.FC<AgentActionsViewProps> = ({ onClose }) => {
  const { getAuthHeaders, userId } = useAuth();
  const [actions, setActions] = useState<AgentAction[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<string>('pending');
  const [selectedAction, setSelectedAction] = useState<AgentAction | null>(null);
  const [processing, setProcessing] = useState<string | null>(null);

  const fetchActions = useCallback(async () => {
    try {
      // Use /api/approvals for pending, /api/approvals/history for others
      const endpoint = filter === 'pending' || filter === 'all'
        ? `${API_BASE}/approvals`
        : `${API_BASE}/approvals/history?status=${filter}`;

      const response = await fetch(endpoint, {
        headers: {
          ...getAuthHeaders(),
          'x-user-id': userId || 'anonymous'
        }
      });

      if (!response.ok) throw new Error('Failed to fetch actions');

      const data = await response.json();

      // Transform approval items to AgentAction format
      const items = data.items || data.approvals || [];
      const transformed: AgentAction[] = items.map((item: any) => ({
        id: item.id,
        agentName: item.actionData?._toolName || item.actionType || 'Agent',
        actionType: item.actionType || item.action_type,
        description: item.originalContent || item.original_content || formatActionDescription(item),
        status: item.status,
        payload: item.actionData || item.action_data || {},
        customerId: item.actionData?.customerId,
        createdAt: item.createdAt || item.created_at,
        updatedAt: item.reviewedAt || item.reviewed_at,
        originalContent: item.originalContent || item.original_content
      }));

      // For 'all' filter, also fetch history
      if (filter === 'all') {
        const historyResponse = await fetch(`${API_BASE}/approvals/history`, {
          headers: {
            ...getAuthHeaders(),
            'x-user-id': userId || 'anonymous'
          }
        });
        if (historyResponse.ok) {
          const historyData = await historyResponse.json();
          const historyItems = (historyData.items || []).map((item: any) => ({
            id: item.id,
            agentName: item.actionData?._toolName || item.actionType || 'Agent',
            actionType: item.actionType || item.action_type,
            description: item.originalContent || item.original_content || formatActionDescription(item),
            status: item.status,
            payload: item.actionData || item.action_data || {},
            customerId: item.actionData?.customerId,
            createdAt: item.createdAt || item.created_at,
            updatedAt: item.reviewedAt || item.reviewed_at,
            originalContent: item.originalContent || item.original_content
          }));
          transformed.push(...historyItems);
        }
      }

      setActions(transformed);
      setError(null);
    } catch (err) {
      // If endpoint doesn't exist or returns error, show empty state
      setActions([]);
      setError(null);
    } finally {
      setLoading(false);
    }
  }, [filter, getAuthHeaders, userId]);

  // Helper to format action description
  const formatActionDescription = (item: any): string => {
    const data = item.actionData || item.action_data || {};
    switch (item.actionType || item.action_type) {
      case 'send_email':
        return `Email: "${data.subject}" to ${data.to?.join(', ') || 'recipients'}`;
      case 'schedule_meeting':
        return `Meeting: "${data.title}" with ${data.attendees?.join(', ') || 'attendees'}`;
      case 'create_task':
        return `Task: "${data.title}"`;
      case 'create_document':
        return `Document: "${data.title || data.name}"`;
      default:
        return `${item.actionType || item.action_type}: Action pending approval`;
    }
  };

  useEffect(() => {
    fetchActions();
    // Refresh every 10 seconds for real-time updates
    const interval = setInterval(fetchActions, 10000);
    return () => clearInterval(interval);
  }, [fetchActions]);

  const handleApprove = async (actionId: string) => {
    setProcessing(actionId);
    try {
      const response = await fetch(`${API_BASE}/approvals/${actionId}/approve`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...getAuthHeaders(),
          'x-user-id': userId || 'anonymous'
        }
      });

      if (!response.ok) throw new Error('Failed to approve action');

      // Update local state
      setActions(prev => prev.map(a =>
        a.id === actionId ? { ...a, status: 'approved' as const } : a
      ));
      setSelectedAction(null);
      // Refresh to get latest status
      fetchActions();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to approve');
    } finally {
      setProcessing(null);
    }
  };

  const handleReject = async (actionId: string, reason?: string) => {
    setProcessing(actionId);
    try {
      const response = await fetch(`${API_BASE}/approvals/${actionId}/reject`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...getAuthHeaders(),
          'x-user-id': userId || 'anonymous'
        },
        body: JSON.stringify({ reviewerNotes: reason })
      });

      if (!response.ok) throw new Error('Failed to reject action');

      // Update local state
      setActions(prev => prev.map(a =>
        a.id === actionId ? { ...a, status: 'rejected' as const, rejectedReason: reason } : a
      ));
      setSelectedAction(null);
      // Refresh to get latest status
      fetchActions();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to reject');
    } finally {
      setProcessing(null);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'pending': return 'bg-yellow-500/20 text-yellow-400';
      case 'approved': return 'bg-green-500/20 text-green-400';
      case 'rejected': return 'bg-red-500/20 text-red-400';
      case 'executed': return 'bg-blue-500/20 text-blue-400';
      default: return 'bg-cscx-gray-800 text-cscx-gray-400';
    }
  };

  const getActionIcon = (actionType: string) => {
    switch (actionType) {
      case 'send_email':
        return <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />;
      case 'book_meeting':
        return <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />;
      case 'create_document':
        return <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />;
      case 'update_crm':
        return <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 7v10c0 2.21 3.582 4 8 4s8-1.79 8-4V7M4 7c0 2.21 3.582 4 8 4s8-1.79 8-4M4 7c0-2.21 3.582-4 8-4s8 1.79 8 4" />;
      default:
        return <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />;
    }
  };

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffMins < 1440) return `${Math.floor(diffMins / 60)}h ago`;
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-cscx-accent"></div>
      </div>
    );
  }

  const pendingCount = actions.filter(a => a.status === 'pending').length;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold text-white flex items-center gap-2">
            Agent Actions
            {pendingCount > 0 && (
              <span className="px-2 py-0.5 text-xs bg-yellow-500/20 text-yellow-400 rounded-full">
                {pendingCount} pending
              </span>
            )}
          </h2>
          <p className="text-sm text-cscx-gray-400 mt-1">
            Review and approve agent actions
          </p>
        </div>
        {onClose && (
          <button
            onClick={onClose}
            className="p-2 text-cscx-gray-400 hover:text-white rounded-lg transition-colors"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        )}
      </div>

      {/* Filter Tabs */}
      <div className="flex gap-2 border-b border-cscx-gray-800 pb-2">
        {['pending', 'approved', 'rejected', 'executed', 'all'].map((status) => (
          <button
            key={status}
            onClick={() => setFilter(status)}
            className={`px-3 py-1.5 text-sm rounded-lg transition-colors flex items-center gap-1 ${
              filter === status
                ? 'bg-cscx-accent text-white'
                : 'text-cscx-gray-400 hover:text-white hover:bg-cscx-gray-800'
            }`}
          >
            {status.charAt(0).toUpperCase() + status.slice(1)}
            {status === 'pending' && pendingCount > 0 && (
              <span className="w-5 h-5 text-xs bg-yellow-500 text-black rounded-full flex items-center justify-center">
                {pendingCount}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Actions List */}
      {actions.length === 0 ? (
        <div className="bg-cscx-gray-900 border border-cscx-gray-800 rounded-xl p-8 text-center">
          <svg className="w-12 h-12 text-cscx-gray-600 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
          </svg>
          <p className="text-cscx-gray-400">No {filter === 'all' ? '' : filter} actions</p>
          <p className="text-sm text-cscx-gray-500 mt-1">
            {filter === 'pending' ? 'All caught up!' : 'Actions will appear here when agents perform tasks'}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {actions.map((action) => (
            <div
              key={action.id}
              className="bg-cscx-gray-900 border border-cscx-gray-800 rounded-xl p-4 hover:border-cscx-gray-700 transition-colors"
            >
              <div className="flex items-start gap-4">
                {/* Icon */}
                <div className="w-10 h-10 bg-cscx-gray-800 rounded-lg flex items-center justify-center flex-shrink-0">
                  <svg className="w-5 h-5 text-cscx-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    {getActionIcon(action.actionType)}
                  </svg>
                </div>

                {/* Content */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-sm font-medium text-cscx-accent">{action.agentName}</span>
                    <span className="text-cscx-gray-600">•</span>
                    <span className="text-sm text-cscx-gray-400">{action.actionType.replace('_', ' ')}</span>
                    <span className={`px-2 py-0.5 text-xs rounded-full ${getStatusColor(action.status)}`}>
                      {action.status}
                    </span>
                  </div>
                  <p className="text-white">{action.description}</p>
                  {action.customerName && (
                    <p className="text-sm text-cscx-gray-400 mt-1">Customer: {action.customerName}</p>
                  )}
                  <p className="text-xs text-cscx-gray-500 mt-2">{formatDate(action.createdAt)}</p>
                </div>

                {/* Actions */}
                {action.status === 'pending' && (
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <button
                      onClick={() => handleApprove(action.id)}
                      disabled={processing === action.id}
                      className="px-3 py-1.5 bg-green-500/20 text-green-400 rounded-lg hover:bg-green-500/30 transition-colors text-sm disabled:opacity-50"
                    >
                      Approve
                    </button>
                    <button
                      onClick={() => setSelectedAction(action)}
                      disabled={processing === action.id}
                      className="px-3 py-1.5 bg-red-500/20 text-red-400 rounded-lg hover:bg-red-500/30 transition-colors text-sm disabled:opacity-50"
                    >
                      Reject
                    </button>
                    <button
                      onClick={() => setSelectedAction(action)}
                      className="p-1.5 text-cscx-gray-400 hover:text-white rounded-lg transition-colors"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                      </svg>
                    </button>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Action Detail Modal */}
      {selectedAction && (
        <ActionDetailModal
          action={selectedAction}
          onClose={() => setSelectedAction(null)}
          onApprove={() => handleApprove(selectedAction.id)}
          onReject={(reason) => handleReject(selectedAction.id, reason)}
          processing={processing === selectedAction.id}
        />
      )}
    </div>
  );
};

// Action Detail Modal Component
const ActionDetailModal: React.FC<{
  action: AgentAction;
  onClose: () => void;
  onApprove: () => void;
  onReject: (reason?: string) => void;
  processing: boolean;
}> = ({ action, onClose, onApprove, onReject, processing }) => {
  const [rejectReason, setRejectReason] = useState('');
  const [showRejectForm, setShowRejectForm] = useState(false);

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-cscx-gray-900 border border-cscx-gray-800 rounded-xl max-w-2xl w-full max-h-[80vh] overflow-y-auto">
        <div className="p-4 border-b border-cscx-gray-800 flex items-center justify-between">
          <h3 className="text-lg font-medium text-white">Action Details</h3>
          <button
            onClick={onClose}
            className="p-2 text-cscx-gray-400 hover:text-white rounded-lg transition-colors"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="p-4 space-y-4">
          {/* Header Info */}
          <div>
            <div className="flex items-center gap-2 mb-2">
              <span className="text-sm font-medium text-cscx-accent">{action.agentName}</span>
              <span className="text-cscx-gray-600">•</span>
              <span className="text-sm text-cscx-gray-400">{action.actionType.replace('_', ' ')}</span>
            </div>
            <h4 className="text-xl font-medium text-white">{action.description}</h4>
          </div>

          {/* Payload */}
          {action.payload && Object.keys(action.payload).length > 0 && (
            <div>
              <h5 className="text-sm font-medium text-cscx-gray-400 mb-2">Action Payload</h5>
              <div className="bg-cscx-gray-800 rounded-lg p-4 overflow-x-auto">
                <pre className="text-sm text-cscx-gray-300 whitespace-pre-wrap">
                  {JSON.stringify(action.payload, null, 2)}
                </pre>
              </div>
            </div>
          )}

          {/* Reject Form */}
          {showRejectForm && action.status === 'pending' && (
            <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-4">
              <h5 className="text-sm font-medium text-red-400 mb-2">Rejection Reason (optional)</h5>
              <textarea
                value={rejectReason}
                onChange={(e) => setRejectReason(e.target.value)}
                placeholder="Why are you rejecting this action?"
                rows={3}
                className="w-full px-4 py-2.5 bg-cscx-gray-800 border border-cscx-gray-700 rounded-lg text-white placeholder-cscx-gray-500 focus:outline-none focus:border-red-500 resize-none"
              />
            </div>
          )}

          {/* Actions */}
          {action.status === 'pending' && (
            <div className="flex justify-end gap-3 pt-4 border-t border-cscx-gray-800">
              {!showRejectForm ? (
                <>
                  <button
                    onClick={() => setShowRejectForm(true)}
                    className="px-4 py-2 bg-red-500/20 text-red-400 rounded-lg hover:bg-red-500/30 transition-colors"
                  >
                    Reject
                  </button>
                  <button
                    onClick={onApprove}
                    disabled={processing}
                    className="px-4 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600 transition-colors disabled:opacity-50 flex items-center gap-2"
                  >
                    {processing && (
                      <div className="animate-spin rounded-full h-4 w-4 border-t-2 border-b-2 border-white"></div>
                    )}
                    Approve
                  </button>
                </>
              ) : (
                <>
                  <button
                    onClick={() => setShowRejectForm(false)}
                    className="px-4 py-2 text-cscx-gray-400 hover:text-white transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={() => onReject(rejectReason)}
                    disabled={processing}
                    className="px-4 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600 transition-colors disabled:opacity-50 flex items-center gap-2"
                  >
                    {processing && (
                      <div className="animate-spin rounded-full h-4 w-4 border-t-2 border-b-2 border-white"></div>
                    )}
                    Confirm Reject
                  </button>
                </>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default AgentActionsView;
