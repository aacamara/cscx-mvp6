/**
 * Time Allocation Analysis View
 * PRD-161: Time tracking and analysis for CSM productivity
 *
 * Features:
 * - Team Summary with key metrics
 * - Activity Type Breakdown (horizontal bar chart)
 * - CSM Comparison Table
 * - Customer Time Analysis with efficiency metrics
 * - Weekly Trend Chart
 * - Optimization Alerts/Recommendations
 * - Manual Time Entry
 */

import React, { useState, useCallback } from 'react';
import {
  TimeAllocationResponse,
  CSMTimeDetailResponse,
  TimeAllocationFilters,
  ActivityBreakdown,
  CustomerTimeBreakdown,
  CSMTimeBreakdown,
  WeeklyTrend,
  OptimizationSuggestion,
  ActivityType,
  ACTIVITY_CONFIG,
  TIME_TARGETS,
  CreateTimeEntryRequest
} from '../../types/timeAllocation';
import { useTimeAllocation } from '../../hooks/useTimeAllocation';
import { CSMDetailModal } from './CSMDetailModal';
import { TimeEntryModal } from './TimeEntryModal';
import { TrendChart } from './TrendChart';

// ============================================
// HELPER FUNCTIONS
// ============================================

const formatCurrency = (amount: number): string => {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0
  }).format(amount);
};

const formatHours = (hours: number): string => {
  return `${hours.toFixed(1)} hrs`;
};

const getEfficiencyColor = (status: string): string => {
  switch (status) {
    case 'excellent': return 'text-green-400';
    case 'normal': return 'text-yellow-400';
    case 'high': return 'text-red-400';
    default: return 'text-gray-400';
  }
};

const getEfficiencyBadge = (status: string): { bg: string; text: string; label: string } => {
  switch (status) {
    case 'excellent':
      return { bg: 'bg-green-500/20', text: 'text-green-400', label: 'Efficient' };
    case 'normal':
      return { bg: 'bg-yellow-500/20', text: 'text-yellow-400', label: 'Normal' };
    case 'high':
      return { bg: 'bg-red-500/20', text: 'text-red-400', label: 'High' };
    default:
      return { bg: 'bg-gray-500/20', text: 'text-gray-400', label: '-' };
  }
};

const getPriorityColor = (priority: string): string => {
  switch (priority) {
    case 'high': return 'border-red-500/50 bg-red-500/10';
    case 'medium': return 'border-yellow-500/50 bg-yellow-500/10';
    case 'low': return 'border-blue-500/50 bg-blue-500/10';
    default: return 'border-gray-500/50 bg-gray-500/10';
  }
};

const getPriorityIcon = (priority: string): string => {
  switch (priority) {
    case 'high': return '!';
    case 'medium': return '!!';
    case 'low': return 'i';
    default: return '-';
  }
};

// ============================================
// MAIN COMPONENT
// ============================================

interface TimeAllocationProps {
  onSelectCustomer?: (customerId: string) => void;
}

