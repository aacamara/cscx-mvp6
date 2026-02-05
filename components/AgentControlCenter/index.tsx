import React, { useState, useEffect, useRef, useCallback, Suspense, lazy } from 'react';
import { useVirtualizer } from '@tanstack/react-virtual';
import { CS_AGENTS, AgentId, AgentMessage, CustomerContext, CSAgentType, RoutingDecision, AgentStatus } from '../../types/agents';
import { ContractExtraction, OnboardingPlan } from '../../types';
import { AgentCard, AGENT_ACTIONS, GENERAL_MODE_ACTIONS } from './AgentCard';
import { Message, MessageSkeleton } from './Message';
import { QuickActions } from './QuickActions';
import { WorkflowProgress, WorkflowExecution } from './WorkflowProgress';
import { useAgenticMode } from '../../context/AgenticModeContext';
import { useWebSocket } from '../../context/WebSocketContext';
import { useOnlineStatus } from '../../hooks/useOnlineStatus';
import './styles.css';
import { CADGPlanCard, CADGPlanMetadata } from '../AIPanel/CADGPlanCard';
import { StreamEvent } from '../../types/streaming';

// Lazy-loaded components for code splitting (reduces initial bundle by ~40KB)
const InteractiveActions = lazy(() => import('./InteractiveActions').then(m => ({
  default: () => null // Placeholder - we import specific components below
})));
const MeetingScheduler = lazy(() => import('./InteractiveActions').then(m => ({ default: m.MeetingScheduler })));
const EmailComposer = lazy(() => import('./InteractiveActions').then(m => ({ default: m.EmailComposer })));
const DocumentActions = lazy(() => import('./InteractiveActions').then(m => ({ default: m.DocumentActions })));
const OnboardingFlow = lazy(() => import('../AgentStudio/OnboardingFlow').then(m => ({ default: m.OnboardingFlow })));
const EmailPreviewModal = lazy(() => import('./EmailPreviewModal').then(m => ({ default: m.EmailPreviewModal })));
const WorkspaceDataPanel = lazy(() => import('./WorkspaceDataPanel').then(m => ({ default: m.WorkspaceDataPanel })));
const AgentAnalysisActions = lazy(() => import('./AgentAnalysisActions').then(m => ({ default: m.AgentAnalysisActions })));
const ChatHistoryDropdown = lazy(() => import('./ChatHistoryDropdown').then(m => ({ default: m.ChatHistoryDropdown })));

// Type imports that were previously inline
import type { OnboardingResult } from '../AgentStudio/OnboardingFlow';
import type { WorkspaceData } from './WorkspaceDataPanel';

// Loading fallback for lazy components
const LazyFallback: React.FC<{ height?: string }> = ({ height = '100px' }) => (
  <div style={{
    height,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    background: '#111',
    borderRadius: '8px',
    color: '#666',
    fontSize: '12px',
  }}>
    Loading...
  </div>
);

// Type for pending email data
interface PendingEmailData {
  approvalId: string;
  toolName: string;
  to: string[];
  cc?: string[];
  subject: string;
  body: string;
}

// Type for active interactive action
type InteractiveActionType = 'meeting' | 'email' | 'document' | null;

// Demo user ID for development (replaced by real auth in production)
const DEMO_USER_ID = 'df2dc7be-ece0-40b2-a9d7-0f6c45b75131';

const API_URL = import.meta.env.VITE_API_URL || '';

// Parse SSE data from a chunk with buffering for partial lines.
// Takes a mutable buffer object so incomplete lines are preserved across calls.
function parseSSEData(chunk: string, buffer: { partial: string }): StreamEvent[] {
  const events: StreamEvent[] = [];
  // Prepend any leftover partial line from the previous chunk
  const raw = buffer.partial + chunk;
  const lines = raw.split('\n');

  // If the chunk doesn't end with a newline, the last element is incomplete — save it
  if (!chunk.endsWith('\n')) {
    buffer.partial = lines.pop() || '';
  } else {
    buffer.partial = '';
  }

  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed.startsWith('data: ')) {
      try {
        const data = JSON.parse(trimmed.slice(6));
        events.push(data as StreamEvent);
      } catch {
        // Ignore malformed JSON (shouldn't happen with well-formed SSE)
      }
    }
  }

  return events;
}

// ============================================
// LANGCHAIN-POWERED AGENT CONTROL CENTER
// Uses intelligent auto-routing with manual override
// ============================================

interface AgentControlCenterProps {
  customer?: CustomerContext;
  contractData?: ContractExtraction | null;
  plan?: OnboardingPlan | null;
  initialMessage?: string;
  embedded?: boolean;
}

