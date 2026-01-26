/**
 * AgentBuilder - Natural Language Agent Creation
 * LangSmith-inspired meta-prompting with memory
 */

import React, { useState, useRef, useEffect } from 'react';
import {
  MetaPromptSession,
  MetaPromptQuestion,
  AgentDefinition,
  AgentTool,
  AgentTrigger,
  ServiceConnection,
  AVAILABLE_TOOLS,
  AVAILABLE_TRIGGERS,
  AVAILABLE_SERVICES,
} from '../../types/agentBuilder';

interface AgentBuilderProps {
  agent?: AgentDefinition; // For editing existing agents
  onAgentCreated: (agent: AgentDefinition) => void;
  onClose: () => void;
}

type BuilderPhase = 'describe' | 'refining' | 'connecting' | 'review' | 'created' | 'settings';

export const AgentBuilder: React.FC<AgentBuilderProps> = ({ agent, onAgentCreated, onClose }) => {
  // If editing an existing agent, start in settings mode
  const [phase, setPhase] = useState<BuilderPhase>(agent ? 'settings' : 'describe');
  const [description, setDescription] = useState(agent?.description || '');
  const [isThinking, setIsThinking] = useState(false);
  const [session, setSession] = useState<MetaPromptSession | null>(null);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [selectedTools, setSelectedTools] = useState<string[]>(agent?.tools.map(t => t.id) || []);
  const [selectedTrigger, setSelectedTrigger] = useState<string | null>(agent?.triggers[0]?.name || null);
  const [connections, setConnections] = useState<ServiceConnection[]>(agent?.connections || []);
  const [generatedAgent, setGeneratedAgent] = useState<AgentDefinition | null>(agent || null);
  const [chatMessages, setChatMessages] = useState<Array<{ role: 'user' | 'assistant' | 'system'; content: string }>>([]);

  // For settings mode editing
  const [editedInstructions, setEditedInstructions] = useState(agent?.instructions || '');
  const [editedStatus, setEditedStatus] = useState<'draft' | 'active' | 'paused' | 'disabled'>(agent?.status || 'active');
  const chatRef = useRef<HTMLDivElement>(null);

  // Auto-scroll chat
  useEffect(() => {
    if (chatRef.current) {
      chatRef.current.scrollTop = chatRef.current.scrollHeight;
    }
  }, [chatMessages]);

  // Simulate meta-prompting analysis
  const analyzeDescription = async (desc: string) => {
    setIsThinking(true);
    setChatMessages(prev => [...prev, { role: 'user', content: desc }]);

    // Simulate AI thinking
    await new Promise(r => setTimeout(r, 1500));

    setChatMessages(prev => [...prev, {
      role: 'system',
      content: 'Analyzing your request and checking available tools and triggers...'
    }]);

    await new Promise(r => setTimeout(r, 1000));

    // Generate follow-up questions based on description
    const questions = generateQuestions(desc);
    const suggestedTools = suggestTools(desc);
    const suggestedTriggers = suggestTriggers(desc);

    const newSession: MetaPromptSession = {
      id: `session_${Date.now()}`,
      initialDescription: desc,
      questions,
      refinedPrompt: '',
      suggestedTools,
      suggestedTriggers,
      feasibilityCheck: {
        possible: true,
        missingCapabilities: [],
        suggestions: [],
      },
      status: 'questioning',
    };

    setSession(newSession);
    setSelectedTools(suggestedTools);
    setSelectedTrigger(suggestedTriggers[0] || null);

    // Add assistant message with questions
    const questionMessage = `I understand you want to create an agent that ${desc.toLowerCase()}.\n\nBefore I generate the agent, I have a few questions to make sure I get it right:\n\n${questions.map((q, i) => `${i + 1}. ${q.question}`).join('\n')}`;

    setChatMessages(prev => [...prev, { role: 'assistant', content: questionMessage }]);
    setIsThinking(false);
    setPhase('refining');
  };

  // Generate contextual questions
  const generateQuestions = (desc: string): MetaPromptQuestion[] => {
    const questions: MetaPromptQuestion[] = [];
    const lowerDesc = desc.toLowerCase();

    // Check for communication needs
    if (lowerDesc.includes('email') || lowerDesc.includes('message') || lowerDesc.includes('notify') || lowerDesc.includes('send') || lowerDesc.includes('report')) {
      questions.push({
        id: 'delivery_channel',
        question: 'How should the agent deliver notifications/messages? (Email, Slack, Teams, etc.)',
        context: 'communication channel',
        required: true,
        answered: false,
      });
    }

    // Check for scheduling needs
    if (lowerDesc.includes('daily') || lowerDesc.includes('weekly') || lowerDesc.includes('morning') || lowerDesc.includes('schedule') || lowerDesc.includes('briefing') || lowerDesc.includes('report')) {
      questions.push({
        id: 'schedule_time',
        question: 'What time should this agent run? (e.g., 6 AM, 9 AM, end of day)',
        context: 'scheduling',
        required: true,
        answered: false,
      });
    }

    // Check for customer context
    if (lowerDesc.includes('customer') || lowerDesc.includes('health') || lowerDesc.includes('risk') || lowerDesc.includes('churn')) {
      questions.push({
        id: 'customer_scope',
        question: 'Should this agent focus on specific customers, or all customers?',
        context: 'customer scope',
        required: true,
        answered: false,
      });
    }

    // Check for calendar/meeting needs
    if (lowerDesc.includes('calendar') || lowerDesc.includes('meeting') || lowerDesc.includes('schedule')) {
      questions.push({
        id: 'calendar_source',
        question: 'Which calendar should I read from? (Google Calendar, Outlook, etc.)',
        context: 'calendar integration',
        required: true,
        answered: false,
      });
    }

    // Recipient information
    if (lowerDesc.includes('send') || lowerDesc.includes('notify') || lowerDesc.includes('dm') || lowerDesc.includes('message')) {
      questions.push({
        id: 'recipient',
        question: 'Who should receive these messages? (Your Slack/email or specific person)',
        context: 'recipient',
        required: true,
        answered: false,
      });
    }

    // Always ask about format preferences
    questions.push({
      id: 'format_preferences',
      question: 'Any specific format or style preferences for the output?',
      context: 'formatting',
      required: false,
      answered: false,
    });

    return questions;
  };

  // Suggest tools based on description
  const suggestTools = (desc: string): string[] => {
    const tools: string[] = [];
    const lowerDesc = desc.toLowerCase();

    if (lowerDesc.includes('email')) tools.push('send_email');
    if (lowerDesc.includes('slack') || lowerDesc.includes('dm') || lowerDesc.includes('message')) tools.push('send_slack_dm');
    if (lowerDesc.includes('calendar') || lowerDesc.includes('meeting') || lowerDesc.includes('schedule')) tools.push('read_calendar');
    if (lowerDesc.includes('customer') || lowerDesc.includes('health') || lowerDesc.includes('data')) tools.push('get_customer_data');
    if (lowerDesc.includes('health') || lowerDesc.includes('score')) tools.push('analyze_health_score');
    if (lowerDesc.includes('risk') || lowerDesc.includes('churn')) tools.push('detect_churn_risk');

    // Always include notify_user and update_memory
    tools.push('notify_user', 'update_memory');

    return [...new Set(tools)];
  };

  // Suggest triggers based on description
  const suggestTriggers = (desc: string): string[] => {
    const triggers: string[] = [];
    const lowerDesc = desc.toLowerCase();

    if (lowerDesc.includes('daily') || lowerDesc.includes('morning') || lowerDesc.includes('every day')) {
      triggers.push('Daily Schedule');
    }
    if (lowerDesc.includes('weekly')) triggers.push('Weekly Schedule');
    if (lowerDesc.includes('new customer') || lowerDesc.includes('customer added')) triggers.push('New Customer Added');
    if (lowerDesc.includes('at-risk') || lowerDesc.includes('health drop')) triggers.push('At-Risk Customer');

    if (triggers.length === 0) triggers.push('Manual Trigger');

    return triggers;
  };

  // Handle answer submission
  const handleAnswerSubmit = async (answer: string) => {
    if (!session) return;

    const currentQuestion = session.questions[currentQuestionIndex];
    const newAnswers = { ...answers, [currentQuestion.id]: answer };
    setAnswers(newAnswers);

    setChatMessages(prev => [...prev, { role: 'user', content: answer }]);

    if (currentQuestionIndex < session.questions.length - 1) {
      // More questions to ask
      setCurrentQuestionIndex(prev => prev + 1);
      const nextQuestion = session.questions[currentQuestionIndex + 1];
      setChatMessages(prev => [...prev, { role: 'assistant', content: nextQuestion.question }]);
    } else {
      // All questions answered, generate agent
      setIsThinking(true);
      setChatMessages(prev => [...prev, {
        role: 'system',
        content: 'All questions answered! Generating your agent...'
      }]);

      await new Promise(r => setTimeout(r, 2000));

      // Check required connections
      const requiredServices = getRequiredServices();
      if (requiredServices.length > 0) {
        setChatMessages(prev => [...prev, {
          role: 'assistant',
          content: `Before I can create this agent, you'll need to connect the following services:\n\n${requiredServices.map(s => `- ${s.name} ${s.icon}`).join('\n')}\n\nPlease connect these services to continue.`
        }]);
        setPhase('connecting');
      } else {
        await generateAgent(newAnswers);
      }
      setIsThinking(false);
    }
  };

  // Get required services based on selected tools
  const getRequiredServices = (): typeof AVAILABLE_SERVICES => {
    const required: typeof AVAILABLE_SERVICES = [];
    selectedTools.forEach(toolId => {
      const tool = AVAILABLE_TOOLS.find(t => t.id === toolId);
      if (tool?.requiresAuth && tool.connectedService) {
        const service = AVAILABLE_SERVICES.find(s => s.service === tool.connectedService);
        if (service && !required.find(r => r.service === service.service)) {
          required.push(service);
        }
      }
    });
    return required;
  };

  // Simulate service connection
  const connectService = async (service: typeof AVAILABLE_SERVICES[0]) => {
    setIsThinking(true);

    // Simulate OAuth flow
    await new Promise(r => setTimeout(r, 1500));

    const newConnection: ServiceConnection = {
      id: `conn_${Date.now()}`,
      service: service.service,
      name: service.name,
      icon: service.icon,
      status: 'connected',
      connectedAt: new Date(),
      scopes: service.scopes,
    };

    setConnections(prev => [...prev, newConnection]);

    setChatMessages(prev => [...prev, {
      role: 'system',
      content: `${service.icon} ${service.name} connected successfully!`
    }]);

    setIsThinking(false);

    // Check if all required services are connected
    const required = getRequiredServices();
    const allConnected = required.every(r =>
      connections.find(c => c.service === r.service) || newConnection.service === r.service
    );

    if (allConnected) {
      await generateAgent(answers);
    }
  };

  // Generate the agent
  const generateAgent = async (finalAnswers: Record<string, string>) => {
    setIsThinking(true);

    await new Promise(r => setTimeout(r, 1500));

    // Build refined instructions from session and answers
    const instructions = buildInstructions(finalAnswers);

    // Get the selected trigger config
    const triggerDef = AVAILABLE_TRIGGERS.find(t => t.name === selectedTrigger);

    const agent: AgentDefinition = {
      id: `agent_${Date.now()}`,
      name: generateAgentName(session?.initialDescription || ''),
      description: session?.initialDescription || '',
      instructions,
      memoryBank: [
        {
          id: 'mem_1',
          type: 'instruction',
          content: instructions,
          source: 'initial',
          createdAt: new Date(),
          updatedAt: new Date(),
          usageCount: 0,
        },
      ],
      triggers: triggerDef ? [{
        id: `trigger_${Date.now()}`,
        ...triggerDef,
      }] : [],
      tools: AVAILABLE_TOOLS.filter(t => selectedTools.includes(t.id)),
      connections,
      status: 'active',
      createdAt: new Date(),
      updatedAt: new Date(),
      createdBy: 'current_user',
    };

    setGeneratedAgent(agent);
    setPhase('review');

    setChatMessages(prev => [...prev, {
      role: 'assistant',
      content: `Your agent "${agent.name}" has been created successfully!\n\nIt will run ${selectedTrigger?.toLowerCase() || 'on demand'} and use the following tools:\n${selectedTools.map(t => `- ${AVAILABLE_TOOLS.find(at => at.id === t)?.name}`).join('\n')}\n\nYou can review the configuration and then activate the agent.`
    }]);

    setIsThinking(false);
  };

  // Build instructions from answers
  const buildInstructions = (finalAnswers: Record<string, string>): string => {
    let instructions = `You are a Customer Success agent that ${session?.initialDescription}.\n\n`;

    if (finalAnswers.delivery_channel) {
      instructions += `Delivery: Send outputs via ${finalAnswers.delivery_channel}.\n`;
    }
    if (finalAnswers.schedule_time) {
      instructions += `Schedule: Run at ${finalAnswers.schedule_time}.\n`;
    }
    if (finalAnswers.customer_scope) {
      instructions += `Scope: ${finalAnswers.customer_scope}.\n`;
    }
    if (finalAnswers.recipient) {
      instructions += `Recipient: ${finalAnswers.recipient}.\n`;
    }
    if (finalAnswers.format_preferences) {
      instructions += `Format: ${finalAnswers.format_preferences}.\n`;
    }

    instructions += `\nBehavior:\n`;
    instructions += `- Always be helpful and proactive\n`;
    instructions += `- If you encounter issues, use notify_user to alert the CSM\n`;
    instructions += `- Update your memory when you learn new preferences\n`;
    instructions += `- Prioritize customer health and success\n`;

    return instructions;
  };

  // Generate a name for the agent
  const generateAgentName = (desc: string): string => {
    const lowerDesc = desc.toLowerCase();
    if (lowerDesc.includes('briefer') || lowerDesc.includes('briefing')) return 'Daily Briefer';
    if (lowerDesc.includes('health') && lowerDesc.includes('monitor')) return 'Health Monitor';
    if (lowerDesc.includes('risk') || lowerDesc.includes('churn')) return 'Risk Detector';
    if (lowerDesc.includes('onboarding')) return 'Onboarding Assistant';
    if (lowerDesc.includes('meeting') || lowerDesc.includes('schedule')) return 'Meeting Scheduler';
    return 'Custom Agent';
  };

  // Activate and save the agent
  const handleActivate = () => {
    if (generatedAgent) {
      onAgentCreated(generatedAgent);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-cscx-gray-900 border border-cscx-gray-800 rounded-2xl w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-cscx-gray-800">
          <div>
            <h2 className="text-2xl font-bold text-white flex items-center gap-3">
              <span className="text-3xl">{phase === 'settings' ? '⚙️' : '🛠️'}</span>
              {phase === 'settings' ? 'Agent Settings' : 'Agent Builder'}
            </h2>
            <p className="text-cscx-gray-400 mt-1">
              {phase === 'settings'
                ? `Configure ${agent?.name || 'agent'} settings and behavior`
                : 'Create agents using natural language - no code required'
              }
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-cscx-gray-800 rounded-lg transition-colors"
          >
            <span className="text-2xl">✕</span>
          </button>
        </div>

        {/* Progress Steps - only show in create mode */}
        {phase !== 'settings' && (
        <div className="flex items-center justify-center gap-2 p-4 border-b border-cscx-gray-800">
          {['describe', 'refining', 'connecting', 'review'].map((step, i) => (
            <React.Fragment key={step}>
              <div className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-sm ${
                phase === step
                  ? 'bg-cscx-accent text-white'
                  : ['describe', 'refining', 'connecting', 'review'].indexOf(phase) > i
                    ? 'bg-green-500/20 text-green-400'
                    : 'bg-cscx-gray-800 text-cscx-gray-500'
              }`}>
                <span>{i + 1}</span>
                <span className="capitalize">{step}</span>
              </div>
              {i < 3 && <div className="w-8 h-0.5 bg-cscx-gray-700" />}
            </React.Fragment>
          ))}
        </div>
        )}

        {/* Chat Interface */}
        <div ref={chatRef} className="flex-1 overflow-y-auto p-6 space-y-4">
          {phase === 'describe' && chatMessages.length === 0 && (
            <div className="text-center py-12">
              <div className="text-6xl mb-4">🤖</div>
              <h3 className="text-xl font-bold text-white mb-2">Describe Your Agent</h3>
              <p className="text-cscx-gray-400 max-w-md mx-auto">
                Tell me what you want your agent to do in plain English. I'll ask follow-up questions to make sure I understand correctly.
              </p>
              <div className="mt-6 flex flex-wrap gap-2 justify-center">
                {[
                  'Create a daily briefer that summarizes my calendar',
                  'Monitor customer health and alert me of risks',
                  'Send weekly reports to at-risk customers',
                ].map((example) => (
                  <button
                    key={example}
                    onClick={() => setDescription(example)}
                    className="px-3 py-1.5 bg-cscx-gray-800 hover:bg-cscx-gray-700 text-cscx-gray-300 text-sm rounded-lg transition-colors"
                  >
                    "{example}"
                  </button>
                ))}
              </div>
            </div>
          )}

          {chatMessages.map((msg, i) => (
            <div
              key={i}
              className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
            >
              <div className={`max-w-[80%] rounded-2xl px-4 py-3 ${
                msg.role === 'user'
                  ? 'bg-cscx-accent text-white'
                  : msg.role === 'system'
                    ? 'bg-cscx-gray-800 text-cscx-gray-300 italic'
                    : 'bg-cscx-gray-800 text-white'
              }`}>
                <p className="whitespace-pre-wrap">{msg.content}</p>
              </div>
            </div>
          ))}

          {isThinking && (
            <div className="flex justify-start">
              <div className="bg-cscx-gray-800 rounded-2xl px-4 py-3 flex items-center gap-2">
                <div className="flex gap-1">
                  <div className="w-2 h-2 bg-cscx-accent rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                  <div className="w-2 h-2 bg-cscx-accent rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                  <div className="w-2 h-2 bg-cscx-accent rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                </div>
                <span className="text-cscx-gray-400">Thinking...</span>
              </div>
            </div>
          )}

          {/* Service Connection Cards */}
          {phase === 'connecting' && (
            <div className="grid grid-cols-2 gap-4 mt-4">
              {getRequiredServices().map((service) => {
                const isConnected = connections.find(c => c.service === service.service);
                return (
                  <div
                    key={service.service}
                    className={`p-4 rounded-xl border ${
                      isConnected
                        ? 'bg-green-500/10 border-green-500/30'
                        : 'bg-cscx-gray-800 border-cscx-gray-700'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <span className="text-2xl">{service.icon}</span>
                        <div>
                          <h4 className="text-white font-medium">{service.name}</h4>
                          <p className="text-xs text-cscx-gray-400">
                            {service.scopes.join(', ')}
                          </p>
                        </div>
                      </div>
                      {isConnected ? (
                        <span className="text-green-400 text-sm">Connected</span>
                      ) : (
                        <button
                          onClick={() => connectService(service)}
                          disabled={isThinking}
                          className="px-3 py-1.5 bg-cscx-accent hover:bg-red-700 text-white text-sm rounded-lg transition-colors disabled:opacity-50"
                        >
                          Connect
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* Agent Review */}
          {phase === 'review' && generatedAgent && (
            <div className="mt-6 space-y-4">
              <div className="bg-cscx-gray-800 rounded-xl p-6">
                <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
                  <span>📋</span> Agent Configuration
                </h3>

                <div className="space-y-4">
                  <div>
                    <label className="text-sm text-cscx-gray-400">Name</label>
                    <p className="text-white font-medium">{generatedAgent.name}</p>
                  </div>

                  <div>
                    <label className="text-sm text-cscx-gray-400">Instructions</label>
                    <pre className="mt-1 p-3 bg-cscx-gray-900 rounded-lg text-sm text-cscx-gray-300 whitespace-pre-wrap font-mono">
                      {generatedAgent.instructions}
                    </pre>
                  </div>

                  <div>
                    <label className="text-sm text-cscx-gray-400">Trigger</label>
                    <p className="text-white">{generatedAgent.triggers[0]?.name || 'Manual'}</p>
                  </div>

                  <div>
                    <label className="text-sm text-cscx-gray-400">Tools</label>
                    <div className="flex flex-wrap gap-2 mt-1">
                      {generatedAgent.tools.map(tool => (
                        <span key={tool.id} className="px-2 py-1 bg-cscx-gray-700 text-sm text-white rounded">
                          {tool.name}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Agent Settings Mode */}
          {phase === 'settings' && agent && (
            <div className="space-y-6">
              <div className="bg-cscx-gray-800 rounded-xl p-6">
                <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
                  <span>⚙️</span> {agent.name} Settings
                </h3>

                <div className="space-y-6">
                  {/* Status Toggle */}
                  <div>
                    <label className="text-sm font-medium text-cscx-gray-400 mb-2 block">Status</label>
                    <div className="flex gap-2">
                      {(['active', 'paused', 'disabled'] as const).map((status: 'active' | 'paused' | 'disabled') => (
                        <button
                          key={status}
                          onClick={() => setEditedStatus(status)}
                          className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                            editedStatus === status
                              ? status === 'active' ? 'bg-green-500/20 text-green-400 border border-green-500/30'
                                : status === 'paused' ? 'bg-yellow-500/20 text-yellow-400 border border-yellow-500/30'
                                : 'bg-gray-500/20 text-gray-400 border border-gray-500/30'
                              : 'bg-cscx-gray-700 text-cscx-gray-400 hover:bg-cscx-gray-600'
                          }`}
                        >
                          {status.charAt(0).toUpperCase() + status.slice(1)}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Instructions Editor */}
                  <div>
                    <label className="text-sm font-medium text-cscx-gray-400 mb-2 block">Instructions (Memory)</label>
                    <textarea
                      value={editedInstructions}
                      onChange={(e) => setEditedInstructions(e.target.value)}
                      rows={10}
                      className="w-full bg-cscx-gray-900 border border-cscx-gray-700 rounded-lg px-4 py-3 text-white font-mono text-sm focus:outline-none focus:border-cscx-accent resize-none"
                    />
                  </div>

                  {/* Current Trigger */}
                  <div>
                    <label className="text-sm font-medium text-cscx-gray-400 mb-2 block">Trigger</label>
                    <div className="flex items-center gap-3 p-3 bg-cscx-gray-900 rounded-lg">
                      <span className="text-lg">⚡</span>
                      <div>
                        <p className="text-white font-medium">{agent.triggers[0]?.name || 'Manual'}</p>
                        <p className="text-xs text-cscx-gray-500">{agent.triggers[0]?.description || 'No automatic trigger configured'}</p>
                      </div>
                    </div>
                  </div>

                  {/* Current Tools */}
                  <div>
                    <label className="text-sm font-medium text-cscx-gray-400 mb-2 block">Tools ({agent.tools.length})</label>
                    <div className="flex flex-wrap gap-2">
                      {agent.tools.map(tool => (
                        <span key={tool.id} className="px-3 py-1.5 bg-cscx-gray-900 text-sm text-white rounded-lg flex items-center gap-2">
                          🔧 {tool.name}
                        </span>
                      ))}
                    </div>
                  </div>

                  {/* Connections */}
                  <div>
                    <label className="text-sm font-medium text-cscx-gray-400 mb-2 block">Connected Services</label>
                    <div className="flex flex-wrap gap-2">
                      {agent.connections.map(conn => (
                        <span
                          key={conn.id}
                          className={`px-3 py-1.5 text-sm rounded-lg flex items-center gap-2 ${
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
                  {agent.memoryBank.length > 0 && (
                    <div>
                      <label className="text-sm font-medium text-cscx-gray-400 mb-2 block">
                        🧠 Learned Behaviors ({agent.memoryBank.length})
                      </label>
                      <div className="space-y-2 max-h-32 overflow-y-auto">
                        {agent.memoryBank.map(mem => (
                          <div key={mem.id} className="p-3 bg-cscx-gray-900 rounded-lg text-sm">
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
              </div>
            </div>
          )}
        </div>

        {/* Input Area */}
        <div className="p-4 border-t border-cscx-gray-800">
          {phase === 'describe' && (
            <form
              onSubmit={(e) => {
                e.preventDefault();
                if (description.trim()) analyzeDescription(description);
              }}
              className="flex gap-3"
            >
              <input
                type="text"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Describe what you want your agent to do..."
                className="flex-1 bg-cscx-gray-800 border border-cscx-gray-700 rounded-xl px-4 py-3 text-white placeholder-cscx-gray-500 focus:outline-none focus:border-cscx-accent"
              />
              <button
                type="submit"
                disabled={!description.trim() || isThinking}
                className="px-6 py-3 bg-cscx-accent hover:bg-red-700 text-white font-medium rounded-xl transition-colors disabled:opacity-50"
              >
                Create Agent
              </button>
            </form>
          )}

          {phase === 'refining' && session && (
            <form
              onSubmit={(e) => {
                e.preventDefault();
                const input = (e.target as HTMLFormElement).answer as HTMLInputElement;
                if (input.value.trim()) {
                  handleAnswerSubmit(input.value);
                  input.value = '';
                }
              }}
              className="flex gap-3"
            >
              <input
                name="answer"
                type="text"
                placeholder="Type your answer..."
                className="flex-1 bg-cscx-gray-800 border border-cscx-gray-700 rounded-xl px-4 py-3 text-white placeholder-cscx-gray-500 focus:outline-none focus:border-cscx-accent"
                disabled={isThinking}
              />
              <button
                type="submit"
                disabled={isThinking}
                className="px-6 py-3 bg-cscx-accent hover:bg-red-700 text-white font-medium rounded-xl transition-colors disabled:opacity-50"
              >
                Submit
              </button>
            </form>
          )}

          {phase === 'review' && (
            <div className="flex gap-3">
              <button
                onClick={() => setPhase('describe')}
                className="flex-1 px-6 py-3 bg-cscx-gray-800 hover:bg-cscx-gray-700 text-white font-medium rounded-xl transition-colors"
              >
                Start Over
              </button>
              <button
                onClick={handleActivate}
                className="flex-1 px-6 py-3 bg-cscx-accent hover:bg-red-700 text-white font-medium rounded-xl transition-colors flex items-center justify-center gap-2"
              >
                <span>🚀</span> Activate Agent
              </button>
            </div>
          )}

          {phase === 'settings' && agent && (
            <div className="flex gap-3">
              <button
                onClick={onClose}
                className="flex-1 px-6 py-3 bg-cscx-gray-800 hover:bg-cscx-gray-700 text-white font-medium rounded-xl transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  // Create updated agent with edited values
                  const updatedAgent: AgentDefinition = {
                    ...agent,
                    instructions: editedInstructions,
                    status: editedStatus,
                    updatedAt: new Date(),
                  };
                  onAgentCreated(updatedAgent);
                }}
                className="flex-1 px-6 py-3 bg-cscx-accent hover:bg-red-700 text-white font-medium rounded-xl transition-colors flex items-center justify-center gap-2"
              >
                <span>💾</span> Save Settings
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default AgentBuilder;