export const TimeAllocation: React.FC<TimeAllocationProps> = ({
  onSelectCustomer
}) => {
  // State
  const [showTimeEntryModal, setShowTimeEntryModal] = useState(false);
  const [selectedActivityFilter, setSelectedActivityFilter] = useState<ActivityType | 'all'>('all');

  // Use the custom hook
  const {
    data,
    loading,
    error,
    filters,
    setFilters,
    fetchReport,
    selectedCsmId,
    csmDetail,
    csmDetailLoading,
    fetchCsmDetail,
    clearCsmDetail,
    createTimeEntry,
    createEntryLoading,
    exportToCsv
  } = useTimeAllocation();

  // Handlers
  const handlePeriodChange = (period: TimeAllocationFilters['period']) => {
    setFilters(prev => ({ ...prev, period }));
  };

  const handleCsmClick = (csmId: string) => {
    fetchCsmDetail(csmId);
  };

  const handleTimeEntrySubmit = async (entry: CreateTimeEntryRequest) => {
    const result = await createTimeEntry(entry);
    if (result) {
      setShowTimeEntryModal(false);
    }
    return !!result;
  };

  // Loading state
  if (loading && !data) {
    return (
      <div className="p-8 text-center text-cscx-gray-400">
        <div className="animate-spin w-8 h-8 border-2 border-cscx-accent border-t-transparent rounded-full mx-auto mb-2" />
        Loading time allocation data...
      </div>
    );
  }

  // Error state
  if (error && !data) {
    return (
      <div className="p-8 text-center text-red-400">
        {error}
        <button
          onClick={fetchReport}
          className="block mx-auto mt-2 text-sm text-cscx-accent hover:underline"
        >
          Try again
        </button>
      </div>
    );
  }

  if (!data) return null;

  const { summary, by_activity, by_csm, by_customer, trends, recommendations } = data;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-white">Time Allocation Analysis</h2>
          <p className="text-cscx-gray-400 text-sm mt-1">
            {summary.period_label} - Last updated: {new Date().toLocaleTimeString()}
          </p>
        </div>
        <div className="flex items-center gap-3">
          {/* Period Selector */}
          <select
            value={filters.period || 'month'}
            onChange={(e) => handlePeriodChange(e.target.value as TimeAllocationFilters['period'])}
            className="px-3 py-2 bg-cscx-gray-800 border border-cscx-gray-700 rounded-lg text-white text-sm focus:outline-none focus:border-cscx-accent"
          >
            <option value="week">This Week</option>
            <option value="month">This Month</option>
            <option value="quarter">This Quarter</option>
            <option value="year">This Year</option>
          </select>

          {/* Log Time Button */}
          <button
            onClick={() => setShowTimeEntryModal(true)}
            className="px-4 py-2 text-sm bg-cscx-accent hover:bg-cscx-accent/80 text-white rounded-lg transition-colors flex items-center gap-2"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6l4 2m6-2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            Log Time
          </button>

          {/* Export Button */}
          <button
            onClick={exportToCsv}
            className="px-4 py-2 text-sm bg-cscx-gray-800 hover:bg-cscx-gray-700 text-white rounded-lg transition-colors flex items-center gap-2"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            Export
          </button>

          {/* Refresh Button */}
          <button
            onClick={fetchReport}
            className="px-4 py-2 text-sm bg-cscx-gray-800 hover:bg-cscx-gray-700 text-white rounded-lg transition-colors flex items-center gap-2"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
            Refresh
          </button>
        </div>
      </div>

      {/* Team Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Total Hours */}
        <div className="bg-cscx-gray-900 border border-cscx-gray-800 rounded-xl p-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm text-cscx-gray-400 uppercase tracking-wider">Total Hours</span>
            <svg className="w-5 h-5 text-cscx-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <p className="text-3xl font-bold text-white">{summary.total_hours.toLocaleString()}</p>
          <p className="text-sm text-cscx-gray-400 mt-1">{summary.total_csms} CSMs tracked</p>
        </div>

        {/* Customer-Facing */}
        <div className="bg-cscx-gray-900 border border-cscx-gray-800 rounded-xl p-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm text-cscx-gray-400 uppercase tracking-wider">Customer-Facing</span>
            <span className={`text-xs px-2 py-0.5 rounded ${
              summary.customer_facing_vs_target >= 0 ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'
            }`}>
              {summary.customer_facing_vs_target >= 0 ? '+' : ''}{summary.customer_facing_vs_target}% vs target
            </span>
          </div>
          <p className={`text-3xl font-bold ${
            summary.customer_facing_pct >= TIME_TARGETS.customerFacing.target ? 'text-green-400' : 'text-yellow-400'
          }`}>
            {summary.customer_facing_pct}%
          </p>
          <p className="text-sm text-cscx-gray-400 mt-1">Target: {TIME_TARGETS.customerFacing.target}%</p>
        </div>

        {/* Admin Overhead */}
        <div className="bg-cscx-gray-900 border border-cscx-gray-800 rounded-xl p-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm text-cscx-gray-400 uppercase tracking-wider">Admin Overhead</span>
            <span className={`text-xs px-2 py-0.5 rounded ${
              summary.admin_vs_target <= 0 ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'
            }`}>
              {summary.admin_vs_target > 0 ? '+' : ''}{summary.admin_vs_target}% vs target
            </span>
          </div>
          <p className={`text-3xl font-bold ${
            summary.admin_pct <= TIME_TARGETS.admin.target ? 'text-green-400' : 'text-red-400'
          }`}>
            {summary.admin_pct}%
          </p>
          <p className="text-sm text-cscx-gray-400 mt-1">Target: &lt;{TIME_TARGETS.admin.target}%</p>
        </div>
      </div>

      {/* Activity Breakdown & Trend Chart Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Time by Activity Type */}
        <div className="bg-cscx-gray-900 border border-cscx-gray-800 rounded-xl p-4">
          <h3 className="text-lg font-semibold text-white mb-4">Time by Activity Type</h3>
          <div className="space-y-3">
            {by_activity.map((activity) => (
              <div key={activity.type} className="flex items-center gap-3">
                <div className="w-32 text-sm text-cscx-gray-300 truncate" title={activity.label}>
                  {activity.label}
                </div>
                <div className="flex-1 h-6 bg-cscx-gray-800 rounded overflow-hidden">
                  <div
                    className="h-full rounded transition-all duration-300"
                    style={{
                      width: `${activity.percentage}%`,
                      backgroundColor: activity.color
                    }}
                  />
                </div>
                <div className="w-12 text-right text-sm text-cscx-gray-400">
                  {activity.percentage}%
                </div>
                <div className="w-16 text-right text-sm text-white font-medium">
                  {formatHours(activity.hours)}
                </div>
              </div>
            ))}
          </div>

          {/* Legend */}
          <div className="mt-4 pt-4 border-t border-cscx-gray-800 flex flex-wrap gap-3">
            <div className="flex items-center gap-1.5 text-xs text-cscx-gray-400">
              <span className="w-2 h-2 rounded-full bg-green-400" />
              Customer-Facing
            </div>
            <div className="flex items-center gap-1.5 text-xs text-cscx-gray-400">
              <span className="w-2 h-2 rounded-full bg-purple-400" />
              Internal
            </div>
          </div>
        </div>

        {/* Weekly Trend */}
        <div className="bg-cscx-gray-900 border border-cscx-gray-800 rounded-xl p-4">
          <h3 className="text-lg font-semibold text-white mb-4">Weekly Trend</h3>
          <TrendChart trends={trends} />
        </div>
      </div>

      {/* CSM Comparison Table */}
      <div className="bg-cscx-gray-900 border border-cscx-gray-800 rounded-xl overflow-hidden">
        <div className="p-4 border-b border-cscx-gray-800">
          <h3 className="text-lg font-semibold text-white">CSM Comparison</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-cscx-gray-800/50">
                <th className="text-left px-4 py-3 text-cscx-gray-400 font-medium">CSM</th>
                <th className="text-right px-4 py-3 text-cscx-gray-400 font-medium">Hours</th>
                <th className="text-right px-4 py-3 text-cscx-gray-400 font-medium">Cust-Facing</th>
                <th className="text-right px-4 py-3 text-cscx-gray-400 font-medium">Admin</th>
                <th className="text-right px-4 py-3 text-cscx-gray-400 font-medium">Customers</th>
                <th className="text-right px-4 py-3 text-cscx-gray-400 font-medium">ARR/Hr</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-cscx-gray-800">
              {by_csm.map((csm) => (
                <tr
                  key={csm.csm_id}
                  onClick={() => handleCsmClick(csm.csm_id)}
                  className="hover:bg-cscx-gray-800/30 transition-colors cursor-pointer"
                >
                  <td className="px-4 py-3">
                    <span className="text-white font-medium">{csm.csm_name}</span>
                  </td>
                  <td className="px-4 py-3 text-right text-cscx-gray-300">
                    {csm.total_hours}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <span className={csm.customer_facing_pct >= 60 ? 'text-green-400' : 'text-yellow-400'}>
                      {csm.customer_facing_pct}%
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <span className={csm.admin_pct <= 15 ? 'text-green-400' : 'text-red-400'}>
                      {csm.admin_pct}%
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right text-cscx-gray-300">
                    {csm.customer_count}
                  </td>
                  <td className="px-4 py-3 text-right text-cscx-accent font-medium">
                    {formatCurrency(csm.arr_per_hour)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Customer Time Analysis & Recommendations Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Top Customers by Time */}
        <div className="bg-cscx-gray-900 border border-cscx-gray-800 rounded-xl overflow-hidden">
          <div className="p-4 border-b border-cscx-gray-800">
            <h3 className="text-lg font-semibold text-white">Top Customers by Time</h3>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-cscx-gray-800/50">
                  <th className="text-left px-4 py-3 text-cscx-gray-400 font-medium">Customer</th>
                  <th className="text-right px-4 py-3 text-cscx-gray-400 font-medium">Hours</th>
                  <th className="text-right px-4 py-3 text-cscx-gray-400 font-medium">ARR</th>
                  <th className="text-right px-4 py-3 text-cscx-gray-400 font-medium">Hrs/$10K</th>
                  <th className="text-center px-4 py-3 text-cscx-gray-400 font-medium">Efficiency</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-cscx-gray-800">
                {by_customer.slice(0, 8).map((customer) => {
                  const badge = getEfficiencyBadge(customer.efficiency_status);
                  return (
                    <tr
                      key={customer.customer_id}
                      onClick={() => onSelectCustomer?.(customer.customer_id)}
                      className="hover:bg-cscx-gray-800/30 transition-colors cursor-pointer"
                    >
                      <td className="px-4 py-3">
                        <span className="text-white font-medium">{customer.customer_name}</span>
                      </td>
                      <td className="px-4 py-3 text-right text-cscx-gray-300">
                        {formatHours(customer.hours)}
                      </td>
                      <td className="px-4 py-3 text-right text-cscx-gray-300">
                        {formatCurrency(customer.arr)}
                      </td>
                      <td className={`px-4 py-3 text-right ${getEfficiencyColor(customer.efficiency_status)}`}>
                        {customer.hours_per_10k_arr}
                      </td>
                      <td className="px-4 py-3 text-center">
                        <span className={`px-2 py-0.5 text-xs font-medium rounded ${badge.bg} ${badge.text}`}>
                          {badge.label}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          {by_customer.length > 8 && (
            <div className="p-3 border-t border-cscx-gray-800 text-center">
              <button className="text-sm text-cscx-accent hover:underline">
                View all {by_customer.length} customers
              </button>
            </div>
          )}
        </div>

        {/* Optimization Alerts */}
        <div className="bg-cscx-gray-900 border border-cscx-gray-800 rounded-xl p-4">
          <h3 className="text-lg font-semibold text-white mb-4">Optimization Alerts</h3>
          <div className="space-y-3">
            {recommendations.length === 0 ? (
              <div className="text-center py-8 text-cscx-gray-500">
                No optimization suggestions at this time
              </div>
            ) : (
              recommendations.map((suggestion) => (
                <div
                  key={suggestion.id}
                  className={`p-4 border rounded-lg ${getPriorityColor(suggestion.priority)}`}
                >
                  <div className="flex items-start gap-3">
                    <span className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${
                      suggestion.priority === 'high' ? 'bg-red-500 text-white' :
                      suggestion.priority === 'medium' ? 'bg-yellow-500 text-black' :
                      'bg-blue-500 text-white'
                    }`}>
                      {getPriorityIcon(suggestion.priority)}
                    </span>
                    <div className="flex-1">
                      <p className="text-white font-medium">{suggestion.title}</p>
                      <p className="text-sm text-cscx-gray-400 mt-1">{suggestion.description}</p>
                      {suggestion.impact && (
                        <p className="text-xs text-cscx-gray-500 mt-2 italic">{suggestion.impact}</p>
                      )}
                    </div>
                    {suggestion.metric_value !== undefined && (
                      <div className="text-right">
                        <p className="text-lg font-bold text-white">{suggestion.metric_value}</p>
                        {suggestion.metric_label && (
                          <p className="text-xs text-cscx-gray-500">{suggestion.metric_label}</p>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* Efficiency Metrics Summary */}
      <div className="bg-cscx-gray-900 border border-cscx-gray-800 rounded-xl p-4">
        <h3 className="text-lg font-semibold text-white mb-4">Efficiency Summary</h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="text-center p-3 bg-cscx-gray-800/50 rounded-lg">
            <p className="text-xs text-cscx-gray-400 uppercase">Avg Hrs/$10K ARR</p>
            <p className={`text-2xl font-bold mt-1 ${
              summary.avg_hours_per_10k_arr <= 2 ? 'text-green-400' :
              summary.avg_hours_per_10k_arr <= 3 ? 'text-yellow-400' : 'text-red-400'
            }`}>
              {summary.avg_hours_per_10k_arr}
            </p>
            <p className="text-xs text-cscx-gray-500 mt-1">Target: &lt;2.0</p>
          </div>
          <div className="text-center p-3 bg-cscx-gray-800/50 rounded-lg">
            <p className="text-xs text-cscx-gray-400 uppercase">Internal Meetings</p>
            <p className="text-2xl font-bold text-white mt-1">
              {summary.internal_pct}%
            </p>
          </div>
          <div className="text-center p-3 bg-cscx-gray-800/50 rounded-lg">
            <p className="text-xs text-cscx-gray-400 uppercase">Tracking Completeness</p>
            <p className={`text-2xl font-bold mt-1 ${
              summary.tracking_completeness >= 90 ? 'text-green-400' : 'text-yellow-400'
            }`}>
              {summary.tracking_completeness}%
            </p>
            <p className="text-xs text-cscx-gray-500 mt-1">Target: &gt;90%</p>
          </div>
          <div className="text-center p-3 bg-cscx-gray-800/50 rounded-lg">
            <p className="text-xs text-cscx-gray-400 uppercase">Customers Tracked</p>
            <p className="text-2xl font-bold text-white mt-1">
              {by_customer.length}
            </p>
          </div>
        </div>
      </div>

      {/* CSM Detail Modal */}
      {selectedCsmId && (
        <CSMDetailModal
          csmId={selectedCsmId}
          data={csmDetail}
          loading={csmDetailLoading}
          onClose={clearCsmDetail}
          onSelectCustomer={onSelectCustomer}
        />
      )}

      {/* Time Entry Modal */}
      {showTimeEntryModal && (
        <TimeEntryModal
          onClose={() => setShowTimeEntryModal(false)}
          onSubmit={handleTimeEntrySubmit}
          loading={createEntryLoading}
        />
      )}
    </div>
  );
};

export default TimeAllocation;
