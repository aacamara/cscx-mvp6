/**
 * Customer Segmentation Analysis View
 * PRD-175: Customer Segmentation Analysis
 *
 * Features:
 * - Segment Overview with customer distribution
 * - Segment Comparison Table
 * - Segment Profile Detail Modal
 * - Segment Movement Tracking
 * - Recommendations per segment
 */

import React, { useState, useEffect, useCallback } from 'react';
import {
  SegmentAnalysisResponse,
  Segment,
  SegmentProfile,
  CustomerInSegment,
  SegmentMovement,
  SegmentAnalysisFilters,
  SEGMENT_COLORS
} from '../../types/segmentAnalysis';
import { SegmentProfileModal } from './SegmentProfileModal';

const API_BASE = `${import.meta.env.VITE_API_URL || ''}/api`;

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

const getMovementIcon = (type: 'upgrade' | 'downgrade' | 'lateral'): string => {
  switch (type) {
    case 'upgrade': return '\u2191';
    case 'downgrade': return '\u2193';
    case 'lateral': return '\u2192';
  }
};

const getMovementColor = (type: 'upgrade' | 'downgrade' | 'lateral'): string => {
  switch (type) {
    case 'upgrade': return 'text-green-400';
    case 'downgrade': return 'text-red-400';
    case 'lateral': return 'text-gray-400';
  }
};

// ============================================
// MAIN COMPONENT
// ============================================

interface SegmentAnalysisProps {
  onSelectCustomer?: (customerId: string) => void;
}

