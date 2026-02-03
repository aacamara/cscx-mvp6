/**
 * Quick Actions Widget - PRD-265
 *
 * Mobile-optimized widget component for quick customer actions:
 * - Customer health quick view
 * - Portfolio overview
 * - Tasks due today
 * - Quick note/voice note composition
 * - Notification summary
 *
 * Designed for iOS/Android home screen widgets and PWA shortcuts
 */

import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../../context/AuthContext';

const API_URL = import.meta.env.VITE_API_URL || '';

// ============================================
// Types
// ============================================

type WidgetType =
  | 'customer_quick_view'
  | 'portfolio_overview'
  | 'tasks_today'
  | 'quick_compose'
  | 'notification_summary';

type WidgetSize = 'small' | 'medium' | 'large';

type QuickActionType =
  | 'quick_note'
  | 'check_health'
  | 'create_task'
  | 'voice_note'
  | 'call_contact';

interface CustomerSummary {
  id: string;
  name: string;
  healthScore: number;
  healthTrend: 'up' | 'down' | 'stable';
  arr: number;
  renewalDate: string | null;
  isAtRisk: boolean;
  primaryContactEmail?: string;
  primaryContactPhone?: string;
}

interface TaskSummary {
  id: string;
  title: string;
  dueDate: string;
  priority: 'low' | 'medium' | 'high' | 'urgent';
  customerId?: string;
  customerName?: string;
  isOverdue: boolean;
}

interface PortfolioOverview {
  totalCustomers: number;
  totalArr: number;
  avgHealthScore: number;
  atRiskCount: number;
  renewalsThisMonth: number;
  pendingTasksCount: number;
  pendingApprovalsCount: number;
}

interface NotificationSummary {
  id: string;
  type: string;
  title: string;
  body: string;
  priority: string;
  customerId?: string;
  createdAt: string;
}

interface QuickActionsWidgetProps {
  widgetType: WidgetType;
  size?: WidgetSize;
  customerIds?: string[];
  defaultAction?: QuickActionType;
  onCustomerClick?: (customerId: string) => void;
  onTaskClick?: (taskId: string) => void;
  onNotificationClick?: (notificationId: string) => void;
  refreshInterval?: number; // in minutes
  className?: string;
}

// ============================================
// Component
// ============================================

