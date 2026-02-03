/**
 * Mitigation Plan Modal Component
 * Displays the generated mitigation plan with phases and actions
 */

import React from 'react';
import { MitigationPlan, MitigationAction } from '../../types/riskDeepDive';

interface MitigationPlanModalProps {
  plan: MitigationPlan;
  onClose: () => void;
  onScheduleAction?: (action: MitigationAction) => void;
}

const getPriorityColor = (priority: MitigationAction['priority']): string => {
  switch (priority) {
    case 'urgent':
      return 'bg-red-500';
    case 'high':
      return 'bg-orange-500';
    case 'medium':
      return 'bg-yellow-500';
    case 'low':
      return 'bg-green-500';
  }
};

const getPriorityBg = (priority: MitigationAction['priority']): string => {
  switch (priority) {
    case 'urgent':
      return 'bg-red-500/10 border-red-500/30';
    case 'high':
      return 'bg-orange-500/10 border-orange-500/30';
    case 'medium':
      return 'bg-yellow-500/10 border-yellow-500/30';
    case 'low':
      return 'bg-green-500/10 border-green-500/30';
  }
};

const getImpactLabel = (impact: 'high' | 'medium' | 'low'): string => {
  switch (impact) {
    case 'high':
      return 'High Impact';
    case 'medium':
      return 'Medium Impact';
    case 'low':
      return 'Low Impact';
  }
};

const getEffortLabel = (effort: 'high' | 'medium' | 'low'): string => {
  switch (effort) {
    case 'high':
      return 'High Effort';
    case 'medium':
      return 'Medium Effort';
    case 'low':
      return 'Low Effort';
  }
};

export const MitigationPlanModal: React.FC<MitigationPlanModalProps> = ({
  plan,
  onClose,
  onScheduleAction,
}) => {
  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-cscx-gray-900 border border-cscx-gray-800 rounded-xl max-w-3xl w-full max-h-[90vh] overflow-hidden">
        {/* Header */}
        <div className="p-6 border-b border-cscx-gray-800">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-xl font-bold text-white">Mitigation Plan</h2>
              <p className="text-sm text-cscx-gray-400 mt-1">{plan.customerName}</p>
            </div>
            <button
              onClick={onClose}
              className="p-2 text-cscx-gray-400 hover:text-white transition-colors"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M6 18L18 6M6 6l12 12"
                />
              </svg>
            </button>
          </div>

          {/* Summary Stats */}
          <div className="grid grid-cols-4 gap-4 mt-4">
            <div className="text-center">
              <p className="text-2xl font-bold text-white">{plan.totalActions}</p>
              <p className="text-xs text-cscx-gray-500">Total Actions</p>
            </div>
            <div className="text-center">
              <p className="text-2xl font-bold text-red-400">{plan.urgentActions}</p>
              <p className="text-xs text-cscx-gray-500">Urgent</p>
            </div>
            <div className="text-center">
              <p className="text-2xl font-bold text-cscx-accent">{plan.estimatedTimeToComplete}</p>
              <p className="text-xs text-cscx-gray-500">Timeline</p>
            </div>
            <div className="text-center">
              <p className="text-2xl font-bold text-green-400">-{plan.expectedRiskReduction}%</p>
              <p className="text-xs text-cscx-gray-500">Expected Risk Reduction</p>
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto max-h-[calc(90vh-250px)]">
          {/* Phases */}
          <div className="space-y-6">
            {plan.phases.map((phase) => (
              <div key={phase.phase} className="space-y-3">
                {/* Phase Header */}
                <div className="flex items-center gap-3">
                  <span className="w-8 h-8 rounded-full bg-cscx-accent flex items-center justify-center text-sm font-bold text-white">
                    {phase.phase}
                  </span>
                  <div>
                    <h3 className="text-lg font-semibold text-white">{phase.name}</h3>
                    <p className="text-xs text-cscx-gray-500">Target: {formatDate(phase.targetDate)}</p>
                  </div>
                </div>

                {/* Phase Actions */}
                <div className="ml-11 space-y-2">
                  {phase.actions.map((action) => (
                    <div
                      key={action.id}
                      className={`p-4 rounded-lg border ${getPriorityBg(action.priority)} cursor-pointer hover:bg-opacity-20 transition-colors`}
                      onClick={() => onScheduleAction?.(action)}
                    >
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex items-start gap-3">
                          <span
                            className={`w-2 h-2 rounded-full mt-2 flex-shrink-0 ${getPriorityColor(action.priority)}`}
                          />
                          <div>
                            <p className="font-medium text-white">{action.action}</p>
                            <p className="text-sm text-cscx-gray-400 mt-1">{action.description}</p>
                            <div className="flex items-center gap-4 mt-2 text-xs text-cscx-gray-500">
                              <span>{getImpactLabel(action.estimatedImpact)}</span>
                              <span>|</span>
                              <span>{getEffortLabel(action.estimatedEffort)}</span>
                              <span>|</span>
                              <span className="capitalize">{action.category}</span>
                            </div>
                          </div>
                        </div>
                        <div className="text-right flex-shrink-0">
                          <span
                            className={`text-xs px-2 py-1 rounded capitalize ${getPriorityBg(action.priority)}`}
                          >
                            {action.priority}
                          </span>
                          <p className="text-xs text-cscx-gray-500 mt-2">
                            {action.timelineRecommendation}
                          </p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-cscx-gray-800 flex items-center justify-between">
          <p className="text-xs text-cscx-gray-500">
            Plan ID: {plan.planId.slice(0, 8)} | Generated: {formatDateTime(plan.createdAt)}
          </p>
          <div className="flex gap-3">
            <button
              onClick={onClose}
              className="px-4 py-2 text-sm text-cscx-gray-400 hover:text-white transition-colors"
            >
              Close
            </button>
            <button
              onClick={() => {
                // Would export or save the plan
                console.log('Export plan:', plan);
              }}
              className="px-4 py-2 text-sm bg-cscx-accent hover:bg-cscx-accent/80 text-white rounded-lg transition-colors flex items-center gap-2"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                />
              </svg>
              Export Plan
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

function formatDate(dateStr: string): string {
  const date = new Date(dateStr);
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function formatDateTime(dateStr: string): string {
  const date = new Date(dateStr);
  return date.toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

export default MitigationPlanModal;