export const SegmentAnalysis: React.FC<SegmentAnalysisProps> = ({
  onSelectCustomer
}) => {
  // State
  const [data, setData] = useState<SegmentAnalysisResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filters, setFilters] = useState<SegmentAnalysisFilters>({
    sort_by: 'arr',
    sort_order: 'desc',
    movement_period: '30d'
  });
  const [selectedSegmentId, setSelectedSegmentId] = useState<string | null>(null);
  const [profileData, setProfileData] = useState<{ profile: SegmentProfile; customers: CustomerInSegment[] } | null>(null);
  const [profileLoading, setProfileLoading] = useState(false);

  // Fetch segment analysis data
  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (filters.sort_by) params.append('sort_by', filters.sort_by);
      if (filters.sort_order) params.append('sort_order', filters.sort_order);
      if (filters.movement_period) params.append('movement_period', filters.movement_period);

      const response = await fetch(`${API_BASE}/reports/segment-analysis?${params}`);
      if (!response.ok) throw new Error('Failed to fetch segment analysis');

      const result = await response.json();
      setData(result);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load data');
    } finally {
      setLoading(false);
    }
  }, [filters]);

  // Fetch segment profile
  const fetchSegmentProfile = useCallback(async (segmentId: string) => {
    setProfileLoading(true);
    try {
      const response = await fetch(`${API_BASE}/reports/segment-analysis/segments/${segmentId}`);
      if (!response.ok) throw new Error('Failed to fetch segment profile');

      const result = await response.json();
      setProfileData(result);
    } catch (err) {
      console.error('Failed to fetch segment profile:', err);
    } finally {
      setProfileLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  useEffect(() => {
    if (selectedSegmentId) {
      fetchSegmentProfile(selectedSegmentId);
    }
  }, [selectedSegmentId, fetchSegmentProfile]);

  // Handlers
  const handleSegmentClick = (segment: Segment) => {
    setSelectedSegmentId(segment.id);
  };

  const handleCloseProfile = () => {
    setSelectedSegmentId(null);
    setProfileData(null);
  };

  const handlePeriodChange = (period: '7d' | '30d' | '90d' | 'quarter') => {
    setFilters(prev => ({ ...prev, movement_period: period }));
  };

  const handleSort = (field: 'name' | 'arr' | 'count' | 'health' | 'nrr' | 'churn') => {
    setFilters(prev => ({
      ...prev,
      sort_by: field,
      sort_order: prev.sort_by === field && prev.sort_order === 'desc' ? 'asc' : 'desc'
    }));
  };

  // Loading state
  if (loading && !data) {
    return (
      <div className="p-8 text-center text-cscx-gray-400">
        <div className="animate-spin w-8 h-8 border-2 border-cscx-accent border-t-transparent rounded-full mx-auto mb-2" />
        Loading segment analysis...
      </div>
    );
  }

  // Error state
  if (error && !data) {
    return (
      <div className="p-8 text-center text-red-400">
        {error}
        <button
          onClick={fetchData}
          className="block mx-auto mt-2 text-sm text-cscx-accent hover:underline"
        >
          Try again
        </button>
      </div>
    );
  }

  if (!data) return null;

  const { overview, segments, comparison, recent_movements } = data;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-white">Customer Segmentation Analysis</h2>
          <p className="text-cscx-gray-400 text-sm mt-1">
            {overview.total_customers} customers across {overview.segment_count} segments
          </p>
        </div>
        <button
          onClick={fetchData}
          className="px-4 py-2 text-sm bg-cscx-gray-800 hover:bg-cscx-gray-700 text-white rounded-lg transition-colors flex items-center gap-2"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
          </svg>
          Refresh
        </button>
      </div>

      {/* Segment Overview Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {segments.map((segment, index) => (
          <div
            key={segment.id}
            onClick={() => handleSegmentClick(segment)}
            className="bg-cscx-gray-900 border border-cscx-gray-800 rounded-xl p-4 cursor-pointer hover:border-cscx-accent/50 transition-all group"
          >
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <div
                  className="w-3 h-3 rounded-full"
                  style={{ backgroundColor: segment.color || SEGMENT_COLORS[index % SEGMENT_COLORS.length] }}
                />
                <span className="text-white font-medium">{segment.name}</span>
              </div>
              {segment.is_dynamic && (
                <span className="text-xs text-cscx-gray-500 px-2 py-0.5 bg-cscx-gray-800 rounded">
                  Dynamic
                </span>
              )}
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <p className="text-xs text-cscx-gray-500">Customers</p>
                <p className="text-xl font-bold text-white">{segment.customer_count}</p>
              </div>
              <div>
                <p className="text-xs text-cscx-gray-500">Total ARR</p>
                <p className="text-xl font-bold text-cscx-accent">{formatCurrency(segment.total_arr)}</p>
              </div>
            </div>
            <div className="mt-3 pt-3 border-t border-cscx-gray-800 text-xs text-cscx-gray-400 group-hover:text-cscx-accent transition-colors">
              Click to view segment profile
            </div>
          </div>
        ))}
      </div>

      {/* Summary Stats */}
      <div className="bg-cscx-gray-900 border border-cscx-gray-800 rounded-xl p-4">
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
          <div>
            <p className="text-xs text-cscx-gray-400 uppercase">Total Customers</p>
            <p className="text-2xl font-bold text-white mt-1">{overview.total_customers}</p>
          </div>
          <div>
            <p className="text-xs text-cscx-gray-400 uppercase">Total ARR</p>
            <p className="text-2xl font-bold text-cscx-accent mt-1">{formatCurrency(overview.total_arr)}</p>
          </div>
          <div>
            <p className="text-xs text-cscx-gray-400 uppercase">Segments</p>
            <p className="text-2xl font-bold text-white mt-1">{overview.segment_count}</p>
          </div>
          <div>
            <p className="text-xs text-cscx-gray-400 uppercase">Unassigned</p>
            <p className="text-2xl font-bold text-yellow-400 mt-1">{overview.unassigned_customers}</p>
          </div>
          <div>
            <p className="text-xs text-cscx-gray-400 uppercase">Unassigned ARR</p>
            <p className="text-2xl font-bold text-yellow-400 mt-1">{formatCurrency(overview.unassigned_arr)}</p>
          </div>
        </div>
      </div>

      {/* Segment Comparison & Movement Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Segment Comparison Table */}
        <div className="lg:col-span-2 bg-cscx-gray-900 border border-cscx-gray-800 rounded-xl overflow-hidden">
          <div className="p-4 border-b border-cscx-gray-800">
            <h3 className="text-lg font-semibold text-white">Segment Comparison</h3>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-cscx-gray-800/50">
                  <th
                    className="text-left px-4 py-3 text-cscx-gray-400 font-medium cursor-pointer hover:text-white"
                    onClick={() => handleSort('name')}
                  >
                    Segment {filters.sort_by === 'name' && (filters.sort_order === 'asc' ? '\u2191' : '\u2193')}
                  </th>
                  <th
                    className="text-right px-4 py-3 text-cscx-gray-400 font-medium cursor-pointer hover:text-white"
                    onClick={() => handleSort('count')}
                  >
                    Count {filters.sort_by === 'count' && (filters.sort_order === 'asc' ? '\u2191' : '\u2193')}
                  </th>
                  <th
                    className="text-right px-4 py-3 text-cscx-gray-400 font-medium cursor-pointer hover:text-white"
                    onClick={() => handleSort('arr')}
                  >
                    ARR {filters.sort_by === 'arr' && (filters.sort_order === 'asc' ? '\u2191' : '\u2193')}
                  </th>
                  <th
                    className="text-right px-4 py-3 text-cscx-gray-400 font-medium cursor-pointer hover:text-white"
                    onClick={() => handleSort('health')}
                  >
                    Health {filters.sort_by === 'health' && (filters.sort_order === 'asc' ? '\u2191' : '\u2193')}
                  </th>
                  <th
                    className="text-right px-4 py-3 text-cscx-gray-400 font-medium cursor-pointer hover:text-white"
                    onClick={() => handleSort('nrr')}
                  >
                    NRR {filters.sort_by === 'nrr' && (filters.sort_order === 'asc' ? '\u2191' : '\u2193')}
                  </th>
                  <th className="text-right px-4 py-3 text-cscx-gray-400 font-medium">
                    Risk
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-cscx-gray-800">
                {comparison.segments.map((seg, index) => (
                  <tr
                    key={seg.segment_id}
                    onClick={() => setSelectedSegmentId(seg.segment_id)}
                    className="hover:bg-cscx-gray-800/30 transition-colors cursor-pointer"
                  >
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <div
                          className="w-2 h-2 rounded-full"
                          style={{ backgroundColor: segments.find(s => s.id === seg.segment_id)?.color || SEGMENT_COLORS[index % SEGMENT_COLORS.length] }}
                        />
                        <span className="text-white font-medium">{seg.segment_name}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-right text-white">{seg.customer_count}</td>
                    <td className="px-4 py-3 text-right text-white font-medium">{formatCurrency(seg.total_arr)}</td>
                    <td className="px-4 py-3 text-right">
                      <span className={getHealthColor(seg.avg_health_score)}>{seg.avg_health_score}</span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <span className={seg.nrr >= 100 ? 'text-green-400' : 'text-red-400'}>
                        {formatPercent(seg.nrr)}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      {seg.risk_count > 0 ? (
                        <span className="px-2 py-0.5 text-xs font-medium bg-red-500/20 text-red-400 rounded">
                          {seg.risk_count}
                        </span>
                      ) : (
                        <span className="text-cscx-gray-500">-</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Segment Movement */}
        <div className="bg-cscx-gray-900 border border-cscx-gray-800 rounded-xl">
          <div className="p-4 border-b border-cscx-gray-800 flex items-center justify-between">
            <h3 className="text-lg font-semibold text-white">Segment Movement</h3>
            <select
              value={filters.movement_period}
              onChange={(e) => handlePeriodChange(e.target.value as '7d' | '30d' | '90d' | 'quarter')}
              className="text-sm bg-cscx-gray-800 border border-cscx-gray-700 rounded px-2 py-1 text-white"
            >
              <option value="7d">Last 7 days</option>
              <option value="30d">Last 30 days</option>
              <option value="90d">Last 90 days</option>
              <option value="quarter">This Quarter</option>
            </select>
          </div>

          {/* Movement Summary */}
          <div className="p-4 border-b border-cscx-gray-800 grid grid-cols-3 gap-2 text-center">
            <div>
              <p className="text-2xl font-bold text-green-400">{recent_movements.summary.upgrades}</p>
              <p className="text-xs text-cscx-gray-400">Upgrades</p>
            </div>
            <div>
              <p className="text-2xl font-bold text-red-400">{recent_movements.summary.downgrades}</p>
              <p className="text-xs text-cscx-gray-400">Downgrades</p>
            </div>
            <div>
              <p className="text-2xl font-bold text-gray-400">{recent_movements.summary.lateral}</p>
              <p className="text-xs text-cscx-gray-400">Lateral</p>
            </div>
          </div>

          {/* Movement List */}
          <div className="p-4 space-y-3 max-h-72 overflow-y-auto">
            {recent_movements.movements.map((movement, index) => (
              <div
                key={`${movement.customer_id}-${index}`}
                onClick={() => onSelectCustomer?.(movement.customer_id)}
                className={`p-3 rounded-lg cursor-pointer transition-colors ${
                  movement.movement_type === 'upgrade'
                    ? 'bg-green-500/10 border border-green-500/30 hover:bg-green-500/20'
                    : movement.movement_type === 'downgrade'
                    ? 'bg-red-500/10 border border-red-500/30 hover:bg-red-500/20'
                    : 'bg-cscx-gray-800/50 border border-cscx-gray-700 hover:bg-cscx-gray-800'
                }`}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className={`text-lg ${getMovementColor(movement.movement_type)}`}>
                      {getMovementIcon(movement.movement_type)}
                    </span>
                    <div>
                      <p className="text-white font-medium text-sm">{movement.customer_name}</p>
                      <p className="text-xs text-cscx-gray-400">
                        {movement.from_segment} {'\u2192'} {movement.to_segment}
                      </p>
                    </div>
                  </div>
                  <span className="text-sm text-cscx-gray-400">{formatCurrency(movement.arr)}</span>
                </div>
              </div>
            ))}
            {recent_movements.movements.length === 0 && (
              <p className="text-cscx-gray-500 text-center py-4">No movements in this period</p>
            )}
          </div>

          {/* Movement ARR Summary */}
          <div className="p-4 border-t border-cscx-gray-800">
            <div className="flex justify-between text-sm">
              <span className="text-cscx-gray-400">ARR Upgraded:</span>
              <span className="text-green-400 font-medium">{formatCurrency(recent_movements.summary.arr_upgraded)}</span>
            </div>
            <div className="flex justify-between text-sm mt-1">
              <span className="text-cscx-gray-400">ARR Downgraded:</span>
              <span className="text-red-400 font-medium">{formatCurrency(recent_movements.summary.arr_downgraded)}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Metrics Comparison */}
      <div className="bg-cscx-gray-900 border border-cscx-gray-800 rounded-xl overflow-hidden">
        <div className="p-4 border-b border-cscx-gray-800">
          <h3 className="text-lg font-semibold text-white">Performance Metrics by Segment</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-cscx-gray-800/50">
                <th className="text-left px-4 py-3 text-cscx-gray-400 font-medium">Metric</th>
                {segments.map(seg => (
                  <th key={seg.id} className="text-center px-4 py-3 text-cscx-gray-400 font-medium">
                    {seg.name}
                  </th>
                ))}
                <th className="text-center px-4 py-3 text-cscx-gray-400 font-medium">Best</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-cscx-gray-800">
              {comparison.metrics.map((metric) => (
                <tr key={metric.name} className="hover:bg-cscx-gray-800/30">
                  <td className="px-4 py-3 text-white font-medium">{metric.name}</td>
                  {segments.map(seg => {
                    const value = metric.segments[seg.name];
                    const isBest = seg.name === metric.best_performer;
                    const isWorst = seg.name === metric.worst_performer;
                    return (
                      <td key={seg.id} className="px-4 py-3 text-center">
                        <span className={`${isBest ? 'text-green-400 font-bold' : isWorst ? 'text-red-400' : 'text-white'}`}>
                          {metric.unit === '$' ? formatCurrency(value) : metric.unit === '%' ? formatPercent(value) : value}
                        </span>
                      </td>
                    );
                  })}
                  <td className="px-4 py-3 text-center">
                    <span className="px-2 py-1 text-xs bg-green-500/20 text-green-400 rounded">
                      {metric.best_performer}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Segment Profile Modal */}
      {selectedSegmentId && (
        <SegmentProfileModal
          segmentId={selectedSegmentId}
          data={profileData}
          loading={profileLoading}
          onClose={handleCloseProfile}
          onSelectCustomer={onSelectCustomer}
        />
      )}
    </div>
  );
};

export default SegmentAnalysis;
