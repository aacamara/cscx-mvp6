/**
 * Portfolio Trend Chart
 * PRD-153: Visual representation of health score trends over time
 */

import React from 'react';
import { PortfolioTrend, HEALTH_THRESHOLDS } from '../../types/healthPortfolio';

interface PortfolioTrendChartProps {
  trends: PortfolioTrend[];
}

export const PortfolioTrendChart: React.FC<PortfolioTrendChartProps> = ({ trends }) => {
  if (trends.length === 0) {
    return (
      <div className="h-48 flex items-center justify-center text-cscx-gray-500">
        No trend data available
      </div>
    );
  }

  // Get min/max for scaling
  const scores = trends.map(t => t.avg_score);
  const maxScore = Math.max(...scores, HEALTH_THRESHOLDS.healthy.min);
  const minScore = Math.min(...scores, HEALTH_THRESHOLDS.warning.min);
  const padding = 10;
  const range = (maxScore - minScore + padding * 2) || 1;

  // Chart dimensions
  const chartHeight = 180;
  const chartWidth = 100; // percentage

  // Calculate Y position (inverted because SVG Y grows downward)
  const getY = (score: number): number => {
    const normalized = (score - minScore + padding) / range;
    return chartHeight - (normalized * chartHeight);
  };

  // Generate path for the line
  const pathPoints = trends.map((trend, index) => {
    const x = (index / (trends.length - 1)) * 100;
    const y = getY(trend.avg_score);
    return `${index === 0 ? 'M' : 'L'} ${x} ${y}`;
  }).join(' ');

  // Generate area path (fill under the line)
  const areaPath = `${pathPoints} L 100 ${chartHeight} L 0 ${chartHeight} Z`;

  // Threshold lines
  const healthyLineY = getY(HEALTH_THRESHOLDS.healthy.min);
  const warningLineY = getY(HEALTH_THRESHOLDS.warning.min);

  // Sample data points for labels (show every 5th point)
  const labelInterval = Math.ceil(trends.length / 6);
  const labelPoints = trends.filter((_, i) => i % labelInterval === 0 || i === trends.length - 1);

  return (
    <div className="relative">
      {/* SVG Chart */}
      <svg
        viewBox={`0 0 100 ${chartHeight}`}
        className="w-full h-48"
        preserveAspectRatio="none"
      >
        {/* Gradient definition */}
        <defs>
          <linearGradient id="areaGradient" x1="0" x2="0" y1="0" y2="1">
            <stop offset="0%" stopColor="#e63946" stopOpacity="0.3" />
            <stop offset="100%" stopColor="#e63946" stopOpacity="0" />
          </linearGradient>
        </defs>

        {/* Grid lines */}
        {[0, 25, 50, 75, 100].map((pct) => (
          <line
            key={pct}
            x1={pct}
            y1={0}
            x2={pct}
            y2={chartHeight}
            stroke="#333"
            strokeWidth="0.2"
          />
        ))}

        {/* Threshold lines */}
        <line
          x1={0}
          y1={healthyLineY}
          x2={100}
          y2={healthyLineY}
          stroke="#22c55e"
          strokeWidth="0.3"
          strokeDasharray="2,2"
        />
        <line
          x1={0}
          y1={warningLineY}
          x2={100}
          y2={warningLineY}
          stroke="#eab308"
          strokeWidth="0.3"
          strokeDasharray="2,2"
        />

        {/* Area fill */}
        <path
          d={areaPath}
          fill="url(#areaGradient)"
        />

        {/* Main line */}
        <path
          d={pathPoints}
          fill="none"
          stroke="#e63946"
          strokeWidth="0.8"
          strokeLinecap="round"
          strokeLinejoin="round"
        />

        {/* Data points */}
        {trends.map((trend, index) => {
          const x = (index / (trends.length - 1)) * 100;
          const y = getY(trend.avg_score);
          // Only show points at intervals
          if (index % labelInterval !== 0 && index !== trends.length - 1) return null;
          return (
            <circle
              key={trend.date}
              cx={x}
              cy={y}
              r="1.5"
              fill="#e63946"
              className="hover:r-[2] transition-all"
            />
          );
        })}
      </svg>

      {/* Y-axis labels */}
      <div className="absolute left-0 top-0 bottom-0 w-8 flex flex-col justify-between text-xs text-cscx-gray-500 pointer-events-none">
        <span>{maxScore + padding}</span>
        <span className="text-green-400/50">{HEALTH_THRESHOLDS.healthy.min}</span>
        <span className="text-yellow-400/50">{HEALTH_THRESHOLDS.warning.min}</span>
        <span>{Math.max(0, minScore - padding)}</span>
      </div>

      {/* X-axis labels */}
      <div className="flex justify-between mt-2 text-xs text-cscx-gray-500 px-8">
        {labelPoints.map((trend, index) => (
          <span key={trend.date}>
            {new Date(trend.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
          </span>
        ))}
      </div>

      {/* Legend */}
      <div className="flex items-center justify-center gap-4 mt-3 text-xs">
        <div className="flex items-center gap-1">
          <div className="w-3 h-0.5 bg-green-500" style={{ borderStyle: 'dashed' }} />
          <span className="text-cscx-gray-400">Healthy (70+)</span>
        </div>
        <div className="flex items-center gap-1">
          <div className="w-3 h-0.5 bg-yellow-500" style={{ borderStyle: 'dashed' }} />
          <span className="text-cscx-gray-400">Warning (40+)</span>
        </div>
        <div className="flex items-center gap-1">
          <div className="w-3 h-1 bg-cscx-accent rounded" />
          <span className="text-cscx-gray-400">Avg Score</span>
        </div>
      </div>
    </div>
  );
};

export default PortfolioTrendChart;
