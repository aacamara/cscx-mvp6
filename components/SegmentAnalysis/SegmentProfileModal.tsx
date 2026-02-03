/**
 * Segment Profile Modal
 * PRD-175: Customer Segmentation Analysis
 *
 * Displays detailed segment profile including:
 * - Demographics
 * - Performance metrics
 * - Engagement stats
 * - Recommendations
 * - Customer list
 */

import React, { useState } from 'react';
import { SegmentProfile, CustomerInSegment, SEGMENT_COLORS } from '../../types/segmentAnalysis';

interface SegmentProfileModalProps {
  segmentId: string;
  data: { profile: SegmentProfile; customers: CustomerInSegment[] } | null;
  loading: boolean;
  onClose: () => void;
  onSelectCustomer?: (customerId: string) => void;
}

const formatCurrency = (amount: number): string => {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0
  }).format(amount);
};

const formatPercent = (value: number): string => {
  return `${value.toFixed(0)}%`;
};

const getHealthColor = (score: number): string => {
  if (score >= 70) return 'text-green-400';
  if (score >= 40) return 'text-yellow-400';
  return 'text-red-400';
};

const getHealthBg = (score: number): string => {
  if (score >= 70) return 'bg-green-500';
  if (score >= 40) return 'bg-yellow-500';
  return 'bg-red-500';
};

const getRiskColor = (level: 'low' | 'medium' | 'high'): string => {
  switch (level) {
    case 'low': return 'text-green-400 bg-green-500/20';
    case 'medium': return 'text-yellow-400 bg-yellow-500/20';
    case 'high': return 'text-red-400 bg-red-500/20';
  }
};

