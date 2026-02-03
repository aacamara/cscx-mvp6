/**
 * CES Distribution Chart
 * PRD-160: Visual representation of CES score distribution
 */

import React from 'react';
import { CESDistribution } from '../../types/customerEffortScore';

interface CESDistributionChartProps {
  distribution: CESDistribution;
  showLabels?: boolean;
}

export const CESDistributionChart: React.FC<CESDistributionChartProps> = ({
  distribution,
  showLabels = true
}) => {
  const segments = [
    {
      label: 'Low Effort (6-7)',
      value: distribution.low_effort,
      color: 'bg-green-500',
      textColor: 'text-green-400'
    },
    {
      label: 'Neutral (4-5)',
      value: distribution.neutral,
      color: 'bg-yellow-500',
      textColor: 'text-yellow-400'
    },
    {
      label: 'High Effort (1-3)',
      value: distribution.high_effort,
      color: 'bg-red-500',
      textColor: 'text-red-400'
    }
  ];

  return (
    <div className="space-y-3">
      {segments.map((segment) => (
        <div key={segment.label} className="space-y-1">
          {showLabels && (
            <div className="flex justify-between text-sm">
              <span className="text-cscx-gray-300">{segment.label}</span>
              <span className={`font-medium ${segment.textColor}`}>{segment.value}%</span>
            </div>
          )}
          <div className="h-3 bg-cscx-gray-800 rounded-full overflow-hidden">
            <div
              className={`h-full ${segment.color} rounded-full transition-all duration-500`}
              style={{ width: `${segment.value}%` }}
            />
          </div>
        </div>
      ))}
    </div>
  );
};

export default CESDistributionChart;
