/**
 * Communicator Agent
 * Drafts and manages customer communications
 * Integrates with Gmail
 *
 * PRD-029: Added escalation response drafting skill
 */

import {
  Agent,
  AgentContext,
  Tool,
  ToolResult
} from '../types.js';
import { gmailService } from '../../services/google/gmail.js';
import { escalationResponseGenerator } from '../../services/escalation/responseGenerator.js';
import {
  EscalationType,
  EscalationSeverity,
} from '../../templates/emails/escalation-response.js';

// Import data access tools for communicator
import { getToolsForAgent } from '../tools/index.js';

// ============================================
// Communicator Tools
// ============================================

const draftEmail: Tool = {
  name: 'draft_email',
  description: 'Draft a personalized email to customer stakeholder',
  inputSchema: {
    type: 'object',
    properties: {
      to: {
        type: 'string',
        description: 'Recipient email address'
      },
      purpose: {
        type: 'string',
        enum: ['kickoff', 'check-in', 'milestone', 'escalation', 'renewal', 'expansion', 'follow-up'],
        description: 'Purpose of the email'
      },
      tone: {
        type: 'string',
        enum: ['formal', 'friendly', 'urgent'],
        description: 'Tone of the email'
      },
      keyPoints: {
        type: 'array',
        items: { type: 'string' },
        description: 'Key points to include in the email'
      },
      includeCalendarLink: {
        type: 'boolean',
        description: 'Whether to include a calendar booking link'
      },
      templateId: {
        type: 'string',
        description: 'Optional template ID to use'
      }
    },
    required: ['to', 'purpose', 'keyPoints']
  },
  requiresApproval: true, // ALWAYS review emails before sending
  execute: async (input: {
    to: string;
    purpose: string;
    tone?: string;
    keyPoints: string[];
    includeCalendarLink?: boolean;
    templateId?: string;
  }, context: AgentContext): Promise<ToolResult> => {
    console.log(`[Communicator] Drafting ${input.purpose} email to ${input.to}`);

    const customer = context.customer;
    const tone = input.tone || 'friendly';

    // Generate email based on purpose and context
    const templates: Record<string, { subject: string; body: string }> = {
      'kickoff': {
        subject: `Welcome to ${customer.name} Onboarding - Let's Get Started!`,
        body: `Hi,

I'm excited to be your Customer Success Manager for ${customer.name}'s journey with us.

${input.keyPoints.map(p => `- ${p}`).join('\n')}

${input.includeCalendarLink ? '\nPlease use my calendar link to schedule our kickoff call: [CALENDAR_LINK]' : ''}

Looking forward to a successful partnership!

Best regards`
      },
      'check-in': {
        subject: `Quick Check-in - ${customer.name}`,
        body: `Hi,

I wanted to touch base and see how things are going.

${input.keyPoints.map(p => `- ${p}`).join('\n')}

Let me know if you have any questions or need support.

Best regards`
      },
      'milestone': {
        subject: `Congratulations! ${customer.name} Milestone Achieved`,
        body: `Hi,

Great news! I'm pleased to share that you've reached an important milestone:

${input.keyPoints.map(p => `- ${p}`).join('\n')}

Keep up the excellent work!

Best regards`
      },
      'follow-up': {
        subject: `Following Up - ${customer.name}`,
        body: `Hi,

I'm following up on our recent conversation.

${input.keyPoints.map(p => `- ${p}`).join('\n')}

Please let me know if you have any questions.

Best regards`
      }
    };

    const template = templates[input.purpose] || templates['follow-up'];

    return {
      success: true,
      data: {
        draftId: `draft_${Date.now()}`,
        to: input.to,
        subject: template.subject,
        body: template.body,
        purpose: input.purpose,
        tone: tone,
        status: 'pending_approval',
        estimatedReadTime: '2 min'
      }
    };
  }
};

