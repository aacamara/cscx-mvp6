/**
 * AIPanel - Context-Aware AI Assistant
 * Embedded in the unified onboarding view
 * Adapts behavior based on current workflow phase
 */

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useAuth } from '../../context/AuthContext';
import { PendingApprovals } from '../PendingApprovals';
import { OnboardingPhase } from '../../types/workflow';
import { StreamEvent } from '../../types/streaming';

const API_URL = import.meta.env.VITE_API_URL || '';

// ============================================
// Types
// ============================================

interface Message {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: Date;
  agentType?: string;
  isThinking?: boolean;
  isStreaming?: boolean;
  stoppedByUser?: boolean;
  metadata?: {
    phase?: OnboardingPhase;
    toolsUsed?: string[];
    approvalId?: string;
  };
}

interface AIContext {
  phase: OnboardingPhase;
  customerName?: string;
  customerId?: string;
  arr?: number;
  contractData?: any;
  plan?: any;
  workflowState?: any;
}

interface AIPanelProps {
  context: AIContext;
  onApprovalChange?: () => void;
  embedded?: boolean;
  minimized?: boolean;
  onToggleMinimize?: () => void;
}

interface QuickAction {
  id: string;
  label: string;
  icon: string;
  prompt: string;
  phases: OnboardingPhase[];
}

// ============================================
// Phase-specific Quick Actions
// ============================================

const QUICK_ACTIONS: QuickAction[] = [
  // Upload phase
  { id: 'explain-process', label: 'Explain Process', icon: '❓', prompt: 'What will happen when I upload a contract?', phases: ['upload'] },
  { id: 'supported-formats', label: 'Supported Formats', icon: '📄', prompt: 'What file formats can I upload?', phases: ['upload'] },

  // Parsing/Review phase
  { id: 'explain-extraction', label: 'Explain Data', icon: '🔍', prompt: 'Explain what data was extracted and why it matters.', phases: ['parsing', 'review'] },
  { id: 'missing-info', label: 'Missing Info', icon: '⚠️', prompt: 'What information is missing from this contract?', phases: ['review'] },
  { id: 'validate-data', label: 'Validate Data', icon: '✅', prompt: 'Are there any issues with the extracted data?', phases: ['review'] },

  // Planning phase
  { id: 'explain-plan', label: 'Explain Plan', icon: '📋', prompt: 'Walk me through this onboarding plan.', phases: ['planning', 'plan_review'] },
  { id: 'customize-plan', label: 'Customize', icon: '✏️', prompt: 'How can I customize this plan for this customer?', phases: ['plan_review'] },

  // Execution phase
  { id: 'next-steps', label: 'Next Steps', icon: '➡️', prompt: 'What should I focus on next for this customer?', phases: ['executing'] },
  { id: 'schedule-meeting', label: 'Schedule Meeting', icon: '📅', prompt: 'Help me schedule a kickoff meeting with the stakeholders.', phases: ['executing'] },
  { id: 'draft-email', label: 'Draft Email', icon: '✉️', prompt: 'Draft a welcome email for this customer.', phases: ['executing'] },
  { id: 'check-health', label: 'Check Health', icon: '💚', prompt: 'What is the current health score and any risk signals?', phases: ['executing', 'monitoring'] },

  // Monitoring phase
  { id: 'churn-risk', label: 'Churn Analysis', icon: '⚡', prompt: 'Are there any churn signals for this customer?', phases: ['monitoring'] },
  { id: 'expansion-opps', label: 'Expansion', icon: '📈', prompt: 'What expansion opportunities exist for this customer?', phases: ['monitoring'] },
];

// ============================================
// Phase-specific Welcome Messages
// ============================================

