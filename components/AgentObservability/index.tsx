/**
 * Agent Observability Dashboard
 * Real-time visualization of AI agent execution
 * "Mission Control" for your AI agents
 */

import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../../context/AuthContext';
import { AgentFlowGraph } from '../AgentFlowGraph';

// ============================================
// Types
// ============================================

interface AgentStep {
  id: string;
  runId: string;
  type: string;
  name: string;
  description?: string;
  input?: any;
  output?: any;
  timestamp: string;
  duration?: number;
  tokens?: { input: number; output: number };
  metadata?: Record<string, any>;
}

interface AgentRun {
  id: string;
  agentId: string;
  agentName: string;
  agentType: 'orchestrator' | 'specialist' | 'support';
  status: 'running' | 'completed' | 'failed' | 'waiting_approval';
  startTime: string;
  endTime?: string;
  duration?: number;
  stepCount: number;
  steps?: AgentStep[];
  tokens?: { input: number; output: number };
  input: string;
  output?: string;
  hasChildren: boolean;
}

interface AgentStats {
  totalRuns: number;
  activeRuns: number;
  avgDuration: number;
  totalTokens: { input: number; output: number };
  byAgent: Record<string, number>;
  byStatus: Record<string, number>;
}

interface Specialist {
  id: string;
  name: string;
  description: string;
}

interface FlowVisualization {
  nodes: Array<{
    id: string;
    type: string;
    label: string;
    status: string;
    data: Record<string, any>;
  }>;
  edges: Array<{
    source: string;
    target: string;
    label?: string;
  }>;
}

interface Props {
  onClose?: () => void;
  selectedRunId?: string;
}

const API_URL = import.meta.env.VITE_API_URL || '';

// ============================================
// Main Component
// ============================================