const sendEmail: Tool = {
  name: 'send_email',
  description: 'Send an approved email via Gmail',
  inputSchema: {
    type: 'object',
    properties: {
      draftId: {
        type: 'string',
        description: 'Draft ID to send'
      },
      to: {
        type: 'string',
        description: 'Recipient email (if not using draft)'
      },
      subject: {
        type: 'string',
        description: 'Email subject (if not using draft)'
      },
      body: {
        type: 'string',
        description: 'Email body (if not using draft)'
      },
      cc: {
        type: 'array',
        items: { type: 'string' },
        description: 'CC recipients'
      },
      bcc: {
        type: 'array',
        items: { type: 'string' },
        description: 'BCC recipients'
      }
    },
    required: []
  },
  requiresApproval: true, // NEVER auto-send
  execute: async (input: {
    draftId?: string;
    to?: string;
    subject?: string;
    body?: string;
    cc?: string[];
    bcc?: string[];
  }, context: AgentContext): Promise<ToolResult> => {
    console.log(`[Communicator] Sending email (draft: ${input.draftId || 'none'})`);

    try {
      const userId = context.userId;
      if (!userId) {
        throw new Error('User ID required for Gmail access');
      }

      if (!input.to || !input.subject || !input.body) {
        throw new Error('Email requires to, subject, and body');
      }

      // Send the email using Gmail API (returns message ID string)
      const messageId = await gmailService.sendEmail(userId, {
        to: [input.to],
        cc: input.cc,
        bcc: input.bcc,
        subject: input.subject,
        bodyHtml: input.body,
      });

      return {
        success: true,
        data: {
          messageId,
          to: input.to,
          subject: input.subject,
          status: 'sent',
          sentAt: new Date().toISOString()
        }
      };
    } catch (error) {
      console.error('[Communicator] Error sending email:', error);
      return {
        success: false,
        error: `Failed to send email: ${(error as Error).message}`
      };
    }
  }
};

const createSequence: Tool = {
  name: 'create_sequence',
  description: 'Create a multi-touch email sequence',
  inputSchema: {
    type: 'object',
    properties: {
      name: {
        type: 'string',
        description: 'Sequence name'
      },
      sequenceType: {
        type: 'string',
        enum: ['onboarding', 'renewal', 're-engagement', 'expansion', 'custom'],
        description: 'Type of sequence'
      },
      steps: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            dayOffset: { type: 'number' },
            purpose: { type: 'string' },
            keyPoints: { type: 'array', items: { type: 'string' } }
          }
        },
        description: 'Sequence steps with timing'
      },
      recipients: {
        type: 'array',
        items: { type: 'string' },
        description: 'Recipients for the sequence'
      }
    },
    required: ['name', 'sequenceType', 'steps', 'recipients']
  },
  requiresApproval: true,
  execute: async (input: {
    name: string;
    sequenceType: string;
    steps: Array<{ dayOffset: number; purpose: string; keyPoints: string[] }>;
    recipients: string[];
  }, context: AgentContext): Promise<ToolResult> => {
    console.log(`[Communicator] Creating ${input.sequenceType} sequence: ${input.name}`);

    return {
      success: true,
      data: {
        sequenceId: `seq_${Date.now()}`,
        name: input.name,
        type: input.sequenceType,
        steps: input.steps.length,
        recipients: input.recipients.length,
        status: 'pending_approval'
      }
    };
  }
};

const getEmailHistory: Tool = {
  name: 'get_email_history',
  description: 'Retrieve past email threads with customer',
  inputSchema: {
    type: 'object',
    properties: {
      customerEmail: {
        type: 'string',
        description: 'Customer email to search'
      },
      limit: {
        type: 'number',
        description: 'Maximum number of threads to return'
      },
      includeAttachments: {
        type: 'boolean',
        description: 'Whether to include attachment metadata'
      }
    },
    required: []
  },
  requiresApproval: false,
  execute: async (input: {
    customerEmail?: string;
    limit?: number;
    includeAttachments?: boolean;
  }, context: AgentContext): Promise<ToolResult> => {
    console.log(`[Communicator] Getting email history`);

    try {
      const userId = context.userId;
      if (!userId) {
        throw new Error('User ID required for Gmail access');
      }

      const email = input.customerEmail || context.customer?.primaryContact?.email;
      const query = email ? `from:${email} OR to:${email}` : undefined;

      // Get email threads from Gmail API
      const result = await gmailService.listThreads(userId, {
        maxResults: input.limit || 10,
        query,
      });

      return {
        success: true,
        data: {
          threads: result.threads.map(t => ({
            id: t.id,
            subject: t.subject,
            snippet: t.snippet,
            participants: t.participants,
            messageCount: t.messageCount,
            lastMessageAt: t.lastMessageAt,
            isUnread: t.isUnread,
          })),
          count: result.threads.length,
          customerEmail: email
        }
      };
    } catch (error) {
      console.error('[Communicator] Error getting email history:', error);
      return {
        success: false,
        error: `Failed to get email history: ${(error as Error).message}`
      };
    }
  }
};

