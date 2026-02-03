/**
 * Value Summary Card Component
 * PRD-069: Displays value delivery and ROI summary
 */

import React from 'react';
import { ValueSummary } from '../../types/successMetrics';

interface ValueSummaryCardProps {
  valueSummary: ValueSummary;
}

const formatCurrency = (amount: number): string => {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0
  }).format(amount);
};

const getConfidenceColor = (confidence: 'high' | 'medium' | 'low'): string => {
  switch (confidence) {
    case 'high':
      return 'text-green-400';
    case 'medium':
      return 'text-yellow-400';
    case 'low':
      return 'text-orange-400';
  }
};

const getConfidenceBg = (confidence: 'high' | 'medium' | 'low'): string => {
  switch (confidence) {
    case 'high':
      return 'bg-green-500/20';
    case 'medium':
      return 'bg-yellow-500/20';
    case 'low':
      return 'bg-orange-500/20';
  }
};

export const ValueSummaryCard: React.FC<ValueSummaryCardProps> = ({
  valueSummary
}) => {
  const { items, totalAnnualValue, roi } = valueSummary;

  // Calculate ROI color based on percentage
  const getRoiColor = (roiPercent: number): string => {
    if (roiPercent >= 200) return 'text-green-400';
    if (roiPercent >= 100) return 'text-blue-400';
    if (roiPercent >= 50) return 'text-yellow-400';
    return 'text-red-400';
  };

  return (
    <div className="bg-cscx-gray-900 border border-cscx-gray-800 rounded-xl p-6">
      <h3 className="text-sm font-medium text-cscx-gray-400 uppercase tracking-wider mb-4">
        Value Delivered
      </h3>

      {/* Total Value */}
      <div className="mb-4">
        <p className="text-3xl font-bold text-cscx-accent">
          {formatCurrency(totalAnnualValue)}
        </p>
        <p className="text-sm text-cscx-gray-400">Annual value delivered</p>
      </div>

      {/* ROI Summary */}
      <div className="bg-cscx-gray-800/50 rounded-lg p-3 mb-4">
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm text-cscx-gray-400">Investment (ARR)</span>
          <span className="text-sm text-white font-medium">
            {formatCurrency(roi.investment)}
          </span>
        </div>
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm text-cscx-gray-400">Value Delivered</span>
          <span className="text-sm text-white font-medium">
            {formatCurrency(roi.valueDelivered)}
          </span>
        </div>
        <div className="border-t border-cscx-gray-700 pt-2 mt-2">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-white">ROI</span>
            <span className={`text-lg font-bold ${getRoiColor(roi.roiPercent)}`}>
              {roi.roiPercent}%
            </span>
          </div>
        </div>
      </div>

      {/* Value Breakdown */}
      <div className="space-y-2">
        <p className="text-xs text-cscx-gray-500 uppercase tracking-wider mb-2">
          Breakdown
        </p>
        {items.map((item, idx) => (
          <div
            key={idx}
            className="flex items-center justify-between py-2 border-b border-cscx-gray-800 last:border-0"
          >
            <div className="flex-1">
              <p className="text-sm text-white">{item.category}</p>
              <p className="text-xs text-cscx-gray-500">{item.description}</p>
            </div>
            <div className="text-right ml-4">
              <p className="text-sm font-medium text-white">
                {formatCurrency(item.annualValue)}
              </p>
              <span className={`text-xs px-1.5 py-0.5 rounded capitalize ${getConfidenceColor(item.confidence)} ${getConfidenceBg(item.confidence)}`}>
                {item.confidence}
              </span>
            </div>
          </div>
        ))}
      </div>

      {/* Visual ROI Bar */}
      <div className="mt-4 pt-4 border-t border-cscx-gray-800">
        <div className="flex items-center gap-2 mb-2">
          <span className="text-xs text-cscx-gray-500">ROI</span>
          <div className="flex-1 h-2 bg-cscx-gray-800 rounded-full overflow-hidden">
            <div
              className={`h-full rounded-full transition-all ${
                roi.roiPercent >= 200 ? 'bg-green-500' :
                roi.roiPercent >= 100 ? 'bg-blue-500' :
                roi.roiPercent >= 50 ? 'bg-yellow-500' :
                'bg-red-500'
              }`}
              style={{ width: `${Math.min(100, roi.roiPercent / 2)}%` }}
            />
          </div>
          <span className={`text-xs font-medium ${getRoiColor(roi.roiPercent)}`}>
            {roi.roiPercent}%
          </span>
        </div>
        <p className="text-xs text-cscx-gray-500 text-center">
          {roi.roiPercent >= 100 ? 'Value exceeds investment' : 'Investment not yet recovered'}
        </p>
      </div>
    </div>
  );
};

export default ValueSummaryCard;