export const AgentControlCenter: React.FC<AgentControlCenterProps> = ({
  customer,
  contractData,
  plan,
  initialMessage
}) => {
  const [messages, setMessages] = useState<AgentMessage[]>([]);
  const [input, setInput] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [activeAgent, setActiveAgent] = useState<CSAgentType>('onboarding');
  const [selectedAgent, setSelectedAgent] = useState<CSAgentType | 'auto'>('auto');
  const [selectedModel, setSelectedModel] = useState<'claude' | 'gemini'>('claude');
  const [useKnowledgeBase, setUseKnowledgeBase] = useState(true);
  const [useAIEnhancement, setUseAIEnhancement] = useState(true);
  const [lastRouting, setLastRouting] = useState<RoutingDecision | null>(null);
  const [deployingTo, setDeployingTo] = useState<AgentId | null>(null);

  // CADG plan approval state
  const [pendingCadgPlan, setPendingCadgPlan] = useState<CADGPlanMetadata | null>(null);

  // Streaming state for SSE token-by-token responses
  const [isStreaming, setIsStreaming] = useState(false);
  const abortControllerRef = useRef<AbortController | null>(null);
  const streamingMessageIdRef = useRef<string | null>(null);
  const sseBufferRef = useRef<{ partial: string }>({ partial: '' });

  // Agentic mode integration (shared context)
  const { isEnabled: agenticModeEnabled, executeGoal, resumeExecution } = useAgenticMode();
  const { connected: wsConnected } = useWebSocket();
  const { isOnline, queuedCount, queueMessage, dequeueMessage, getNextQueuedMessage } = useOnlineStatus();

  // Persist sessionId per customer in localStorage (moved before useEffect that needs it)
  const [sessionId] = useState(() => {
    const customerId = customer?.id || customer?.name || 'default';
    const storageKey = `cscx_session_${customerId}`;
    const stored = localStorage.getItem(storageKey);
    if (stored) return stored;
    const newId = `session_${customerId}_${Date.now()}`;
    localStorage.setItem(storageKey, newId);
    return newId;
  });

  // Track retry counts for queued messages
  const retryCountsRef = useRef<Record<string, number>>({});

  // Process queued messages when coming back online with exponential backoff
  useEffect(() => {
    if (!isOnline) return;

    const processQueue = async () => {
      const MAX_RETRIES = 3;
      let nextMessage = getNextQueuedMessage();

      while (nextMessage) {
        const messageId = nextMessage.id;
        const retryCount = retryCountsRef.current[messageId] || 0;

        try {
          // Update message status to sending
          setMessages(prev => prev.map(msg =>
            msg.id === messageId ? { ...msg, status: 'sending' as const } : msg
          ));

          // Exponential backoff with jitter
          if (retryCount > 0) {
            const delay = Math.min(1000 * Math.pow(2, retryCount - 1), 10000);
            const jitter = delay * 0.1 * Math.random();
            await new Promise(r => setTimeout(r, delay + jitter));
          }

          // Save directly using the chat API for queued messages
          const response = await fetch(`${API_URL}/api/chat/messages`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'x-user-id': DEMO_USER_ID
            },
            body: JSON.stringify({
              customer_id: nextMessage.customerId || null,
              user_id: DEMO_USER_ID,
              role: 'user',
              content: nextMessage.content,
              session_id: sessionId,
              status: 'sent',
              client_id: messageId
            })
          });

          if (response.ok) {
            const data = await response.json();
            // Remove from queue and update status
            dequeueMessage(messageId);
            delete retryCountsRef.current[messageId];
            setMessages(prev => prev.map(msg =>
              msg.id === messageId ? { ...msg, id: data.message?.id || msg.id, status: 'sent' as const } : msg
            ));
          } else {
            throw new Error(`HTTP ${response.status}`);
          }
        } catch (error) {
          console.error('Failed to send queued message:', error);

          // Increment retry count
          retryCountsRef.current[messageId] = retryCount + 1;

          if (retryCountsRef.current[messageId] >= MAX_RETRIES) {
            // Max retries reached, mark as failed and remove from queue
            setMessages(prev => prev.map(msg =>
              msg.id === messageId ? { ...msg, status: 'failed' as const } : msg
            ));
            dequeueMessage(messageId);
            delete retryCountsRef.current[messageId];
          } else {
            // Will retry on next processQueue call
            break;
          }
        }
        nextMessage = getNextQueuedMessage();
      }
    };

    if (queuedCount > 0) {
      processQueue();
    }
  }, [isOnline, queuedCount, getNextQueuedMessage, dequeueMessage, sessionId]);
  const [agenticStateId, setAgenticStateId] = useState<string | null>(null);
  const [csAgentStatuses, setCsAgentStatuses] = useState<Record<CSAgentType, AgentStatus>>({
    onboarding: 'active',
    adoption: 'idle',
    renewal: 'idle',
    risk: 'idle',
    strategic: 'idle',
  });
  const [pendingApproval, setPendingApproval] = useState<string | null>(null);
  const [pendingEmailData, setPendingEmailData] = useState<PendingEmailData | null>(null);
  const [workspaceData, setWorkspaceData] = useState<WorkspaceData>({});
  const [workspacePanelOpen, setWorkspacePanelOpen] = useState(true);
  const [initialized, setInitialized] = useState(false);
  const [activeInteractiveAction, setActiveInteractiveAction] = useState<InteractiveActionType>(null);
  const [activeWorkflow, setActiveWorkflow] = useState<WorkflowExecution | null>(null);
  const [workflowPolling, setWorkflowPolling] = useState<NodeJS.Timeout | null>(null);
  const [showOnboardingFlow, setShowOnboardingFlow] = useState(false);
  const [onboardingResult, setOnboardingResult] = useState<OnboardingResult | null>(null);
  const [completedTasks, setCompletedTasks] = useState<Set<string>>(new Set());
  const [showAnalysisPanel, setShowAnalysisPanel] = useState(false);
  const [showChatHistory, setShowChatHistory] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const textInputRef = useRef<HTMLInputElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const [messageHistory, setMessageHistory] = useState<string[]>([]);
  const [historyIndex, setHistoryIndex] = useState(-1);
  const [isUserScrolledUp, setIsUserScrolledUp] = useState(false);
  const [hasNewMessages, setHasNewMessages] = useState(false);
  const [isLoadingHistory, setIsLoadingHistory] = useState(false);
  const [predictedIntent, setPredictedIntent] = useState<{ agent: CSAgentType; confidence: number; keywords: string[] } | null>(null);

  const messagesContainerRef = useRef<HTMLDivElement>(null);

  // Virtualized message list for performance with 1000+ messages
  const rowVirtualizer = useVirtualizer({
    count: messages.length,
    getScrollElement: () => messagesContainerRef.current,
    estimateSize: () => 120, // Estimated average message height
    overscan: 5, // Render 5 extra items above/below viewport for smooth scrolling
  });

  // Scroll to bottom when new message arrives (unless user scrolled up)
  useEffect(() => {
    if (messages.length > 0 && !isUserScrolledUp) {
      rowVirtualizer.scrollToIndex(messages.length - 1, { align: 'end', behavior: 'smooth' });
    }
  }, [messages.length, isUserScrolledUp, rowVirtualizer]);

  // Auto-scroll during streaming to keep latest content visible
  useEffect(() => {
    if (!isStreaming || isUserScrolledUp || messages.length === 0) return;
    const intervalId = setInterval(() => {
      rowVirtualizer.scrollToIndex(messages.length - 1, { align: 'end' });
    }, 100);
    return () => clearInterval(intervalId);
  }, [isStreaming, isUserScrolledUp, messages.length, rowVirtualizer]);

  // Local fallback intent classifier (used when backend is unavailable)
  const localClassifyIntent = useCallback((text: string): { agent: CSAgentType; confidence: number; keywords: string[] } | null => {
    if (!text || text.length < 3) return null;

    const lowerText = text.toLowerCase();

    // Intent patterns with weights
    const patterns: { agent: CSAgentType; keywords: string[]; weight: number }[] = [
      {
        agent: 'onboarding',
        keywords: ['onboard', 'kickoff', 'get started', 'new customer', 'setup', 'welcome', 'first', 'introduce', 'begin', 'start', '30-60-90', 'implementation'],
        weight: 1.0
      },
      {
        agent: 'adoption',
        keywords: ['usage', 'adopt', 'feature', 'training', 'learn', 'how to', 'tutorial', 'champion', 'engagement', 'active users', 'activation', 'utilization'],
        weight: 1.0
      },
      {
        agent: 'renewal',
        keywords: ['renew', 'contract', 'pricing', 'expand', 'upsell', 'negotiate', 'proposal', 'quote', 'discount', 'terms', 'commercial', 'license'],
        weight: 1.0
      },
      {
        agent: 'risk',
        keywords: ['risk', 'churn', 'cancel', 'unhappy', 'complaint', 'issue', 'problem', 'escalat', 'save', 'at-risk', 'concern', 'upset', 'frustrated'],
        weight: 1.2
      },
      {
        agent: 'strategic',
        keywords: ['qbr', 'executive', 'strategic', 'roadmap', 'vision', 'cxo', 'c-suite', 'board', 'leadership', 'transformation', 'partnership', 'account plan'],
        weight: 1.0
      }
    ];

    let bestMatch: { agent: CSAgentType; confidence: number; keywords: string[] } | null = null;
    let highestScore = 0;

    for (const pattern of patterns) {
      const matchedKeywords = pattern.keywords.filter(kw => lowerText.includes(kw));
      if (matchedKeywords.length > 0) {
        const score = matchedKeywords.length * pattern.weight;
        if (score > highestScore) {
          highestScore = score;
          const confidence = Math.min(0.95, 0.5 + (score * 0.15));
          bestMatch = { agent: pattern.agent, confidence, keywords: matchedKeywords };
        }
      }
    }

    return bestMatch;
  }, []);

  // Backend-powered intent classifier with local fallback
  const classifyIntent = useCallback(async (text: string): Promise<{ agent: CSAgentType; confidence: number; keywords: string[] } | null> => {
    if (!text || text.length < 3) return null;

    try {
      const response = await fetch(`${API_URL}/api/agents/intent/classify`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: text, customerId: customer?.id })
      });

      if (response.ok) {
        const result = await response.json();
        // Validate agent type is a known CSAgentType
        const validAgents: CSAgentType[] = ['onboarding', 'adoption', 'renewal', 'risk', 'strategic'];
        const agent = validAgents.includes(result.agent) ? result.agent : 'onboarding';
        return {
          agent,
          confidence: result.confidence || 0.7,
          keywords: [result.reasoning || 'AI classified']
        };
      }
    } catch (error) {
      console.warn('Backend classification failed, using local fallback:', error);
    }

    // Fallback to local classifier
    return localClassifyIntent(text);
  }, [customer?.id, localClassifyIntent]);

  // Update predicted intent as user types (debounced with AbortController)
  useEffect(() => {
    const abortController = new AbortController();

    const timeoutId = setTimeout(async () => {
      if (selectedAgent === 'auto' && input.trim()) {
        try {
          const intent = await classifyIntent(input);
          if (!abortController.signal.aborted) {
            setPredictedIntent(intent);
          }
        } catch (error) {
          // Silently handle aborted requests
          if ((error as Error).name !== 'AbortError') {
            console.warn('Classification error:', error);
          }
        }
      } else {
        setPredictedIntent(null);
      }
    }, 300); // 300ms debounce for API calls

    return () => {
      clearTimeout(timeoutId);
      abortController.abort();
    };
  }, [input, selectedAgent, classifyIntent]);

  const scrollToTop = () => {
    messagesContainerRef.current?.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    setHasNewMessages(false);
    setIsUserScrolledUp(false);
  };

  // Handle scroll to detect if user scrolled up
  const handleMessagesScroll = () => {
    const container = messagesContainerRef.current;
    if (!container) return;

    const { scrollTop, scrollHeight, clientHeight } = container;
    const isAtBottom = scrollHeight - scrollTop - clientHeight < 50;

    if (isAtBottom) {
      setIsUserScrolledUp(false);
      setHasNewMessages(false);
    } else {
      setIsUserScrolledUp(true);
    }
  };

  // Scroll to top when first message arrives (new conversation)
  // Scroll to bottom for subsequent messages (unless user scrolled up)
  useEffect(() => {
    if (messages.length === 1) {
      // First message - scroll to top to show it
      scrollToTop();
    } else if (messages.length > 1) {
      // Subsequent messages - scroll to bottom if not scrolled up
      if (!isUserScrolledUp) {
        scrollToBottom();
      } else {
        setHasNewMessages(true);
      }
    }
  }, [messages, isUserScrolledUp]);

  // Load chat history from database on mount or customer change
  useEffect(() => {
    const loadChatHistory = async () => {
      setIsLoadingHistory(true);
      try {
        const params = new URLSearchParams({
          limit: '50',
          ...(customer?.id && { customerId: customer.id })
        });

        const response = await fetch(`${API_URL}/api/chat/history?${params}`, {
          headers: {
            'x-user-id': DEMO_USER_ID
          }
        });

        if (response.ok) {
          const data = await response.json();
          if (data.messages && data.messages.length > 0) {
            // Convert API messages to AgentMessage format
            const loadedMessages: AgentMessage[] = data.messages
              .reverse() // API returns newest first, we want oldest first
              .map((msg: any) => ({
                isUser: msg.role === 'user',
                agent: msg.agent_type as CSAgentType || 'onboarding',
                message: msg.content,
                timestamp: msg.created_at
              }));
            setMessages(loadedMessages);
          }
        }
      } catch (error) {
        console.error('Failed to load chat history:', error);
      } finally {
        setIsLoadingHistory(false);
      }
    };

    // Only load history if we have a customer context
    if (customer?.id) {
      loadChatHistory();
    }
  }, [customer?.id]);

  // Initialize with context from contract handoff
  useEffect(() => {
    if (!initialized && customer && contractData) {
      setInitialized(true);
      setActiveAgent('onboarding');
      setCsAgentStatuses(prev => ({ ...prev, onboarding: 'active' }));

      // Add initial agent message showing it received the context
      const contextSummary: AgentMessage = {
        agent: 'onboarding',
        message: initialMessage || buildContextMessage(),
      };
      setMessages(prev => prev.length === 0 ? [contextSummary] : prev);

      // Initialize session with full context on backend
      initializeSession();
    }
  }, [customer, contractData, initialized]);

  const buildContextMessage = () => {
    const stakeholderNames = contractData?.stakeholders?.slice(0, 3).map(s => s.name).join(', ') || 'the team';
    const entitlementCount = contractData?.entitlements?.length || 0;
    const planPhases = plan?.phases?.length || 3;

    return `I've reviewed the contract for **${contractData?.company_name}**. Here's what I found:\n\n` +
      `- **ARR:** $${contractData?.arr?.toLocaleString()}\n` +
      `- **Contract Period:** ${contractData?.contract_period || 'Standard term'}\n` +
      `- **Entitlements:** ${entitlementCount} products/services\n` +
      `- **Key Stakeholders:** ${stakeholderNames}\n` +
      `- **Onboarding Plan:** ${plan?.timeline_days || 90} days across ${planPhases} phases\n\n` +
      `What would you like me to do first? I can:\n` +
      `1. **Schedule a kickoff meeting** with ${stakeholderNames}\n` +
      `2. **Send welcome emails** to introduce ourselves\n` +
      `3. **Review the onboarding plan** in detail\n` +
      `4. **Start technical setup** based on their requirements`;
  };

  const initializeSession = async () => {
    try {
      // Clear any existing session
      await fetch(`${API_URL}/api/ai/session/clear`, { method: 'POST' });
    } catch (error) {
      console.error('Failed to initialize session:', error);
    }
  };

  // Load chat history from database
  const loadChatHistory = async () => {
    if (!customer?.id) return;

    try {
      // Try the new chat history endpoint first (includes status)
      const response = await fetch(`${API_URL}/api/chat/history?customerId=${customer.id}`, {
        headers: {
          'x-user-id': DEMO_USER_ID
        }
      });

      if (response.ok) {
        const data = await response.json();
        if (data.messages && data.messages.length > 0) {
          // Convert chat history to AgentMessage format (messages are DESC, so reverse)
          const loadedMessages: AgentMessage[] = data.messages
            .reverse()
            .map((msg: {
              id: string;
              role: string;
              content: string;
              agent_type?: string;
              tool_calls?: unknown[];
              status?: string;
              created_at?: string;
            }) => ({
              id: msg.id,
              isUser: msg.role === 'user',
              agent: msg.agent_type as CSAgentType || activeAgent,
              message: msg.content,
              toolResults: msg.tool_calls,
              status: msg.status as 'sending' | 'sent' | 'failed' || 'sent',
              timestamp: msg.created_at,
            }));

          // Only set if we don't already have messages (avoid overwriting new messages)
          setMessages(prev => {
            if (prev.length <= 1) {
              return loadedMessages;
            }
            return prev;
          });
          console.log(`[AgentControlCenter] Loaded ${loadedMessages.length} messages from history`);
          return;
        }
      }

      // Fallback to agent-activities endpoint if chat history is empty
      const fallbackResponse = await fetch(`${API_URL}/api/agent-activities/customer/${customer.id}`, {
        headers: {
          'x-user-id': DEMO_USER_ID
        }
      });

      if (fallbackResponse.ok) {
        const data = await fallbackResponse.json();
        if (data.chatHistory && data.chatHistory.length > 0) {
          const loadedMessages: AgentMessage[] = data.chatHistory.map((msg: {
            role: string;
            content: string;
            agentType?: string;
            toolCalls?: unknown[];
          }) => ({
            isUser: msg.role === 'user',
            agent: msg.agentType as CSAgentType || activeAgent,
            message: msg.content,
            toolResults: msg.toolCalls,
            status: 'sent' as const, // Legacy messages default to sent
          }));

          setMessages(prev => {
            if (prev.length <= 1) {
              return loadedMessages;
            }
            return prev;
          });
          console.log(`[AgentControlCenter] Loaded ${loadedMessages.length} messages from legacy history`);
        }
      }
    } catch (error) {
      console.error('Failed to load chat history:', error);
    }
  };

  // Load chat history when customer changes
  useEffect(() => {
    if (customer?.id) {
      loadChatHistory();
    }
  }, [customer?.id]);

  // Build full context object for backend
  const buildFullContext = () => ({
    // Basic customer info
    name: customer?.name,
    arr: customer?.arr,
    products: customer?.products,
    stakeholders: customer?.stakeholders,

    // Extended contract data
    contractPeriod: contractData?.contract_period,
    entitlements: contractData?.entitlements,
    technicalRequirements: contractData?.technical_requirements,
    contractTasks: contractData?.contract_tasks,
    pricingTerms: contractData?.pricing_terms,
    missingInfo: contractData?.missing_info,
    nextSteps: contractData?.next_steps,

    // Generated plan
    plan: plan ? {
      timelineDays: plan.timeline_days,
      phases: plan.phases,
      riskFactors: plan.risk_factors,
      opportunities: plan.opportunities,
      touchpoints: plan.recommended_touchpoints,
    } : null,
  });

  // Build customer context for LangChain API
  const buildCustomerContext = () => ({
    id: customer?.id || 'unknown',
    name: customer?.name || 'Unknown Customer',
    arr: typeof customer?.arr === 'number' ? customer.arr : parseInt(String(customer?.arr || '0').replace(/[^0-9]/g, '')) || 0,
    healthScore: 70, // Default health score
    status: 'active',
    renewalDate: contractData?.contract_period,
    daysSinceLastContact: undefined, // Let auto-router decide based on message content
    stakeholders: contractData?.stakeholders?.map(s => s.name) || [],
    openIssues: 0,
    contractDetails: JSON.stringify({
      entitlements: contractData?.entitlements,
      technicalRequirements: contractData?.technical_requirements,
    }),
  });

  // Process tool results and update workspace data panel
  const processToolResults = (toolResults: Array<{ toolName: string; result: any }>) => {
    if (!toolResults?.length) return;

    setWorkspaceData(prev => {
      const updated = { ...prev, lastUpdated: new Date() };

      for (const tr of toolResults) {
        const result = tr.result;
        if (!result?.success) continue;

        switch (tr.toolName) {
          case 'get_documents':
            if (result.documents?.length) {
              updated.documents = result.documents.map((d: any) => ({
                id: d.id,
                name: d.name,
                link: d.link || `https://docs.google.com/document/d/${d.id}`,
                modifiedTime: d.modifiedTime,
                type: 'doc' as const
              }));
            }
            break;

          case 'get_spreadsheets':
            if (result.spreadsheets?.length) {
              updated.spreadsheets = result.spreadsheets.map((s: any) => ({
                id: s.id,
                name: s.name,
                link: s.link || `https://docs.google.com/spreadsheets/d/${s.id}`,
                modifiedTime: s.modifiedTime,
                type: 'sheet' as const
              }));
            }
            break;

          case 'get_presentations':
            if (result.presentations?.length) {
              updated.presentations = result.presentations.map((p: any) => ({
                id: p.id,
                name: p.name,
                link: p.link || `https://docs.google.com/presentation/d/${p.id}`,
                modifiedTime: p.modifiedTime,
                type: 'slide' as const
              }));
            }
            break;

          case 'get_todays_meetings':
          case 'get_upcoming_meetings':
            if (result.meetings?.length) {
              updated.meetings = result.meetings.map((m: any) => ({
                id: m.id,
                title: m.title,
                startTime: m.startTime,
                endTime: m.endTime,
                meetLink: m.meetLink,
                calendarLink: m.calendarLink,
                attendees: m.attendees
              }));
            }
            break;

          case 'get_recent_emails':
          case 'search_emails':
          case 'get_unread_emails':
            if (result.emails?.length) {
              updated.emails = result.emails.map((e: any) => ({
                id: e.id,
                subject: e.subject,
                from: e.from,
                snippet: e.snippet,
                date: e.date,
                isUnread: e.isUnread
              }));
            }
            break;

          case 'get_recent_files':
          case 'search_files':
            if (result.files?.length) {
              updated.files = result.files.map((f: any) => ({
                id: f.id,
                name: f.name,
                link: f.webViewLink || `https://drive.google.com/file/d/${f.id}`,
                modifiedTime: f.modifiedTime,
                type: 'file' as const
              }));
            }
            break;
        }
      }

      return updated;
    });
  };

  // Helper to save chat message to database for Agent Inbox
  // Attachment metadata is stored in toolCalls field as { type: 'attachment', ...attachmentData }
  // Returns the saved message with server ID for optimistic update reconciliation
  const saveChatMessage = async (
    role: string,
    content: string,
    agentType?: string,
    toolCalls?: any[],
    attachment?: { name: string; size: number; type: string; hasContent?: boolean },
    clientId?: string,
    status: 'sending' | 'sent' | 'failed' = 'sent'
  ): Promise<{ id: string; status: string } | null> => {
    const customerId = customer?.id;

    // Merge attachment metadata into toolCalls array
    let toolCallsWithAttachment = toolCalls || [];
    if (attachment) {
      toolCallsWithAttachment = [
        { type: 'attachment', ...attachment },
        ...(toolCalls || [])
      ];
    }

    try {
      // Use /api/chat/messages endpoint which supports status and client_id
      const response = await fetch(`${API_URL}/api/chat/messages`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-user-id': DEMO_USER_ID
        },
        body: JSON.stringify({
          customer_id: customerId || null,
          user_id: DEMO_USER_ID,
          role: role === 'assistant' ? 'assistant' : 'user',
          content,
          agent_type: agentType || null,
          tool_calls: toolCallsWithAttachment.length > 0 ? toolCallsWithAttachment : [],
          session_id: sessionId,
          status,
          client_id: clientId || null
        })
      });

      if (response.ok) {
        const data = await response.json();
        return { id: data.message?.id || data.id, status: 'sent' };
      }
      return null;
    } catch (err) {
      console.error('Failed to save chat message:', err);
      return null;
    }
  };

  // Send message to LangChain-powered AI backend (or agentic system)
  const sendToAgent = async (
    message: string,
    attachment?: { name: string; size: number; type: string; hasContent?: boolean },
    messageId?: string
  ) => {
    // Generate client-side ID for deduplication if not provided
    const clientId = messageId || `client_${crypto.randomUUID()}`;

    // Update message status with functional setState (prevents race conditions)
    const updateMessageStatus = (id: string, status: 'sending' | 'sent' | 'failed', serverId?: string) => {
      setMessages(prev => prev.map(msg =>
        msg.id === id ? { ...msg, id: serverId || msg.id, status } : msg
      ));
    };

    try {
      // Save user message to database with client_id for deduplication
      const result = await saveChatMessage('user', message, undefined, undefined, attachment, clientId, 'sent');
      if (result) {
        // Update with server ID and sent status
        updateMessageStatus(messageId || clientId, 'sent', result.id);
      } else {
        throw new Error('Failed to save message');
      }
    } catch (error) {
      console.error('Failed to save message:', error);
      updateMessageStatus(messageId || clientId, 'failed');
      return;
    }

    setIsProcessing(true);

    // Add thinking state
    setMessages(prev => [...prev, {
      agent: activeAgent,
      message: agenticModeEnabled ? 'Executing autonomously...' : 'Processing your request...',
      isThinking: true
    }]);

    // If agentic mode is enabled, route through the agentic system
    if (agenticModeEnabled) {
      try {
        const result = await executeGoal(message, customer?.id);

        // Remove thinking message
        setMessages(prev => prev.filter(m => !m.isThinking));

        if (result.status === 'paused_for_approval') {
          // Store state ID for approval handling
          setAgenticStateId(result.stateId || null);

          // Show approval request in chat
          const approvalMsg = `**Approval Required** (${result.pendingApproval?.riskLevel} risk)\n\n` +
            `Action: **${result.pendingApproval?.toolName}**\n` +
            `Reason: ${result.pendingApproval?.reason}\n\n` +
            `${result.message}`;

          setMessages(prev => [...prev, {
            agent: activeAgent,
            message: approvalMsg,
            isApproval: true,
          }]);
          setPendingApproval(result.stateId || 'agentic');
        } else if (result.status === 'completed') {
          // Show completion message with actions taken
          let actionsText = '';
          if (result.actions && result.actions.length > 0) {
            actionsText = '\n\n**Actions executed:**\n' +
              result.actions.map(a => `- ${a.toolName}`).join('\n');
          }

          setMessages(prev => [...prev, {
            agent: activeAgent,
            message: `${result.message}${actionsText}`,
          }]);
        } else {
          // Show result message
          setMessages(prev => [...prev, {
            agent: activeAgent,
            message: result.message,
          }]);
        }

        saveChatMessage('assistant', result.message, activeAgent);
      } catch (error) {
        console.error('Agentic execution error:', error);
        setMessages(prev => {
          const filtered = prev.filter(m => !m.isThinking);
          return [...filtered, {
            agent: activeAgent,
            message: `Agentic execution failed: ${error instanceof Error ? error.message : 'Unknown error'}. Falling back to chat mode.`
          }];
        });
        // Fall back to regular chat on agentic error
        await sendToAgentRegular(message);
      } finally {
        setIsProcessing(false);
      }
      return;
    }

    // Regular chat flow
    await sendToAgentRegular(message);
  };

  // Regular (non-agentic) chat flow — streams via SSE
  const sendToAgentRegular = async (message: string) => {
    const abortController = new AbortController();
    abortControllerRef.current = abortController;

    // Reset SSE buffer for new stream
    sseBufferRef.current = { partial: '' };

    // Generate a unique ID for the streaming message
    const msgId = `stream_${Date.now()}`;
    streamingMessageIdRef.current = msgId;

    let accumulatedContent = '';
    const accumulatedToolResults: Array<{ toolCallId?: string; toolName: string; result: any }> = [];

    try {
      setIsStreaming(true);

      // Create initial empty streaming message (replaces thinking indicator)
      setMessages(prev => {
        const filtered = prev.filter(m => !m.isThinking);
        return [...filtered, {
          agent: activeAgent,
          message: '',
          id: msgId,
          isStreaming: true,
        }];
      });

      const response = await fetch(`${API_URL}/api/ai/chat/stream`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-user-id': DEMO_USER_ID
        },
        body: JSON.stringify({
          message,
          customerId: customer?.id,
          customerContext: buildCustomerContext(),
          forceAgent: selectedAgent !== 'auto' ? selectedAgent : undefined,
          activeAgent,
          sessionId,
          useWorkflow: true,
          model: selectedModel,
          useKnowledgeBase
        }),
        signal: abortController.signal,
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: Failed to get response`);
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
        const events = parseSSEData(chunk, sseBufferRef.current);

        for (const event of events) {
          switch (event.type) {
            case 'token':
              if (event.content) {
                accumulatedContent += event.content;
                setMessages(prev => prev.map(m =>
                  m.id === msgId
                    ? { ...m, message: accumulatedContent }
                    : m
                ));
              }
              break;

            case 'tool_start':
              // Optionally show tool indicator — no UI change needed yet
              break;

            case 'tool_end':
              // Accumulate tool results for final processing
              if (event.name) {
                accumulatedToolResults.push({
                  toolName: event.name,
                  result: event.result || {},
                  ...(event.duration !== undefined && { duration: event.duration }),
                });
              }
              break;

            case 'done': {
              // Stream completed — extract full metadata from done event
              if (!event.content) break;

              let data: any;
              try {
                data = JSON.parse(event.content);
              } catch {
                break;
              }

              // Check if this is a CADG generative response with a plan
              if (data.isGenerative && data.plan?.planId) {
                console.log('[CADG] Received execution plan:', data.plan.planId);

                const cadgMetadata: CADGPlanMetadata = {
                  isGenerative: data.isGenerative,
                  taskType: data.taskType,
                  confidence: data.confidence,
                  requiresApproval: data.requiresApproval,
                  plan: data.plan,
                  capability: data.capability,
                  methodology: data.methodology,
                  customerId: customer?.id || null,
                };
                setPendingCadgPlan(cadgMetadata);

                // Finalize message as CADG plan
                setMessages(prev => prev.map(m =>
                  m.id === msgId
                    ? {
                        ...m,
                        agent: 'strategic' as CSAgentType,
                        message: data.response || accumulatedContent,
                        isStreaming: false,
                        isCadgPlan: true,
                        cadgPlan: data.plan,
                      }
                    : m
                ));
                return; // Don't continue with regular processing
              }

              // Regular response — extract routing, tools, approval info
              const routedAgent = data.routing?.agentType as CSAgentType || 'onboarding';
              const finalResponse = data.response || accumulatedContent;
              const toolResults = data.toolResults?.length > 0 ? data.toolResults : (accumulatedToolResults.length > 0 ? accumulatedToolResults : undefined);

              setActiveAgent(routedAgent);
              setLastRouting(data.routing);

              // Update agent statuses
              setCsAgentStatuses(prev => {
                const newStatuses = { ...prev };
                Object.keys(newStatuses).forEach(key => {
                  newStatuses[key as CSAgentType] = key === routedAgent ? 'active' : 'idle';
                });
                return newStatuses;
              });

              // Process tool results and update workspace panel
              if (toolResults?.length > 0) {
                processToolResults(toolResults);
              }

              // Save assistant response to database
              saveChatMessage('assistant', finalResponse, routedAgent, toolResults);

              // Finalize the streaming message with full metadata
              setMessages(prev => prev.map(m =>
                m.id === msgId
                  ? {
                      ...m,
                      agent: routedAgent,
                      message: finalResponse,
                      isStreaming: false,
                      isApproval: data.requiresApproval,
                      routing: data.routing,
                      toolResults,
                    }
                  : m
              ));

              // Handle approval request
              if (data.requiresApproval && data.pendingActions?.length > 0) {
                const pendingAction = data.pendingActions[0];
                const approvalId = pendingAction?.approvalId;
                if (approvalId) {
                  setPendingApproval(approvalId);

                  const toolName = pendingAction?.toolCall?.name;
                  if (toolName === 'draft_email' || toolName === 'send_email') {
                    const input = pendingAction?.toolCall?.input || {};
                    setPendingEmailData({
                      approvalId,
                      toolName,
                      to: input.to || [],
                      cc: input.cc || [],
                      subject: input.subject || '',
                      body: input.body || ''
                    });
                  }
                }
              }
              break;
            }

            case 'error':
              throw new Error(event.error || 'Stream error');
          }
        }
      }

      // If stream ended without a done event, finalize with accumulated content
      setMessages(prev => prev.map(m =>
        m.id === msgId && m.isStreaming
          ? { ...m, message: accumulatedContent || 'No response received.', isStreaming: false }
          : m
      ));

    } catch (error) {
      // Don't treat user-initiated abort as an error
      if (error instanceof DOMException && error.name === 'AbortError') {
        // User clicked stop — finalize with partial content
        setMessages(prev => prev.map(m =>
          m.id === msgId
            ? { ...m, message: accumulatedContent || 'Generation stopped.', isStreaming: false }
            : m
        ));
        return;
      }

      console.error('Agent streaming error:', error);
      setMessages(prev => prev.map(m =>
        m.id === msgId
          ? {
              ...m,
              message: accumulatedContent
                ? `${accumulatedContent}\n\n---\n*Stream interrupted: ${error instanceof Error ? error.message : 'Unknown error'}*`
                : `Sorry, I encountered an error: ${error instanceof Error ? error.message : 'Please try again.'}`,
              isStreaming: false,
            }
          : m
      ));
    } finally {
      setIsStreaming(false);
      setIsProcessing(false);
      abortControllerRef.current = null;
      streamingMessageIdRef.current = null;
    }
  };

  // Handle approval for both agentic and regular modes
  const handleApproval = async (approved: boolean) => {
    // Check if this is an agentic approval
    if (agenticStateId) {
      setMessages(prev => [...prev, {
        isUser: true,
        message: approved ? '✓ Approved - proceeding with autonomous execution' : '✗ Rejected - stopping execution'
      }]);

      try {
        const result = await resumeExecution(agenticStateId, approved);

        if (result.status === 'paused_for_approval') {
          // Another approval needed
          setAgenticStateId(result.stateId || null);

          const approvalMsg = `**Another Approval Required** (${result.pendingApproval?.riskLevel} risk)\n\n` +
            `Action: **${result.pendingApproval?.toolName}**\n` +
            `Reason: ${result.pendingApproval?.reason}`;

          setMessages(prev => [...prev, {
            agent: activeAgent,
            message: approvalMsg,
            isApproval: true,
          }]);
          setPendingApproval(result.stateId || 'agentic');
        } else {
          // Execution complete
          setAgenticStateId(null);
          setPendingApproval(null);

          let actionsText = '';
          if (result.actions && result.actions.length > 0) {
            actionsText = '\n\n**Actions executed:**\n' +
              result.actions.map(a => `- ${a.toolName}`).join('\n');
          }

          setMessages(prev => [...prev, {
            agent: activeAgent,
            message: approved
              ? `✅ ${result.message}${actionsText}`
              : `⛔ Execution stopped: ${result.message}`,
          }]);
        }
      } catch (error) {
        console.error('Resume error:', error);
        setMessages(prev => [...prev, {
          agent: activeAgent,
          message: `❌ Error resuming execution: ${error instanceof Error ? error.message : 'Unknown error'}`
        }]);
        setAgenticStateId(null);
        setPendingApproval(null);
      }
      return;
    }

    // Regular (non-agentic) approval flow
    setMessages(prev => [...prev, {
      isUser: true,
      message: approved ? '✓ Approved - proceed' : '✗ Rejected - stop'
    }]);

    if (pendingApproval) {
      try {
        const response = await fetch(`${API_URL}/api/agents/approve/${pendingApproval}`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-user-id': DEMO_USER_ID
          },
          body: JSON.stringify({ approved, userId: DEMO_USER_ID })
        });

        const result = await response.json();

        // Show execution result to user
        if (approved && result.execution) {
          const execResult = result.execution;
          setMessages(prev => [...prev, {
            agent: activeAgent,
            message: execResult.success
              ? `✅ **Action Executed Successfully**\n\n${execResult.result?.message || 'Action completed.'}${execResult.result?.meetLink ? `\n\n🔗 **Meet Link:** ${execResult.result.meetLink}` : ''}${execResult.result?.eventId ? `\n📅 Event ID: ${execResult.result.eventId}` : ''}`
              : `❌ **Action Failed**\n\n${execResult.error || 'Unknown error occurred.'}`
          }]);
        }
      } catch (error) {
        console.error('Approval error:', error);
        setMessages(prev => [...prev, {
          agent: activeAgent,
          message: `❌ Error processing approval: ${error instanceof Error ? error.message : 'Unknown error'}`
        }]);
      }
    }

    setPendingApproval(null);
    setPendingEmailData(null);
  };

  // Handle email preview send - update approval with edited email and approve
  const handleEmailPreviewSend = async (editedEmail: { to: string[]; cc?: string[]; subject: string; body: string }) => {
    if (!pendingEmailData?.approvalId) return;

    setMessages(prev => [...prev, {
      isUser: true,
      message: `✓ Approved email to ${editedEmail.to.join(', ')}`
    }]);

    try {
      // Send approval with edited email data
      const response = await fetch(`${API_URL}/api/agents/approve/${pendingEmailData.approvalId}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-user-id': DEMO_USER_ID
        },
        body: JSON.stringify({
          approved: true,
          userId: DEMO_USER_ID,
          updatedData: editedEmail // Send edited email data to backend
        })
      });

      const result = await response.json();

      if (result.execution?.success) {
        setMessages(prev => [...prev, {
          agent: activeAgent,
          message: `✅ **Email Sent Successfully**\n\nTo: ${editedEmail.to.join(', ')}\nSubject: ${editedEmail.subject}`
        }]);
      } else {
        setMessages(prev => [...prev, {
          agent: activeAgent,
          message: `❌ **Failed to Send Email**\n\n${result.execution?.error || 'Unknown error'}`
        }]);
      }
    } catch (error) {
      console.error('Email send error:', error);
      setMessages(prev => [...prev, {
        agent: activeAgent,
        message: `❌ Error sending email: ${error instanceof Error ? error.message : 'Unknown error'}`
      }]);
    }

    setPendingApproval(null);
    setPendingEmailData(null);
  };

  // Handle email preview cancel
  const handleEmailPreviewCancel = () => {
    handleApproval(false); // Reject the approval
  };

  // Get Claude suggestions for email
  const handleGetEmailSuggestions = async (email: { subject: string; body: string }): Promise<string> => {
    try {
      const response = await fetch(`${API_URL}/api/ai/chat`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-user-id': DEMO_USER_ID
        },
        body: JSON.stringify({
          message: `Please improve this email. Make it more professional, clear, and engaging while maintaining the original intent. Only return the improved email body, no explanations.\n\nSubject: ${email.subject}\n\nBody:\n${email.body}`,
          sessionId,
          model: selectedModel,
          useKnowledgeBase: false
        })
      });

      const data = await response.json();
      return data.response || email.body;
    } catch (error) {
      console.error('Failed to get suggestions:', error);
      return email.body;
    }
  };

  const handleQuickAction = (actionId: string) => {
    // Check if it's a workspace action
    if (actionId === 'schedule_meeting') {
      setActiveInteractiveAction('meeting');
      return;
    }
    if (actionId === 'send_email') {
      setActiveInteractiveAction('email');
      return;
    }
    if (actionId === 'create_document') {
      setActiveInteractiveAction('document');
      return;
    }
    // Check if it's a general mode action (portfolio-level, no customer context)
    const generalAction = GENERAL_MODE_ACTIONS.find(a => a.id === actionId);
    if (generalAction?.cadgTaskType) {
      const message = buildCadgTriggerMessage(generalAction.cadgTaskType);
      setMessages(prev => [...prev, { isUser: true, message }]);
      sendToAgent(message);
      return;
    }
    // Use the same handler as agent actions - delegate to handleAgentAction
    handleAgentAction(activeAgent, actionId);
  };

  // Handler for when an interactive action is completed
  const handleInteractiveActionComplete = (result: {
    type: 'meeting' | 'email' | 'document';
    success: boolean;
    details?: Record<string, unknown>;
  }) => {
    setActiveInteractiveAction(null);

    // Add a message to the chat about the completed action
    const actionLabels = {
      meeting: 'Meeting scheduled',
      email: 'Email sent',
      document: 'Document created',
    };

    if (result.success) {
      setMessages(prev => [...prev, {
        agent: activeAgent,
        message: `✓ ${actionLabels[result.type]} successfully. ${
          result.type === 'meeting' && result.details?.meetLink
            ? `\n\n**Meet Link:** ${result.details.meetLink}`
            : ''
        }${
          result.type === 'document' && result.details?.webViewLink
            ? `\n\n**View Document:** ${result.details.webViewLink}`
            : ''
        }`,
      }]);
    }
  };

  // Handler for cancelling an interactive action
  const handleInteractiveActionCancel = () => {
    setActiveInteractiveAction(null);
  };

  // Handle clicking on an agent card
  const handleAgentClick = (agentType: CSAgentType) => {
    // Switch to this agent and optionally set it as the forced agent
    setSelectedAgent(agentType);
    setActiveAgent(agentType);
    setCsAgentStatuses(prev => {
      const newStatuses = { ...prev };
      Object.keys(newStatuses).forEach(key => {
        newStatuses[key as CSAgentType] = key === agentType ? 'active' : 'idle';
      });
      return newStatuses;
    });
  };

  // Clean up workflow polling on unmount
  useEffect(() => {
    return () => {
      if (workflowPolling) {
        clearInterval(workflowPolling);
      }
    };
  }, [workflowPolling]);

  // Poll for workflow execution status updates
  const pollWorkflowStatus = useCallback(async (executionId: string) => {
    try {
      const response = await fetch(`${API_URL}/api/workflows/execution/${executionId}`);
      if (!response.ok) return;

      const data = await response.json();
      const execution = data.execution as WorkflowExecution;

      setActiveWorkflow(execution);

      // Stop polling if workflow is complete or needs approval
      const terminalStatuses = ['awaiting_review', 'approved', 'rejected', 'completed', 'failed'];
      if (terminalStatuses.includes(execution.status)) {
        if (workflowPolling) {
          clearInterval(workflowPolling);
          setWorkflowPolling(null);
        }

        // Add completion message with file links to chat for completed workflows
        if (execution.status === 'completed' && execution.output) {
          const output = execution.output;
          let fileLinksMessage = '';

          if (output.driveLinks && output.driveLinks.length > 0) {
            // Show folder first if present
            const folderLink = output.driveLinks.find((l: { type: string }) => l.type === 'folder');
            const fileLinks = output.driveLinks.filter((l: { type: string }) => l.type !== 'folder');

            if (folderLink) {
              const folderName = output.folderName || 'Customer Workspace';
              fileLinksMessage = `\n\n📁 **Folder:** [${folderName}](${folderLink.webViewLink})\n`;
            }

            if (fileLinks.length > 0) {
              fileLinksMessage += '\n**Created Files:**\n';
              fileLinks.forEach((link: { type: string; name: string; webViewLink: string }) => {
                const icon = link.type === 'sheet' ? '📊' :
                            link.type === 'slide' ? '📽️' :
                            link.type === 'calendar' ? '📅' : '📄';
                fileLinksMessage += `- ${icon} [${link.name}](${link.webViewLink})\n`;
              });
            }
          }

          setMessages(prev => [...prev, {
            agent: activeAgent,
            message: `✅ **${getWorkflowName(execution.workflowId)}** completed!\n\n${output.summary || 'Workflow executed successfully.'}${fileLinksMessage}`,
          }]);

          // Clear workflow after showing message
          setTimeout(() => setActiveWorkflow(null), 1500);
        }
      }
    } catch (error) {
      console.error('Failed to poll workflow status:', error);
    }
  }, [workflowPolling, activeAgent]);

  // Execute a workflow for an agent action
  const executeWorkflow = async (actionId: string, agentType: CSAgentType) => {
    const customerId = customer?.id || 'unknown';
    const customerARR = typeof customer?.arr === 'number' ? customer.arr : parseInt(String(customer?.arr || '0').replace(/[^0-9]/g, '')) || 0;

    try {
      const response = await fetch(`${API_URL}/api/workflows/execute-action`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-user-id': DEMO_USER_ID
        },
        body: JSON.stringify({
          actionId,
          userId: DEMO_USER_ID,
          agentType,
          customerId,
          customerName: customer?.name || 'Unknown Customer',
          customerARR,
          renewalDate: contractData?.contract_period,
          healthScore: 70,
          useAIEnhancement, // Pass AI enhancement toggle
        }),
      });

      const data = await response.json();

      if (!data.success || !data.hasWorkflow) {
        // No workflow for this action, fall back to chat-based handling
        return false;
      }

      // Set the workflow execution
      const execution: WorkflowExecution = {
        id: data.execution.id,
        workflowId: data.execution.workflowId,
        workflowName: getWorkflowName(data.execution.workflowId),
        status: data.execution.status,
        steps: data.execution.steps,
        output: data.execution.output,
        createdAt: data.execution.createdAt,
      };

      setActiveWorkflow(execution);

      // If already completed, show message and clear immediately
      if (execution.status === 'completed') {
        const output = execution.output;
        let fileLinksMessage = '';

        if (output?.driveLinks && output.driveLinks.length > 0) {
          const folderLink = output.driveLinks.find((l: { type: string }) => l.type === 'folder');
          const fileLinks = output.driveLinks.filter((l: { type: string }) => l.type !== 'folder');

          if (folderLink) {
            const folderName = output.folderName || 'Customer Workspace';
            fileLinksMessage = `\n\n📁 **Folder:** [${folderName}](${folderLink.webViewLink})\n`;
          }

          if (fileLinks.length > 0) {
            fileLinksMessage += '\n**Created Files:**\n';
            fileLinks.forEach((link: { type: string; name: string; webViewLink: string }) => {
              const icon = link.type === 'sheet' ? '📊' :
                          link.type === 'slide' ? '📽️' :
                          link.type === 'calendar' ? '📅' : '📄';
              fileLinksMessage += `- ${icon} [${link.name}](${link.webViewLink})\n`;
            });
          }
        }

        setMessages(prev => [...prev, {
          agent: activeAgent,
          message: `✅ **${execution.workflowName}** completed!\n\n${output?.summary || 'Workflow executed successfully.'}${fileLinksMessage}`,
        }]);

        // Clear workflow after brief display
        setTimeout(() => setActiveWorkflow(null), 1500);
        return true;
      }

      // For pending workflows, start polling for updates
      const pollInterval = setInterval(() => {
        pollWorkflowStatus(execution.id);
      }, 2000);
      setWorkflowPolling(pollInterval);

      return true;
    } catch (error) {
      console.error('Failed to execute workflow:', error);
      return false;
    }
  };

  // Get workflow display name from ID
  const getWorkflowName = (workflowId: string): string => {
    const names: Record<string, string> = {
      // Renewal workflows
      generate_renewal_forecast: 'Generate Renewal Forecast',
      create_qbr_package: 'Create QBR Package',
      build_value_summary: 'Build Value Summary',
      create_renewal_proposal: 'Create Renewal Proposal',
      analyze_expansion_opportunities: 'Analyze Expansion Opportunities',
      // Onboarding workflows
      create_kickoff_package: 'Create Kickoff Package',
      generate_onboarding_plan: 'Generate Onboarding Plan',
      create_welcome_sequence: 'Create Welcome Sequence',
      setup_customer_workspace: 'Setup Customer Workspace',
      create_training_materials: 'Create Training Materials',
      // Adoption workflows
      analyze_usage_metrics: 'Analyze Usage Metrics',
      create_adoption_report: 'Create Adoption Report',
      generate_training_recommendations: 'Generate Training Recommendations',
      create_feature_rollout_plan: 'Create Feature Rollout Plan',
      build_champion_playbook: 'Build Champion Playbook',
      // Risk workflows
      run_health_assessment: 'Run Health Assessment',
      create_save_play: 'Create Save Play',
      generate_escalation_report: 'Generate Escalation Report',
      analyze_churn_signals: 'Analyze Churn Signals',
      create_recovery_plan: 'Create Recovery Plan',
      // Strategic workflows
      create_account_plan: 'Create Account Plan',
      generate_executive_briefing: 'Generate Executive Briefing',
      build_success_story: 'Build Success Story',
      create_partnership_proposal: 'Create Partnership Proposal',
      analyze_strategic_opportunities: 'Analyze Strategic Opportunities',
    };
    return names[workflowId] || workflowId;
  };

  // Handle workflow approval
  const handleWorkflowApproval = async () => {
    if (!activeWorkflow) return;

    setIsProcessing(true);
    try {
      const response = await fetch(`${API_URL}/api/workflows/execution/${activeWorkflow.id}/approve`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-user-id': DEMO_USER_ID
        },
        body: JSON.stringify({ userId: DEMO_USER_ID }),
      });

      const data = await response.json();
      if (data.success) {
        setActiveWorkflow(prev => prev ? { ...prev, status: 'completed' } : null);

        // Build file links message with clickable URLs
        const output = activeWorkflow.output;
        let fileLinksMessage = '';

        if (output?.driveLinks?.length) {
          fileLinksMessage = '\n\n**Created Files:**\n';
          output.driveLinks.forEach((link: { type: string; name: string; webViewLink: string }) => {
            const icon = link.type === 'sheet' ? '📊' :
                        link.type === 'slide' ? '📽️' :
                        link.type === 'calendar' ? '📅' : '📄';
            fileLinksMessage += `- ${icon} [${link.name}](${link.webViewLink})\n`;
          });
        } else if (output?.summary) {
          // Extract URLs from output for older format
          const urlFields = ['sheetUrl', 'documentUrl', 'presentationUrl', 'slidesUrl', 'meetingUrl', 'deckUrl', 'appsScriptUrl'];
          const foundUrls: string[] = [];
          for (const field of urlFields) {
            if (output[field]) {
              const type = field.includes('sheet') ? '📊 Sheet' :
                          field.includes('slide') || field.includes('presentation') || field.includes('deck') ? '📽️ Slides' :
                          field.includes('meeting') ? '📅 Meeting' : '📄 Document';
              foundUrls.push(`- ${type}: ${output[field]}`);
            }
          }
          if (foundUrls.length > 0) {
            fileLinksMessage = '\n\n**Created Files:**\n' + foundUrls.join('\n');
          }
        }

        // Add completion message to chat with clickable links
        setMessages(prev => [...prev, {
          agent: activeAgent,
          message: `✓ **${activeWorkflow.workflowName}** completed successfully!${fileLinksMessage || '\n\nThe workflow has been executed.'}`,
        }]);

        // Clear workflow after a short delay
        setTimeout(() => setActiveWorkflow(null), 2000);
      }
    } catch (error) {
      console.error('Failed to approve workflow:', error);
    } finally {
      setIsProcessing(false);
    }
  };

  // Handle workflow rejection
  const handleWorkflowRejection = async () => {
    if (!activeWorkflow) return;

    setIsProcessing(true);
    try {
      const response = await fetch(`${API_URL}/api/workflows/execution/${activeWorkflow.id}/reject`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-user-id': DEMO_USER_ID
        },
        body: JSON.stringify({ userId: DEMO_USER_ID, reason: 'User rejected' }),
      });

      const data = await response.json();
      if (data.success) {
        setActiveWorkflow(prev => prev ? { ...prev, status: 'rejected' } : null);

        // Add rejection message to chat
        setMessages(prev => [...prev, {
          agent: activeAgent,
          message: `✗ **${activeWorkflow.workflowName}** was rejected. The created files have not been finalized.`,
        }]);

        // Clear workflow after a short delay
        setTimeout(() => setActiveWorkflow(null), 2000);
      }
    } catch (error) {
      console.error('Failed to reject workflow:', error);
    } finally {
      setIsProcessing(false);
    }
  };

  // Build the optimal CADG trigger message for a given task type
  // Returns a message string that will reliably trigger the correct CADG card
  const buildCadgTriggerMessage = (taskType: string, customerName?: string): string => {
    const name = customerName || customer?.name;

    // General Mode tasks (no customer context)
    const generalModeMessages: Record<string, string> = {
      portfolio_dashboard: 'Show me my portfolio dashboard with all customers',
      team_metrics: 'Show me team metrics and CSM performance dashboard',
      renewal_pipeline: 'Show me the renewal pipeline with upcoming renewals',
      at_risk_overview: 'Show me the at-risk overview dashboard',
    };

    if (generalModeMessages[taskType]) {
      return generalModeMessages[taskType];
    }

    // Customer-specific CADG trigger messages
    const customerMessages: Record<string, string> = {
      // Onboarding
      kickoff_plan: `Create a kickoff plan for ${name}`,
      milestone_plan: `Create a 30-60-90 day milestone plan for ${name}`,
      stakeholder_map: `Create a stakeholder map for ${name}`,
      training_schedule: `Create a training schedule for ${name}`,
      // Adoption
      usage_analysis: `Run a usage analysis for ${name}`,
      feature_campaign: `Create a feature adoption campaign for ${name}`,
      champion_development: `Create a champion development program for ${name}`,
      training_program: `Create a training program for ${name}`,
      // Renewal
      renewal_forecast: `Generate a renewal forecast for ${name}`,
      value_summary: `Create a value summary for ${name}`,
      expansion_proposal: `Create an expansion proposal for ${name}`,
      negotiation_brief: `Prepare a negotiation brief for ${name}`,
      // Risk
      risk_assessment: `Run a risk assessment for ${name}`,
      save_play: `Create a save play for ${name}`,
      escalation_report: `Create an escalation report for ${name}`,
      resolution_plan: `Create a resolution plan for ${name}`,
      // Strategic
      qbr_generation: `Create a QBR for ${name}`,
      executive_briefing: `Create an executive briefing for ${name}`,
      account_plan: `Create an account plan for ${name}`,
      transformation_roadmap: `Create a transformation roadmap for ${name}`,
    };

    return customerMessages[taskType] || `Generate ${taskType.replace(/_/g, ' ')} for ${name || 'the customer'}`;
  };

  // Handle selecting a specific action from an agent
  const handleAgentAction = async (agentType: CSAgentType, actionId: string) => {
    const customerName = customer?.name || 'the customer';

    // Switch to the appropriate agent first
    handleAgentClick(agentType);

    // Try to execute a workflow for this action first
    setIsProcessing(true);
    try {
      const workflowExecuted = await executeWorkflow(actionId, agentType);
      if (workflowExecuted) {
        // Workflow started successfully, add a message to indicate it
        setMessages(prev => [...prev, {
          agent: agentType,
          message: `Starting workflow for **${actionId.replace(/_/g, ' ')}**...\n\nFetching data from Google Workspace and preparing your deliverables.`,
        }]);
        setIsProcessing(false);
        return;
      }
    } catch (error) {
      console.error('Workflow execution failed, falling back to chat:', error);
    }
    setIsProcessing(false);

    // Check if this action has a CADG task type for direct CADG routing
    const agentActions = AGENT_ACTIONS[agentType];
    const action = agentActions?.find(a => a.id === actionId);

    if (action?.cadgTaskType) {
      // Route through CADG flow - buildCadgTriggerMessage creates a message
      // that the CADG classifier will reliably match to the correct card type
      const message = buildCadgTriggerMessage(action.cadgTaskType);
      setMessages(prev => [...prev, { isUser: true, message }]);
      sendToAgent(message);
      return;
    }

    // Non-CADG actions (draft_email, meeting_prep) use fallback chat messages
    const fallbackMessages: Record<string, Record<string, string>> = {
      onboarding: {
        meeting_prep: `Prepare meeting notes and agenda for ${customerName}.`,
      },
      renewal: {
        draft_email: `Draft a professional email for ${customerName} regarding their renewal.`,
      },
      strategic: {
        draft_email: `Draft a professional email for ${customerName} regarding strategic initiatives.`,
      },
    };

    const message = fallbackMessages[agentType]?.[actionId];
    if (message) {
      setMessages(prev => [...prev, { isUser: true, message }]);
      sendToAgent(message);
    }
  };

  // Read file content as text for supported file types
  const readFileAsText = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = () => reject(reader.error);
      reader.readAsText(file);
    });
  };

  // Check if file is a text-based format we can read
  const isTextBasedFile = (file: File): boolean => {
    const textTypes = [
      'text/plain',
      'text/csv',
      'application/json',
      'text/markdown',
      'text/html',
      'text/xml',
      'application/xml'
    ];
    const textExtensions = ['.txt', '.csv', '.json', '.md', '.html', '.xml', '.log'];

    // Check MIME type
    if (textTypes.some(t => file.type.includes(t))) return true;

    // Check extension as fallback
    const ext = '.' + file.name.split('.').pop()?.toLowerCase();
    return textExtensions.includes(ext);
  };

  // Keyboard shortcut handler for chat input
  const handleInputKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    // Cmd/Ctrl+Enter to send
    if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
      e.preventDefault();
      handleSend();
      return;
    }

    // Enter alone to send (existing behavior)
    if (e.key === 'Enter' && !e.shiftKey) {
      handleSend();
      return;
    }

    // Escape to close dropdowns/modals
    if (e.key === 'Escape') {
      setShowChatHistory(false);
      setShowAnalysisPanel(false);
      return;
    }

    // Up arrow in empty input to recall last message
    if (e.key === 'ArrowUp' && input === '' && messageHistory.length > 0) {
      e.preventDefault();
      const newIndex = historyIndex < messageHistory.length - 1 ? historyIndex + 1 : historyIndex;
      setHistoryIndex(newIndex);
      setInput(messageHistory[messageHistory.length - 1 - newIndex] || '');
      return;
    }

    // Down arrow to go forward in history
    if (e.key === 'ArrowDown' && historyIndex >= 0) {
      e.preventDefault();
      const newIndex = historyIndex - 1;
      if (newIndex < 0) {
        setHistoryIndex(-1);
        setInput('');
      } else {
        setHistoryIndex(newIndex);
        setInput(messageHistory[messageHistory.length - 1 - newIndex] || '');
      }
      return;
    }
  };

  const handleStopGeneration = useCallback(() => {
    abortControllerRef.current?.abort();
  }, []);

  const handleSend = async () => {
    if ((!input.trim() && !selectedFile) || isProcessing) return;

    const userMessage = input.trim();
    const attachedFile = selectedFile;

    // Add to message history for recall
    if (userMessage) {
      setMessageHistory(prev => [...prev.slice(-49), userMessage]); // Keep last 50
      setHistoryIndex(-1);
    }

    setInput('');
    setSelectedFile(null);

    // Queue message if offline
    if (!isOnline && userMessage && !attachedFile) {
      const queuedId = queueMessage(userMessage, customer?.id);
      setMessages(prev => [...prev, {
        id: queuedId,
        isUser: true,
        message: userMessage,
        status: 'sending',
      }]);
      return;
    }

    // Focus input after send
    setTimeout(() => textInputRef.current?.focus(), 0);

    // Build message with attachment info if present
    let messageToSend = userMessage;
    let messageToDisplay = userMessage;
    let documentContent: string | null = null;
    let attachmentMeta: { name: string; size: number; type: string; hasContent: boolean } | undefined;

    if (attachedFile) {
      // Add attachment indicator to display message
      const attachmentText = `📄 ${attachedFile.name}`;
      messageToDisplay = userMessage ? `${userMessage}\n\n${attachmentText}` : attachmentText;

      // Try to read file content for text-based files
      if (isTextBasedFile(attachedFile)) {
        try {
          documentContent = await readFileAsText(attachedFile);
          // Truncate very large files to avoid overwhelming the AI context
          const maxContentLength = 50000; // ~50KB of text
          if (documentContent.length > maxContentLength) {
            documentContent = documentContent.substring(0, maxContentLength) + '\n\n[Document truncated - showing first 50KB]';
          }
        } catch (error) {
          console.error('Failed to read file content:', error);
        }
      }

      // Build attachment metadata
      attachmentMeta = {
        name: attachedFile.name,
        size: attachedFile.size,
        type: attachedFile.type || 'application/octet-stream',
        hasContent: !!documentContent
      };

      // For the AI, include file info and content in the message context
      if (documentContent) {
        // Include actual document content for the AI to analyze
        messageToSend = userMessage
          ? `[Attached document: ${attachedFile.name}]\n\n--- DOCUMENT CONTENT START ---\n${documentContent}\n--- DOCUMENT CONTENT END ---\n\nUser message: ${userMessage}`
          : `[Attached document: ${attachedFile.name}]\n\n--- DOCUMENT CONTENT START ---\n${documentContent}\n--- DOCUMENT CONTENT END ---\n\nPlease analyze this document and provide insights.`;
      } else {
        // For non-text files (PDF, DOCX, XLSX), include metadata only
        messageToSend = userMessage
          ? `[Attached document: ${attachedFile.name} (${(attachedFile.size / 1024).toFixed(1)} KB, type: ${attachedFile.type || 'unknown'})]\n\nNote: This is a binary file format. I can see it's attached but cannot read its contents directly. Please describe what you'd like me to help with regarding this document.\n\nUser message: ${userMessage}`
          : `[Attached document: ${attachedFile.name} (${(attachedFile.size / 1024).toFixed(1)} KB, type: ${attachedFile.type || 'unknown'})]\n\nThis is a binary file format (like PDF, DOCX, or XLSX). While I can't read the contents directly, I can help you with:\n- Discussing what you'd like to do with this document\n- Providing guidance on document analysis\n- Answering questions if you paste relevant text from it\n\nWhat would you like help with?`;
      }
    }

    // Add message to UI with attachment metadata (optimistic update)
    const messageId = `msg_${Date.now()}`;
    setMessages(prev => [...prev, {
      id: messageId,
      isUser: true,
      message: messageToDisplay,
      attachment: attachmentMeta ? {
        name: attachmentMeta.name,
        size: attachmentMeta.size,
        type: attachmentMeta.type,
      } : undefined,
      status: 'sending',
    }]);

    // Pass attachment metadata to sendToAgent for database persistence
    sendToAgent(messageToSend, attachmentMeta, messageId);
  };

  // Retry a failed message
  const handleRetryMessage = (messageId: string, content: string) => {
    // Update message status to sending
    setMessages(prev => prev.map(msg =>
      msg.id === messageId ? { ...msg, status: 'sending' as const } : msg
    ));
    sendToAgent(content, undefined, messageId);
  };

  // Calculate plan progress for sidebar
  const getPlanProgress = () => {
    if (!plan?.phases) return { total: 0, completed: 0 };
    let total = 0;
    let completed = 0;

    plan.phases.forEach((phase, phaseIndex) => {
      phase.tasks?.forEach((task, taskIndex) => {
        total++;
        const taskId = `${phaseIndex}-${taskIndex}`;
        // Check if task is completed (from task.status or local state)
        if (task.status === 'completed' || completedTasks.has(taskId)) {
          completed++;
        }
      });
    });

    return { total, completed };
  };

  // Toggle task completion
  const toggleTaskCompletion = (phaseIndex: number, taskIndex: number) => {
    const taskId = `${phaseIndex}-${taskIndex}`;
    setCompletedTasks(prev => {
      const newSet = new Set(prev);
      if (newSet.has(taskId)) {
        newSet.delete(taskId);
      } else {
        newSet.add(taskId);
      }
      // Persist to localStorage for this customer
      const customerId = customer?.id || customer?.name || 'default';
      localStorage.setItem(`cscx_tasks_${customerId}`, JSON.stringify([...newSet]));
      return newSet;
    });
  };

  // Load completed tasks from localStorage on mount
  useEffect(() => {
    const customerId = customer?.id || customer?.name || 'default';
    const stored = localStorage.getItem(`cscx_tasks_${customerId}`);
    if (stored) {
      try {
        setCompletedTasks(new Set(JSON.parse(stored)));
      } catch (e) {
        console.error('Failed to parse stored tasks:', e);
      }
    }
  }, [customer?.id, customer?.name]);

  const planProgress = getPlanProgress();

  return (
    <div className="agent-control-center">
      {/* Sidebar */}
      <div className="agent-sidebar">
        <div className="sidebar-header">
          <div className="logo">
            <div className="logo-icon">C</div>
            <span>CSCX.AI</span>
          </div>
        </div>

        {/* Agent Selector */}
        <div className="agent-selector" style={{ padding: '10px', borderBottom: '1px solid #1a1a1a' }}>
          <p className="section-label">Agent Routing</p>
          <select
            value={selectedAgent}
            onChange={(e) => setSelectedAgent(e.target.value as CSAgentType | 'auto')}
            style={{
              width: '100%',
              padding: '6px 8px',
              background: '#1a1a1a',
              border: '1px solid #333',
              borderRadius: '6px',
              color: '#fff',
              fontSize: '12px',
              marginTop: '6px',
            }}
          >
            <option value="auto">Auto-route (Recommended)</option>
            <option value="onboarding">Onboarding Specialist</option>
            <option value="adoption">Adoption Specialist</option>
            <option value="renewal">Renewal Specialist</option>
            <option value="risk">Risk Specialist</option>
            <option value="strategic">Strategic CSM</option>
          </select>
          {lastRouting && (
            <p style={{ fontSize: '9px', color: '#888', marginTop: '4px' }}>
              Last: {lastRouting.agentType} ({Math.round(lastRouting.confidence * 100)}% conf)
            </p>
          )}
        </div>

        {/* Compact AI Settings */}
        <div className="ai-settings-compact" style={{ padding: '10px', borderBottom: '1px solid #1a1a1a' }}>
          <p className="section-label" style={{ marginBottom: '6px' }}>AI Settings</p>

          {/* Model Toggle - Two buttons */}
          <div style={{ display: 'flex', gap: '4px', marginBottom: '8px' }}>
            <button
              onClick={() => setSelectedModel('claude')}
              style={{
                flex: 1,
                padding: '5px 6px',
                background: selectedModel === 'claude' ? '#e63946' : '#1a1a1a',
                border: `1px solid ${selectedModel === 'claude' ? '#e63946' : '#333'}`,
                borderRadius: '4px',
                color: selectedModel === 'claude' ? '#fff' : '#999',
                fontSize: '10px',
                fontWeight: selectedModel === 'claude' ? 600 : 400,
                cursor: 'pointer',
                transition: 'all 0.2s',
              }}
            >
              🧠 Claude
            </button>
            <button
              onClick={() => setSelectedModel('gemini')}
              style={{
                flex: 1,
                padding: '5px 6px',
                background: selectedModel === 'gemini' ? '#e63946' : '#1a1a1a',
                border: `1px solid ${selectedModel === 'gemini' ? '#e63946' : '#333'}`,
                borderRadius: '4px',
                color: selectedModel === 'gemini' ? '#fff' : '#999',
                fontSize: '10px',
                fontWeight: selectedModel === 'gemini' ? 600 : 400,
                cursor: 'pointer',
                transition: 'all 0.2s',
              }}
            >
              ⚡ Gemini
            </button>
          </div>

          {/* Compact Toggles Row */}
          <div style={{ display: 'flex', gap: '10px' }}>
            {/* Knowledge Base Toggle */}
            <label style={{ display: 'flex', alignItems: 'center', gap: '5px', cursor: 'pointer', flex: 1 }}>
              <div
                onClick={() => setUseKnowledgeBase(!useKnowledgeBase)}
                style={{
                  width: '28px',
                  height: '16px',
                  background: useKnowledgeBase ? '#e63946' : '#333',
                  borderRadius: '8px',
                  position: 'relative',
                  transition: 'background 0.2s',
                  cursor: 'pointer',
                  flexShrink: 0,
                }}
              >
                <div
                  style={{
                    width: '12px',
                    height: '12px',
                    background: '#fff',
                    borderRadius: '50%',
                    position: 'absolute',
                    top: '2px',
                    left: useKnowledgeBase ? '14px' : '2px',
                    transition: 'left 0.2s',
                  }}
                />
              </div>
              <span style={{ fontSize: '10px', color: useKnowledgeBase ? '#fff' : '#666' }}>KB</span>
            </label>

            {/* AI Enhancement Toggle */}
            <label style={{ display: 'flex', alignItems: 'center', gap: '5px', cursor: 'pointer', flex: 1 }}>
              <div
                onClick={() => setUseAIEnhancement(!useAIEnhancement)}
                style={{
                  width: '28px',
                  height: '16px',
                  background: useAIEnhancement ? '#e63946' : '#333',
                  borderRadius: '8px',
                  position: 'relative',
                  transition: 'background 0.2s',
                  cursor: 'pointer',
                  flexShrink: 0,
                }}
              >
                <div
                  style={{
                    width: '12px',
                    height: '12px',
                    background: '#fff',
                    borderRadius: '50%',
                    position: 'absolute',
                    top: '2px',
                    left: useAIEnhancement ? '14px' : '2px',
                    transition: 'left 0.2s',
                  }}
                />
              </div>
              <span style={{ fontSize: '10px', color: useAIEnhancement ? '#fff' : '#666' }}>AI+</span>
            </label>
          </div>
        </div>

        {/* Compact Agent Selector Pills */}
        <div className="agent-pills-container" style={{ padding: '10px', borderBottom: '1px solid #1a1a1a' }}>
          <p className="section-label">CS Specialist Agents</p>
          <div className="agent-pills" style={{
            display: 'flex',
            flexWrap: 'wrap',
            gap: '5px',
            marginTop: '6px',
          }}>
            {(Object.keys(CS_AGENTS) as CSAgentType[]).map((agentKey) => {
              const agent = CS_AGENTS[agentKey];
              const isActive = activeAgent === agentKey;
              return (
                <button
                  key={agentKey}
                  onClick={() => handleAgentClick(agentKey)}
                  className="agent-pill"
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '3px',
                    padding: '5px 8px',
                    background: isActive ? '#e63946' : '#1a1a1a',
                    border: `1px solid ${isActive ? '#e63946' : '#333'}`,
                    borderRadius: '14px',
                    color: isActive ? '#fff' : '#999',
                    fontSize: '11px',
                    fontWeight: isActive ? 600 : 400,
                    cursor: 'pointer',
                    transition: 'all 0.2s',
                  }}
                >
                  <span style={{ fontSize: '10px' }}>{agent.icon}</span>
                  <span>{agentKey.charAt(0).toUpperCase() + agentKey.slice(1)}</span>
                </button>
              );
            })}
          </div>
          {activeAgent && CS_AGENTS[activeAgent] && (
            <p style={{ fontSize: '9px', color: '#777', marginTop: '5px', lineHeight: '1.3' }}>
              {CS_AGENTS[activeAgent].description}
            </p>
          )}
        </div>

        {/* Customer Context - Enhanced */}
        <div className="customer-context">
          <p className="section-label">Current Customer</p>
          <p className="customer-name">{customer?.name || 'No customer selected'}</p>
          <p className="customer-details">
            {customer ? `$${typeof customer.arr === 'number' ? (customer.arr / 1000).toFixed(0) + 'K' : customer.arr} ARR` : 'Select a customer to begin'}
          </p>
          {contractData && (
            <p className="customer-details" style={{ marginTop: '2px', fontSize: '10px' }}>
              {contractData.entitlements?.length || 0} entitlements • {contractData.stakeholders?.length || 0} stakeholders
            </p>
          )}
        </div>

        {/* Plan Progress */}
        {plan && (
          <div className="customer-context" style={{ marginTop: '0', borderTop: 'none', paddingTop: '0' }}>
            <p className="section-label">Onboarding Plan</p>
            <p className="customer-details" style={{ fontSize: '10px' }}>
              {plan.timeline_days} days • {plan.phases?.length || 3} phases
            </p>
            <div style={{ marginTop: '6px', background: '#1a1a1a', borderRadius: '3px', height: '3px', overflow: 'hidden' }}>
              <div style={{
                width: planProgress.total > 0 ? `${(planProgress.completed / planProgress.total) * 100}%` : '0%',
                height: '100%',
                background: '#e63946',
                transition: 'width 0.3s'
              }} />
            </div>
            <p className="customer-details" style={{ marginTop: '3px', fontSize: '9px' }}>
              {planProgress.completed}/{planProgress.total} milestones
            </p>
          </div>
        )}

      </div>

      {/* Main Chat Area */}
      <div className="agent-main">
        <header className="agent-header">
          <div>
            <h1>{CS_AGENTS[activeAgent]?.name || 'AI Agent'}</h1>
            <p>LangChain RAG-powered • {customer?.name || 'Ready'}</p>
          </div>
          <div className="agent-status" style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            {/* Chat History Search Button */}
            <div style={{ position: 'relative' }}>
              <button
                onClick={() => setShowChatHistory(!showChatHistory)}
                title="Chat History"
                style={{
                  background: showChatHistory ? '#e63946' : '#1a1a1a',
                  border: `1px solid ${showChatHistory ? '#e63946' : '#333'}`,
                  borderRadius: '8px',
                  padding: '8px 10px',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  transition: 'all 0.2s',
                  color: showChatHistory ? '#fff' : '#888'
                }}
                onMouseEnter={(e) => {
                  if (!showChatHistory) {
                    e.currentTarget.style.borderColor = '#e63946';
                    e.currentTarget.style.color = '#e63946';
                  }
                }}
                onMouseLeave={(e) => {
                  if (!showChatHistory) {
                    e.currentTarget.style.borderColor = '#333';
                    e.currentTarget.style.color = '#888';
                  }
                }}
              >
                <span style={{ fontSize: '16px' }}>🔍</span>
              </button>
              <Suspense fallback={null}>
                <ChatHistoryDropdown
                  isOpen={showChatHistory}
                  onClose={() => setShowChatHistory(false)}
                  customerId={customer?.id}
                  customerName={customer?.name}
                />
              </Suspense>
            </div>
            {/* Agentic Mode Indicator */}
            {agenticModeEnabled && (
              <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                padding: '4px 10px',
                background: 'linear-gradient(135deg, #e63946 0%, #c41d3a 100%)',
                borderRadius: '12px',
                fontSize: '11px',
                fontWeight: 600,
                color: 'white',
                animation: 'pulse 2s infinite',
              }}>
                <span style={{ fontSize: '10px' }}>⚡</span>
                AGENTIC MODE
              </div>
            )}
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <span className={`status-dot ${activeAgent ? 'active' : ''}`} />
              <span>{activeAgent ? `${CS_AGENTS[activeAgent]?.name} active` : 'Idle'}</span>
            </div>
          </div>
        </header>

        {/* Offline Banner */}
        {!isOnline && (
          <div style={{
            background: '#f59e0b',
            color: '#000',
            padding: '8px 16px',
            fontSize: '12px',
            fontWeight: 500,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '8px',
          }}>
            <span>⚠️</span>
            <span>You are offline</span>
            {queuedCount > 0 && (
              <span style={{ opacity: 0.8 }}>
                ({queuedCount} message{queuedCount > 1 ? 's' : ''} queued)
              </span>
            )}
          </div>
        )}

        <div className="messages-container" ref={messagesContainerRef} onScroll={handleMessagesScroll}>
          {/* Onboarding Flow - Lazy loaded */}
          {showOnboardingFlow && (
            <Suspense fallback={<LazyFallback height="400px" />}>
              <div style={{ padding: '16px' }}>
                <OnboardingFlow
                  agentId="agent_onboarding"
                  onComplete={(result) => {
                    setOnboardingResult(result);
                    setShowOnboardingFlow(false);
                    // Add success message to chat
                    setMessages(prev => [...prev, {
                      agent: 'onboarding',
                      message: `✅ **Onboarding workspace created for ${result.contractData.company_name}!**\n\n` +
                        `- **Drive Folder:** [Open in Drive](https://drive.google.com/drive/folders/${result.driveRootId})\n` +
                        `- **Onboarding Tracker:** [Open Sheet](${result.sheetUrl})\n` +
                        `- **ARR:** $${result.contractData.arr?.toLocaleString()}\n` +
                        `- **Stakeholders:** ${result.contractData.stakeholders?.length || 0}\n\n` +
                        `What would you like to do next? I can schedule a kickoff meeting or send welcome emails.`,
                    }]);
                  }}
                  onCancel={() => setShowOnboardingFlow(false)}
                />
              </div>
            </Suspense>
          )}

          {/* Interactive Action Components - Lazy loaded */}
          {!showOnboardingFlow && activeInteractiveAction === 'meeting' && (
            <Suspense fallback={<LazyFallback height="300px" />}>
              <MeetingScheduler
                agentType={activeAgent}
                customerName={customer?.name}
                stakeholders={contractData?.stakeholders?.map(s => ({
                  id: s.name.toLowerCase().replace(/\s+/g, '-'),
                  email: s.email || `${s.name.toLowerCase().replace(/\s+/g, '.')}@${customer?.name?.toLowerCase().replace(/\s+/g, '')}.com`,
                  name: s.name,
                  title: s.role,
                  company: customer?.name,
                  source: 'stakeholder' as const,
                }))}
                onComplete={(result) => handleInteractiveActionComplete({
                  type: 'meeting',
                  success: result.success,
                  details: result,
                })}
                onCancel={handleInteractiveActionCancel}
              />
            </Suspense>
          )}
          {!showOnboardingFlow && activeInteractiveAction === 'email' && (
            <Suspense fallback={<LazyFallback height="300px" />}>
              <EmailComposer
                agentType={activeAgent}
                customerName={customer?.name}
                stakeholders={contractData?.stakeholders?.map(s => ({
                  id: s.name.toLowerCase().replace(/\s+/g, '-'),
                  email: s.email || `${s.name.toLowerCase().replace(/\s+/g, '.')}@${customer?.name?.toLowerCase().replace(/\s+/g, '')}.com`,
                  name: s.name,
                  title: s.role,
                  company: customer?.name,
                  source: 'stakeholder' as const,
                }))}
                onComplete={(result) => handleInteractiveActionComplete({
                  type: 'email',
                  success: result.success,
                  details: result,
                })}
                onCancel={handleInteractiveActionCancel}
              />
            </Suspense>
          )}
          {!showOnboardingFlow && activeInteractiveAction === 'document' && (
            <Suspense fallback={<LazyFallback height="300px" />}>
              <DocumentActions
                agentType={activeAgent}
                customerName={customer?.name}
                onComplete={(result) => handleInteractiveActionComplete({
                  type: 'document',
                  success: result.success,
                  details: result,
                })}
                onCancel={handleInteractiveActionCancel}
              />
            </Suspense>
          )}

          {/* Loading skeleton while fetching history */}
          {isLoadingHistory && (
            <MessageSkeleton />
          )}

          {/* Regular chat messages when no interactive action is active */}
          {!isLoadingHistory && !showOnboardingFlow && !activeInteractiveAction && messages.length === 0 && !activeWorkflow ? (
            <div className="empty-state">
              <div className="empty-icon">{CS_AGENTS[activeAgent]?.icon || '🤖'}</div>
              <h2>{CS_AGENTS[activeAgent]?.name || 'AI Agent'} Ready</h2>
              <p>LangChain-powered with RAG knowledge base. Auto-routing intelligently selects the best specialist for each conversation.</p>
              {/* Inline CADG action chips - agent-specific or general mode */}
              <div style={{
                display: 'flex',
                flexWrap: 'wrap',
                gap: '8px',
                justifyContent: 'center',
                marginBottom: '16px',
                maxWidth: '480px',
              }}>
                {(customer
                  ? (AGENT_ACTIONS[activeAgent] || []).filter(a => a.cadgTaskType)
                  : GENERAL_MODE_ACTIONS
                ).map((action) => (
                  <button
                    key={action.id}
                    onClick={() => handleQuickAction(action.id)}
                    disabled={isProcessing}
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '6px',
                      padding: '8px 16px',
                      background: `${CS_AGENTS[activeAgent]?.color || '#e63946'}12`,
                      border: `1px solid ${CS_AGENTS[activeAgent]?.color || '#e63946'}30`,
                      borderRadius: '20px',
                      color: CS_AGENTS[activeAgent]?.color || '#e63946',
                      fontSize: '12px',
                      fontWeight: 500,
                      cursor: isProcessing ? 'not-allowed' : 'pointer',
                      opacity: isProcessing ? 0.5 : 1,
                      transition: 'all 0.2s',
                      whiteSpace: 'nowrap',
                    }}
                    onMouseEnter={(e) => {
                      if (!isProcessing) {
                        e.currentTarget.style.background = `${CS_AGENTS[activeAgent]?.color || '#e63946'}25`;
                        e.currentTarget.style.borderColor = `${CS_AGENTS[activeAgent]?.color || '#e63946'}60`;
                      }
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.background = `${CS_AGENTS[activeAgent]?.color || '#e63946'}12`;
                      e.currentTarget.style.borderColor = `${CS_AGENTS[activeAgent]?.color || '#e63946'}30`;
                    }}
                  >
                    <span style={{ fontSize: '14px' }}>{action.icon}</span>
                    <span>{action.label}</span>
                  </button>
                ))}
              </div>
              <QuickActions onAction={handleQuickAction} disabled={isProcessing} activeAgent={activeAgent} hasCustomer={!!customer} />
            </div>
          ) : !isLoadingHistory && !showOnboardingFlow && !activeInteractiveAction && (
            <>
              {/* Virtualized message list for 60fps with 1000+ messages */}
              <div
                style={{
                  height: `${rowVirtualizer.getTotalSize()}px`,
                  width: '100%',
                  position: 'relative',
                }}
              >
                {rowVirtualizer.getVirtualItems().map((virtualItem) => {
                  const msg = messages[virtualItem.index];
                  return (
                    <div
                      key={virtualItem.key}
                      data-index={virtualItem.index}
                      ref={rowVirtualizer.measureElement}
                      style={{
                        position: 'absolute',
                        top: 0,
                        left: 0,
                        width: '100%',
                        transform: `translateY(${virtualItem.start}px)`,
                      }}
                    >
                      <Message
                        message={msg.message}
                        agent={msg.agent}
                        isUser={msg.isUser}
                        isThinking={msg.isThinking}
                        isStreaming={msg.isStreaming}
                        isApproval={msg.isApproval && pendingApproval !== null}
                        onApprove={handleApproval}
                        toolResults={msg.toolResults}
                        attachment={msg.attachment}
                        status={msg.status}
                        onRetry={msg.id && msg.status === 'failed' ? () => handleRetryMessage(msg.id!, msg.message) : undefined}
                      />
                      {/* CADG Plan Card - Don't clear pendingCadgPlan so card can show completed state with links */}
                      {msg.isCadgPlan && pendingCadgPlan && (
                        <CADGPlanCard
                          metadata={pendingCadgPlan}
                          onApproved={(artifactId) => {
                            console.log('[CADG] Artifact generated:', artifactId);
                            // Don't clear pendingCadgPlan - let the card show the completed state with full details
                          }}
                          onRejected={() => {
                            setPendingCadgPlan(null);
                            setMessages(prev => [...prev, {
                              agent: 'strategic' as CSAgentType,
                              message: '⛔ Plan rejected. Let me know if you\'d like to try a different approach.',
                            }]);
                          }}
                        />
                      )}
                    </div>
                  );
                })}
              </div>
              {/* Show workflow progress after messages if active */}
              {activeWorkflow && (
                <WorkflowProgress
                  execution={activeWorkflow}
                  agentType={activeAgent}
                  onApprove={handleWorkflowApproval}
                  onReject={handleWorkflowRejection}
                  isProcessing={isProcessing}
                />
              )}
              <div ref={messagesEndRef} />
            </>
          )}

          {/* New Messages Button - shown when user scrolled up and new messages arrived */}
          {hasNewMessages && isUserScrolledUp && (
            <button
              onClick={scrollToBottom}
              style={{
                position: 'absolute',
                bottom: '20px',
                left: '50%',
                transform: 'translateX(-50%)',
                background: '#e63946',
                color: '#fff',
                border: 'none',
                borderRadius: '20px',
                padding: '8px 16px',
                fontSize: '12px',
                fontWeight: 500,
                cursor: 'pointer',
                boxShadow: '0 2px 8px rgba(0,0,0,0.3)',
                zIndex: 10,
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                animation: 'slideUp 0.2s ease-out',
              }}
            >
              New messages ↓
            </button>
          )}
        </div>

        <div className="input-area">
          {/* Workspace Action Buttons */}
          <div className="workspace-actions-row">
            {/* Show Start New Onboarding button when Onboarding Specialist is active */}
            {activeAgent === 'onboarding' && (
              <button
                className={`workspace-action-btn ${showOnboardingFlow ? 'active' : ''}`}
                onClick={() => setShowOnboardingFlow(true)}
                disabled={isProcessing || pendingApproval !== null || activeWorkflow !== null || showOnboardingFlow}
                style={{ background: showOnboardingFlow ? '#e63946' : undefined }}
              >
                🚀 Start New Onboarding
              </button>
            )}
            <button
              className={`workspace-action-btn ${activeInteractiveAction === 'meeting' ? 'active' : ''}`}
              onClick={() => setActiveInteractiveAction('meeting')}
              disabled={isProcessing || pendingApproval !== null || activeWorkflow !== null || showOnboardingFlow}
            >
              📅 Schedule Meeting
            </button>
            <button
              className={`workspace-action-btn ${activeInteractiveAction === 'email' ? 'active' : ''}`}
              onClick={() => setActiveInteractiveAction('email')}
              disabled={isProcessing || pendingApproval !== null || activeWorkflow !== null || showOnboardingFlow}
            >
              ✉️ Send Email
            </button>
            <button
              className={`workspace-action-btn ${activeInteractiveAction === 'document' ? 'active' : ''}`}
              onClick={() => setActiveInteractiveAction('document')}
              disabled={isProcessing || pendingApproval !== null || activeWorkflow !== null || showOnboardingFlow}
            >
              📄 Create Document
            </button>
            <button
              className="workspace-action-btn"
              onClick={() => setShowAnalysisPanel(!showAnalysisPanel)}
              style={{ background: showAnalysisPanel ? '#7c3aed' : undefined }}
            >
              🤖 Analyze Data
            </button>
          </div>

          {/* Agent Analysis Panel - Lazy loaded */}
          {showAnalysisPanel && !showOnboardingFlow && (
            <Suspense fallback={<LazyFallback height="200px" />}>
              <div style={{ padding: '8px 0' }}>
                <AgentAnalysisActions
                  agentType={activeAgent}
                  customerId={customer?.id}
                  customerName={customer?.name}
                />
              </div>
            </Suspense>
          )}

          {messages.length > 0 && !showOnboardingFlow && !activeInteractiveAction && !activeWorkflow && (
            <div className="quick-actions-row">
              <QuickActions onAction={handleQuickAction} disabled={isProcessing || pendingApproval !== null} activeAgent={activeAgent} hasCustomer={!!customer} />
            </div>
          )}
          {/* Selected File Chip */}
          {selectedFile && (
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              padding: '6px 10px',
              background: '#1a1a1a',
              borderRadius: '8px',
              marginBottom: '8px',
              border: '1px solid #333',
            }}>
              <span style={{ fontSize: '14px' }}>📄</span>
              <span style={{
                fontSize: '12px',
                color: '#fff',
                flex: 1,
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
              }}>
                {selectedFile.name}
              </span>
              <span style={{ fontSize: '10px', color: '#888' }}>
                {(selectedFile.size / 1024).toFixed(1)} KB
              </span>
              <button
                onClick={() => setSelectedFile(null)}
                style={{
                  background: 'transparent',
                  border: 'none',
                  color: '#888',
                  cursor: 'pointer',
                  padding: '2px 6px',
                  fontSize: '14px',
                  borderRadius: '4px',
                  transition: 'all 0.2s',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.color = '#e63946';
                  e.currentTarget.style.background = 'rgba(230, 57, 70, 0.1)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.color = '#888';
                  e.currentTarget.style.background = 'transparent';
                }}
                title="Remove attachment"
              >
                ✕
              </button>
            </div>
          )}

          {/* Hidden file input */}
          <input
            type="file"
            ref={fileInputRef}
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) {
                setSelectedFile(file);
              }
              // Reset input so same file can be selected again
              e.target.value = '';
            }}
            accept=".pdf,.doc,.docx,.txt,.csv,.xlsx,.xls"
            style={{ display: 'none' }}
          />

          <div className="input-row">
            {/* Paperclip attachment button */}
            <button
              onClick={() => fileInputRef.current?.click()}
              disabled={isProcessing || pendingApproval !== null || activeWorkflow !== null || showOnboardingFlow}
              title="Attach document"
              style={{
                background: '#1a1a1a',
                border: '1px solid #333',
                borderRadius: '8px',
                padding: '10px 12px',
                cursor: isProcessing || showOnboardingFlow ? 'not-allowed' : 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                transition: 'all 0.2s',
                color: selectedFile ? '#e63946' : '#888',
                opacity: isProcessing || showOnboardingFlow ? 0.5 : 1,
              }}
              onMouseEnter={(e) => {
                if (!isProcessing && !showOnboardingFlow) {
                  e.currentTarget.style.borderColor = '#e63946';
                  e.currentTarget.style.color = '#e63946';
                }
              }}
              onMouseLeave={(e) => {
                if (!isProcessing && !showOnboardingFlow) {
                  e.currentTarget.style.borderColor = '#333';
                  e.currentTarget.style.color = selectedFile ? '#e63946' : '#888';
                }
              }}
            >
              <span style={{ fontSize: '16px' }}>📎</span>
            </button>
            <input
              ref={textInputRef}
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleInputKeyDown}
              placeholder={showOnboardingFlow ? 'Complete onboarding flow above...' : activeWorkflow ? 'Workflow in progress...' : selectedFile ? `Message with ${selectedFile.name}...` : `Message the ${CS_AGENTS[activeAgent]?.name || 'AI Agent'}...`}
              disabled={isProcessing || pendingApproval !== null || activeWorkflow !== null || showOnboardingFlow}
            />
            {isStreaming ? (
              <button
                className="stop-generation-btn"
                onClick={handleStopGeneration}
              >
                ■ Stop
              </button>
            ) : (
              <button
                onClick={handleSend}
                disabled={isProcessing || (!input.trim() && !selectedFile) || pendingApproval !== null || activeWorkflow !== null || showOnboardingFlow}
              >
                {isProcessing ? '...' : 'Send'}
              </button>
            )}
          </div>
          <p className="input-hint">
            {agenticModeEnabled ? '⚡ Agentic Mode' : 'LangChain RAG'} · {
              predictedIntent && selectedAgent === 'auto' ? (
                <span style={{ color: CS_AGENTS[predictedIntent.agent].color }}>
                  {CS_AGENTS[predictedIntent.agent].icon} {CS_AGENTS[predictedIntent.agent].name} ({Math.round(predictedIntent.confidence * 100)}%)
                </span>
              ) : selectedAgent === 'auto' ? 'Auto-routing' : `${CS_AGENTS[selectedAgent]?.name}`
            } · {agenticModeEnabled ? 'Autonomous execution' : 'HITL approval'}
          </p>
        </div>
      </div>

      {/* Workspace Data Panel - Lazy loaded */}
      <Suspense fallback={null}>
        <WorkspaceDataPanel
          data={workspaceData}
          isCollapsed={!workspacePanelOpen}
          onToggle={() => setWorkspacePanelOpen(!workspacePanelOpen)}
        />
      </Suspense>

      {/* Email Preview Modal - Lazy loaded */}
      {pendingEmailData && (
        <Suspense fallback={<LazyFallback height="400px" />}>
          <EmailPreviewModal
            email={{
              to: pendingEmailData.to,
              cc: pendingEmailData.cc,
              subject: pendingEmailData.subject,
              body: pendingEmailData.body
            }}
            onSend={handleEmailPreviewSend}
            onCancel={handleEmailPreviewCancel}
            onGetSuggestions={handleGetEmailSuggestions}
            isLoading={isProcessing}
          />
        </Suspense>
      )}
    </div>
  );
};

export default AgentControlCenter;