// ============================================
// Escalation Response Tool (PRD-029)
// ============================================

const draftEscalationResponse: Tool = {
  name: 'draft_escalation_response',
  description: 'Draft an escalation response email for urgent customer issues. Generates context-aware, empathetic responses with action items and timelines.',
  inputSchema: {
    type: 'object',
    properties: {
      riskSignalId: {
        type: 'string',
        description: 'Optional risk signal ID to pull context from'
      },
      escalationType: {
        type: 'string',
        enum: ['technical', 'billing', 'service', 'executive_complaint', 'support_escalation'],
        description: 'Type of escalation'
      },
      severity: {
        type: 'string',
        enum: ['low', 'medium', 'high', 'critical'],
        description: 'Severity of the escalation'
      },
      issueDescription: {
        type: 'string',
        description: 'Description of the issue being escalated'
      },
      toEmail: {
        type: 'string',
        description: 'Recipient email address'
      },
      toName: {
        type: 'string',
        description: 'Recipient name'
      },
      immediateActions: {
        type: 'array',
        items: { type: 'string' },
        description: 'List of immediate actions being taken'
      },
      timeline: {
        type: 'object',
        properties: {
          rootCauseAnalysis: { type: 'string' },
          interimSolution: { type: 'string' },
          permanentFix: { type: 'string' }
        },
        description: 'Timeline for resolution milestones'
      },
      supportEngineer: {
        type: 'object',
        properties: {
          name: { type: 'string' },
          directLine: { type: 'string' },
          email: { type: 'string' }
        },
        description: 'Assigned support engineer details'
      },
      urgency: {
        type: 'string',
        enum: ['normal', 'expedited', 'immediate'],
        description: 'Urgency level for approval workflow'
      }
    },
    required: ['escalationType', 'issueDescription']
  },
  requiresApproval: true, // Always review escalation responses
  execute: async (input: {
    riskSignalId?: string;
    escalationType: EscalationType;
    severity?: EscalationSeverity;
    issueDescription: string;
    toEmail?: string;
    toName?: string;
    immediateActions?: string[];
    timeline?: {
      rootCauseAnalysis?: string;
      interimSolution?: string;
      permanentFix?: string;
    };
    supportEngineer?: {
      name: string;
      directLine?: string;
      email?: string;
    };
    urgency?: 'normal' | 'expedited' | 'immediate';
  }, context: AgentContext): Promise<ToolResult> => {
    console.log(`[Communicator] Drafting escalation response for ${context.customer.name}`);

    try {
      // Generate escalation response using the service
      const response = await escalationResponseGenerator.generateResponse(
        context.customer.id,
        input.riskSignalId || null,
        context.customer.csmName || 'Your CSM',
        undefined, // csmPhone
        undefined, // csmEmail
        {
          escalationType: input.escalationType,
          severity: input.severity || 'high',
          issueDescription: input.issueDescription,
          contactName: input.toName || context.customer.primaryContact?.name || 'Customer',
          immediateActions: input.immediateActions,
          timeline: input.timeline,
          supportEngineer: input.supportEngineer,
        }
      );

      if (!response) {
        return {
          success: false,
          error: 'Failed to generate escalation response'
        };
      }

      // Save draft to database
      const draftId = await escalationResponseGenerator.saveResponseDraft({
        riskSignalId: input.riskSignalId || 'manual',
        customerId: context.customer.id,
        toEmail: input.toEmail || context.customer.primaryContact?.email || '',
        toName: input.toName || context.customer.primaryContact?.name,
        draftSubject: response.draft.subject,
        draftBody: response.draft.body,
        suggestedCCs: response.draft.suggestedCCs,
        escalationType: input.escalationType,
        severity: input.severity || 'high',
        templateUsed: response.metadata.templateUsed,
        confidenceScore: response.metadata.confidenceScore,
      });

      return {
        success: true,
        data: {
          draftId: draftId || `draft_esc_${Date.now()}`,
          subject: response.draft.subject,
          body: response.draft.body,
          htmlBody: response.htmlBody,
          suggestedCCs: response.draft.suggestedCCs,
          escalationDetails: {
            type: input.escalationType,
            severity: input.severity || 'high',
            customer: {
              name: context.customer.name,
              arr: context.customer.arr,
              healthScore: context.customer.healthScore,
            },
            slaStatus: response.metadata.slaStatus,
            suggestedUrgency: response.metadata.suggestedUrgency,
          },
          status: 'pending_approval',
          urgency: input.urgency || response.metadata.suggestedUrgency,
          generatedAt: response.metadata.generatedAt,
          confidenceScore: response.metadata.confidenceScore,
        }
      };
    } catch (error) {
      console.error('[Communicator] Error drafting escalation response:', error);
      return {
        success: false,
        error: `Failed to draft escalation response: ${(error as Error).message}`
      };
    }
  }
};

