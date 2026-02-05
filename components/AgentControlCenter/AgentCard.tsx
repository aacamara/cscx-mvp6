import React, { useState } from 'react';
import { Agent, AgentStatus, CSAgentType } from '../../types/agents';

// Agent action type with optional CADG task type for direct routing
export interface AgentAction {
  id: string;
  label: string;
  icon: string;
  cadgTaskType?: string;
}

// General Mode quick actions (no customer selected)
export const GENERAL_MODE_ACTIONS: AgentAction[] = [
  { id: 'portfolio_dashboard', label: 'Portfolio Dashboard', icon: '📊', cadgTaskType: 'portfolio_dashboard' },
  { id: 'team_metrics', label: 'Team Metrics', icon: '👥', cadgTaskType: 'team_metrics' },
  { id: 'renewal_pipeline', label: 'Renewal Pipeline', icon: '🔄', cadgTaskType: 'renewal_pipeline' },
  { id: 'at_risk_overview', label: 'At-Risk Overview', icon: '⚠️', cadgTaskType: 'at_risk_overview' },
];

// Agent-specific quick actions
export const AGENT_ACTIONS: Record<CSAgentType, AgentAction[]> = {
  onboarding: [
    { id: 'kickoff_plan', label: 'Kickoff Plan', icon: '📅', cadgTaskType: 'kickoff_plan' },
    { id: 'milestone_plan', label: '30-60-90 Day Plan', icon: '📋', cadgTaskType: 'milestone_plan' },
    { id: 'stakeholder_map', label: 'Stakeholder Map', icon: '👥', cadgTaskType: 'stakeholder_map' },
    { id: 'training_schedule', label: 'Training Schedule', icon: '📚', cadgTaskType: 'training_schedule' },
    { id: 'meeting_prep', label: 'AI Meeting Prep', icon: '🤖' },
  ],
  adoption: [
    { id: 'usage_analysis', label: 'Usage Analysis', icon: '📊', cadgTaskType: 'usage_analysis' },
    { id: 'feature_campaign', label: 'Feature Campaign', icon: '🎯', cadgTaskType: 'feature_campaign' },
    { id: 'training_program', label: 'Training Program', icon: '📚', cadgTaskType: 'training_program' },
    { id: 'champion_development', label: 'Champion Development', icon: '🏆', cadgTaskType: 'champion_development' },
  ],
  renewal: [
    { id: 'renewal_forecast', label: 'Renewal Forecast', icon: '🔮', cadgTaskType: 'renewal_forecast' },
    { id: 'value_summary', label: 'Value Summary', icon: '💎', cadgTaskType: 'value_summary' },
    { id: 'expansion_proposal', label: 'Expansion Proposal', icon: '📈', cadgTaskType: 'expansion_proposal' },
    { id: 'negotiation_brief', label: 'Negotiation Brief', icon: '📖', cadgTaskType: 'negotiation_brief' },
    { id: 'draft_email', label: 'AI Draft Email', icon: '✨' },
  ],
  risk: [
    { id: 'risk_assessment', label: 'Risk Assessment', icon: '⚠️', cadgTaskType: 'risk_assessment' },
    { id: 'save_play', label: 'Save Play', icon: '🛡️', cadgTaskType: 'save_play' },
    { id: 'escalation_report', label: 'Escalation Report', icon: '🚨', cadgTaskType: 'escalation_report' },
    { id: 'resolution_plan', label: 'Resolution Plan', icon: '🩺', cadgTaskType: 'resolution_plan' },
  ],
  strategic: [
    { id: 'qbr_generation', label: 'QBR Generation', icon: '📊', cadgTaskType: 'qbr_generation' },
    { id: 'executive_briefing', label: 'Executive Briefing', icon: '👔', cadgTaskType: 'executive_briefing' },
    { id: 'account_plan', label: 'Account Plan', icon: '🗺️', cadgTaskType: 'account_plan' },
    { id: 'transformation_roadmap', label: 'Transformation Roadmap', icon: '🎯', cadgTaskType: 'transformation_roadmap' },
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
