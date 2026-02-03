/**
 * Benchmark Distribution Chart
 * PRD-171: Histogram visualization of metric distribution
 */

import React from 'react';

interface DistributionBucket {
  range_start: number;
  range_end: number;
  count: number;
  percentage: number;
}

interface BenchmarkDistributionChartProps {
  distribution: DistributionBucket[];
  median: number;
}

export const BenchmarkDistributionChart: React.FC<BenchmarkDistributionChartProps> = ({
  distribution,
  median
}) => {
  if (distribution.length === 0) {
    return (
      <div className="h-48 flex items-center justify-center text-cscx-gray-500">
        No distribution data available
      </div>
    );
  }

  // Find max count for scaling
  const maxCount = Math.max(...distribution.map(b => b.count));
  const maxPercentage = Math.max(...distribution.map(b => b.percentage), 1);

  // Chart dimensions
  const chartHeight = 160;
  const barWidth = 100 / distribution.length;

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
          <linearGradient id="barGradient" x1="0" x2="0" y1="0" y2="1">
            <stop offset="0%" stopColor="#e63946" stopOpacity="1" />
            <stop offset="100%" stopColor="#e63946" stopOpacity="0.5" />
          </linearGradient>
        </defs>

        {/* Horizontal grid lines */}
        {[0, 25, 50, 75, 100].map((pct) => (
          <line
            key={pct}
            x1={0}
            y1={chartHeight - (pct / 100) * chartHeight}
            x2={100}
            y2={chartHeight - (pct / 100) * chartHeight}
            stroke="#333"
            strokeWidth="0.2"
          />
        ))}

        {/* Bars */}
        {distribution.map((bucket, index) => {
          const barHeight = (bucket.percentage / maxPercentage) * chartHeight * 0.85;
          const x = index * barWidth + barWidth * 0.1;
          const width = barWidth * 0.8;

          // Color based on range (red for low, yellow for mid, green for high)
          const midPoint = (bucket.range_start + bucket.range_end) / 2;
          let fillColor = 'url(#barGradient)';
          if (midPoint >= 70) fillColor = '#22c55e';
          else if (midPoint >= 40) fillColor = '#eab308';
          else fillColor = '#ef4444';

          return (
            <g key={`${bucket.range_start}-${bucket.range_end}`}>
              <rect
                x={x}
                y={chartHeight - barHeight}
                width={width}
                height={barHeight}
                fill={fillColor}
                opacity={0.8}
                rx={0.5}
                className="transition-all duration-200 hover:opacity-100"
              />
              {/* Count label on top of bar if significant */}
              {bucket.count > 0 && (
                <text
                  x={x + width / 2}
                  y={chartHeight - barHeight - 3}
                  fill="#9ca3af"
                  fontSize="4"
                  textAnchor="middle"
                >
                  {bucket.count}
                </text>
              )}
            </g>
          );
        })}

        {/* Median line */}
        <line
          x1={(median / 100) * 100}
          y1={0}
          x2={(median / 100) * 100}
          y2={chartHeight}
          stroke="#e63946"
          strokeWidth="0.5"
          strokeDasharray="2,2"
        />
      </svg>

      {/* Median marker label */}
      <div
        className="absolute top-0 text-xs text-cscx-accent font-medium"
        style={{ left: `${(median / 100) * 100}%`, transform: 'translateX(-50%)' }}
      >
        Median: {median}
      </div>

      {/* X-axis labels */}
      <div className="flex justify-between mt-2 text-xs text-cscx-gray-500">
        {distribution.filter((_, i) => i % 2 === 0 || i === distribution.length - 1).map((bucket) => (
          <span key={bucket.range_start}>
            {bucket.range_start}
          </span>
        ))}
        <span>{distribution[distribution.length - 1]?.range_end}</span>
      </div>

      {/* Legend */}
      <div className="flex items-center justify-center gap-4 mt-3 text-xs">
        <div className="flex items-center gap-1">
          <div className="w-3 h-3 rounded bg-red-500 opacity-80" />
          <span className="text-cscx-gray-400">Critical (&lt;40)</span>
        </div>
        <div className="flex items-center gap-1">
          <div className="w-3 h-3 rounded bg-yellow-500 opacity-80" />
          <span className="text-cscx-gray-400">Warning (40-69)</span>
        </div>
        <div className="flex items-center gap-1">
          <div className="w-3 h-3 rounded bg-green-500 opacity-80" />
          <span className="text-cscx-gray-400">Healthy (70+)</span>
        </div>
      </div>
    </div>
  );
};

export default BenchmarkDistributionChart;
