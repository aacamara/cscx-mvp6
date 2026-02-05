/**
 * LangChain Agent Routes
 * API endpoints for the AI-powered CS agents
 */

import { Router, Request, Response } from 'express';
import {
  orchestrator,
  vectorStore,
  agents,
  AgentType,
  CustomerContext,
  emailAgent,
  EmailType,
  EmailDraftRequest,
  workflowAgent
} from '../langchain/index.js';
import { knowledgeService } from '../services/knowledge.js';
import { calendarService } from '../services/google/calendar.js';
import { gmailService } from '../services/google/gmail.js';
import { driveService } from '../services/google/drive.js';
import { approvalService, ActionType } from '../services/approval.js';
import { sessionService } from '../services/session.js';
import { ChatGoogleGenerativeAI } from '@langchain/google-genai';
import { config } from '../config/index.js';
import { cadgService } from '../services/cadg/index.js';

const router = Router();

/**
 * Clean placeholder patterns from AI responses
 * These can appear when the model incorrectly outputs template markers
 */
function cleanResponse(text: string): string {
  console.log('🧹 [ROUTE] cleanResponse called, text length:', text?.length || 0);
  console.log('🧹 [ROUTE] Response preview:', text?.substring(0, 500));

  if (!text || typeof text !== 'string') {
    console.log('🧹 [ROUTE] Early return - text is empty or not string');
    return text;
  }

  // Check if there are placeholders before cleaning
  const hasPlaceholders = /PLACEHOLDER/i.test(text);
  if (hasPlaceholders) {
    console.log('🧹 [ROUTE] Found PLACEHOLDER in response, cleaning...');
    console.log('🧹 [ROUTE] First 300 chars:', text.substring(0, 300));
  }

  const cleaned = text
    .replace(/_*PLACEHOLDER\d+_*/gi, '')
    .replace(/\*\*_*PLACEHOLDER\d+_*\*\*/gi, '')
    .replace(/([⚡✅📄🔗📊📈📉🎯💼🔧📚🏢])\s*_*PLACEHOLDER\d+_*/gi, '$1')
    .replace(/\bPLACEHOLDER\d*\b_*/gi, '')
    .replace(/##\s*([⚡✅📄🔗📊📈📉🎯💼🔧📚🏢])\s*$/gm, '## $1')
    .replace(/^\d+\.\s*$/gm, '')
    .replace(/^[-•]\s*$/gm, '')
    .replace(/\s{2,}/g, ' ')
    .replace(/\n\s*\n\s*\n/g, '\n\n')
    .trim();

  if (hasPlaceholders) {
    const stillHas = /PLACEHOLDER/i.test(cleaned);
    console.log('🧹 [ROUTE] After cleaning, still has PLACEHOLDER:', stillHas);
    if (stillHas) {
      // Find what's left
      const matches = cleaned.match(/[_]*PLACEHOLDER[_\d]*/gi);
      console.log('🧹 [ROUTE] Remaining patterns:', matches);
    }
  }

  return cleaned;
}

// Check if Claude is available
const USE_CLAUDE_WORKFLOW = !!config.anthropicApiKey;

// LLM for generating action details (fallback when Claude unavailable)
const actionLLM = new ChatGoogleGenerativeAI({
  apiKey: config.geminiApiKey,
  model: "gemini-2.0-flash",
  temperature: 0.3
});

/**
 * Helper to detect action requests and create approval items
 */
async function handleActionRequest(
  message: string,
  userId: string,
  customerContext?: any
): Promise<{ handled: boolean; approval?: any; response?: string }> {
  const msgLower = message.toLowerCase();

  // Detect meeting scheduling requests
  if ((msgLower.includes('schedule') || msgLower.includes('set up') || msgLower.includes('book')) &&
      (msgLower.includes('meeting') || msgLower.includes('call'))) {

    try {
      // Use LLM to extract meeting details
      const extractionPrompt = `Extract meeting details from this request. Return ONLY valid JSON, no markdown.

User request: "${message}"
Customer context: ${customerContext?.name || 'Unknown customer'}

Return JSON format:
{
  "title": "meeting title",
  "description": "meeting description/agenda",
  "attendees": ["email@example.com"],
  "durationMinutes": 30,
  "suggestedTimeframe": "tomorrow afternoon" or "next week"
}

If attendee emails aren't specified, leave attendees as empty array.`;

      const result = await actionLLM.invoke(extractionPrompt);
      let meetingDetails;

      try {
        const content = typeof result.content === 'string' ? result.content : JSON.stringify(result.content);
        // Clean up the response - remove markdown code blocks if present
        const cleanContent = content.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
        meetingDetails = JSON.parse(cleanContent);
      } catch {
        meetingDetails = {
          title: `Meeting with ${customerContext?.name || 'Customer'}`,
          description: message,
          attendees: [],
          durationMinutes: 30,
          suggestedTimeframe: 'this week'
        };
      }

      // Create a suggested time (tomorrow at 10am)
      const startTime = new Date();
      startTime.setDate(startTime.getDate() + 1);
      startTime.setHours(10, 0, 0, 0);

      const endTime = new Date(startTime);
      endTime.setMinutes(endTime.getMinutes() + (meetingDetails.durationMinutes || 30));

      // Create approval request
      const approval = await approvalService.createApproval({
        userId,
        actionType: 'schedule_meeting',
        actionData: {
          title: meetingDetails.title,
          description: meetingDetails.description,
          attendees: meetingDetails.attendees,
          startTime: startTime.toISOString(),
          endTime: endTime.toISOString(),
          createMeetLink: true
        },
        originalContent: `Schedule: ${meetingDetails.title}\nTime: ${startTime.toLocaleString()}\nDuration: ${meetingDetails.durationMinutes} minutes\nAttendees: ${meetingDetails.attendees.join(', ') || 'TBD'}`
      });

      const response = `📅 **Meeting Ready for Approval**

I've prepared a meeting request:

**${meetingDetails.title}**
- **When:** ${startTime.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })} at ${startTime.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}
- **Duration:** ${meetingDetails.durationMinutes} minutes
- **Attendees:** ${meetingDetails.attendees.length > 0 ? meetingDetails.attendees.join(', ') : 'No attendees specified yet'}
${meetingDetails.description ? `- **Agenda:** ${meetingDetails.description}` : ''}

⚡ **Action Required:** Check your pending approvals to confirm or modify this meeting.`;

      return { handled: true, approval, response };
    } catch (error) {
      console.error('Meeting scheduling error:', error);
      return {
        handled: true,
        response: `I tried to create a meeting request but encountered an error: ${(error as Error).message}. Please try again.`
      };
    }
  }

  // Detect email drafting requests
  if ((msgLower.includes('draft') || msgLower.includes('write') || msgLower.includes('send') || msgLower.includes('compose')) &&
      msgLower.includes('email')) {

    try {
      // Use LLM to generate email draft
      const extractionPrompt = `Generate a professional email based on this request. Return ONLY valid JSON, no markdown.

User request: "${message}"
Customer: ${customerContext?.name || 'Unknown'}
Context: ${customerContext?.status || 'active'} customer, health score: ${customerContext?.healthScore || 'unknown'}

Return JSON format:
{
  "to": ["email@example.com"],
  "subject": "email subject",
  "bodyHtml": "<p>Full email body in HTML</p>",
  "bodyText": "Plain text version"
}

If recipient email isn't specified, leave "to" as empty array.`;

      const result = await actionLLM.invoke(extractionPrompt);
      let emailDetails;

      try {
        const content = typeof result.content === 'string' ? result.content : JSON.stringify(result.content);
        const cleanContent = content.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
        emailDetails = JSON.parse(cleanContent);
      } catch {
        emailDetails = {
          to: [],
          subject: `Follow-up with ${customerContext?.name || 'Customer'}`,
          bodyHtml: `<p>Hi,</p><p>${message}</p><p>Best regards</p>`,
          bodyText: `Hi,\n\n${message}\n\nBest regards`
        };
      }

      // Create approval request
      const approval = await approvalService.createApproval({
        userId,
        actionType: 'send_email',
        actionData: emailDetails,
        originalContent: `To: ${emailDetails.to.join(', ') || 'TBD'}\nSubject: ${emailDetails.subject}\n\n${emailDetails.bodyText}`
      });

      const response = `📧 **Email Draft Ready for Approval**

I've drafted an email for you:

**To:** ${emailDetails.to.length > 0 ? emailDetails.to.join(', ') : 'Recipient not specified'}
**Subject:** ${emailDetails.subject}

---
${emailDetails.bodyText}
---

⚡ **Action Required:** Check your pending approvals to send, modify, or discard this email.`;

      return { handled: true, approval, response };
    } catch (error) {
      console.error('Email drafting error:', error);
      return {
        handled: true,
        response: `I tried to draft an email but encountered an error: ${(error as Error).message}. Please try again.`
      };
    }
  }

  // Detect task creation requests
  if ((msgLower.includes('create') || msgLower.includes('add') || msgLower.includes('set')) &&
      (msgLower.includes('task') || msgLower.includes('reminder') || msgLower.includes('todo'))) {

    try {
      const extractionPrompt = `Extract task details from this request. Return ONLY valid JSON, no markdown.

User request: "${message}"
Customer: ${customerContext?.name || 'Unknown'}

Return JSON format:
{
  "title": "task title",
  "notes": "task description",
  "dueDate": "YYYY-MM-DD",
  "priority": "low" | "medium" | "high",
  "taskType": "follow_up" | "review" | "action" | "other"
}`;

      const result = await actionLLM.invoke(extractionPrompt);
      let taskDetails;

      try {
        const content = typeof result.content === 'string' ? result.content : JSON.stringify(result.content);
        const cleanContent = content.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
        taskDetails = JSON.parse(cleanContent);
      } catch {
        const tomorrow = new Date();
        tomorrow.setDate(tomorrow.getDate() + 1);
        taskDetails = {
          title: message.substring(0, 100),
          notes: message,
          dueDate: tomorrow.toISOString().split('T')[0],
          priority: 'medium',
          taskType: 'other'
        };
      }

      // Create approval request
      const approval = await approvalService.createApproval({
        userId,
        actionType: 'create_task',
        actionData: {
          ...taskDetails,
          customerId: customerContext?.id
        },
        originalContent: `Task: ${taskDetails.title}\nDue: ${taskDetails.dueDate}\nPriority: ${taskDetails.priority}`
      });

      const response = `✅ **Task Ready for Approval**

I've prepared a task:

**${taskDetails.title}**
- **Due:** ${taskDetails.dueDate}
- **Priority:** ${taskDetails.priority}
${taskDetails.notes ? `- **Notes:** ${taskDetails.notes}` : ''}

⚡ **Action Required:** Check your pending approvals to confirm this task.`;

      return { handled: true, approval, response };
    } catch (error) {
      console.error('Task creation error:', error);
      return {
        handled: true,
        response: `I tried to create a task but encountered an error: ${(error as Error).message}. Please try again.`
      };
    }
  }

  return { handled: false };
}

/**
 * Helper to detect Google Workspace queries and fetch data directly
 */
async function handleGoogleQuery(message: string, userId: string): Promise<{ handled: boolean; data?: any; type?: string }> {
  const msgLower = message.toLowerCase();

  // Calendar - Today's meetings
  if (msgLower.includes('meeting') && (msgLower.includes('today') || msgLower.includes('schedule today'))) {
    try {
      const events = await calendarService.getTodayEvents(userId);
      return { handled: true, data: events, type: 'calendar_today' };
    } catch (error) {
      console.error('Calendar fetch error:', error);
      return { handled: true, data: { error: (error as Error).message }, type: 'calendar_error' };
    }
  }

  // Calendar - Upcoming meetings
  if (msgLower.includes('meeting') && (msgLower.includes('upcoming') || msgLower.includes('this week') || msgLower.includes('next'))) {
    try {
      const events = await calendarService.getUpcomingEvents(userId, 7);
      return { handled: true, data: events, type: 'calendar_upcoming' };
    } catch (error) {
      console.error('Calendar fetch error:', error);
      return { handled: true, data: { error: (error as Error).message }, type: 'calendar_error' };
    }
  }

  // Gmail - Recent emails
  if (msgLower.includes('email') && (msgLower.includes('recent') || msgLower.includes('inbox') || msgLower.includes('latest') || msgLower.includes('my email'))) {
    try {
      const result = await gmailService.listThreads(userId, { maxResults: 10 });
      return { handled: true, data: result.threads, type: 'email_recent' };
    } catch (error) {
      console.error('Gmail fetch error:', error);
      return { handled: true, data: { error: (error as Error).message }, type: 'email_error' };
    }
  }

  // Drive - Search
  if (msgLower.includes('drive') || (msgLower.includes('search') && msgLower.includes('file')) || msgLower.includes('document')) {
    // Extract search query - everything after "search for" or "find"
    const searchMatch = message.match(/(?:search for|find|look for|search)\s+(.+)/i);
    const query = searchMatch ? searchMatch[1] : 'recent';
    try {
      const result = await driveService.searchFiles(userId, query, { maxResults: 10 });
      return { handled: true, data: result.files, type: 'drive_search' };
    } catch (error) {
      console.error('Drive fetch error:', error);
      return { handled: true, data: { error: (error as Error).message }, type: 'drive_error' };
    }
  }

  return { handled: false };
}

/**
 * Format Google data into a readable response
 */
function formatGoogleResponse(type: string, data: any): string {
  if (data?.error) {
    return `I couldn't access your ${type.split('_')[0]} data: ${data.error}. Please make sure you've connected your Google account and granted the necessary permissions.`;
  }

  switch (type) {
    case 'calendar_today': {
      if (!data || data.length === 0) {
        return "You have no meetings scheduled for today. Your calendar is clear!";
      }
      const meetingList = data.map((event: any) => {
        const start = new Date(event.startTime).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
        const attendees = event.attendees?.slice(0, 3).map((a: any) => a.email || a).join(', ') || 'No attendees';
        return `• **${event.title}** at ${start}\n  Attendees: ${attendees}${event.meetLink ? `\n  Join: ${event.meetLink}` : ''}`;
      }).join('\n\n');
      return `📅 **Today's Meetings** (${data.length})\n\n${meetingList}`;
    }

    case 'calendar_upcoming': {
      if (!data || data.length === 0) {
        return "You have no upcoming meetings in the next 7 days.";
      }
      const meetingList = data.map((event: any) => {
        const date = new Date(event.startTime).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
        const time = new Date(event.startTime).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
        return `• **${event.title}** - ${date} at ${time}`;
      }).join('\n');
      return `📅 **Upcoming Meetings** (${data.length})\n\n${meetingList}`;
    }

    case 'email_recent': {
      if (!data || data.length === 0) {
        return "No recent emails found in your inbox.";
      }
      const emailList = data.slice(0, 5).map((thread: any) => {
        const participants = thread.participants?.slice(0, 2).join(', ') || 'Unknown';
        const unread = thread.isUnread ? '🔵 ' : '';
        return `${unread}• **${thread.subject}**\n  From: ${participants}\n  "${thread.snippet?.substring(0, 100)}..."`;
      }).join('\n\n');
      return `📧 **Recent Emails** (${data.length} threads)\n\n${emailList}`;
    }

    case 'drive_search': {
      if (!data || data.length === 0) {
        return "No files found matching your search.";
      }
      const fileList = data.slice(0, 10).map((file: any) => {
        const modified = file.modifiedTime ? new Date(file.modifiedTime).toLocaleDateString() : '';
        return `• **${file.name}** ${modified}\n  [Open](${file.webViewLink})`;
      }).join('\n\n');
      return `📁 **Files Found** (${data.length})\n\n${fileList}`;
    }

    default:
      return "I retrieved the data but couldn't format it properly.";
  }
}

/**
 * POST /api/ai/chat
 * Chat with the AI orchestrator - automatically routes to the right agent
 *
 * Uses Claude WorkflowAgent (LangGraph) when available, falls back to Gemini
 * Sessions are persisted to Supabase for conversation continuity
 */
router.post('/chat', async (req: Request, res: Response) => {
  try {
    const { message, customerId, customerContext, forceAgent, activeAgent, sessionId, useWorkflow, model, useKnowledgeBase } = req.body;
    const userId = req.headers['x-user-id'] as string;

    // Model selection: 'claude' uses WorkflowAgent (LangGraph), 'gemini' uses fallback handlers
    const useClaudeModel = model === 'claude' || (model === undefined && USE_CLAUDE_WORKFLOW);

    // Knowledge base toggle - defaults to true if not specified
    const enableKnowledgeBase = useKnowledgeBase !== false;

    if (!message) {
      return res.status(400).json({
        error: { code: 'VALIDATION_ERROR', message: 'Message is required' }
      });
    }

    // Build customer context with userId for Google API access
    const context: CustomerContext = {
      ...(customerContext || {
        id: customerId || 'unknown',
        name: 'Unknown Customer',
        arr: 0,
        healthScore: 70,
        status: 'active'
      }),
      userId, // Add userId for Google Workspace access
      useKnowledgeBase: enableKnowledgeBase // Pass knowledge base toggle
    };

    console.log(`🤖 AI Chat: "${message.substring(0, 50)}..." for ${context.name} (user: ${userId || 'anonymous'}, model: ${model || 'auto'}, kb: ${enableKnowledgeBase})`);

    // ============================================
    // CADG: Check if this is a generative request
    // ============================================
    if (userId) {
      try {
        const cadgClassification = await cadgService.classify(message, {
          customerId: customerId || context.id,
          userId,
          activeAgent: forceAgent || activeAgent || undefined,
        });

        console.log(`[CADG] Classification: isGenerative=${cadgClassification.isGenerative}, confidence=${cadgClassification.classification.confidence}, taskType=${cadgClassification.classification.taskType}`);

        // If this is a generative request with high confidence, create a CADG plan
        if (cadgClassification.isGenerative && cadgClassification.classification.confidence >= 0.7) {
          console.log(`[CADG] Creating execution plan for: ${cadgClassification.classification.taskType}`);

          // Use customerId only if it's a valid UUID, otherwise null (template mode)
          const validCustomerId = customerId && customerId !== 'unknown' ? customerId : null;

          const planResult = await cadgService.createPlan({
            userQuery: message,
            customerId: validCustomerId,
            userId,
            taskType: cadgClassification.classification.taskType,
          });

          if (planResult.success && planResult.plan) {
            console.log(`[CADG] Plan created successfully: ${planResult.plan.planId}`);

            // Return CADG plan for HITL approval
            return res.json({
              response: `I've analyzed your request and created an execution plan for generating a ${cadgClassification.classification.taskType.replace(/_/g, ' ')}. Please review the plan and approve it to proceed with generation.`,
              agentType: 'cadg',
              model: 'claude',
              isGenerative: true,
              taskType: cadgClassification.classification.taskType,
              confidence: cadgClassification.classification.confidence,
              requiresApproval: true,
              plan: {
                planId: planResult.plan.planId,
                taskType: planResult.plan.taskType,
                structure: planResult.plan.structure,
                inputs: planResult.plan.inputs,
                destination: planResult.plan.destination,
              },
              capability: cadgClassification.capability?.capability ? {
                id: cadgClassification.capability.capability.id,
                name: cadgClassification.capability.capability.name,
                description: cadgClassification.capability.capability.description,
              } : null,
              methodology: cadgClassification.capability?.methodology ? {
                id: cadgClassification.capability.methodology.id,
                name: cadgClassification.capability.methodology.name,
                steps: cadgClassification.capability.methodology.steps?.length || 0,
              } : null,
            });
          } else {
            console.log(`[CADG] Plan creation failed: ${planResult.error}, falling back to regular agent`);
          }
        }
      } catch (cadgError) {
        console.error('[CADG] Classification/plan error:', cadgError);
        // Fall through to regular agent
      }
    }

    // Get or create session for persistence
    const session = await sessionService.getOrCreateSession({
      sessionId,
      customerId,
      userId,
      context: { customerContext: context }
    });

    // Save user message to session
    await sessionService.addMessage({
      sessionId: session.id,
      role: 'user',
      content: message,
      metadata: { customerId, forceAgent }
    });

    // Get conversation history for context
    const conversationHistory = await sessionService.getConversationHistory(session.id, 20);

    // ============================================
    // PRIMARY: Use Claude WorkflowAgent with LangGraph
    // ============================================
    if (useClaudeModel && userId && useWorkflow !== false) {
      try {
        console.log('📊 Using Claude WorkflowAgent (LangGraph) - Model:', model || 'claude');

        const result = await workflowAgent.chat(
          message,
          userId,
          context,
          conversationHistory, // Use persisted conversation history
          forceAgent // Pass specialist type for persona-based responses
        );

        // Clean and save assistant response to session
        const cleanedResponse = cleanResponse(result.response);
        await sessionService.addMessage({
          sessionId: session.id,
          role: 'assistant',
          content: cleanedResponse,
          agentId: 'workflow_agent',
          metadata: {
            toolsUsed: result.toolsUsed,
            requiresApproval: result.requiresApproval
          }
        });

        return res.json({
          response: cleanedResponse,
          agentType: result.specialistUsed || 'workflow_agent',
          model: 'claude',
          knowledgeBase: enableKnowledgeBase,
          routing: {
            agentType: 'claude_langgraph',
            model: 'claude',
            knowledgeBase: enableKnowledgeBase,
            confidence: 1.0,
            reasoning: result.specialistUsed
              ? `Claude WorkflowAgent with ${result.specialistUsed} specialist persona`
              : 'Claude WorkflowAgent with native tool use'
          },
          toolsUsed: result.toolsUsed,
          toolResults: result.toolResults, // Include full tool results for UI display
          suggestedActions: [],
          requiresApproval: result.requiresApproval,
          pendingActions: result.pendingActions,
          specialistUsed: result.specialistUsed,
          sessionId: session.id,
          sessionState: orchestrator.getSessionState()
        });
      } catch (workflowError) {
        console.error('WorkflowAgent error, falling back to Gemini:', workflowError);
        // Fall through to Gemini-based handlers
      }
    }

    // ============================================
    // FALLBACK: Gemini-based action/query handlers
    // ============================================

    // Check if this is an action request (schedule meeting, send email, create task)
    if (userId) {
      const actionResult = await handleActionRequest(message, userId, context);
      if (actionResult.handled) {
        const cleanedActionResponse = cleanResponse(actionResult.response || '');
        // Save response to session
        await sessionService.addMessage({
          sessionId: session.id,
          role: 'assistant',
          content: cleanedActionResponse,
          agentId: 'action_handler',
          metadata: { requiresApproval: true }
        });

        return res.json({
          response: cleanedActionResponse,
          agentType: 'action_handler',
          model: 'gemini',
          routing: { agentType: 'action_handler', model: 'gemini', confidence: 1.0, reasoning: 'Action request detected (Gemini)' },
          toolsUsed: ['approval_service'],
          suggestedActions: [],
          requiresApproval: true,
          pendingApproval: actionResult.approval,
          sessionId: session.id,
          sessionState: orchestrator.getSessionState()
        });
      }
    }

    // Check if this is a Google Workspace query (calendar, email, drive)
    if (userId) {
      const googleResult = await handleGoogleQuery(message, userId);
      if (googleResult.handled) {
        const formattedResponse = cleanResponse(formatGoogleResponse(googleResult.type!, googleResult.data));

        // Save response to session
        await sessionService.addMessage({
          sessionId: session.id,
          role: 'assistant',
          content: formattedResponse,
          agentId: 'google_workspace',
          metadata: { queryType: googleResult.type }
        });

        return res.json({
          response: formattedResponse,
          agentType: 'google_workspace',
          model: 'gemini',
          routing: { agentType: 'google_workspace', model: 'gemini', confidence: 1.0, reasoning: 'Google Workspace query detected' },
          toolsUsed: [googleResult.type],
          suggestedActions: [],
          requiresApproval: false,
          sessionId: session.id,
          sessionState: orchestrator.getSessionState()
        });
      }
    }

    // Get response from orchestrator for general CS queries
    // Build SpecialistContext for the new orchestrator API
    const specialistContext = {
      userId: userId || 'anonymous',
      sessionId: session.id,
      customerContext: context
    };

    // Use chatWithSpecialist if forceAgent is specified, otherwise use chat
    const response = forceAgent
      ? await orchestrator.chatWithSpecialist(message, forceAgent as any, specialistContext)
      : await orchestrator.chat(message, specialistContext);

    // Clean the response
    const cleanedOrchestratorResponse = cleanResponse(response.response);

    // Save orchestrator response to session
    await sessionService.addMessage({
      sessionId: session.id,
      role: 'assistant',
      content: cleanedOrchestratorResponse,
      agentId: response.specialistUsed,
      metadata: {
        toolsUsed: response.toolsUsed,
        requiresApproval: response.requiresApproval
      }
    });

    res.json({
      response: cleanedOrchestratorResponse,
      agentType: response.specialistUsed,
      model: 'gemini',
      routing: { agentType: response.specialistUsed, model: 'gemini', confidence: 1.0, reasoning: `Routed to ${response.specialistUsed}` },
      toolsUsed: response.toolsUsed,
      suggestedActions: [],
      requiresApproval: response.requiresApproval,
      pendingActions: response.pendingActions,
      trace: response.trace,
      sessionId: session.id,
      sessionState: orchestrator.getSessionState()
    });
  } catch (error) {
    console.error('AI Chat error:', error);
    res.status(500).json({
      error: {
        code: 'AI_ERROR',
        message: error instanceof Error ? error.message : 'Failed to process chat'
      }
    });
  }
});

/**
 * POST /api/ai/chat/:agentType
 * Chat directly with a specific agent
 */
router.post('/chat/:agentType', async (req: Request, res: Response) => {
  try {
    const { agentType } = req.params;
    const { message, customerContext } = req.body;

    if (!message) {
      return res.status(400).json({
        error: { code: 'VALIDATION_ERROR', message: 'Message is required' }
      });
    }

    if (!agents[agentType as AgentType]) {
      return res.status(400).json({
        error: {
          code: 'INVALID_AGENT',
          message: `Invalid agent type. Available: ${Object.keys(agents).join(', ')}`
        }
      });
    }

    const context: CustomerContext = customerContext || {
      id: 'unknown',
      name: 'Unknown Customer',
      arr: 0,
      healthScore: 70,
      status: 'active'
    };

    const agent = agents[agentType as AgentType];
    const response = await agent.chat(message, context, []);

    res.json({
      response: response.content,
      agentType: response.agentType,
      toolsUsed: response.toolsUsed,
      suggestedActions: response.suggestedActions,
      requiresApproval: response.requiresApproval
    });
  } catch (error) {
    console.error('Agent chat error:', error);
    res.status(500).json({
      error: {
        code: 'AI_ERROR',
        message: error instanceof Error ? error.message : 'Failed to process chat'
      }
    });
  }
});

/**
 * POST /api/ai/analyze
 * Get comprehensive analysis from all agents
 */
router.post('/analyze', async (req: Request, res: Response) => {
  try {
    const { customerContext } = req.body;

    if (!customerContext) {
      return res.status(400).json({
        error: { code: 'VALIDATION_ERROR', message: 'Customer context is required' }
      });
    }

    console.log(`📊 Running comprehensive analysis for ${customerContext.name}`);

    const analysis = await orchestrator.getComprehensiveAnalysis(customerContext);

    res.json(analysis);
  } catch (error) {
    console.error('Analysis error:', error);
    res.status(500).json({
      error: {
        code: 'AI_ERROR',
        message: error instanceof Error ? error.message : 'Failed to analyze customer'
      }
    });
  }
});

/**
 * POST /api/ai/workflow
 * Execute a multi-step workflow
 */
router.post('/workflow', async (req: Request, res: Response) => {
  try {
    const { workflowType, customerContext } = req.body;

    const validWorkflows = ['onboarding', 'renewal_prep', 'risk_mitigation', 'qbr_prep'];
    if (!validWorkflows.includes(workflowType)) {
      return res.status(400).json({
        error: {
          code: 'INVALID_WORKFLOW',
          message: `Invalid workflow. Available: ${validWorkflows.join(', ')}`
        }
      });
    }

    if (!customerContext) {
      return res.status(400).json({
        error: { code: 'VALIDATION_ERROR', message: 'Customer context is required' }
      });
    }

    console.log(`🔄 Executing ${workflowType} workflow for ${customerContext.name}`);

    const result = await orchestrator.executeWorkflow(
      workflowType as 'onboarding' | 'renewal_prep' | 'risk_mitigation' | 'qbr_prep',
      customerContext
    );

    res.json(result);
  } catch (error) {
    console.error('Workflow error:', error);
    res.status(500).json({
      error: {
        code: 'AI_ERROR',
        message: error instanceof Error ? error.message : 'Failed to execute workflow'
      }
    });
  }
});

/**
 * POST /api/ai/session/clear
 * Clear the current session
 */
router.post('/session/clear', async (req: Request, res: Response) => {
  try {
    orchestrator.clearSession();
    res.json({
      message: 'Session cleared',
      sessionState: orchestrator.getSessionState()
    });
  } catch (error) {
    res.status(500).json({
      error: { code: 'ERROR', message: 'Failed to clear session' }
    });
  }
});

/**
 * GET /api/ai/session
 * Get current session state
 */
router.get('/session', async (req: Request, res: Response) => {
  res.json(orchestrator.getSessionState());
});

/**
 * GET /api/ai/agents
 * List available agents
 */
router.get('/agents', async (req: Request, res: Response) => {
  res.json({
    agents: Object.keys(agents).map(key => ({
      id: key,
      name: key.charAt(0).toUpperCase() + key.slice(1) + ' Agent',
      description: getAgentDescription(key as AgentType)
    }))
  });
});

function getAgentDescription(agentType: AgentType): string {
  const descriptions: Record<AgentType, string> = {
    onboarding: 'Handles new customer onboarding, kickoffs, and 30-60-90 day plans',
    adoption: 'Drives product usage, feature adoption, and user engagement',
    renewal: 'Manages renewals, expansion opportunities, and commercial negotiations',
    risk: 'Identifies at-risk customers and creates save plays',
    strategic: 'Handles executive relationships, QBRs, and strategic planning'
  };
  return descriptions[agentType];
}

// ============================================
// Email Agent Routes
// ============================================

/**
 * POST /api/ai/email/draft
 * Draft a personalized email based on customer context
 */
router.post('/email/draft', async (req: Request, res: Response) => {
  try {
    const {
      emailType,
      recipientEmail,
      recipientName,
      customerContext,
      additionalContext,
      tone,
      threadId,
      userId
    } = req.body;

    // Validate required fields
    if (!emailType) {
      return res.status(400).json({
        error: { code: 'VALIDATION_ERROR', message: 'emailType is required' }
      });
    }
    if (!recipientEmail) {
      return res.status(400).json({
        error: { code: 'VALIDATION_ERROR', message: 'recipientEmail is required' }
      });
    }
    if (!customerContext) {
      return res.status(400).json({
        error: { code: 'VALIDATION_ERROR', message: 'customerContext is required' }
      });
    }
    if (!userId) {
      return res.status(400).json({
        error: { code: 'VALIDATION_ERROR', message: 'userId is required' }
      });
    }

    const validEmailTypes: EmailType[] = [
      'check_in', 'follow_up', 'qbr_invite', 'renewal', 'onboarding',
      'escalation', 'introduction', 'thank_you', 'meeting_recap', 'custom'
    ];

    if (!validEmailTypes.includes(emailType)) {
      return res.status(400).json({
        error: {
          code: 'INVALID_EMAIL_TYPE',
          message: `Invalid email type. Available: ${validEmailTypes.join(', ')}`
        }
      });
    }

    console.log(`📧 Drafting ${emailType} email to ${recipientEmail} for ${customerContext.name}`);

    const request: EmailDraftRequest = {
      emailType,
      recipientEmail,
      recipientName,
      customerContext,
      additionalContext,
      tone: tone || 'professional',
      threadId,
      userId
    };

    const emailDraft = await emailAgent.draftEmail(request);

    res.json({
      draft: emailDraft,
      message: 'Email drafted successfully. Review and approve before sending.'
    });
  } catch (error) {
    console.error('Email draft error:', error);
    res.status(500).json({
      error: {
        code: 'AI_ERROR',
        message: error instanceof Error ? error.message : 'Failed to draft email'
      }
    });
  }
});

/**
 * POST /api/ai/email/refine
 * Refine an existing email draft based on feedback
 */
router.post('/email/refine', async (req: Request, res: Response) => {
  try {
    const { feedback, currentDraft, customerContext } = req.body;

    if (!feedback) {
      return res.status(400).json({
        error: { code: 'VALIDATION_ERROR', message: 'feedback is required' }
      });
    }
    if (!currentDraft) {
      return res.status(400).json({
        error: { code: 'VALIDATION_ERROR', message: 'currentDraft is required' }
      });
    }
    if (!customerContext) {
      return res.status(400).json({
        error: { code: 'VALIDATION_ERROR', message: 'customerContext is required' }
      });
    }

    console.log(`✏️ Refining email draft based on feedback: "${feedback.substring(0, 50)}..."`);

    const refinedDraft = await emailAgent.refineEmail(feedback, currentDraft, customerContext);

    res.json({
      draft: refinedDraft,
      message: 'Email refined successfully.'
    });
  } catch (error) {
    console.error('Email refine error:', error);
    res.status(500).json({
      error: {
        code: 'AI_ERROR',
        message: error instanceof Error ? error.message : 'Failed to refine email'
      }
    });
  }
});

/**
 * POST /api/ai/email/suggest
 * Get AI-suggested email actions based on customer context
 */
router.post('/email/suggest', async (req: Request, res: Response) => {
  try {
    const { customerContext } = req.body;

    if (!customerContext) {
      return res.status(400).json({
        error: { code: 'VALIDATION_ERROR', message: 'customerContext is required' }
      });
    }

    console.log(`💡 Getting email suggestions for ${customerContext.name}`);

    const suggestions = await emailAgent.suggestEmailActions(customerContext);

    res.json({
      suggestions,
      total: suggestions.length
    });
  } catch (error) {
    console.error('Email suggest error:', error);
    res.status(500).json({
      error: {
        code: 'AI_ERROR',
        message: error instanceof Error ? error.message : 'Failed to get suggestions'
      }
    });
  }
});

/**
 * POST /api/ai/email/create-draft
 * Create a Gmail draft from an email response (requires Gmail auth)
 */
router.post('/email/create-draft', async (req: Request, res: Response) => {
  try {
    const { userId, emailDraft, threadId } = req.body;

    if (!userId) {
      return res.status(400).json({
        error: { code: 'VALIDATION_ERROR', message: 'userId is required' }
      });
    }
    if (!emailDraft) {
      return res.status(400).json({
        error: { code: 'VALIDATION_ERROR', message: 'emailDraft is required' }
      });
    }

    console.log(`📝 Creating Gmail draft for user ${userId}`);

    const draftId = await emailAgent.createDraft(userId, emailDraft, threadId);

    res.json({
      draftId,
      message: 'Gmail draft created successfully. Check your drafts folder.'
    });
  } catch (error) {
    console.error('Create draft error:', error);
    res.status(500).json({
      error: {
        code: 'GMAIL_ERROR',
        message: error instanceof Error ? error.message : 'Failed to create Gmail draft'
      }
    });
  }
});

/**
 * POST /api/ai/email/clear-history
 * Clear the email agent's conversation history
 */
router.post('/email/clear-history', async (req: Request, res: Response) => {
  try {
    emailAgent.clearHistory();
    res.json({ message: 'Email agent history cleared' });
  } catch (error) {
    res.status(500).json({
      error: { code: 'ERROR', message: 'Failed to clear history' }
    });
  }
});

/**
 * GET /api/ai/email/types
 * List available email types
 */
router.get('/email/types', async (req: Request, res: Response) => {
  res.json({
    emailTypes: [
      { id: 'check_in', name: 'Check-in', description: 'Regular touchpoint to gauge satisfaction' },
      { id: 'follow_up', name: 'Follow-up', description: 'After meeting or previous conversation' },
      { id: 'qbr_invite', name: 'QBR Invitation', description: 'Quarterly Business Review invitation' },
      { id: 'renewal', name: 'Renewal', description: 'Renewal conversation starter' },
      { id: 'onboarding', name: 'Onboarding', description: 'Welcome and next steps for new customers' },
      { id: 'escalation', name: 'Escalation', description: 'Addressing concerns or issues' },
      { id: 'introduction', name: 'Introduction', description: 'First contact with new stakeholder' },
      { id: 'thank_you', name: 'Thank You', description: 'Post-meeting or milestone achievement' },
      { id: 'meeting_recap', name: 'Meeting Recap', description: 'Summary with action items' },
      { id: 'custom', name: 'Custom', description: 'Custom email with specific instructions' }
    ],
    tones: ['formal', 'friendly', 'professional', 'urgent']
  });
});

// ============================================
// Knowledge Base Routes (Enhanced)
// ============================================

/**
 * POST /api/ai/knowledge/add-document
 * Add a document to the pgvector knowledge base
 */
router.post('/knowledge/add-document', async (req: Request, res: Response) => {
  try {
    const { title, content, layer, category, sourceType, userId, customerId, metadata } = req.body;

    if (!title || !content || !layer || !category) {
      return res.status(400).json({
        error: {
          code: 'VALIDATION_ERROR',
          message: 'title, content, layer, and category are required'
        }
      });
    }

    const validLayers = ['universal', 'company', 'customer'];
    if (!validLayers.includes(layer)) {
      return res.status(400).json({
        error: {
          code: 'INVALID_LAYER',
          message: `Invalid layer. Available: ${validLayers.join(', ')}`
        }
      });
    }

    console.log(`📚 Adding document "${title}" to ${layer} knowledge base`);

    const document = await knowledgeService.addDocument({
      title,
      content,
      layer,
      category,
      sourceType: sourceType || 'upload',
      userId,
      customerId,
      metadata
    });

    res.json({
      document: {
        id: document.id,
        title: document.title,
        layer: document.layer,
        category: document.category,
        status: document.status,
        wordCount: document.wordCount
      },
      message: 'Document added. Processing and indexing in background.'
    });
  } catch (error) {
    console.error('Add document error:', error);
    res.status(500).json({
      error: {
        code: 'ERROR',
        message: error instanceof Error ? error.message : 'Failed to add document'
      }
    });
  }
});

/**
 * POST /api/ai/knowledge/search-pgvector
 * Search the pgvector knowledge base
 */
router.post('/knowledge/search-pgvector', async (req: Request, res: Response) => {
  try {
    const { query, layer, userId, customerId, category, limit, threshold } = req.body;

    if (!query) {
      return res.status(400).json({
        error: { code: 'VALIDATION_ERROR', message: 'query is required' }
      });
    }

    console.log(`🔍 Searching knowledge base: "${query.substring(0, 50)}..."`);

    const results = await knowledgeService.search(query, {
      layer,
      userId,
      customerId,
      category,
      limit: limit || 5,
      threshold: threshold || 0.7
    });

    res.json({
      results: results.map(r => ({
        id: r.id,
        documentId: r.documentId,
        content: r.content,
        similarity: r.similarity,
        documentTitle: r.documentTitle,
        documentLayer: r.documentLayer
      })),
      total: results.length
    });
  } catch (error) {
    console.error('Knowledge search error:', error);
    res.status(500).json({
      error: {
        code: 'ERROR',
        message: error instanceof Error ? error.message : 'Failed to search knowledge base'
      }
    });
  }
});

/**
 * GET /api/ai/knowledge/documents
 * List documents in the knowledge base
 */
router.get('/knowledge/documents', async (req: Request, res: Response) => {
  try {
    const { layer, category, status, userId, limit, offset } = req.query;

    const result = await knowledgeService.listDocuments({
      layer: layer as any,
      category: category as string,
      status: status as any,
      userId: userId as string,
      limit: limit ? parseInt(limit as string) : 50,
      offset: offset ? parseInt(offset as string) : 0
    });

    res.json({
      documents: result.documents.map(d => ({
        id: d.id,
        title: d.title,
        layer: d.layer,
        category: d.category,
        status: d.status,
        wordCount: d.wordCount,
        createdAt: d.createdAt
      })),
      total: result.total
    });
  } catch (error) {
    console.error('List documents error:', error);
    res.status(500).json({
      error: { code: 'ERROR', message: 'Failed to list documents' }
    });
  }
});

/**
 * DELETE /api/ai/knowledge/documents/:id
 * Delete a document from the knowledge base
 */
router.delete('/knowledge/documents/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const deleted = await knowledgeService.deleteDocument(id);

    if (deleted) {
      res.json({ message: 'Document deleted successfully' });
    } else {
      res.status(404).json({
        error: { code: 'NOT_FOUND', message: 'Document not found' }
      });
    }
  } catch (error) {
    console.error('Delete document error:', error);
    res.status(500).json({
      error: { code: 'ERROR', message: 'Failed to delete document' }
    });
  }
});

