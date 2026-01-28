import { Router, Request, Response } from 'express';
import { OnboardingAgent } from '../agents/onboarding.js';
import { SupabaseService } from '../services/supabase.js';
import { AgentMessage, CustomerContext, AgentId } from '../agents/base.js';
import { agentOrchestrator } from '../langchain/agents/orchestrator.js';
import { agentTracer } from '../services/agentTracer.js';
import { SpecialistType } from '../langchain/agents/specialists/index.js';
import { sessionService, Session, SessionMessage } from '../services/session.js';
import { calendarService } from '../services/google/calendar.js';
import { gmailService } from '../services/google/gmail.js';
import { approvalService } from '../services/approval.js';
import { skillExecutor, getAvailableSkills, SKILLS, SkillContext } from '../agents/skills/index.js';

const router = Router();
const onboardingAgent = new OnboardingAgent();
const db = new SupabaseService();

// Legacy in-memory session storage for backward compatibility
// New sessions use sessionService with Supabase persistence
const legacySessions = new Map<string, {
  customerId: string;
  context: CustomerContext;
  messages: AgentMessage[];
  pendingActions: Map<string, PendingAction>;
}>();

// Pending action type for HITL
interface PendingAction {
  id: string;
  sessionId: string;
  agentId: AgentId;
  actionType: string;
  description: string;
  actionData: Record<string, unknown>;
  createdAt: Date;
  status: 'pending' | 'approved' | 'rejected';
}

// Execute an approved action via Google services
async function executeApprovedAction(
  action: PendingAction,
  userId: string
): Promise<{ success: boolean; result?: any; error?: string }> {
  const { actionType, actionData } = action;

  console.log(`🚀 Executing approved action: ${actionType}`, actionData);

  try {
    switch (actionType) {
      case 'schedule_meeting':
      case 'book_meeting': {
        const data = actionData as {
          title: string;
          description?: string;
          attendees?: string[];
          startTime: string;
          endTime?: string;
          durationMinutes?: number;
          createMeetLink?: boolean;
        };

        // Calculate end time if not provided
        const startTime = new Date(data.startTime);
        const duration = data.durationMinutes || 30;
        const endTime = data.endTime
          ? new Date(data.endTime)
          : new Date(startTime.getTime() + duration * 60000);

        const event = await calendarService.createEvent(userId, {
          title: data.title,
          description: data.description,
          startTime,
          endTime,
          attendees: data.attendees || [],
          createMeetLink: data.createMeetLink ?? true,
          sendNotifications: true
        });

        return {
          success: true,
          result: {
            eventId: event.id,
            meetLink: event.meetLink,
            message: `Meeting "${data.title}" scheduled successfully`
          }
        };
      }

      case 'send_email': {
        const data = actionData as {
          to: string[];
          cc?: string[];
          subject: string;
          body: string;
          bodyHtml?: string;
        };

        const messageId = await gmailService.sendEmail(userId, {
          to: data.to,
          cc: data.cc,
          subject: data.subject,
          bodyHtml: data.bodyHtml || data.body,
          bodyText: data.body
        });

        return {
          success: true,
          result: {
            messageId,
            message: `Email sent to ${data.to.join(', ')}`
          }
        };
      }

      case 'draft_email':
      case 'create_draft': {
        const data = actionData as {
          to: string[];
          cc?: string[];
          subject: string;
          body: string;
          bodyHtml?: string;
        };

        const draftId = await gmailService.createDraft(userId, {
          to: data.to,
          cc: data.cc,
          subject: data.subject,
          bodyHtml: data.bodyHtml || data.body,
          bodyText: data.body
        });

        return {
          success: true,
          result: {
            draftId,
            message: `Draft created for ${data.to.join(', ')}`
          }
        };
      }

      case 'create_task': {
        // Tasks are stored locally for now (no Google Tasks integration)
        return {
          success: true,
          result: {
            message: 'Task created successfully'
          }
        };
      }

      default:
        console.log(`⚠️ Unknown action type: ${actionType} - storing as approved but not executing`);
        return {
          success: true,
          result: { message: `Action ${actionType} approved (no execution handler)` }
        };
    }
  } catch (error) {
    console.error(`❌ Failed to execute action ${actionType}:`, error);
    return {
      success: false,
      error: (error as Error).message
    };
  }
}

// ============================================
// SSE Streaming Types
// ============================================

/**
 * Types for SSE streaming events
 */
export interface StreamEvent {
  type: 'token' | 'tool_start' | 'tool_end' | 'thinking' | 'done' | 'error';
  content?: string;
  name?: string;
  params?: Record<string, unknown>;
  result?: Record<string, unknown>;
  duration?: number;
  error?: string;
}

/**
 * Helper to send SSE event
 */
function sendSSEEvent(res: Response, event: StreamEvent): void {
  res.write(`data: ${JSON.stringify(event)}\n\n`);
}

