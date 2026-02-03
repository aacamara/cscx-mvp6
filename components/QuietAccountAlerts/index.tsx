/**
 * Quiet Account Alerts Component
 * PRD-106: Display and manage quiet account alerts
 *
 * Features:
 * - Portfolio-level quiet account overview
 * - Severity-based filtering and sorting
 * - Account detail panel with re-engagement suggestions
 * - Check-in email drafting
 * - Quick actions for marking re-engaged or excluded
 */

import React, { useState, useMemo } from 'react';
import { useQuietAccounts } from '../../hooks/useQuietAccounts';
import {
  QuietAccountAlert,
  QuietSeverity,
  CustomerSegment,
  ReEngagementSuggestion,
  CheckInEmailDraft,
} from '../../types/quietAccount';

// ============================================
// SEVERITY BADGE COMPONENT
// ============================================

interface SeverityBadgeProps {
  severity: QuietSeverity;
}

const SeverityBadge: React.FC<SeverityBadgeProps> = ({ severity }) => {
  const config = {
    critical: {
      bg: 'bg-red-500/20',
      text: 'text-red-400',
      border: 'border-red-500/50',
      icon: '🚨',
    },
    elevated: {
      bg: 'bg-orange-500/20',
      text: 'text-orange-400',
      border: 'border-orange-500/50',
      icon: '⚠️',
    },
    warning: {
      bg: 'bg-yellow-500/20',
      text: 'text-yellow-400',
      border: 'border-yellow-500/50',
      icon: '🔔',
    },
  };

  const { bg, text, border, icon } = config[severity];

  return (
    <span
      className={`inline-flex items-center gap-1 px-2 py-0.5 text-xs font-medium rounded-full ${bg} ${text} border ${border}`}
    >
      <span>{icon}</span>
      {severity.charAt(0).toUpperCase() + severity.slice(1)}
    </span>
  );
};

// ============================================
// SUMMARY CARD COMPONENT
// ============================================

interface SummaryCardProps {
  title: string;
  value: number | string;
  subtitle?: string;
  trend?: 'up' | 'down' | 'neutral';
  color?: 'red' | 'orange' | 'yellow' | 'gray';
}

const SummaryCard: React.FC<SummaryCardProps> = ({
  title,
  value,
  subtitle,
  color = 'gray',
}) => {
  const colorClasses = {
    red: 'border-red-500/30 bg-red-500/10',
    orange: 'border-orange-500/30 bg-orange-500/10',
    yellow: 'border-yellow-500/30 bg-yellow-500/10',
    gray: 'border-gray-700 bg-gray-800/50',
  };

  return (
    <div className={`rounded-lg border p-4 ${colorClasses[color]}`}>
      <p className="text-xs text-gray-400 uppercase tracking-wider">{title}</p>
      <p className="text-2xl font-bold text-white mt-1">{value}</p>
      {subtitle && <p className="text-xs text-gray-500 mt-1">{subtitle}</p>}
    </div>
  );
};

// ============================================
// ACCOUNT ROW COMPONENT
// ============================================

interface AccountRowProps {
  account: QuietAccountAlert;
  onSelect: (customerId: string) => void;
  onMarkReEngaged: (customerId: string) => void;
  isSelected: boolean;
}

