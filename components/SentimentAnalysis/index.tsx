/**
 * Sentiment Analysis Component (PRD-218)
 *
 * Displays real-time sentiment analysis for customer communications.
 * Can be embedded in CustomerDetail or used standalone.
 */

import React, { useState, useEffect, useCallback } from 'react';

// ============================================================================
// Types
// ============================================================================

interface TopicSentiment {
  product: number | null;
  support: number | null;
  pricing: number | null;
  relationship: number | null;
}

interface RecentInteraction {
  source: 'email' | 'meeting' | 'support' | 'slack' | 'survey';
  score: number;
  date: string;
  snippet: string;
}

interface HistoricalData {
  date: string;
  score: number;
}

interface SentimentSummary {
  customer_id: string;
  current_score: number;
  trend: 'improving' | 'stable' | 'declining';
  change_7d: number;
  change_30d: number;
  topic_breakdown: TopicSentiment;
  recent_interactions: RecentInteraction[];
  historical_data: HistoricalData[];
}

interface SentimentAlert {
  id: string;
  customer_id: string;
  alert_type: string;
  alert_level: 'info' | 'warning' | 'critical';
  message: string;
  acknowledged_at?: string;
  created_at: string;
}

interface SentimentPanelProps {
  customerId: string;
  customerName?: string;
  compact?: boolean;
  showAlerts?: boolean;
  onAnalyzeText?: (text: string) => void;
}

// ============================================================================
// API
// ============================================================================

const API_BASE = `${import.meta.env.VITE_API_URL || ''}/api`;

async function fetchSentimentSummary(customerId: string): Promise<SentimentSummary | null> {
  try {
    const response = await fetch(`${API_BASE}/sentiment/customer/${customerId}`);
    if (!response.ok) throw new Error('Failed to fetch sentiment');
    return await response.json();
  } catch (error) {
    console.error('Error fetching sentiment:', error);
    return null;
  }
}

async function fetchSentimentAlerts(customerId: string, unacknowledgedOnly = true): Promise<SentimentAlert[]> {
  try {
    const url = `${API_BASE}/sentiment/customer/${customerId}/alerts?unacknowledged=${unacknowledgedOnly}`;
    const response = await fetch(url);
    if (!response.ok) throw new Error('Failed to fetch alerts');
    const data = await response.json();
    return data.alerts || [];
  } catch (error) {
    console.error('Error fetching alerts:', error);
    return [];
  }
}

async function acknowledgeAlert(alertId: string): Promise<boolean> {
  try {
    const response = await fetch(`${API_BASE}/sentiment/alerts/${alertId}/acknowledge`, {
      method: 'POST',
    });
    return response.ok;
  } catch (error) {
    console.error('Error acknowledging alert:', error);
    return false;
  }
}

// ============================================================================
// Helper Functions
// ============================================================================

function getSentimentColor(score: number): string {
  if (score >= 50) return 'text-green-400';
  if (score >= 20) return 'text-green-300';
  if (score >= 0) return 'text-yellow-400';
  if (score >= -30) return 'text-orange-400';
  return 'text-red-400';
}

function getSentimentBgColor(score: number): string {
  if (score >= 50) return 'bg-green-500';
  if (score >= 20) return 'bg-green-400';
  if (score >= 0) return 'bg-yellow-500';
  if (score >= -30) return 'bg-orange-500';
  return 'bg-red-500';
}

function getSentimentLabel(score: number): string {
  if (score >= 50) return 'Very Positive';
  if (score >= 20) return 'Positive';
  if (score >= 0) return 'Neutral';
  if (score >= -30) return 'Cautious';
  if (score >= -60) return 'Negative';
  return 'Critical';
}

function getTrendIcon(trend: string): string {
  switch (trend) {
    case 'improving': return '\u2197\ufe0f';
    case 'declining': return '\u2198\ufe0f';
    default: return '\u2794';
  }
}

function getTrendColor(trend: string): string {
  switch (trend) {
    case 'improving': return 'text-green-400';
    case 'declining': return 'text-red-400';
    default: return 'text-gray-400';
  }
}

function getSourceIcon(source: string): string {
  switch (source) {
    case 'email': return '\u2709\ufe0f';
    case 'meeting': return '\ud83d\udcc5';
    case 'support': return '\ud83c\udf9f\ufe0f';
    case 'slack': return '\ud83d\udcac';
    case 'survey': return '\ud83d\udcca';
    default: return '\ud83d\udcdd';
  }
}

function formatDate(dateStr: string): string {
  const date = new Date(dateStr);
  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
  });
}