export const SegmentProfileModal: React.FC<SegmentProfileModalProps> = ({
  segmentId,
  data,
  loading,
  onClose,
  onSelectCustomer
}) => {
  const [activeTab, setActiveTab] = useState<'overview' | 'customers'>('overview');
  const [customerSearch, setCustomerSearch] = useState('');

  if (loading) {
    return (
      <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50" onClick={onClose}>
        <div className="bg-cscx-gray-900 rounded-xl p-8 text-center" onClick={e => e.stopPropagation()}>
          <div className="animate-spin w-8 h-8 border-2 border-cscx-accent border-t-transparent rounded-full mx-auto mb-2" />
          <p className="text-cscx-gray-400">Loading segment profile...</p>
        </div>
      </div>
    );
  }

  if (!data) return null;

  const { profile, customers } = data;
  const { segment, demographics, performance, engagement, recommendations, characteristics, top_customers } = profile;

  // Filter customers
  const filteredCustomers = customerSearch
    ? customers.filter(c =>
        c.name.toLowerCase().includes(customerSearch.toLowerCase()) ||
        c.industry.toLowerCase().includes(customerSearch.toLowerCase())
      )
    : customers;

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div
        className="bg-cscx-gray-900 border border-cscx-gray-800 rounded-xl w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="p-4 border-b border-cscx-gray-800 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div
              className="w-4 h-4 rounded-full"
              style={{ backgroundColor: segment.color || SEGMENT_COLORS[0] }}
            />
            <div>
              <h2 className="text-xl font-bold text-white">{segment.name}</h2>
              <p className="text-sm text-cscx-gray-400">{segment.description}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-cscx-gray-400 hover:text-white transition-colors"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Tabs */}
        <div className="border-b border-cscx-gray-800 px-4">
          <div className="flex gap-4">
            <button
              onClick={() => setActiveTab('overview')}
              className={`py-3 px-1 text-sm font-medium border-b-2 transition-colors ${
                activeTab === 'overview'
                  ? 'border-cscx-accent text-white'
                  : 'border-transparent text-cscx-gray-400 hover:text-white'
              }`}
            >
              Overview
            </button>
            <button
              onClick={() => setActiveTab('customers')}
              className={`py-3 px-1 text-sm font-medium border-b-2 transition-colors ${
                activeTab === 'customers'
                  ? 'border-cscx-accent text-white'
                  : 'border-transparent text-cscx-gray-400 hover:text-white'
              }`}
            >
              Customers ({segment.customer_count})
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-4">
          {activeTab === 'overview' ? (
            <div className="space-y-6">
              {/* Key Stats */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="bg-cscx-gray-800/50 rounded-lg p-3">
                  <p className="text-xs text-cscx-gray-400 uppercase">Customers</p>
                  <p className="text-2xl font-bold text-white">{segment.customer_count}</p>
                </div>
                <div className="bg-cscx-gray-800/50 rounded-lg p-3">
                  <p className="text-xs text-cscx-gray-400 uppercase">Total ARR</p>
                  <p className="text-2xl font-bold text-cscx-accent">{formatCurrency(segment.total_arr)}</p>
                </div>
                <div className="bg-cscx-gray-800/50 rounded-lg p-3">
                  <p className="text-xs text-cscx-gray-400 uppercase">Avg Health</p>
                  <p className={`text-2xl font-bold ${getHealthColor(performance.avg_health_score)}`}>
                    {performance.avg_health_score}
                  </p>
                </div>
                <div className="bg-cscx-gray-800/50 rounded-lg p-3">
                  <p className="text-xs text-cscx-gray-400 uppercase">NRR</p>
                  <p className={`text-2xl font-bold ${performance.nrr >= 100 ? 'text-green-400' : 'text-red-400'}`}>
                    {formatPercent(performance.nrr)}
                  </p>
                </div>
              </div>

              {/* Characteristics */}
              {characteristics.length > 0 && (
                <div className="bg-cscx-gray-800/30 rounded-lg p-4">
                  <h3 className="text-sm font-semibold text-white mb-3">Characteristics</h3>
                  <ul className="space-y-2">
                    {characteristics.map((char, index) => (
                      <li key={index} className="flex items-start gap-2 text-sm text-cscx-gray-300">
                        <span className="text-cscx-accent mt-0.5">-</span>
                        {char}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Demographics & Performance Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Demographics */}
                <div>
                  <h3 className="text-sm font-semibold text-white mb-3">Demographics</h3>
                  <div className="space-y-3">
                    <div className="flex justify-between">
                      <span className="text-cscx-gray-400">Avg ARR</span>
                      <span className="text-white font-medium">{formatCurrency(demographics.avg_arr)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-cscx-gray-400">Median ARR</span>
                      <span className="text-white font-medium">{formatCurrency(demographics.median_arr)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-cscx-gray-400">Avg Company Size</span>
                      <span className="text-white font-medium">{demographics.avg_company_size.toLocaleString()} employees</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-cscx-gray-400">Avg Tenure</span>
                      <span className="text-white font-medium">{demographics.avg_tenure_months} months</span>
                    </div>
                    {demographics.top_industries.length > 0 && (
                      <div>
                        <span className="text-cscx-gray-400 text-sm">Top Industries</span>
                        <div className="mt-2 flex flex-wrap gap-2">
                          {demographics.top_industries.slice(0, 3).map(ind => (
                            <span key={ind.name} className="px-2 py-1 text-xs bg-cscx-gray-800 text-cscx-gray-300 rounded">
                              {ind.name} ({ind.pct}%)
                            </span>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                {/* Performance */}
                <div>
                  <h3 className="text-sm font-semibold text-white mb-3">Performance</h3>
                  <div className="space-y-3">
                    <div className="flex justify-between">
                      <span className="text-cscx-gray-400">Churn Rate</span>
                      <span className={`font-medium ${performance.churn_rate > 10 ? 'text-red-400' : performance.churn_rate > 5 ? 'text-yellow-400' : 'text-green-400'}`}>
                        {formatPercent(performance.churn_rate)}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-cscx-gray-400">Gross Retention</span>
                      <span className="text-white font-medium">{formatPercent(performance.gross_retention)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-cscx-gray-400">Expansion Rate</span>
                      <span className="text-green-400 font-medium">{formatPercent(performance.expansion_rate)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-cscx-gray-400">Adoption Score</span>
                      <span className="text-white font-medium">{performance.avg_adoption_score}</span>
                    </div>
                    <div>
                      <span className="text-cscx-gray-400 text-sm">Health Distribution</span>
                      <div className="mt-2 flex gap-2">
                        <span className="px-2 py-1 text-xs bg-green-500/20 text-green-400 rounded">
                          Healthy: {performance.health_distribution.healthy}
                        </span>
                        <span className="px-2 py-1 text-xs bg-yellow-500/20 text-yellow-400 rounded">
                          Warning: {performance.health_distribution.warning}
                        </span>
                        <span className="px-2 py-1 text-xs bg-red-500/20 text-red-400 rounded">
                          Critical: {performance.health_distribution.critical}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Engagement */}
              <div>
                <h3 className="text-sm font-semibold text-white mb-3">Engagement</h3>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                  <div className="bg-cscx-gray-800/30 rounded-lg p-3">
                    <p className="text-xs text-cscx-gray-400">Meetings/Quarter</p>
                    <p className="text-lg font-bold text-white">{engagement.avg_meetings_per_quarter}</p>
                  </div>
                  <div className="bg-cscx-gray-800/30 rounded-lg p-3">
                    <p className="text-xs text-cscx-gray-400">Email Response Rate</p>
                    <p className="text-lg font-bold text-white">{formatPercent(engagement.avg_email_response_rate)}</p>
                  </div>
                  <div className="bg-cscx-gray-800/30 rounded-lg p-3">
                    <p className="text-xs text-cscx-gray-400">Avg Response Time</p>
                    <p className="text-lg font-bold text-white">{engagement.avg_time_to_respond_hours}h</p>
                  </div>
                  <div className="bg-cscx-gray-800/30 rounded-lg p-3">
                    <p className="text-xs text-cscx-gray-400">Support Ticket Rate</p>
                    <p className="text-lg font-bold text-white">{engagement.support_ticket_rate}/mo</p>
                  </div>
                  <div className="bg-cscx-gray-800/30 rounded-lg p-3">
                    <p className="text-xs text-cscx-gray-400">NPS Score</p>
                    <p className="text-lg font-bold text-white">{engagement.avg_nps_score ?? '-'}</p>
                  </div>
                  <div className="bg-cscx-gray-800/30 rounded-lg p-3">
                    <p className="text-xs text-cscx-gray-400">Feature Adoption</p>
                    <p className="text-lg font-bold text-white">{formatPercent(engagement.feature_adoption_rate)}</p>
                  </div>
                </div>
              </div>

              {/* Recommendations */}
              <div className="bg-cscx-accent/10 border border-cscx-accent/30 rounded-lg p-4">
                <h3 className="text-sm font-semibold text-white mb-3 flex items-center gap-2">
                  <svg className="w-4 h-4 text-cscx-accent" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                  </svg>
                  Recommended Strategy
                </h3>
                <ul className="space-y-2">
                  {recommendations.map((rec, index) => (
                    <li key={index} className="flex items-start gap-2 text-sm text-cscx-gray-300">
                      <span className="text-cscx-accent mt-1">{'\u2022'}</span>
                      {rec}
                    </li>
                  ))}
                </ul>
              </div>

              {/* Top Customers */}
              {top_customers.length > 0 && (
                <div>
                  <h3 className="text-sm font-semibold text-white mb-3">Top Customers by ARR</h3>
                  <div className="space-y-2">
                    {top_customers.map(customer => (
                      <div
                        key={customer.id}
                        onClick={() => onSelectCustomer?.(customer.id)}
                        className="flex items-center justify-between p-3 bg-cscx-gray-800/30 rounded-lg cursor-pointer hover:bg-cscx-gray-800/50 transition-colors"
                      >
                        <div className="flex items-center gap-3">
                          <div className={`w-2 h-2 rounded-full ${getHealthBg(customer.health_score)}`} />
                          <span className="text-white font-medium">{customer.name}</span>
                        </div>
                        <div className="flex items-center gap-4">
                          <span className={getHealthColor(customer.health_score)}>{customer.health_score}</span>
                          <span className="text-cscx-accent font-medium">{formatCurrency(customer.arr)}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ) : (
            /* Customers Tab */
            <div className="space-y-4">
              {/* Search */}
              <div className="relative">
                <input
                  type="text"
                  placeholder="Search customers..."
                  value={customerSearch}
                  onChange={(e) => setCustomerSearch(e.target.value)}
                  className="w-full px-4 py-2 pl-10 bg-cscx-gray-800 border border-cscx-gray-700 rounded-lg text-white placeholder-cscx-gray-500 focus:outline-none focus:border-cscx-accent"
                />
                <svg className="absolute left-3 top-2.5 w-5 h-5 text-cscx-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
              </div>

              {/* Customer List */}
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-cscx-gray-800/50">
                      <th className="text-left px-4 py-3 text-cscx-gray-400 font-medium">Customer</th>
                      <th className="text-right px-4 py-3 text-cscx-gray-400 font-medium">ARR</th>
                      <th className="text-right px-4 py-3 text-cscx-gray-400 font-medium">Health</th>
                      <th className="text-right px-4 py-3 text-cscx-gray-400 font-medium">Tenure</th>
                      <th className="text-right px-4 py-3 text-cscx-gray-400 font-medium">Renewal</th>
                      <th className="text-center px-4 py-3 text-cscx-gray-400 font-medium">Risk</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-cscx-gray-800">
                    {filteredCustomers.map(customer => (
                      <tr
                        key={customer.id}
                        onClick={() => onSelectCustomer?.(customer.id)}
                        className="hover:bg-cscx-gray-800/30 transition-colors cursor-pointer"
                      >
                        <td className="px-4 py-3">
                          <div>
                            <p className="text-white font-medium">{customer.name}</p>
                            <p className="text-xs text-cscx-gray-500">{customer.industry}</p>
                          </div>
                        </td>
                        <td className="px-4 py-3 text-right text-cscx-accent font-medium">
                          {formatCurrency(customer.arr)}
                        </td>
                        <td className="px-4 py-3 text-right">
                          <span className={getHealthColor(customer.health_score)}>{customer.health_score}</span>
                        </td>
                        <td className="px-4 py-3 text-right text-cscx-gray-300">
                          {customer.tenure_months} mo
                        </td>
                        <td className="px-4 py-3 text-right text-cscx-gray-300">
                          {customer.days_to_renewal !== null ? (
                            <span className={customer.days_to_renewal <= 30 ? 'text-red-400' : customer.days_to_renewal <= 90 ? 'text-yellow-400' : ''}>
                              {customer.days_to_renewal}d
                            </span>
                          ) : '-'}
                        </td>
                        <td className="px-4 py-3 text-center">
                          <span className={`px-2 py-0.5 text-xs font-medium rounded capitalize ${getRiskColor(customer.risk_level)}`}>
                            {customer.risk_level}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {filteredCustomers.length === 0 && (
                <p className="text-cscx-gray-500 text-center py-8">No customers found</p>
              )}

              <p className="text-sm text-cscx-gray-400 text-center">
                Showing {filteredCustomers.length} of {customers.length} customers
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default SegmentProfileModal;
