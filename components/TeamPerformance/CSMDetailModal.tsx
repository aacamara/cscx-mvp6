/**
 * CSM Detail Modal
 * PRD-178: Individual CSM metrics drill-down
 */

import React, { useState, useEffect, useCallback } from 'react';
import { CSMDetailResponse } from '../../types/teamPerformance';

const API_BASE = `${import.meta.env.VITE_API_URL || ''}/api`;

interface CSMDetailModalProps {
  userId: string;
  onClose: () => void;
}

// Helper functions
const formatCurrency = (amount: number): string => {
  if (amount >= 1000000) {
    return `$${(amount / 1000000).toFixed(1)}M`;
  }
  if (amount >= 1000) {
    return `$${(amount / 1000).toFixed(0)}K`;
  }
  return `$${amount.toFixed(0)}`;
};

const getHealthColor = (score: number): string => {
  if (score >= 70) return 'text-green-400';
  if (score >= 40) return 'text-yellow-400';
  return 'text-red-400';
};

const getHealthBg = (category: string): string => {
  switch (category) {
    case 'healthy': return 'bg-green-500';
    case 'warning': return 'bg-yellow-500';
    case 'critical': return 'bg-red-500';
    default: return 'bg-gray-500';
  }
};

const getActivityIcon = (type: string): string => {
  switch (type) {
    case 'meeting': return '\uD83D\uDCC5';
    case 'email': return '\u2709\uFE0F';
    case 'call': return '\uD83D\uDCDE';
    case 'note': return '\uD83D\uDCDD';
    case 'task': return '\u2705';
    default: return '\uD83D\uDCCB';
  }
};

