import React from 'react';
import { CSAgentType } from '../../types/agents';
import { AGENT_ACTIONS } from './AgentCard';

interface QuickActionsProps {
  onAction: (actionId: string) => void;
  disabled: boolean;
  activeAgent?: CSAgentType;
}

export const QuickActions: React.FC<QuickActionsProps> = ({ onAction, disabled, activeAgent = 'onboarding' }) => {
  const actions = AGENT_ACTIONS[activeAgent] || AGENT_ACTIONS.onboarding;

  return (
    <div className="quick-actions">
      {actions.map((action) => (
        <button
          key={action.id}
          onClick={() => onAction(action.id)}
          disabled={disabled}
        >
          {action.icon} {action.label}
        </button>
      ))}
    </div>
  );
};