const PHASE_PROMPTS: Record<OnboardingPhase, { welcome: string; context: string }> = {
  upload: {
    welcome: "Ready to analyze your contract! Upload a PDF or paste text to get started.",
    context: "I'll extract customer info, entitlements, stakeholders, and more."
  },
  parsing: {
    welcome: "Analyzing your contract...",
    context: "I'm extracting key information. This usually takes 10-20 seconds."
  },
  review: {
    welcome: "Contract analysis complete!",
    context: "Review the extracted data below. I can explain any section or help fix issues."
  },
  enriching: {
    welcome: "Gathering additional intelligence...",
    context: "I'm researching the company and mapping stakeholders."
  },
  planning: {
    welcome: "Creating your onboarding plan...",
    context: "I'm generating a customized 30-60-90 day plan based on the contract."
  },
  plan_review: {
    welcome: "Onboarding plan ready for review!",
    context: "Check each phase and task. I can explain my reasoning or make adjustments."
  },
  executing: {
    welcome: "Agents are active!",
    context: "I'm coordinating your customer onboarding. Ask me to schedule meetings, draft emails, or check progress."
  },
  monitoring: {
    welcome: "Monitoring customer health...",
    context: "I'm tracking engagement and watching for churn signals or expansion opportunities."
  },
  completed: {
    welcome: "Onboarding complete! 🎉",
    context: "This customer is now in steady state. Ask me for a summary or next steps."
  }
};

// ============================================
// Component
// ============================================