export const CSMDetailModal: React.FC<CSMDetailModalProps> = ({ userId, onClose }) => {
  const [data, setData] = useState<CSMDetailResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'overview' | 'customers' | 'activity'>('overview');

  const fetchCSMDetail = useCallback(async () => {
    setLoading(true);
    try {
      const response = await fetch(`${API_BASE}/reports/team-performance/${userId}`);
      if (!response.ok) throw new Error('Failed to fetch CSM details');

      const result = await response.json();
      if (result.success) {
        setData(result.data);
        setError(null);
      } else {
        throw new Error(result.error?.message || 'Unknown error');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load data');
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    fetchCSMDetail();
  }, [fetchCSMDetail]);

  // Handle escape key
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleEscape);
    return () => window.removeEventListener('keydown', handleEscape);
  }, [onClose]);

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
      <div className="bg-cscx-gray-900 border border-cscx-gray-800 rounded-xl w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-cscx-gray-800">
          <div>
            {data && (
              <>
                <h2 className="text-xl font-bold text-white">{data.csm.user_name}</h2>
                <p className="text-sm text-cscx-gray-400">{data.csm.email}</p>
              </>
            )}
            {loading && <div className="h-8 w-48 bg-cscx-gray-800 rounded animate-pulse" />}
          </div>
          <button
            onClick={onClose}
            className="p-2 text-cscx-gray-400 hover:text-white hover:bg-cscx-gray-800 rounded-lg transition-colors"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Loading State */}
        {loading && (
          <div className="flex-1 flex items-center justify-center">
            <div className="animate-spin w-8 h-8 border-2 border-cscx-accent border-t-transparent rounded-full" />
          </div>
        )}

        {/* Error State */}
        {error && (
          <div className="flex-1 flex items-center justify-center">
            <div className="text-center">
              <p className="text-red-400 mb-2">{error}</p>
              <button
                onClick={fetchCSMDetail}
                className="text-sm text-cscx-accent hover:underline"
              >
                Try again
              </button>
            </div>
          </div>
        )}

        {/* Content */}
        {data && !loading && (
          <>
            {/* Tabs */}
            <div className="flex border-b border-cscx-gray-800">
              {(['overview', 'customers', 'activity'] as const).map(tab => (
                <button
                  key={tab}
                  onClick={() => setActiveTab(tab)}
                  className={`px-4 py-3 text-sm font-medium transition-colors capitalize ${
                    activeTab === tab
                      ? 'text-cscx-accent border-b-2 border-cscx-accent'
                      : 'text-cscx-gray-400 hover:text-white'
                  }`}
                >
                  {tab}
                </button>
              ))}
            </div>

            {/* Tab Content */}
            <div className="flex-1 overflow-y-auto p-4">
              {/* Overview Tab */}
              {activeTab === 'overview' && (
                <div className="space-y-6">
                  {/* Key Metrics */}
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div className="bg-cscx-gray-800/50 rounded-lg p-3">
                      <p className="text-xs text-cscx-gray-400 mb-1">Portfolio</p>
                      <p className="text-xl font-bold text-white">{formatCurrency(data.csm.portfolio_value)}</p>
                      <p className="text-xs text-cscx-gray-500">{data.csm.customer_count} customers</p>
                    </div>
                    <div className="bg-cscx-gray-800/50 rounded-lg p-3">
                      <p className="text-xs text-cscx-gray-400 mb-1">Retention</p>
                      <p className={`text-xl font-bold ${data.csm.retention_rate >= 96 ? 'text-green-400' : data.csm.retention_rate >= 90 ? 'text-yellow-400' : 'text-red-400'}`}>
                        {data.csm.retention_rate}%
                      </p>
                      <p className="text-xs text-cscx-gray-500">vs {data.csm.retention_rate_previous}% prev</p>
                    </div>
                    <div className="bg-cscx-gray-800/50 rounded-lg p-3">
                      <p className="text-xs text-cscx-gray-400 mb-1">NRR</p>
                      <p className={`text-xl font-bold ${data.csm.net_revenue_retention >= 110 ? 'text-green-400' : data.csm.net_revenue_retention >= 100 ? 'text-yellow-400' : 'text-red-400'}`}>
                        {data.csm.net_revenue_retention}%
                      </p>
                      <p className="text-xs text-cscx-gray-500">vs {data.csm.nrr_previous}% prev</p>
                    </div>
                    <div className="bg-cscx-gray-800/50 rounded-lg p-3">
                      <p className="text-xs text-cscx-gray-400 mb-1">Health Avg</p>
                      <p className={`text-xl font-bold ${getHealthColor(data.csm.health_score_avg)}`}>
                        {data.csm.health_score_avg}
                      </p>
                      <p className="text-xs text-cscx-gray-500">vs {data.csm.health_score_avg_previous} prev</p>
                    </div>
                  </div>

                  {/* Activity Metrics */}
                  <div className="bg-cscx-gray-800/30 rounded-lg p-4">
                    <h4 className="text-sm font-medium text-white mb-3">Activity This Month</h4>
                    <div className="grid grid-cols-3 gap-4">
                      <div className="text-center">
                        <p className="text-2xl font-bold text-white">{data.csm.meetings_this_month}</p>
                        <p className="text-xs text-cscx-gray-400">Meetings</p>
                      </div>
                      <div className="text-center">
                        <p className="text-2xl font-bold text-white">{data.csm.emails_this_month}</p>
                        <p className="text-xs text-cscx-gray-400">Emails</p>
                      </div>
                      <div className="text-center">
                        <p className="text-2xl font-bold text-white">{data.csm.tasks_completed}</p>
                        <p className="text-xs text-cscx-gray-400">Tasks</p>
                      </div>
                    </div>
                    <div className="mt-4">
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-xs text-cscx-gray-400">Activity Score</span>
                        <span className="text-xs text-white font-medium">{data.csm.activity_score}/100</span>
                      </div>
                      <div className="h-2 bg-cscx-gray-700 rounded-full overflow-hidden">
                        <div
                          className={`h-full ${data.csm.activity_score >= 80 ? 'bg-green-500' : data.csm.activity_score >= 60 ? 'bg-yellow-500' : 'bg-red-500'}`}
                          style={{ width: `${data.csm.activity_score}%` }}
                        />
                      </div>
                    </div>
                  </div>

                  {/* Goals */}
                  <div>
                    <h4 className="text-sm font-medium text-white mb-3">Goals</h4>
                    <div className="space-y-3">
                      {data.goals.map(goal => (
                        <div key={goal.id} className="bg-cscx-gray-800/30 rounded-lg p-3">
                          <div className="flex items-center justify-between mb-2">
                            <span className="text-sm text-white capitalize">{goal.metric}</span>
                            <span className={`text-xs px-2 py-0.5 rounded ${
                              goal.status === 'on_track' ? 'bg-green-500/20 text-green-400' :
                              goal.status === 'at_risk' ? 'bg-yellow-500/20 text-yellow-400' :
                              'bg-red-500/20 text-red-400'
                            }`}>
                              {goal.status.replace('_', ' ')}
                            </span>
                          </div>
                          <div className="flex items-center justify-between text-sm">
                            <span className="text-cscx-gray-400">
                              {goal.current_value}{goal.metric === 'retention' || goal.metric === 'nrr' ? '%' : ''} / {goal.target_value}{goal.metric === 'retention' || goal.metric === 'nrr' ? '%' : ''}
                            </span>
                            <span className="text-cscx-gray-500">
                              {Math.round((goal.current_value / goal.target_value) * 100)}% complete
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {/* Customers Tab */}
              {activeTab === 'customers' && (
                <div className="space-y-2">
                  {data.customers.map(customer => (
                    <div
                      key={customer.customer_id}
                      className="flex items-center justify-between p-3 bg-cscx-gray-800/30 rounded-lg hover:bg-cscx-gray-800/50 transition-colors"
                    >
                      <div className="flex items-center gap-3">
                        <div className={`w-2 h-2 rounded-full ${getHealthBg(customer.health_category)}`} />
                        <div>
                          <p className="text-white font-medium">{customer.customer_name}</p>
                          <p className="text-xs text-cscx-gray-500">{formatCurrency(customer.arr)} ARR</p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className={`font-medium ${getHealthColor(customer.health_score)}`}>
                          {customer.health_score}
                        </p>
                        {customer.days_to_renewal !== null && (
                          <p className={`text-xs ${customer.days_to_renewal <= 30 ? 'text-red-400' : customer.days_to_renewal <= 90 ? 'text-yellow-400' : 'text-cscx-gray-500'}`}>
                            Renewal in {customer.days_to_renewal} days
                          </p>
                        )}
                      </div>
                    </div>
                  ))}
                  {data.customers.length === 0 && (
                    <p className="text-center text-cscx-gray-500 py-8">No customers assigned</p>
                  )}
                </div>
              )}

              {/* Activity Tab */}
              {activeTab === 'activity' && (
                <div className="space-y-2">
                  {data.activity_log.map(activity => (
                    <div
                      key={activity.id}
                      className="flex items-start gap-3 p-3 bg-cscx-gray-800/30 rounded-lg"
                    >
                      <span className="text-lg">{getActivityIcon(activity.type)}</span>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-medium text-white capitalize">{activity.type}</span>
                          <span className="text-xs text-cscx-gray-500">-</span>
                          <span className="text-sm text-cscx-gray-300">{activity.customer_name}</span>
                        </div>
                        <p className="text-xs text-cscx-gray-500 mt-0.5">{activity.description}</p>
                      </div>
                      <span className="text-xs text-cscx-gray-500 whitespace-nowrap">
                        {new Date(activity.timestamp).toLocaleDateString()}
                      </span>
                    </div>
                  ))}
                  {data.activity_log.length === 0 && (
                    <p className="text-center text-cscx-gray-500 py-8">No recent activity</p>
                  )}
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
};
