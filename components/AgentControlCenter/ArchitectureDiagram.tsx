import React from 'react';
import { AGENTS, AgentId } from '../../types/agents';

interface ArchitectureDiagramProps {
  activeAgent: AgentId | null;
  deployingTo: AgentId | null;
}

export const ArchitectureDiagram: React.FC<ArchitectureDiagramProps> = ({ activeAgent, deployingTo }) => {
  return (
    <div className="architecture-diagram">
      <p className="section-label">Agent Architecture</p>

      <div className="diagram-content">
        {/* CSM */}
        <div className="csm-box">
          <span>CSM (Human-in-the-Loop)</span>
        </div>

        {/* Arrow down */}
        <svg width="20" height="20" viewBox="0 0 20 20" className="arrow-down">
          <path d="M10 0 L10 15 M5 10 L10 15 L15 10" stroke="#333" strokeWidth="1.5" fill="none" />
        </svg>

        {/* Onboarding Agent */}
        <div className={`orchestrator-box ${activeAgent === 'onboarding' ? 'active' : ''}`}>
          <span>🎯 Onboarding Agent</span>
        </div>

        {/* Arrows to subagents */}
        <svg width="200" height="30" viewBox="0 0 200 30" className="subagent-arrows">
          <path
            d="M100 0 L100 10 L30 10 L30 25"
            stroke={deployingTo === 'meeting' ? '#22c55e' : '#333'}
            strokeWidth="1.5"
            fill="none"
            strokeDasharray={deployingTo === 'meeting' ? '4' : '0'}
            className={deployingTo === 'meeting' ? 'flow-line' : ''}
          />
          <path
            d="M100 0 L100 25"
            stroke={deployingTo === 'training' ? '#3b82f6' : '#333'}
            strokeWidth="1.5"
            fill="none"
            strokeDasharray={deployingTo === 'training' ? '4' : '0'}
            className={deployingTo === 'training' ? 'flow-line' : ''}
          />
          <path
            d="M100 0 L100 10 L170 10 L170 25"
            stroke={deployingTo === 'intelligence' ? '#a855f7' : '#333'}
            strokeWidth="1.5"
            fill="none"
            strokeDasharray={deployingTo === 'intelligence' ? '4' : '0'}
            className={deployingTo === 'intelligence' ? 'flow-line' : ''}
          />
        </svg>

        {/* Subagents */}
        <div className="subagents-row">
          {(['meeting', 'training', 'intelligence'] as AgentId[]).map((agent) => {
            const info = AGENTS[agent];
            const isActive = activeAgent === agent;
            return (
              <div
                key={agent}
                className={`subagent-box ${isActive ? 'active' : ''}`}
                style={{
                  backgroundColor: isActive ? `${info.color}10` : undefined,
                  borderColor: isActive ? `${info.color}50` : undefined
                }}
              >
                <span className="subagent-icon">{info.icon}</span>
                <p className="subagent-name">{info.name.replace(' Agent', '')}</p>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
