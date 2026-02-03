/**
 * Risk Trend Chart Component
 * Displays historical risk score trend as a simple line chart
 */

import React from 'react';

interface RiskHistoryPoint {
  date: string;
  riskScore: number;
  healthScore: number;
  event?: string;
}

interface RiskTrendChartProps {
  history: RiskHistoryPoint[];
}

export const RiskTrendChart: React.FC<RiskTrendChartProps> = ({ history }) => {
  if (!history || history.length === 0) {
    return (
      <div className="h-48 flex items-center justify-center text-cscx-gray-500">
        No historical data available
      </div>
    );
  }

  // Calculate chart dimensions
  const width = 100;
  const height = 48;
  const padding = 2;

  // Find min/max for scaling
  const scores = history.map((h) => h.riskScore);
  const minScore = Math.min(...scores, 0);
  const maxScore = Math.max(...scores, 100);
  const range = maxScore - minScore || 1;

  // Create points for the path
  const points = history.map((point, idx) => {
    const x = padding + (idx / (history.length - 1)) * (width - padding * 2);
    const y = height - padding - ((point.riskScore - minScore) / range) * (height - padding * 2);
    return { x, y, ...point };
  });

  // Create SVG path
  const pathD = points
    .map((p, idx) => `${idx === 0 ? 'M' : 'L'} ${p.x.toFixed(2)} ${p.y.toFixed(2)}`)
    .join(' ');

  // Create area fill path
  const areaD = `${pathD} L ${points[points.length - 1].x.toFixed(2)} ${height - padding} L ${padding} ${height - padding} Z`;

  // Get color based on current trend
  const currentScore = history[history.length - 1]?.riskScore || 50;
  const strokeColor =
    currentScore >= 75
      ? '#ef4444'
      : currentScore >= 50
        ? '#f97316'
        : currentScore >= 25
          ? '#eab308'
          : '#22c55e';

  return (
    <div className="relative">
      {/* Chart */}
      <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-48" preserveAspectRatio="none">
        {/* Grid lines */}
        <defs>
          <linearGradient id="areaGradient" x1="0" x2="0" y1="0" y2="1">
            <stop offset="0%" stopColor={strokeColor} stopOpacity="0.3" />
            <stop offset="100%" stopColor={strokeColor} stopOpacity="0.05" />
          </linearGradient>
        </defs>

        {/* Horizontal grid lines */}
        {[0, 25, 50, 75, 100].map((value) => {
          const y = height - padding - ((value - minScore) / range) * (height - padding * 2);
          return (
            <line
              key={value}
              x1={padding}
              x2={width - padding}
              y1={y}
              y2={y}
              stroke="#374151"
              strokeWidth="0.5"
              strokeDasharray="2 2"
            />
          );
        })}

        {/* Area fill */}
        <path d={areaD} fill="url(#areaGradient)" />

        {/* Line */}
        <path d={pathD} fill="none" stroke={strokeColor} strokeWidth="1.5" strokeLinecap="round" />

        {/* Data points */}
        {points.map((p, idx) => (
          <circle
            key={idx}
            cx={p.x}
            cy={p.y}
            r="1.5"
            fill={strokeColor}
            className="hover:r-3 transition-all cursor-pointer"
          >
            <title>
              {p.date}: {p.riskScore}
              {p.event ? ` - ${p.event}` : ''}
            </title>
          </circle>
        ))}
      </svg>

      {/* Y-axis labels */}
      <div className="absolute left-0 top-0 h-full flex flex-col justify-between text-xs text-cscx-gray-500 pointer-events-none py-2">
        <span>100</span>
        <span>75</span>
        <span>50</span>
        <span>25</span>
        <span>0</span>
      </div>

      {/* X-axis labels */}
      <div className="flex justify-between text-xs text-cscx-gray-500 mt-2 px-1">
        <span>{formatDate(history[0]?.date)}</span>
        {history.length > 2 && (
          <span>{formatDate(history[Math.floor(history.length / 2)]?.date)}</span>
        )}
        <span>{formatDate(history[history.length - 1]?.date)}</span>
      </div>

      {/* Legend */}
      <div className="flex items-center gap-4 mt-4 text-xs text-cscx-gray-400">
        <div className="flex items-center gap-1">
          <span className="w-3 h-0.5 bg-red-500" />
          <span>Critical (75+)</span>
        </div>
        <div className="flex items-center gap-1">
          <span className="w-3 h-0.5 bg-orange-500" />
          <span>High (50-74)</span>
        </div>
        <div className="flex items-center gap-1">
          <span className="w-3 h-0.5 bg-yellow-500" />
          <span>Medium (25-49)</span>
        </div>
        <div className="flex items-center gap-1">
          <span className="w-3 h-0.5 bg-green-500" />
          <span>Low (&lt;25)</span>
        </div>
      </div>
    </div>
  );
};

function formatDate(dateStr: string | undefined): string {
  if (!dateStr) return '';
  const date = new Date(dateStr);
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

export default RiskTrendChart;
