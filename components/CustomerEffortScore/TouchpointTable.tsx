/**
 * Touchpoint Analysis Table
 * PRD-160: Table showing CES by touchpoint with trends
 */

import React from 'react';
import { CESByTouchpoint, CESTrend, CES_THRESHOLDS } from '../../types/customerEffortScore';

interface TouchpointTableProps {
  touchpoints: CESByTouchpoint[];
  onTouchpointClick?: (touchpoint: string) => void;
}

const getTrendIcon = (trend: CESTrend): string => {
  switch (trend) {
    case 'improving': return '\u2191';
    case 'worsening': return '\u2193';
    case 'stable': return '\u2192';
  }
};

const getTrendColor = (trend: CESTrend): string => {
  switch (trend) {
    case 'improving': return 'text-green-400';
    case 'worsening': return 'text-red-400';
    case 'stable': return 'text-gray-400';
  }
};

const getCESColor = (score: number): string => {
  if (score >= CES_THRESHOLDS.low_effort.min) return 'text-green-400';
  if (score >= CES_THRESHOLDS.neutral.min) return 'text-yellow-400';
  return 'text-red-400';
};

const getCESBgColor = (score: number): string => {
  if (score >= CES_THRESHOLDS.low_effort.min) return 'bg-green-500';
  if (score >= CES_THRESHOLDS.neutral.min) return 'bg-yellow-500';
  return 'bg-red-500';
};

export const TouchpointTable: React.FC<TouchpointTableProps> = ({
  touchpoints,
  onTouchpointClick
}) => {
  if (!touchpoints || touchpoints.length === 0) {
    return (
      <div className="p-8 text-center text-cscx-gray-500">
        No touchpoint data available
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="bg-cscx-gray-800/50">
            <th className="text-left px-4 py-3 text-cscx-gray-400 font-medium">
              Touchpoint
            </th>
            <th className="text-left px-4 py-3 text-cscx-gray-400 font-medium">
              CES Score
            </th>
            <th className="text-left px-4 py-3 text-cscx-gray-400 font-medium">
              Trend
            </th>
            <th className="text-left px-4 py-3 text-cscx-gray-400 font-medium">
              Responses
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-cscx-gray-800">
          {touchpoints.map((tp) => (
            <tr
              key={tp.touchpoint}
              onClick={() => onTouchpointClick?.(tp.touchpoint)}
              className={`hover:bg-cscx-gray-800/30 transition-colors ${
                onTouchpointClick ? 'cursor-pointer' : ''
              }`}
            >
              <td className="px-4 py-3">
                <div className="flex items-center gap-3">
                  <div className={`w-2 h-2 rounded-full ${getCESBgColor(tp.average)}`} />
                  <span className="text-white font-medium">{tp.touchpoint_label}</span>
                </div>
              </td>
              <td className="px-4 py-3">
                <div className="flex items-center gap-2">
                  <div className="w-16 h-2 bg-cscx-gray-800 rounded-full overflow-hidden">
                    <div
                      className={`h-full ${getCESBgColor(tp.average)} rounded-full transition-all`}
                      style={{ width: `${(tp.average / 7) * 100}%` }}
                    />
                  </div>
                  <span className={`font-medium ${getCESColor(tp.average)}`}>
                    {tp.average.toFixed(1)}
                  </span>
                </div>
              </td>
              <td className="px-4 py-3">
                <span className={`flex items-center gap-1 ${getTrendColor(tp.trend)}`}>
                  {getTrendIcon(tp.trend)}
                  {tp.trend_change !== 0 && (
                    <span className="text-sm">
                      {tp.trend_change > 0 ? '+' : ''}{tp.trend_change.toFixed(1)}
                    </span>
                  )}
                </span>
              </td>
              <td className="px-4 py-3 text-cscx-gray-300">
                {tp.count}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

export default TouchpointTable;
