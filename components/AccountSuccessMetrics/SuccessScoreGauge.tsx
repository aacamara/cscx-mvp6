/**
 * Success Score Gauge Component
 * PRD-069: Visual gauge for displaying overall success score
 */

import React from 'react';
import { SUCCESS_SCORE_THRESHOLDS } from '../../types/successMetrics';

interface SuccessScoreGaugeProps {
  score: number;
  label: 'exceptional' | 'strong' | 'on_track' | 'needs_attention' | 'at_risk';
  size?: 'sm' | 'md' | 'lg';
}

const getLabelDisplay = (label: string): string => {
  return label
    .split('_')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
};

const getScoreColor = (score: number): string => {
  if (score >= SUCCESS_SCORE_THRESHOLDS.exceptional.min) return '#22c55e'; // green-500
  if (score >= SUCCESS_SCORE_THRESHOLDS.strong.min) return '#3b82f6'; // blue-500
  if (score >= SUCCESS_SCORE_THRESHOLDS.on_track.min) return '#eab308'; // yellow-500
  if (score >= SUCCESS_SCORE_THRESHOLDS.needs_attention.min) return '#f97316'; // orange-500
  return '#ef4444'; // red-500
};

const getTextColorClass = (score: number): string => {
  if (score >= SUCCESS_SCORE_THRESHOLDS.exceptional.min) return 'text-green-400';
  if (score >= SUCCESS_SCORE_THRESHOLDS.strong.min) return 'text-blue-400';
  if (score >= SUCCESS_SCORE_THRESHOLDS.on_track.min) return 'text-yellow-400';
  if (score >= SUCCESS_SCORE_THRESHOLDS.needs_attention.min) return 'text-orange-400';
  return 'text-red-400';
};

const getBgColorClass = (score: number): string => {
  if (score >= SUCCESS_SCORE_THRESHOLDS.exceptional.min) return 'bg-green-500/20';
  if (score >= SUCCESS_SCORE_THRESHOLDS.strong.min) return 'bg-blue-500/20';
  if (score >= SUCCESS_SCORE_THRESHOLDS.on_track.min) return 'bg-yellow-500/20';
  if (score >= SUCCESS_SCORE_THRESHOLDS.needs_attention.min) return 'bg-orange-500/20';
  return 'bg-red-500/20';
};

export const SuccessScoreGauge: React.FC<SuccessScoreGaugeProps> = ({
  score,
  label,
  size = 'md'
}) => {
  // Calculate the arc path
  const normalizedScore = Math.max(0, Math.min(100, score));
  const scoreColor = getScoreColor(score);

  // Gauge dimensions based on size
  const dimensions = {
    sm: { width: 120, height: 80, strokeWidth: 8, fontSize: 24, labelSize: 10 },
    md: { width: 180, height: 120, strokeWidth: 12, fontSize: 36, labelSize: 12 },
    lg: { width: 240, height: 160, strokeWidth: 16, fontSize: 48, labelSize: 14 }
  };

  const { width, height, strokeWidth, fontSize, labelSize } = dimensions[size];

  // Arc calculations
  const centerX = width / 2;
  const centerY = height;
  const radius = height - strokeWidth;

  // Create arc path (semicircle)
  const startAngle = Math.PI;
  const endAngle = 0;
  const scoreAngle = Math.PI - (normalizedScore / 100) * Math.PI;

  const startX = centerX + radius * Math.cos(startAngle);
  const startY = centerY + radius * Math.sin(startAngle);

  const bgEndX = centerX + radius * Math.cos(endAngle);
  const bgEndY = centerY + radius * Math.sin(endAngle);

  const scoreEndX = centerX + radius * Math.cos(scoreAngle);
  const scoreEndY = centerY + radius * Math.sin(scoreAngle);

  // Background arc path (full semicircle)
  const bgPath = `
    M ${startX} ${startY}
    A ${radius} ${radius} 0 0 1 ${bgEndX} ${bgEndY}
  `;

  // Score arc path (partial, based on score)
  const scorePath = `
    M ${startX} ${startY}
    A ${radius} ${radius} 0 ${normalizedScore > 50 ? 1 : 0} 1 ${scoreEndX} ${scoreEndY}
  `;

  return (
    <div className="flex flex-col items-center">
      <svg
        width={width}
        height={height + 10}
        viewBox={`0 0 ${width} ${height + 10}`}
        className="overflow-visible"
      >
        {/* Background arc */}
        <path
          d={bgPath}
          fill="none"
          stroke="#1a1a1a"
          strokeWidth={strokeWidth}
          strokeLinecap="round"
        />

        {/* Score arc */}
        <path
          d={scorePath}
          fill="none"
          stroke={scoreColor}
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          className="transition-all duration-500"
          style={{
            filter: `drop-shadow(0 0 8px ${scoreColor}40)`
          }}
        />

        {/* Tick marks */}
        {[0, 25, 50, 75, 100].map((tick) => {
          const tickAngle = Math.PI - (tick / 100) * Math.PI;
          const innerRadius = radius - strokeWidth / 2 - 4;
          const outerRadius = radius - strokeWidth / 2 - 10;
          const x1 = centerX + innerRadius * Math.cos(tickAngle);
          const y1 = centerY + innerRadius * Math.sin(tickAngle);
          const x2 = centerX + outerRadius * Math.cos(tickAngle);
          const y2 = centerY + outerRadius * Math.sin(tickAngle);

          return (
            <line
              key={tick}
              x1={x1}
              y1={y1}
              x2={x2}
              y2={y2}
              stroke="#4b5563"
              strokeWidth={2}
              strokeLinecap="round"
            />
          );
        })}

        {/* Score text */}
        <text
          x={centerX}
          y={centerY - fontSize / 3}
          textAnchor="middle"
          className={`font-bold ${getTextColorClass(score)}`}
          style={{ fontSize }}
          fill="currentColor"
        >
          {score}
        </text>

        {/* "/ 100" label */}
        <text
          x={centerX}
          y={centerY + 4}
          textAnchor="middle"
          className="text-cscx-gray-500"
          style={{ fontSize: labelSize }}
          fill="currentColor"
        >
          / 100
        </text>
      </svg>

      {/* Status label */}
      <div
        className={`mt-2 px-3 py-1 rounded-full text-sm font-medium ${getTextColorClass(score)} ${getBgColorClass(score)}`}
      >
        {getLabelDisplay(label)}
      </div>
    </div>
  );
};

export default SuccessScoreGauge;
