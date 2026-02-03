/**
 * Benchmark Report Component
 * PRD-171: Benchmark Report
 *
 * Features:
 * - Portfolio-wide benchmark overview
 * - Segment-specific comparisons
 * - Top/bottom performers display
 * - Customer percentile ranking
 * - Distribution visualization
 */

import React, { useState, useEffect, useCallback } from 'react';
import { BenchmarkDistributionChart } from './BenchmarkDistributionChart';
import { CustomerBenchmarkModal } from './CustomerBenchmarkModal';

const API_BASE = `${import.meta.env.VITE_API_URL || ''}/api`;

// ============================================
// TYPES
// ============================================

interface BenchmarkValues {
  min: number;
  p25: number;
  median: number;
  p75: number;
  max: number;
  mean: number;
}

interface DistributionBucket {
  range_start: number;
  range_end: number;
  count: number;
  percentage: number;
}

interface TopPerformer {
  rank: number;
  customer_id: string;
  customer_name: string;
  value: number;
  segment: string;
  arr: number;
  percentile: number;
}

interface SegmentBenchmark {
  segment: string;
  customer_count: number;
  total_arr: number;
  avg_health_score: number;
  values: BenchmarkValues;
  top_performers: { customer_id: string; customer_name: string; value: number; percentile: number }[];
  improvement_candidates: { customer_id: string; customer_name: string; value: number; percentile: number }[];
}

interface BenchmarkRecommendation {
  customer_id: string;
  customer_name: string;
  metric: string;
  current_value: number;
  target_value: number;
  gap: number;
  priority: 'high' | 'medium' | 'low';
  action: string;
}

interface BenchmarkReportData {
  portfolio: {
    total_customers: number;
    total_arr: number;
    metrics: {
      health_score: {
        metric: string;
        values: BenchmarkValues;
        distribution: DistributionBucket[];
        total_customers: number;
      };
    };
  };
  segments: SegmentBenchmark[];
  top_performers: TopPerformer[];
  bottom_performers: TopPerformer[];
  recommendations: BenchmarkRecommendation[];
  generated_at: string;
}

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

const getPercentileColor = (percentile: number): string => {
  if (percentile >= 75) return 'text-green-400';
  if (percentile >= 50) return 'text-blue-400';
  if (percentile >= 25) return 'text-yellow-400';
  return 'text-red-400';
};

const getPercentileBg = (percentile: number): string => {
  if (percentile >= 75) return 'bg-green-500';
  if (percentile >= 50) return 'bg-blue-500';
  if (percentile >= 25) return 'bg-yellow-500';
  return 'bg-red-500';
};

const getPriorityBadge = (priority: 'high' | 'medium' | 'low'): string => {
  switch (priority) {
    case 'high': return 'bg-red-500/20 text-red-400';
    case 'medium': return 'bg-yellow-500/20 text-yellow-400';
    case 'low': return 'bg-green-500/20 text-green-400';
  }
};

// ============================================
// MAIN COMPONENT
// ============================================

interface BenchmarkReportProps {
  onSelectCustomer?: (customerId: string) => void;
}

