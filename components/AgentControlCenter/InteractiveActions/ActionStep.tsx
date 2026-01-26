import { ReactNode } from 'react';

interface ActionStepProps {
  title: string;
  description?: string;
  children: ReactNode;
  onNext?: () => void;
  onBack?: () => void;
  nextLabel?: string;
  backLabel?: string;
  isNextDisabled?: boolean;
  showBack?: boolean;
  showNext?: boolean;
  isLoading?: boolean;
}

export function ActionStep({
  title,
  description,
  children,
  onNext,
  onBack,
  nextLabel = 'Continue',
  backLabel = 'Back',
  isNextDisabled = false,
  showBack = true,
  showNext = true,
  isLoading = false,
}: ActionStepProps) {
  return (
    <div className="action-step">
      <div className="step-header">
        <h3 className="step-title">{title}</h3>
        {description && <p className="step-description">{description}</p>}
      </div>

      <div className="step-body">
        {children}
      </div>

      <div className="step-footer">
        {showBack && onBack && (
          <button
            className="step-btn step-btn-secondary"
            onClick={onBack}
            disabled={isLoading}
          >
            {backLabel}
          </button>
        )}
        {showNext && onNext && (
          <button
            className="step-btn step-btn-primary"
            onClick={onNext}
            disabled={isNextDisabled || isLoading}
          >
            {isLoading ? (
              <span className="btn-loading">
                <span className="loading-dot"></span>
                <span className="loading-dot"></span>
                <span className="loading-dot"></span>
              </span>
            ) : (
              nextLabel
            )}
          </button>
        )}
      </div>
    </div>
  );
}
