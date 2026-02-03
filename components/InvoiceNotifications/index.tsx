/**
 * Invoice Notifications Component
 * PRD-125: Invoice Generated -> CSM Notification
 *
 * Displays invoice notifications, risk assessments, and recommended actions
 * for CSMs to proactively support customers with billing.
 */

import React, { useState, useEffect } from 'react';
import { useInvoiceNotifications } from '../../hooks/useInvoiceNotifications';
import { InvoiceNotification, InvoiceRiskFlag, InvoiceStatus } from '../../types/invoice';

// ============================================
// Props
// ============================================

interface InvoiceNotificationsProps {
  csmId: string;
  mode?: 'full' | 'compact' | 'dashboard';
  customerId?: string;
  onNotificationClick?: (notification: InvoiceNotification) => void;
}

// ============================================
// Component
// ============================================

export const InvoiceNotifications: React.FC<InvoiceNotificationsProps> = ({
  csmId,
  mode = 'full',
  customerId,
  onNotificationClick,
}) => {
  const {
    notifications,
    loading,
    error,
    pagination,
    summary,
    filters,
    setFilters,
    fetchNotifications,
    acknowledgeNotification,
    dashboard,
    dashboardLoading,
    fetchDashboard,
    formatCurrency,
    formatDate,
    getDaysUntilDue,
    getRiskLevel,
  } = useInvoiceNotifications({
    csmId,
    autoFetch: true,
    initialFilters: customerId ? { customerId } : {},
  });

  const [selectedNotification, setSelectedNotification] = useState<InvoiceNotification | null>(null);
  const [activeTab, setActiveTab] = useState<'all' | 'pending' | 'at-risk' | 'overdue'>('all');

  // Fetch dashboard on mount
  useEffect(() => {
    if (mode === 'full' || mode === 'dashboard') {
      fetchDashboard();
    }
  }, [mode, fetchDashboard]);

  // Update filters when tab changes
  useEffect(() => {
    switch (activeTab) {
      case 'pending':
        setFilters(prev => ({ ...prev, status: 'pending' }));
        break;
      case 'at-risk':
        setFilters(prev => ({ ...prev, status: 'all', hasRiskFlags: true }));
        break;
      case 'overdue':
        setFilters(prev => ({ ...prev, status: 'overdue' }));
        break;
      default:
        setFilters(prev => ({ ...prev, status: 'all', hasRiskFlags: undefined }));
    }
  }, [activeTab, setFilters]);

  const handleAcknowledge = async (notification: InvoiceNotification) => {
    try {
      await acknowledgeNotification(notification.id, 'Acknowledged via dashboard');
    } catch (err) {
      console.error('Failed to acknowledge:', err);
    }
  };

  // ============================================
  // Render Helpers
  // ============================================

  const getStatusBadge = (status: InvoiceStatus) => {
    const styles: Record<InvoiceStatus, string> = {
      pending: 'bg-yellow-900/50 text-yellow-400 border-yellow-600/30',
      paid: 'bg-green-900/50 text-green-400 border-green-600/30',
      overdue: 'bg-red-900/50 text-red-400 border-red-600/30',
      failed: 'bg-red-900/50 text-red-400 border-red-600/30',
    };

    return (
      <span className={`px-2 py-0.5 text-xs font-medium rounded border ${styles[status]}`}>
        {status.charAt(0).toUpperCase() + status.slice(1)}
      </span>
    );
  };

  const getRiskBadge = (riskScore: number) => {
    const level = getRiskLevel(riskScore);
    const styles: Record<string, string> = {
      low: 'bg-green-900/50 text-green-400 border-green-600/30',
      medium: 'bg-yellow-900/50 text-yellow-400 border-yellow-600/30',
      high: 'bg-red-900/50 text-red-400 border-red-600/30',
    };

    return (
      <span className={`px-2 py-0.5 text-xs font-medium rounded border ${styles[level]}`}>
        Risk: {riskScore}
      </span>
    );
  };

  const getRiskFlagLabel = (flag: InvoiceRiskFlag): string => {
    const labels: Record<InvoiceRiskFlag, string> = {
      first_invoice: 'First Invoice',
      significant_amount_change: 'Amount Changed',
      declining_health: 'Health Declining',
      late_payment_history: 'Late Payments',
      contract_dispute: 'Dispute History',
      high_value: 'High Value',
      renewal_approaching: 'Renewal Soon',
      support_issues: 'Support Issues',
    };
    return labels[flag] || flag;
  };

  // ============================================
  // Dashboard Mode
  // ============================================

  if (mode === 'dashboard') {
    return (
      <div className="bg-cscx-gray-900 rounded-lg border border-cscx-gray-700 p-6">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-lg font-semibold text-white">Invoice Notifications</h2>
          <button
            onClick={() => fetchDashboard()}
            className="text-sm text-cscx-gray-400 hover:text-white"
          >
            Refresh
          </button>
        </div>

        {dashboardLoading ? (
          <div className="animate-pulse space-y-4">
            {[1, 2, 3].map(i => (
              <div key={i} className="h-16 bg-cscx-gray-800 rounded" />
            ))}
          </div>
        ) : dashboard ? (
          <div className="space-y-6">
            {/* Summary Cards */}
            <div className="grid grid-cols-4 gap-4">
              <SummaryCard
                label="Pending"
                count={dashboard.summary.pendingCount}
                amount={formatCurrency(dashboard.summary.pendingAmount)}
                color="yellow"
              />
              <SummaryCard
                label="Overdue"
                count={dashboard.summary.overdueCount}
                amount={formatCurrency(dashboard.summary.overdueAmount)}
                color="red"
              />
              <SummaryCard
                label="At Risk"
                count={dashboard.summary.atRiskCount}
                amount={formatCurrency(dashboard.summary.atRiskAmount)}
                color="orange"
              />
              <SummaryCard
                label="Collection Rate"
                count={null}
                amount={`${dashboard.summary.collectionRate.toFixed(1)}%`}
                color="green"
              />
            </div>

            {/* Risk Alerts */}
            {dashboard.riskAlerts.length > 0 && (
              <div>
                <h3 className="text-sm font-medium text-cscx-gray-400 mb-3">Risk Alerts</h3>
                <div className="space-y-2">
                  {dashboard.riskAlerts.slice(0, 3).map(alert => (
                    <div
                      key={alert.notification.id}
                      className="flex items-center justify-between p-3 bg-red-900/20 border border-red-600/30 rounded-lg"
                    >
                      <div className="flex items-center gap-3">
                        <span className="text-red-400">
                          <AlertIcon />
                        </span>
                        <div>
                          <p className="text-sm font-medium text-white">
                            {alert.notification.customerName}
                          </p>
                          <p className="text-xs text-cscx-gray-400">
                            {formatCurrency(alert.notification.amount)} - {getRiskFlagLabel(alert.primaryRisk)}
                          </p>
                        </div>
                      </div>
                      <button
                        onClick={() => onNotificationClick?.(alert.notification)}
                        className="text-xs text-cscx-accent hover:underline"
                      >
                        View
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Upcoming Due Dates */}
            {dashboard.upcomingDueDates.length > 0 && (
              <div>
                <h3 className="text-sm font-medium text-cscx-gray-400 mb-3">Due Soon</h3>
                <div className="space-y-2">
                  {dashboard.upcomingDueDates.slice(0, 3).map(item => (
                    <div
                      key={item.notification.id}
                      className="flex items-center justify-between p-3 bg-cscx-gray-800 rounded-lg"
                    >
                      <div>
                        <p className="text-sm font-medium text-white">
                          {item.notification.customerName}
                        </p>
                        <p className="text-xs text-cscx-gray-400">
                          {formatCurrency(item.notification.amount)}
                        </p>
                      </div>
                      <span className={`text-xs font-medium ${
                        item.daysUntilDue <= 3 ? 'text-red-400' : 'text-yellow-400'
                      }`}>
                        {item.daysUntilDue === 0 ? 'Due today' : `${item.daysUntilDue}d`}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        ) : (
          <p className="text-cscx-gray-400 text-center py-8">No invoice data available</p>
        )}
      </div>
    );
  }

  // ============================================
  // Compact Mode
  // ============================================

  if (mode === 'compact') {
    return (
      <div className="space-y-3">
        {loading ? (
          <div className="animate-pulse space-y-2">
            {[1, 2, 3].map(i => (
              <div key={i} className="h-12 bg-cscx-gray-800 rounded" />
            ))}
          </div>
        ) : notifications.length === 0 ? (
          <p className="text-cscx-gray-400 text-sm text-center py-4">No invoices</p>
        ) : (
          notifications.slice(0, 5).map(notification => (
            <CompactNotificationRow
              key={notification.id}
              notification={notification}
              formatCurrency={formatCurrency}
              formatDate={formatDate}
              getDaysUntilDue={getDaysUntilDue}
              onClick={() => onNotificationClick?.(notification)}
            />
          ))
        )}
      </div>
    );
  }

  // ============================================
  // Full Mode
  // ============================================

  return (
    <div className="bg-cscx-gray-900 rounded-lg border border-cscx-gray-700">
      {/* Header */}
      <div className="px-6 py-4 border-b border-cscx-gray-700">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-white">Invoice Notifications</h2>
          <div className="flex items-center gap-4">
            {/* Summary badges */}
            <div className="flex items-center gap-2">
              <span className="text-xs text-cscx-gray-400">
                {summary.totalPending} pending
              </span>
              {summary.totalOverdue > 0 && (
                <span className="text-xs text-red-400">
                  {summary.totalOverdue} overdue
                </span>
              )}
              {summary.totalAtRisk > 0 && (
                <span className="text-xs text-yellow-400">
                  {summary.totalAtRisk} at risk
                </span>
              )}
            </div>
            <button
              onClick={() => fetchNotifications()}
              className="p-2 text-cscx-gray-400 hover:text-white rounded-lg hover:bg-cscx-gray-800"
              title="Refresh"
            >
              <RefreshIcon />
            </button>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 mt-4">
          {(['all', 'pending', 'at-risk', 'overdue'] as const).map(tab => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
                activeTab === tab
                  ? 'bg-cscx-accent text-white'
                  : 'text-cscx-gray-400 hover:text-white hover:bg-cscx-gray-800'
              }`}
            >
              {tab === 'at-risk' ? 'At Risk' : tab.charAt(0).toUpperCase() + tab.slice(1)}
            </button>
          ))}
        </div>
      </div>

      {/* Error State */}
      {error && (
        <div className="px-6 py-4 bg-red-900/20 border-b border-red-600/30">
          <p className="text-sm text-red-400">{error}</p>
        </div>
      )}

      {/* Notifications List */}
      <div className="divide-y divide-cscx-gray-800">
        {loading ? (
          <div className="p-6">
            <div className="animate-pulse space-y-4">
              {[1, 2, 3, 4, 5].map(i => (
                <div key={i} className="h-20 bg-cscx-gray-800 rounded" />
              ))}
            </div>
          </div>
        ) : notifications.length === 0 ? (
          <div className="p-12 text-center">
            <InvoiceIcon className="w-12 h-12 text-cscx-gray-600 mx-auto mb-4" />
            <p className="text-cscx-gray-400">No invoice notifications found</p>
            <p className="text-xs text-cscx-gray-500 mt-1">
              Invoice notifications will appear here when generated
            </p>
          </div>
        ) : (
          notifications.map(notification => (
            <NotificationRow
              key={notification.id}
              notification={notification}
              formatCurrency={formatCurrency}
              formatDate={formatDate}
              getDaysUntilDue={getDaysUntilDue}
              getRiskLevel={getRiskLevel}
              getRiskFlagLabel={getRiskFlagLabel}
              getStatusBadge={getStatusBadge}
              getRiskBadge={getRiskBadge}
              onAcknowledge={handleAcknowledge}
              onClick={() => {
                setSelectedNotification(notification);
                onNotificationClick?.(notification);
              }}
            />
          ))
        )}
      </div>

      {/* Pagination */}
      {pagination.totalPages > 1 && (
        <div className="px-6 py-4 border-t border-cscx-gray-700 flex items-center justify-between">
          <p className="text-sm text-cscx-gray-400">
            Showing {((pagination.page - 1) * pagination.pageSize) + 1} - {Math.min(pagination.page * pagination.pageSize, pagination.total)} of {pagination.total}
          </p>
          <div className="flex gap-2">
            <button
              onClick={() => fetchNotifications(pagination.page - 1)}
              disabled={pagination.page === 1}
              className="px-3 py-1 text-sm text-cscx-gray-400 hover:text-white disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Previous
            </button>
            <button
              onClick={() => fetchNotifications(pagination.page + 1)}
              disabled={pagination.page === pagination.totalPages}
              className="px-3 py-1 text-sm text-cscx-gray-400 hover:text-white disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Next
            </button>
          </div>
        </div>
      )}

      {/* Detail Modal */}
      {selectedNotification && (
        <NotificationDetailModal
          notification={selectedNotification}
          formatCurrency={formatCurrency}
          formatDate={formatDate}
          getDaysUntilDue={getDaysUntilDue}
          getRiskFlagLabel={getRiskFlagLabel}
          onClose={() => setSelectedNotification(null)}
          onAcknowledge={() => handleAcknowledge(selectedNotification)}
        />
      )}
    </div>
  );
};

// ============================================
// Sub-Components
// ============================================

interface SummaryCardProps {
  label: string;
  count: number | null;
  amount: string;
  color: 'yellow' | 'red' | 'orange' | 'green';
}

const SummaryCard: React.FC<SummaryCardProps> = ({ label, count, amount, color }) => {
  const colors = {
    yellow: 'border-yellow-600/30 text-yellow-400',
    red: 'border-red-600/30 text-red-400',
    orange: 'border-orange-600/30 text-orange-400',
    green: 'border-green-600/30 text-green-400',
  };

  return (
    <div className={`p-4 bg-cscx-gray-800 rounded-lg border ${colors[color]}`}>
      <p className="text-xs text-cscx-gray-400 mb-1">{label}</p>
      {count !== null && (
        <p className={`text-2xl font-bold ${colors[color].split(' ')[1]}`}>{count}</p>
      )}
      <p className="text-sm text-white">{amount}</p>
    </div>
  );
};

interface NotificationRowProps {
  notification: InvoiceNotification;
  formatCurrency: (amount: number, currency?: string) => string;
  formatDate: (date: Date | string) => string;
  getDaysUntilDue: (dueDate: Date | string) => number;
  getRiskLevel: (riskScore: number) => 'low' | 'medium' | 'high';
  getRiskFlagLabel: (flag: InvoiceRiskFlag) => string;
  getStatusBadge: (status: InvoiceStatus) => JSX.Element;
  getRiskBadge: (riskScore: number) => JSX.Element;
  onAcknowledge: (notification: InvoiceNotification) => void;
  onClick: () => void;
}

const NotificationRow: React.FC<NotificationRowProps> = ({
  notification,
  formatCurrency,
  formatDate,
  getDaysUntilDue,
  getRiskFlagLabel,
  getStatusBadge,
  getRiskBadge,
  onAcknowledge,
  onClick,
}) => {
  const daysUntilDue = getDaysUntilDue(notification.dueDate);
  const isOverdue = daysUntilDue < 0;
  const isDueSoon = daysUntilDue >= 0 && daysUntilDue <= 7;

  return (
    <div
      className={`px-6 py-4 hover:bg-cscx-gray-800/50 cursor-pointer transition-colors ${
        !notification.acknowledgedAt ? 'bg-cscx-gray-800/20' : ''
      }`}
      onClick={onClick}
    >
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <div className="flex items-center gap-3 mb-2">
            <h3 className="text-sm font-medium text-white">{notification.customerName}</h3>
            {getStatusBadge(notification.status)}
            {notification.riskScore > 0 && getRiskBadge(notification.riskScore)}
            {!notification.acknowledgedAt && (
              <span className="w-2 h-2 bg-cscx-accent rounded-full" title="Unacknowledged" />
            )}
          </div>

          <div className="flex items-center gap-4 text-sm text-cscx-gray-400">
            <span className="font-medium text-white">
              {formatCurrency(notification.amount, notification.currency)}
            </span>
            <span>
              Due: {formatDate(notification.dueDate)}
              {isOverdue && (
                <span className="text-red-400 ml-1">({Math.abs(daysUntilDue)}d overdue)</span>
              )}
              {isDueSoon && !isOverdue && (
                <span className="text-yellow-400 ml-1">({daysUntilDue}d)</span>
              )}
            </span>
            <span>Health: {notification.customerContext.healthScore}/100</span>
            <span className="capitalize">
              Payment: {notification.customerContext.paymentHistory}
            </span>
          </div>

          {notification.riskFlags.length > 0 && (
            <div className="flex items-center gap-2 mt-2">
              {notification.riskFlags.slice(0, 3).map(flag => (
                <span
                  key={flag}
                  className="px-2 py-0.5 text-xs bg-cscx-gray-800 text-cscx-gray-300 rounded"
                >
                  {getRiskFlagLabel(flag)}
                </span>
              ))}
              {notification.riskFlags.length > 3 && (
                <span className="text-xs text-cscx-gray-500">
                  +{notification.riskFlags.length - 3} more
                </span>
              )}
            </div>
          )}

          {notification.recommendedActions.length > 0 && (
            <p className="text-xs text-cscx-accent mt-2">
              Suggested: {notification.recommendedActions[0]}
            </p>
          )}
        </div>

        <div className="flex items-center gap-2 ml-4">
          {!notification.acknowledgedAt && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                onAcknowledge(notification);
              }}
              className="px-3 py-1.5 text-xs font-medium bg-cscx-gray-800 hover:bg-cscx-gray-700 text-white rounded transition-colors"
            >
              Acknowledge
            </button>
          )}
          <button
            onClick={(e) => {
              e.stopPropagation();
              onClick();
            }}
            className="p-2 text-cscx-gray-400 hover:text-white rounded hover:bg-cscx-gray-700"
          >
            <ChevronRightIcon />
          </button>
        </div>
      </div>
    </div>
  );
};

interface CompactNotificationRowProps {
  notification: InvoiceNotification;
  formatCurrency: (amount: number, currency?: string) => string;
  formatDate: (date: Date | string) => string;
  getDaysUntilDue: (dueDate: Date | string) => number;
  onClick: () => void;
}

const CompactNotificationRow: React.FC<CompactNotificationRowProps> = ({
  notification,
  formatCurrency,
  getDaysUntilDue,
  onClick,
}) => {
  const daysUntilDue = getDaysUntilDue(notification.dueDate);

  return (
    <div
      className="flex items-center justify-between p-3 bg-cscx-gray-800 rounded-lg cursor-pointer hover:bg-cscx-gray-700 transition-colors"
      onClick={onClick}
    >
      <div className="flex items-center gap-3">
        {notification.riskScore >= 50 && (
          <span className="text-red-400">
            <AlertIcon />
          </span>
        )}
        <div>
          <p className="text-sm font-medium text-white">{notification.customerName}</p>
          <p className="text-xs text-cscx-gray-400">
            {formatCurrency(notification.amount, notification.currency)}
          </p>
        </div>
      </div>
      <span className={`text-xs font-medium ${
        daysUntilDue < 0 ? 'text-red-400' : daysUntilDue <= 7 ? 'text-yellow-400' : 'text-cscx-gray-400'
      }`}>
        {daysUntilDue < 0 ? `${Math.abs(daysUntilDue)}d overdue` : `${daysUntilDue}d`}
      </span>
    </div>
  );
};

interface NotificationDetailModalProps {
  notification: InvoiceNotification;
  formatCurrency: (amount: number, currency?: string) => string;
  formatDate: (date: Date | string) => string;
  getDaysUntilDue: (dueDate: Date | string) => number;
  getRiskFlagLabel: (flag: InvoiceRiskFlag) => string;
  onClose: () => void;
  onAcknowledge: () => void;
}

const NotificationDetailModal: React.FC<NotificationDetailModalProps> = ({
  notification,
  formatCurrency,
  formatDate,
  getDaysUntilDue,
  getRiskFlagLabel,
  onClose,
  onAcknowledge,
}) => {
  const daysUntilDue = getDaysUntilDue(notification.dueDate);

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-cscx-gray-900 rounded-lg border border-cscx-gray-700 w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="px-6 py-4 border-b border-cscx-gray-700 flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold text-white">{notification.customerName}</h2>
            <p className="text-sm text-cscx-gray-400">
              Invoice {notification.invoiceNumber || notification.invoiceId}
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-cscx-gray-400 hover:text-white rounded hover:bg-cscx-gray-800"
          >
            <CloseIcon />
          </button>
        </div>

        <div className="p-6 space-y-6">
          {/* Invoice Details */}
          <div className="grid grid-cols-2 gap-4">
            <DetailItem label="Amount" value={formatCurrency(notification.amount, notification.currency)} />
            <DetailItem label="Status" value={notification.status.charAt(0).toUpperCase() + notification.status.slice(1)} />
            <DetailItem label="Due Date" value={formatDate(notification.dueDate)} />
            <DetailItem
              label="Days Until Due"
              value={daysUntilDue < 0 ? `${Math.abs(daysUntilDue)} days overdue` : `${daysUntilDue} days`}
              highlight={daysUntilDue < 0 ? 'red' : daysUntilDue <= 7 ? 'yellow' : undefined}
            />
            <DetailItem label="Billing Source" value={notification.billingSource.charAt(0).toUpperCase() + notification.billingSource.slice(1)} />
            <DetailItem label="Risk Score" value={`${notification.riskScore}/100`} highlight={notification.riskScore >= 50 ? 'red' : undefined} />
          </div>

          {/* Customer Context */}
          <div>
            <h3 className="text-sm font-medium text-cscx-gray-400 mb-3">Customer Context</h3>
            <div className="grid grid-cols-2 gap-4 p-4 bg-cscx-gray-800 rounded-lg">
              <DetailItem label="Health Score" value={`${notification.customerContext.healthScore}/100`} />
              <DetailItem label="Health Trend" value={notification.customerContext.healthTrend.charAt(0).toUpperCase() + notification.customerContext.healthTrend.slice(1)} />
              <DetailItem label="Payment History" value={notification.customerContext.paymentHistory.charAt(0).toUpperCase() + notification.customerContext.paymentHistory.slice(1)} />
              <DetailItem label="Segment" value={notification.customerContext.segment} />
              <DetailItem label="CSM" value={notification.customerContext.csmName} />
              {notification.customerContext.daysToRenewal !== null && (
                <DetailItem label="Days to Renewal" value={`${notification.customerContext.daysToRenewal} days`} />
              )}
            </div>
          </div>

          {/* Risk Flags */}
          {notification.riskFlags.length > 0 && (
            <div>
              <h3 className="text-sm font-medium text-cscx-gray-400 mb-3">Risk Factors</h3>
              <div className="flex flex-wrap gap-2">
                {notification.riskFlags.map(flag => (
                  <span
                    key={flag}
                    className="px-3 py-1.5 text-sm bg-red-900/30 text-red-400 border border-red-600/30 rounded"
                  >
                    {getRiskFlagLabel(flag)}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Recommended Actions */}
          {notification.recommendedActions.length > 0 && (
            <div>
              <h3 className="text-sm font-medium text-cscx-gray-400 mb-3">Recommended Actions</h3>
              <ul className="space-y-2">
                {notification.recommendedActions.map((action, i) => (
                  <li key={i} className="flex items-start gap-2 text-sm text-white">
                    <span className="text-cscx-accent mt-0.5">
                      <CheckIcon />
                    </span>
                    {action}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Value Delivered */}
          {notification.customerContext.valueDelivered && (
            <div>
              <h3 className="text-sm font-medium text-cscx-gray-400 mb-3">Value Delivered This Period</h3>
              <p className="text-sm text-white mb-3">{notification.customerContext.valueDelivered.summary}</p>
              {notification.customerContext.valueDelivered.metrics && (
                <div className="grid grid-cols-3 gap-3">
                  {notification.customerContext.valueDelivered.metrics.map((metric, i) => (
                    <div key={i} className="p-3 bg-cscx-gray-800 rounded">
                      <p className="text-xs text-cscx-gray-400">{metric.name}</p>
                      <p className="text-lg font-semibold text-white">{metric.value}</p>
                      {metric.change && (
                        <p className={`text-xs ${metric.change.startsWith('+') ? 'text-green-400' : 'text-red-400'}`}>
                          {metric.change}
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-cscx-gray-700 flex items-center justify-between">
          <div className="text-xs text-cscx-gray-500">
            Notified: {formatDate(notification.notifiedAt)}
            {notification.acknowledgedAt && ` | Acknowledged: ${formatDate(notification.acknowledgedAt)}`}
          </div>
          <div className="flex gap-3">
            <button
              onClick={onClose}
              className="px-4 py-2 text-sm text-cscx-gray-400 hover:text-white"
            >
              Close
            </button>
            {!notification.acknowledgedAt && (
              <button
                onClick={onAcknowledge}
                className="px-4 py-2 text-sm font-medium bg-cscx-accent hover:bg-cscx-accent/80 text-white rounded transition-colors"
              >
                Acknowledge
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

interface DetailItemProps {
  label: string;
  value: string;
  highlight?: 'red' | 'yellow' | 'green';
}

const DetailItem: React.FC<DetailItemProps> = ({ label, value, highlight }) => {
  const highlightColors = {
    red: 'text-red-400',
    yellow: 'text-yellow-400',
    green: 'text-green-400',
  };

  return (
    <div>
      <p className="text-xs text-cscx-gray-400">{label}</p>
      <p className={`text-sm font-medium ${highlight ? highlightColors[highlight] : 'text-white'}`}>
        {value}
      </p>
    </div>
  );
};

// ============================================
// Icons
// ============================================

const RefreshIcon: React.FC = () => (
  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
  </svg>
);

const AlertIcon: React.FC = () => (
  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
  </svg>
);

const ChevronRightIcon: React.FC = () => (
  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
  </svg>
);

const CloseIcon: React.FC = () => (
  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
  </svg>
);

const CheckIcon: React.FC = () => (
  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
  </svg>
);

const InvoiceIcon: React.FC<{ className?: string }> = ({ className }) => (
  <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
  </svg>
);

export default InvoiceNotifications;
