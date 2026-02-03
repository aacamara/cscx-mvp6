/**
 * Customer Benchmark Modal
 * PRD-171: Detailed customer benchmark view with peer comparison
 */

import React, { useState, useEffect, useCallback } from 'react';

const API_BASE = `${import.meta.env.VITE_API_URL || ''}/api`;

// ============================================
// TYPES
// ============================================

interface CustomerMetricBenchmark {
  metric: string;
  value: number;
  percentile: number;
  benchmark_median: number;
  gap: number;
  status: 'above' | 'at' | 'below';
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

interface CustomerBenchmarkData {
  customer: {
    id: string;
    name: string;
    arr: number;
    segment: string;
    industry: string | null;
    health_score: number;
  };
  metrics: CustomerMetricBenchmark[];
  peer_comparison: {
    segment: string;
    total_peers: number;
    rank: number;
    percentile: number;
  };
  recommendations: BenchmarkRecommendation[];
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

const getStatusColor = (status: 'above' | 'at' | 'below'): string => {
  switch (status) {
    case 'above': return 'text-green-400';
    case 'at': return 'text-blue-400';
    case 'below': return 'text-red-400';
  }
};

const getStatusBg = (status: 'above' | 'at' | 'below'): string => {
  switch (status) {
    case 'above': return 'bg-green-500/20';
    case 'at': return 'bg-blue-500/20';
    case 'below': return 'bg-red-500/20';
  }
};

const getStatusLabel = (status: 'above' | 'at' | 'below'): string => {
  switch (status) {
    case 'above': return 'Above Benchmark';
    case 'at': return 'At Benchmark';
    case 'below': return 'Below Benchmark';
  }
};

const formatMetricName = (metric: string): string => {
  return metric
    .split('_')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
};

// ============================================
// COMPONENT
// ============================================

interface CustomerBenchmarkModalProps {
  customerId: string;
  onClose: () => void;
  onViewFullDetail: (customerId: string) => void;
}

export const CustomerBenchmarkModal: React.FC<CustomerBenchmarkModalProps> = ({
  customerId,
  onClose,
  onViewFullDetail
}) => {
  const [data, setData] = useState<CustomerBenchmarkData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchCustomerBenchmark = useCallback(async () => {
    setLoading(true);
    try {
      const response = await fetch(`${API_BASE}/reports/benchmark/customer/${customerId}`);
      if (!response.ok) throw new Error('Failed to fetch customer benchmark');

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
  }, [customerId]);

  useEffect(() => {
    fetchCustomerBenchmark();
  }, [fetchCustomerBenchmark]);

  // Handle escape key
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleEscape);
    return () => window.removeEventListener('keydown', handleEscape);
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/70 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="relative w-full max-w-2xl max-h-[90vh] overflow-y-auto bg-cscx-gray-900 border border-cscx-gray-800 rounded-xl shadow-xl">
        {/* Header */}
        <div className="sticky top-0 bg-cscx-gray-900 border-b border-cscx-gray-800 p-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-white">Customer Benchmark</h2>
          <button
            onClick={onClose}
            className="p-1 text-cscx-gray-400 hover:text-white transition-colors"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Content */}
        <div className="p-4 space-y-6">
          {loading && (
            <div className="py-12 text-center text-cscx-gray-400">
              <div className="animate-spin w-8 h-8 border-2 border-cscx-accent border-t-transparent rounded-full mx-auto mb-2" />
              Loading benchmark data...
            </div>
          )}

          {error && (
            <div className="py-12 text-center text-red-400">
              {error}
              <button
                onClick={fetchCustomerBenchmark}
                className="block mx-auto mt-2 text-sm text-cscx-accent hover:underline"
              >
                Try again
              </button>
            </div>
          )}

