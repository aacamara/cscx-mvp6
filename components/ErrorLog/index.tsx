/**
 * Error Log Component
 * Lists recent errors with stack traces, filtering, and links to traces
 */

import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../../context/AuthContext';

// ============================================
// Types
// ============================================

type ErrorSeverity = 'low' | 'medium' | 'high' | 'critical';

interface ErrorEntry {
  id: string;
  runId: string;
  agent: string;
  agentType: string;
  error: string;
  errorType: string;
  severity: ErrorSeverity;
  timestamp: string;
  stackTrace?: string;
  context?: {
    input?: string;
    step?: string;
    toolName?: string;
  };
  recoveryStatus?: 'pending' | 'recovered' | 'failed';
  recoverySuggestion?: string;
}

interface ErrorStats {
  total: number;
  byType: Array<{ type: string; count: number; lastOccurrence: string }>;
  byAgent: Array<{ agent: string; count: number }>;
  recent: ErrorEntry[];
  trend: Array<{ timestamp: string; value: number }>;
  period: string;
}

interface FilterOptions {
  severity?: ErrorSeverity;
  agentType?: string;
  errorType?: string;
  startDate?: string;
  endDate?: string;
}

interface Props {
  onSelectError?: (error: ErrorEntry) => void;
  onViewTrace?: (runId: string) => void;
  className?: string;
}

const API_URL = import.meta.env.VITE_API_URL || '';

// ============================================
// Severity Configuration
// ============================================

const SEVERITY_CONFIG: Record<ErrorSeverity, { color: string; bg: string; label: string }> = {
  low: { color: 'text-blue-400', bg: 'bg-blue-500/20', label: 'Low' },
  medium: { color: 'text-yellow-400', bg: 'bg-yellow-500/20', label: 'Medium' },
  high: { color: 'text-orange-400', bg: 'bg-orange-500/20', label: 'High' },
  critical: { color: 'text-red-400', bg: 'bg-red-500/20', label: 'Critical' },
};

// Error type to severity mapping
function getErrorSeverity(errorType: string, error: string): ErrorSeverity {
  const criticalPatterns = ['authentication', 'unauthorized', 'permission', 'security'];
  const highPatterns = ['timeout', 'rate limit', 'network', 'connection'];
  const mediumPatterns = ['validation', 'not found', 'tool error'];

  const combined = `${errorType} ${error}`.toLowerCase();

  if (criticalPatterns.some(p => combined.includes(p))) return 'critical';
  if (highPatterns.some(p => combined.includes(p))) return 'high';
  if (mediumPatterns.some(p => combined.includes(p))) return 'medium';
  return 'low';
}

// Recovery suggestions based on error type
function getRecoverySuggestion(errorType: string): string {
  const suggestions: Record<string, string> = {
    'Timeout': 'Consider increasing timeout limits or optimizing the agent workflow. Check if external services are responding slowly.',
    'Rate Limit': 'Implement request throttling or upgrade API tier. Consider caching frequently accessed data.',
    'Authentication': 'Verify API keys and tokens are valid. Check if credentials have expired or been revoked.',
    'Network': 'Check network connectivity and firewall settings. Ensure external services are accessible.',
    'Validation': 'Review input data format and constraints. Add input sanitization before processing.',
    'Not Found': 'Verify the requested resource exists. Check if IDs or references are correct.',
    'Tool Error': 'Review tool implementation and input schema. Check for edge cases in tool logic.',
    'LLM Error': 'Check LLM provider status. Consider adding retry logic with exponential backoff.',
    'Other': 'Review the error details and stack trace for more context. Consider adding more specific error handling.',
  };

  return suggestions[errorType] || suggestions['Other'];
}

// ============================================
// Main Component
// ============================================

