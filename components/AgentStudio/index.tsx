/**
 * AgentStudio - Unified Agent Management
 * Shows the 5 CS Agents with settings and configuration
 */

import React, { useState } from 'react';
import { AgentBuilder } from '../AgentBuilder';
import { AgentInbox } from '../AgentInbox';
import { AgentTestChat } from '../AgentTestChat';
import { OnboardingFlow, OnboardingResult } from './OnboardingFlow';
import { AgentDefinition, AVAILABLE_TOOLS, AVAILABLE_TRIGGERS } from '../../types/agentBuilder';
import { CS_AGENTS, CSAgentType } from '../../types/agents';

interface AgentStudioProps {
  onClose?: () => void;
}

// The 5 CS Agents with their configurations
const CS_AGENT_DEFINITIONS: AgentDefinition[] = [
  {
    id: 'agent_onboarding',
    name: 'Onboarding Specialist',
    description: 'Guides new customers through implementation, training, and time-to-value',
    instructions: `You are the Onboarding Specialist agent for Customer Success.

Your responsibilities:
- Create kickoff packages and welcome sequences
- Generate 30-60-90 day onboarding plans
- Set up customer workspaces in Google Drive
- Create training materials and documentation
- Track onboarding milestones and success criteria

Behavior:
- Be proactive and welcoming to new customers
- Focus on time-to-value and quick wins
- Coordinate with stakeholders for smooth handoffs
- Use playbooks from the knowledge base`,
    memoryBank: [],
    triggers: [{
      id: 'trigger_onboarding',
      type: 'event',
      name: 'New Customer Signed',
      description: 'Triggers when a new customer contract is signed',
      config: { event: 'customer.signed' },
      enabled: true,
    }],
    tools: AVAILABLE_TOOLS.filter(t => ['get_customer_data', 'create_document', 'send_email', 'book_meeting', 'notify_user'].includes(t.id)),
    connections: [
      { id: 'conn_1', service: 'google_drive', name: 'Google Workspace', icon: '📁', status: 'connected', connectedAt: new Date(), scopes: [] },
    ],
    status: 'active',
    createdAt: new Date(Date.now() - 30 * 86400000),
    updatedAt: new Date(),
    createdBy: 'system',
  },
  {
    id: 'agent_adoption',
    name: 'Adoption Champion',
    description: 'Drives product adoption through usage analysis and training recommendations',
    instructions: `You are the Adoption Champion agent for Customer Success.

Your responsibilities:
- Analyze usage metrics and identify adoption gaps
- Generate training recommendations based on usage patterns
- Create feature rollout plans
- Build champion programs to increase internal advocacy
- Track feature adoption and engagement trends

Behavior:
- Be data-driven in your recommendations
- Focus on increasing daily active users
- Identify and nurture internal champions
- Proactively suggest underutilized features`,
    memoryBank: [],
    triggers: [{
      id: 'trigger_adoption',
      type: 'schedule',
      name: 'Weekly Usage Review',
      description: 'Analyzes usage weekly',
      config: { schedule: '0 9 * * 1' },
      enabled: true,
    }],
    tools: AVAILABLE_TOOLS.filter(t => ['get_customer_data', 'analyze_usage', 'create_document', 'send_email', 'notify_user'].includes(t.id)),
    connections: [
      { id: 'conn_2', service: 'google_drive', name: 'Google Workspace', icon: '📁', status: 'connected', connectedAt: new Date(), scopes: [] },
    ],
    status: 'active',
    createdAt: new Date(Date.now() - 30 * 86400000),
    updatedAt: new Date(),
    createdBy: 'system',
  },
  {
    id: 'agent_renewal',
    name: 'Renewal Specialist',
    description: 'Manages renewals with forecasting, QBRs, and expansion opportunities',
    instructions: `You are the Renewal Specialist agent for Customer Success.

Your responsibilities:
- Generate renewal forecasts based on health and usage
- Create QBR packages with metrics and value summaries
- Build value summaries highlighting ROI
- Identify expansion opportunities
- Prepare renewal proposals and negotiations

Behavior:
- Be proactive about upcoming renewals (90/60/30 days)
- Always quantify value delivered
- Identify upsell and cross-sell opportunities
- Coordinate with sales for complex renewals`,
    memoryBank: [],
    triggers: [{
      id: 'trigger_renewal',
      type: 'condition',
      name: 'Renewal in 90 Days',
      description: 'Triggers 90 days before renewal',
      config: { condition: { field: 'days_to_renewal', operator: 'lt', value: 90 } },
      enabled: true,
    }],
    tools: AVAILABLE_TOOLS.filter(t => ['get_customer_data', 'analyze_health_score', 'create_document', 'send_email', 'book_meeting'].includes(t.id)),
    connections: [
      { id: 'conn_3', service: 'google_drive', name: 'Google Workspace', icon: '📁', status: 'connected', connectedAt: new Date(), scopes: [] },
    ],
    status: 'active',
    createdAt: new Date(Date.now() - 30 * 86400000),
    updatedAt: new Date(),
    createdBy: 'system',
  },
  {
    id: 'agent_risk',
    name: 'Risk Analyst',
    description: 'Monitors health scores, detects churn signals, and creates save plays',
    instructions: `You are the Risk Analyst agent for Customer Success.

Your responsibilities:
- Monitor customer health scores continuously
- Detect early churn signals from usage and engagement
- Create save plays for at-risk customers
- Generate escalation reports for critical accounts
- Develop recovery plans with specific actions

Behavior:
- Be proactive about risk detection
- Escalate immediately for critical risks
- Always provide actionable recommendations
- Track save play effectiveness`,
    memoryBank: [],
    triggers: [{
      id: 'trigger_risk',
      type: 'condition',
      name: 'Health Below 70%',
      description: 'Triggers when health score drops below 70',
      config: { condition: { field: 'health_score', operator: 'lt', value: 70 } },
      enabled: true,
    }],
    tools: AVAILABLE_TOOLS.filter(t => ['get_customer_data', 'detect_churn_risk', 'analyze_health_score', 'send_slack_dm', 'notify_user', 'create_document'].includes(t.id)),
    connections: [
      { id: 'conn_4', service: 'google_drive', name: 'Google Workspace', icon: '📁', status: 'connected', connectedAt: new Date(), scopes: [] },
      { id: 'conn_5', service: 'slack', name: 'Slack', icon: '💬', status: 'connected', connectedAt: new Date(), scopes: [] },
    ],
    status: 'active',
    createdAt: new Date(Date.now() - 30 * 86400000),
    updatedAt: new Date(),
    createdBy: 'system',
  },
  {
    id: 'agent_strategic',
    name: 'Strategic Advisor',
    description: 'Provides executive-level insights, account planning, and success stories',
    instructions: `You are the Strategic Advisor agent for Customer Success.

Your responsibilities:
- Create comprehensive account plans for key customers
- Generate executive briefings for leadership meetings
- Build success stories and case studies
- Develop partnership proposals for strategic accounts
- Identify strategic growth opportunities

Behavior:
- Think long-term and strategically
- Focus on executive relationships
- Quantify business impact and ROI
- Align with customer's business objectives`,
    memoryBank: [],
    triggers: [{
      id: 'trigger_strategic',
      type: 'event',
      name: 'Quarterly Review',
      description: 'Triggers quarterly for strategic accounts',
      config: { event: 'quarterly.review' },
      enabled: true,
    }],
    tools: AVAILABLE_TOOLS.filter(t => ['get_customer_data', 'analyze_health_score', 'create_document', 'send_email', 'book_meeting'].includes(t.id)),
    connections: [
      { id: 'conn_6', service: 'google_drive', name: 'Google Workspace', icon: '📁', status: 'connected', connectedAt: new Date(), scopes: [] },
    ],
    status: 'active',
    createdAt: new Date(Date.now() - 30 * 86400000),
    updatedAt: new Date(),
    createdBy: 'system',
  },
];