export const AIPanel: React.FC<AIPanelProps> = ({
  context,
  onApprovalChange,
  embedded = true,
  minimized = false,
  onToggleMinimize
}) => {
  const { hasGoogleAccess, getAuthHeaders } = useAuth();
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isStreaming, setIsStreaming] = useState(false);
  const [sessionId] = useState(() => `session_${Date.now()}`);
  const [refreshApprovals, setRefreshApprovals] = useState(0);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  // Get phase-specific content
  const phaseContent = PHASE_PROMPTS[context.phase] || PHASE_PROMPTS['upload'];
  const quickActions = QUICK_ACTIONS.filter(a => a.phases.includes(context.phase));

  // Auto-scroll to bottom - use 'auto' during streaming for immediate scrolling
  const scrollToBottom = useCallback((immediate = false) => {
    messagesEndRef.current?.scrollIntoView({ behavior: immediate ? 'auto' : 'smooth' });
  }, []);

  // Scroll when messages change - immediate during streaming
  useEffect(() => {
    scrollToBottom(isStreaming);
  }, [messages, isStreaming, scrollToBottom]);

  // Add welcome message when phase changes
  useEffect(() => {
    const welcomeMessage: Message = {
      id: `welcome_${context.phase}_${Date.now()}`,
      role: 'assistant',
      content: `${phaseContent.welcome}\n\n${phaseContent.context}`,
      timestamp: new Date(),
      metadata: { phase: context.phase }
    };

    // Only add if we don't have a welcome for this phase yet
    setMessages(prev => {
      const hasWelcome = prev.some(m =>
        m.metadata?.phase === context.phase && m.id.startsWith('welcome_')
      );
      if (hasWelcome) return prev;
      return [...prev, welcomeMessage];
    });
  }, [context.phase]);

  // Helper to save chat message to database
  const saveChatMessage = async (role: string, content: string, agentType?: string, toolCalls?: any[]) => {
    if (!context.customerId) return; // Only save if we have a customer context
    try {
      await fetch(`${API_URL}/api/agent-activities/chat-message`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...getAuthHeaders(),
        },
        body: JSON.stringify({
          customerId: context.customerId,
          role,
          content,
          agentType,
          toolCalls,
          sessionId,
        }),
      });
    } catch (err) {
      console.error('Failed to save chat message:', err);
    }
  };

  // Parse SSE data from a chunk
  const parseSSEData = (chunk: string): StreamEvent[] => {
    const events: StreamEvent[] = [];
    const lines = chunk.split('\n');

    for (const line of lines) {
      if (line.startsWith('data: ')) {
        try {
          const data = JSON.parse(line.slice(6));
          events.push(data);
        } catch {
          // Ignore parse errors for incomplete chunks
        }
      }
    }

    return events;
  };

  const sendMessage = async (content: string) => {
    if (!content.trim() || isLoading || isStreaming) return;

    const userMessage: Message = {
      id: `msg_${Date.now()}`,
      role: 'user',
      content: content.trim(),
      timestamp: new Date(),
    };

    setMessages(prev => [...prev, userMessage]);
    setInput('');
    setIsLoading(true);

    // Save user message to database
    saveChatMessage('user', content.trim());

    // Create streaming message placeholder
    const streamingMessageId = `stream_${Date.now()}`;
    setMessages(prev => [...prev, {
      id: streamingMessageId,
      role: 'assistant',
      content: '',
      timestamp: new Date(),
      isStreaming: true,
    }]);

    // Create abort controller for cancellation
    const abortController = new AbortController();
    abortControllerRef.current = abortController;

    let accumulatedContent = '';
    let toolsUsed: string[] = [];
    let wasAborted = false;

    try {
      setIsStreaming(true);

      const response = await fetch(`${API_URL}/api/agents/chat/stream`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...getAuthHeaders(),
        },
        body: JSON.stringify({
          message: content.trim(),
          sessionId,
          context: {
            phase: context.phase,
            customerName: context.customerName,
            customerId: context.customerId,
            arr: context.arr,
            contractData: context.contractData,
            plan: context.plan,
          },
        }),
        signal: abortController.signal,
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const reader = response.body?.getReader();
      if (!reader) {
        throw new Error('No response body');
      }

      const decoder = new TextDecoder();

      while (true) {
        const { done, value } = await reader.read();

        if (done) break;

        const chunk = decoder.decode(value, { stream: true });
        const events = parseSSEData(chunk);

        for (const event of events) {
          switch (event.type) {
            case 'token':
              if (event.content) {
                accumulatedContent += event.content;
                // Update the streaming message with new content
                setMessages(prev => prev.map(m =>
                  m.id === streamingMessageId
                    ? { ...m, content: accumulatedContent }
                    : m
                ));
              }
              break;

            case 'tool_start':
              if (event.name) {
                toolsUsed.push(event.name);
              }
              break;

            case 'tool_end':
              // Tool completed - could show indicator
              break;

            case 'thinking':
              // Show thinking indicator
              setMessages(prev => prev.map(m =>
                m.id === streamingMessageId
                  ? { ...m, isThinking: true, content: accumulatedContent || 'Thinking...' }
                  : m
              ));
              break;

            case 'done':
              // Stream completed
              break;

            case 'error':
              throw new Error(event.error || 'Stream error');
          }
        }
      }

      // Finalize the message
      setMessages(prev => prev.map(m =>
        m.id === streamingMessageId
          ? {
              ...m,
              content: accumulatedContent || 'I encountered an issue. Please try again.',
              isStreaming: false,
              isThinking: false,
              metadata: {
                phase: context.phase,
                toolsUsed: toolsUsed.length > 0 ? toolsUsed : undefined,
              }
            }
          : m
      ));

      // Save assistant response to database
      saveChatMessage('assistant', accumulatedContent, undefined, toolsUsed.length > 0 ? toolsUsed : undefined);

    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') {
        wasAborted = true;
        // User cancelled - mark message appropriately
        setMessages(prev => prev.map(m =>
          m.id === streamingMessageId
            ? {
                ...m,
                content: accumulatedContent + (accumulatedContent ? ' ' : '') + '[Stopped by user]',
                isStreaming: false,
                isThinking: false,
                stoppedByUser: true,
              }
            : m
        ));
      } else {
        console.error('Streaming request failed:', error);
        setMessages(prev => prev.map(m =>
          m.id === streamingMessageId
            ? {
                ...m,
                content: 'Sorry, I encountered an error. Please try again.',
                isStreaming: false,
                isThinking: false,
              }
            : m
        ));
      }
    } finally {
      setIsLoading(false);
      setIsStreaming(false);
      abortControllerRef.current = null;
    }
  };

  // Handle stop button click - abort the current streaming request
  const handleStop = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
  };

  const handleQuickAction = (action: QuickAction) => {
    sendMessage(action.prompt);
  };

  // Minimized view
  if (minimized) {
    return (
      <button
        onClick={onToggleMinimize}
        className="fixed bottom-6 right-6 w-14 h-14 bg-cscx-accent hover:bg-red-700 rounded-full shadow-lg flex items-center justify-center text-2xl transition-all z-50"
      >
        🤖
      </button>
    );
  }

  return (
    <div className={`flex flex-col bg-cscx-gray-900 border-l border-cscx-gray-800 ${embedded ? 'h-full' : 'h-[600px] rounded-xl'}`}>
      {/* Header */}
      <div className="p-4 border-b border-cscx-gray-800 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-cscx-accent rounded-lg flex items-center justify-center text-lg">
            🤖
          </div>
          <div>
            <h3 className="text-white font-medium text-sm">AI Assistant</h3>
            <p className="text-xs text-cscx-gray-400 capitalize">{context.phase.replace('_', ' ')}</p>
          </div>
        </div>
        {onToggleMinimize && (
          <button
            onClick={onToggleMinimize}
            className="text-cscx-gray-400 hover:text-white transition-colors"
          >
            ➖
          </button>
        )}
      </div>

      {/* Customer Context */}
      {context.customerName && (
        <div className="px-4 py-2 bg-cscx-gray-800/50 border-b border-cscx-gray-800">
          <div className="flex items-center justify-between text-xs">
            <span className="text-cscx-gray-400">Customer:</span>
            <span className="text-white font-medium">{context.customerName}</span>
          </div>
          {context.arr && (
            <div className="flex items-center justify-between text-xs mt-1">
              <span className="text-cscx-gray-400">ARR:</span>
              <span className="text-cscx-accent font-medium">${context.arr.toLocaleString()}</span>
            </div>
          )}
        </div>
      )}

      {/* Pending Approvals */}
      <div className="border-b border-cscx-gray-800">
        <PendingApprovals
          onApprovalChange={onApprovalChange}
          refreshTrigger={refreshApprovals}
          compact
        />
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {messages.map((message) => (
          <div
            key={message.id}
            className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
          >
            <div
              className={`max-w-[90%] rounded-xl px-3 py-2 ${
                message.role === 'user'
                  ? 'bg-cscx-accent text-white'
                  : message.role === 'system'
                  ? 'bg-yellow-900/30 border border-yellow-600/50 text-yellow-200'
                  : 'bg-cscx-gray-800 text-white'
              }`}
            >
              {message.isThinking && !message.content ? (
                <div className="flex items-center gap-2">
                  <div className="animate-spin rounded-full h-3 w-3 border-2 border-white border-t-transparent" />
                  <span className="text-sm">Thinking...</span>
                </div>
              ) : (
                <>
                  {message.agentType && message.role === 'assistant' && (
                    <div className="text-xs text-cscx-gray-400 mb-1 capitalize">
                      {message.agentType} Agent
                    </div>
                  )}
                  <div className="whitespace-pre-wrap text-sm leading-relaxed">
                    {message.content}
                    {message.isStreaming && (
                      <span className="inline-block w-2 h-4 ml-0.5 bg-white animate-pulse" />
                    )}
                  </div>
                  {message.stoppedByUser && (
                    <div className="text-xs text-yellow-400 mt-1 italic">
                      Response stopped
                    </div>
                  )}
                </>
              )}
            </div>
          </div>
        ))}
        <div ref={messagesEndRef} />
      </div>

      {/* Quick Actions */}
      {quickActions.length > 0 && messages.length <= 2 && (
        <div className="px-4 py-2 border-t border-cscx-gray-800">
          <p className="text-xs text-cscx-gray-400 mb-2">Quick Actions</p>
          <div className="flex flex-wrap gap-1">
            {quickActions.slice(0, 4).map((action) => (
              <button
                key={action.id}
                onClick={() => handleQuickAction(action)}
                disabled={isLoading}
                className="px-2 py-1 bg-cscx-gray-800 hover:bg-cscx-gray-700 text-white text-xs rounded transition-colors flex items-center gap-1"
              >
                <span>{action.icon}</span>
                {action.label}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Input Area */}
      <div className="p-3 border-t border-cscx-gray-800">
        <div className="flex gap-2">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && !isStreaming && sendMessage(input)}
            placeholder={isStreaming ? "AI is responding..." : "Ask me anything..."}
            disabled={isLoading || isStreaming}
            className="flex-1 bg-cscx-gray-800 border border-cscx-gray-700 rounded-lg px-3 py-2 text-white text-sm placeholder-cscx-gray-500 focus:outline-none focus:border-cscx-accent disabled:opacity-50"
          />
          {isStreaming ? (
            <button
              onClick={handleStop}
              className="px-4 py-2 bg-yellow-600 hover:bg-yellow-700 text-white text-sm font-medium rounded-lg transition-colors flex items-center gap-1.5"
            >
              <span className="w-3 h-3 bg-white rounded-sm" />
              Stop
            </button>
          ) : (
            <button
              onClick={() => sendMessage(input)}
              disabled={isLoading || !input.trim()}
              className="px-4 py-2 bg-cscx-accent hover:bg-red-700 text-white text-sm font-medium rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isLoading ? '...' : '→'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default AIPanel;
