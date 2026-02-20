import React from 'react';

const defaultColorMap: Record<string, string> = {
  active: 'badge-success',
  enabled: 'badge-success',
  open: 'badge-warning',
  in_progress: 'badge-warning',
  running: 'badge-warning',
  paused: 'bg-blue-500/20 text-blue-400',
  draft: 'bg-cscx-gray-700/50 text-cscx-gray-400',
  closed: 'bg-cscx-gray-700/50 text-cscx-gray-400',
  completed: 'badge-success',
  disabled: 'bg-cscx-gray-700/50 text-cscx-gray-400',
  error: 'badge-error',
  failed: 'badge-error',
  critical: 'badge-error',
  warning: 'badge-warning',
  healthy: 'badge-success',
  green: 'badge-success',
  yellow: 'badge-warning',
  red: 'badge-error',
};

interface StatusBadgeProps {
  status: string;
  colorMap?: Record<string, string>;
  className?: string;
}

export const StatusBadge: React.FC<StatusBadgeProps> = ({ status, colorMap, className = '' }) => {
  const map = { ...defaultColorMap, ...colorMap };
  const colorClass = map[status.toLowerCase()] || 'bg-cscx-gray-700/50 text-cscx-gray-400';
  const label = status.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());

  return (
    <span className={`badge ${colorClass} ${className}`}>
      {label}
    </span>
  );
};