const AccountRow: React.FC<AccountRowProps> = ({
  account,
  onSelect,
  onMarkReEngaged,
  isSelected,
}) => {
  const lastActivity = account.lastActivities[0];

  return (
    <tr
      className={`border-b border-gray-800 hover:bg-gray-800/50 cursor-pointer transition-colors ${
        isSelected ? 'bg-gray-800/70' : ''
      }`}
      onClick={() => onSelect(account.customerId)}
    >
      <td className="px-4 py-3">
        <div className="flex flex-col">
          <span className="font-medium text-white">{account.customerName}</span>
          <span className="text-xs text-gray-500">{account.context.segment}</span>
        </div>
      </td>
      <td className="px-4 py-3">
        <SeverityBadge severity={account.severity} />
      </td>
      <td className="px-4 py-3">
        <div className="flex flex-col">
          <span className="text-white font-medium">{account.quietDays} days</span>
          <span className="text-xs text-gray-500">Threshold: {account.threshold}d</span>
        </div>
      </td>
      <td className="px-4 py-3">
        {lastActivity ? (
          <div className="flex flex-col">
            <span className="text-sm text-gray-300 capitalize">
              {lastActivity.type.replace('_', ' ')}
            </span>
            <span className="text-xs text-gray-500">{lastActivity.daysAgo} days ago</span>
          </div>
        ) : (
          <span className="text-gray-500 text-sm">No activity</span>
        )}
      </td>
      <td className="px-4 py-3">
        <span className="text-white">${account.context.arr.toLocaleString()}</span>
      </td>
      <td className="px-4 py-3">
        <div className="flex items-center gap-2">
          <span
            className={`w-2 h-2 rounded-full ${
              account.context.healthScore >= 70
                ? 'bg-green-500'
                : account.context.healthScore >= 40
                ? 'bg-yellow-500'
                : 'bg-red-500'
            }`}
          />
          <span className="text-white">{account.context.healthScore}</span>
        </div>
      </td>
      <td className="px-4 py-3">
        {account.context.daysToRenewal !== null ? (
          <span
            className={`text-sm ${
              account.context.daysToRenewal <= 60
                ? 'text-red-400'
                : account.context.daysToRenewal <= 90
                ? 'text-orange-400'
                : 'text-gray-300'
            }`}
          >
            {account.context.daysToRenewal}d
          </span>
        ) : (
          <span className="text-gray-500">-</span>
        )}
      </td>
      <td className="px-4 py-3">
        <button
          onClick={(e) => {
            e.stopPropagation();
            onMarkReEngaged(account.customerId);
          }}
          className="text-xs px-2 py-1 rounded bg-green-500/20 text-green-400 hover:bg-green-500/30 transition-colors"
        >
          Re-engaged
        </button>
      </td>
    </tr>
  );
};

// ============================================
// DETAIL PANEL COMPONENT
// ============================================

interface DetailPanelProps {
  accountId: string;
  onClose: () => void;
  onMarkReEngaged: (customerId: string) => void;
  onExclude: (customerId: string, reason: string) => void;
}