const sendEscalationResponse: Tool = {
  name: 'send_escalation_response',
  description: 'Send an approved escalation response email with expedited or immediate urgency',
  inputSchema: {
    type: 'object',
    properties: {
      responseId: {
        type: 'string',
        description: 'Escalation response draft ID'
      },
      to: {
        type: 'string',
        description: 'Recipient email'
      },
      subject: {
        type: 'string',
        description: 'Email subject'
      },
      body: {
        type: 'string',
        description: 'Email body (HTML)'
      },
      cc: {
        type: 'array',
        items: { type: 'string' },
        description: 'CC recipients'
      },
      urgency: {
        type: 'string',
        enum: ['normal', 'expedited', 'immediate'],
        description: 'Urgency level'
      }
    },
    required: ['to', 'subject', 'body']
  },
  requiresApproval: true, // NEVER auto-send escalation responses
  execute: async (input: {
    responseId?: string;
    to: string;
    subject: string;
    body: string;
    cc?: string[];
    urgency?: string;
  }, context: AgentContext): Promise<ToolResult> => {
    console.log(`[Communicator] Sending escalation response to ${input.to}`);

    try {
      const userId = context.userId;
      if (!userId) {
        throw new Error('User ID required for Gmail access');
      }

      // Send the email using Gmail API
      const messageId = await gmailService.sendEmail(userId, {
        to: [input.to],
        cc: input.cc,
        subject: input.subject,
        bodyHtml: input.body,
        saveToDb: true,
        customerId: context.customer.id,
      });

      // Update response tracking if we have a responseId
      if (input.responseId) {
        await escalationResponseGenerator.markResponseSent(
          input.responseId,
          messageId,
          userId
        );
      }

      return {
        success: true,
        data: {
          messageId,
          to: input.to,
          subject: input.subject,
          cc: input.cc || [],
          status: 'sent',
          sentAt: new Date().toISOString(),
          urgency: input.urgency || 'normal',
          responseTimeTracked: !!input.responseId,
        }
      };
    } catch (error) {
      console.error('[Communicator] Error sending escalation response:', error);
      return {
        success: false,
        error: `Failed to send escalation response: ${(error as Error).message}`
      };
    }
  }
};

const getEscalationContext: Tool = {
  name: 'get_escalation_context',
  description: 'Get full context for an escalation including customer history, risk signals, and recent communications',
  inputSchema: {
    type: 'object',
    properties: {
      riskSignalId: {
        type: 'string',
        description: 'Risk signal ID to get context for'
      }
    },
    required: ['riskSignalId']
  },
  requiresApproval: false,
  execute: async (input: {
    riskSignalId: string;
  }, context: AgentContext): Promise<ToolResult> => {
    console.log(`[Communicator] Getting escalation context for signal: ${input.riskSignalId}`);

    try {
      const escalationDetails = await escalationResponseGenerator.getEscalationContext(
        input.riskSignalId
      );

      if (!escalationDetails) {
        return {
          success: false,
          error: 'Escalation context not found'
        };
      }

      return {
        success: true,
        data: {
          riskSignal: {
            id: escalationDetails.riskSignal.id,
            type: escalationDetails.escalationType,
            severity: escalationDetails.severity,
            description: escalationDetails.issueDescription,
            detectedAt: escalationDetails.riskSignal.detected_at,
            duration: escalationDetails.issueDuration,
          },
          customer: {
            id: escalationDetails.customer.id,
            name: escalationDetails.customer.name,
            arr: escalationDetails.customer.arr,
            healthScore: escalationDetails.customer.health_score,
            healthTrend: escalationDetails.healthTrend,
          },
          reportedBy: escalationDetails.reportedBy,
          recentCommunications: escalationDetails.recentCommunications,
        }
      };
    } catch (error) {
      console.error('[Communicator] Error getting escalation context:', error);
      return {
        success: false,
        error: `Failed to get escalation context: ${(error as Error).message}`
      };
    }
  }
};