          {data && (
            <>
              {/* Customer Info */}
              <div className="flex items-start justify-between">
                <div>
                  <h3 className="text-xl font-bold text-white">{data.customer.name}</h3>
                  <div className="flex items-center gap-3 mt-1 text-sm text-cscx-gray-400">
                    <span>{data.customer.segment}</span>
                    {data.customer.industry && (
                      <>
                        <span>|</span>
                        <span>{data.customer.industry}</span>
                      </>
                    )}
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-cscx-accent font-medium">{formatCurrency(data.customer.arr)}</p>
                  <p className="text-xs text-cscx-gray-500">ARR</p>
                </div>
              </div>

              {/* Peer Comparison Summary */}
              <div className="bg-cscx-gray-800/50 rounded-lg p-4">
                <h4 className="text-sm font-medium text-cscx-gray-400 mb-3">Peer Comparison</h4>
                <div className="grid grid-cols-3 gap-4 text-center">
                  <div>
                    <p className="text-2xl font-bold text-cscx-accent">
                      #{data.peer_comparison.rank}
                    </p>
                    <p className="text-xs text-cscx-gray-500">
                      of {data.peer_comparison.total_peers} in {data.peer_comparison.segment}
                    </p>
                  </div>
                  <div>
                    <p className="text-2xl font-bold text-white">
                      {data.peer_comparison.percentile}
                      <span className="text-sm">th</span>
                    </p>
                    <p className="text-xs text-cscx-gray-500">Percentile</p>
                  </div>
                  <div>
                    <p className="text-2xl font-bold text-white">
                      {data.customer.health_score}
                    </p>
                    <p className="text-xs text-cscx-gray-500">Health Score</p>
                  </div>
                </div>
              </div>

              {/* Metrics Breakdown */}
              <div>
                <h4 className="text-sm font-medium text-cscx-gray-400 mb-3">Metric Performance</h4>
                <div className="space-y-3">
                  {data.metrics.map((metric) => (
                    <div
                      key={metric.metric}
                      className="bg-cscx-gray-800/30 rounded-lg p-3"
                    >
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-white font-medium">
                          {formatMetricName(metric.metric)}
                        </span>
                        <span className={`px-2 py-0.5 text-xs font-medium rounded ${getStatusBg(metric.status)} ${getStatusColor(metric.status)}`}>
                          {getStatusLabel(metric.status)}
                        </span>
                      </div>

                      {/* Progress bar showing position relative to benchmark */}
                      <div className="relative h-6 bg-cscx-gray-700 rounded-full overflow-hidden">
                        {/* Benchmark median marker */}
                        <div
                          className="absolute h-full w-0.5 bg-white/50 z-10"
                          style={{ left: `${(metric.benchmark_median / 100) * 100}%` }}
                        />

                        {/* Value bar */}
                        <div
                          className={`h-full rounded-full transition-all ${
                            metric.status === 'above' ? 'bg-green-500' :
                            metric.status === 'at' ? 'bg-blue-500' : 'bg-red-500'
                          }`}
                          style={{ width: `${Math.min(100, (metric.value / 100) * 100)}%` }}
                        />
                      </div>

                      {/* Stats row */}
                      <div className="flex items-center justify-between mt-2 text-xs">
                        <span className="text-cscx-gray-500">
                          Value: <span className="text-white">{metric.value}</span>
                        </span>
                        <span className="text-cscx-gray-500">
                          Median: <span className="text-white">{metric.benchmark_median}</span>
                        </span>
                        <span className="text-cscx-gray-500">
                          Gap: <span className={metric.gap >= 0 ? 'text-green-400' : 'text-red-400'}>
                            {metric.gap >= 0 ? '+' : ''}{metric.gap}
                          </span>
                        </span>
                        <span className="text-cscx-gray-500">
                          Percentile: <span className="text-cscx-accent">{metric.percentile}</span>
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Recommendations */}
              {data.recommendations.length > 0 && (
                <div>
                  <h4 className="text-sm font-medium text-cscx-gray-400 mb-3">Recommendations</h4>
                  <div className="space-y-2">
                    {data.recommendations.map((rec, index) => (
                      <div
                        key={index}
                        className="p-3 bg-yellow-500/10 border border-yellow-500/30 rounded-lg"
                      >
                        <div className="flex items-start gap-2">
                          <span className="text-yellow-400 mt-0.5">!</span>
                          <div>
                            <p className="text-sm text-white">{rec.action}</p>
                            <p className="text-xs text-cscx-gray-500 mt-1">
                              Improve {formatMetricName(rec.metric)} from {rec.current_value} to {rec.target_value} (gap: {rec.gap})
                            </p>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}
        </div>

        {/* Footer */}
        <div className="sticky bottom-0 bg-cscx-gray-900 border-t border-cscx-gray-800 p-4 flex justify-end gap-3">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm text-cscx-gray-400 hover:text-white transition-colors"
          >
            Close
          </button>
          {data && (
            <button
              onClick={() => onViewFullDetail(data.customer.id)}
              className="px-4 py-2 text-sm bg-cscx-accent hover:bg-cscx-accent/80 text-white rounded-lg transition-colors"
            >
              View Full Customer Detail
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default CustomerBenchmarkModal;