export const BenchmarkReport: React.FC<BenchmarkReportProps> = ({ onSelectCustomer }) => {
  // State
  const [data, setData] = useState<BenchmarkReportData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedMetric, setSelectedMetric] = useState('health_score');
  const [selectedSegment, setSelectedSegment] = useState<string | null>(null);
  const [selectedCustomerId, setSelectedCustomerId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'overview' | 'segments' | 'recommendations'>('overview');

  // Fetch benchmark data
  const fetchBenchmarkReport = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      params.append('metric', selectedMetric);
      if (selectedSegment) params.append('segment', selectedSegment);

      const response = await fetch(`${API_BASE}/reports/benchmark?${params}`);
      if (!response.ok) throw new Error('Failed to fetch benchmark report');

      const result = await response.json();
      if (result.success) {
        setData(result.data);
        setError(null);
      } else {
        throw new Error(result.error?.message || 'Failed to load data');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load data');
    } finally {
      setLoading(false);
    }
  }, [selectedMetric, selectedSegment]);

  useEffect(() => {
    fetchBenchmarkReport();
  }, [fetchBenchmarkReport]);

  // Handlers
  const handleCustomerClick = (customerId: string) => {
    setSelectedCustomerId(customerId);
  };

  const handleCloseModal = () => {
    setSelectedCustomerId(null);
  };

  const handleViewCustomerDetail = (customerId: string) => {
    handleCloseModal();
    onSelectCustomer?.(customerId);
  };

  // Loading state
  if (loading && !data) {
    return (
      <div className="p-8 text-center text-cscx-gray-400">
        <div className="animate-spin w-8 h-8 border-2 border-cscx-accent border-t-transparent rounded-full mx-auto mb-2" />
        Loading benchmark report...
      </div>
    );
  }

  // Error state
  if (error && !data) {
    return (
      <div className="p-8 text-center text-red-400">
        {error}
        <button
          onClick={fetchBenchmarkReport}
          className="block mx-auto mt-2 text-sm text-cscx-accent hover:underline"
        >
          Try again
        </button>
      </div>
    );
  }

  if (!data) return null;

  const { portfolio, segments, top_performers, bottom_performers, recommendations } = data;
  const benchmark = portfolio.metrics.health_score;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-white">Benchmark Report</h2>
          <p className="text-cscx-gray-400 text-sm mt-1">
            Compare customers against portfolio and segment benchmarks
          </p>
        </div>
        <div className="flex items-center gap-3">
          {/* Metric Selector */}
          <select
            value={selectedMetric}
            onChange={(e) => setSelectedMetric(e.target.value)}
            className="px-3 py-2 bg-cscx-gray-800 border border-cscx-gray-700 rounded-lg text-white text-sm focus:outline-none focus:border-cscx-accent"
          >
            <option value="health_score">Health Score</option>
            <option value="usage_score">Usage Score</option>
            <option value="engagement_score">Engagement Score</option>
          </select>
          <button
            onClick={fetchBenchmarkReport}
            className="px-4 py-2 text-sm bg-cscx-gray-800 hover:bg-cscx-gray-700 text-white rounded-lg transition-colors flex items-center gap-2"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
            Refresh
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-cscx-gray-900 rounded-lg p-1 w-fit">
        {(['overview', 'segments', 'recommendations'] as const).map(tab => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-4 py-2 text-sm font-medium rounded-md transition-colors capitalize ${
              activeTab === tab
                ? 'bg-cscx-accent text-white'
                : 'text-cscx-gray-400 hover:text-white'
            }`}
          >
            {tab}
          </button>
        ))}
      </div>

      {/* Overview Tab */}
      {activeTab === 'overview' && (
        <>
          {/* Portfolio Benchmark Summary */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Benchmark Stats */}
            <div className="bg-cscx-gray-900 border border-cscx-gray-800 rounded-xl p-6">
              <h3 className="text-lg font-semibold text-white mb-4">Portfolio Benchmark</h3>

              {/* Key Stats */}
              <div className="grid grid-cols-2 gap-4 mb-6">
                <div className="bg-cscx-gray-800/50 rounded-lg p-4">
                  <p className="text-xs text-cscx-gray-400 uppercase">Median</p>
                  <p className="text-3xl font-bold text-cscx-accent">{benchmark.values.median}</p>
                </div>
                <div className="bg-cscx-gray-800/50 rounded-lg p-4">
                  <p className="text-xs text-cscx-gray-400 uppercase">Mean</p>
                  <p className="text-3xl font-bold text-white">{Math.round(benchmark.values.mean)}</p>
                </div>
              </div>

              {/* Percentile Breakdown */}
              <div className="space-y-3">
                <div className="flex justify-between text-sm">
                  <span className="text-cscx-gray-400">Minimum</span>
                  <span className="text-white">{benchmark.values.min}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-cscx-gray-400">25th Percentile</span>
                  <span className="text-white">{benchmark.values.p25}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-cscx-gray-400">Median (50th)</span>
                  <span className="text-cscx-accent font-medium">{benchmark.values.median}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-cscx-gray-400">75th Percentile</span>
                  <span className="text-white">{benchmark.values.p75}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-cscx-gray-400">Maximum</span>
                  <span className="text-white">{benchmark.values.max}</span>
                </div>
              </div>

              {/* Visual bar showing range */}
              <div className="mt-6">
                <div className="relative h-8 bg-cscx-gray-800 rounded-full overflow-hidden">
                  <div
                    className="absolute h-full bg-gradient-to-r from-red-500 via-yellow-500 to-green-500 opacity-30"
                    style={{ left: '0%', width: '100%' }}
                  />
                  {/* P25 marker */}
                  <div
                    className="absolute h-full w-0.5 bg-yellow-400"
                    style={{ left: `${(benchmark.values.p25 / 100) * 100}%` }}
                  />
                  {/* Median marker */}
                  <div
                    className="absolute h-full w-1 bg-cscx-accent"
                    style={{ left: `${(benchmark.values.median / 100) * 100}%` }}
                  />
                  {/* P75 marker */}
                  <div
                    className="absolute h-full w-0.5 bg-green-400"
                    style={{ left: `${(benchmark.values.p75 / 100) * 100}%` }}
                  />
                </div>
                <div className="flex justify-between text-xs text-cscx-gray-500 mt-1">
                  <span>0</span>
                  <span>50</span>
                  <span>100</span>
                </div>
              </div>
            </div>

            {/* Distribution Chart */}
            <div className="bg-cscx-gray-900 border border-cscx-gray-800 rounded-xl p-6">
              <h3 className="text-lg font-semibold text-white mb-4">Portfolio Distribution</h3>
              <BenchmarkDistributionChart
                distribution={benchmark.distribution}
                median={benchmark.values.median}
              />
              <p className="text-sm text-cscx-gray-400 text-center mt-4">
                {benchmark.total_customers} customers analyzed
              </p>
            </div>
          </div>

          {/* Top & Bottom Performers */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Top Performers */}
            <div className="bg-cscx-gray-900 border border-cscx-gray-800 rounded-xl overflow-hidden">
              <div className="p-4 border-b border-cscx-gray-800">
                <h3 className="text-lg font-semibold text-white flex items-center gap-2">
                  <span className="text-green-400">&#9650;</span>
                  Top Performers
                </h3>
              </div>
              <div className="divide-y divide-cscx-gray-800">
                {top_performers.map((performer) => (
                  <div
                    key={performer.customer_id}
                    onClick={() => handleCustomerClick(performer.customer_id)}
                    className="p-4 hover:bg-cscx-gray-800/30 cursor-pointer transition-colors"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <span className="w-6 h-6 rounded-full bg-green-500/20 text-green-400 text-sm font-bold flex items-center justify-center">
                          {performer.rank}
                        </span>
                        <div>
                          <p className="text-white font-medium">{performer.customer_name}</p>
                          <p className="text-xs text-cscx-gray-500">{performer.segment}</p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="text-green-400 font-bold">{performer.value}</p>
                        <p className="text-xs text-cscx-gray-500">{performer.percentile}th percentile</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Bottom Performers */}
            <div className="bg-cscx-gray-900 border border-cscx-gray-800 rounded-xl overflow-hidden">
              <div className="p-4 border-b border-cscx-gray-800">
                <h3 className="text-lg font-semibold text-white flex items-center gap-2">
                  <span className="text-red-400">&#9660;</span>
                  Improvement Opportunities
                </h3>
              </div>
              <div className="divide-y divide-cscx-gray-800">
                {bottom_performers.map((performer) => (
                  <div
                    key={performer.customer_id}
                    onClick={() => handleCustomerClick(performer.customer_id)}
                    className="p-4 hover:bg-cscx-gray-800/30 cursor-pointer transition-colors"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <span className="w-6 h-6 rounded-full bg-red-500/20 text-red-400 text-sm font-bold flex items-center justify-center">
                          {performer.rank}
                        </span>
                        <div>
                          <p className="text-white font-medium">{performer.customer_name}</p>
                          <p className="text-xs text-cscx-gray-500">{performer.segment}</p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="text-red-400 font-bold">{performer.value}</p>
                        <p className="text-xs text-cscx-gray-500">{performer.percentile}th percentile</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </>
      )}

      {/* Segments Tab */}
      {activeTab === 'segments' && (
        <div className="bg-cscx-gray-900 border border-cscx-gray-800 rounded-xl overflow-hidden">
          <div className="p-4 border-b border-cscx-gray-800">
            <h3 className="text-lg font-semibold text-white">Segment Benchmarks</h3>
            <p className="text-sm text-cscx-gray-400 mt-1">
              Compare performance across customer segments
            </p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-cscx-gray-800/50">
                  <th className="text-left px-4 py-3 text-cscx-gray-400 font-medium">Segment</th>
                  <th className="text-left px-4 py-3 text-cscx-gray-400 font-medium">Customers</th>
                  <th className="text-left px-4 py-3 text-cscx-gray-400 font-medium">Total ARR</th>
                  <th className="text-left px-4 py-3 text-cscx-gray-400 font-medium">Avg Score</th>
                  <th className="text-left px-4 py-3 text-cscx-gray-400 font-medium">Median</th>
                  <th className="text-left px-4 py-3 text-cscx-gray-400 font-medium">Range</th>
                  <th className="text-left px-4 py-3 text-cscx-gray-400 font-medium">Top Performer</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-cscx-gray-800">
                {segments.map((segment) => (
                  <tr
                    key={segment.segment}
                    className="hover:bg-cscx-gray-800/30 transition-colors"
                  >
                    <td className="px-4 py-4">
                      <span className="text-white font-medium">{segment.segment}</span>
                    </td>
                    <td className="px-4 py-4 text-cscx-gray-300">
                      {segment.customer_count}
                    </td>
                    <td className="px-4 py-4 text-cscx-gray-300">
                      {formatCurrency(segment.total_arr)}
                    </td>
                    <td className="px-4 py-4">
                      <span className={getPercentileColor(segment.avg_health_score)}>
                        {segment.avg_health_score}
                      </span>
                    </td>
                    <td className="px-4 py-4 text-white">
                      {segment.values.median}
                    </td>
                    <td className="px-4 py-4 text-cscx-gray-400 text-xs">
                      {segment.values.min} - {segment.values.max}
                    </td>
                    <td className="px-4 py-4">
                      {segment.top_performers[0] && (
                        <button
                          onClick={() => handleCustomerClick(segment.top_performers[0].customer_id)}
                          className="text-cscx-accent hover:underline text-left"
                        >
                          {segment.top_performers[0].customer_name}
                          <span className="text-cscx-gray-500 ml-1">
                            ({segment.top_performers[0].value})
                          </span>
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Recommendations Tab */}
      {activeTab === 'recommendations' && (
        <div className="bg-cscx-gray-900 border border-cscx-gray-800 rounded-xl overflow-hidden">
          <div className="p-4 border-b border-cscx-gray-800">
            <h3 className="text-lg font-semibold text-white">Improvement Recommendations</h3>
            <p className="text-sm text-cscx-gray-400 mt-1">
              Data-driven actions to improve underperforming accounts
            </p>
          </div>
          <div className="divide-y divide-cscx-gray-800">
            {recommendations.map((rec, index) => (
              <div
                key={`${rec.customer_id}-${index}`}
                className="p-4 hover:bg-cscx-gray-800/30 transition-colors"
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <button
                        onClick={() => handleCustomerClick(rec.customer_id)}
                        className="text-white font-medium hover:text-cscx-accent"
                      >
                        {rec.customer_name}
                      </button>
                      <span className={`px-2 py-0.5 text-xs font-medium rounded ${getPriorityBadge(rec.priority)}`}>
                        {rec.priority} priority
                      </span>
                    </div>
                    <p className="text-sm text-cscx-gray-300">{rec.action}</p>
                    <div className="flex items-center gap-4 mt-2 text-xs text-cscx-gray-500">
                      <span>
                        Current: <span className="text-red-400">{rec.current_value}</span>
                      </span>
                      <span>
                        Target: <span className="text-green-400">{rec.target_value}</span>
                      </span>
                      <span>
                        Gap: <span className="text-yellow-400">{rec.gap}</span>
                      </span>
                    </div>
                  </div>
                  <button
                    onClick={() => handleCustomerClick(rec.customer_id)}
                    className="px-3 py-1.5 text-xs bg-cscx-accent/20 text-cscx-accent rounded hover:bg-cscx-accent/30 transition-colors"
                  >
                    View Details
                  </button>
                </div>
              </div>
            ))}
            {recommendations.length === 0 && (
              <div className="p-8 text-center text-cscx-gray-500">
                No recommendations at this time. All customers are performing above median.
              </div>
            )}
          </div>
        </div>
      )}

      {/* Customer Benchmark Modal */}
      {selectedCustomerId && (
        <CustomerBenchmarkModal
          customerId={selectedCustomerId}
          onClose={handleCloseModal}
          onViewFullDetail={handleViewCustomerDetail}
        />
      )}
    </div>
  );
};

export default BenchmarkReport;