const searchEmails: Tool = {
  name: 'search_emails',
  description: 'Search emails by keyword or filter',
  inputSchema: {
    type: 'object',
    properties: {
      query: {
        type: 'string',
        description: 'Search query'
      },
      from: {
        type: 'string',
        description: 'Filter by sender'
      },
      to: {
        type: 'string',
        description: 'Filter by recipient'
      },
      dateRange: {
        type: 'object',
        properties: {
          start: { type: 'string' },
          end: { type: 'string' }
        },
        description: 'Date range to search'
      },
      hasAttachment: {
        type: 'boolean',
        description: 'Filter to emails with attachments'
      },
      limit: {
        type: 'number',
        description: 'Maximum results to return'
      }
    },
    required: ['query']
  },
  requiresApproval: false,
  execute: async (input: {
    query: string;
    from?: string;
    to?: string;
    dateRange?: { start: string; end: string };
    hasAttachment?: boolean;
    limit?: number;
  }, context: AgentContext): Promise<ToolResult> => {
    console.log(`[Communicator] Searching emails: ${input.query}`);

    try {
      const userId = context.userId;
      if (!userId) {
        throw new Error('User ID required for Gmail access');
      }

      // Build Gmail search query
      const queryParts: string[] = [input.query];
      if (input.from) queryParts.push(`from:${input.from}`);
      if (input.to) queryParts.push(`to:${input.to}`);
      if (input.hasAttachment) queryParts.push('has:attachment');
      if (input.dateRange?.start) queryParts.push(`after:${input.dateRange.start}`);
      if (input.dateRange?.end) queryParts.push(`before:${input.dateRange.end}`);

      const fullQuery = queryParts.join(' ');

      // Search emails using Gmail API
      const result = await gmailService.listThreads(userId, {
        maxResults: input.limit || 20,
        query: fullQuery,
      });

      return {
        success: true,
        data: {
          results: result.threads.map(t => ({
            id: t.id,
            subject: t.subject,
            snippet: t.snippet,
            participants: t.participants,
            messageCount: t.messageCount,
            lastMessageAt: t.lastMessageAt,
            isUnread: t.isUnread,
          })),
          count: result.threads.length,
          query: fullQuery
        }
      };
    } catch (error) {
      console.error('[Communicator] Error searching emails:', error);
      return {
        success: false,
        error: `Failed to search emails: ${(error as Error).message}`
      };
    }
  }
};

// ============================================
// Communicator Agent Definition
// ============================================

// Get data access tools for the communicator
const communicatorDataTools = getToolsForAgent('communicator');

export const CommunicatorAgent: Agent = {
  id: 'communicator',
  name: 'Customer Communicator',
  role: 'Draft and manage customer communications',
  description: 'Handles all email-related tasks including drafting personalized emails, managing sequences, and tracking email history. Has access to customer context and risk signals for informed communication.',
  model: 'claude-sonnet-4', // Needs good writing

  tools: [
    draftEmail,
    sendEmail,
    createSequence,
    getEmailHistory,
    searchEmails,
    // Escalation tools
    draftEscalationResponse,
    sendEscalationResponse,
    getEscalationContext,
    // Data access tools for customer context
    ...communicatorDataTools
  ],

  permissions: {
    allowedTools: [
      'draft_email', 'send_email', 'create_sequence', 'get_email_history', 'search_emails',
      'draft_escalation_response', 'send_escalation_response', 'get_escalation_context',
      // Data access tools
      'get_customer_360', 'get_customer_history', 'get_risk_signals'
    ],
    allowedDirectories: ['/emails', '/templates'],
    requiresApproval: ['draft_email', 'send_email', 'create_sequence', 'draft_escalation_response', 'send_escalation_response'],
    blockedActions: ['delete_emails', 'access_other_customers']
  },

  requiredContext: ['customer', 'customer.stakeholders', 'recentInteractions'],

  hooks: {
    preToolUse: async (tool: string, input: any) => {
      console.log(`[Communicator] Using tool: ${tool}`);
      return true;
    },
    postToolUse: async (tool: string, output: any) => {
      console.log(`[Communicator] Tool complete: ${tool}`);
    },
    onError: async (error: Error) => {
      console.error(`[Communicator] Error: ${error.message}`);
    }
  }
};

export default CommunicatorAgent;
