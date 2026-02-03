/**
 * Health Prediction Component (PRD-231)
 *
 * Displays predicted health scores for 30/60/90 days with confidence intervals,
 * key drivers, and recommended interventions.
 */

import React, { useState, useEffect, useCallback } from 'react';

// ============================================================================
// Types
// ============================================================================

interface PredictionPoint {
  daysAhead: number;
  predictedScore: number;
  confidenceInterval: { low: number; high: number };
  keyFactors: string[];
}

interface Driver {
  factor: string;
  direction: 'positive' | 'negative';
  magnitude: number;
  description: string;
}

interface InterventionImpact {
  intervention: string;
  description: string;
  expectedHealthImpact: number;
  confidence: number;
  timeToImpactDays: number;
  effort: 'low' | 'medium' | 'high';
}

interface AccuracyMetrics {
  accuracy30d: number | null;
  accuracy60d: number | null;
  accuracy90d: number | null;
  totalPredictions: number;
}

interface HealthPrediction {
  id: string;
  customerId: string;
  customerName: string;
  currentHealth: number;
  predictions: PredictionPoint[];
  confidence: number;
  primaryDrivers: Driver[];
  interventions: InterventionImpact[];
  accuracyMetrics: AccuracyMetrics;
  predictedAt: string;
}

interface HealthPredictionPanelProps {
  customerId: string;
  customerName?: string;
  compact?: boolean;
  onScheduleIntervention?: (intervention: string) => void;
}

// ============================================================================
// API
// ============================================================================

const API_BASE = `${import.meta.env.VITE_API_URL || ''}/api`;

async function fetchHealthPrediction(customerId: string): Promise<HealthPrediction | null> {
  try {
    const response = await fetch(`${API_BASE}/health-prediction/${customerId}`);
    if (!response.ok) throw new Error('Failed to fetch prediction');
    const data = await response.json();
    return data.success ? data.data : null;
  } catch (error) {
    console.error('Error fetching health prediction:', error);
    return null;
  }
}

async function refreshPrediction(customerId: string): Promise<HealthPrediction | null> {
  try {
    const response = await fetch(`${API_BASE}/health-prediction/${customerId}/refresh`, {
      method: 'POST',
    });
    if (!response.ok) throw new Error('Failed to refresh prediction');
    const data = await response.json();
    return data.success ? data.data : null;
  } catch (error) {
    console.error('Error refreshing prediction:', error);
    return null;
  }
}

// ============================================================================
// Helper Functions
// ============================================================================

function getHealthColor(score: number): string {
  if (score >= 80) return 'text-green-400';
  if (score >= 60) return 'text-yellow-400';
  if (score >= 40) return 'text-orange-400';
  return 'text-red-400';
}

function getHealthBgColor(score: number): string {
  if (score >= 80) return 'bg-green-500';
  if (score >= 60) return 'bg-yellow-500';
  if (score >= 40) return 'bg-orange-500';
  return 'bg-red-500';
}

function getHealthLabel(score: number): string {
  if (score >= 80) return 'Excellent';
  if (score >= 60) return 'Healthy';
  if (score >= 40) return 'At Risk';
  return 'Critical';
}

function getEffortColor(effort: string): string {
  switch (effort) {
    case 'low': return 'text-green-400 bg-green-500/20';
    case 'medium': return 'text-yellow-400 bg-yellow-500/20';
    case 'high': return 'text-red-400 bg-red-500/20';
    default: return 'text-gray-400 bg-gray-500/20';
  }
}

function getEffortLabel(effort: string): string {
  switch (effort) {
    case 'low': return 'Low Effort';
    case 'medium': return 'Medium Effort';
    case 'high': return 'High Effort';
    default: return effort;
  }
}

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

// ============================================================================
// Sub-Components
// ============================================================================

/**
 * Trajectory Chart - Shows predicted health over time with confidence intervals
 */
