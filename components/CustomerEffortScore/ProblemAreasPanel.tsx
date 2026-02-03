/**
 * Problem Areas Panel
 * PRD-160: Highlights high-effort touchpoints that need attention
 */

import React from 'react';
import { ProblemArea } from '../../types/customerEffortScore';

interface ProblemAreasPanelProps {
  problemAreas: ProblemArea[];
  onAreaClick?: (touchpoint: string) => void;
}

export const ProblemAreasPanel: React.FC<ProblemAreasPanelProps> = ({
  problemAreas,
  onAreaClick
}) => {
  if (!problemAreas || problemAreas.length === 0) {
    return (
      <div className="p-4 text-center text-cscx-gray-500">
        <svg className="w-12 h-12 mx-auto mb-2 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
        <p className="text-green-400 font-medium">No High-Effort Areas</p>
        <p className="text-xs text-cscx-gray-500 mt-1">All touchpoints are performing well</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {problemAreas.map((area) => (
        <div
          key={area.touchpoint}
          onClick={() => onAreaClick?.(area.touchpoint)}
          className={`p-3 bg-red-500/10 border border-red-500/30 rounded-lg transition-colors ${
            onAreaClick ? 'cursor-pointer hover:bg-red-500/20' : ''
          }`}
        >
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-2">
              <span className="text-red-400 text-lg">!</span>
              <div>
                <p className="text-white font-medium">{area.touchpoint_label}</p>
                <p className="text-xs text-cscx-gray-400">
                  CES: {area.average.toFixed(1)} | {area.affected_customers} customers affected
                </p>
              </div>
            </div>
            <span className="text-red-400 font-bold text-lg">
              {area.average.toFixed(1)}
            </span>
          </div>

          {area.common_feedback.length > 0 && (
            <div className="mt-2 pt-2 border-t border-red-500/20">
              <p className="text-xs text-cscx-gray-500 mb-1">Common feedback:</p>
              <div className="space-y-1">
                {area.common_feedback.slice(0, 2).map((feedback, i) => (
                  <p key={i} className="text-xs text-cscx-gray-300 italic">
                    "{feedback}"
                  </p>
                ))}
              </div>
            </div>
          )}
        </div>
      ))}
    </div>
  );
};

export default ProblemAreasPanel;