export function AgentObservability({ onClose, selectedRunId }: Props) {
  const { user, getAuthHeaders } = useAuth();
  const [activeTab, setActiveTab] = useState<'dashboard' | 'traces' | 'flow'>('dashboard');
  const [traces, setTraces] = useState<AgentRun[]>([]);
  const [selectedTrace, setSelectedTrace] = useState<AgentRun | null>(null);
  const [stats, setStats] = useState<AgentStats | null>(null);
  const [specialists, setSpecialists] = useState<Specialist[]>([]);
  const [activeRuns, setActiveRuns] = useState<AgentRun[]>([]);
  const [loading, setLoading] = useState(true);
  const [followMode, setFollowMode] = useState(false);

  // Demo user ID for when auth is not configured
  const demoUserId = 'df2dc7be-ece0-40b2-a9d7-0f6c45b75131';
  const effectiveUserId = user?.id || demoUserId;

  // Build headers with demo fallback
  const buildHeaders = useCallback((): Record<string, string> => {
    const headers = getAuthHeaders();
    if (!headers['x-user-id']) {
      headers['x-user-id'] = demoUserId;
    }
    return headers;
  }, [getAuthHeaders]);

  // Fetch data
  const fetchData = useCallback(async () => {
    const headers = buildHeaders();

    try {
      const [tracesRes, statsRes, specialistsRes, activeRes] = await Promise.all([
        fetch(`${API_URL}/api/agents/traces?limit=20`, { headers }),
        fetch(`${API_URL}/api/agents/stats`, { headers }),
        fetch(`${API_URL}/api/agents/specialists`, { headers }),
        fetch(`${API_URL}/api/agents/active`, { headers })
      ]);

      if (tracesRes.ok) {
        const data = await tracesRes.json();
        setTraces(data.traces || []);
      }

      if (statsRes.ok) {
        const data = await statsRes.json();
        setStats(data);
      }

      if (specialistsRes.ok) {
        const data = await specialistsRes.json();
        setSpecialists(data.specialists || []);
      }

      if (activeRes.ok) {
        const data = await activeRes.json();
        setActiveRuns(data.active || []);
      }
    } catch (error) {
      console.error('Error fetching observability data:', error);
    } finally {
      setLoading(false);
    }
  }, [buildHeaders]);

  // Initial fetch and polling
  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 3000); // Poll every 3 seconds
    return () => clearInterval(interval);
  }, [fetchData]);

  // Fetch specific trace when selected
  const fetchTraceDetails = useCallback(async (runId: string) => {
    const headers = buildHeaders();

    try {
      const response = await fetch(`${API_URL}/api/agents/traces/${runId}?tree=true`, {
        headers
      });

      if (response.ok) {
        const data = await response.json();
        setSelectedTrace(data.trace);
      }
    } catch (error) {
      console.error('Error fetching trace details:', error);
    }
  }, [buildHeaders]);

  // Auto-select when selectedRunId prop changes
  useEffect(() => {
    if (selectedRunId) {
      fetchTraceDetails(selectedRunId);
      setActiveTab('flow');
    }
  }, [selectedRunId, fetchTraceDetails]);

  // Status badge component
  const StatusBadge = ({ status }: { status: string }) => {
    const colors: Record<string, string> = {
      running: 'bg-blue-500 animate-pulse',
      completed: 'bg-green-500',
      failed: 'bg-red-500',
      waiting_approval: 'bg-yellow-500'
    };

    return (
      <span className={`px-2 py-0.5 rounded-full text-xs text-white ${colors[status] || 'bg-gray-500'}`}>
        {status.replace('_', ' ')}
      </span>
    );
  };

  // Agent type icon
  const AgentIcon = ({ type }: { type: string }) => {
    const icons: Record<string, string> = {
      orchestrator: '🎯',
      specialist: '🔧',
      support: '💬'
    };
    return <span className="text-lg">{icons[type] || '⚡'}</span>;
  };

  // Step type icon
  const StepIcon = ({ type }: { type: string }) => {
    const icons: Record<string, string> = {
      thinking: '🧠',
      tool_call: '🔧',
      tool_result: '📊',
      llm_call: '🤖',
      llm_response: '💬',
      decision: '🔀',
      handoff: '🤝',
      approval: '✋',
      response: '✅',
      error: '❌'
    };
    return <span>{icons[type] || '•'}</span>;
  };

  if (loading) {
    return (
      <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50">
        <div className="text-white text-center">
          <div className="animate-spin text-4xl mb-4">🔄</div>
          <p>Loading Agent Observatory...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-cscx-black z-50 overflow-hidden flex flex-col">
      {/* Header */}
      <div className="bg-gray-900 border-b border-gray-700 px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <h1 className="text-xl font-bold text-white flex items-center gap-2">
            <span className="text-2xl">🛰️</span>
            Agent Mission Control
          </h1>
          {activeRuns.length > 0 && (
            <span className="flex items-center gap-2 text-sm text-blue-400">
              <span className="w-2 h-2 bg-blue-400 rounded-full animate-pulse"></span>
              {activeRuns.length} active
            </span>
          )}
        </div>

        <div className="flex items-center gap-4">
          {/* Follow Mode Toggle */}
          <button
            onClick={() => setFollowMode(!followMode)}
            className={`px-3 py-1.5 rounded text-sm flex items-center gap-2 transition-colors ${
              followMode
                ? 'bg-blue-600 text-white'
                : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
            }`}
          >
            <span>{followMode ? '👁️' : '👁️‍🗨️'}</span>
            Follow Mode
          </button>

          {/* Tabs */}
          <div className="flex bg-gray-800 rounded-lg p-1">
            {(['dashboard', 'traces', 'flow'] as const).map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`px-4 py-1.5 rounded text-sm transition-colors ${
                  activeTab === tab
                    ? 'bg-cscx-accent text-white'
                    : 'text-gray-400 hover:text-white'
                }`}
              >
                {tab === 'dashboard' && '📊 Dashboard'}
                {tab === 'traces' && '📜 Traces'}
                {tab === 'flow' && '🔀 Flow'}
              </button>
            ))}
          </div>

          {onClose && (
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-white text-xl"
            >
              ×
            </button>
          )}
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 overflow-hidden">
        {activeTab === 'dashboard' && (
          <DashboardView
            stats={stats}
            activeRuns={activeRuns}
            specialists={specialists}
            onSelectRun={(runId) => {
              fetchTraceDetails(runId);
              setActiveTab('flow');
            }}
          />
        )}

        {activeTab === 'traces' && (
          <TracesView
            traces={traces}
            selectedTrace={selectedTrace}
            onSelectTrace={(trace) => {
              setSelectedTrace(trace);
              fetchTraceDetails(trace.id);
            }}
          />
        )}

        {activeTab === 'flow' && (
          <FlowView
            trace={selectedTrace}
            followMode={followMode}
            activeRuns={activeRuns}
            buildHeaders={buildHeaders}
          />
        )}
      </div>
    </div>
  );
}

