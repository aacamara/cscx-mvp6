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
import { CADGPlanCard, CADGPlanMetadata } from './CADGPlanCard';

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
  isRetrying?: boolean;
  cadgPlan?: CADGPlanMetadata;
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
  const retryTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Cleanup retry timeout on unmount
  useEffect(() => {
    return () => {
      if (retryTimeoutRef.current) {
        clearTimeout(retryTimeoutRef.current);
      }
    };
  }, []);

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

  // Check if error is a connection/network error that warrants retry
  const isConnectionError = (error: Error): boolean => {
    // Network offline
    if (!navigator.onLine) return true;
    // Fetch failed (network error, CORS, server down)
    if (error.name === 'TypeError' && error.message.includes('fetch')) return true;
    // Generic network errors
    if (error.message.includes('network') || error.message.includes('Network')) return true;
    // Connection refused/reset
    if (error.message.includes('ECONNREFUSED') || error.message.includes('ECONNRESET')) return true;
    // HTTP 5xx errors (server issues) - these might be transient
    if (error.message.match(/HTTP 5\d{2}/)) return true;
    return false;
  };

  // Calculate exponential backoff delay: 1s, 2s, 4s
  const getRetryDelay = (attempt: number): number => {
    return Math.pow(2, attempt) * 1000; // 1000, 2000, 4000
  };

  const sendMessage = async (content: string, retryAttempt = 0): Promise<void> => {
    if (!content.trim() || (isLoading && retryAttempt === 0) || (isStreaming && retryAttempt === 0)) return;

    const maxRetries = 3;
    const isRetry = retryAttempt > 0;

    // Only add user message on first attempt
    if (!isRetry) {
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
    }

    // Create or update streaming message placeholder
    const streamingMessageId = isRetry ? `stream_retry_${Date.now()}` : `stream_${Date.now()}`;

    // On retry, remove the previous failed streaming message and add system message
    if (isRetry) {
      const retryDelay = getRetryDelay(retryAttempt - 1);
      setMessages(prev => {
        // Remove any existing "retrying" system message
        const filtered = prev.filter(m => !m.isRetrying);
        return [...filtered, {
          id: `retry_${Date.now()}`,
          role: 'system',
          content: `Connection lost, retrying... (attempt ${retryAttempt}/${maxRetries})`,
          timestamp: new Date(),
          isRetrying: true,
        }];
      });
    }

    setMessages(prev => {
      // If retrying, filter out old streaming messages with no content
      const filtered = isRetry
        ? prev.filter(m => !(m.isStreaming && !m.content))
        : prev;
      return [...filtered, {
        id: streamingMessageId,
        role: 'assistant',
        content: '',
        timestamp: new Date(),
        isStreaming: true,
      }];
    });

    // Create abort controller for cancellation
    const abortController = new AbortController();
    abortControllerRef.current = abortController;

    let accumulatedContent = '';
    let toolsUsed: string[] = [];

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
              // Stream completed - check for CADG plan metadata
              if (event.content) {
                try {
                  const doneData = JSON.parse(event.content);
                  if (doneData.isGenerative && doneData.plan) {
                    // This is a CADG plan response - store the metadata
                    setMessages(prev => prev.map(m =>
                      m.id === streamingMessageId
                        ? {
                            ...m,
                            cadgPlan: {
                              isGenerative: doneData.isGenerative,
                              taskType: doneData.taskType,
                              confidence: doneData.confidence,
                              requiresApproval: doneData.requiresApproval,
                              plan: doneData.plan,
                              capability: doneData.capability,
                              methodology: doneData.methodology,
                            }
                          }
                        : m
                    ));
                  }
                } catch {
                  // Not JSON or not CADG - ignore
                }
              }
              break;

            case 'error':
              throw new Error(event.error || 'Stream error');
          }
        }
      }

      // Success! Remove any retry system messages
      setMessages(prev => prev.filter(m => !m.isRetrying));

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

      // Reset loading states on success
      setIsLoading(false);
      setIsStreaming(false);
      abortControllerRef.current = null;

    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') {
        // User cancelled - mark message appropriately
        setMessages(prev => prev
          .filter(m => !m.isRetrying) // Remove retry messages
          .map(m =>
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
        setIsLoading(false);
        setIsStreaming(false);
        abortControllerRef.current = null;
      } else if (error instanceof Error && isConnectionError(error) && retryAttempt < maxRetries) {
        // Connection error - retry with exponential backoff
        console.warn(`Connection error (attempt ${retryAttempt + 1}/${maxRetries}):`, error.message);

        // Remove the failed streaming message
        setMessages(prev => prev.filter(m => m.id !== streamingMessageId));

        const delay = getRetryDelay(retryAttempt);
        retryTimeoutRef.current = setTimeout(() => {
          sendMessage(content, retryAttempt + 1);
        }, delay);
      } else {
        // Non-recoverable error or max retries exceeded
        console.error('Streaming request failed:', error);

        // Remove retry messages and show final error
        const errorMessage = retryAttempt >= maxRetries
          ? 'Connection failed after multiple attempts. Please refresh the page and try again.'
          : 'Sorry, I encountered an error. Please try again.';

        setMessages(prev => prev
          .filter(m => !m.isRetrying)
          .map(m =>
            m.id === streamingMessageId
              ? {
                  ...m,
                  content: errorMessage,
                  isStreaming: false,
                  isThinking: false,
                }
              : m
          ));

        setIsLoading(false);
        setIsStreaming(false);
        abortControllerRef.current = null;
      }
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
            {/* CADG Plan Card */}
            {message.cadgPlan && !message.isStreaming ? (
              <div className="max-w-[95%] w-full">
                <CADGPlanCard
                  metadata={message.cadgPlan}
                  onApproved={(artifactId) => {
                    console.log('Artifact generated:', artifactId);
                    setRefreshApprovals(prev => prev + 1);
                  }}
                  onRejected={() => {
                    console.log('Plan rejected');
                  }}
                />
              </div>
            ) : (
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
            )}
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