const TrajectoryChart: React.FC<{
  currentHealth: number;
  predictions: PredictionPoint[];
}> = ({ currentHealth, predictions }) => {
  const width = 400;
  const height = 180;
  const padding = { top: 20, right: 20, bottom: 40, left: 40 };
  const chartWidth = width - padding.left - padding.right;
  const chartHeight = height - padding.top - padding.bottom;

  // Create data points: Now, 30d, 60d, 90d
  const allPoints = [
    { days: 0, score: currentHealth, low: currentHealth, high: currentHealth },
    ...predictions.map(p => ({
      days: p.daysAhead,
      score: p.predictedScore,
      low: p.confidenceInterval.low,
      high: p.confidenceInterval.high,
    })),
  ];

  // Scale functions
  const xScale = (days: number) => padding.left + (days / 90) * chartWidth;
  const yScale = (score: number) => padding.top + ((100 - score) / 100) * chartHeight;

  // Create path for main line
  const linePath = allPoints.map((p, i) =>
    `${i === 0 ? 'M' : 'L'} ${xScale(p.days)} ${yScale(p.score)}`
  ).join(' ');

  // Create path for confidence area
  const areaPath = [
    ...allPoints.map(p => `${xScale(p.days)} ${yScale(p.high)}`),
    ...allPoints.slice().reverse().map(p => `${xScale(p.days)} ${yScale(p.low)}`),
  ].join(' L ');

  return (
    <svg width={width} height={height} className="w-full">
      {/* Grid lines */}
      {[0, 25, 50, 75, 100].map(score => (
        <g key={score}>
          <line
            x1={padding.left}
            y1={yScale(score)}
            x2={width - padding.right}
            y2={yScale(score)}
            stroke="#333"
            strokeDasharray={score === 50 ? '4,4' : '0'}
          />
          <text
            x={padding.left - 8}
            y={yScale(score)}
            textAnchor="end"
            alignmentBaseline="middle"
            className="text-xs fill-gray-500"
          >
            {score}
          </text>
        </g>
      ))}

      {/* X-axis labels */}
      {[0, 30, 60, 90].map(days => (
        <text
          key={days}
          x={xScale(days)}
          y={height - 10}
          textAnchor="middle"
          className="text-xs fill-gray-500"
        >
          {days === 0 ? 'Now' : `${days}d`}
        </text>
      ))}

      {/* Confidence area */}
      <path
        d={`M ${areaPath} Z`}
        fill="rgba(230, 57, 70, 0.15)"
      />

      {/* Main prediction line */}
      <path
        d={linePath}
        fill="none"
        stroke="#e63946"
        strokeWidth="2"
      />

      {/* Data points */}
      {allPoints.map((p, i) => (
        <g key={i}>
          {/* Confidence range line */}
          {i > 0 && (
            <line
              x1={xScale(p.days)}
              y1={yScale(p.low)}
              x2={xScale(p.days)}
              y2={yScale(p.high)}
              stroke="#e63946"
              strokeWidth="2"
              opacity="0.5"
            />
          )}
          {/* Main point */}
          <circle
            cx={xScale(p.days)}
            cy={yScale(p.score)}
            r="6"
            fill={p.score >= 60 ? '#22c55e' : p.score >= 40 ? '#eab308' : '#ef4444'}
            stroke="#1a1a1a"
            strokeWidth="2"
          />
          {/* Score label */}
          <text
            x={xScale(p.days)}
            y={yScale(p.score) - 12}
            textAnchor="middle"
            className="text-xs font-bold fill-white"
          >
            {p.score}
          </text>
        </g>
      ))}

      {/* Legend */}
      <g transform={`translate(${width - 120}, 10)`}>
        <line x1="0" y1="6" x2="20" y2="6" stroke="#e63946" strokeWidth="2" />
        <text x="24" y="10" className="text-xs fill-gray-400">Predicted</text>
        <rect x="0" y="18" width="20" height="8" fill="rgba(230, 57, 70, 0.3)" />
        <text x="24" y="26" className="text-xs fill-gray-400">Confidence</text>
      </g>
    </svg>
  );
};

