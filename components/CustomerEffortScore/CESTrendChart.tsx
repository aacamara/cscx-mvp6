/**
 * CES Trend Chart
 * PRD-160: Line chart showing CES trends over time
 */

import React from 'react';
import { CESTrendPoint } from '../../types/customerEffortScore';

interface CESTrendChartProps {
  trends: CESTrendPoint[];
  height?: number;
}

export const CESTrendChart: React.FC<CESTrendChartProps> = ({
  trends,
  height = 200
}) => {
  if (!trends || trends.length === 0) {
    return (
      <div className="flex items-center justify-center h-48 text-cscx-gray-500">
        No trend data available
      </div>
    );
  }

  // Calculate chart dimensions
  const padding = { top: 20, right: 20, bottom: 30, left: 40 };
  const width = 100; // percentage
  const chartHeight = height - padding.top - padding.bottom;

  // Find min/max values for scaling
  const minScore = Math.min(...trends.map(t => t.average)) - 0.5;
  const maxScore = Math.max(...trends.map(t => t.average)) + 0.5;
  const scoreRange = maxScore - minScore || 1;

  // Generate path points
  const points = trends.map((t, i) => {
    const x = (i / (trends.length - 1)) * 100;
    const y = ((maxScore - t.average) / scoreRange) * chartHeight + padding.top;
    return { x, y, data: t };
  });

  // Create SVG path
  const pathD = points
    .map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x}% ${p.y}`)
    .join(' ');

  // Create area path (for gradient fill)
  const areaD = `${pathD} L 100% ${chartHeight + padding.top} L 0% ${chartHeight + padding.top} Z`;

  // Y-axis labels
  const yAxisLabels = [7, 5.5, 4, 2.5, 1].filter(v => v >= minScore && v <= maxScore);

  return (
    <div className="relative" style={{ height }}>
      <svg
        width="100%"
        height={height}
        className="overflow-visible"
        preserveAspectRatio="none"
      >
        {/* Gradient definition */}
        <defs>
          <linearGradient id="cesGradient" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor="rgb(230, 57, 70)" stopOpacity="0.3" />
            <stop offset="100%" stopColor="rgb(230, 57, 70)" stopOpacity="0" />
          </linearGradient>
        </defs>

        {/* Grid lines */}
        {[4, 5, 6].map(score => {
          const y = ((maxScore - score) / scoreRange) * chartHeight + padding.top;
          return (
            <g key={score}>
              <line
                x1="0%"
                y1={y}
                x2="100%"
                y2={y}
                stroke="rgb(34, 34, 34)"
                strokeDasharray="4,4"
              />
              <text
                x="0"
                y={y}
                dy="-4"
                className="text-xs fill-cscx-gray-500"
              >
                {score}
              </text>
            </g>
          );
        })}

        {/* Area fill */}
        <path
          d={areaD}
          fill="url(#cesGradient)"
          className="transition-all duration-300"
        />

        {/* Line */}
        <path
          d={pathD}
          fill="none"
          stroke="rgb(230, 57, 70)"
          strokeWidth="2"
          className="transition-all duration-300"
        />

        {/* Data points */}
        {points.map((p, i) => (
          <g key={i}>
            <circle
              cx={`${p.x}%`}
              cy={p.y}
              r="4"
              fill="rgb(230, 57, 70)"
              className="transition-all duration-200 hover:r-6"
            />
            {/* Hover tooltip area */}
            <title>
              {p.data.date}: {p.data.average.toFixed(1)} CES ({p.data.response_count} responses)
            </title>
          </g>
        ))}
      </svg>

      {/* X-axis labels */}
      <div className="absolute bottom-0 left-0 right-0 flex justify-between text-xs text-cscx-gray-500 px-1">
        <span>{trends[0]?.date}</span>
        <span>{trends[Math.floor(trends.length / 2)]?.date}</span>
        <span>{trends[trends.length - 1]?.date}</span>
      </div>
    </div>
  );
};

export default CESTrendChart;
