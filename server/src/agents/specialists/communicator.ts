/**
 * Communicator Agent
 * Drafts and manages customer communications
 * Integrates with Gmail
 */

import {
  Agent,
  AgentContext,
  Tool,
  ToolResult
} from '../types';

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

    // TODO: Integrate with Gmail API
    return {
      success: true,
      data: {
        messageId: `msg_${Date.now()}`,
        to: input.to,
        subject: input.subject,
        status: 'pending_approval',
        sentAt: null
      }
    };
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

    // TODO: Integrate with Gmail API
    return {
      success: true,
      data: {
        threads: [],
        count: 0,
        customerEmail: input.customerEmail || context.customer?.primaryContact?.email
      }
    };
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

    // TODO: Integrate with Gmail API
    return {
      success: true,
      data: {
        results: [],
        count: 0,
        query: input.query
      }
    };
  }
};

// ============================================
// Communicator Agent Definition
// ============================================

export const CommunicatorAgent: Agent = {
  id: 'communicator',
  name: 'Customer Communicator',
  role: 'Draft and manage customer communications',
  description: 'Handles all email-related tasks including drafting personalized emails, managing sequences, and tracking email history.',
  model: 'claude-sonnet-4', // Needs good writing

  tools: [
    draftEmail,
    sendEmail,
    createSequence,
    getEmailHistory,
    searchEmails
  ],

  permissions: {
    allowedTools: ['draft_email', 'send_email', 'create_sequence', 'get_email_history', 'search_emails'],
    allowedDirectories: ['/emails', '/templates'],
    requiresApproval: ['draft_email', 'send_email', 'create_sequence'],
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