// POST /api/agents/chat/stream - Stream chat response via SSE
router.post('/chat/stream', async (req: Request, res: Response) => {
  // Set SSE headers
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no'); // Disable nginx buffering
  res.flushHeaders();

  // Track if client disconnected
  let clientDisconnected = false;

  // Handle client disconnect
  req.on('close', () => {
    clientDisconnected = true;
    console.log('SSE client disconnected');
  });

  req.on('aborted', () => {
    clientDisconnected = true;
    console.log('SSE client aborted');
  });

  try {
    const { sessionId, message, customerId, context } = req.body;

    // Handle session initialization
    if (message === '[SESSION_INIT]') {
      let session = legacySessions.get(sessionId);
      if (!session) {
        const customerContext: CustomerContext = context || {
          name: 'Customer',
          arr: 0,
          stage: 'onboarding'
        };

        session = {
          customerId: customerId || 'unknown',
          context: customerContext,
          messages: [],
          pendingActions: new Map()
        };
        legacySessions.set(sessionId, session);
      } else if (context) {
        session.context = { ...session.context, ...context };
      }

      sendSSEEvent(res, {
        type: 'done',
        content: 'Session initialized'
      });
      res.end();
      return;
    }

    if (!message) {
      sendSSEEvent(res, {
        type: 'error',
        error: 'Message is required'
      });
      res.end();
      return;
    }

    // Get or create session
    let session = legacySessions.get(sessionId);
    if (!session) {
      const customerContext: CustomerContext = context || {
        name: 'Customer',
        arr: 0,
        stage: 'onboarding'
      };

      session = {
        customerId: customerId || 'unknown',
        context: customerContext,
        messages: [],
        pendingActions: new Map()
      };
      legacySessions.set(sessionId, session);
    } else if (context) {
      session.context = { ...session.context, ...context };
    }

    // Add user message to history
    const userMessage: AgentMessage = {
      sessionId,
      role: 'user',
      content: message,
      timestamp: new Date()
    };
    session.messages.push(userMessage);

    console.log(`[Stream] Processing message for ${session.context.name}: "${message.substring(0, 50)}..."`);

    // Check for client disconnect before processing
    if (clientDisconnected) {
      console.log('[Stream] Client disconnected before processing');
      return;
    }

    // Generate unique message ID
    const messageId = `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    // Create abort controller for stream cancellation
    const abortController = new AbortController();

    // Link client disconnect to abort signal
    const handleDisconnect = () => {
      clientDisconnected = true;
      abortController.abort();
    };
    req.once('close', handleDisconnect);
    req.once('aborted', handleDisconnect);

    // Track token usage for analytics
    let tokenUsage = {
      inputTokens: 0,
      outputTokens: 0,
      totalTokens: 0
    };

    // Execute agent with real streaming - tokens streamed as they arrive from LLM
    const result = await onboardingAgent.executeStream(
      {
        sessionId,
        message,
        context: session.context,
        history: session.messages
      },
      // Callback for each chunk - forward to SSE
      (chunk: string) => {
        if (!clientDisconnected) {
          sendSSEEvent(res, {
            type: 'token',
            content: chunk
          });
        }
      },
      abortController.signal
    );

    // Capture token usage from streaming result
    if (result.tokenUsage) {
      tokenUsage = {
        inputTokens: result.tokenUsage.inputTokens,
        outputTokens: result.tokenUsage.outputTokens,
        totalTokens: result.tokenUsage.totalTokens
      };
      console.log(`[Stream] Token usage - input: ${tokenUsage.inputTokens}, output: ${tokenUsage.outputTokens}, total: ${tokenUsage.totalTokens}`);
    }

    // Check for client disconnect after processing
    if (clientDisconnected) {
      console.log('[Stream] Client disconnected during streaming');
      return;
    }

    // Add agent response to history
    const agentMessage: AgentMessage = {
      id: messageId,
      sessionId,
      agentId: 'onboarding',
      role: 'agent',
      content: result.message,
      requiresApproval: result.requiresApproval,
      deployedAgent: result.deployAgent,
      timestamp: new Date()
    };
    session.messages.push(agentMessage);

    // Handle pending actions if approval needed
    if (result.requiresApproval) {
      const actionId = `action_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      const pendingAction: PendingAction = {
        id: actionId,
        sessionId,
        agentId: 'onboarding',
        actionType: result.deployAgent ? `deploy_${result.deployAgent}` : 'general_action',
        description: extractActionDescription(result.message),
        actionData: result.data || {},
        createdAt: new Date(),
        status: 'pending'
      };
      session.pendingActions.set(actionId, pendingAction);

      try {
        await db.createApproval({
          session_id: sessionId,
          action_type: pendingAction.actionType,
          action_data: pendingAction.actionData,
          status: 'pending'
        });
      } catch (e) {
        console.log('Approval saved to memory (no DB configured)');
      }
    }

    // Send done event with metadata including token usage
    sendSSEEvent(res, {
      type: 'done',
      content: JSON.stringify({
        id: messageId,
        sessionId,
        agentId: 'onboarding',
        requiresApproval: result.requiresApproval || false,
        deployedAgent: result.deployAgent || null,
        tokenUsage
      })
    });

    res.end();

  } catch (error) {
    console.error('Agent stream error:', error);

    if (!clientDisconnected) {
      sendSSEEvent(res, {
        type: 'error',
        error: error instanceof Error ? error.message : 'Failed to process message'
      });
      res.end();
    }
  }
});

