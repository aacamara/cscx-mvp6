import React from 'react';
import { CSAgentType } from '../../types/agents';
import { AGENT_ACTIONS, GENERAL_MODE_ACTIONS } from './AgentCard';

interface QuickActionsProps {
  onAction: (actionId: string) => void;
  disabled: boolean;
  activeAgent?: CSAgentType;
  hasCustomer?: boolean;
}

export const QuickActions: React.FC<QuickActionsProps> = ({ onAction, disabled, activeAgent = 'onboarding', hasCustomer = true }) => {
  // When no customer is selected, show general mode (portfolio-level) actions
  const actions = hasCustomer
    ? (AGENT_ACTIONS[activeAgent] || AGENT_ACTIONS.onboarding)
    : GENERAL_MODE_ACTIONS;

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
