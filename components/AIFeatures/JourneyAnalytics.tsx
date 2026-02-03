/**
 * Journey Analytics Component
 * PRD-237: Customer Journey Optimization
 *
 * AI-powered journey analysis with friction detection, optimization recommendations,
 * and projected impact visualization.
 */

import React, { useState, useEffect, useCallback } from 'react';

const API_BASE = `${import.meta.env.VITE_API_URL || ''}/api`;

// ============================================
// TYPES
// ============================================

interface JourneyStageMetrics {
  stage: string;
  avgDurationDays: number;
  targetDurationDays: number;
  successRate: number;
  customersInStage: number;
  stallRate: number;
  topFrictionPoints: string[];
}

interface FrictionPoint {
  id: string;
  stage: string;
  frictionType: string;
  title: string;
  description: string;
  occurrenceRate: number;
  avgDelayDays: number;
  impactScore: number;
  rootCause: string;
  recommendations: string[];
  affectedCustomers: number;
  arrAtRisk: number;
}

interface OptimalPath {
  stages: Array<{
    name: string;
    targetDay: number;
    keyMilestones: string[];
    successIndicators: string[];
  }>;
  totalDays: number;
  description: string;
}

interface Intervention {
  id: string;
  frictionPointId: string;
  intervention: string;
  description: string;
  expectedImpact: {
    timeReduction: number;
    retentionImprovement: number;
    npsImprovement: number;
  };
  effort: 'low' | 'medium' | 'high';
  priority: 'critical' | 'high' | 'medium' | 'low';
  category: string;
  implementationSteps: string[];
}