// POST /api/agents/chat - Send message to agent
router.post('/chat', async (req: Request, res: Response) => {
  try {
    const { sessionId, message, customerId, context } = req.body;

    // Handle session initialization (skip processing for init messages)
    if (message === '[SESSION_INIT]') {
      let session = legacySessions.get(sessionId);
      if (!session) {
        const customerContext: CustomerContext = context || {
          name: 'Customer',
          arr: 0,
          stage: 'onboarding'
        };

        session = {
          customerId: customerId || 'unknown',
          context: customerContext,
          messages: [],
          pendingActions: new Map()
        };
        legacySessions.set(sessionId, session);
      } else {
        // Update context if provided
        if (context) {
          session.context = { ...session.context, ...context };
        }
      }

      return res.json({
        id: `init_${Date.now()}`,
        sessionId,
        status: 'initialized',
        message: 'Session initialized with context'
      });
    }

    if (!message) {
      return res.status(400).json({
        error: { code: 'VALIDATION_ERROR', message: 'Message is required' }
      });
    }

    // Get or create session
    let session = legacySessions.get(sessionId);
    if (!session) {
      const customerContext: CustomerContext = context || {
        name: 'Customer',
        arr: 0,
        stage: 'onboarding'
      };

      session = {
        customerId: customerId || 'unknown',
        context: customerContext,
        messages: [],
        pendingActions: new Map()
      };
      legacySessions.set(sessionId, session);
    } else if (context) {
      // Update context with new data
      session.context = { ...session.context, ...context };
    }

    // Add user message
    const userMessage: AgentMessage = {
      sessionId,
      role: 'user',
      content: message,
      timestamp: new Date()
    };
    session.messages.push(userMessage);

    console.log(`Processing message for ${session.context.name}: "${message.substring(0, 50)}..."`);

    // Execute agent
    const result = await onboardingAgent.execute({
      sessionId,
      message,
      context: session.context,
      history: session.messages
    });

    // Generate unique message ID
    const messageId = `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    // Add agent response to history
    const agentMessage: AgentMessage = {
      id: messageId,
      sessionId,
      agentId: 'onboarding',
      role: 'agent',
      content: result.message,
      requiresApproval: result.requiresApproval,
      deployedAgent: result.deployAgent,
      timestamp: new Date()
    };
    session.messages.push(agentMessage);

    // If approval is needed, create a pending action
    if (result.requiresApproval) {
      const actionId = `action_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      const pendingAction: PendingAction = {
        id: actionId,
        sessionId,
        agentId: 'onboarding',
        actionType: result.deployAgent ? `deploy_${result.deployAgent}` : 'general_action',
        description: extractActionDescription(result.message),
        actionData: result.data || {},
        createdAt: new Date(),
        status: 'pending'
      };
      session.pendingActions.set(actionId, pendingAction);

      // Save to database if available
      try {
        await db.createApproval({
          session_id: sessionId,
          action_type: pendingAction.actionType,
          action_data: pendingAction.actionData,
          status: 'pending'
        });
      } catch (e) {
        console.log('Approval saved to memory (no DB configured)');
      }
    }

    res.json({
      id: messageId,
      sessionId,
      agentId: 'onboarding',
      message: result.message,
      metadata: {
        thinking: result.thinking || false,
        requiresApproval: result.requiresApproval || false,
        deployedAgent: result.deployAgent || null
      },
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Agent chat error:', error);
    res.status(500).json({
      error: {
        code: 'INTERNAL_ERROR',
        message: error instanceof Error ? error.message : 'Failed to process message'
      }
    });
  }
});

// POST /api/agents/deploy/:agentId - Deploy a specific subagent
router.post('/deploy/:agentId', async (req: Request, res: Response) => {
  try {
    const { agentId } = req.params;
    const { sessionId, message, context } = req.body;

    if (!['meeting', 'training', 'intelligence'].includes(agentId)) {
      return res.status(400).json({
        error: { code: 'VALIDATION_ERROR', message: 'Invalid agent ID' }
      });
    }

    const session = legacySessions.get(sessionId);
    if (!session) {
      return res.status(404).json({
        error: { code: 'NOT_FOUND', message: 'Session not found' }
      });
    }

    console.log(`Deploying ${agentId} agent for ${session.context.name}`);

    const result = await onboardingAgent.executeWithSubagent(
      {
        sessionId,
        message: message || 'Execute task',
        context: context || session.context,
        history: session.messages
      },
      agentId as AgentId
    );

    const agentMessage: AgentMessage = {
      sessionId,
      agentId: agentId as AgentId,
      role: 'agent',
      content: result.message,
      requiresApproval: result.requiresApproval,
      timestamp: new Date()
    };
    session.messages.push(agentMessage);

    res.json({
      id: `msg_${Date.now()}`,
      agentId,
      message: result.message,
      data: result.data,
      metadata: {
        requiresApproval: result.requiresApproval || false
      },
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Agent deploy error:', error);
    res.status(500).json({
      error: { code: 'INTERNAL_ERROR', message: 'Failed to deploy agent' }
    });
  }
});

// GET /api/agents/sessions/:sessionId - Get session messages
router.get('/sessions/:sessionId', async (req: Request, res: Response) => {
  try {
    const { sessionId } = req.params;
    const session = legacySessions.get(sessionId);

    if (!session) {
      return res.status(404).json({
        error: { code: 'NOT_FOUND', message: 'Session not found' }
      });
    }

    res.json({
      sessionId,
      customerId: session.customerId,
      customerName: session.context.name,
      messages: session.messages,
      pendingActions: Array.from(session.pendingActions.values()).filter(a => a.status === 'pending'),
      status: 'active'
    });
  } catch (error) {
    console.error('Get session error:', error);
    res.status(500).json({
      error: { code: 'INTERNAL_ERROR', message: 'Failed to get session' }
    });
  }
});

// POST /api/agents/sessions - Create new session
router.post('/sessions', async (req: Request, res: Response) => {
  try {
    const { customerId, context } = req.body;
    const sessionId = `session_${Date.now()}`;

    const customerContext: CustomerContext = context || {
      name: 'New Customer',
      arr: 0,
      stage: 'onboarding'
    };

    legacySessions.set(sessionId, {
      customerId: customerId || 'unknown',
      context: customerContext,
      messages: [],
      pendingActions: new Map()
    });

    res.json({
      sessionId,
      customerId,
      customerName: customerContext.name,
      status: 'active',
      createdAt: new Date().toISOString()
    });
  } catch (error) {
    console.error('Create session error:', error);
    res.status(500).json({
      error: { code: 'INTERNAL_ERROR', message: 'Failed to create session' }
    });
  }
});

// POST /api/agents/approve/:approvalId - Approve/reject action
router.post('/approve/:approvalId', async (req: Request, res: Response) => {
  try {
    const { approvalId } = req.params;
    const { approved, comment, sessionId, userId, updatedData } = req.body;
    // Use userId from body, auth header, or default for demo mode
    const DEMO_USER_ID = 'df2dc7be-ece0-40b2-a9d7-0f6c45b75131';
    const effectiveUserId = userId || (req as any).user?.id || DEMO_USER_ID;

    console.log(`Processing approval ${approvalId}: ${approved ? 'APPROVED' : 'REJECTED'}${updatedData ? ' (with edited data)' : ''}`);

    // Find the session with this pending action
    let foundSession: typeof legacySessions extends Map<string, infer V> ? V : never | null = null;
    let foundAction: PendingAction | null = null;

    // If sessionId provided, look directly
    if (sessionId) {
      const session = legacySessions.get(sessionId);
      if (session) {
        foundSession = session;
        foundAction = session.pendingActions.get(approvalId) || null;
      }
    } else {
      // Search all sessions
      for (const [, session] of legacySessions) {
        const action = session.pendingActions.get(approvalId);
        if (action) {
          foundSession = session;
          foundAction = action;
          break;
        }
      }
    }

    // Track execution result
    let executionResult: { success: boolean; result?: any; error?: string } | null = null;

    // Handle legacy session-based approvals
    if (foundAction) {
      foundAction.status = approved ? 'approved' : 'rejected';

      // Add system message about the approval
      if (foundSession) {
        const systemMessage: AgentMessage = {
          sessionId: foundAction.sessionId,
          role: 'system',
          content: approved
            ? `Action approved: ${foundAction.description}`
            : `Action rejected: ${foundAction.description}${comment ? ` - Reason: ${comment}` : ''}`,
          timestamp: new Date()
        };
        foundSession.messages.push(systemMessage);
      }

      // Update in database if available
      try {
        await db.updateApproval(approvalId, {
          status: approved ? 'approved' : 'rejected',
          comment,
          approved_at: new Date().toISOString()
        });
      } catch (e) {
        console.log('Approval updated in memory (no DB configured)');
      }

      // Execute the action if approved
      if (approved) {
        executionResult = await executeApprovedAction(foundAction, effectiveUserId);

        // Update system message with execution result
        if (foundSession && executionResult) {
          const executionMessage: AgentMessage = {
            sessionId: foundAction.sessionId,
            role: 'system',
            content: executionResult.success
              ? `✅ Action executed: ${executionResult.result?.message || 'Success'}`
              : `❌ Action failed: ${executionResult.error || 'Unknown error'}`,
            timestamp: new Date()
          };
          foundSession.messages.push(executionMessage);
        }
      }
    } else {
      // Try approvalService for LangChain-created approvals (Supabase)
      try {
        const approval = await approvalService.getApproval(approvalId);
        if (approval) {
          console.log(`Found approval in approvalService: ${approvalId}`);

          // If updatedData was provided (e.g., edited email), merge it with action_data
          if (updatedData && approved) {
            // Update the action_data in the database before approval
            await approvalService.updateActionData(approvalId, updatedData);
            console.log(`Updated action data with user edits:`, updatedData);
          }

          const result = await approvalService.reviewApproval(approvalId, {
            status: approved ? 'approved' : 'rejected',
            reviewerNotes: comment
          });
          // approvalService.reviewApproval handles execution internally
          executionResult = {
            success: true,
            result: { message: `Action ${result.actionType} ${result.status}` }
          };
        } else {
          console.log(`Approval ${approvalId} not found in any system`);
        }
      } catch (e) {
        console.log('ApprovalService lookup failed:', (e as Error).message);
        executionResult = {
          success: false,
          error: (e as Error).message
        };
      }
    }

    res.json({
      id: approvalId,
      status: approved ? 'approved' : 'rejected',
      comment,
      resolvedAt: new Date().toISOString(),
      execution: executionResult
    });
  } catch (error) {
    console.error('Approval error:', error);
    res.status(500).json({
      error: { code: 'INTERNAL_ERROR', message: 'Failed to process approval' }
    });
  }
});

// GET /api/agents/pending - Get pending approvals
router.get('/pending', async (req: Request, res: Response) => {
  try {
    const { sessionId } = req.query;

    // Get from memory first
    const pendingActions: PendingAction[] = [];

    if (sessionId && typeof sessionId === 'string') {
      const session = legacySessions.get(sessionId);
      if (session) {
        session.pendingActions.forEach(action => {
          if (action.status === 'pending') {
            pendingActions.push(action);
          }
        });
      }
    } else {
      // Get all pending from all sessions
      legacySessions.forEach(session => {
        session.pendingActions.forEach(action => {
          if (action.status === 'pending') {
            pendingActions.push(action);
          }
        });
      });
    }

    // Also try database
    let dbApprovals: Array<Record<string, unknown>> = [];
    try {
      dbApprovals = await db.getPendingApprovals(sessionId as string | undefined);
    } catch (e) {
      // DB not configured, use memory only
    }

    res.json({
      approvals: pendingActions.length > 0 ? pendingActions : dbApprovals,
      count: pendingActions.length || dbApprovals.length
    });
  } catch (error) {
    console.error('Get pending error:', error);
    res.status(500).json({
      error: { code: 'INTERNAL_ERROR', message: 'Failed to get pending approvals' }
    });
  }
});

// GET /api/agents/actions - Get pending actions (alias for /pending)
router.get('/actions', async (req: Request, res: Response) => {
  try {
    const pendingActions: PendingAction[] = [];

    legacySessions.forEach(session => {
      session.pendingActions.forEach(action => {
        if (action.status === 'pending') {
          pendingActions.push(action);
        }
      });
    });

    res.json({
      actions: pendingActions,
      count: pendingActions.length
    });
  } catch (error) {
    console.error('Get actions error:', error);
    res.status(500).json({
      error: { code: 'INTERNAL_ERROR', message: 'Failed to get actions' }
    });
  }
});

// Helper function to extract action description from agent message
function extractActionDescription(message: string): string {
  // Look for common patterns that indicate the proposed action
  const patterns = [
    /shall i (.*?)\?/i,
    /would you like me to (.*?)\?/i,
    /can i proceed with (.*?)\?/i,
    /ready to (.*?)\?/i,
    /should i (.*?)\?/i
  ];

  for (const pattern of patterns) {
    const match = message.match(pattern);
    if (match && match[1]) {
      return match[1].trim();
    }
  }

  // Default: first 100 characters of the message
  return message.substring(0, 100).trim() + (message.length > 100 ? '...' : '');
}

// ============================================
// ORCHESTRATOR & OBSERVABILITY ENDPOINTS
// ============================================

// Specialist validation
const VALID_SPECIALISTS = [
  'onboarding', 'adoption', 'renewal', 'risk', 'strategic',
  'email', 'meeting', 'knowledge', 'research', 'analytics'
];

/**
 * POST /api/agents/orchestrator/chat
 * Send message to the multi-agent orchestrator
 */
router.post('/orchestrator/chat', async (req: Request, res: Response) => {
  try {
    const { message, customerContext, contractContext, sessionId, specialist } = req.body;
    const userId = req.headers['x-user-id'] as string;

    if (!userId) {
      return res.status(401).json({ error: 'User ID required' });
    }

    if (!message) {
      return res.status(400).json({ error: 'Message required' });
    }

    const context = {
      userId,
      sessionId,
      customerContext,
      contractContext
    };

    let result;

    if (specialist && VALID_SPECIALISTS.includes(specialist)) {
      result = await agentOrchestrator.chatWithSpecialist(
        message,
        specialist as SpecialistType,
        context
      );
    } else {
      result = await agentOrchestrator.chat(message, context);
    }

    return res.json({
      success: true,
      response: result.response,
      specialistUsed: result.specialistUsed,
      requiresApproval: result.requiresApproval,
      pendingActions: result.pendingActions,
      toolsUsed: result.toolsUsed,
      trace: result.trace
    });

  } catch (error) {
    console.error('Orchestrator chat error:', error);
    return res.status(500).json({
      error: 'Agent processing failed',
      message: (error as Error).message
    });
  }
});

/**
 * POST /api/agents/orchestrator/reset
 * Reset orchestrator conversation state
 */
router.post('/orchestrator/reset', async (req: Request, res: Response) => {
  try {
    agentOrchestrator.reset();
    return res.json({ success: true, message: 'Conversation reset' });
  } catch (error) {
    return res.status(500).json({ error: 'Reset failed' });
  }
});

/**
 * GET /api/agents/orchestrator/state
 * Get current orchestrator state
 */
router.get('/orchestrator/state', async (req: Request, res: Response) => {
  try {
    const state = agentOrchestrator.getState();
    return res.json(state);
  } catch (error) {
    return res.status(500).json({ error: 'Failed to get state' });
  }
});

/**
 * GET /api/agents/specialists
 * Get list of available specialist agents
 */
router.get('/specialists', async (req: Request, res: Response) => {
  try {
    const state = agentOrchestrator.getState();
    return res.json({
      specialists: state.availableSpecialists,
      current: state.currentSpecialist
    });
  } catch (error) {
    return res.status(500).json({ error: 'Failed to get specialists' });
  }
});

// ============================================
// OBSERVABILITY ENDPOINTS
// ============================================

/**
 * GET /api/agents/traces
 * Get recent agent traces for current user
 */
router.get('/traces', async (req: Request, res: Response) => {
  try {
    const userId = req.headers['x-user-id'] as string;
    const limit = parseInt(req.query.limit as string) || 20;

    if (!userId) {
      return res.status(401).json({ error: 'User ID required' });
    }

    const runs = await agentTracer.getUserRuns(userId, limit);

    return res.json({
      traces: runs.map(run => ({
        id: run.id,
        agentId: run.agentId,
        agentName: run.agentName,
        agentType: run.agentType,
        status: run.status,
        startTime: run.startTime,
        endTime: run.endTime,
        duration: run.endTime
          ? run.endTime.getTime() - run.startTime.getTime()
          : null,
        stepCount: run.steps.length,
        tokens: run.totalTokens,
        input: run.input.substring(0, 100),
        hasChildren: (run.childRuns?.length || 0) > 0
      }))
    });

  } catch (error) {
    return res.status(500).json({ error: 'Failed to get traces' });
  }
});

/**
 * GET /api/agents/traces/:runId
 * Get detailed trace for a specific run
 */
router.get('/traces/:runId', async (req: Request, res: Response) => {
  try {
    const { runId } = req.params;
    const includeTree = req.query.tree === 'true';

    const run = includeTree
      ? await agentTracer.getRunTree(runId)
      : await agentTracer.getRun(runId);

    if (!run) {
      return res.status(404).json({ error: 'Trace not found' });
    }

    return res.json({ trace: run });

  } catch (error) {
    return res.status(500).json({ error: 'Failed to get trace' });
  }
});

/**
 * GET /api/agents/traces/:runId/visualization
 * Get visualization data for a trace (nodes and edges for flow graph)
 */
router.get('/traces/:runId/visualization', async (req: Request, res: Response) => {
  try {
    const { runId } = req.params;

    const visualization = await agentTracer.getTraceVisualization(runId);

    if (!visualization) {
      return res.status(404).json({ error: 'Trace not found' });
    }

    return res.json(visualization);

  } catch (error) {
    return res.status(500).json({ error: 'Failed to get visualization' });
  }
});

/**
 * GET /api/agents/active
 * Get currently active agent runs
 */
router.get('/active', async (req: Request, res: Response) => {
  try {
    const activeRuns = agentTracer.getActiveRuns();

    return res.json({
      active: activeRuns.map(run => ({
        id: run.id,
        agentName: run.agentName,
        agentType: run.agentType,
        status: run.status,
        startTime: run.startTime,
        currentStep: run.steps[run.steps.length - 1],
        stepCount: run.steps.length
      }))
    });

  } catch (error) {
    return res.status(500).json({ error: 'Failed to get active runs' });
  }
});

/**
 * GET /api/agents/stats
 * Get agent statistics
 */
router.get('/stats', async (req: Request, res: Response) => {
  try {
    const stats = await agentTracer.getStats();
    return res.json(stats);
  } catch (error) {
    return res.status(500).json({ error: 'Failed to get stats' });
  }
});

// ============================================
// Contract Agent Bridge Routes
// ============================================

import {
  triggerAgentFromContract,
  getRecommendedActions,
  createOnboardingSummary
} from '../services/contractAgentBridge.js';

/**
 * POST /api/agents/contract/trigger
 * Trigger agent execution from parsed contract data
 */
router.post('/contract/trigger', async (req: Request, res: Response) => {
  try {
    const userId = req.headers['x-user-id'] as string;
    if (!userId) {
      return res.status(401).json({ error: 'User ID required' });
    }

    const { contractData, onboardingPlan, autoExecute = true } = req.body;

    if (!contractData || !contractData.company_name) {
      return res.status(400).json({ error: 'Contract data with company_name is required' });
    }

    const result = await triggerAgentFromContract({
      userId,
      sessionId: `contract-${Date.now()}`,
      contractData,
      onboardingPlan,
      autoExecute
    });

    return res.json({
      success: result.success,
      agentUsed: result.agentUsed,
      response: result.response,
      actions: result.actions,
      trace: result.trace
    });

  } catch (error) {
    console.error('Contract trigger error:', error);
    return res.status(500).json({ error: 'Failed to trigger agent from contract' });
  }
});

/**
 * POST /api/agents/contract/recommend
 * Get recommended actions for a parsed contract
 */
router.post('/contract/recommend', async (req: Request, res: Response) => {
  try {
    const { contractData, onboardingPlan } = req.body;

    if (!contractData) {
      return res.status(400).json({ error: 'Contract data is required' });
    }

    const recommendations = getRecommendedActions(contractData, onboardingPlan);

    return res.json({
      recommendations,
      summary: createOnboardingSummary(contractData, onboardingPlan)
    });

  } catch (error) {
    console.error('Recommendation error:', error);
    return res.status(500).json({ error: 'Failed to get recommendations' });
  }
});

/**
 * POST /api/agents/contract/summary
 * Generate onboarding summary from contract
 */
router.post('/contract/summary', async (req: Request, res: Response) => {
  try {
    const { contractData, onboardingPlan } = req.body;

    if (!contractData) {
      return res.status(400).json({ error: 'Contract data is required' });
    }

    const summary = createOnboardingSummary(contractData, onboardingPlan);

    return res.json({ summary });

  } catch (error) {
    console.error('Summary error:', error);
    return res.status(500).json({ error: 'Failed to generate summary' });
  }
});

// ============================================
// SESSION PERSISTENCE ENDPOINTS
// Uses SessionService for Supabase-backed persistence
// ============================================

/**
 * GET /api/agents/session/stats
 * Get session statistics
 * NOTE: Must be defined BEFORE /session/:sessionId to avoid route conflict
 */
router.get('/session/stats', async (req: Request, res: Response) => {
  try {
    const stats = await sessionService.getStats();

    return res.json({
      success: true,
      stats,
      supabaseConfigured: sessionService.isConfigured()
    });

  } catch (error) {
    console.error('Get stats error:', error);
    return res.status(500).json({ error: 'Failed to get stats' });
  }
});

/**
 * POST /api/agents/session/cleanup
 * Expire old sessions (admin endpoint)
 * NOTE: Must be defined BEFORE /session/:sessionId to avoid route conflict
 */
router.post('/session/cleanup', async (req: Request, res: Response) => {
  try {
    const expiredCount = await sessionService.expireOldSessions();

    return res.json({
      success: true,
      expiredCount
    });

  } catch (error) {
    console.error('Cleanup error:', error);
    return res.status(500).json({ error: 'Failed to cleanup sessions' });
  }
});

/**
 * POST /api/agents/session/create
 * Create a new persisted session
 */
router.post('/session/create', async (req: Request, res: Response) => {
  try {
    const userId = req.headers['x-user-id'] as string;
    const { customerId, customerContext, contractContext, metadata } = req.body;

    const session = await sessionService.createSession({
      customerId,
      userId,
      context: {
        customerContext,
        contractContext
      },
      metadata
    });

    return res.json({
      success: true,
      sessionId: session.id,
      session: {
        id: session.id,
        customerId: session.customerId,
        userId: session.userId,
        status: session.status,
        createdAt: session.createdAt
      }
    });

  } catch (error) {
    console.error('Create session error:', error);
    return res.status(500).json({
      error: 'Failed to create session',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * GET /api/agents/session/:sessionId
 * Get a persisted session with messages
 */
router.get('/session/:sessionId', async (req: Request, res: Response) => {
  try {
    const { sessionId } = req.params;

    const session = await sessionService.getSession(sessionId);
    if (!session) {
      return res.status(404).json({ error: 'Session not found' });
    }

    const messages = await sessionService.getMessages(sessionId);
    const pendingActions = await sessionService.getPendingActions(sessionId);

    return res.json({
      session: {
        id: session.id,
        customerId: session.customerId,
        userId: session.userId,
        status: session.status,
        context: session.context,
        metadata: session.metadata,
        createdAt: session.createdAt,
        updatedAt: session.updatedAt
      },
      messages,
      pendingActions,
      messageCount: messages.length
    });

  } catch (error) {
    console.error('Get session error:', error);
    return res.status(500).json({ error: 'Failed to get session' });
  }
});

/**
 * POST /api/agents/session/:sessionId/message
 * Add a message to a persisted session
 */
router.post('/session/:sessionId/message', async (req: Request, res: Response) => {
  try {
    const { sessionId } = req.params;
    const { role, content, agentId, metadata } = req.body;

    if (!content) {
      return res.status(400).json({ error: 'Content is required' });
    }

    const message = await sessionService.addMessage({
      sessionId,
      role: role || 'user',
      content,
      agentId,
      metadata
    });

    return res.json({
      success: true,
      message
    });

  } catch (error) {
    console.error('Add message error:', error);
    return res.status(500).json({ error: 'Failed to add message' });
  }
});

/**
 * PATCH /api/agents/session/:sessionId/context
 * Update session context
 */
router.patch('/session/:sessionId/context', async (req: Request, res: Response) => {
  try {
    const { sessionId } = req.params;
    const { context } = req.body;

    await sessionService.updateSessionContext(sessionId, context);

    return res.json({ success: true });

  } catch (error) {
    console.error('Update context error:', error);
    return res.status(500).json({ error: 'Failed to update context' });
  }
});

/**
 * GET /api/agents/session/:sessionId/history
 * Get conversation history formatted for LLM
 */
router.get('/session/:sessionId/history', async (req: Request, res: Response) => {
  try {
    const { sessionId } = req.params;
    const limit = parseInt(req.query.limit as string) || 20;

    const history = await sessionService.getConversationHistory(sessionId, limit);

    return res.json({
      sessionId,
      history,
      count: history.length
    });

  } catch (error) {
    console.error('Get history error:', error);
    return res.status(500).json({ error: 'Failed to get history' });
  }
});

/**
 * GET /api/agents/user/:userId/sessions
 * Get user's active sessions
 */
router.get('/user/:userId/sessions', async (req: Request, res: Response) => {
  try {
    const { userId } = req.params;
    const limit = parseInt(req.query.limit as string) || 10;

    const sessions = await sessionService.getUserSessions(userId, limit);

    return res.json({
      userId,
      sessions,
      count: sessions.length
    });

  } catch (error) {
    console.error('Get user sessions error:', error);
    return res.status(500).json({ error: 'Failed to get user sessions' });
  }
});

/**
 * GET /api/agents/customer/:customerId/sessions
 * Get customer's sessions
 */
router.get('/customer/:customerId/sessions', async (req: Request, res: Response) => {
  try {
    const { customerId } = req.params;
    const limit = parseInt(req.query.limit as string) || 10;

    const sessions = await sessionService.getCustomerSessions(customerId, limit);

    return res.json({
      customerId,
      sessions,
      count: sessions.length
    });

  } catch (error) {
    console.error('Get customer sessions error:', error);
    return res.status(500).json({ error: 'Failed to get customer sessions' });
  }
});

/**
 * POST /api/agents/session/:sessionId/close
 * Mark session as completed
 */
router.post('/session/:sessionId/close', async (req: Request, res: Response) => {
  try {
    const { sessionId } = req.params;

    await sessionService.updateSessionStatus(sessionId, 'completed');

    return res.json({
      success: true,
      sessionId,
      status: 'completed'
    });

  } catch (error) {
    console.error('Close session error:', error);
    return res.status(500).json({ error: 'Failed to close session' });
  }
});

// ============================================
// Skills Routes
// ============================================

/**
 * GET /api/agents/skills
 * List available skills
 */
router.get('/skills', async (req: Request, res: Response) => {
  try {
    const skills = getAvailableSkills();
    return res.json({ skills });
  } catch (error) {
    console.error('Get skills error:', error);
    return res.status(500).json({ error: 'Failed to get skills' });
  }
});

/**
 * POST /api/agents/skills/:skillId/execute
 * Execute a skill with context
 */
router.post('/skills/:skillId/execute', async (req: Request, res: Response) => {
  try {
    const { skillId } = req.params;
    const { userId, customer, stakeholders, contract, customData } = req.body;

    // Validate skill exists
    const skill = SKILLS[skillId];
    if (!skill) {
      return res.status(404).json({ error: `Skill not found: ${skillId}` });
    }

    // Build context
    const DEMO_USER_ID = 'df2dc7be-ece0-40b2-a9d7-0f6c45b75131';
    const context: SkillContext = {
      userId: userId || (req as any).user?.id || DEMO_USER_ID,
      customer,
      stakeholders,
      contract,
      customData
    };

    // Validate required context
    const validation = skillExecutor.validateContext(skill, context);
    if (!validation.valid) {
      return res.status(400).json({
        error: 'Missing required context',
        missing: validation.missing
      });
    }

    // Execute skill
    const result = await skillExecutor.execute(skill, context);

    return res.json(result);

  } catch (error) {
    console.error('Execute skill error:', error);
    return res.status(500).json({ error: 'Failed to execute skill' });
  }
});

/**
 * POST /api/agents/skills/match
 * Find a matching skill for user input
 */
router.post('/skills/match', async (req: Request, res: Response) => {
  try {
    const { userInput } = req.body;

    if (!userInput) {
      return res.status(400).json({ error: 'userInput is required' });
    }

    const matchedSkill = skillExecutor.findMatchingSkill(userInput);

    return res.json({
      matched: !!matchedSkill,
      skill: matchedSkill ? {
        id: matchedSkill.id,
        name: matchedSkill.name,
        description: matchedSkill.description,
        requiredContext: matchedSkill.requiredContext
      } : null
    });

  } catch (error) {
    console.error('Match skill error:', error);
    return res.status(500).json({ error: 'Failed to match skill' });
  }
});

export { router as agentRoutes };
