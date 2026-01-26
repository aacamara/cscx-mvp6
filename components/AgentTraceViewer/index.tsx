/**
 * Agent Trace Viewer
 * Timeline visualization of agent execution steps
 * Shows tool calls, inputs, outputs with color-coded status
 */

import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../../context/AuthContext';

// ============================================
// Types
// ============================================

export type StepStatus = 'success' | 'error' | 'pending' | 'running';

export interface TraceStep {
  id: string;
  type: string;
  name: string;
  description?: string;
  input?: any;
  output?: any;
  timestamp: string;
  duration?: number;
  parentStepId?: string;
  metadata?: Record<string, any>;
  tokens?: { input: number; output: number };
  status: StepStatus;
}

export interface Trace {
  id: string;
  agentId: string;
  agentName: string;
  agentType: 'orchestrator' | 'specialist' | 'support';
  status: 'running' | 'completed' | 'failed' | 'waiting_approval';
  startTime: string;
  endTime?: string;
  duration?: number;
  stepCount: number;
  tokens?: { input: number; output: number };
  input: string;
  output?: string;
  hasError: boolean;
  customerId?: string;
}

export interface TraceDetail extends Trace {
  steps: TraceStep[];
  error?: string;
  customerContext?: Record<string, any>;
  metadata?: Record<string, any>;
}

interface FilterOptions {
  agentType?: string;
  status?: string;
  startDate?: string;
  endDate?: string;
}

interface Props {
  onSelectTrace?: (trace: TraceDetail) => void;
  selectedTraceId?: string;
  customerId?: string;
  autoRefresh?: boolean;
  refreshInterval?: number;
}

const API_URL = import.meta.env.VITE_API_URL || '';

// ============================================
// Step Type Icons
// ============================================

const STEP_ICONS: Record<string, string> = {
  thinking: '&#129504;', // brain
  tool_call: '&#128295;', // wrench
  tool_result: '&#128202;', // chart
  llm_call: '&#129302;', // robot
  llm_response: '&#128172;', // speech
  decision: '&#128256;', // arrows
  handoff: '&#129309;', // handshake
  approval: '&#9995;', // hand
  response: '&#9989;', // checkmark
  error: '&#10060;', // x
  input: '&#128229;', // inbox
  output: '&#128228;', // outbox
};

// ============================================
// Status Colors
// ============================================

const STATUS_COLORS: Record<StepStatus, { bg: string; border: string; text: string }> = {
  success: { bg: 'bg-green-500/10', border: 'border-green-500', text: 'text-green-400' },
  error: { bg: 'bg-red-500/10', border: 'border-red-500', text: 'text-red-400' },
  pending: { bg: 'bg-yellow-500/10', border: 'border-yellow-500', text: 'text-yellow-400' },
  running: { bg: 'bg-blue-500/10', border: 'border-blue-500', text: 'text-blue-400' },
};

// ============================================
// Main Component
// ============================================

