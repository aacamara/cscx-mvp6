/**
 * Team Trend Chart
 * PRD-178: Visualize team performance trends over time
 */

import React, { useMemo } from 'react';
import { TeamTrendPoint } from '../../types/teamPerformance';

interface TeamTrendChartProps {
  trends: TeamTrendPoint[];
}

export const TeamTrendChart: React.FC<TeamTrendChartProps> = ({ trends }) => {
  // Chart dimensions
  const width = 600;
  const height = 200;
  const padding = { top: 20, right: 20, bottom: 30, left: 40 };
  const chartWidth = width - padding.left - padding.right;
  const chartHeight = height - padding.top - padding.bottom;

  // Calculate scales and paths
  const chartData = useMemo(() => {
    if (trends.length === 0) return null;

    // Find min/max values
    const allValues = trends.flatMap(t => [t.avg_retention, t.avg_nrr, t.avg_health, t.avg_activity]);
    const minValue = Math.min(...allValues) - 5;
    const maxValue = Math.max(...allValues) + 5;

    // Scale functions
    const xScale = (index: number) => (index / (trends.length - 1)) * chartWidth;
    const yScale = (value: number) => chartHeight - ((value - minValue) / (maxValue - minValue)) * chartHeight;

    // Generate paths
    const generatePath = (getValue: (t: TeamTrendPoint) => number) => {
      return trends.map((t, i) => {
        const x = xScale(i);
        const y = yScale(getValue(t));
        return `${i === 0 ? 'M' : 'L'} ${x} ${y}`;
      }).join(' ');
    };

    return {
      retentionPath: generatePath(t => t.avg_retention),
      nrrPath: generatePath(t => t.avg_nrr),
      healthPath: generatePath(t => t.avg_health),
      activityPath: generatePath(t => t.avg_activity),
      yAxisLabels: [
        { value: maxValue, y: 0 },
        { value: (maxValue + minValue) / 2, y: chartHeight / 2 },
        { value: minValue, y: chartHeight }
      ],
      xAxisLabels: trends.filter((_, i) => i % Math.ceil(trends.length / 5) === 0).map((t, i, arr) => ({
        date: new Date(t.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
        x: (trends.indexOf(t) / (trends.length - 1)) * chartWidth
      }))
    };
  }, [trends, chartWidth, chartHeight]);

  if (!chartData || trends.length === 0) {
    return (
      <div className="h-48 flex items-center justify-center text-cscx-gray-500">
        No trend data available
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Legend */}
      <div className="flex flex-wrap gap-4 justify-center text-xs">
        <div className="flex items-center gap-1.5">
          <div className="w-3 h-0.5 bg-green-400" />
          <span className="text-cscx-gray-400">Retention</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-3 h-0.5 bg-cscx-accent" />
          <span className="text-cscx-gray-400">NRR</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-3 h-0.5 bg-blue-400" />
          <span className="text-cscx-gray-400">Health</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-3 h-0.5 bg-purple-400" />
          <span className="text-cscx-gray-400">Activity</span>
        </div>
      </div>

      {/* Chart */}
      <div className="w-full overflow-x-auto">
        <svg
          viewBox={`0 0 ${width} ${height}`}
          className="w-full min-w-[400px]"
          style={{ maxHeight: '250px' }}
        >
          {/* Grid lines */}
          <g transform={`translate(${padding.left}, ${padding.top})`}>
            {chartData.yAxisLabels.map((label, i) => (
              <line
                key={i}
                x1={0}
                y1={label.y}
                x2={chartWidth}
                y2={label.y}
                stroke="#333"
                strokeDasharray="4"
              />
            ))}
          </g>

          {/* Y-axis labels */}
          <g transform={`translate(0, ${padding.top})`}>
            {chartData.yAxisLabels.map((label, i) => (
              <text
                key={i}
                x={padding.left - 8}
                y={label.y + 4}
                textAnchor="end"
                className="text-xs fill-cscx-gray-500"
              >
                {label.value.toFixed(0)}
              </text>
            ))}
          </g>

          {/* X-axis labels */}
          <g transform={`translate(${padding.left}, ${height - 10})`}>
            {chartData.xAxisLabels.map((label, i) => (
              <text
                key={i}
                x={label.x}
                y={0}
                textAnchor="middle"
                className="text-xs fill-cscx-gray-500"
              >
                {label.date}
              </text>
            ))}
          </g>

          {/* Lines */}
          <g transform={`translate(${padding.left}, ${padding.top})`}>
            {/* Retention */}
            <path
              d={chartData.retentionPath}
              fill="none"
              stroke="#4ade80"
              strokeWidth={2}
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            {/* NRR */}
            <path
              d={chartData.nrrPath}
              fill="none"
              stroke="#e63946"
              strokeWidth={2}
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            {/* Health */}
            <path
              d={chartData.healthPath}
              fill="none"
              stroke="#60a5fa"
              strokeWidth={2}
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            {/* Activity */}
            <path
              d={chartData.activityPath}
              fill="none"
              stroke="#a78bfa"
              strokeWidth={2}
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </g>
        </svg>
      </div>

      {/* Current Values Summary */}
      <div className="grid grid-cols-4 gap-2 text-center text-xs">
        <div>
          <span className="text-green-400 font-medium">
            {trends[trends.length - 1]?.avg_retention.toFixed(1)}%
          </span>
          <p className="text-cscx-gray-500">Retention</p>
        </div>
        <div>
          <span className="text-cscx-accent font-medium">
            {trends[trends.length - 1]?.avg_nrr.toFixed(1)}%
          </span>
          <p className="text-cscx-gray-500">NRR</p>
        </div>
        <div>
          <span className="text-blue-400 font-medium">
            {trends[trends.length - 1]?.avg_health}
          </span>
          <p className="text-cscx-gray-500">Health</p>
        </div>
        <div>
          <span className="text-purple-400 font-medium">
            {trends[trends.length - 1]?.avg_activity}
          </span>
          <p className="text-cscx-gray-500">Activity</p>
        </div>
      </div>
    </div>
  );
};