// Agent icons mapping
const AGENT_ICONS: Record<string, string> = {
  agent_onboarding: '🎯',
  agent_adoption: '📈',
  agent_renewal: '🔄',
  agent_risk: '⚠️',
  agent_strategic: '🎖️',
};

export const AgentStudio: React.FC<AgentStudioProps> = ({ onClose }) => {
  const [agents, setAgents] = useState<AgentDefinition[]>(CS_AGENT_DEFINITIONS);
  const [selectedAgent, setSelectedAgent] = useState<AgentDefinition | null>(null);
  const [showSettings, setShowSettings] = useState(false);
  const [activeTab, setActiveTab] = useState<'agents' | 'inbox'>('agents');
  const [showOnboardingFlow, setShowOnboardingFlow] = useState(false);
  const [onboardingResult, setOnboardingResult] = useState<OnboardingResult | null>(null);

  // Handle agent settings save
  const handleAgentSettingsSave = (agent: AgentDefinition) => {
    setAgents(prev => prev.map(a => a.id === agent.id ? agent : a));
    setSelectedAgent(agent);
    setShowSettings(false);
  };

  // Handle memory update from test chat
  const handleMemoryUpdate = (agentId: string, oldInstruction: string, newInstruction: string) => {
    setAgents(prev => prev.map(a => {
      if (a.id !== agentId) return a;

      const updatedInstructions = a.instructions.includes(oldInstruction)
        ? a.instructions.replace(oldInstruction, newInstruction)
        : a.instructions + `\n- ${newInstruction}`;

      return {
        ...a,
        instructions: updatedInstructions,
        memoryBank: [
          ...a.memoryBank,
          {
            id: `mem_${Date.now()}`,
            type: 'learned_behavior' as const,
            content: newInstruction,
            source: 'user_feedback' as const,
            createdAt: new Date(),
            updatedAt: new Date(),
            usageCount: 0,
          },
        ],
        updatedAt: new Date(),
      };
    }));

    // Update selected agent if it's the one being modified
    if (selectedAgent?.id === agentId) {
      setSelectedAgent(prev => prev ? {
        ...prev,
        instructions: prev.instructions.includes(oldInstruction)
          ? prev.instructions.replace(oldInstruction, newInstruction)
          : prev.instructions + `\n- ${newInstruction}`,
      } : null);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active': return 'bg-green-500/20 text-green-400';
      case 'paused': return 'bg-yellow-500/20 text-yellow-400';
      case 'disabled': return 'bg-gray-500/20 text-gray-400';
      default: return 'bg-blue-500/20 text-blue-400';
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-white flex items-center gap-3">
            <span className="text-3xl">🛠️</span>
            Agent Studio
          </h2>
          <p className="text-cscx-gray-400 mt-1">
            Configure and manage your CS agents
          </p>
        </div>
        {selectedAgent && (
          <button
            onClick={() => setShowSettings(true)}
            className="px-4 py-2 bg-cscx-gray-800 hover:bg-cscx-gray-700 text-white font-medium rounded-lg transition-colors flex items-center gap-2"
          >
            <span>⚙️</span> Agent Settings
          </button>
        )}
      </div>

      {/* Tab Navigation */}
      <div className="flex gap-2">
        <button
          onClick={() => setActiveTab('agents')}
          className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
            activeTab === 'agents'
              ? 'bg-cscx-accent text-white'
              : 'bg-cscx-gray-800 text-cscx-gray-400 hover:text-white'
          }`}
        >
          My Agents ({agents.length})
        </button>
        <button
          onClick={() => setActiveTab('inbox')}
          className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
            activeTab === 'inbox'
              ? 'bg-cscx-accent text-white'
              : 'bg-cscx-gray-800 text-cscx-gray-400 hover:text-white'
          }`}
        >
          Inbox
        </button>
      </div>

      {/* Main Content */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Left Panel - Agent List or Inbox */}
        <div>
          {activeTab === 'agents' ? (
            <div className="bg-cscx-gray-900 border border-cscx-gray-800 rounded-xl overflow-hidden">
              <div className="p-4 border-b border-cscx-gray-800">
                <h3 className="text-lg font-bold text-white">Your Agents</h3>
              </div>
              <div className="divide-y divide-cscx-gray-800">
                {agents.map(agent => (
                  <button
                    key={agent.id}
                    onClick={() => setSelectedAgent(agent)}
                    className={`w-full p-4 text-left hover:bg-cscx-gray-800/50 transition-colors ${
                      selectedAgent?.id === agent.id ? 'bg-cscx-gray-800/50 border-l-2 border-cscx-accent' : ''
                    }`}
                  >
                    <div className="flex items-start justify-between">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="text-xl">{AGENT_ICONS[agent.id] || '🤖'}</span>
                          <span className="text-white font-medium">{agent.name}</span>
                          <span className={`px-2 py-0.5 text-xs rounded-full ${getStatusColor(agent.status)}`}>
                            {agent.status}
                          </span>
                        </div>
                        <p className="text-sm text-cscx-gray-400 mt-1">{agent.description}</p>
                        <div className="flex items-center gap-4 mt-2 text-xs text-cscx-gray-500">
                          <span>⚡ {agent.triggers[0]?.name || 'Manual'}</span>
                          <span>🔧 {agent.tools.length} tools</span>
                          <span>🔗 {agent.connections.length} connections</span>
                        </div>
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <AgentInbox agents={agents} />
          )}
        </div>

        {/* Right Panel - Agent Detail & Test Chat */}
        <div className="space-y-6">
          {selectedAgent ? (
            <>
              {/* Agent Configuration */}
              <div className="bg-cscx-gray-900 border border-cscx-gray-800 rounded-xl p-6">
                <div className="flex items-start justify-between mb-4">
                  <div>
                    <h3 className="text-lg font-bold text-white flex items-center gap-2">
                      🤖 {selectedAgent.name}
                    </h3>
                    <p className="text-sm text-cscx-gray-400">{selectedAgent.description}</p>
                  </div>
                  <span className={`px-3 py-1 text-sm rounded-full ${getStatusColor(selectedAgent.status)}`}>
                    {selectedAgent.status}
                  </span>
                </div>

                {/* Instructions */}
                <div className="mb-4">
                  <h4 className="text-sm font-medium text-cscx-gray-400 mb-2">Instructions (Memory)</h4>
                  <pre className="p-3 bg-cscx-gray-800 rounded-lg text-sm text-cscx-gray-300 whitespace-pre-wrap font-mono max-h-40 overflow-y-auto">
                    {selectedAgent.instructions}
                  </pre>
                </div>

                {/* Trigger */}
                <div className="mb-4">
                  <h4 className="text-sm font-medium text-cscx-gray-400 mb-2">Trigger</h4>
                  <div className="flex items-center gap-2">
                    <span className="text-lg">⚡</span>
                    <span className="text-white">{selectedAgent.triggers[0]?.name || 'Manual'}</span>
                    {selectedAgent.triggers[0]?.lastTriggered && (
                      <span className="text-xs text-cscx-gray-500">
                        Last run: {new Date(selectedAgent.triggers[0].lastTriggered).toLocaleString()}
                      </span>
                    )}
                  </div>
                </div>

                {/* Tools */}
                <div className="mb-4">
                  <h4 className="text-sm font-medium text-cscx-gray-400 mb-2">Tools</h4>
                  <div className="flex flex-wrap gap-2">
                    {selectedAgent.tools.map(tool => (
                      <span key={tool.id} className="px-2 py-1 bg-cscx-gray-800 text-sm text-white rounded">
                        {tool.name}
                      </span>
                    ))}
                  </div>
                </div>

                {/* Connections */}
                <div>
                  <h4 className="text-sm font-medium text-cscx-gray-400 mb-2">Connected Services</h4>
                  <div className="flex gap-2">
                    {selectedAgent.connections.map(conn => (
                      <span
                        key={conn.id}
                        className={`px-2 py-1 text-sm rounded flex items-center gap-1 ${
                          conn.status === 'connected'
                            ? 'bg-green-500/20 text-green-400'
                            : 'bg-red-500/20 text-red-400'
                        }`}
                      >
                        {conn.icon} {conn.name}
                      </span>
                    ))}
                  </div>
                </div>

                {/* Memory Bank */}
                {selectedAgent.memoryBank.length > 0 && (
                  <div className="mt-4 pt-4 border-t border-cscx-gray-800">
                    <h4 className="text-sm font-medium text-cscx-gray-400 mb-2">
                      🧠 Learned Behaviors ({selectedAgent.memoryBank.length})
                    </h4>
                    <div className="space-y-2">
                      {selectedAgent.memoryBank.map(mem => (
                        <div key={mem.id} className="p-2 bg-cscx-gray-800 rounded text-sm">
                          <p className="text-white">{mem.content}</p>
                          <p className="text-xs text-cscx-gray-500 mt-1">
                            Source: {mem.source} • Used {mem.usageCount}x
                          </p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* Agent Actions - Onboarding Specialist */}
              {selectedAgent?.id === 'agent_onboarding' && !showOnboardingFlow && (
                <div className="bg-cscx-gray-900 border border-cscx-accent/30 rounded-xl p-6">
                  <h4 className="text-lg font-semibold text-white mb-2">Agent Actions</h4>
                  <p className="text-sm text-cscx-gray-400 mb-4">
                    Start a new customer onboarding by uploading their contract.
                  </p>
                  <button
                    onClick={() => setShowOnboardingFlow(true)}
                    className="w-full px-4 py-3 bg-cscx-accent hover:bg-red-700 text-white font-medium rounded-lg flex items-center justify-center gap-2 transition-colors"
                  >
                    <span>🚀</span> Start New Onboarding
                  </button>
                  {onboardingResult && (
                    <div className="mt-4 p-3 bg-green-500/10 border border-green-500/30 rounded-lg">
                      <p className="text-green-400 text-sm font-medium mb-2">
                        Last onboarding: {onboardingResult.contractData.company_name}
                      </p>
                      <div className="flex gap-2">
                        <a
                          href={`https://drive.google.com/drive/folders/${onboardingResult.driveRootId}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-xs text-cscx-gray-400 hover:text-white"
                        >
                          📁 Drive
                        </a>
                        <a
                          href={onboardingResult.sheetUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-xs text-cscx-gray-400 hover:text-white"
                        >
                          📊 Tracker
                        </a>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Onboarding Flow */}
              {showOnboardingFlow && (
                <OnboardingFlow
                  agentId={selectedAgent.id}
                  onComplete={(result) => {
                    setOnboardingResult(result);
                    setShowOnboardingFlow(false);
                  }}
                  onCancel={() => setShowOnboardingFlow(false)}
                />
              )}

              {/* Test Chat */}
              {!showOnboardingFlow && (
                <AgentTestChat
                  agent={selectedAgent}
                  onMemoryUpdate={(old, newVal) => handleMemoryUpdate(selectedAgent.id, old, newVal)}
                />
              )}
            </>
          ) : (
            <div className="bg-cscx-gray-900 border border-cscx-gray-800 rounded-xl p-12 text-center">
              <div className="text-6xl mb-4">🤖</div>
              <h3 className="text-xl font-bold text-white mb-2">Select an Agent</h3>
              <p className="text-cscx-gray-400 mb-6">
                Choose one of the 5 CS agents from the list to view its configuration and test it
              </p>
              <div className="flex flex-wrap justify-center gap-2">
                {agents.map(agent => (
                  <button
                    key={agent.id}
                    onClick={() => setSelectedAgent(agent)}
                    className="px-3 py-1.5 bg-cscx-gray-800 hover:bg-cscx-gray-700 text-white text-sm rounded-lg transition-colors flex items-center gap-2"
                  >
                    <span>{AGENT_ICONS[agent.id]}</span>
                    {agent.name.split(' ')[0]}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Agent Settings Modal */}
      {showSettings && selectedAgent && (
        <AgentBuilder
          agent={selectedAgent}
          onAgentCreated={handleAgentSettingsSave}
          onClose={() => setShowSettings(false)}
        />
      )}
    </div>
  );
};

export default AgentStudio;
