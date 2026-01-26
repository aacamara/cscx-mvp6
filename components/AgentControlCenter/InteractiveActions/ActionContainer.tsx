import { ReactNode } from 'react';
import type { ActionStep, ActionType } from './types';

interface ActionContainerProps {
  type: ActionType;
  title: string;
  steps: ActionStep[];
  currentStep: number;
  onClose: () => void;
  children: ReactNode;
}

const ACTION_ICONS: Record<ActionType, string> = {
  meeting: '📅',
  email: '✉️',
  document: '📄',
};

export function ActionContainer({
  type,
  title,
  steps,
  currentStep,
  onClose,
  children,
}: ActionContainerProps) {
  return (
    <div className="action-container">
      {/* Header */}
      <div className="action-header">
        <div className="action-title">
          <span className="action-icon">{ACTION_ICONS[type]}</span>
          <span>{title}</span>
        </div>
        <button className="action-close" onClick={onClose}>
          ✕
        </button>
      </div>

      {/* Progress Indicator */}
      <div className="action-progress">
        <div className="progress-steps">
          {steps.map((step, index) => (
            <div
              key={step.id}
              className={`progress-step ${step.isComplete ? 'complete' : ''} ${step.isActive ? 'active' : ''}`}
            >
              <div className="step-dot">
                {step.isComplete ? '✓' : index + 1}
              </div>
              <span className="step-label">{step.title}</span>
            </div>
          ))}
        </div>
        <div className="progress-bar">
          <div
            className="progress-fill"
            style={{ width: `${(currentStep / steps.length) * 100}%` }}
          />
        </div>
      </div>

      {/* Content */}
      <div className="action-content">
        {children}
      </div>
    </div>
  );
}
