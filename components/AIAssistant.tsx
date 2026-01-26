/**
 * AI Assistant - Standalone Agent Interface
 * Directly accessible from main navigation for instant AI capabilities
 */

import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '../context/AuthContext';
import { PendingApprovals } from './PendingApprovals';
import { TaskList } from './TaskList';

const API_URL = import.meta.env.VITE_API_URL || '';

interface Message {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: Date;
  agentType?: string;
  isThinking?: boolean;
}

interface CalendarEvent {
  id: string;
  title: string;
  startTime: string;
  endTime: string;
  attendees: string[];
  meetLink?: string;
}

interface Customer {
  id: string;
  name: string;
  industry?: string;
  arr: number;
  health_score: number;
  status: string;
  primary_contact?: {
    name: string;
    email: string;
    title?: string;
  };
}

interface QuickAction {
  id: string;
  label: string;
  icon: string;
  prompt: string;
  requiresGoogle?: boolean;
}

const QUICK_ACTIONS: QuickAction[] = [
  { id: 'meetings', label: "Today's Meetings", icon: '📅', prompt: "What meetings do I have today? Give me a brief for each one.", requiresGoogle: true },
  { id: 'schedule', label: 'Schedule Meeting', icon: '📆', prompt: "Schedule a customer check-in meeting for tomorrow at 2pm.", requiresGoogle: true },
  { id: 'email', label: 'Draft Email', icon: '✉️', prompt: "Draft a follow-up email to a customer thanking them for the kickoff meeting.", requiresGoogle: true },
  { id: 'task', label: 'Create Task', icon: '✅', prompt: "Create a task to follow up with the customer about their onboarding progress.", requiresGoogle: true },
  { id: 'onboard', label: 'Onboarding Plan', icon: '🚀', prompt: "Create a 30-60-90 day onboarding plan for a new enterprise customer with $100K ARR." },
  { id: 'qbr', label: 'QBR Prep', icon: '📊', prompt: "Help me prepare for a Quarterly Business Review. What should I include?" },
];

