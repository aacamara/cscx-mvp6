import React, { useState, useEffect, useRef, useCallback } from 'react';
import { CS_AGENTS, AgentId, AgentMessage, CustomerContext, CSAgentType, RoutingDecision, AgentStatus } from '../../types/agents';
import { ContractExtraction, OnboardingPlan } from '../../types';
import { AgentCard, AGENT_ACTIONS } from './AgentCard';
import { Message } from './Message';
import { QuickActions } from './QuickActions';
import { GoogleConnectionWidget } from '../GoogleConnectionWidget';
import { MeetingScheduler, EmailComposer, DocumentActions } from './InteractiveActions';
import { WorkflowProgress, WorkflowExecution } from './WorkflowProgress';
import { OnboardingFlow, OnboardingResult } from '../AgentStudio/OnboardingFlow';
import { EmailPreviewModal } from './EmailPreviewModal';
import { WorkspaceDataPanel, WorkspaceData } from './WorkspaceDataPanel';
import { AgentAnalysisActions } from './AgentAnalysisActions';
import { useAgenticMode } from '../../context/AgenticModeContext';
import { useWebSocket } from '../../context/WebSocketContext';
import './styles.css';

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

  // Agentic mode integration (shared context)
  const { isEnabled: agenticModeEnabled, executeGoal, resumeExecution } = useAgenticMode();
  const { connected: wsConnected } = useWebSocket();
  const [agenticStateId, setAgenticStateId] = useState<string | null>(null);
  // Persist sessionId per customer in localStorage
  const [sessionId] = useState(() => {
    const customerId = customer?.id || customer?.name || 'default';
    const storageKey = `cscx_session_${customerId}`;
    const stored = localStorage.getItem(storageKey);
    if (stored) return stored;
    const newId = `session_${customerId}_${Date.now()}`;
    localStorage.setItem(storageKey, newId);
    return newId;
  });
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
  const [googleConnected, setGoogleConnected] = useState(false);
  const [activeInteractiveAction, setActiveInteractiveAction] = useState<InteractiveActionType>(null);
  const [activeWorkflow, setActiveWorkflow] = useState<WorkflowExecution | null>(null);
  const [workflowPolling, setWorkflowPolling] = useState<NodeJS.Timeout | null>(null);
  const [showOnboardingFlow, setShowOnboardingFlow] = useState(false);
  const [onboardingResult, setOnboardingResult] = useState<OnboardingResult | null>(null);
  const [completedTasks, setCompletedTasks] = useState<Set<string>>(new Set());
  const [showAnalysisPanel, setShowAnalysisPanel] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const messagesContainerRef = useRef<HTMLDivElement>(null);

  const scrollToTop = () => {
    messagesContainerRef.current?.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  // Scroll to top when first message arrives (new conversation)
  // Scroll to bottom for subsequent messages
  useEffect(() => {
    if (messages.length === 1) {
      // First message - scroll to top to show it
      scrollToTop();
    } else if (messages.length > 1) {
      // Subsequent messages - scroll to bottom to show latest
      scrollToBottom();
    }
  }, [messages]);

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
      setMessages([contextSummary]);

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
      const response = await fetch(`${API_URL}/api/agent-activities/customer/${customer.id}`, {
        headers: {
          'x-user-id': DEMO_USER_ID
        }
      });

      if (response.ok) {
        const data = await response.json();
        if (data.chatHistory && data.chatHistory.length > 0) {
          // Convert chat history to AgentMessage format
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
          }));

          // Only set if we don't already have messages (avoid overwriting new messages)
          setMessages(prev => {
            if (prev.length <= 1) {
              return loadedMessages;
            }
            return prev;
          });
          console.log(`[AgentControlCenter] Loaded ${loadedMessages.length} messages from history`);
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
  const saveChatMessage = async (role: string, content: string, agentType?: string, toolCalls?: any[]) => {
    const customerId = customer?.id;
    if (!customerId) return; // Only save if we have a customer context

    try {
      await fetch(`${API_URL}/api/agent-activities/chat-message`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-user-id': DEMO_USER_ID
        },
        body: JSON.stringify({
          customerId,
          role,
          content,
          agentType,
          toolCalls,
          sessionId
        })
      });
    } catch (err) {
      console.error('Failed to save chat message:', err);
    }
  };

  // Send message to LangChain-powered AI backend (or agentic system)
  const sendToAgent = async (message: string) => {
    // Save user message to database
    saveChatMessage('user', message);
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

  // Regular (non-agentic) chat flow
  const sendToAgentRegular = async (message: string) => {
    try {
      const response = await fetch(`${API_URL}/api/ai/chat`, {
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
          sessionId,
          useWorkflow: true,
          model: selectedModel,
          useKnowledgeBase // Pass knowledge base toggle to backend
        })
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error?.message || 'Failed to get response');
      }

      const data = await response.json();

      // Update active agent based on routing decision
      const routedAgent = data.routing?.agentType as CSAgentType || 'onboarding';
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
      if (data.toolResults?.length > 0) {
        processToolResults(data.toolResults);
      }

      // Save assistant response to database
      saveChatMessage('assistant', data.response, routedAgent, data.toolResults);

      // Remove thinking message and add real response with tool results
      setMessages(prev => {
        const filtered = prev.filter(m => !m.isThinking);
        return [...filtered, {
          agent: routedAgent,
          message: data.response,
          isApproval: data.requiresApproval,
          routing: data.routing,
          toolResults: data.toolResults, // Include tool results for inline display
        }];
      });

      // Handle approval request - use the actual approval ID from pendingActions
      if (data.requiresApproval && data.pendingActions?.length > 0) {
        const pendingAction = data.pendingActions[0];
        const approvalId = pendingAction?.approvalId;
        if (approvalId) {
          setPendingApproval(approvalId);

          // Check if this is an email action - show email preview modal
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

    } catch (error) {
      console.error('Agent error:', error);
      setMessages(prev => {
        const filtered = prev.filter(m => !m.isThinking);
        return [...filtered, {
          agent: activeAgent,
          message: `Sorry, I encountered an error: ${error instanceof Error ? error.message : 'Please try again.'}`
        }];
      });
    } finally {
      setIsProcessing(false);
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

  // Handle selecting a specific action from an agent
  const handleAgentAction = async (agentType: CSAgentType, actionId: string) => {
    const customerName = customer?.name || 'the customer';
    const stakeholderNames = contractData?.stakeholders?.slice(0, 2).map(s => s.name).join(' and ') || 'the team';
    const arrDisplay = customer?.arr ? `$${typeof customer.arr === 'number' ? (customer.arr / 1000).toFixed(0) + 'K' : customer.arr}` : 'their';

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

    // Fall back to chat-based handling if no workflow or workflow failed
    // Build context-aware messages for each action
    const actionMessages: Record<string, Record<string, string>> = {
      // Onboarding Specialist actions
      onboarding: {
        kickoff: `Schedule a kickoff meeting with ${stakeholderNames} for ${customerName}. Include agenda items for introductions, goal alignment, and timeline review.`,
        plan_30_60_90: `Generate a comprehensive 30-60-90 day onboarding plan for ${customerName}. Consider their ${arrDisplay} ARR and technical requirements.`,
        stakeholder_map: `Create a stakeholder map for ${customerName}. Identify decision makers, champions, and end users from their team.`,
        welcome_sequence: `Draft a welcome email sequence for ${customerName}. Include introductions, resource links, and next steps.`,
      },
      // Adoption Specialist actions
      adoption: {
        usage_analysis: `Analyze product usage patterns for ${customerName}. Identify underutilized features and engagement trends.`,
        adoption_campaign: `Create an adoption campaign for ${customerName} to increase feature utilization and drive value realization.`,
        feature_training: `Deploy targeted feature training for ${customerName}. Focus on their most relevant use cases and capabilities.`,
        champion_program: `Identify and develop product champions within ${customerName}. Find power users who can advocate internally.`,
      },
      // Renewal Specialist actions
      renewal: {
        renewal_forecast: `Generate a renewal forecast for ${customerName}. Assess likelihood, risks, and recommended timeline.`,
        value_summary: `Create a value summary document for ${customerName} showing ROI, achievements, and business impact.`,
        expansion_analysis: `Analyze expansion opportunities for ${customerName}. Identify upsell potential and additional use cases.`,
        renewal_playbook: `Start the renewal playbook for ${customerName}. Initialize the ${plan?.timeline_days ? 90 : 60}-day renewal motion.`,
      },
      // Risk Specialist actions
      risk: {
        risk_assessment: `Run a comprehensive risk assessment for ${customerName}. Evaluate health signals and identify warning signs.`,
        save_play: `Create a save play strategy for ${customerName}. Define intervention actions and success metrics.`,
        escalation: `Prepare an escalation report for ${customerName}. Document issues, impact, and required executive attention.`,
        health_check: `Perform a deep health check for ${customerName}. Analyze usage, engagement, support, and sentiment signals.`,
      },
      // Strategic CSM actions
      strategic: {
        qbr_prep: `Prepare the QBR package for ${customerName}. Include performance metrics, achievements, roadmap, and strategic recommendations.`,
        exec_briefing: `Create an executive briefing document for ${customerName}. Summarize account status and strategic opportunities.`,
        account_plan: `Develop a strategic account plan for ${customerName}. Define goals, growth strategy, and key initiatives.`,
        success_plan: `Build a strategic success plan for ${customerName}. Align on business objectives and define success criteria.`,
      },
    };

    const message = actionMessages[agentType]?.[actionId];
    if (message) {
      setMessages(prev => [...prev, { isUser: true, message }]);
      sendToAgent(message);
    }
  };

  const handleSend = () => {
    if (!input.trim() || isProcessing) return;

    const userMessage = input.trim();
    setInput('');
    setMessages(prev => [...prev, { isUser: true, message: userMessage }]);
    sendToAgent(userMessage);
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
        <div className="agent-selector" style={{ padding: '12px', borderBottom: '1px solid #1a1a1a' }}>
          <p className="section-label">Agent Routing</p>
          <select
            value={selectedAgent}
            onChange={(e) => setSelectedAgent(e.target.value as CSAgentType | 'auto')}
            style={{
              width: '100%',
              padding: '8px',
              background: '#1a1a1a',
              border: '1px solid #333',
              borderRadius: '6px',
              color: '#fff',
              fontSize: '13px',
              marginTop: '8px',
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
            <p style={{ fontSize: '10px', color: '#888', marginTop: '6px' }}>
              Last: {lastRouting.agentType} ({Math.round(lastRouting.confidence * 100)}% conf)
            </p>
          )}
        </div>

        {/* Model Selector */}
        <div className="model-selector" style={{ padding: '12px', borderBottom: '1px solid #1a1a1a' }}>
          <p className="section-label">AI Model</p>
          <select
            value={selectedModel}
            onChange={(e) => setSelectedModel(e.target.value as 'claude' | 'gemini')}
            style={{
              width: '100%',
              padding: '8px',
              background: '#1a1a1a',
              border: '1px solid #333',
              borderRadius: '6px',
              color: '#fff',
              fontSize: '13px',
              marginTop: '8px',
            }}
          >
            <option value="claude">Claude Sonnet 4</option>
            <option value="gemini">Gemini 2.0 Flash</option>
          </select>
          <p style={{ fontSize: '10px', color: '#888', marginTop: '6px' }}>
            {selectedModel === 'claude' ? '🧠 Advanced reasoning & tools' : '⚡ Fast multimodal'}
          </p>
        </div>

        {/* Knowledge Base Toggle */}
        <div className="knowledge-toggle" style={{ padding: '12px', borderBottom: '1px solid #1a1a1a' }}>
          <label style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', cursor: 'pointer' }}>
            <span style={{ fontSize: '13px', color: '#fff' }}>📚 Knowledge Base</span>
            <div style={{ position: 'relative' }}>
              <input
                type="checkbox"
                checked={useKnowledgeBase}
                onChange={(e) => setUseKnowledgeBase(e.target.checked)}
                style={{ display: 'none' }}
              />
              <div
                onClick={() => setUseKnowledgeBase(!useKnowledgeBase)}
                style={{
                  width: '40px',
                  height: '22px',
                  background: useKnowledgeBase ? '#e63946' : '#333',
                  borderRadius: '11px',
                  position: 'relative',
                  transition: 'background 0.2s',
                  cursor: 'pointer',
                }}
              >
                <div
                  style={{
                    width: '18px',
                    height: '18px',
                    background: '#fff',
                    borderRadius: '50%',
                    position: 'absolute',
                    top: '2px',
                    left: useKnowledgeBase ? '20px' : '2px',
                    transition: 'left 0.2s',
                  }}
                />
              </div>
            </div>
          </label>
          <p style={{ fontSize: '10px', color: '#888', marginTop: '6px' }}>
            {useKnowledgeBase ? 'Using glossary, playbooks & docs' : 'Knowledge base disabled'}
          </p>
        </div>

        {/* AI Enhancement Toggle */}
        <div className="ai-enhancement-toggle" style={{ padding: '12px', borderBottom: '1px solid #1a1a1a' }}>
          <label style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', cursor: 'pointer' }}>
            <span style={{ fontSize: '13px', color: '#fff' }}>🤖 AI Enhancement</span>
            <div style={{ position: 'relative' }}>
              <input
                type="checkbox"
                checked={useAIEnhancement}
                onChange={(e) => setUseAIEnhancement(e.target.checked)}
                style={{ display: 'none' }}
              />
              <div
                onClick={() => setUseAIEnhancement(!useAIEnhancement)}
                style={{
                  width: '40px',
                  height: '22px',
                  background: useAIEnhancement ? '#e63946' : '#333',
                  borderRadius: '11px',
                  position: 'relative',
                  transition: 'background 0.2s',
                  cursor: 'pointer',
                }}
              >
                <div
                  style={{
                    width: '18px',
                    height: '18px',
                    background: '#fff',
                    borderRadius: '50%',
                    position: 'absolute',
                    top: '2px',
                    left: useAIEnhancement ? '20px' : '2px',
                    transition: 'left 0.2s',
                  }}
                />
              </div>
            </div>
          </label>
          <p style={{ fontSize: '10px', color: '#888', marginTop: '6px' }}>
            {useAIEnhancement ? '✨ Claude insights + Apps Script' : '⚡ Fast mode (no AI insights)'}
          </p>
        </div>

        {/* Compact Agent Selector Pills */}
        <div className="agent-pills-container" style={{ padding: '12px', borderBottom: '1px solid #1a1a1a' }}>
          <p className="section-label">CS Specialist Agents</p>
          <div className="agent-pills" style={{
            display: 'flex',
            flexWrap: 'wrap',
            gap: '6px',
            marginTop: '8px',
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
                    gap: '4px',
                    padding: '6px 10px',
                    background: isActive ? '#e63946' : '#1a1a1a',
                    border: `1px solid ${isActive ? '#e63946' : '#333'}`,
                    borderRadius: '16px',
                    color: isActive ? '#fff' : '#999',
                    fontSize: '12px',
                    fontWeight: isActive ? 600 : 400,
                    cursor: 'pointer',
                    transition: 'all 0.2s',
                  }}
                >
                  <span>{agent.icon}</span>
                  <span>{agentKey.charAt(0).toUpperCase() + agentKey.slice(1)}</span>
                </button>
              );
            })}
          </div>
          {activeAgent && (
            <p style={{ fontSize: '10px', color: '#888', marginTop: '6px' }}>
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
            <p className="customer-details" style={{ marginTop: '4px', fontSize: '11px' }}>
              {contractData.entitlements?.length || 0} entitlements • {contractData.stakeholders?.length || 0} stakeholders
            </p>
          )}
        </div>

        {/* Plan Progress */}
        {plan && (
          <div className="customer-context" style={{ marginTop: '8px', borderTop: '1px solid #1a1a1a', paddingTop: '12px' }}>
            <p className="section-label">Onboarding Plan</p>
            <p className="customer-details">
              {plan.timeline_days} days • {plan.phases?.length || 3} phases
            </p>
            <div style={{ marginTop: '8px', background: '#1a1a1a', borderRadius: '4px', height: '4px', overflow: 'hidden' }}>
              <div style={{
                width: planProgress.total > 0 ? `${(planProgress.completed / planProgress.total) * 100}%` : '0%',
                height: '100%',
                background: '#e63946',
                transition: 'width 0.3s'
              }} />
            </div>
            <p className="customer-details" style={{ marginTop: '4px', fontSize: '10px' }}>
              {planProgress.completed}/{planProgress.total} milestones
            </p>
          </div>
        )}


        {/* Google Connection */}
        <div style={{ padding: '12px', borderTop: '1px solid #1a1a1a' }}>
          <GoogleConnectionWidget
            userId={DEMO_USER_ID}
            compact={false}
            onStatusChange={setGoogleConnected}
          />
        </div>
      </div>

      {/* Main Chat Area */}
      <div className="agent-main">
        <header className="agent-header">
          <div>
            <h1>{CS_AGENTS[activeAgent]?.name || 'AI Agent'}</h1>
            <p>LangChain RAG-powered • {customer?.name || 'Ready'}</p>
          </div>
          <div className="agent-status" style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
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

        <div className="messages-container" ref={messagesContainerRef}>
          {/* Onboarding Flow */}
          {showOnboardingFlow && (
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
          )}

          {/* Interactive Action Components */}
          {!showOnboardingFlow && activeInteractiveAction === 'meeting' && (
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
          )}
          {!showOnboardingFlow && activeInteractiveAction === 'email' && (
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
          )}
          {!showOnboardingFlow && activeInteractiveAction === 'document' && (
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
          )}

          {/* Regular chat messages when no interactive action is active */}
          {!showOnboardingFlow && !activeInteractiveAction && messages.length === 0 && !activeWorkflow ? (
            <div className="empty-state">
              <div className="empty-icon">{CS_AGENTS[activeAgent]?.icon || '🤖'}</div>
              <h2>{CS_AGENTS[activeAgent]?.name || 'AI Agent'} Ready</h2>
              <p>LangChain-powered with RAG knowledge base. Auto-routing intelligently selects the best specialist for each conversation.</p>
              <QuickActions onAction={handleQuickAction} disabled={isProcessing} activeAgent={activeAgent} />
            </div>
          ) : !showOnboardingFlow && !activeInteractiveAction && (
            <>
              {messages.map((msg, i) => (
                <Message
                  key={i}
                  message={msg.message}
                  agent={msg.agent}
                  isUser={msg.isUser}
                  isThinking={msg.isThinking}
                  isApproval={msg.isApproval && pendingApproval !== null}
                  onApprove={handleApproval}
                  toolResults={msg.toolResults}
                />
              ))}
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

          {/* Agent Analysis Panel - Always visible when toggled */}
          {showAnalysisPanel && !showOnboardingFlow && (
            <div style={{ padding: '8px 0' }}>
              <AgentAnalysisActions
                agentType={activeAgent}
                customerId={customer?.id}
                customerName={customer?.name}
              />
            </div>
          )}

          {messages.length > 0 && !showOnboardingFlow && !activeInteractiveAction && !activeWorkflow && (
            <div className="quick-actions-row">
              <QuickActions onAction={handleQuickAction} disabled={isProcessing || pendingApproval !== null} activeAgent={activeAgent} />
            </div>
          )}
          <div className="input-row">
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSend()}
              placeholder={showOnboardingFlow ? 'Complete onboarding flow above...' : activeWorkflow ? 'Workflow in progress...' : `Message the ${CS_AGENTS[activeAgent]?.name || 'AI Agent'}...`}
              disabled={isProcessing || pendingApproval !== null || activeWorkflow !== null || showOnboardingFlow}
            />
            <button
              onClick={handleSend}
              disabled={isProcessing || !input.trim() || pendingApproval !== null || activeWorkflow !== null || showOnboardingFlow}
            >
              {isProcessing ? '...' : 'Send'}
            </button>
          </div>
          <p className="input-hint">
            {agenticModeEnabled ? '⚡ Agentic Mode' : 'LangChain RAG'} · {selectedAgent === 'auto' ? 'Auto-routing' : `${CS_AGENTS[selectedAgent]?.name}`} · {agenticModeEnabled ? 'Autonomous execution' : 'HITL approval'}
          </p>
        </div>
      </div>

      {/* Workspace Data Panel - Expandable Right Sidebar */}
      <WorkspaceDataPanel
        data={workspaceData}
        isCollapsed={!workspacePanelOpen}
        onToggle={() => setWorkspacePanelOpen(!workspacePanelOpen)}
      />

      {/* Email Preview Modal - shown when Claude drafts an email for approval */}
      {pendingEmailData && (
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
      )}
    </div>
  );
};

export default AgentControlCenter;