/**
 * POST /api/ai/knowledge/context
 * Get relevant context for a query (knowledge + customer data)
 */
router.post('/knowledge/context', async (req: Request, res: Response) => {
  try {
    const { query, customerId, userId, includePlaybooks, includeCustomerDocs, limit } = req.body;

    if (!query) {
      return res.status(400).json({
        error: { code: 'VALIDATION_ERROR', message: 'query is required' }
      });
    }

    const context = await knowledgeService.getRelevantContext(query, {
      customerId,
      userId,
      includePlaybooks: includePlaybooks !== false,
      includeCustomerDocs: includeCustomerDocs !== false,
      limit: limit || 5
    });

    res.json(context);
  } catch (error) {
    console.error('Get context error:', error);
    res.status(500).json({
      error: { code: 'ERROR', message: 'Failed to get context' }
    });
  }
});

// ============================================
// Knowledge Base Routes (Legacy In-Memory)
// ============================================

/**
 * POST /api/ai/knowledge/search
 * Search the knowledge base
 */
router.post('/knowledge/search', async (req: Request, res: Response) => {
  try {
    const { query, collection, limit = 5 } = req.body;

    if (!query) {
      return res.status(400).json({
        error: { code: 'VALIDATION_ERROR', message: 'Query is required' }
      });
    }

    const results = await vectorStore.hybridSearch(query, limit, collection);

    res.json({
      results: results.map(r => ({
        content: r.document.content,
        metadata: r.document.metadata,
        score: r.score
      })),
      total: results.length
    });
  } catch (error) {
    console.error('Knowledge search error:', error);
    res.status(500).json({
      error: { code: 'ERROR', message: 'Failed to search knowledge base' }
    });
  }
});

/**
 * POST /api/ai/knowledge/add
 * Add a document to the knowledge base
 */
router.post('/knowledge/add', async (req: Request, res: Response) => {
  try {
    const { content, metadata, collection = 'knowledge_base' } = req.body;

    if (!content) {
      return res.status(400).json({
        error: { code: 'VALIDATION_ERROR', message: 'Content is required' }
      });
    }

    const docId = await vectorStore.addDocument(content, metadata || {}, collection);

    res.json({
      message: 'Document added to knowledge base',
      documentId: docId,
      collection
    });
  } catch (error) {
    console.error('Knowledge add error:', error);
    res.status(500).json({
      error: { code: 'ERROR', message: 'Failed to add document' }
    });
  }
});

/**
 * GET /api/ai/knowledge/collections
 * List available collections
 */
router.get('/knowledge/collections', async (req: Request, res: Response) => {
  res.json({
    collections: [
      { id: 'knowledge_base', description: 'CS best practices, playbooks, and frameworks' },
      { id: 'contracts', description: 'Past customer contracts' },
      { id: 'playbooks', description: 'CS playbooks and templates' },
      { id: 'customer_notes', description: 'Customer interaction notes and history' }
    ]
  });
});

export { router as langchainRoutes };