export function AIAssistant() {
  const { user, hasGoogleAccess, getAuthHeaders } = useAuth();
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [todaysMeetings, setTodaysMeetings] = useState<CalendarEvent[]>([]);
  const [loadingMeetings, setLoadingMeetings] = useState(false);
  const [sessionId] = useState(() => `session_${Date.now()}`);
  const [refreshApprovals, setRefreshApprovals] = useState(0);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [loadingCustomers, setLoadingCustomers] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // Fetch customers on mount
  useEffect(() => {
    fetchCustomers();
  }, []);

  // Fetch today's meetings if Google is connected
  useEffect(() => {
    if (hasGoogleAccess) {
      fetchTodaysMeetings();
    }
  }, [hasGoogleAccess]);

  const fetchCustomers = async () => {
    setLoadingCustomers(true);
    try {
      const response = await fetch(`${API_URL}/api/customers`, {
        headers: getAuthHeaders(),
      });
      if (response.ok) {
        const data = await response.json();
        setCustomers(data.customers || []);
      }
    } catch (error) {
      console.error('Failed to fetch customers:', error);
    } finally {
      setLoadingCustomers(false);
    }
  };

  const fetchTodaysMeetings = async () => {
    setLoadingMeetings(true);
    try {
      const response = await fetch(`${API_URL}/api/google/calendar/events/today`, {
        headers: getAuthHeaders(),
      });
      if (response.ok) {
        const data = await response.json();
        setTodaysMeetings(data.events || []);
      }
    } catch (error) {
      console.error('Failed to fetch meetings:', error);
    } finally {
      setLoadingMeetings(false);
    }
  };

  const sendMessage = async (content: string) => {
    if (!content.trim() || isLoading) return;

    const userMessage: Message = {
      id: `msg_${Date.now()}`,
      role: 'user',
      content: content.trim(),
      timestamp: new Date(),
    };

    setMessages(prev => [...prev, userMessage]);
    setInput('');
    setIsLoading(true);

    // Add thinking indicator
    const thinkingId = `thinking_${Date.now()}`;
    setMessages(prev => [...prev, {
      id: thinkingId,
      role: 'assistant',
      content: 'Thinking...',
      timestamp: new Date(),
      isThinking: true,
    }]);

    try {
      const response = await fetch(`${API_URL}/api/ai/chat`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...getAuthHeaders(),
        },
        body: JSON.stringify({
          message: content.trim(),
          sessionId,
          customerContext: selectedCustomer ? {
            id: selectedCustomer.id,
            name: selectedCustomer.name,
            industry: selectedCustomer.industry,
            arr: selectedCustomer.arr,
            healthScore: selectedCustomer.health_score,
            status: selectedCustomer.status,
            primaryContact: selectedCustomer.primary_contact,
          } : {
            name: 'General Inquiry',
            arr: 0,
            healthScore: 100,
            status: 'active',
          },
        }),
      });

      const data = await response.json();

      // Remove thinking message and add real response
      setMessages(prev => {
        const filtered = prev.filter(m => m.id !== thinkingId);
        return [...filtered, {
          id: `msg_${Date.now()}`,
          role: 'assistant',
          content: data.response || data.message || 'I apologize, I encountered an issue. Please try again.',
          timestamp: new Date(),
          agentType: data.agentType || data.routing?.agentType,
        }];
      });

      // If an action was created, refresh the approvals panel
      if (data.requiresApproval || data.pendingApproval) {
        setRefreshApprovals(prev => prev + 1);
      }
    } catch (error) {
      console.error('AI request failed:', error);
      setMessages(prev => {
        const filtered = prev.filter(m => m.id !== thinkingId);
        return [...filtered, {
          id: `msg_${Date.now()}`,
          role: 'assistant',
          content: 'Sorry, I encountered an error. Please try again.',
          timestamp: new Date(),
        }];
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleQuickAction = (action: QuickAction) => {
    if (action.requiresGoogle && !hasGoogleAccess) {
      setMessages(prev => [...prev, {
        id: `msg_${Date.now()}`,
        role: 'system',
        content: 'Please connect your Google Workspace to use this feature. Click your profile to connect.',
        timestamp: new Date(),
      }]);
      return;
    }
    sendMessage(action.prompt);
  };

  const handleMeetingBrief = (meeting: CalendarEvent) => {
    const prompt = `Prepare a detailed meeting brief for "${meeting.title}" with ${meeting.attendees.slice(0, 3).join(', ')}${meeting.attendees.length > 3 ? ` and ${meeting.attendees.length - 3} others` : ''}. Include:
1. Likely discussion topics based on the meeting title
2. Key questions to ask
3. Talking points
4. Suggested agenda`;
    sendMessage(prompt);
  };

  return (
    <div className="flex h-[calc(100vh-200px)] min-h-[600px] bg-cscx-gray-900 rounded-xl border border-cscx-gray-800 overflow-hidden">
      {/* Sidebar */}
      <div className="w-72 bg-cscx-black border-r border-cscx-gray-800 flex flex-col">
        {/* Header */}
        <div className="p-4 border-b border-cscx-gray-800">
          <h2 className="text-lg font-semibold text-white flex items-center gap-2">
            <span className="text-2xl">🤖</span>
            AI Assistant
          </h2>
          <p className="text-xs text-cscx-gray-400 mt-1">
            Powered by LangChain + RAG
          </p>
        </div>

        {/* Customer Selector */}
        <div className="p-4 border-b border-cscx-gray-800">
          <h3 className="text-xs font-medium text-cscx-gray-400 uppercase tracking-wider mb-2">
            Customer Context
          </h3>
          <select
            value={selectedCustomer?.id || ''}
            onChange={(e) => {
              const customer = customers.find(c => c.id === e.target.value);
              setSelectedCustomer(customer || null);
            }}
            className="w-full bg-cscx-gray-800 border border-cscx-gray-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-cscx-accent"
          >
            <option value="">General Inquiry</option>
            {customers.map((customer) => (
              <option key={customer.id} value={customer.id}>
                {customer.name} {customer.arr > 0 ? `($${(customer.arr / 1000).toFixed(0)}K)` : ''}
              </option>
            ))}
          </select>
          {selectedCustomer && (
            <div className="mt-2 p-2 bg-cscx-gray-800 rounded-lg text-xs">
              <div className="flex items-center justify-between">
                <span className="text-cscx-gray-400">Health:</span>
                <span className={`font-medium ${
                  selectedCustomer.health_score >= 70 ? 'text-green-400' :
                  selectedCustomer.health_score >= 40 ? 'text-yellow-400' : 'text-red-400'
                }`}>
                  {selectedCustomer.health_score}%
                </span>
              </div>
              <div className="flex items-center justify-between mt-1">
                <span className="text-cscx-gray-400">Status:</span>
                <span className="text-white capitalize">{selectedCustomer.status}</span>
              </div>
              {selectedCustomer.primary_contact && (
                <div className="flex items-center justify-between mt-1">
                  <span className="text-cscx-gray-400">Contact:</span>
                  <span className="text-white truncate ml-2">{selectedCustomer.primary_contact.email}</span>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Pending Approvals */}
        <div className="p-4 border-b border-cscx-gray-800">
          <PendingApprovals
            onApprovalChange={fetchTodaysMeetings}
            refreshTrigger={refreshApprovals}
          />
        </div>

        {/* Tasks */}
        <div className="p-4 border-b border-cscx-gray-800">
          <TaskList
            onTaskChange={fetchTodaysMeetings}
            refreshTrigger={refreshApprovals}
          />
        </div>

        {/* Today's Meetings */}
        {hasGoogleAccess && (
          <div className="p-4 border-b border-cscx-gray-800">
            <h3 className="text-xs font-medium text-cscx-gray-400 uppercase tracking-wider mb-3 flex items-center justify-between">
              Today's Meetings
              <button
                onClick={fetchTodaysMeetings}
                className="text-cscx-accent hover:text-red-400 transition-colors"
                disabled={loadingMeetings}
              >
                {loadingMeetings ? '...' : '↻'}
              </button>
            </h3>
            {loadingMeetings ? (
              <div className="text-sm text-cscx-gray-500">Loading...</div>
            ) : todaysMeetings.length === 0 ? (
              <div className="text-sm text-cscx-gray-500">No meetings today</div>
            ) : (
              <div className="space-y-2 max-h-48 overflow-y-auto">
                {todaysMeetings.slice(0, 5).map((meeting) => (
                  <button
                    key={meeting.id}
                    onClick={() => handleMeetingBrief(meeting)}
                    className="w-full text-left p-2 rounded-lg bg-cscx-gray-800 hover:bg-cscx-gray-700 transition-colors"
                  >
                    <div className="text-sm text-white font-medium truncate">{meeting.title}</div>
                    <div className="text-xs text-cscx-gray-400 flex items-center gap-1 mt-1">
                      <span>🕐</span>
                      {new Date(meeting.startTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      {meeting.attendees.length > 0 && (
                        <span className="ml-2">👥 {meeting.attendees.length}</span>
                      )}
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Quick Actions */}
        <div className="p-4 flex-1 overflow-y-auto">
          <h3 className="text-xs font-medium text-cscx-gray-400 uppercase tracking-wider mb-3">
            Quick Actions
          </h3>
          <div className="space-y-2">
            {QUICK_ACTIONS.map((action) => (
              <button
                key={action.id}
                onClick={() => handleQuickAction(action)}
                disabled={isLoading}
                className={`w-full text-left p-3 rounded-lg transition-colors flex items-center gap-3 ${
                  action.requiresGoogle && !hasGoogleAccess
                    ? 'bg-cscx-gray-800/50 text-cscx-gray-500 cursor-not-allowed'
                    : 'bg-cscx-gray-800 hover:bg-cscx-gray-700 text-white'
                }`}
              >
                <span className="text-xl">{action.icon}</span>
                <div>
                  <div className="text-sm font-medium">{action.label}</div>
                  {action.requiresGoogle && !hasGoogleAccess && (
                    <div className="text-xs text-yellow-500">Requires Google</div>
                  )}
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* Connection Status */}
        <div className="p-4 border-t border-cscx-gray-800">
          <div className="flex items-center gap-2">
            <span className={`w-2 h-2 rounded-full ${hasGoogleAccess ? 'bg-green-500' : 'bg-yellow-500'}`} />
            <span className="text-xs text-cscx-gray-400">
              {hasGoogleAccess ? 'Google Connected' : 'Google Not Connected'}
            </span>
          </div>
        </div>
      </div>

      {/* Main Chat Area */}
      <div className="flex-1 flex flex-col">
        {/* Chat Header */}
        <div className="p-4 border-b border-cscx-gray-800 flex items-center justify-between">
          <div>
            <h3 className="text-white font-medium">Customer Success AI</h3>
            <p className="text-xs text-cscx-gray-400">Auto-routing to specialist agents</p>
          </div>
          <div className="flex items-center gap-2 text-xs text-cscx-gray-400">
            <span className="w-2 h-2 rounded-full bg-green-500" />
            Ready
          </div>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {messages.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-center">
              <div className="text-6xl mb-4">🎯</div>
              <h3 className="text-xl font-semibold text-white mb-2">How can I help you today?</h3>
              <p className="text-cscx-gray-400 max-w-md mb-6">
                I'm your AI-powered Customer Success assistant. I can help with meeting prep,
                email drafts, onboarding plans, and more.
              </p>
              <div className="flex flex-wrap gap-2 justify-center max-w-lg">
                {QUICK_ACTIONS.slice(0, 4).map((action) => (
                  <button
                    key={action.id}
                    onClick={() => handleQuickAction(action)}
                    className="px-4 py-2 bg-cscx-gray-800 hover:bg-cscx-gray-700 text-white text-sm rounded-lg transition-colors flex items-center gap-2"
                  >
                    <span>{action.icon}</span>
                    {action.label}
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <>
              {messages.map((message) => (
                <div
                  key={message.id}
                  className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
                >
                  <div
                    className={`max-w-[80%] rounded-xl px-4 py-3 ${
                      message.role === 'user'
                        ? 'bg-cscx-accent text-white'
                        : message.role === 'system'
                        ? 'bg-yellow-900/30 border border-yellow-600/50 text-yellow-200'
                        : 'bg-cscx-gray-800 text-white'
                    }`}
                  >
                    {message.isThinking ? (
                      <div className="flex items-center gap-2">
                        <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent" />
                        <span>Thinking...</span>
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
                        </div>
                      </>
                    )}
                  </div>
                </div>
              ))}
              <div ref={messagesEndRef} />
            </>
          )}
        </div>

        {/* Input Area */}
        <div className="p-4 border-t border-cscx-gray-800">
          <div className="flex gap-2">
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && sendMessage(input)}
              placeholder="Ask me anything about customer success..."
              disabled={isLoading}
              className="flex-1 bg-cscx-gray-800 border border-cscx-gray-700 rounded-lg px-4 py-3 text-white placeholder-cscx-gray-500 focus:outline-none focus:border-cscx-accent disabled:opacity-50"
            />
            <button
              onClick={() => sendMessage(input)}
              disabled={isLoading || !input.trim()}
              className="px-6 py-3 bg-cscx-accent hover:bg-red-700 text-white font-medium rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isLoading ? '...' : 'Send'}
            </button>
          </div>
          <p className="text-xs text-cscx-gray-500 mt-2 text-center">
            LangChain RAG + Auto-routing + HITL approval
          </p>
        </div>
      </div>
    </div>
  );
}

export default AIAssistant;