interface JourneyOptimizationAnalysis {
  segmentName: string;
  analyzedAt: string;
  customersAnalyzed: number;
  currentPerformance: {
    avgTimeToValue: number;
    targetTimeToValue: number;
    gap: number;
    gapPercentage: number;
  };
  stageMetrics: JourneyStageMetrics[];
  frictionPoints: FrictionPoint[];
  optimalPath: OptimalPath;
  interventions: Intervention[];
  projectedImpact: {
    timeToValueReduction: number;
    retentionImprovement: number;
    npsImprovement: number;
  };
  cohortComparison: {
    bestPerforming: {
      segment: string;
      avgTimeToValue: number;
      characteristics: string[];
    };
    worstPerforming: {
      segment: string;
      avgTimeToValue: number;
      issues: string[];
    };
  };
  executiveSummary: string;
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

const getSeverityColor = (score: number): string => {
  if (score >= 70) return 'text-red-400';
  if (score >= 50) return 'text-yellow-400';
  return 'text-green-400';
};

const getSeverityBgColor = (score: number): string => {
  if (score >= 70) return 'bg-red-500/20 border-red-500/30';
  if (score >= 50) return 'bg-yellow-500/20 border-yellow-500/30';
  return 'bg-green-500/20 border-green-500/30';
};

const getPriorityColor = (priority: string): string => {
  switch (priority) {
    case 'critical': return 'text-red-400 bg-red-500/20';
    case 'high': return 'text-orange-400 bg-orange-500/20';
    case 'medium': return 'text-yellow-400 bg-yellow-500/20';
    case 'low': return 'text-green-400 bg-green-500/20';
    default: return 'text-gray-400 bg-gray-500/20';
  }
};

const getEffortColor = (effort: string): string => {
  switch (effort) {
    case 'low': return 'text-green-400';
    case 'medium': return 'text-yellow-400';
    case 'high': return 'text-red-400';
    default: return 'text-gray-400';
  }
};

const formatStageName = (stage: string): string => {
  return stage.charAt(0).toUpperCase() + stage.slice(1).replace(/_/g, ' ');
};

// ============================================
// MAIN COMPONENT
// ============================================

interface JourneyAnalyticsProps {
  segment?: string;
  onSelectCustomer?: (customerId: string) => void;
}

export const JourneyAnalytics: React.FC<JourneyAnalyticsProps> = ({
  segment,
  onSelectCustomer
}) => {
  const [data, setData] = useState<JourneyOptimizationAnalysis | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'overview' | 'friction' | 'interventions' | 'path'>('overview');
  const [selectedFriction, setSelectedFriction] = useState<FrictionPoint | null>(null);
  const [simulationChanges, setSimulationChanges] = useState<string[]>([]);
  const [simulationResult, setSimulationResult] = useState<any>(null);
  const [simulating, setSimulating] = useState(false);

  // Fetch optimization data
  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (segment) params.append('segment', segment);

      const response = await fetch(`${API_BASE}/analytics/journey/optimization?${params}`);
      if (!response.ok) throw new Error('Failed to fetch journey analysis');

      const result = await response.json();
      setData(result.data);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load data');
    } finally {
      setLoading(false);
    }
  }, [segment]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Simulate changes
  const runSimulation = async () => {
    if (simulationChanges.length === 0) return;

    setSimulating(true);
    try {
      const response = await fetch(`${API_BASE}/analytics/journey/simulate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ proposedChanges: simulationChanges, segment })
      });

      if (!response.ok) throw new Error('Simulation failed');

      const result = await response.json();
      setSimulationResult(result.data);
    } catch (err) {
      console.error('Simulation error:', err);
    } finally {
      setSimulating(false);
    }
  };

  // Loading state
  if (loading && !data) {
    return (
      <div className="p-8 text-center text-cscx-gray-400">
        <div className="animate-spin w-8 h-8 border-2 border-cscx-accent border-t-transparent rounded-full mx-auto mb-4" />
        <p>Analyzing customer journeys...</p>
      </div>
    );
  }

  // Error state
  if (error && !data) {
    return (
      <div className="p-8 text-center text-red-400">
        <p>{error}</p>
        <button
          onClick={fetchData}
          className="mt-4 px-4 py-2 bg-cscx-gray-800 rounded-lg hover:bg-cscx-gray-700 text-white"
        >
          Try Again
        </button>
      </div>
    );
  }

  if (!data) return null;

  const { currentPerformance, stageMetrics, frictionPoints, optimalPath, interventions, projectedImpact, cohortComparison, executiveSummary } = data;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-white">Journey Optimization</h2>
          <p className="text-cscx-gray-400 text-sm mt-1">
            Analyzing {data.customersAnalyzed} customers | {data.segmentName}
          </p>
        </div>
        <button
          onClick={fetchData}
          disabled={loading}
          className="px-4 py-2 text-sm bg-cscx-gray-800 hover:bg-cscx-gray-700 text-white rounded-lg transition-colors flex items-center gap-2 disabled:opacity-50"
        >
          <svg className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
          </svg>
          Refresh
        </button>
      </div>

      {/* Executive Summary */}
      <div className="bg-gradient-to-r from-cscx-accent/10 to-cscx-gray-900 border border-cscx-accent/30 rounded-xl p-6">
        <h3 className="text-lg font-semibold text-white mb-2 flex items-center gap-2">
          <span className="text-cscx-accent">AI</span> Executive Summary
        </h3>
        <p className="text-cscx-gray-300">{executiveSummary}</p>
      </div>

      {/* Performance Overview Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {/* Current Time-to-Value */}
        <div className="bg-cscx-gray-900 border border-cscx-gray-800 rounded-xl p-4">
          <p className="text-xs text-cscx-gray-400 uppercase tracking-wider">Avg Time-to-Value</p>
          <p className="text-3xl font-bold text-white mt-1">{currentPerformance.avgTimeToValue} days</p>
          <p className="text-sm text-red-400 mt-1">
            +{currentPerformance.gap} days vs target ({currentPerformance.targetTimeToValue}d)
          </p>
        </div>

        {/* Gap Percentage */}
        <div className="bg-cscx-gray-900 border border-cscx-gray-800 rounded-xl p-4">
          <p className="text-xs text-cscx-gray-400 uppercase tracking-wider">Gap from Target</p>
          <p className="text-3xl font-bold text-red-400 mt-1">+{currentPerformance.gapPercentage}%</p>
          <p className="text-sm text-cscx-gray-400 mt-1">longer than optimal</p>
        </div>

        {/* Friction Points */}
        <div className="bg-cscx-gray-900 border border-cscx-gray-800 rounded-xl p-4">
          <p className="text-xs text-cscx-gray-400 uppercase tracking-wider">Friction Points</p>
          <p className="text-3xl font-bold text-yellow-400 mt-1">{frictionPoints.length}</p>
          <p className="text-sm text-cscx-gray-400 mt-1">identified issues</p>
        </div>

        {/* Projected Improvement */}
        <div className="bg-cscx-gray-900 border border-cscx-gray-800 rounded-xl p-4">
          <p className="text-xs text-cscx-gray-400 uppercase tracking-wider">Projected Improvement</p>
          <p className="text-3xl font-bold text-green-400 mt-1">-{projectedImpact.timeToValueReduction}d</p>
          <p className="text-sm text-cscx-gray-400 mt-1">+{projectedImpact.retentionImprovement}% retention</p>
        </div>
      </div>

      {/* Tab Navigation */}
      <div className="flex gap-1 p-1 bg-cscx-gray-900 rounded-lg w-fit">
        {(['overview', 'friction', 'interventions', 'path'] as const).map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-4 py-2 text-sm font-medium rounded-md transition-colors capitalize ${
              activeTab === tab
                ? 'bg-cscx-accent text-white'
                : 'text-cscx-gray-400 hover:text-white hover:bg-cscx-gray-800'
            }`}
          >
            {tab === 'path' ? 'Optimal Path' : tab}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      <div className="bg-cscx-gray-900 border border-cscx-gray-800 rounded-xl">
        {/* Overview Tab */}
        {activeTab === 'overview' && (
          <div className="p-6 space-y-6">
            {/* Stage Metrics */}
            <div>
              <h3 className="text-lg font-semibold text-white mb-4">Journey Stage Analysis</h3>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-cscx-gray-800">
                      <th className="text-left px-4 py-3 text-cscx-gray-400 font-medium">Stage</th>
                      <th className="text-left px-4 py-3 text-cscx-gray-400 font-medium">Avg Duration</th>
                      <th className="text-left px-4 py-3 text-cscx-gray-400 font-medium">Target</th>
                      <th className="text-left px-4 py-3 text-cscx-gray-400 font-medium">Customers</th>
                      <th className="text-left px-4 py-3 text-cscx-gray-400 font-medium">Stall Rate</th>
                      <th className="text-left px-4 py-3 text-cscx-gray-400 font-medium">Success Rate</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-cscx-gray-800">
                    {stageMetrics.map((stage) => (
                      <tr key={stage.stage} className="hover:bg-cscx-gray-800/30">
                        <td className="px-4 py-3 text-white font-medium">{formatStageName(stage.stage)}</td>
                        <td className="px-4 py-3">
                          <span className={stage.avgDurationDays > stage.targetDurationDays ? 'text-red-400' : 'text-green-400'}>
                            {stage.avgDurationDays} days
                          </span>
                        </td>
                        <td className="px-4 py-3 text-cscx-gray-400">{stage.targetDurationDays} days</td>
                        <td className="px-4 py-3 text-white">{stage.customersInStage}</td>
                        <td className="px-4 py-3">
                          <span className={stage.stallRate > 20 ? 'text-red-400' : stage.stallRate > 10 ? 'text-yellow-400' : 'text-green-400'}>
                            {stage.stallRate}%
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <span className={stage.successRate >= 80 ? 'text-green-400' : stage.successRate >= 60 ? 'text-yellow-400' : 'text-red-400'}>
                            {stage.successRate}%
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Cohort Comparison */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="bg-green-500/10 border border-green-500/30 rounded-lg p-4">
                <h4 className="text-green-400 font-semibold mb-2 flex items-center gap-2">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z" />
                  </svg>
                  Best Performing: {cohortComparison.bestPerforming.segment}
                </h4>
                <p className="text-2xl font-bold text-white">{cohortComparison.bestPerforming.avgTimeToValue} days</p>
                <ul className="mt-2 space-y-1">
                  {cohortComparison.bestPerforming.characteristics.map((char, i) => (
                    <li key={i} className="text-sm text-cscx-gray-300 flex items-center gap-2">
                      <span className="text-green-400">+</span> {char}
                    </li>
                  ))}
                </ul>
              </div>

              <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-4">
                <h4 className="text-red-400 font-semibold mb-2 flex items-center gap-2">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                  </svg>
                  Needs Improvement: {cohortComparison.worstPerforming.segment}
                </h4>
                <p className="text-2xl font-bold text-white">{cohortComparison.worstPerforming.avgTimeToValue} days</p>
                <ul className="mt-2 space-y-1">
                  {cohortComparison.worstPerforming.issues.map((issue, i) => (
                    <li key={i} className="text-sm text-cscx-gray-300 flex items-center gap-2">
                      <span className="text-red-400">-</span> {issue}
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </div>
        )}

        {/* Friction Tab */}
        {activeTab === 'friction' && (
          <div className="p-6 space-y-4">
            <h3 className="text-lg font-semibold text-white">Friction Points Identified</h3>
            {frictionPoints.length === 0 ? (
              <p className="text-cscx-gray-400 text-center py-8">No significant friction points detected.</p>
            ) : (
              <div className="space-y-4">
                {frictionPoints.map((friction) => (
                  <div
                    key={friction.id}
                    onClick={() => setSelectedFriction(selectedFriction?.id === friction.id ? null : friction)}
                    className={`border rounded-lg p-4 cursor-pointer transition-all ${getSeverityBgColor(friction.impactScore)}`}
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-3">
                          <span className={`text-lg font-bold ${getSeverityColor(friction.impactScore)}`}>
                            {friction.impactScore}
                          </span>
                          <div>
                            <h4 className="text-white font-semibold">{friction.title}</h4>
                            <p className="text-sm text-cscx-gray-400">
                              {formatStageName(friction.stage)} | {friction.frictionType.replace(/_/g, ' ')}
                            </p>
                          </div>
                        </div>
                        <p className="mt-2 text-cscx-gray-300 text-sm">{friction.description}</p>

                        <div className="flex items-center gap-4 mt-3 text-sm">
                          <span className="text-red-400">
                            {friction.affectedCustomers} customers affected
                          </span>
                          <span className="text-yellow-400">
                            +{friction.avgDelayDays} days delay
                          </span>
                          <span className="text-cscx-gray-400">
                            {formatCurrency(friction.arrAtRisk)} ARR at risk
                          </span>
                        </div>
                      </div>
                      <svg
                        className={`w-5 h-5 text-cscx-gray-400 transition-transform ${selectedFriction?.id === friction.id ? 'rotate-180' : ''}`}
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                      </svg>
                    </div>

                    {/* Expanded details */}
                    {selectedFriction?.id === friction.id && (
                      <div className="mt-4 pt-4 border-t border-cscx-gray-700 space-y-3">
                        <div>
                          <p className="text-sm text-cscx-gray-400">Root Cause</p>
                          <p className="text-white">{friction.rootCause}</p>
                        </div>
                        <div>
                          <p className="text-sm text-cscx-gray-400 mb-2">Recommendations</p>
                          <ul className="space-y-1">
                            {friction.recommendations.map((rec, i) => (
                              <li key={i} className="text-sm text-cscx-gray-300 flex items-center gap-2">
                                <span className="text-cscx-accent">-</span> {rec}
                              </li>
                            ))}
                          </ul>
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Interventions Tab */}
        {activeTab === 'interventions' && (
          <div className="p-6 space-y-6">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold text-white">Recommended Interventions</h3>
              <div className="flex items-center gap-2 text-sm text-cscx-gray-400">
                <span className="w-2 h-2 rounded-full bg-red-500"></span> Critical
                <span className="w-2 h-2 rounded-full bg-orange-500"></span> High
                <span className="w-2 h-2 rounded-full bg-yellow-500"></span> Medium
              </div>
            </div>

            {interventions.length === 0 ? (
              <p className="text-cscx-gray-400 text-center py-8">No interventions recommended.</p>
            ) : (
              <div className="space-y-4">
                {interventions.map((intervention, idx) => (
                  <div
                    key={intervention.id}
                    className="bg-cscx-gray-800/50 border border-cscx-gray-700 rounded-lg p-4"
                  >
                    <div className="flex items-start gap-4">
                      <div className="flex items-center justify-center w-8 h-8 rounded-full bg-cscx-gray-700 text-white font-bold">
                        {idx + 1}
                      </div>
                      <div className="flex-1">
                        <div className="flex items-center gap-3 mb-2">
                          <h4 className="text-white font-semibold">{intervention.intervention}</h4>
                          <span className={`px-2 py-0.5 text-xs font-medium rounded ${getPriorityColor(intervention.priority)}`}>
                            {intervention.priority}
                          </span>
                          <span className={`text-xs ${getEffortColor(intervention.effort)}`}>
                            {intervention.effort} effort
                          </span>
                        </div>
                        <p className="text-cscx-gray-300 text-sm">{intervention.description}</p>

                        <div className="flex items-center gap-6 mt-3 text-sm">
                          <span className="text-green-400">
                            -{intervention.expectedImpact.timeReduction}d time-to-value
                          </span>
                          <span className="text-blue-400">
                            +{intervention.expectedImpact.retentionImprovement}% retention
                          </span>
                          <span className="text-purple-400">
                            +{intervention.expectedImpact.npsImprovement} NPS
                          </span>
                        </div>

                        {intervention.implementationSteps.length > 0 && (
                          <div className="mt-3 pt-3 border-t border-cscx-gray-700">
                            <p className="text-xs text-cscx-gray-400 mb-2">Implementation Steps:</p>
                            <ol className="list-decimal list-inside space-y-1">
                              {intervention.implementationSteps.map((step, i) => (
                                <li key={i} className="text-sm text-cscx-gray-300">{step}</li>
                              ))}
                            </ol>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Simulation Section */}
            <div className="border-t border-cscx-gray-700 pt-6">
              <h4 className="text-white font-semibold mb-4 flex items-center gap-2">
                <svg className="w-5 h-5 text-cscx-accent" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                </svg>
                Simulate Changes
              </h4>
              <div className="space-y-3">
                <div className="flex flex-wrap gap-2">
                  {interventions.map((i) => (
                    <button
                      key={i.id}
                      onClick={() => {
                        const name = i.intervention;
                        if (simulationChanges.includes(name)) {
                          setSimulationChanges(simulationChanges.filter(c => c !== name));
                        } else {
                          setSimulationChanges([...simulationChanges, name]);
                        }
                      }}
                      className={`px-3 py-1.5 text-sm rounded-lg border transition-colors ${
                        simulationChanges.includes(i.intervention)
                          ? 'bg-cscx-accent border-cscx-accent text-white'
                          : 'bg-cscx-gray-800 border-cscx-gray-700 text-cscx-gray-300 hover:border-cscx-accent'
                      }`}
                    >
                      {i.intervention}
                    </button>
                  ))}
                </div>

                {simulationChanges.length > 0 && (
                  <button
                    onClick={runSimulation}
                    disabled={simulating}
                    className="px-4 py-2 bg-cscx-accent text-white rounded-lg hover:bg-cscx-accent/90 transition-colors disabled:opacity-50 flex items-center gap-2"
                  >
                    {simulating ? (
                      <>
                        <div className="animate-spin w-4 h-4 border-2 border-white border-t-transparent rounded-full" />
                        Simulating...
                      </>
                    ) : (
                      <>
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                        Run Simulation
                      </>
                    )}
                  </button>
                )}

                {simulationResult && (
                  <div className="bg-cscx-gray-800 border border-cscx-gray-700 rounded-lg p-4 mt-4">
                    <h5 className="text-white font-semibold mb-3">Simulation Results</h5>
                    <div className="grid grid-cols-3 gap-4 text-center">
                      <div>
                        <p className="text-2xl font-bold text-green-400">
                          {simulationResult.projectedOutcome.avgTimeToValue}d
                        </p>
                        <p className="text-xs text-cscx-gray-400">Projected Time-to-Value</p>
                      </div>
                      <div>
                        <p className="text-2xl font-bold text-cscx-accent">
                          -{simulationResult.projectedOutcome.timeReduction}d
                        </p>
                        <p className="text-xs text-cscx-gray-400">Time Reduction</p>
                      </div>
                      <div>
                        <p className="text-2xl font-bold text-blue-400">
                          {simulationResult.projectedOutcome.percentageImprovement}%
                        </p>
                        <p className="text-xs text-cscx-gray-400">Improvement</p>
                      </div>
                    </div>
                    <p className="mt-3 text-sm text-cscx-gray-400">
                      Implementation timeline: {simulationResult.implementationTimeline}
                    </p>
                    <p className="text-sm text-cscx-gray-400">
                      Confidence: {simulationResult.confidence}%
                    </p>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Optimal Path Tab */}
        {activeTab === 'path' && (
          <div className="p-6">
            <h3 className="text-lg font-semibold text-white mb-4">Optimal Journey Path</h3>
            <p className="text-cscx-gray-400 mb-6">{optimalPath.description}</p>

            {/* Journey Timeline */}
            <div className="relative">
              {/* Timeline line */}
              <div className="absolute top-8 left-0 right-0 h-1 bg-cscx-gray-700"></div>

              {/* Stages */}
              <div className="flex justify-between relative">
                {optimalPath.stages.map((stage, idx) => (
                  <div key={stage.name} className="flex flex-col items-center" style={{ width: `${100 / optimalPath.stages.length}%` }}>
                    {/* Marker */}
                    <div className="relative z-10">
                      <div className="w-16 h-16 rounded-full bg-cscx-gray-800 border-2 border-cscx-accent flex items-center justify-center">
                        <span className="text-white font-bold">Day {stage.targetDay}</span>
                      </div>
                    </div>

                    {/* Stage name */}
                    <h4 className="text-white font-semibold mt-4 text-center">{formatStageName(stage.name)}</h4>

                    {/* Milestones */}
                    <div className="mt-2 text-center">
                      <p className="text-xs text-cscx-gray-400 mb-1">Key Milestones:</p>
                      <ul className="text-xs text-cscx-gray-300 space-y-0.5">
                        {stage.keyMilestones.slice(0, 2).map((m, i) => (
                          <li key={i}>{m}</li>
                        ))}
                      </ul>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Total Days */}
            <div className="mt-8 text-center">
              <p className="text-cscx-gray-400">Total Journey Duration</p>
              <p className="text-4xl font-bold text-cscx-accent">{optimalPath.totalDays} days</p>
              <p className="text-sm text-green-400 mt-1">
                Current: {currentPerformance.avgTimeToValue} days | Savings: {currentPerformance.avgTimeToValue - optimalPath.totalDays} days
              </p>
            </div>

            {/* Stage Details Table */}
            <div className="mt-8">
              <h4 className="text-white font-semibold mb-4">Stage Success Indicators</h4>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {optimalPath.stages.map((stage) => (
                  <div key={stage.name} className="bg-cscx-gray-800 rounded-lg p-4">
                    <h5 className="text-cscx-accent font-medium mb-2">{formatStageName(stage.name)}</h5>
                    <ul className="space-y-1">
                      {stage.successIndicators.map((indicator, i) => (
                        <li key={i} className="text-sm text-cscx-gray-300 flex items-center gap-2">
                          <svg className="w-4 h-4 text-green-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                          </svg>
                          {indicator}
                        </li>
                      ))}
                    </ul>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Action Buttons */}
      <div className="flex justify-end gap-3">
        <button className="px-4 py-2 text-sm border border-cscx-gray-700 rounded-lg hover:bg-cscx-gray-800 text-white transition-colors">
          Export Analysis
        </button>
        <button className="px-4 py-2 text-sm bg-cscx-accent text-white rounded-lg hover:bg-cscx-accent/90 transition-colors flex items-center gap-2">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
          Generate Improvement Plan
        </button>
      </div>
    </div>
  );
};

export default JourneyAnalytics;