/**
 * Driver Card - Shows a key factor affecting health prediction
 */
const DriverCard: React.FC<{ driver: Driver }> = ({ driver }) => {
  const isNegative = driver.direction === 'negative';

  return (
    <div className={`flex items-center gap-3 p-3 rounded-lg border ${
      isNegative
        ? 'border-red-500/30 bg-red-500/10'
        : 'border-green-500/30 bg-green-500/10'
    }`}>
      <div className={`w-8 h-8 rounded-full flex items-center justify-center ${
        isNegative ? 'bg-red-500/20' : 'bg-green-500/20'
      }`}>
        <span className={`text-lg ${isNegative ? 'text-red-400' : 'text-green-400'}`}>
          {isNegative ? '\u2193' : '\u2191'}
        </span>
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm text-white">{driver.description}</p>
      </div>
      <div className={`text-sm font-bold ${isNegative ? 'text-red-400' : 'text-green-400'}`}>
        {isNegative ? '-' : '+'}{driver.magnitude} pts
      </div>
    </div>
  );
};

/**
 * Intervention Card - Shows recommended action with impact
 */
const InterventionCard: React.FC<{
  intervention: InterventionImpact;
  onSchedule?: () => void;
}> = ({ intervention, onSchedule }) => {
  return (
    <div className="p-4 border border-gray-700 rounded-lg bg-gray-800/50 hover:border-gray-600 transition-colors">
      <div className="flex items-start justify-between mb-2">
        <h4 className="text-white font-medium">{intervention.intervention}</h4>
        <span className={`text-xs px-2 py-0.5 rounded ${getEffortColor(intervention.effort)}`}>
          {getEffortLabel(intervention.effort)}
        </span>
      </div>
      <p className="text-sm text-gray-400 mb-3">{intervention.description}</p>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4 text-sm">
          <span className="text-green-400 font-bold">+{intervention.expectedHealthImpact} pts</span>
          <span className="text-gray-500">{intervention.timeToImpactDays}d to impact</span>
          <span className="text-gray-500">{Math.round(intervention.confidence * 100)}% confidence</span>
        </div>
        {onSchedule && (
          <button
            onClick={onSchedule}
            className="px-3 py-1 text-xs bg-cscx-accent hover:bg-cscx-accent/80 text-white rounded transition-colors"
          >
            Schedule Now
          </button>
        )}
      </div>
    </div>
  );
};

/**
 * Accuracy Metrics Display
 */
const AccuracyDisplay: React.FC<{ metrics: AccuracyMetrics }> = ({ metrics }) => {
  const hasData = metrics.totalPredictions > 0;

  if (!hasData) {
    return (
      <p className="text-sm text-gray-500 italic">
        Accuracy data will be available after predictions are verified
      </p>
    );
  }

  return (
    <div className="flex items-center gap-4 text-sm">
      {metrics.accuracy30d !== null && (
        <span className="text-gray-400">
          30d: <span className="text-white font-medium">{metrics.accuracy30d}%</span>
        </span>
      )}
      {metrics.accuracy60d !== null && (
        <span className="text-gray-400">
          60d: <span className="text-white font-medium">{metrics.accuracy60d}%</span>
        </span>
      )}
      {metrics.accuracy90d !== null && (
        <span className="text-gray-400">
          90d: <span className="text-white font-medium">{metrics.accuracy90d}%</span>
        </span>
      )}
    </div>
  );
};

// ============================================================================
// Main Component
// ============================================================================

