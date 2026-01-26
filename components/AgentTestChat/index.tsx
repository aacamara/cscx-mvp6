/**
 * AgentTestChat - Debug Mode with Tool Pause/Continue
 * Test agents with ability to pause before tool execution
 */

import React, { useState, useRef, useEffect } from 'react';
import { AgentDefinition, ThreadStep, AVAILABLE_TOOLS } from '../../types/agentBuilder';

interface AgentTestChatProps {
  agent: AgentDefinition;
  onMemoryUpdate?: (oldInstruction: string, newInstruction: string) => void;
}

interface ChatMessage {
  id: string;
  role: 'user' | 'agent' | 'system' | 'tool';
  content: string;
  timestamp: Date;
  toolCall?: {
    name: string;
    input: any;
    status: 'pending' | 'approved' | 'modified' | 'skipped';
  };
}

export const AgentTestChat: React.FC<AgentTestChatProps> = ({ agent, onMemoryUpdate }) => {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [debugMode, setDebugMode] = useState(true);
  const [isProcessing, setIsProcessing] = useState(false);
  const [pendingToolCall, setPendingToolCall] = useState<{
    messageId: string;
    toolName: string;
    toolInput: any;
  } | null>(null);
  const [modifiedInput, setModifiedInput] = useState('');
  const chatRef = useRef<HTMLDivElement>(null);

  // Auto-scroll
  useEffect(() => {
    if (chatRef.current) {
      chatRef.current.scrollTop = chatRef.current.scrollHeight;
    }
  }, [messages]);

  // Initial message
  useEffect(() => {
    setMessages([{
      id: 'init',
      role: 'system',
      content: `Agent "${agent.name}" is ready for testing. Debug mode is ${debugMode ? 'ON' : 'OFF'} - the agent will ${debugMode ? 'pause before executing tools' : 'execute tools automatically'}.`,
      timestamp: new Date(),
    }]);
  }, [agent.id, debugMode]);

  // Simulate agent response
  const processUserMessage = async (userMessage: string) => {
    setIsProcessing(true);

    // Add user message
    const userMsgId = `msg_${Date.now()}`;
    setMessages(prev => [...prev, {
      id: userMsgId,
      role: 'user',
      content: userMessage,
      timestamp: new Date(),
    }]);

    await new Promise(r => setTimeout(r, 1000));

    // Check if user wants to update memory
    const lowerMessage = userMessage.toLowerCase();
    if (lowerMessage.includes('always') || lowerMessage.includes('remember') || lowerMessage.includes('from now on')) {
      // Agent wants to update its memory
      await simulateMemoryUpdate(userMessage);
      return;
    }

    // Simulate agent thinking and tool usage
    await simulateAgentExecution(userMessage);
  };

  // Simulate memory update flow
  const simulateMemoryUpdate = async (userRequest: string) => {
    // Add agent thinking message
    setMessages(prev => [...prev, {
      id: `think_${Date.now()}`,
      role: 'agent',
      content: "I understand you want me to update my behavior. Let me read my current instructions and update them...",
      timestamp: new Date(),
    }]);

    await new Promise(r => setTimeout(r, 1000));

    // Show memory read
    const readMsgId = `read_${Date.now()}`;
    const readToolCall = {
      messageId: readMsgId,
      toolName: 'read_memory',
      toolInput: { file: 'instructions.md' },
    };

    setMessages(prev => [...prev, {
      id: readMsgId,
      role: 'tool',
      content: `Reading agent memory file...`,
      timestamp: new Date(),
      toolCall: {
        name: 'read_memory',
        input: { file: 'instructions.md' },
        status: 'pending',
      },
    }]);

    if (debugMode) {
      setPendingToolCall(readToolCall);
      setIsProcessing(false);
      return;
    }

    await executeMemoryRead(userRequest);
  };

  // Execute memory read
  const executeMemoryRead = async (userRequest: string) => {
    // Show current instructions
    setMessages(prev => prev.map(m =>
      m.toolCall?.name === 'read_memory'
        ? { ...m, toolCall: { ...m.toolCall, status: 'approved' as const } }
        : m
    ));

    await new Promise(r => setTimeout(r, 500));

    setMessages(prev => [...prev, {
      id: `mem_content_${Date.now()}`,
      role: 'system',
      content: `Current memory:\n\n${agent.instructions}`,
      timestamp: new Date(),
    }]);

    await new Promise(r => setTimeout(r, 1000));

    // Now show memory update
    const updateMsgId = `update_${Date.now()}`;
    const oldInstruction = 'Prioritize customer health and success';
    const newInstruction = extractNewInstruction(userRequest);

    setMessages(prev => [...prev, {
      id: updateMsgId,
      role: 'tool',
      content: `Updating memory...\n\nOld: "${oldInstruction}"\nNew: "${newInstruction}"`,
      timestamp: new Date(),
      toolCall: {
        name: 'update_memory',
        input: { oldInstruction, newInstruction, reason: userRequest },
        status: 'pending',
      },
    }]);

    if (debugMode) {
      setPendingToolCall({
        messageId: updateMsgId,
        toolName: 'update_memory',
        toolInput: { oldInstruction, newInstruction },
      });
      setIsProcessing(false);
      return;
    }

    await executeMemoryUpdate(oldInstruction, newInstruction);
  };

  // Execute memory update
  const executeMemoryUpdate = async (oldInstruction: string, newInstruction: string) => {
    setMessages(prev => prev.map(m =>
      m.toolCall?.name === 'update_memory'
        ? { ...m, toolCall: { ...m.toolCall, status: 'approved' as const } }
        : m
    ));

    await new Promise(r => setTimeout(r, 500));

    onMemoryUpdate?.(oldInstruction, newInstruction);

    setMessages(prev => [...prev, {
      id: `updated_${Date.now()}`,
      role: 'agent',
      content: `I've updated my instructions! From now on, I will: ${newInstruction}. This preference has been saved to my memory.`,
      timestamp: new Date(),
    }]);

    setIsProcessing(false);
  };

  // Extract new instruction from user request
  const extractNewInstruction = (userRequest: string): string => {
    const lowerRequest = userRequest.toLowerCase();
    if (lowerRequest.includes('poem')) return 'Always close briefings with a short uplifting poem';
    if (lowerRequest.includes('emoji')) return 'Always include relevant emojis in messages';
    if (lowerRequest.includes('formal')) return 'Use formal tone in all communications';
    if (lowerRequest.includes('brief') || lowerRequest.includes('short')) return 'Keep all messages brief and to the point';
    return userRequest;
  };

  // Simulate agent execution with tools
  const simulateAgentExecution = async (userMessage: string) => {
    // Determine which tools to call based on message
    const toolsToCall = determineToolsToCall(userMessage);

    for (const tool of toolsToCall) {
      const msgId = `tool_${Date.now()}_${tool.name}`;

      setMessages(prev => [...prev, {
        id: msgId,
        role: 'tool',
        content: `Calling ${tool.name}...`,
        timestamp: new Date(),
        toolCall: {
          name: tool.name,
          input: tool.input,
          status: 'pending',
        },
      }]);

      if (debugMode) {
        setPendingToolCall({
          messageId: msgId,
          toolName: tool.name,
          toolInput: tool.input,
        });
        setIsProcessing(false);
        return; // Wait for user approval
      }

      await executeToolCall(tool.name, tool.input);
      await new Promise(r => setTimeout(r, 500));
    }

    // Final agent response
    setMessages(prev => [...prev, {
      id: `response_${Date.now()}`,
      role: 'agent',
      content: generateAgentResponse(userMessage, toolsToCall),
      timestamp: new Date(),
    }]);

    setIsProcessing(false);
  };

  // Determine tools to call
  const determineToolsToCall = (message: string): Array<{ name: string; input: any }> => {
    const tools: Array<{ name: string; input: any }> = [];
    const lowerMessage = message.toLowerCase();

    if (lowerMessage.includes('calendar') || lowerMessage.includes('schedule') || lowerMessage.includes('meeting')) {
      tools.push({ name: 'read_calendar', input: { days: 1 } });
    }
    if (lowerMessage.includes('customer') || lowerMessage.includes('health')) {
      tools.push({ name: 'get_customer_data', input: { customerId: 'current' } });
    }
    if (lowerMessage.includes('risk') || lowerMessage.includes('churn')) {
      tools.push({ name: 'detect_churn_risk', input: { customerId: 'current' } });
    }
    if (lowerMessage.includes('brief') || lowerMessage.includes('report')) {
      tools.push({ name: 'send_slack_dm', input: { userId: 'user@example.com', message: 'Daily Briefing...' } });
    }

    if (tools.length === 0) {
      // Default: just analyze
      tools.push({ name: 'analyze_health_score', input: { customerId: 'current' } });
    }

    return tools;
  };

  // Execute a tool call
  const executeToolCall = async (toolName: string, toolInput: any) => {
    setMessages(prev => prev.map(m =>
      m.toolCall?.name === toolName && m.toolCall.status === 'pending'
        ? { ...m, toolCall: { ...m.toolCall, status: 'approved' as const } }
        : m
    ));

    await new Promise(r => setTimeout(r, 300));

    // Add tool result
    setMessages(prev => [...prev, {
      id: `result_${Date.now()}`,
      role: 'system',
      content: generateToolResult(toolName),
      timestamp: new Date(),
    }]);
  };

  // Generate tool result
  const generateToolResult = (toolName: string): string => {
    switch (toolName) {
      case 'read_calendar':
        return '📅 Calendar: 3 meetings today - 10am Standup, 2pm Customer Call with TechCorp, 4pm Team Sync';
      case 'get_customer_data':
        return '👤 Customer: TechCorp Inc. - $125K ARR, 85% health score, Active status';
      case 'detect_churn_risk':
        return '⚠️ Risk Analysis: Low risk (12%) - Good engagement, recent feature adoption';
      case 'analyze_health_score':
        return '📊 Health Score: 85% (+5% this month) - Strong adoption, regular usage';
      case 'send_slack_dm':
        return '✉️ Message sent successfully to Slack';
      default:
        return `✅ ${toolName} completed successfully`;
    }
  };

  // Generate agent response
  const generateAgentResponse = (userMessage: string, toolsCalled: Array<{ name: string; input: any }>): string => {
    if (toolsCalled.length === 0) {
      return "I've analyzed the situation. How else can I help you?";
    }

    let response = "Here's what I found:\n\n";

    if (toolsCalled.some(t => t.name === 'read_calendar')) {
      response += "📅 You have 3 meetings today. The most important one is the Customer Call with TechCorp at 2pm.\n\n";
    }
    if (toolsCalled.some(t => t.name === 'get_customer_data')) {
      response += "👤 TechCorp is doing well with an 85% health score. They're actively using the platform.\n\n";
    }
    if (toolsCalled.some(t => t.name === 'detect_churn_risk')) {
      response += "✅ No significant churn risk detected. The customer shows healthy engagement patterns.\n\n";
    }

    response += "Is there anything specific you'd like me to do next?";
    return response;
  };

  // Handle tool approval
  const handleToolApproval = async (approved: boolean, modified: boolean = false) => {
    if (!pendingToolCall) return;

    setIsProcessing(true);
    const { messageId, toolName, toolInput } = pendingToolCall;

    if (approved) {
      const finalInput = modified ? JSON.parse(modifiedInput || JSON.stringify(toolInput)) : toolInput;

      setMessages(prev => prev.map(m =>
        m.id === messageId
          ? { ...m, toolCall: { ...m.toolCall!, status: modified ? 'modified' as const : 'approved' as const } }
          : m
      ));

      // Execute based on tool type
      if (toolName === 'update_memory') {
        await executeMemoryUpdate(finalInput.oldInstruction, finalInput.newInstruction);
      } else if (toolName === 'read_memory') {
        await executeMemoryRead(input);
      } else {
        await executeToolCall(toolName, finalInput);
      }
    } else {
      setMessages(prev => prev.map(m =>
        m.id === messageId
          ? { ...m, toolCall: { ...m.toolCall!, status: 'skipped' as const } }
          : m
      ));

      setMessages(prev => [...prev, {
        id: `skipped_${Date.now()}`,
        role: 'system',
        content: `Tool ${toolName} was skipped.`,
        timestamp: new Date(),
      }]);
    }

    setPendingToolCall(null);
    setModifiedInput('');
    setIsProcessing(false);
  };

  // Handle form submit
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isProcessing) return;
    processUserMessage(input);
    setInput('');
  };

  return (
    <div className="bg-cscx-gray-900 border border-cscx-gray-800 rounded-xl overflow-hidden flex flex-col h-[500px]">
      {/* Header */}
      <div className="p-4 border-b border-cscx-gray-800 flex items-center justify-between">
        <div>
          <h3 className="text-lg font-bold text-white flex items-center gap-2">
            <span>🧪</span> Test Chat
          </h3>
          <p className="text-sm text-cscx-gray-400">Testing: {agent.name}</p>
        </div>
        <div className="flex items-center gap-3">
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={debugMode}
              onChange={(e) => setDebugMode(e.target.checked)}
              className="w-4 h-4 rounded border-cscx-gray-700 bg-cscx-gray-800 text-cscx-accent focus:ring-cscx-accent"
            />
            <span className="text-sm text-cscx-gray-300">Debug Mode</span>
          </label>
          <span className={`px-2 py-1 text-xs rounded-full ${debugMode ? 'bg-yellow-500/20 text-yellow-400' : 'bg-green-500/20 text-green-400'}`}>
            {debugMode ? 'Pauses before tools' : 'Auto-execute'}
          </span>
        </div>
      </div>

      {/* Chat Messages */}
      <div ref={chatRef} className="flex-1 overflow-y-auto p-4 space-y-3">
        {messages.map(msg => (
          <div
            key={msg.id}
            className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
          >
            <div className={`max-w-[85%] rounded-xl px-4 py-2 ${
              msg.role === 'user'
                ? 'bg-cscx-accent text-white'
                : msg.role === 'tool'
                  ? 'bg-blue-500/10 border border-blue-500/30 text-blue-300'
                  : msg.role === 'system'
                    ? 'bg-cscx-gray-800 text-cscx-gray-400 text-sm italic'
                    : 'bg-cscx-gray-800 text-white'
            }`}>
              {msg.toolCall && (
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-lg">🔧</span>
                  <span className="font-mono text-sm">{msg.toolCall.name}</span>
                  <span className={`px-1.5 py-0.5 text-xs rounded ${
                    msg.toolCall.status === 'approved' ? 'bg-green-500/20 text-green-400' :
                    msg.toolCall.status === 'modified' ? 'bg-yellow-500/20 text-yellow-400' :
                    msg.toolCall.status === 'skipped' ? 'bg-red-500/20 text-red-400' :
                    'bg-blue-500/20 text-blue-400'
                  }`}>
                    {msg.toolCall.status}
                  </span>
                </div>
              )}
              <p className="whitespace-pre-wrap">{msg.content}</p>
            </div>
          </div>
        ))}

        {isProcessing && !pendingToolCall && (
          <div className="flex justify-start">
            <div className="bg-cscx-gray-800 rounded-xl px-4 py-2 flex items-center gap-2">
              <div className="flex gap-1">
                <div className="w-2 h-2 bg-cscx-accent rounded-full animate-bounce" />
                <div className="w-2 h-2 bg-cscx-accent rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                <div className="w-2 h-2 bg-cscx-accent rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Tool Approval Panel */}
      {pendingToolCall && (
        <div className="p-4 border-t border-cscx-gray-800 bg-yellow-500/5">
          <div className="flex items-start gap-3">
            <span className="text-2xl">⏸️</span>
            <div className="flex-1">
              <p className="text-white font-medium">
                Agent wants to execute: <span className="text-yellow-400 font-mono">{pendingToolCall.toolName}</span>
              </p>
              <pre className="mt-2 p-2 bg-cscx-gray-900 rounded text-xs text-cscx-gray-400 overflow-x-auto">
                {JSON.stringify(pendingToolCall.toolInput, null, 2)}
              </pre>

              <div className="flex gap-2 mt-3">
                <button
                  onClick={() => handleToolApproval(true)}
                  className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white text-sm rounded-lg transition-colors"
                >
                  ✓ Continue
                </button>
                <button
                  onClick={() => {
                    setModifiedInput(JSON.stringify(pendingToolCall.toolInput, null, 2));
                  }}
                  className="px-4 py-2 bg-yellow-600 hover:bg-yellow-700 text-white text-sm rounded-lg transition-colors"
                >
                  ✏️ Modify
                </button>
                <button
                  onClick={() => handleToolApproval(false)}
                  className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white text-sm rounded-lg transition-colors"
                >
                  ✕ Skip
                </button>
              </div>

              {modifiedInput && (
                <div className="mt-3">
                  <textarea
                    value={modifiedInput}
                    onChange={(e) => setModifiedInput(e.target.value)}
                    className="w-full h-24 p-2 bg-cscx-gray-900 border border-cscx-gray-700 rounded text-sm text-white font-mono"
                  />
                  <button
                    onClick={() => handleToolApproval(true, true)}
                    className="mt-2 px-4 py-2 bg-cscx-accent hover:bg-red-700 text-white text-sm rounded-lg transition-colors"
                  >
                    Apply Modified Input
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Input */}
      {!pendingToolCall && (
        <form onSubmit={handleSubmit} className="p-4 border-t border-cscx-gray-800">
          <div className="flex gap-2">
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Test your agent..."
              disabled={isProcessing}
              className="flex-1 bg-cscx-gray-800 border border-cscx-gray-700 rounded-lg px-4 py-2 text-white placeholder-cscx-gray-500 focus:outline-none focus:border-cscx-accent disabled:opacity-50"
            />
            <button
              type="submit"
              disabled={isProcessing || !input.trim()}
              className="px-4 py-2 bg-cscx-accent hover:bg-red-700 text-white rounded-lg transition-colors disabled:opacity-50"
            >
              Send
            </button>
          </div>
          <p className="text-xs text-cscx-gray-500 mt-2">
            Try: "Run a daily brief" or "It should always write a poem"
          </p>
        </form>
      )}
    </div>
  );
};

export default AgentTestChat;