function formatRelativeDate(dateStr: string): string {
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffDays === 0) return 'Today';
  if (diffDays === 1) return 'Yesterday';
  if (diffDays < 7) return `${diffDays}d ago`;
  return formatDate(dateStr);
}

// ============================================================================
// Components
// ============================================================================

/**
 * Sentiment Score Gauge
 */
const SentimentGauge: React.FC<{ score: number; size?: 'sm' | 'md' | 'lg' }> = ({
  score,
  size = 'md'
}) => {
  const sizes = {
    sm: { width: 80, strokeWidth: 8, fontSize: 'text-lg' },
    md: { width: 120, strokeWidth: 10, fontSize: 'text-2xl' },
    lg: { width: 160, strokeWidth: 12, fontSize: 'text-3xl' },
  };

  const { width, strokeWidth, fontSize } = sizes[size];
  const radius = (width - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;

  // Map score from [-100, 100] to [0, 1]
  const normalizedScore = (score + 100) / 200;
  const strokeDashoffset = circumference * (1 - normalizedScore);

  return (
    <div className="relative" style={{ width, height: width }}>
      <svg
        className="transform -rotate-90"
        width={width}
        height={width}
      >
        {/* Background circle */}
        <circle
          cx={width / 2}
          cy={width / 2}
          r={radius}
          fill="none"
          stroke="#333"
          strokeWidth={strokeWidth}
        />
        {/* Score arc */}
        <circle
          cx={width / 2}
          cy={width / 2}
          r={radius}
          fill="none"
          stroke={score >= 0 ? (score >= 50 ? '#22c55e' : '#eab308') : (score >= -50 ? '#f97316' : '#ef4444')}
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={strokeDashoffset}
          style={{ transition: 'stroke-dashoffset 0.5s ease-in-out' }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className={`font-bold ${fontSize} ${getSentimentColor(score)}`}>
          {score > 0 ? '+' : ''}{score}
        </span>
        <span className="text-xs text-gray-400">{getSentimentLabel(score)}</span>
      </div>
    </div>
  );
};

/**
 * Topic Sentiment Bars
 */
const TopicSentimentBars: React.FC<{ topics: TopicSentiment }> = ({ topics }) => {
  const topicLabels: Record<keyof TopicSentiment, string> = {
    product: 'Product',
    support: 'Support',
    pricing: 'Pricing',
    relationship: 'Relationship',
  };

  const entries = Object.entries(topics).filter(([_, value]) => value !== null) as [keyof TopicSentiment, number][];

  if (entries.length === 0) {
    return (
      <p className="text-sm text-gray-500 italic">No topic-level data yet</p>
    );
  }

  return (
    <div className="space-y-3">
      {entries.map(([key, value]) => (
        <div key={key}>
          <div className="flex justify-between text-sm mb-1">
            <span className="text-gray-400">{topicLabels[key]}</span>
            <span className={getSentimentColor(value)}>{value > 0 ? '+' : ''}{value}</span>
          </div>
          <div className="h-2 bg-gray-800 rounded-full overflow-hidden">
            {/* Center line at 0 */}
            <div className="relative h-full">
              <div className="absolute left-1/2 w-px h-full bg-gray-600" />
              {/* Sentiment bar */}
              <div
                className={`absolute h-full ${value >= 0 ? 'left-1/2' : 'right-1/2'} ${getSentimentBgColor(value)}`}
                style={{
                  width: `${Math.abs(value) / 2}%`,
                  transition: 'width 0.3s ease-in-out',
                }}
              />
            </div>
          </div>
        </div>
      ))}
    </div>
  );
};

/**
 * Recent Interactions List
 */
const RecentInteractionsList: React.FC<{ interactions: RecentInteraction[] }> = ({ interactions }) => {
  if (interactions.length === 0) {
    return (
      <p className="text-sm text-gray-500 italic text-center py-4">
        No recent interactions analyzed
      </p>
    );
  }

  return (
    <div className="space-y-2">
      {interactions.map((interaction, idx) => (
        <div
          key={idx}
          className="flex items-center gap-3 p-2 bg-gray-800/50 rounded-lg"
        >
          <span className="text-lg">{getSourceIcon(interaction.source)}</span>
          <div className="flex-1 min-w-0">
            <p className="text-sm text-white truncate">{interaction.snippet}</p>
            <p className="text-xs text-gray-500">{formatRelativeDate(interaction.date)}</p>
          </div>
          <span className={`text-sm font-medium ${getSentimentColor(interaction.score)}`}>
            {interaction.score > 0 ? '+' : ''}{interaction.score}
          </span>
        </div>
      ))}
    </div>
  );
};

/**
 * Sentiment Alert Card
 */
const AlertCard: React.FC<{
  alert: SentimentAlert;
  onAcknowledge: (id: string) => void;
}> = ({ alert, onAcknowledge }) => {
  const levelStyles: Record<string, string> = {
    info: 'border-blue-500/30 bg-blue-500/10',
    warning: 'border-yellow-500/30 bg-yellow-500/10',
    critical: 'border-red-500/30 bg-red-500/10',
  };

  const levelIcons: Record<string, string> = {
    info: '\u2139\ufe0f',
    warning: '\u26a0\ufe0f',
    critical: '\ud83d\udea8',
  };

  return (
    <div className={`p-3 rounded-lg border ${levelStyles[alert.alert_level]}`}>
      <div className="flex items-start gap-2">
        <span className="text-lg">{levelIcons[alert.alert_level]}</span>
        <div className="flex-1">
          <p className="text-sm text-white">{alert.message}</p>
          <p className="text-xs text-gray-500 mt-1">{formatRelativeDate(alert.created_at)}</p>
        </div>
        {!alert.acknowledged_at && (
          <button
            onClick={() => onAcknowledge(alert.id)}
            className="text-xs text-gray-400 hover:text-white px-2 py-1 rounded hover:bg-gray-700"
          >
            Dismiss
          </button>
        )}
      </div>
    </div>
  );
};

/**
 * Historical Trend Chart (Simple SVG)
 */
const TrendChart: React.FC<{ data: HistoricalData[] }> = ({ data }) => {
  if (data.length < 2) {
    return (
      <p className="text-sm text-gray-500 italic text-center py-4">
        Insufficient data for trend chart
      </p>
    );
  }

  const width = 280;
  const height = 80;
  const padding = 10;

  // Map scores to y coordinates
  const minScore = Math.min(...data.map(d => d.score), -50);
  const maxScore = Math.max(...data.map(d => d.score), 50);
  const scoreRange = maxScore - minScore || 100;

  const points = data.map((d, i) => {
    const x = padding + (i / (data.length - 1)) * (width - 2 * padding);
    const y = height - padding - ((d.score - minScore) / scoreRange) * (height - 2 * padding);
    return `${x},${y}`;
  }).join(' ');

  // Zero line position
  const zeroY = height - padding - ((0 - minScore) / scoreRange) * (height - 2 * padding);

  return (
    <svg width={width} height={height} className="w-full">
      {/* Zero line */}
      <line
        x1={padding}
        y1={zeroY}
        x2={width - padding}
        y2={zeroY}
        stroke="#444"
        strokeDasharray="4,4"
      />
      {/* Trend line */}
      <polyline
        fill="none"
        stroke="#e63946"
        strokeWidth="2"
        points={points}
      />
      {/* Data points */}
      {data.map((d, i) => {
        const x = padding + (i / (data.length - 1)) * (width - 2 * padding);
        const y = height - padding - ((d.score - minScore) / scoreRange) * (height - 2 * padding);
        return (
          <circle
            key={i}
            cx={x}
            cy={y}
            r="4"
            fill={d.score >= 0 ? '#22c55e' : '#ef4444'}
          />
        );
      })}
    </svg>
  );
};

// ============================================================================
// Main Component
// ============================================================================

export const SentimentPanel: React.FC<SentimentPanelProps> = ({
  customerId,
  customerName,
  compact = false,
  showAlerts = true,
}) => {
  const [summary, setSummary] = useState<SentimentSummary | null>(null);
  const [alerts, setAlerts] = useState<SentimentAlert[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const [sentimentData, alertsData] = await Promise.all([
        fetchSentimentSummary(customerId),
        showAlerts ? fetchSentimentAlerts(customerId) : Promise.resolve([]),
      ]);

      if (sentimentData) {
        setSummary(sentimentData);
      }
      setAlerts(alertsData);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load sentiment data');
    } finally {
      setLoading(false);
    }
  }, [customerId, showAlerts]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleAcknowledgeAlert = async (alertId: string) => {
    const success = await acknowledgeAlert(alertId);
    if (success) {
      setAlerts(prev => prev.filter(a => a.id !== alertId));
    }
  };

  if (loading) {
    return (
      <div className="bg-gray-900 border border-gray-800 rounded-xl p-6">
        <div className="flex items-center justify-center py-8">
          <div className="animate-spin w-6 h-6 border-2 border-red-500 border-t-transparent rounded-full" />
          <span className="ml-2 text-gray-400">Loading sentiment data...</span>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-gray-900 border border-gray-800 rounded-xl p-6">
        <div className="text-center py-4">
          <p className="text-red-400">{error}</p>
          <button
            onClick={loadData}
            className="mt-2 text-sm text-red-500 hover:underline"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  if (!summary) {
    return (
      <div className="bg-gray-900 border border-gray-800 rounded-xl p-6">
        <h3 className="text-lg font-semibold text-white mb-4">Sentiment Analysis</h3>
        <p className="text-sm text-gray-500 text-center py-4">
          No sentiment data available for this customer yet.
          <br />
          Sentiment will be analyzed as communications are processed.
        </p>
      </div>
    );
  }

  // Compact view for sidebar
  if (compact) {
    return (
      <div className="bg-gray-900 border border-gray-800 rounded-xl p-4">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-medium text-gray-400 uppercase tracking-wider">
            Sentiment
          </h3>
          <span className={`text-xs ${getTrendColor(summary.trend)}`}>
            {getTrendIcon(summary.trend)} {summary.trend}
          </span>
        </div>

        <div className="flex items-center gap-4">
          <SentimentGauge score={summary.current_score} size="sm" />
          <div className="flex-1">
            <div className="text-sm text-gray-400">
              7d change: <span className={summary.change_7d >= 0 ? 'text-green-400' : 'text-red-400'}>
                {summary.change_7d > 0 ? '+' : ''}{summary.change_7d}
              </span>
            </div>
            <div className="text-sm text-gray-400">
              30d change: <span className={summary.change_30d >= 0 ? 'text-green-400' : 'text-red-400'}>
                {summary.change_30d > 0 ? '+' : ''}{summary.change_30d}
              </span>
            </div>
          </div>
        </div>

        {/* Alerts badge */}
        {alerts.length > 0 && (
          <div className="mt-3 p-2 bg-red-500/10 border border-red-500/30 rounded-lg">
            <p className="text-xs text-red-400">
              {alerts.length} unacknowledged alert{alerts.length > 1 ? 's' : ''}
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
        <h3 className="text-lg font-semibold text-white">
          Sentiment Analysis
          {customerName && <span className="text-gray-400 font-normal"> - {customerName}</span>}
        </h3>
        <button
          onClick={loadData}
          className="text-sm text-gray-400 hover:text-white px-2 py-1 rounded hover:bg-gray-800"
        >
          Refresh
        </button>
      </div>

      {/* Alerts */}
      {showAlerts && alerts.length > 0 && (
        <div className="space-y-2">
          {alerts.map(alert => (
            <AlertCard
              key={alert.id}
              alert={alert}
              onAcknowledge={handleAcknowledgeAlert}
            />
          ))}
        </div>
      )}

      {/* Main content grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Left: Score and Trend */}
        <div className="space-y-4">
          <div className="flex items-center gap-4">
            <SentimentGauge score={summary.current_score} size="md" />
            <div>
              <div className={`flex items-center gap-2 ${getTrendColor(summary.trend)}`}>
                <span className="text-lg">{getTrendIcon(summary.trend)}</span>
                <span className="capitalize">{summary.trend}</span>
              </div>
              <div className="mt-2 space-y-1">
                <p className="text-sm text-gray-400">
                  7-day: <span className={summary.change_7d >= 0 ? 'text-green-400' : 'text-red-400'}>
                    {summary.change_7d > 0 ? '+' : ''}{summary.change_7d} pts
                  </span>
                </p>
                <p className="text-sm text-gray-400">
                  30-day: <span className={summary.change_30d >= 0 ? 'text-green-400' : 'text-red-400'}>
                    {summary.change_30d > 0 ? '+' : ''}{summary.change_30d} pts
                  </span>
                </p>
              </div>
            </div>
          </div>

          {/* Historical Trend */}
          <div>
            <h4 className="text-sm font-medium text-gray-400 mb-2">Trend (8 weeks)</h4>
            <TrendChart data={summary.historical_data} />
          </div>
        </div>

        {/* Right: Topic Breakdown and Recent */}
        <div className="space-y-4">
          <div>
            <h4 className="text-sm font-medium text-gray-400 mb-2">By Topic</h4>
            <TopicSentimentBars topics={summary.topic_breakdown} />
          </div>

          <div>
            <h4 className="text-sm font-medium text-gray-400 mb-2">Recent Interactions</h4>
            <RecentInteractionsList interactions={summary.recent_interactions} />
          </div>
        </div>
      </div>
    </div>
  );
};

export default SentimentPanel;