export const HealthPredictionPanel: React.FC<HealthPredictionPanelProps> = ({
  customerId,
  customerName,
  compact = false,
  onScheduleIntervention,
}) => {
  const [prediction, setPrediction] = useState<HealthPrediction | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedInterventions, setSelectedInterventions] = useState<string[]>([]);

  const loadData = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const data = await fetchHealthPrediction(customerId);
      if (data) {
        setPrediction(data);
      } else {
        setError('No prediction data available');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load prediction');
    } finally {
      setLoading(false);
    }
  }, [customerId]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleRefresh = async () => {
    setRefreshing(true);
    try {
      const data = await refreshPrediction(customerId);
      if (data) {
        setPrediction(data);
      }
    } catch (err) {
      console.error('Error refreshing:', err);
    } finally {
      setRefreshing(false);
    }
  };

  const toggleIntervention = (name: string) => {
    setSelectedInterventions(prev =>
      prev.includes(name)
        ? prev.filter(i => i !== name)
        : [...prev, name]
    );
  };

  // Calculate total impact of selected interventions
  const totalImpact = prediction?.interventions
    .filter(i => selectedInterventions.includes(i.intervention))
    .reduce((sum, i) => sum + i.expectedHealthImpact, 0) || 0;

  // Loading state
  if (loading) {
    return (
      <div className="bg-gray-900 border border-gray-800 rounded-xl p-6">
        <div className="flex items-center justify-center py-8">
          <div className="animate-spin w-6 h-6 border-2 border-cscx-accent border-t-transparent rounded-full" />
          <span className="ml-2 text-gray-400">Generating prediction...</span>
        </div>
      </div>
    );
  }

  // Error state
  if (error && !prediction) {
    return (
      <div className="bg-gray-900 border border-gray-800 rounded-xl p-6">
        <div className="text-center py-4">
          <p className="text-red-400">{error}</p>
          <button
            onClick={loadData}
            className="mt-2 text-sm text-cscx-accent hover:underline"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  if (!prediction) {
    return null;
  }

  // Get prediction for 90 days
  const pred90 = prediction.predictions.find(p => p.daysAhead === 90);
  const change90d = pred90 ? pred90.predictedScore - prediction.currentHealth : 0;

  // Compact view
  if (compact) {
    return (
      <div className="bg-gray-900 border border-gray-800 rounded-xl p-4">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-medium text-gray-400 uppercase tracking-wider">
            Health Forecast
          </h3>
          <span className={`text-xs px-2 py-0.5 rounded ${
            prediction.confidence >= 70
              ? 'bg-green-500/20 text-green-400'
              : 'bg-yellow-500/20 text-yellow-400'
          }`}>
            {prediction.confidence}% confidence
          </span>
        </div>

        <div className="flex items-center gap-4">
          <div className="text-center">
            <p className={`text-2xl font-bold ${getHealthColor(prediction.currentHealth)}`}>
              {prediction.currentHealth}
            </p>
            <p className="text-xs text-gray-500">Now</p>
          </div>
          <div className="flex-1 flex items-center justify-center">
            <span className={`text-lg ${change90d < 0 ? 'text-red-400' : 'text-green-400'}`}>
              {change90d < 0 ? '\u2192' : '\u2192'}
            </span>
          </div>
          <div className="text-center">
            <p className={`text-2xl font-bold ${pred90 ? getHealthColor(pred90.predictedScore) : 'text-gray-400'}`}>
              {pred90?.predictedScore || '-'}
            </p>
            <p className="text-xs text-gray-500">90d</p>
          </div>
        </div>

        {change90d < -10 && (
          <div className="mt-3 p-2 bg-red-500/10 border border-red-500/30 rounded-lg">
            <p className="text-xs text-red-400">
              Predicted decline of {Math.abs(change90d)} points - action recommended
            </p>
          </div>
        )}
      </div>
    );
  }

  // Full view
  return (
    <div className="bg-gray-900 border border-gray-800 rounded-xl p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold text-white">
            Health Forecast
            {customerName && <span className="text-gray-400 font-normal"> - {customerName}</span>}
          </h3>
          <p className="text-sm text-gray-500">
            Last updated: {formatDate(prediction.predictedAt)}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <span className={`text-xs px-2 py-1 rounded ${
            prediction.confidence >= 70
              ? 'bg-green-500/20 text-green-400'
              : prediction.confidence >= 50
              ? 'bg-yellow-500/20 text-yellow-400'
              : 'bg-red-500/20 text-red-400'
          }`}>
            {prediction.confidence}% confidence
          </span>
          <button
            onClick={handleRefresh}
            disabled={refreshing}
            className="text-sm text-gray-400 hover:text-white px-2 py-1 rounded hover:bg-gray-800 disabled:opacity-50"
          >
            {refreshing ? 'Refreshing...' : 'Refresh'}
          </button>
        </div>
      </div>

      {/* Trajectory Chart */}
      <div>
        <h4 className="text-sm font-medium text-gray-400 mb-3 uppercase tracking-wider">
          Predicted Trajectory
        </h4>
        <div className="bg-gray-800/50 rounded-lg p-4">
          <TrajectoryChart
            currentHealth={prediction.currentHealth}
            predictions={prediction.predictions}
          />
        </div>
      </div>

      {/* Key Drivers */}
      <div>
        <h4 className="text-sm font-medium text-gray-400 mb-3 uppercase tracking-wider">
          Key Drivers
        </h4>
        <div className="space-y-2">
          {prediction.primaryDrivers.length > 0 ? (
            prediction.primaryDrivers.map((driver, idx) => (
              <DriverCard key={idx} driver={driver} />
            ))
          ) : (
            <p className="text-sm text-gray-500 italic">No significant drivers identified</p>
          )}
        </div>
      </div>

      {/* Recommended Interventions */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h4 className="text-sm font-medium text-gray-400 uppercase tracking-wider">
            Recommended Interventions
          </h4>
          {selectedInterventions.length > 0 && (
            <span className="text-sm text-green-400">
              Selected: +{totalImpact} pts impact
            </span>
          )}
        </div>
        <div className="space-y-3">
          {prediction.interventions.length > 0 ? (
            prediction.interventions.map((intervention, idx) => (
              <div key={idx} className="relative">
                <div className="absolute left-2 top-2 z-10">
                  <input
                    type="checkbox"
                    checked={selectedInterventions.includes(intervention.intervention)}
                    onChange={() => toggleIntervention(intervention.intervention)}
                    className="w-4 h-4 rounded border-gray-600 bg-gray-700 text-cscx-accent focus:ring-cscx-accent"
                  />
                </div>
                <div className="pl-8">
                  <InterventionCard
                    intervention={intervention}
                    onSchedule={
                      onScheduleIntervention
                        ? () => onScheduleIntervention(intervention.intervention)
                        : undefined
                    }
                  />
                </div>
              </div>
            ))
          ) : (
            <p className="text-sm text-gray-500 italic">No interventions recommended at this time</p>
          )}
        </div>

        {/* Impact Summary */}
        {selectedInterventions.length > 0 && pred90 && (
          <div className="mt-4 p-4 border border-green-500/30 bg-green-500/10 rounded-lg">
            <p className="text-sm text-green-400">
              With selected interventions, predicted 90-day health score could improve from{' '}
              <span className="font-bold">{pred90.predictedScore}</span> to{' '}
              <span className="font-bold">{Math.min(100, pred90.predictedScore + totalImpact)}</span>
            </p>
          </div>
        )}
      </div>

      {/* Prediction Accuracy */}
      <div className="pt-4 border-t border-gray-800">
        <h4 className="text-sm font-medium text-gray-400 mb-2 uppercase tracking-wider">
          Prediction Accuracy
        </h4>
        <AccuracyDisplay metrics={prediction.accuracyMetrics} />
      </div>
    </div>
  );
};

export default HealthPredictionPanel;