export function ErrorLog({ onSelectError, onViewTrace, className = '' }: Props) {
  const { getAuthHeaders } = useAuth();
  const [errors, setErrors] = useState<ErrorEntry[]>([]);
  const [stats, setStats] = useState<ErrorStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState<FilterOptions>({});
  const [selectedError, setSelectedError] = useState<ErrorEntry | null>(null);
  const [view, setView] = useState<'list' | 'stats'>('list');

  // Build headers
  const buildHeaders = useCallback((): Record<string, string> => {
    const headers = getAuthHeaders();
    if (!headers['x-user-id']) {
      headers['x-user-id'] = 'df2dc7be-ece0-40b2-a9d7-0f6c45b75131';
    }
    return headers;
  }, [getAuthHeaders]);

  // Fetch error data
  const fetchErrors = useCallback(async () => {
    try {
      const params = new URLSearchParams();
      params.set('period', 'week');
      params.set('limit', '50');

      const response = await fetch(`${API_URL}/api/agent-metrics/errors?${params}`, {
        headers: buildHeaders(),
      });

      if (response.ok) {
        const data: ErrorStats = await response.json();

        // Enrich error entries with severity and suggestions
        const enrichedErrors = data.recent.map((err: any) => ({
          ...err,
          severity: getErrorSeverity(err.errorType, err.error),
          recoverySuggestion: getRecoverySuggestion(err.errorType),
        }));

        setErrors(enrichedErrors);
        setStats(data);
      }
    } catch (error) {
      console.error('Error fetching error log:', error);
    } finally {
      setLoading(false);
    }
  }, [buildHeaders]);

  // Initial fetch
  useEffect(() => {
    fetchErrors();
    const interval = setInterval(fetchErrors, 30000); // Refresh every 30 seconds
    return () => clearInterval(interval);
  }, [fetchErrors]);

  // Filter errors
  const filteredErrors = errors.filter(err => {
    if (filters.severity && err.severity !== filters.severity) return false;
    if (filters.agentType && err.agentType !== filters.agentType) return false;
    if (filters.errorType && err.errorType !== filters.errorType) return false;
    return true;
  });

  // Handle error selection
  const handleSelectError = (error: ErrorEntry) => {
    setSelectedError(error);
    onSelectError?.(error);
  };

  // Format timestamp
  const formatTimestamp = (ts: string) => {
    const date = new Date(ts);
    const now = new Date();
    const diff = now.getTime() - date.getTime();

    if (diff < 60000) return 'Just now';
    if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
    if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`;
    return date.toLocaleDateString();
  };

  if (loading) {
    return (
      <div className={`flex items-center justify-center h-64 ${className}`}>
        <div className="text-center">
          <div className="animate-spin text-4xl mb-4">&#10060;</div>
          <p className="text-gray-400">Loading error log...</p>
        </div>
      </div>
    );
  }

  return (
    <div className={`bg-gray-900 flex flex-col ${className}`}>
      {/* Header */}
      <div className="p-4 border-b border-gray-700 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <h2 className="text-lg font-semibold text-white">Error Log</h2>
          {stats && (
            <span className="px-2 py-0.5 bg-red-500/20 text-red-400 rounded text-sm">
              {stats.total} errors this week
            </span>
          )}
        </div>

        {/* View Toggle */}
        <div className="flex items-center gap-2">
          <button
            onClick={() => setView('list')}
            className={`px-3 py-1.5 rounded text-sm ${
              view === 'list' ? 'bg-cscx-accent text-white' : 'bg-gray-700 text-gray-300'
            }`}
          >
            List
          </button>
          <button
            onClick={() => setView('stats')}
            className={`px-3 py-1.5 rounded text-sm ${
              view === 'stats' ? 'bg-cscx-accent text-white' : 'bg-gray-700 text-gray-300'
            }`}
          >
            Stats
          </button>
        </div>
      </div>

      {view === 'stats' ? (
        <ErrorStats stats={stats} />
      ) : (
        <div className="flex-1 flex overflow-hidden">
          {/* Filters & List */}
          <div className="w-96 border-r border-gray-700 flex flex-col">
            {/* Filters */}
            <div className="p-3 border-b border-gray-700 space-y-2">
              <div className="grid grid-cols-2 gap-2">
                <select
                  value={filters.severity || ''}
                  onChange={(e) => setFilters({ ...filters, severity: e.target.value as ErrorSeverity || undefined })}
                  className="bg-gray-800 border border-gray-600 rounded px-2 py-1.5 text-sm text-white"
                >
                  <option value="">All Severity</option>
                  <option value="critical">Critical</option>
                  <option value="high">High</option>
                  <option value="medium">Medium</option>
                  <option value="low">Low</option>
                </select>

                <select
                  value={filters.errorType || ''}
                  onChange={(e) => setFilters({ ...filters, errorType: e.target.value || undefined })}
                  className="bg-gray-800 border border-gray-600 rounded px-2 py-1.5 text-sm text-white"
                >
                  <option value="">All Types</option>
                  {stats?.byType.map(t => (
                    <option key={t.type} value={t.type}>{t.type}</option>
                  ))}
                </select>
              </div>
            </div>

            {/* Error List */}
            <div className="flex-1 overflow-auto">
              {filteredErrors.length === 0 ? (
                <div className="p-8 text-center text-gray-500">
                  <div className="text-4xl mb-4">&#9989;</div>
                  <p>No errors found</p>
                  <p className="text-sm mt-2">All systems operating normally</p>
                </div>
              ) : (
                <div className="divide-y divide-gray-800">
                  {filteredErrors.map((error) => {
                    const severity = SEVERITY_CONFIG[error.severity];
                    const isSelected = selectedError?.id === error.id;

                    return (
                      <div
                        key={error.id}
                        onClick={() => handleSelectError(error)}
                        className={`p-3 cursor-pointer transition-colors ${
                          isSelected
                            ? 'bg-cscx-accent/20 border-l-2 border-l-cscx-accent'
                            : 'hover:bg-gray-800 border-l-2 border-l-transparent'
                        }`}
                      >
                        <div className="flex items-start justify-between mb-1">
                          <div className="flex items-center gap-2">
                            <span className={`px-1.5 py-0.5 rounded text-xs ${severity.bg} ${severity.color}`}>
                              {severity.label}
                            </span>
                            <span className="text-xs text-gray-500">{error.errorType}</span>
                          </div>
                          <span className="text-xs text-gray-500">
                            {formatTimestamp(error.timestamp)}
                          </span>
                        </div>

                        <p className="text-sm text-white truncate mb-1">{error.error}</p>

                        <div className="flex items-center gap-2 text-xs text-gray-500">
                          <span>{error.agent}</span>
                          <span>-</span>
                          <span className="font-mono">{error.runId.substring(0, 8)}...</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

          {/* Error Detail Panel */}
          <div className="flex-1 overflow-auto">
            {selectedError ? (
              <div className="p-6 space-y-6">
                {/* Header */}
                <div className="flex items-start justify-between">
                  <div>
                    <div className="flex items-center gap-3 mb-2">
                      <span className={`px-2 py-1 rounded ${SEVERITY_CONFIG[selectedError.severity].bg} ${SEVERITY_CONFIG[selectedError.severity].color}`}>
                        {SEVERITY_CONFIG[selectedError.severity].label}
                      </span>
                      <span className="text-sm text-gray-400">{selectedError.errorType}</span>
                    </div>
                    <h2 className="text-xl font-bold text-white">{selectedError.error}</h2>
                  </div>

                  <button
                    onClick={() => onViewTrace?.(selectedError.runId)}
                    className="px-4 py-2 bg-gray-700 hover:bg-gray-600 rounded text-sm text-white flex items-center gap-2"
                  >
                    <span>&#128065;</span>
                    View Trace
                  </button>
                </div>

                {/* Metadata */}
                <div className="grid grid-cols-2 gap-4">
                  <div className="bg-gray-800 rounded p-3 border border-gray-700">
                    <span className="text-xs text-gray-500 uppercase">Agent</span>
                    <p className="text-white mt-1">{selectedError.agent}</p>
                  </div>
                  <div className="bg-gray-800 rounded p-3 border border-gray-700">
                    <span className="text-xs text-gray-500 uppercase">Run ID</span>
                    <p className="text-white font-mono text-sm mt-1">{selectedError.runId}</p>
                  </div>
                  <div className="bg-gray-800 rounded p-3 border border-gray-700">
                    <span className="text-xs text-gray-500 uppercase">Timestamp</span>
                    <p className="text-white mt-1">{new Date(selectedError.timestamp).toLocaleString()}</p>
                  </div>
                  <div className="bg-gray-800 rounded p-3 border border-gray-700">
                    <span className="text-xs text-gray-500 uppercase">Recovery Status</span>
                    <p className={`mt-1 ${
                      selectedError.recoveryStatus === 'recovered' ? 'text-green-400' :
                      selectedError.recoveryStatus === 'failed' ? 'text-red-400' : 'text-yellow-400'
                    }`}>
                      {selectedError.recoveryStatus || 'Not attempted'}
                    </p>
                  </div>
                </div>

                {/* Context */}
                {selectedError.context && (
                  <div className="bg-gray-800 rounded-lg border border-gray-700">
                    <div className="px-4 py-2 border-b border-gray-700">
                      <h3 className="text-sm font-semibold text-gray-400 uppercase">Context</h3>
                    </div>
                    <div className="p-4 space-y-3">
                      {selectedError.context.input && (
                        <div>
                          <span className="text-xs text-gray-500">Input</span>
                          <p className="text-gray-300 text-sm mt-1">{selectedError.context.input}</p>
                        </div>
                      )}
                      {selectedError.context.step && (
                        <div>
                          <span className="text-xs text-gray-500">Step</span>
                          <p className="text-gray-300 text-sm mt-1">{selectedError.context.step}</p>
                        </div>
                      )}
                      {selectedError.context.toolName && (
                        <div>
                          <span className="text-xs text-gray-500">Tool</span>
                          <p className="text-gray-300 text-sm mt-1">{selectedError.context.toolName}</p>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* Stack Trace */}
                {selectedError.stackTrace && (
                  <div className="bg-gray-800 rounded-lg border border-gray-700">
                    <div className="px-4 py-2 border-b border-gray-700">
                      <h3 className="text-sm font-semibold text-gray-400 uppercase">Stack Trace</h3>
                    </div>
                    <pre className="p-4 text-xs text-gray-300 overflow-auto max-h-48 font-mono">
                      {selectedError.stackTrace}
                    </pre>
                  </div>
                )}

                {/* Recovery Suggestion */}
                {selectedError.recoverySuggestion && (
                  <div className="bg-blue-900/20 border border-blue-700 rounded-lg p-4">
                    <div className="flex items-start gap-3">
                      <span className="text-2xl">&#128161;</span>
                      <div>
                        <h3 className="text-sm font-semibold text-blue-400 uppercase mb-2">Recovery Suggestion</h3>
                        <p className="text-gray-300 text-sm">{selectedError.recoverySuggestion}</p>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div className="flex items-center justify-center h-full text-gray-500">
                <div className="text-center">
                  <div className="text-4xl mb-4">&#128270;</div>
                  <p>Select an error to view details</p>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// ============================================
// Error Stats View
// ============================================

function ErrorStats({ stats }: { stats: ErrorStats | null }) {
  if (!stats) {
    return (
      <div className="flex items-center justify-center h-64 text-gray-500">
        No statistics available
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6 overflow-auto">
      {/* Summary */}
      <div className="grid grid-cols-4 gap-4">
        <div className="bg-gray-800 rounded-lg p-4 border border-gray-700">
          <span className="text-sm text-gray-400">Total Errors</span>
          <p className="text-3xl font-bold text-red-400">{stats.total}</p>
        </div>
        <div className="bg-gray-800 rounded-lg p-4 border border-gray-700">
          <span className="text-sm text-gray-400">Error Types</span>
          <p className="text-3xl font-bold text-white">{stats.byType.length}</p>
        </div>
        <div className="bg-gray-800 rounded-lg p-4 border border-gray-700">
          <span className="text-sm text-gray-400">Affected Agents</span>
          <p className="text-3xl font-bold text-white">{stats.byAgent.length}</p>
        </div>
        <div className="bg-gray-800 rounded-lg p-4 border border-gray-700">
          <span className="text-sm text-gray-400">Period</span>
          <p className="text-xl font-bold text-white capitalize">{stats.period}</p>
        </div>
      </div>

      {/* Error Types */}
      <div className="bg-gray-800 rounded-lg border border-gray-700">
        <div className="px-4 py-3 border-b border-gray-700">
          <h3 className="font-semibold text-white">Errors by Type</h3>
        </div>
        <div className="p-4">
          {stats.byType.length > 0 ? (
            <div className="space-y-3">
              {stats.byType.map((item, index) => {
                const maxCount = stats.byType[0].count;
                const percent = maxCount > 0 ? (item.count / maxCount) * 100 : 0;

                return (
                  <div key={item.type}>
                    <div className="flex items-center justify-between text-sm mb-1">
                      <div className="flex items-center gap-3">
                        <span className="text-gray-500">#{index + 1}</span>
                        <span className="text-white">{item.type}</span>
                      </div>
                      <div className="flex items-center gap-4">
                        <span className="text-xs text-gray-500">
                          Last: {new Date(item.lastOccurrence).toLocaleTimeString()}
                        </span>
                        <span className="text-red-400 font-medium">{item.count}</span>
                      </div>
                    </div>
                    <div className="h-2 bg-gray-700 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-red-500 transition-all"
                        style={{ width: `${percent}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <p className="text-gray-500 text-center py-4">No error types recorded</p>
          )}
        </div>
      </div>

      {/* Errors by Agent */}
      <div className="bg-gray-800 rounded-lg border border-gray-700">
        <div className="px-4 py-3 border-b border-gray-700">
          <h3 className="font-semibold text-white">Errors by Agent</h3>
        </div>
        <div className="p-4">
          {stats.byAgent.length > 0 ? (
            <div className="space-y-3">
              {stats.byAgent.map((item, index) => {
                const maxCount = stats.byAgent[0].count;
                const percent = maxCount > 0 ? (item.count / maxCount) * 100 : 0;

                return (
                  <div key={item.agent}>
                    <div className="flex items-center justify-between text-sm mb-1">
                      <div className="flex items-center gap-3">
                        <span className="text-gray-500">#{index + 1}</span>
                        <span className="text-white truncate max-w-[200px]">{item.agent}</span>
                      </div>
                      <span className="text-red-400 font-medium">{item.count}</span>
                    </div>
                    <div className="h-2 bg-gray-700 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-orange-500 transition-all"
                        style={{ width: `${percent}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <p className="text-gray-500 text-center py-4">No agent errors recorded</p>
          )}
        </div>
      </div>

      {/* Error Trend */}
      {stats.trend.length > 0 && (
        <div className="bg-gray-800 rounded-lg border border-gray-700">
          <div className="px-4 py-3 border-b border-gray-700">
            <h3 className="font-semibold text-white">Error Trend</h3>
          </div>
          <div className="p-4">
            <div className="flex items-end gap-2 h-32">
              {stats.trend.map((point, index) => {
                const maxValue = Math.max(...stats.trend.map(t => t.value), 1);
                const height = (point.value / maxValue) * 100;

                return (
                  <div
                    key={index}
                    className="flex-1 flex flex-col items-center justify-end"
                  >
                    <div
                      className="w-full bg-red-500/50 hover:bg-red-500 rounded-t transition-all"
                      style={{ height: `${height}%`, minHeight: point.value > 0 ? 4 : 0 }}
                      title={`${point.timestamp}: ${point.value} errors`}
                    />
                    {stats.trend.length <= 10 && (
                      <span className="text-xs text-gray-500 mt-1">
                        {new Date(point.timestamp).toLocaleDateString([], { month: 'short', day: 'numeric' })}
                      </span>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default ErrorLog;