const DetailPanel: React.FC<DetailPanelProps> = ({
  accountId,
  onClose,
  onMarkReEngaged,
  onExclude,
}) => {
  const [emailDraft, setEmailDraft] = useState<CheckInEmailDraft | null>(null);
  const [loadingEmail, setLoadingEmail] = useState(false);
  const [excludeReason, setExcludeReason] = useState('');
  const [showExcludeForm, setShowExcludeForm] = useState(false);

  const {
    accountDetail,
    accountDetailLoading,
    fetchAccountDetail,
    fetchCheckInEmail,
  } = useQuietAccounts({ autoFetch: false });

  // Fetch detail when accountId changes
  React.useEffect(() => {
    if (accountId) {
      fetchAccountDetail(accountId);
    }
  }, [accountId, fetchAccountDetail]);

  const handleDraftEmail = async () => {
    setLoadingEmail(true);
    const draft = await fetchCheckInEmail(accountId);
    setEmailDraft(draft);
    setLoadingEmail(false);
  };

  const handleExclude = () => {
    if (excludeReason) {
      onExclude(accountId, excludeReason);
      setShowExcludeForm(false);
      setExcludeReason('');
    }
  };

  if (accountDetailLoading) {
    return (
      <div className="fixed inset-y-0 right-0 w-96 bg-gray-900 border-l border-gray-800 shadow-xl p-6 overflow-y-auto">
        <div className="flex items-center justify-center h-full">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-cscx-accent" />
        </div>
      </div>
    );
  }

  if (!accountDetail) {
    return null;
  }

  const { alert, reEngagementSuggestions } = accountDetail;

  return (
    <div className="fixed inset-y-0 right-0 w-[480px] bg-gray-900 border-l border-gray-800 shadow-xl overflow-y-auto">
      {/* Header */}
      <div className="sticky top-0 bg-gray-900 border-b border-gray-800 p-4 flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-white">{alert.customerName}</h2>
          <div className="flex items-center gap-2 mt-1">
            <SeverityBadge severity={alert.severity} />
            <span className="text-sm text-gray-400">{alert.quietDays} days silent</span>
          </div>
        </div>
        <button
          onClick={onClose}
          className="text-gray-400 hover:text-white p-2 rounded hover:bg-gray-800"
        >
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      <div className="p-4 space-y-6">
        {/* Interpretation */}
        <div className="bg-gray-800/50 rounded-lg p-4">
          <h3 className="text-sm font-medium text-gray-300 mb-2">Interpretation</h3>
          <p className="text-sm text-gray-400">{alert.interpretation}</p>
        </div>

        {/* Account Context */}
        <div>
          <h3 className="text-sm font-medium text-gray-300 mb-3">Account Context</h3>
          <div className="grid grid-cols-2 gap-3">
            <div className="bg-gray-800/50 rounded p-3">
              <p className="text-xs text-gray-500">ARR</p>
              <p className="text-white font-medium">${alert.context.arr.toLocaleString()}</p>
            </div>
            <div className="bg-gray-800/50 rounded p-3">
              <p className="text-xs text-gray-500">Health Score</p>
              <p className="text-white font-medium">{alert.context.healthScore}</p>
            </div>
            <div className="bg-gray-800/50 rounded p-3">
              <p className="text-xs text-gray-500">Segment</p>
              <p className="text-white font-medium capitalize">{alert.context.segment}</p>
            </div>
            <div className="bg-gray-800/50 rounded p-3">
              <p className="text-xs text-gray-500">Renewal</p>
              <p className="text-white font-medium">
                {alert.context.daysToRenewal !== null
                  ? `${alert.context.daysToRenewal} days`
                  : 'N/A'}
              </p>
            </div>
          </div>
        </div>

        {/* Last Activities */}
        <div>
          <h3 className="text-sm font-medium text-gray-300 mb-3">Last Activities</h3>
          <div className="space-y-2">
            {alert.lastActivities.length > 0 ? (
              alert.lastActivities.map((activity, idx) => (
                <div
                  key={idx}
                  className="flex items-center justify-between bg-gray-800/50 rounded p-3"
                >
                  <div className="flex items-center gap-3">
                    <span className="text-lg">
                      {activity.type === 'meeting' && '📅'}
                      {activity.type === 'email_sent' && '📤'}
                      {activity.type === 'email_received' && '📥'}
                      {activity.type === 'support_ticket' && '🎫'}
                      {activity.type === 'csm_note' && '📝'}
                      {activity.type === 'call' && '📞'}
                      {activity.type === 'qbr' && '📊'}
                    </span>
                    <div>
                      <p className="text-sm text-white capitalize">
                        {activity.type.replace('_', ' ')}
                      </p>
                      {activity.subject && (
                        <p className="text-xs text-gray-500">{activity.subject}</p>
                      )}
                    </div>
                  </div>
                  <span className="text-sm text-gray-400">{activity.daysAgo}d ago</span>
                </div>
              ))
            ) : (
              <p className="text-sm text-gray-500">No recent activities recorded</p>
            )}
          </div>
        </div>

        {/* Re-engagement Suggestions */}
        <div>
          <h3 className="text-sm font-medium text-gray-300 mb-3">Re-engagement Suggestions</h3>
          <div className="space-y-2">
            {reEngagementSuggestions.map((suggestion, idx) => (
              <div key={idx} className="bg-gray-800/50 rounded p-3">
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-lg">
                    {suggestion.type === 'email' && '✉️'}
                    {suggestion.type === 'meeting' && '📅'}
                    {suggestion.type === 'call' && '📞'}
                    {suggestion.type === 'value_summary' && '📈'}
                  </span>
                  <span className="text-sm font-medium text-white">{suggestion.title}</span>
                  <span
                    className={`text-xs px-1.5 py-0.5 rounded ${
                      suggestion.priority === 'high'
                        ? 'bg-red-500/20 text-red-400'
                        : suggestion.priority === 'medium'
                        ? 'bg-yellow-500/20 text-yellow-400'
                        : 'bg-gray-500/20 text-gray-400'
                    }`}
                  >
                    {suggestion.priority}
                  </span>
                </div>
                <p className="text-xs text-gray-400">{suggestion.description}</p>
                {suggestion.conversationStarters && suggestion.conversationStarters.length > 0 && (
                  <div className="mt-2 pt-2 border-t border-gray-700">
                    <p className="text-xs text-gray-500 mb-1">Conversation starters:</p>
                    <ul className="text-xs text-gray-400 space-y-1">
                      {suggestion.conversationStarters.slice(0, 2).map((starter, sidx) => (
                        <li key={sidx} className="italic">"{starter}"</li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Email Draft Section */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-medium text-gray-300">Check-In Email</h3>
            {!emailDraft && (
              <button
                onClick={handleDraftEmail}
                disabled={loadingEmail}
                className="text-xs px-3 py-1.5 rounded bg-cscx-accent/20 text-cscx-accent hover:bg-cscx-accent/30 transition-colors disabled:opacity-50"
              >
                {loadingEmail ? 'Generating...' : 'Draft Email'}
              </button>
            )}
          </div>

          {emailDraft && (
            <div className="bg-gray-800/50 rounded-lg p-4 space-y-3">
              <div>
                <p className="text-xs text-gray-500">Subject</p>
                <p className="text-sm text-white">{emailDraft.subject}</p>
              </div>
              <div>
                <p className="text-xs text-gray-500">Body</p>
                <p className="text-sm text-gray-300 whitespace-pre-wrap">{emailDraft.body}</p>
              </div>
              <div className="flex gap-2 pt-2">
                <button className="flex-1 px-3 py-2 rounded bg-cscx-accent text-white text-sm font-medium hover:bg-cscx-accent/80 transition-colors">
                  Send Email
                </button>
                <button
                  onClick={() => setEmailDraft(null)}
                  className="px-3 py-2 rounded bg-gray-700 text-gray-300 text-sm hover:bg-gray-600 transition-colors"
                >
                  Discard
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Suggested Actions */}
        <div>
          <h3 className="text-sm font-medium text-gray-300 mb-3">Suggested Actions</h3>
          <ul className="space-y-2">
            {alert.suggestedActions.map((action, idx) => (
              <li
                key={idx}
                className="flex items-start gap-2 text-sm text-gray-400"
              >
                <span className="text-cscx-accent mt-0.5">•</span>
                <span>{action}</span>
              </li>
            ))}
          </ul>
        </div>

        {/* Action Buttons */}
        <div className="pt-4 border-t border-gray-800 space-y-3">
          <button
            onClick={() => onMarkReEngaged(accountId)}
            className="w-full px-4 py-2 rounded bg-green-500/20 text-green-400 font-medium hover:bg-green-500/30 transition-colors"
          >
            Mark as Re-engaged
          </button>

          {!showExcludeForm ? (
            <button
              onClick={() => setShowExcludeForm(true)}
              className="w-full px-4 py-2 rounded bg-gray-700 text-gray-300 hover:bg-gray-600 transition-colors"
            >
              Exclude from Alerts
            </button>
          ) : (
            <div className="space-y-2">
              <input
                type="text"
                placeholder="Reason for exclusion..."
                value={excludeReason}
                onChange={(e) => setExcludeReason(e.target.value)}
                className="w-full px-3 py-2 rounded bg-gray-800 border border-gray-700 text-white text-sm focus:outline-none focus:border-cscx-accent"
              />
              <div className="flex gap-2">
                <button
                  onClick={handleExclude}
                  disabled={!excludeReason}
                  className="flex-1 px-3 py-2 rounded bg-orange-500/20 text-orange-400 text-sm font-medium hover:bg-orange-500/30 transition-colors disabled:opacity-50"
                >
                  Confirm Exclude
                </button>
                <button
                  onClick={() => {
                    setShowExcludeForm(false);
                    setExcludeReason('');
                  }}
                  className="px-3 py-2 rounded bg-gray-700 text-gray-300 text-sm hover:bg-gray-600 transition-colors"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

// ============================================
// MAIN COMPONENT
// ============================================

interface QuietAccountAlertsProps {
  csmId?: string;
  className?: string;
}

export const QuietAccountAlerts: React.FC<QuietAccountAlertsProps> = ({
  csmId,
  className = '',
}) => {
  const {
    accounts,
    summary,
    loading,
    error,
    filters,
    setFilters,
    refetch,
    selectedAccountId,
    fetchAccountDetail,
    clearAccountDetail,
    markReEngaged,
    excludeFromAlerts,
    runScan,
  } = useQuietAccounts({
    autoFetch: true,
    initialFilters: { csmId },
  });

  const [selectedSeverity, setSelectedSeverity] = useState<QuietSeverity | 'all'>('all');
  const [selectedSegment, setSelectedSegment] = useState<CustomerSegment | 'all'>('all');
  const [showDetailPanel, setShowDetailPanel] = useState(false);
  const [selectedAccount, setSelectedAccount] = useState<string | null>(null);

  // Filter accounts based on local filters
  const filteredAccounts = useMemo(() => {
    let result = accounts;

    if (selectedSeverity !== 'all') {
      result = result.filter((a) => a.severity === selectedSeverity);
    }

    if (selectedSegment !== 'all') {
      result = result.filter((a) => a.context.segment === selectedSegment);
    }

    return result;
  }, [accounts, selectedSeverity, selectedSegment]);

  const handleSelectAccount = (customerId: string) => {
    setSelectedAccount(customerId);
    setShowDetailPanel(true);
  };

  const handleCloseDetail = () => {
    setShowDetailPanel(false);
    setSelectedAccount(null);
    clearAccountDetail();
  };

  const handleMarkReEngaged = async (customerId: string) => {
    const success = await markReEngaged(customerId, 'email_sent');
    if (success) {
      handleCloseDetail();
    }
  };

  const handleExclude = async (customerId: string, reason: string) => {
    const success = await excludeFromAlerts(customerId, reason);
    if (success) {
      handleCloseDetail();
    }
  };

  if (loading && accounts.length === 0) {
    return (
      <div className={`bg-gray-900 rounded-lg p-8 ${className}`}>
        <div className="flex items-center justify-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-cscx-accent" />
          <span className="ml-3 text-gray-400">Loading quiet accounts...</span>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className={`bg-gray-900 rounded-lg p-8 ${className}`}>
        <div className="text-center">
          <p className="text-red-400 mb-4">{error}</p>
          <button
            onClick={refetch}
            className="px-4 py-2 rounded bg-cscx-accent text-white hover:bg-cscx-accent/80"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className={`bg-gray-900 rounded-lg ${className}`}>
      {/* Header */}
      <div className="border-b border-gray-800 p-6">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-xl font-semibold text-white flex items-center gap-2">
              <span>🔇</span> Quiet Account Alerts
            </h1>
            <p className="text-sm text-gray-400 mt-1">
              Accounts with no meaningful interaction beyond threshold
            </p>
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => runScan()}
              className="px-4 py-2 rounded bg-gray-800 text-gray-300 hover:bg-gray-700 transition-colors text-sm"
            >
              Run Scan
            </button>
            <button
              onClick={refetch}
              className="px-4 py-2 rounded bg-cscx-accent text-white hover:bg-cscx-accent/80 transition-colors text-sm"
            >
              Refresh
            </button>
          </div>
        </div>

        {/* Summary Cards */}
        {summary && (
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
            <SummaryCard
              title="Total Quiet"
              value={summary.totalQuietAccounts}
              subtitle="Accounts needing attention"
            />
            <SummaryCard
              title="Critical"
              value={summary.bySeverity.critical}
              color="red"
              subtitle="60+ days silent"
            />
            <SummaryCard
              title="Elevated"
              value={summary.bySeverity.elevated}
              color="orange"
              subtitle="1.5x threshold"
            />
            <SummaryCard
              title="Warning"
              value={summary.bySeverity.warning}
              color="yellow"
              subtitle="Just passed threshold"
            />
            <SummaryCard
              title="ARR at Risk"
              value={`$${(summary.totalArrAtRisk / 1000).toFixed(0)}K`}
              subtitle="Total quiet account value"
            />
            <SummaryCard
              title="Avg Quiet Days"
              value={summary.avgQuietDays}
              subtitle="Days since interaction"
            />
          </div>
        )}
      </div>

      {/* Filters */}
      <div className="border-b border-gray-800 px-6 py-3 flex items-center gap-4">
        <div className="flex items-center gap-2">
          <label className="text-sm text-gray-400">Severity:</label>
          <select
            value={selectedSeverity}
            onChange={(e) => setSelectedSeverity(e.target.value as any)}
            className="bg-gray-800 border border-gray-700 rounded px-3 py-1.5 text-sm text-white focus:outline-none focus:border-cscx-accent"
          >
            <option value="all">All</option>
            <option value="critical">Critical</option>
            <option value="elevated">Elevated</option>
            <option value="warning">Warning</option>
          </select>
        </div>

        <div className="flex items-center gap-2">
          <label className="text-sm text-gray-400">Segment:</label>
          <select
            value={selectedSegment}
            onChange={(e) => setSelectedSegment(e.target.value as any)}
            className="bg-gray-800 border border-gray-700 rounded px-3 py-1.5 text-sm text-white focus:outline-none focus:border-cscx-accent"
          >
            <option value="all">All</option>
            <option value="enterprise">Enterprise</option>
            <option value="mid-market">Mid-Market</option>
            <option value="smb">SMB</option>
            <option value="startup">Startup</option>
          </select>
        </div>

        <div className="ml-auto text-sm text-gray-500">
          Showing {filteredAccounts.length} of {accounts.length} accounts
        </div>
      </div>

      {/* Table */}
      <div className="overflow-x-auto">
        {filteredAccounts.length > 0 ? (
          <table className="w-full">
            <thead className="bg-gray-800/50">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">
                  Account
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">
                  Severity
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">
                  Quiet Days
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">
                  Last Activity
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">
                  ARR
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">
                  Health
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">
                  Renewal
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">
                  Action
                </th>
              </tr>
            </thead>
            <tbody>
              {filteredAccounts.map((account) => (
                <AccountRow
                  key={account.id}
                  account={account}
                  onSelect={handleSelectAccount}
                  onMarkReEngaged={handleMarkReEngaged}
                  isSelected={selectedAccount === account.customerId}
                />
              ))}
            </tbody>
          </table>
        ) : (
          <div className="text-center py-12">
            <div className="text-4xl mb-4">🎉</div>
            <p className="text-gray-300 text-lg">No quiet accounts found</p>
            <p className="text-gray-500 text-sm mt-1">
              All accounts are actively engaged within their thresholds
            </p>
          </div>
        )}
      </div>

      {/* Detail Panel */}
      {showDetailPanel && selectedAccount && (
        <DetailPanel
          accountId={selectedAccount}
          onClose={handleCloseDetail}
          onMarkReEngaged={handleMarkReEngaged}
          onExclude={handleExclude}
        />
      )}
    </div>
  );
};

export default QuietAccountAlerts;
