/**
 * Activity Trend Chart Component
 * PRD-172: Visual trend chart for activity feed analysis
 */

import React from 'react';
import { ActivityTrendPoint, ACTIVITY_TYPE_COLORS } from '../../types/activityFeed';

interface ActivityTrendChartProps {
  trends: ActivityTrendPoint[];
}

export const ActivityTrendChart: React.FC<ActivityTrendChartProps> = ({ trends }) => {
  if (!trends || trends.length === 0) {
    return (
      <div className="h-48 flex items-center justify-center text-cscx-gray-500">
        No trend data available
      </div>
    );
  }

  // Calculate max value for scaling
  const maxValue = Math.max(...trends.map(t => t.total), 1);

  // Get chart dimensions
  const chartHeight = 180;
  const chartWidth = 100; // percentage
  const barWidth = Math.max(2, (100 / trends.length) - 1);

  // Format date for tooltip
  const formatDate = (dateString: string): string => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  };

  // Calculate moving average for trend line
  const movingAverage = trends.map((_, index) => {
    const start = Math.max(0, index - 3);
    const end = index + 1;
    const slice = trends.slice(start, end);
    const sum = slice.reduce((acc, t) => acc + t.total, 0);
    return sum / slice.length;
  });

  // Get trend line path
  const getTrendLinePath = (): string => {
    if (movingAverage.length < 2) return '';

    const maxAvg = Math.max(...movingAverage, 1);
    const points = movingAverage.map((value, index) => {
      const x = (index / (movingAverage.length - 1)) * 100;
      const y = chartHeight - (value / maxValue) * (chartHeight - 20);
      return `${x},${y}`;
    });

    return `M ${points.join(' L ')}`;
  };

  return (
    <div className="relative h-48">
      {/* Y-axis labels */}
      <div className="absolute left-0 top-0 bottom-6 w-8 flex flex-col justify-between text-xs text-cscx-gray-500">
        <span>{maxValue}</span>
        <span>{Math.round(maxValue / 2)}</span>
        <span>0</span>
      </div>

      {/* Chart area */}
      <div className="ml-10 h-full relative">
        {/* Grid lines */}
        <div className="absolute inset-0 flex flex-col justify-between pointer-events-none" style={{ bottom: '24px' }}>
          {[0, 1, 2].map((i) => (
            <div key={i} className="border-t border-cscx-gray-800/50" />
          ))}
        </div>

        {/* SVG for trend line */}
        <svg
          className="absolute inset-0 pointer-events-none"
          style={{ bottom: '24px', height: `${chartHeight}px` }}
          viewBox={`0 0 100 ${chartHeight}`}
          preserveAspectRatio="none"
        >
          <path
            d={getTrendLinePath()}
            fill="none"
            stroke="#e63946"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            opacity="0.7"
          />
        </svg>

        {/* Bars */}
        <div className="absolute inset-x-0 bottom-6 top-0 flex items-end justify-between gap-px">
          {trends.map((trend, index) => {
            const height = (trend.total / maxValue) * 100;
            const isWeekend = new Date(trend.date).getDay() % 6 === 0;

            return (
              <div
                key={trend.date}
                className="group relative flex-1"
                style={{ maxWidth: `${barWidth}%` }}
              >
                {/* Bar */}
                <div
                  className={`w-full rounded-t transition-all duration-150 ${
                    isWeekend ? 'bg-cscx-gray-700' : 'bg-cscx-accent'
                  } group-hover:opacity-80`}
                  style={{ height: `${Math.max(height, 2)}%` }}
                />

                {/* Tooltip */}
                <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-2 py-1 bg-cscx-gray-800 border border-cscx-gray-700 rounded text-xs whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-10">
                  <p className="text-white font-medium">{trend.total} activities</p>
                  <p className="text-cscx-gray-400">{formatDate(trend.date)}</p>
                  <div className="mt-1 space-y-0.5">
                    {Object.entries(trend.by_type)
                      .filter(([_, count]) => count > 0)
                      .map(([type, count]) => (
                        <div key={type} className="flex items-center gap-1">
                          <div
                            className="w-2 h-2 rounded-full"
                            style={{ backgroundColor: ACTIVITY_TYPE_COLORS[type as keyof typeof ACTIVITY_TYPE_COLORS] }}
                          />
                          <span className="text-cscx-gray-300 capitalize">{type}: {count}</span>
                        </div>
                      ))}
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* X-axis labels (show every 7th day) */}
        <div className="absolute bottom-0 left-0 right-0 flex justify-between text-xs text-cscx-gray-500">
          {trends.filter((_, i) => i % 7 === 0 || i === trends.length - 1).map((trend) => (
            <span key={trend.date}>{formatDate(trend.date)}</span>
          ))}
        </div>
      </div>

      {/* Legend */}
      <div className="absolute top-0 right-0 flex items-center gap-4 text-xs">
        <div className="flex items-center gap-1">
          <div className="w-3 h-3 bg-cscx-accent rounded-sm" />
          <span className="text-cscx-gray-400">Weekday</span>
        </div>
        <div className="flex items-center gap-1">
          <div className="w-3 h-3 bg-cscx-gray-700 rounded-sm" />
          <span className="text-cscx-gray-400">Weekend</span>
        </div>
        <div className="flex items-center gap-1">
          <div className="w-4 h-0.5 bg-cscx-accent rounded opacity-70" />
          <span className="text-cscx-gray-400">Trend</span>
        </div>
      </div>
    </div>
  );
};

export default ActivityTrendChart;
