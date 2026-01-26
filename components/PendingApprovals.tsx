/**
 * Pending Approvals Component
 * Shows pending AI actions that need user approval
 */

import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';

interface ApprovalItem {
  id: string;
  actionType: 'send_email' | 'schedule_meeting' | 'create_task' | 'share_document' | 'other';
  actionData: Record<string, any>;
  originalContent?: string;
  status: 'pending' | 'approved' | 'rejected' | 'modified' | 'expired';
  createdAt: string;
  expiresAt: string;
}

interface PendingApprovalsProps {
  onApprovalChange?: () => void;
  refreshTrigger?: number;
  compact?: boolean;
}

const API_URL = import.meta.env.VITE_API_URL || '';

export function PendingApprovals({ onApprovalChange, refreshTrigger }: PendingApprovalsProps) {
  const { user, getAuthHeaders } = useAuth();
  const [approvals, setApprovals] = useState<ApprovalItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [expandedItems, setExpandedItems] = useState<Set<string>>(new Set());

  const fetchApprovals = async () => {
    if (!user?.id) {
      setApprovals([]);
      setLoading(false);
      return;
    }

    try {
      const response = await fetch(`${API_URL}/api/approvals`, {
        headers: getAuthHeaders()
      });

      if (response.ok) {
        const data = await response.json();
        setApprovals(data.items || []);
      } else {
        console.error('Approvals fetch failed:', response.status);
      }
    } catch (err) {
      console.error('Error fetching approvals:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (user?.id) {
      fetchApprovals();
      // Poll for new approvals every 30 seconds
      const interval = setInterval(fetchApprovals, 30000);
      return () => clearInterval(interval);
    } else {
      setLoading(false);
    }
  }, [user?.id]);

  // Refresh when trigger changes (e.g., after an action is created)
  useEffect(() => {
    if (refreshTrigger && refreshTrigger > 0) {
      fetchApprovals();
    }
  }, [refreshTrigger]);

  const handleApprove = async (id: string) => {
    if (!user?.id) return;
    setProcessing(id);
    setError(null);
    setSuccess(null);

    const item = approvals.find(a => a.id === id);

    try {
      const response = await fetch(`${API_URL}/api/approvals/${id}/approve`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...getAuthHeaders()
        }
      });

      const data = await response.json();

      if (response.ok) {
        setApprovals(prev => prev.filter(a => a.id !== id));
        onApprovalChange?.();

        // Show success message based on action type
        if (item?.actionType === 'schedule_meeting') {
          setSuccess('Meeting scheduled successfully!');
        } else if (item?.actionType === 'send_email') {
          setSuccess('Email sent successfully!');
        } else if (item?.actionType === 'create_task') {
          setSuccess('Task created successfully!');
        } else {
          setSuccess('Action completed!');
        }

        // Auto-hide success after 5 seconds
        setTimeout(() => setSuccess(null), 5000);
      } else {
        setError(data.error || 'Failed to approve');
      }
    } catch (err) {
      setError('Network error');
    } finally {
      setProcessing(null);
    }
  };

  const handleReject = async (id: string) => {
    if (!user?.id) return;
    setProcessing(id);
    setError(null);

    try {
      const response = await fetch(`${API_URL}/api/approvals/${id}/reject`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...getAuthHeaders()
        }
      });

      if (response.ok) {
        setApprovals(prev => prev.filter(a => a.id !== id));
        onApprovalChange?.();
      } else {
        const data = await response.json();
        setError(data.error || 'Failed to reject');
      }
    } catch (err) {
      setError('Network error');
    } finally {
      setProcessing(null);
    }
  };

  const getActionIcon = (type: string) => {
    switch (type) {
      case 'schedule_meeting': return '📅';
      case 'send_email': return '📧';
      case 'create_task': return '✅';
      case 'share_document': return '📁';
      default: return '⚡';
    }
  };

  const getActionLabel = (type: string) => {
    switch (type) {
      case 'schedule_meeting': return 'Schedule Meeting';
      case 'send_email': return 'Send Email';
      case 'create_task': return 'Create Task';
      case 'share_document': return 'Share Document';
      default: return 'Action';
    }
  };

  const toggleExpanded = (id: string) => {
    setExpandedItems(prev => {
      const newSet = new Set(prev);
      if (newSet.has(id)) {
        newSet.delete(id);
      } else {
        newSet.add(id);
      }
      return newSet;
    });
  };

  const formatActionDetails = (item: ApprovalItem) => {
    const { actionType, actionData } = item;

    switch (actionType) {
      case 'schedule_meeting':
        return (
          <div className="space-y-1 text-sm">
            <p className="font-medium">{actionData.title}</p>
            <p className="text-gray-400">
              {new Date(actionData.startTime).toLocaleDateString('en-US', {
                weekday: 'short',
                month: 'short',
                day: 'numeric',
                hour: 'numeric',
                minute: '2-digit'
              })}
            </p>
            {actionData.attendees?.length > 0 && (
              <p className="text-gray-500">
                Attendees: {actionData.attendees.join(', ')}
              </p>
            )}
          </div>
        );

      case 'send_email': {
        const emailBody = actionData.body || actionData.bodyText || actionData.bodyHtml || '';
        const isExpanded = expandedItems.has(item.id);
        return (
          <div className="space-y-1 text-sm">
            <p className="font-medium">{actionData.subject}</p>
            {actionData.to?.length > 0 && (
              <p className="text-gray-400">To: {Array.isArray(actionData.to) ? actionData.to.join(', ') : actionData.to}</p>
            )}
            <div className={`text-gray-500 ${isExpanded ? '' : 'line-clamp-2'}`}>
              {isExpanded ? emailBody : emailBody.substring(0, 100) + (emailBody.length > 100 ? '...' : '')}
            </div>
            {emailBody.length > 100 && (
              <button
                onClick={() => toggleExpanded(item.id)}
                className="text-xs text-cscx-accent hover:text-red-400 transition-colors"
              >
                {isExpanded ? 'Show less' : 'Show full email'}
              </button>
            )}
          </div>
        );
      }

      case 'create_task':
        return (
          <div className="space-y-1 text-sm">
            <p className="font-medium">{actionData.title}</p>
            <p className="text-gray-400">Due: {actionData.dueDate}</p>
            <p className="text-gray-500">Priority: {actionData.priority}</p>
          </div>
        );

      default:
        return (
          <p className="text-sm text-gray-400">
            {item.originalContent || JSON.stringify(actionData).substring(0, 100)}
          </p>
        );
    }
  };

  if (loading) {
    return (
      <div className="p-4 text-center text-gray-400">
        Loading approvals...
      </div>
    );
  }

  // Always show the panel so users know where approvals appear
  return (
    <div className="bg-gray-900 border border-gray-700 rounded-lg overflow-hidden">
      <div className="px-4 py-3 bg-gray-800 border-b border-gray-700 flex items-center justify-between">
        <h3 className="text-sm font-semibold text-white flex items-center gap-2">
          {approvals.length > 0 && (
            <span className="w-2 h-2 bg-yellow-400 rounded-full animate-pulse"></span>
          )}
          Pending Approvals {approvals.length > 0 && `(${approvals.length})`}
        </h3>
        <button
          onClick={fetchApprovals}
          className="text-xs text-gray-400 hover:text-white transition-colors"
          title="Refresh"
        >
          ↻
        </button>
      </div>

      {approvals.length === 0 ? (
        <div className="px-4 py-3 text-sm text-gray-500">
          No pending actions. Ask me to schedule a meeting or draft an email!
        </div>
      ) : null}

      {success && (
        <div className="px-4 py-2 bg-green-900/30 text-green-400 text-sm flex items-center gap-2">
          <span>✓</span>
          {success}
        </div>
      )}

      {error && (
        <div className="px-4 py-2 bg-red-900/30 text-red-400 text-sm flex items-center gap-2">
          <span>✗</span>
          {error}
        </div>
      )}

      <div className="divide-y divide-gray-700">
        {approvals.map((item) => (
          <div key={item.id} className="p-4">
            <div className="flex items-start gap-3">
              <span className="text-2xl">{getActionIcon(item.actionType)}</span>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-xs font-medium px-2 py-0.5 bg-gray-700 rounded text-gray-300">
                    {getActionLabel(item.actionType)}
                  </span>
                  <span className="text-xs text-gray-500">
                    {new Date(item.createdAt).toLocaleTimeString()}
                  </span>
                </div>
                {formatActionDetails(item)}
              </div>
            </div>

            <div className="flex gap-2 mt-3 ml-9">
              <button
                onClick={() => handleApprove(item.id)}
                disabled={processing === item.id}
                className="flex-1 px-3 py-1.5 bg-green-600 hover:bg-green-500 disabled:bg-gray-600 text-white text-sm font-medium rounded transition-colors"
              >
                {processing === item.id ? 'Processing...' : 'Approve'}
              </button>
              <button
                onClick={() => handleReject(item.id)}
                disabled={processing === item.id}
                className="flex-1 px-3 py-1.5 bg-gray-700 hover:bg-gray-600 disabled:bg-gray-600 text-white text-sm font-medium rounded transition-colors"
              >
                Reject
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export default PendingApprovals;