export const QuickActionsWidget: React.FC<QuickActionsWidgetProps> = ({
  widgetType,
  size = 'medium',
  customerIds,
  defaultAction = 'quick_note',
  onCustomerClick,
  onTaskClick,
  onNotificationClick,
  refreshInterval = 15,
  className = '',
}) => {
  const { getAuthHeaders } = useAuth();

  // Data states
  const [customers, setCustomers] = useState<CustomerSummary[]>([]);
  const [tasks, setTasks] = useState<TaskSummary[]>([]);
  const [portfolio, setPortfolio] = useState<PortfolioOverview | null>(null);
  const [notifications, setNotifications] = useState<NotificationSummary[]>([]);

  // UI states
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  // Quick compose states
  const [showQuickNote, setShowQuickNote] = useState(false);
  const [selectedCustomerId, setSelectedCustomerId] = useState<string>('');
  const [noteContent, setNoteContent] = useState('');
  const [saving, setSaving] = useState(false);

  // Fetch widget data
  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const response = await fetch(
        `${API_URL}/api/quick-actions/widgets/${widgetType}/data`,
        { headers: getAuthHeaders() }
      );

      if (!response.ok) {
        throw new Error('Failed to fetch widget data');
      }

      const { data } = await response.json();

      if (data.customers) setCustomers(data.customers);
      if (data.tasks) setTasks(data.tasks);
      if (data.portfolio) setPortfolio(data.portfolio);
      if (data.notifications) setNotifications(data.notifications);

      setLastUpdated(new Date(data.lastUpdated));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load data');
    } finally {
      setLoading(false);
    }
  }, [widgetType, getAuthHeaders]);

  // Initial fetch and refresh interval
  useEffect(() => {
    fetchData();

    if (refreshInterval > 0) {
      const interval = setInterval(fetchData, refreshInterval * 60 * 1000);
      return () => clearInterval(interval);
    }
  }, [fetchData, refreshInterval]);

  // Quick action handlers
  const handleQuickNote = async () => {
    if (!selectedCustomerId || !noteContent.trim()) return;

    setSaving(true);
    try {
      const response = await fetch(`${API_URL}/api/quick-actions/note`, {
        method: 'POST',
        headers: {
          ...getAuthHeaders(),
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          customerId: selectedCustomerId,
          content: noteContent,
        }),
      });

      if (!response.ok) throw new Error('Failed to save note');

      setNoteContent('');
      setShowQuickNote(false);
      // Optionally show success toast
    } catch (err) {
      setError('Failed to save note');
    } finally {
      setSaving(false);
    }
  };

  const handleCall = async (customerId: string) => {
    try {
      const response = await fetch(
        `${API_URL}/api/quick-actions/customer/${customerId}/call`,
        { headers: getAuthHeaders() }
      );

      if (!response.ok) throw new Error('No contact available');

      const { data } = await response.json();
      if (data.callUrl) {
        window.location.href = data.callUrl;
      }
    } catch (err) {
      setError('Could not initiate call');
    }
  };

  // Format helpers
  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      notation: 'compact',
      maximumFractionDigits: 1,
    }).format(amount);
  };

  const formatRelativeTime = (dateStr: string) => {
    const date = new Date(dateStr);
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);

    if (minutes < 60) return `${minutes}m ago`;
    if (hours < 24) return `${hours}h ago`;
    return `${days}d ago`;
  };

  const getHealthColor = (score: number) => {
    if (score >= 70) return 'text-green-400 bg-green-400/10';
    if (score >= 40) return 'text-yellow-400 bg-yellow-400/10';
    return 'text-red-400 bg-red-400/10';
  };

  const getTrendIcon = (trend: 'up' | 'down' | 'stable') => {
    switch (trend) {
      case 'up': return '↑';
      case 'down': return '↓';
      default: return '→';
    }
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'urgent': return 'bg-red-500';
      case 'high': return 'bg-orange-500';
      case 'medium': return 'bg-yellow-500';
      default: return 'bg-gray-500';
    }
  };

  // Size-based styling
  const getSizeClasses = () => {
    switch (size) {
      case 'small':
        return 'p-3 min-h-[120px]';
      case 'large':
        return 'p-5 min-h-[300px]';
      default:
        return 'p-4 min-h-[200px]';
    }
  };

  // Loading state
  if (loading && !lastUpdated) {
    return (
      <div className={`bg-cscx-gray-900 border border-cscx-gray-800 rounded-xl ${getSizeClasses()} ${className}`}>
        <div className="flex items-center justify-center h-full">
          <div className="animate-spin rounded-full h-6 w-6 border-2 border-cscx-accent border-t-transparent" />
        </div>
      </div>
    );
  }

  // Error state
  if (error && !lastUpdated) {
    return (
      <div className={`bg-cscx-gray-900 border border-red-500/30 rounded-xl ${getSizeClasses()} ${className}`}>
        <div className="flex flex-col items-center justify-center h-full text-center">
          <span className="text-red-400 text-lg mb-2">!</span>
          <p className="text-sm text-red-400">{error}</p>
          <button
            onClick={fetchData}
            className="mt-2 text-xs text-cscx-accent hover:underline"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className={`bg-cscx-gray-900 border border-cscx-gray-800 rounded-xl overflow-hidden ${getSizeClasses()} ${className}`}>
      {/* Customer Quick View Widget */}
      {widgetType === 'customer_quick_view' && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-medium text-cscx-gray-400 uppercase tracking-wider">
              Customer Health
            </h3>
            {loading && (
              <div className="animate-spin rounded-full h-3 w-3 border border-cscx-accent border-t-transparent" />
            )}
          </div>

          <div className="space-y-2">
            {customers.slice(0, size === 'small' ? 2 : size === 'large' ? 5 : 3).map((customer) => (
              <div
                key={customer.id}
                className="flex items-center justify-between p-2 bg-cscx-gray-800 rounded-lg cursor-pointer hover:bg-cscx-gray-700 transition-colors"
                onClick={() => onCustomerClick?.(customer.id)}
              >
                <div className="flex-1 min-w-0 mr-2">
                  <p className="text-sm text-white font-medium truncate">
                    {customer.isAtRisk && <span className="text-red-400 mr-1">!</span>}
                    {customer.name}
                  </p>
                  {size !== 'small' && (
                    <p className="text-xs text-cscx-gray-400">
                      {formatCurrency(customer.arr)} ARR
                    </p>
                  )}
                </div>

                <div className="flex items-center gap-2">
                  <span className={`text-xs font-bold px-2 py-1 rounded ${getHealthColor(customer.healthScore)}`}>
                    {customer.healthScore}
                    <span className="ml-1 opacity-70">{getTrendIcon(customer.healthTrend)}</span>
                  </span>

                  {customer.primaryContactPhone && size !== 'small' && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleCall(customer.id);
                      }}
                      className="p-1 hover:bg-cscx-gray-600 rounded transition-colors"
                      title="Call contact"
                    >
                      <svg className="w-4 h-4 text-cscx-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                      </svg>
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>

          {/* Quick action button */}
          <button
            onClick={() => setShowQuickNote(true)}
            className="w-full py-2 bg-cscx-gray-800 hover:bg-cscx-gray-700 text-white text-xs font-medium rounded-lg transition-colors flex items-center justify-center gap-1"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
            </svg>
            Quick Note
          </button>
        </div>
      )}

      {/* Portfolio Overview Widget */}
      {widgetType === 'portfolio_overview' && portfolio && (
        <div className="space-y-3">
          <h3 className="text-xs font-medium text-cscx-gray-400 uppercase tracking-wider">
            Portfolio Overview
          </h3>

          <div className={`grid ${size === 'small' ? 'grid-cols-2' : 'grid-cols-3'} gap-2`}>
            <div className="text-center p-2 bg-cscx-gray-800 rounded-lg">
              <p className="text-lg font-bold text-white">{portfolio.totalCustomers}</p>
              <p className="text-xs text-cscx-gray-400">Customers</p>
            </div>
            <div className="text-center p-2 bg-cscx-gray-800 rounded-lg">
              <p className="text-lg font-bold text-white">{formatCurrency(portfolio.totalArr)}</p>
              <p className="text-xs text-cscx-gray-400">Total ARR</p>
            </div>
            {size !== 'small' && (
              <div className="text-center p-2 bg-cscx-gray-800 rounded-lg">
                <p className={`text-lg font-bold ${getHealthColor(portfolio.avgHealthScore).split(' ')[0]}`}>
                  {portfolio.avgHealthScore}
                </p>
                <p className="text-xs text-cscx-gray-400">Avg Health</p>
              </div>
            )}
            <div className="text-center p-2 bg-cscx-gray-800 rounded-lg">
              <p className="text-lg font-bold text-red-400">{portfolio.atRiskCount}</p>
              <p className="text-xs text-cscx-gray-400">At Risk</p>
            </div>
            <div className="text-center p-2 bg-cscx-gray-800 rounded-lg">
              <p className="text-lg font-bold text-yellow-400">{portfolio.renewalsThisMonth}</p>
              <p className="text-xs text-cscx-gray-400">Renewals</p>
            </div>
            {size !== 'small' && (
              <div className="text-center p-2 bg-cscx-gray-800 rounded-lg">
                <p className="text-lg font-bold text-cscx-accent">{portfolio.pendingTasksCount}</p>
                <p className="text-xs text-cscx-gray-400">Tasks</p>
              </div>
            )}
          </div>

          {portfolio.pendingApprovalsCount > 0 && (
            <div className="flex items-center justify-center gap-2 py-2 bg-yellow-500/10 rounded-lg">
              <span className="text-yellow-400 text-sm font-medium">
                {portfolio.pendingApprovalsCount} pending approval{portfolio.pendingApprovalsCount !== 1 ? 's' : ''}
              </span>
            </div>
          )}
        </div>
      )}

      {/* Tasks Today Widget */}
      {widgetType === 'tasks_today' && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-medium text-cscx-gray-400 uppercase tracking-wider">
              Tasks Today
            </h3>
            <span className="text-xs text-cscx-gray-500">
              {tasks.length} task{tasks.length !== 1 ? 's' : ''}
            </span>
          </div>

          <div className="space-y-2">
            {tasks.slice(0, size === 'small' ? 3 : size === 'large' ? 8 : 5).map((task) => (
              <div
                key={task.id}
                className={`p-2 bg-cscx-gray-800 rounded-lg cursor-pointer hover:bg-cscx-gray-700 transition-colors ${
                  task.isOverdue ? 'border-l-2 border-red-500' : ''
                }`}
                onClick={() => onTaskClick?.(task.id)}
              >
                <div className="flex items-start gap-2">
                  <span className={`w-2 h-2 mt-1.5 rounded-full ${getPriorityColor(task.priority)}`} />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-white truncate">{task.title}</p>
                    {task.customerName && size !== 'small' && (
                      <p className="text-xs text-cscx-gray-400">{task.customerName}</p>
                    )}
                  </div>
                  {task.isOverdue && (
                    <span className="text-xs text-red-400 font-medium">Overdue</span>
                  )}
                </div>
              </div>
            ))}

            {tasks.length === 0 && (
              <p className="text-sm text-cscx-gray-500 text-center py-4">
                No tasks due today
              </p>
            )}
          </div>
        </div>
      )}

      {/* Quick Compose Widget */}
      {widgetType === 'quick_compose' && (
        <div className="space-y-3">
          <h3 className="text-xs font-medium text-cscx-gray-400 uppercase tracking-wider">
            Quick Note
          </h3>

          <select
            value={selectedCustomerId}
            onChange={(e) => setSelectedCustomerId(e.target.value)}
            className="w-full px-3 py-2 bg-cscx-gray-800 border border-cscx-gray-700 rounded-lg text-white text-sm focus:outline-none focus:border-cscx-accent"
          >
            <option value="">Select customer...</option>
            {customers.map((c) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>

          <textarea
            value={noteContent}
            onChange={(e) => setNoteContent(e.target.value)}
            placeholder="Type your note..."
            className="w-full px-3 py-2 bg-cscx-gray-800 border border-cscx-gray-700 rounded-lg text-white text-sm placeholder-cscx-gray-500 resize-none focus:outline-none focus:border-cscx-accent"
            rows={size === 'small' ? 2 : 4}
          />

          <div className="flex gap-2">
            <button
              onClick={handleQuickNote}
              disabled={!selectedCustomerId || !noteContent.trim() || saving}
              className="flex-1 py-2 bg-cscx-accent hover:bg-red-600 disabled:bg-cscx-gray-700 disabled:cursor-not-allowed text-white text-sm font-medium rounded-lg transition-colors"
            >
              {saving ? 'Saving...' : 'Save Note'}
            </button>
            <button
              className="px-4 py-2 bg-cscx-gray-800 hover:bg-cscx-gray-700 text-white text-sm rounded-lg transition-colors"
              title="Voice note"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
              </svg>
            </button>
          </div>
        </div>
      )}

      {/* Notification Summary Widget */}
      {widgetType === 'notification_summary' && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-medium text-cscx-gray-400 uppercase tracking-wider">
              Notifications
            </h3>
            <span className="text-xs text-cscx-accent">
              {notifications.length} unread
            </span>
          </div>

          <div className="space-y-2">
            {notifications.slice(0, size === 'small' ? 2 : 4).map((notif) => (
              <div
                key={notif.id}
                className="p-2 bg-cscx-gray-800 rounded-lg cursor-pointer hover:bg-cscx-gray-700 transition-colors"
                onClick={() => onNotificationClick?.(notif.id)}
              >
                <div className="flex items-start gap-2">
                  <span className={`w-2 h-2 mt-1.5 rounded-full ${
                    notif.priority === 'urgent' || notif.priority === 'high' ? 'bg-red-500' : 'bg-cscx-accent'
                  }`} />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-white font-medium truncate">{notif.title}</p>
                    {size !== 'small' && (
                      <p className="text-xs text-cscx-gray-400 truncate">{notif.body}</p>
                    )}
                    <p className="text-xs text-cscx-gray-500">{formatRelativeTime(notif.createdAt)}</p>
                  </div>
                </div>
              </div>
            ))}

            {notifications.length === 0 && (
              <p className="text-sm text-cscx-gray-500 text-center py-4">
                No new notifications
              </p>
            )}
          </div>
        </div>
      )}

      {/* Quick Note Modal */}
      {showQuickNote && (
        <div className="fixed inset-0 bg-black/50 flex items-end justify-center z-50 p-4">
          <div className="bg-cscx-gray-900 rounded-t-xl w-full max-w-md p-4 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-medium text-white">Quick Note</h3>
              <button
                onClick={() => setShowQuickNote(false)}
                className="text-cscx-gray-400 hover:text-white"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <select
              value={selectedCustomerId}
              onChange={(e) => setSelectedCustomerId(e.target.value)}
              className="w-full px-3 py-2 bg-cscx-gray-800 border border-cscx-gray-700 rounded-lg text-white focus:outline-none focus:border-cscx-accent"
            >
              <option value="">Select customer...</option>
              {customers.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>

            <textarea
              value={noteContent}
              onChange={(e) => setNoteContent(e.target.value)}
              placeholder="Type your note..."
              className="w-full px-3 py-2 bg-cscx-gray-800 border border-cscx-gray-700 rounded-lg text-white placeholder-cscx-gray-500 resize-none focus:outline-none focus:border-cscx-accent"
              rows={4}
              autoFocus
            />

            <div className="flex gap-2">
              <button
                onClick={handleQuickNote}
                disabled={!selectedCustomerId || !noteContent.trim() || saving}
                className="flex-1 py-3 bg-cscx-accent hover:bg-red-600 disabled:bg-cscx-gray-700 disabled:cursor-not-allowed text-white font-medium rounded-lg transition-colors"
              >
                {saving ? 'Saving...' : 'Save Note'}
              </button>
              <button
                onClick={() => setShowQuickNote(false)}
                className="px-6 py-3 bg-cscx-gray-800 hover:bg-cscx-gray-700 text-white rounded-lg transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Last updated indicator */}
      {lastUpdated && size !== 'small' && (
        <div className="mt-3 pt-2 border-t border-cscx-gray-800">
          <p className="text-xs text-cscx-gray-500 text-center">
            Updated {formatRelativeTime(lastUpdated.toISOString())}
          </p>
        </div>
      )}
    </div>
  );
};

// ============================================
// Preset Widget Components
// ============================================

export const CustomerHealthWidget: React.FC<{
  size?: WidgetSize;
  customerIds?: string[];
  onCustomerClick?: (id: string) => void;
  className?: string;
}> = ({ size, customerIds, onCustomerClick, className }) => (
  <QuickActionsWidget
    widgetType="customer_quick_view"
    size={size}
    customerIds={customerIds}
    onCustomerClick={onCustomerClick}
    className={className}
  />
);

export const PortfolioWidget: React.FC<{
  size?: WidgetSize;
  className?: string;
}> = ({ size, className }) => (
  <QuickActionsWidget
    widgetType="portfolio_overview"
    size={size}
    className={className}
  />
);

export const TasksWidget: React.FC<{
  size?: WidgetSize;
  onTaskClick?: (id: string) => void;
  className?: string;
}> = ({ size, onTaskClick, className }) => (
  <QuickActionsWidget
    widgetType="tasks_today"
    size={size}
    onTaskClick={onTaskClick}
    className={className}
  />
);

export const QuickNoteWidget: React.FC<{
  size?: WidgetSize;
  className?: string;
}> = ({ size, className }) => (
  <QuickActionsWidget
    widgetType="quick_compose"
    size={size}
    className={className}
  />
);

export const NotificationsWidget: React.FC<{
  size?: WidgetSize;
  onNotificationClick?: (id: string) => void;
  className?: string;
}> = ({ size, onNotificationClick, className }) => (
  <QuickActionsWidget
    widgetType="notification_summary"
    size={size}
    onNotificationClick={onNotificationClick}
    className={className}
  />
);

export default QuickActionsWidget;
