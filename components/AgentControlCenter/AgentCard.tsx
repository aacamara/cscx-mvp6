import React, { useState } from 'react';
import { Agent, AgentStatus, CSAgentType } from '../../types/agents';

// Agent-specific quick actions
export const AGENT_ACTIONS: Record<CSAgentType, { id: string; label: string; icon: string }[]> = {
  onboarding: [
    { id: 'kickoff', label: 'Schedule Kickoff', icon: '📅' },
    { id: 'plan_30_60_90', label: 'Generate 30-60-90 Plan', icon: '📋' },
    { id: 'stakeholder_map', label: 'Map Stakeholders', icon: '👥' },
    { id: 'welcome_sequence', label: 'Send Welcome Sequence', icon: '✉️' },
    { id: 'meeting_prep', label: 'AI Meeting Prep', icon: '🤖' },
  ],
  adoption: [
    { id: 'usage_analysis', label: 'Analyze Usage', icon: '📊' },
    { id: 'adoption_campaign', label: 'Create Adoption Campaign', icon: '🎯' },
    { id: 'feature_training', label: 'Deploy Feature Training', icon: '📚' },
    { id: 'champion_program', label: 'Identify Champions', icon: '🏆' },
  ],
  renewal: [
    { id: 'renewal_forecast', label: 'Generate Forecast', icon: '🔮' },
    { id: 'value_summary', label: 'Create Value Summary', icon: '💎' },
    { id: 'expansion_analysis', label: 'Find Expansion Opps', icon: '📈' },
    { id: 'renewal_playbook', label: 'Start Renewal Playbook', icon: '📖' },
    { id: 'draft_email', label: 'AI Draft Email', icon: '✨' },
  ],
  risk: [
    { id: 'risk_assessment', label: 'Run Risk Assessment', icon: '⚠️' },
    { id: 'save_play', label: 'Create Save Play', icon: '🛡️' },
    { id: 'escalation', label: 'Escalate Issue', icon: '🚨' },
    { id: 'health_check', label: 'Deep Health Check', icon: '🩺' },
    { id: 'churn_prediction', label: 'AI Churn Prediction', icon: '🔮' },
  ],
  strategic: [
    { id: 'qbr_prep', label: 'Prepare QBR', icon: '📊' },
    { id: 'exec_briefing', label: 'Executive Briefing', icon: '👔' },
    { id: 'account_plan', label: 'Account Planning', icon: '🗺️' },
    { id: 'success_plan', label: 'Strategic Success Plan', icon: '🎯' },
    { id: 'meeting_prep', label: 'AI Meeting Prep', icon: '🤖' },
    { id: 'draft_email', label: 'AI Draft Email', icon: '✨' },
  ],
};

interface AgentCardProps {
  agent: Agent;
  status: AgentStatus;
  isActive: boolean;
  isDeploying: boolean;
  onClick?: (agentId: CSAgentType) => void;
  onActionSelect?: (agentId: CSAgentType, actionId: string) => void;
}

export const AgentCard: React.FC<AgentCardProps> = ({
  agent,
  status,
  isActive,
  isDeploying,
  onClick,
  onActionSelect
}) => {
  const [showActions, setShowActions] = useState(false);
  const agentType = agent.id as CSAgentType;
  const actions = AGENT_ACTIONS[agentType] || [];

  const handleClick = () => {
    if (onClick) {
      onClick(agentType);
    }
    setShowActions(!showActions);
  };

  const handleActionClick = (e: React.MouseEvent, actionId: string) => {
    e.stopPropagation();
    if (onActionSelect) {
      onActionSelect(agentType, actionId);
    }
    setShowActions(false);
  };

  return (
    <div
      className={`agent-card ${isActive ? 'active' : ''} ${onClick ? 'clickable' : ''}`}
      style={{
        borderColor: isActive ? agent.color : undefined,
        cursor: onClick ? 'pointer' : 'default',
      }}
      onClick={handleClick}
    >
      <div className="agent-card-header">
        <span className={`agent-icon ${isDeploying ? 'deploying' : ''}`}>{agent.icon}</span>
        <span className="agent-name">{agent.name}</span>
        {onClick && (
          <span style={{
            marginLeft: 'auto',
            fontSize: '10px',
            color: showActions ? agent.color : '#666',
            transition: 'transform 0.2s',
            transform: showActions ? 'rotate(180deg)' : 'rotate(0deg)',
          }}>
            ▼
          </span>
        )}
      </div>
      <p className="agent-description">{agent.description}</p>
      <div className="agent-status">
        <span className={`status-indicator ${isActive ? 'active' : status}`} />
        <span>{isActive ? 'Active' : status === 'ready' ? 'Ready' : 'Idle'}</span>
      </div>

      {/* Quick Actions Dropdown */}
      {showActions && actions.length > 0 && (
        <div
          className="agent-actions-dropdown"
          style={{
            marginTop: '8px',
            paddingTop: '8px',
            borderTop: '1px solid #333',
          }}
        >
          {actions.map((action) => (
            <button
              key={action.id}
              onClick={(e) => handleActionClick(e, action.id)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                width: '100%',
                padding: '6px 8px',
                marginBottom: '4px',
                background: '#1a1a1a',
                border: '1px solid #333',
                borderRadius: '4px',
                color: '#fff',
                fontSize: '11px',
                cursor: 'pointer',
                transition: 'all 0.15s',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = agent.color + '20';
                e.currentTarget.style.borderColor = agent.color;
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = '#1a1a1a';
                e.currentTarget.style.borderColor = '#333';
              }}
            >
              <span>{action.icon}</span>
              <span>{action.label}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
};