export function AgentTraceViewer({
  onSelectTrace,
  selectedTraceId,
  customerId,
  autoRefresh = true,
  refreshInterval = 5000,
}: Props) {
  const { getAuthHeaders } = useAuth();
  const [traces, setTraces] = useState<Trace[]>([]);
  const [selectedTrace, setSelectedTrace] = useState<TraceDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [detailLoading, setDetailLoading] = useState(false);
  const [filters, setFilters] = useState<FilterOptions>({});
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [expandedSteps, setExpandedSteps] = useState<Set<string>>(new Set());

  // Build headers with demo fallback
  const buildHeaders = useCallback((): Record<string, string> => {
    const headers = getAuthHeaders();
    if (!headers['x-user-id']) {
      headers['x-user-id'] = 'df2dc7be-ece0-40b2-a9d7-0f6c45b75131';
    }
    return headers;
  }, [getAuthHeaders]);

  // Fetch traces
  const fetchTraces = useCallback(async () => {
    try {
      const params = new URLSearchParams();
      params.set('page', page.toString());
      params.set('limit', '20');

      if (filters.agentType) params.set('agentType', filters.agentType);
      if (filters.status) params.set('status', filters.status);
      if (filters.startDate) params.set('startDate', filters.startDate);
      if (filters.endDate) params.set('endDate', filters.endDate);
      if (customerId) params.set('customerId', customerId);

      const response = await fetch(`${API_URL}/api/traces?${params}`, {
        headers: buildHeaders(),
      });

      if (response.ok) {
        const data = await response.json();
        setTraces(data.traces || []);
        setTotalPages(data.pagination?.totalPages || 1);
      }
    } catch (error) {
      console.error('Error fetching traces:', error);
    } finally {
      setLoading(false);
    }
  }, [buildHeaders, page, filters, customerId]);

  // Fetch trace details
  const fetchTraceDetails = useCallback(async (traceId: string) => {
    setDetailLoading(true);
    try {
      const response = await fetch(`${API_URL}/api/traces/${traceId}`, {
        headers: buildHeaders(),
      });

      if (response.ok) {
        const data = await response.json();
        const detail: TraceDetail = {
          ...data.trace,
          steps: data.trace.steps || [],
        };
        setSelectedTrace(detail);
        onSelectTrace?.(detail);
      }
    } catch (error) {
      console.error('Error fetching trace details:', error);
    } finally {
      setDetailLoading(false);
    }
  }, [buildHeaders, onSelectTrace]);

  // Initial fetch and polling
  useEffect(() => {
    fetchTraces();

    if (autoRefresh) {
      const interval = setInterval(fetchTraces, refreshInterval);
      return () => clearInterval(interval);
    }
  }, [fetchTraces, autoRefresh, refreshInterval]);

  // Fetch details when selectedTraceId changes
  useEffect(() => {
    if (selectedTraceId) {
      fetchTraceDetails(selectedTraceId);
    }
  }, [selectedTraceId, fetchTraceDetails]);

  // Toggle step expansion
  const toggleStepExpansion = (stepId: string) => {
    setExpandedSteps(prev => {
      const next = new Set(prev);
      if (next.has(stepId)) {
        next.delete(stepId);
      } else {
        next.add(stepId);
      }
      return next;
    });
  };

  // Determine step status
  const getStepStatus = (step: TraceStep): StepStatus => {
    if (step.status) return step.status;
    if (step.metadata?.error) return 'error';
    if (step.output !== undefined) return 'success';
    return 'pending';
  };

  // Format duration
  const formatDuration = (ms?: number) => {
    if (!ms) return '-';
    if (ms < 1000) return `${ms}ms`;
    return `${(ms / 1000).toFixed(2)}s`;
  };

  // Format timestamp
  const formatTimestamp = (ts: string) => {
    const date = new Date(ts);
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin text-4xl">&#128260;</div>
      </div>
    );
  }

  return (
    <div className="flex h-full bg-gray-900">
      {/* Trace List Panel */}
      <div className="w-96 border-r border-gray-700 flex flex-col">
        {/* Filters */}
        <div className="p-4 border-b border-gray-700 space-y-3">
          <h2 className="text-lg font-semibold text-white">Agent Traces</h2>

          <div className="grid grid-cols-2 gap-2">
            <select
              value={filters.agentType || ''}
              onChange={(e) => setFilters({ ...filters, agentType: e.target.value || undefined })}
              className="bg-gray-800 border border-gray-600 rounded px-2 py-1.5 text-sm text-white"
            >
              <option value="">All Types</option>
              <option value="orchestrator">Orchestrator</option>
              <option value="specialist">Specialist</option>
              <option value="support">Support</option>
            </select>

            <select
              value={filters.status || ''}
              onChange={(e) => setFilters({ ...filters, status: e.target.value || undefined })}
              className="bg-gray-800 border border-gray-600 rounded px-2 py-1.5 text-sm text-white"
            >
              <option value="">All Status</option>
              <option value="completed">Completed</option>
              <option value="failed">Failed</option>
              <option value="running">Running</option>
              <option value="waiting_approval">Waiting Approval</option>
            </select>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <input
              type="date"
              value={filters.startDate || ''}
              onChange={(e) => setFilters({ ...filters, startDate: e.target.value || undefined })}
              className="bg-gray-800 border border-gray-600 rounded px-2 py-1.5 text-sm text-white"
              placeholder="Start Date"
            />
            <input
              type="date"
              value={filters.endDate || ''}
              onChange={(e) => setFilters({ ...filters, endDate: e.target.value || undefined })}
              className="bg-gray-800 border border-gray-600 rounded px-2 py-1.5 text-sm text-white"
              placeholder="End Date"
            />
          </div>
        </div>

        {/* Trace List */}
        <div className="flex-1 overflow-auto">
          {traces.length === 0 ? (
            <div className="p-8 text-center text-gray-500">
              <p>No traces found</p>
              <p className="text-sm mt-2">Traces will appear here when agents run</p>
            </div>
          ) : (
            <div className="space-y-1 p-2">
              {traces.map((trace) => (
                <div
                  key={trace.id}
                  onClick={() => fetchTraceDetails(trace.id)}
                  className={`p-3 rounded-lg cursor-pointer transition-colors ${
                    selectedTrace?.id === trace.id
                      ? 'bg-cscx-accent/20 border border-cscx-accent'
                      : 'bg-gray-800 hover:bg-gray-700 border border-transparent'
                  }`}
                >
                  <div className="flex items-center justify-between mb-1">
                    <div className="flex items-center gap-2">
                      <span className="text-lg">
                        {trace.agentType === 'orchestrator' ? '\u{1F3AF}' : '\u{1F527}'}
                      </span>
                      <span className="font-medium text-white text-sm truncate max-w-[150px]">
                        {trace.agentName}
                      </span>
                    </div>
                    <StatusBadge status={trace.status} />
                  </div>

                  <p className="text-xs text-gray-400 truncate mb-2">{trace.input}</p>

                  <div className="flex items-center gap-3 text-xs text-gray-500">
                    <span>{trace.stepCount} steps</span>
                    {trace.duration && <span>{formatDuration(trace.duration)}</span>}
                    <span>{formatTimestamp(trace.startTime)}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="p-3 border-t border-gray-700 flex items-center justify-between">
            <button
              onClick={() => setPage(p => Math.max(1, p - 1))}
              disabled={page === 1}
              className="px-3 py-1 bg-gray-700 rounded text-sm disabled:opacity-50"
            >
              Prev
            </button>
            <span className="text-sm text-gray-400">
              Page {page} of {totalPages}
            </span>
            <button
              onClick={() => setPage(p => Math.min(totalPages, p + 1))}
              disabled={page === totalPages}
              className="px-3 py-1 bg-gray-700 rounded text-sm disabled:opacity-50"
            >
              Next
            </button>
          </div>
        )}
      </div>

      {/* Trace Detail Panel */}
      <div className="flex-1 overflow-auto">
        {detailLoading ? (
          <div className="flex items-center justify-center h-full">
            <div className="animate-spin text-4xl">&#128260;</div>
          </div>
        ) : selectedTrace ? (
          <div className="p-6">
            {/* Header */}
            <div className="mb-6">
              <div className="flex items-center justify-between mb-2">
                <h2 className="text-xl font-bold text-white">{selectedTrace.agentName}</h2>
                <StatusBadge status={selectedTrace.status} size="lg" />
              </div>

              <div className="grid grid-cols-4 gap-4 text-sm">
                <div>
                  <span className="text-gray-500">Run ID</span>
                  <p className="text-gray-300 font-mono text-xs">{selectedTrace.id.substring(0, 12)}...</p>
                </div>
                <div>
                  <span className="text-gray-500">Duration</span>
                  <p className="text-gray-300">{formatDuration(selectedTrace.duration || 0)}</p>
                </div>
                <div>
                  <span className="text-gray-500">Steps</span>
                  <p className="text-gray-300">{selectedTrace.steps.length}</p>
                </div>
                <div>
                  <span className="text-gray-500">Tokens</span>
                  <p className="text-gray-300">
                    {selectedTrace.tokens
                      ? `${selectedTrace.tokens.input} / ${selectedTrace.tokens.output}`
                      : '-'
                    }
                  </p>
                </div>
              </div>

              {/* Input */}
              <div className="mt-4 p-3 bg-gray-800 rounded border border-gray-700">
                <span className="text-xs text-gray-500 uppercase">Input</span>
                <p className="text-gray-300 text-sm mt-1">{selectedTrace.input}</p>
              </div>

              {/* Output/Error */}
              {selectedTrace.output && (
                <div className="mt-3 p-3 bg-green-900/20 rounded border border-green-700">
                  <span className="text-xs text-green-500 uppercase">Output</span>
                  <p className="text-gray-300 text-sm mt-1">{selectedTrace.output}</p>
                </div>
              )}

              {selectedTrace.error && (
                <div className="mt-3 p-3 bg-red-900/20 rounded border border-red-700">
                  <span className="text-xs text-red-500 uppercase">Error</span>
                  <p className="text-red-300 text-sm mt-1">{selectedTrace.error}</p>
                </div>
              )}
            </div>

            {/* Timeline */}
            <div>
              <h3 className="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-4">
                Execution Timeline
              </h3>

              <div className="relative">
                {/* Timeline Line */}
                <div className="absolute left-6 top-0 bottom-0 w-0.5 bg-gray-700" />

                {/* Steps */}
                <div className="space-y-4">
                  {selectedTrace.steps.map((step, index) => {
                    const status = getStepStatus(step);
                    const colors = STATUS_COLORS[status];
                    const isExpanded = expandedSteps.has(step.id);

                    return (
                      <div key={step.id} className="relative pl-14">
                        {/* Timeline Node */}
                        <div
                          className={`absolute left-4 w-5 h-5 rounded-full ${colors.bg} ${colors.border} border-2 flex items-center justify-center`}
                          style={{ top: '4px' }}
                        >
                          <span className="text-xs" dangerouslySetInnerHTML={{ __html: STEP_ICONS[step.type] || '&#8226;' }} />
                        </div>

                        {/* Step Card */}
                        <div
                          className={`${colors.bg} border ${colors.border} rounded-lg overflow-hidden`}
                        >
                          {/* Step Header */}
                          <div
                            className="p-3 cursor-pointer hover:bg-white/5"
                            onClick={() => toggleStepExpansion(step.id)}
                          >
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-3">
                                <span className="text-xs px-2 py-0.5 bg-gray-700 rounded text-gray-300">
                                  {step.type}
                                </span>
                                <span className="font-medium text-white">{step.name}</span>
                              </div>

                              <div className="flex items-center gap-3 text-xs text-gray-400">
                                {step.duration && (
                                  <span>{formatDuration(step.duration)}</span>
                                )}
                                <span>{formatTimestamp(step.timestamp)}</span>
                                <span className={`${colors.text}`}>
                                  {status === 'running' ? '...' : status}
                                </span>
                                <span className="text-lg">
                                  {isExpanded ? '\u25BC' : '\u25B6'}
                                </span>
                              </div>
                            </div>

                            {step.description && (
                              <p className="text-sm text-gray-400 mt-2">{step.description}</p>
                            )}
                          </div>

                          {/* Expanded Details */}
                          {isExpanded && (
                            <div className="border-t border-gray-700 p-3 space-y-3">
                              {step.input !== undefined && (
                                <div>
                                  <span className="text-xs text-gray-500 uppercase">Input</span>
                                  <pre className="mt-1 p-2 bg-gray-900 rounded text-xs text-gray-300 overflow-auto max-h-40">
                                    {typeof step.input === 'string'
                                      ? step.input
                                      : JSON.stringify(step.input, null, 2)
                                    }
                                  </pre>
                                </div>
                              )}

                              {step.output !== undefined && (
                                <div>
                                  <span className="text-xs text-gray-500 uppercase">Output</span>
                                  <pre className="mt-1 p-2 bg-gray-900 rounded text-xs text-gray-300 overflow-auto max-h-40">
                                    {typeof step.output === 'string'
                                      ? step.output
                                      : JSON.stringify(step.output, null, 2)
                                    }
                                  </pre>
                                </div>
                              )}

                              {step.tokens && (
                                <div className="text-xs text-gray-500">
                                  Tokens: {step.tokens.input} in / {step.tokens.output} out
                                </div>
                              )}

                              {step.metadata && Object.keys(step.metadata).length > 0 && (
                                <div>
                                  <span className="text-xs text-gray-500 uppercase">Metadata</span>
                                  <pre className="mt-1 p-2 bg-gray-900 rounded text-xs text-gray-300 overflow-auto max-h-24">
                                    {JSON.stringify(step.metadata, null, 2)}
                                  </pre>
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>
        ) : (
          <div className="flex items-center justify-center h-full text-gray-500">
            <div className="text-center">
              <div className="text-4xl mb-4">&#128065;</div>
              <p>Select a trace to view details</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ============================================
// Helper Components
// ============================================

function StatusBadge({ status, size = 'sm' }: { status: string; size?: 'sm' | 'lg' }) {
  const colors: Record<string, string> = {
    running: 'bg-blue-500 animate-pulse',
    completed: 'bg-green-500',
    failed: 'bg-red-500',
    waiting_approval: 'bg-yellow-500',
  };

  const sizeClasses = size === 'lg' ? 'px-3 py-1 text-sm' : 'px-2 py-0.5 text-xs';

  return (
    <span className={`${sizeClasses} rounded-full text-white ${colors[status] || 'bg-gray-500'}`}>
      {status.replace('_', ' ')}
    </span>
  );
}

export default AgentTraceViewer;