// ============================================
// Dashboard View
// ============================================

function DashboardView({
  stats,
  activeRuns,
  specialists,
  onSelectRun
}: {
  stats: AgentStats | null;
  activeRuns: AgentRun[];
  specialists: Specialist[];
  onSelectRun: (runId: string) => void;
}) {
  return (
    <div className="h-full overflow-auto p-6">
      <div className="grid grid-cols-4 gap-6 mb-6">
        {/* Stats Cards */}
        <div className="bg-gray-800 rounded-lg p-4 border border-gray-700">
          <div className="text-gray-400 text-sm mb-1">Total Runs</div>
          <div className="text-3xl font-bold text-white">{stats?.totalRuns || 0}</div>
        </div>

        <div className="bg-gray-800 rounded-lg p-4 border border-gray-700">
          <div className="text-gray-400 text-sm mb-1">Active Runs</div>
          <div className="text-3xl font-bold text-blue-400">{stats?.activeRuns || 0}</div>
        </div>

        <div className="bg-gray-800 rounded-lg p-4 border border-gray-700">
          <div className="text-gray-400 text-sm mb-1">Avg Duration</div>
          <div className="text-3xl font-bold text-white">
            {stats?.avgDuration ? `${(stats.avgDuration / 1000).toFixed(1)}s` : '-'}
          </div>
        </div>

        <div className="bg-gray-800 rounded-lg p-4 border border-gray-700">
          <div className="text-gray-400 text-sm mb-1">Total Tokens</div>
          <div className="text-xl font-bold text-white">
            {stats?.totalTokens
              ? `${(stats.totalTokens.input + stats.totalTokens.output).toLocaleString()}`
              : '-'}
          </div>
          <div className="text-xs text-gray-500">
            In: {stats?.totalTokens?.input?.toLocaleString() || 0} |
            Out: {stats?.totalTokens?.output?.toLocaleString() || 0}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-6">
        {/* Active Runs */}
        <div className="col-span-2 bg-gray-800 rounded-lg border border-gray-700">
          <div className="px-4 py-3 border-b border-gray-700">
            <h3 className="font-semibold text-white flex items-center gap-2">
              <span className="w-2 h-2 bg-blue-400 rounded-full animate-pulse"></span>
              Active Agent Runs
            </h3>
          </div>
          <div className="p-4">
            {activeRuns.length === 0 ? (
              <div className="text-center text-gray-500 py-8">
                No active runs. Send a message to start an agent.
              </div>
            ) : (
              <div className="space-y-3">
                {activeRuns.map((run) => (
                  <div
                    key={run.id}
                    onClick={() => onSelectRun(run.id)}
                    className="bg-gray-900 rounded-lg p-3 cursor-pointer hover:bg-gray-700 transition-colors border border-gray-600"
                  >
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <span className="text-lg">
                          {run.agentType === 'orchestrator' ? '🎯' : '🔧'}
                        </span>
                        <span className="font-medium text-white">{run.agentName}</span>
                      </div>
                      <span className="px-2 py-0.5 rounded-full text-xs bg-blue-500 text-white animate-pulse">
                        {run.status}
                      </span>
                    </div>
                    <div className="text-sm text-gray-400 truncate">{run.input}</div>
                    <div className="flex items-center gap-4 mt-2 text-xs text-gray-500">
                      <span>{run.stepCount} steps</span>
                      <span>
                        {new Date(run.startTime).toLocaleTimeString()}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Specialists */}
        <div className="bg-gray-800 rounded-lg border border-gray-700">
          <div className="px-4 py-3 border-b border-gray-700">
            <h3 className="font-semibold text-white">Available Specialists</h3>
          </div>
          <div className="p-4 space-y-2 max-h-[400px] overflow-auto">
            {specialists.map((spec) => (
              <div
                key={spec.id}
                className="bg-gray-900 rounded p-3 border border-gray-700"
              >
                <div className="font-medium text-white text-sm">{spec.name}</div>
                <div className="text-xs text-gray-400 mt-1">{spec.description}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Runs by Agent Chart */}
      {stats?.byAgent && Object.keys(stats.byAgent).length > 0 && (
        <div className="mt-6 bg-gray-800 rounded-lg border border-gray-700 p-4">
          <h3 className="font-semibold text-white mb-4">Runs by Agent</h3>
          <div className="flex items-end gap-4 h-32">
            {Object.entries(stats.byAgent).map(([agent, count]) => {
              const maxCount = Math.max(...Object.values(stats.byAgent));
              const height = (count / maxCount) * 100;
              return (
                <div key={agent} className="flex-1 flex flex-col items-center">
                  <div
                    className="w-full bg-cscx-accent rounded-t"
                    style={{ height: `${height}%` }}
                  ></div>
                  <div className="text-xs text-gray-400 mt-2 text-center truncate w-full">
                    {agent}
                  </div>
                  <div className="text-sm font-bold text-white">{count}</div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

// ============================================
// Traces View
// ============================================

function TracesView({
  traces,
  selectedTrace,
  onSelectTrace
}: {
  traces: AgentRun[];
  selectedTrace: AgentRun | null;
  onSelectTrace: (trace: AgentRun) => void;
}) {
  return (
    <div className="h-full flex">
      {/* Trace List */}
      <div className="w-96 border-r border-gray-700 overflow-auto">
        <div className="p-4">
          <h3 className="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-3">
            Recent Traces
          </h3>
          <div className="space-y-2">
            {traces.map((trace) => (
              <div
                key={trace.id}
                onClick={() => onSelectTrace(trace)}
                className={`p-3 rounded-lg cursor-pointer transition-colors ${
                  selectedTrace?.id === trace.id
                    ? 'bg-cscx-accent/20 border border-cscx-accent'
                    : 'bg-gray-800 hover:bg-gray-700 border border-transparent'
                }`}
              >
                <div className="flex items-center justify-between mb-1">
                  <span className="font-medium text-white text-sm">{trace.agentName}</span>
                  <span className={`px-2 py-0.5 rounded-full text-xs text-white ${
                    trace.status === 'completed' ? 'bg-green-500' :
                    trace.status === 'failed' ? 'bg-red-500' :
                    trace.status === 'running' ? 'bg-blue-500 animate-pulse' :
                    'bg-yellow-500'
                  }`}>
                    {trace.status}
                  </span>
                </div>
                <div className="text-xs text-gray-400 truncate mb-2">{trace.input}</div>
                <div className="flex items-center gap-3 text-xs text-gray-500">
                  <span>{trace.stepCount} steps</span>
                  {trace.duration && <span>{(trace.duration / 1000).toFixed(1)}s</span>}
                  <span>{new Date(trace.startTime).toLocaleTimeString()}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Trace Details */}
      <div className="flex-1 overflow-auto p-6">
        {selectedTrace ? (
          <div>
            <div className="mb-6">
              <h2 className="text-xl font-bold text-white mb-2">{selectedTrace.agentName}</h2>
              <div className="flex items-center gap-4 text-sm text-gray-400">
                <span>Run ID: {selectedTrace.id.substring(0, 8)}...</span>
                <span>Status: {selectedTrace.status}</span>
                {selectedTrace.duration && (
                  <span>Duration: {(selectedTrace.duration / 1000).toFixed(2)}s</span>
                )}
              </div>
            </div>

            {/* Steps Timeline */}
            {selectedTrace.steps && selectedTrace.steps.length > 0 && (
              <div className="space-y-3">
                <h3 className="text-sm font-semibold text-gray-400 uppercase tracking-wider">
                  Execution Steps
                </h3>
                {selectedTrace.steps.map((step, index) => (
                  <div
                    key={step.id}
                    className="bg-gray-800 rounded-lg p-4 border border-gray-700"
                  >
                    <div className="flex items-center gap-3 mb-2">
                      <span className="text-lg">
                        {step.type === 'thinking' ? '🧠' :
                         step.type === 'tool_call' ? '🔧' :
                         step.type === 'llm_call' ? '🤖' :
                         step.type === 'decision' ? '🔀' :
                         step.type === 'handoff' ? '🤝' :
                         step.type === 'approval' ? '✋' :
                         step.type === 'error' ? '❌' : '•'}
                      </span>
                      <span className="font-medium text-white">{step.name}</span>
                      <span className="text-xs text-gray-500">{step.type}</span>
                      {step.duration && (
                        <span className="text-xs text-gray-500 ml-auto">
                          {step.duration}ms
                        </span>
                      )}
                    </div>
                    {step.description && (
                      <p className="text-sm text-gray-400 mb-2">{step.description}</p>
                    )}
                    {step.input && (
                      <details className="mt-2">
                        <summary className="text-xs text-gray-500 cursor-pointer hover:text-gray-300">
                          Input
                        </summary>
                        <pre className="mt-1 p-2 bg-gray-900 rounded text-xs text-gray-300 overflow-auto max-h-32">
                          {JSON.stringify(step.input, null, 2)}
                        </pre>
                      </details>
                    )}
                    {step.output && (
                      <details className="mt-2">
                        <summary className="text-xs text-gray-500 cursor-pointer hover:text-gray-300">
                          Output
                        </summary>
                        <pre className="mt-1 p-2 bg-gray-900 rounded text-xs text-gray-300 overflow-auto max-h-32">
                          {JSON.stringify(step.output, null, 2)}
                        </pre>
                      </details>
                    )}
                    {step.tokens && (
                      <div className="mt-2 text-xs text-gray-500">
                        Tokens: {step.tokens.input} in / {step.tokens.output} out
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        ) : (
          <div className="flex items-center justify-center h-full text-gray-500">
            Select a trace to view details
          </div>
        )}
      </div>
    </div>
  );
}

// ============================================
// Flow View (Visual Graph with React Flow)
// ============================================

function FlowView({
  trace,
  followMode,
  activeRuns,
  buildHeaders
}: {
  trace: AgentRun | null;
  followMode: boolean;
  activeRuns: AgentRun[];
  buildHeaders: () => Record<string, string>;
}) {
  const [visualization, setVisualization] = useState<FlowVisualization | null>(null);
  const [selectedNode, setSelectedNode] = useState<any>(null);

  // Determine which trace to display
  const displayTrace = followMode && activeRuns.length > 0
    ? activeRuns[0]
    : trace;

  // Fetch visualization data when trace changes
  useEffect(() => {
    if (!displayTrace?.id) return;

    const fetchVisualization = async () => {
      try {
        const response = await fetch(
          `${API_URL}/api/agents/traces/${displayTrace.id}/visualization`,
          { headers: buildHeaders() }
        );
        if (response.ok) {
          const data = await response.json();
          setVisualization(data);
        }
      } catch (error) {
        console.error('Failed to fetch visualization:', error);
      }
    };

    fetchVisualization();

    // Poll for updates if trace is running
    let interval: NodeJS.Timeout | null = null;
    if (displayTrace.status === 'running') {
      interval = setInterval(fetchVisualization, 2000);
    }

    return () => {
      if (interval) clearInterval(interval);
    };
  }, [displayTrace?.id, displayTrace?.status, buildHeaders]);

  // Handle node click to show details
  const handleNodeClick = useCallback((nodeId: string, data: any) => {
    setSelectedNode({ id: nodeId, ...data });
  }, []);

  if (!displayTrace) {
    return (
      <div className="h-full flex items-center justify-center text-gray-500">
        <div className="text-center">
          <div className="text-4xl mb-4">🔀</div>
          <p>Select a trace or enable Follow Mode to visualize agent execution</p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full flex">
      {/* Flow Graph - Main Area */}
      <div className="flex-1 relative">
        {/* Agent Header Overlay */}
        <div className="absolute top-4 left-4 z-10 bg-gray-800/90 backdrop-blur rounded-lg p-3 border border-gray-700 max-w-sm">
          <div className="flex items-center gap-3">
            <span className="text-xl">
              {displayTrace.agentType === 'orchestrator' ? '🎯' : '🔧'}
            </span>
            <div className="flex-1 min-w-0">
              <h2 className="font-bold text-white text-sm truncate">{displayTrace.agentName}</h2>
              <p className="text-xs text-gray-400 truncate">{displayTrace.input}</p>
            </div>
            <span className={`px-2 py-0.5 rounded-full text-xs text-white ${
              displayTrace.status === 'completed' ? 'bg-green-500' :
              displayTrace.status === 'failed' ? 'bg-red-500' :
              displayTrace.status === 'running' ? 'bg-blue-500 animate-pulse' :
              'bg-yellow-500'
            }`}>
              {displayTrace.status}
            </span>
          </div>
        </div>

        {/* React Flow Graph */}
        <AgentFlowGraph
          runId={displayTrace.id}
          visualization={visualization || undefined}
          isLive={displayTrace.status === 'running' || followMode}
          onNodeClick={handleNodeClick}
        />
      </div>

      {/* Node Details Panel */}
      {selectedNode && (
        <div className="w-80 border-l border-gray-700 bg-gray-900 p-4 overflow-auto">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold text-white">Node Details</h3>
            <button
              onClick={() => setSelectedNode(null)}
              className="text-gray-400 hover:text-white"
            >
              ×
            </button>
          </div>

          <div className="space-y-4">
            <div>
              <div className="text-xs text-gray-500 uppercase mb-1">Type</div>
              <div className="text-sm text-white">{selectedNode.type}</div>
            </div>

            <div>
              <div className="text-xs text-gray-500 uppercase mb-1">Name</div>
              <div className="text-sm text-white">{selectedNode.label}</div>
            </div>

            {selectedNode.duration && (
              <div>
                <div className="text-xs text-gray-500 uppercase mb-1">Duration</div>
                <div className="text-sm text-white">{selectedNode.duration}ms</div>
              </div>
            )}

            {selectedNode.tokens && (
              <div>
                <div className="text-xs text-gray-500 uppercase mb-1">Tokens</div>
                <div className="text-sm text-white">
                  {selectedNode.tokens.input} in / {selectedNode.tokens.output} out
                </div>
              </div>
            )}

            {selectedNode.input && (
              <div>
                <div className="text-xs text-gray-500 uppercase mb-1">Input</div>
                <pre className="text-xs text-gray-300 bg-gray-800 p-2 rounded overflow-auto max-h-32">
                  {JSON.stringify(selectedNode.input, null, 2)}
                </pre>
              </div>
            )}

            {selectedNode.output && (
              <div>
                <div className="text-xs text-gray-500 uppercase mb-1">Output</div>
                <pre className="text-xs text-gray-300 bg-gray-800 p-2 rounded overflow-auto max-h-32">
                  {typeof selectedNode.output === 'string'
                    ? selectedNode.output
                    : JSON.stringify(selectedNode.output, null, 2)}
                </pre>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export default AgentObservability;
